const assert = require('node:assert/strict');
const { test } = require('node:test');
const Module = require('node:module');
const oldLoad = Module._load;
let queue = [], params = [], sleeps = [], logs = [];
Module._load = function(name, ...args) {
  if (name === '@google/genai') return { ThinkingLevel: { LOW: 'LOW' }, GoogleGenAI: class {
    constructor() { this.models = { generateContent: async value => {
      params.push(value);
      const next = queue.shift();
      if (next instanceof Error || next?.status) throw next;
      return { text: next ?? '{"name":"Sony","price":null,"currency":"MXN"}' };
    } }; }
  } };
  if (name === 'node:timers/promises') return { setTimeout: async ms => { sleeps.push(ms); } };
  return oldLoad.call(this, name, ...args);
};
const { extractProduct, GEMINI_TIMEOUT_MS } = require('../src/lib/ai/gemini.ts');
Module._load = oldLoad;
const options = { source: 'text', prompt: 'private-product-text' };
const reset = () => { queue = []; params = []; sleeps = []; logs = []; process.env.GEMINI_API_KEY = 'secret-test-key'; process.env.GEMINI_MODEL = 'gemini-3.8-flash'; };
test('uses configured model, low thinking, bounded timeout and no hidden SDK retries', async () => {
  reset(); await extractProduct(options);
  assert.equal(params[0].model, 'gemini-3.8-flash');
  assert.deepEqual(params[0].config.thinkingConfig, { thinkingLevel: 'LOW' });
  assert.equal(params[0].config.automaticContinuation, false);
  assert.deepEqual(params[0].config.httpOptions.retryOptions, { attempts: 1 });
  assert.ok(params[0].config.httpOptions.timeout <= GEMINI_TIMEOUT_MS);
});
test('retries 503/504 once with backoff, never retries auth validation quota or local timeout', async () => {
  for (const status of [503, 504]) {
    reset(); queue = [{ status }, '{"name":"Monitor","price":100,"currency":"MXN"}'];
    assert.equal((await extractProduct(options)).price, 100); assert.equal(params.length, 2); assert.deepEqual(sleeps, [750]);
    reset(); queue = [{ status }, { status }];
    await assert.rejects(extractProduct(options), error => error.code === `gemini_upstream_${status}`);
    assert.equal(params.length, 2);
  }
  for (const status of [400, 401, 403, 429]) {
    reset(); queue = [{ status }]; await assert.rejects(extractProduct(options)); assert.equal(params.length, 1); assert.equal(sleeps.length, 0);
  }
  reset(); queue = ['not-json']; await assert.rejects(extractProduct(options), error => error.code === 'gemini_validation'); assert.equal(params.length, 1);
  reset(); queue = [Object.assign(new Error('timeout'), { name: 'TimeoutError' })];
  await assert.rejects(extractProduct(options), error => error.code === 'gemini_local_timeout'); assert.equal(params.length, 1);
});
test('logs operational metadata without credentials prompt image contents or provider errors', async () => {
  reset(); const oldInfo = console.info;
  console.info = (...args) => logs.push(args);
  try {
    queue = [new Error('secret-test-key provider body')];
    await assert.rejects(extractProduct({ ...options, source: 'image', image: { bytes: Buffer.from('private-image-content'), originalBytes: 1024, mimeType: 'image/jpeg' } }));
    const output = JSON.stringify(logs);
    for (const secret of ['secret-test-key', 'private-product-text', 'private-image-content', 'provider body']) assert.equal(output.includes(secret), false);
    assert.equal(logs[0][1].originalImageBytes, 1024); assert.equal(logs[0][1].code, 'gemini_connection'); assert.equal(typeof logs[0][1].durationMs, 'number');
  } finally { console.info = oldInfo; }
});
test('does not call provider after request cancellation', async () => {
  reset(); const controller = new AbortController(); controller.abort();
  await assert.rejects(extractProduct({ ...options, signal: controller.signal }), error => error.code === 'request_cancelled'); assert.equal(params.length, 0);
});
