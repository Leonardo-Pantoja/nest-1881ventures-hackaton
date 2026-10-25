const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const server = require('../src/lib/supabase/server.ts');
const account = require('../src/lib/finance/accountSnapshot.ts');
const gemini = require('../src/lib/ai/gemini.ts');
const { fallbackIntent } = require('../src/lib/ai/financialAssistant.ts');
const engine = require('../src/lib/onboarding/purchaseReport.ts');
const originalReport = engine.buildPurchaseReport;
let reportCalls = 0, reads = 0, calls = [], identity = 'A', failIntent = false, failExplanation = false, frozenClock = 0;
const realNow = Date.now;
Date.now = () => realNow() + frozenClock;
process.env.CHAT_CONTEXT_SECRET = 'synthetic-test-signing-key-only';
const profile = { id: 'A', lifeContext: [], currentBalance: 3000, safetyBuffer: 650, dailyEssentialBurn: 210,
  payFrequency: 'variable', nextPaydayDays: null, nextPaydayAmount: null, incomeSources: [], goals: [], commitments: [], debts: [],
  dataWarnings: ['income_sources_missing'], isOnboarded: true };
server.createServerSupabaseClient = async () => ({ auth: { getUser: async () => ({ data: { user: { id: identity } }, error: null }) } });
account.loadAccountSnapshot = async () => { reads++; return { profile: { ...profile, id: identity }, userId: identity, revision: 'fresh-server-revision', raw: { financialDate: '2026-10-25' } }; };
engine.buildPurchaseReport = (...args) => { reportCalls++; return originalReport(...args); };
gemini.generateStructured = async options => {
  calls.push(options);
  const input = JSON.parse(options.prompt);
  if (options.source === 'chat-intent') {
    if (failIntent) throw new gemini.ProductAIError('gemini_upstream_503', 'Temporarily unavailable', 503);
    return fallbackIntent({ message: input.message, product: input.product, pendingProductName: input.pendingProductName, history: input.history });
  }
  if (failExplanation) throw new gemini.ProductAIError('gemini_upstream_504', 'Temporarily unavailable', 504);
  return { body: input.facts.filter(f => f.required).map(f => `{{fact:${f.id}}}`).join('\n\n'),
    factIds: input.facts.map(f => f.id), followUp: input.suggestedFollowUp ?? null };
};
const { POST } = require('../src/app/api/ai/chat/route.ts');
const send = async (message, token, extras = {}) => {
  const response = await POST(new Request('https://app.test/api/ai/chat', { method: 'POST', headers: { origin: 'https://app.test', 'content-type': 'application/json' },
    body: JSON.stringify({ requestId: randomUUID(), message, history: [], mode: 'account', ...(token ? { conversationToken: token } : {}), ...extras }) }));
  return { status: response.status, ...await response.json() };
};
const reset = () => { identity = randomUUID(); reads = 0; reportCalls = 0; calls = []; failIntent = false; failExplanation = false; frozenClock += 61000; };

test('A–G: current question, prior assistant question and latest product guide distinct turns on fresh server data', async () => {
  reset();
  const original = JSON.stringify(profile);
  const a = await send('¿Puedo comprar Metroid Ravenous por $1,449?');
  assert.equal(a.status, 200); assert.equal(a.source, 'gemini'); assert.equal(a.report.purchase.purchaseAmount, 1449);
  assert.equal(a.hypotheticalBalance.hypotheticalBalance, 1551); assert.equal(a.report.purchase.safeToSpend, null);
  assert.ok(a.actions.some(action => action.type === 'complete_income'));
  const reportsBefore = reportCalls;
  const confirmed = await send('Sí, están actualizados', a.conversationToken);
  assert.equal(confirmed.source, 'gemini'); assert.match(confirmed.reply, /Gracias por confirmarlo/);
  assert.notEqual(confirmed.reply, a.reply); assert.equal(confirmed.report, undefined); assert.equal(reportCalls, reportsBefore);
  assert.equal(confirmed.cards.length, 0); assert.ok(!confirmed.reply.includes('¿Tus ingresos'));
  const previousContext = JSON.parse(calls.filter(c => c.source === 'chat-explanation')[1].prompt);
  assert.equal(previousContext.question, 'Sí, están actualizados'); assert.equal(previousContext.previousReply, a.reply);
  const wait = await send('¿Y si espero dos semanas?', confirmed.conversationToken);
  assert.equal(wait.source, 'gemini'); assert.equal(wait.cards.find(c => c.label === 'Semanas de espera').value, 2); assert.ok(wait.cards.some(c => c.value === 2940));
  assert.equal(wait.report, undefined); assert.equal(reportCalls, reportsBefore);
  const cheaper = await send('¿Y si el juego costara $900?', wait.conversationToken);
  assert.equal(cheaper.product.name, 'Metroid Ravenous'); assert.equal(cheaper.product.price, 900);
  const savings = await send('¿Cuánto tendría que ahorrar para comprarlo en cuatro semanas?', cheaper.conversationToken);
  assert.equal(savings.mathematicalSavings.requiredWeeklyContribution, 225);
  assert.equal(savings.savings.weeklyCapacity, null); assert.match(savings.reply, /no se ha comprobado.*sin afectar/);
  const priority = await send('¿Qué debería priorizar este mes?', savings.conversationToken);
  assert.equal(priority.report, undefined); assert.match(priority.reply, /necesidades esenciales/);
  frozenClock += 61000;
  const available = await send('¿Cuánto puedo gastar hoy?', priority.conversationToken);
  assert.equal(available.source, 'gemini'); assert.equal(available.report, undefined); assert.equal(available.cards.length, 3);
  const none = await send('No tengo ingresos actualmente', available.conversationToken);
  assert.equal(none.source, 'gemini'); assert.match(none.reply, /no tienes ingresos|actualmente no tienes ingresos/); assert.equal(none.followUp, null);
  const another = await send('¿Cuánto puedo gastar?', none.conversationToken);
  assert.equal(another.source, 'gemini'); assert.ok(!another.reply.includes('¿Tus ingresos')); assert.equal(another.followUp, null);
  const variable = await send('Mis ingresos son variables', another.conversationToken);
  assert.equal(variable.source, 'gemini'); assert.match(variable.reply, /ingresos.*variables/); assert.equal(variable.followUp, null);
  assert.equal(reads, 10); assert.equal(JSON.stringify(profile), original);
});

test('D: mathematical target is available at 362.25 without inventing sustainable income', async () => {
  reset();
  const purchase = await send('Quiero comprar Metroid Ravenous por $1449');
  const savings = await send('¿Cuánto tendría que ahorrar para comprarlo en cuatro semanas?', purchase.conversationToken);
  assert.equal(savings.mathematicalSavings.requiredWeeklyContribution, 362.25);
  assert.equal(savings.savings.status, 'datos_incompletos'); assert.equal(savings.savings.weeklyCapacity, null);
  assert.match(savings.reply, /362\.25/); assert.equal(savings.report, undefined);
});

test('H: signed dialogue is account-bound and client financial history cannot override server data', async () => {
  reset(); const initial = await send('¿Cuánto puedo gastar?');
  const beforeReads = reads, beforeCalls = calls.length;
  identity = randomUUID();
  const other = await send('Sí, están actualizados', initial.conversationToken);
  assert.equal(other.status, 409); assert.equal(other.code, 'conversation_changed');
  assert.equal(reads, beforeReads); assert.equal(calls.length, beforeCalls);
  const tampered = await send('Hola', initial.conversationToken + 'x');
  assert.equal(tampered.status, 409);
  const forged = await send('¿Cuánto puedo gastar?', undefined, { financialReport: { safeToSpend: 999999 } });
  assert.equal(forged.status, 400);
});

test('I: interpreter503 or explanation504 keeps deterministic results and the existing signed conversation', async () => {
  reset(); let initial = await send('Quiero comprar Metroid Ravenous por $1449');
  failIntent = true;
  let failure = await send('¿Y si el juego costara $900?', initial.conversationToken);
  assert.equal(failure.source, 'deterministic'); assert.equal(failure.code, 'gemini_upstream_503');
  assert.equal(failure.product.price, 900); assert.ok(failure.warning.includes('asistente conversacional no está disponible'));
  assert.ok(failure.conversationToken); assert.equal(failure.report.purchase.purchaseAmount, 900);
  failIntent = false; failExplanation = true;
  initial = failure;
  failure = await send('¿Cuánto tendría que ahorrar para comprarlo en cuatro semanas?', initial.conversationToken);
  assert.equal(failure.source, 'deterministic'); assert.equal(failure.code, 'gemini_upstream_504');
  assert.equal(failure.mathematicalSavings.requiredWeeklyContribution, 225);
  assert.ok(failure.conversationToken);
});
