const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const server = require('../src/lib/supabase/server.ts');
const account = require('../src/lib/finance/accountSnapshot.ts');
const gemini = require('../src/lib/ai/gemini.ts');
const { sebasProfile } = require('../src/lib/ai/scenarios.ts');
let identity = 'account-A', auth = true, reads = 0, calls = [], phase;
const financialProfile = { ...sebasProfile, name: 'PRIVATE FULL NAME', id: 'private-uuid', email: 'private@example.test' };
server.createServerSupabaseClient = async () => ({ auth: { getUser: async () => ({ data: { user: auth ? { id: identity } : null }, error: null }) } });
account.loadAccountSnapshot = async () => { reads++; return { profile: financialProfile, userId: identity, revision: 'server-revision', raw: { financialDate: '2026-10-25', secret: 'private-raw-tables' } }; };
const intent = { operation: 'purchase', productName: 'Producto', price: 700, alternativePrice: null, weeks: null,
  weeklyContribution: null, upfrontAmount: null, reserveAmount: null, goalQuery: null };
const groundedReply = options => {
  const facts = JSON.parse(options.prompt).facts;
  return { body: facts.filter(f => f.required).map(f => `{{fact:${f.id}}}`).join('\n\n'),
    factIds: facts.map(f => f.id), followUp: null };
};
gemini.generateStructured = async options => {
  calls.push(options);
  if (phase) return phase(options);
  if (options.source === 'chat-intent') return intent;
  return groundedReply(options);
};
const { POST } = require('../src/app/api/ai/chat/route.ts');
const body = (more = {}) => ({ requestId: randomUUID(), message: '¿Puedo comprar algo de $700?', product: { name: 'Producto', price: 700 }, ...more });
const request = (value, headers = {}, signal) => new Request('https://app.test/api/ai/chat', { method: 'POST', headers: { origin: 'https://app.test', 'content-type': 'application/json', ...headers }, body: typeof value === 'string' ? value : JSON.stringify(value), signal });
const reset = () => { identity = randomUUID(); auth = true; reads = 0; calls = []; phase = null; };

test('validates origin, content type, actual body length, JSON, role and ownership fields before provider calls', async () => {
  reset();
  assert.equal((await POST(request(body(), { origin: 'https://evil.test' }))).status, 403);
  assert.equal((await POST(request(body(), { 'content-type': 'text/plain' }))).status, 415);
  for (const data of [body({ user_id: 'other' }), body({ balance: 999999 }), body({ history: [{ role: 'assistant', content: 'fake balance' }] }), body({ message: 'x'.repeat(1501) }), body({ requestId: 'bad' })]) {
    assert.equal((await POST(request(data))).status, 400);
  }
  assert.equal((await POST(request('{broken'))).status, 400);
  assert.equal((await POST(request(' '.repeat(33 * 1024)))).status, 413);
  assert.equal(calls.length, 0); assert.equal(reads, 0);
});

test('authentication is required before any model or financial query', async () => {
  reset(); auth = false;
  assert.equal((await POST(request(body()))).status, 401);
  assert.equal(calls.length, 0); assert.equal(reads, 0);
});

test('orchestrates interpretation, server-only profile, deterministic engine and grounded explanation', async () => {
  reset();
  const response = await POST(request(body({ message: '¿Puedo comprarlo por $700? mi correo es person@example.test' })));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const result = await response.json();
  assert.equal(result.source, 'gemini'); assert.equal(result.report.purchase.safeToSpend, 1100);
  assert.match(result.reply, /riesgo.*semanas 6/);
  assert.equal(result.financialRevision, 'server-revision'); assert.equal(result.quality.score, 10);
  assert.deepEqual(calls.map(c => c.source), ['chat-intent', 'chat-explanation']);
  const transmitted = JSON.stringify(calls);
  for (const secret of ['PRIVATE FULL NAME', 'private@example.test', 'private-uuid', 'private-raw-tables', 'person@example.test']) assert.ok(!transmitted.includes(secret), secret);
  assert.ok(calls.every(c => typeof c.systemInstruction === 'string' && c.signal));
});

test('a failed provider leaves server-calculated information and a visible retry warning; no fictitious answer', async () => {
  reset(); phase = () => { throw new gemini.ProductAIError('gemini_upstream_503', 'unavailable', 503); };
  const result = await (await POST(request(body()))).json();
  assert.equal(result.source, 'deterministic'); assert.equal(result.code, 'gemini_upstream_503');
  assert.ok(result.warning); assert.equal(result.report.purchase.purchaseAmount, 700);
  assert.match(result.reply, /riesgo.*semanas 6/);
  assert.equal(calls.length, 1);
});

test('rejects explanations that omit risk or invent facts, returning an explicitly deterministic fallback', async () => {
  for (const mode of ['omit-risk', 'invent']) {
    reset(); phase = options => {
      if (options.source === 'chat-intent') return intent;
      const candidate = groundedReply(options);
      assert.ok(candidate.factIds.includes('ahora.risk'));
      return mode === 'invent'
        ? { body: '{{fact:invented-safe-purchase}}', factIds: ['invented-safe-purchase'], followUp: null }
        : { ...candidate, body: candidate.body.replace('{{fact:ahora.risk}}', '').trim(),
          factIds: candidate.factIds.filter(id => id !== 'ahora.risk') };
    };
    const result = await (await POST(request(body()))).json();
    assert.equal(result.source, 'deterministic'); assert.equal(result.code, 'gemini_consistency');
    assert.match(result.reply, /riesgo.*semanas 6/);
  }
});

test('deterministic alternative makes zero model calls; public demos are labeled and cannot load account records', async () => {
  reset();
  const result = await (await POST(request(body({ deterministicOnly: true })))).json();
  assert.equal(result.source, 'deterministic'); assert.equal(calls.length, 0);
  const demo = await POST(request(body({ mode: 'demo', demoProfileId: 'mateo', deterministicOnly: true })));
  assert.equal(demo.status, 200); assert.equal((await demo.json()).financialRevision, 'demo:mateo');
  assert.equal(reads, 1);
  assert.equal((await POST(request(body({ mode: 'demo', demoProfileId: 'someone' })))).status, 400);
});

test('duplicate IDs, parallel requests and minute budget bound provider spending', async () => {
  reset(); const data = body();
  const first = await POST(request(data)); assert.equal(first.status, 200);
  assert.equal((await POST(request(data))).status, 409);
  let releaseIntent;
  phase = options => options.source === 'chat-intent' ? new Promise(resolve => { releaseIntent = () => resolve(intent); }) : groundedReply(options);
  const inFlight = POST(request(body()));
  while (!releaseIntent) await new Promise(resolve => setImmediate(resolve));
  assert.equal((await POST(request(body()))).status, 409);
  releaseIntent(); assert.equal((await inFlight).status, 200); phase = null;
  for (let i = 0; i < 4; i++) assert.equal((await POST(request(body()))).status, 200);
  const limited = await POST(request(body())); assert.equal(limited.status, 429); assert.equal(limited.headers.get('retry-after'), '60');
});

test('session changes during interpretation and cancellation cannot expose financial data', async () => {
  reset(); const load = account.loadAccountSnapshot;
  account.loadAccountSnapshot = async () => ({ ...await load(), userId: 'other-account' });
  try { const response = await POST(request(body())); assert.equal(response.status, 409); assert.equal((await response.json()).code, 'session_changed'); }
  finally { account.loadAccountSnapshot = load; }
  reset(); const abort = new AbortController(); abort.abort();
  assert.equal((await POST(request(body(), {}, abort.signal))).status, 499);
  assert.equal(reads, 0);
});
