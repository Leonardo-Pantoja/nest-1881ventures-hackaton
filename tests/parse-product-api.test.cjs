const assert = require('node:assert/strict');
const { test } = require('node:test');
const Module = require('node:module');
const originalLoad = Module._load;
let answer = { name: 'Nintendo Switch OLED', price: 5400, currency: 'MXN' }, calls = 0, status = 0;
Module._load = function(name, ...args) {
  if (name === '@google/genai') return { ThinkingLevel: { LOW: 'LOW' }, GoogleGenAI: class {
    constructor() { this.models = { generateContent: async params => {
      calls++;
      assert.equal(params.contents[0].parts.length, 1);
      assert.equal(JSON.stringify(params).includes('currentBalance'), false);
      if (status) throw { status };
      return { text: JSON.stringify(answer) };
    } }; }
  } };
  if (name === '@/lib/ai/recognitionAccess') return { authorizeRecognition: async () => null };
  if (name === 'node:timers/promises') return { setTimeout: async () => {} };
  return originalLoad.call(this, name, ...args);
};
const { POST } = require('../src/app/api/ai/parse-product/route.ts');
Module._load = originalLoad;
process.env.GEMINI_API_KEY = 'test'; process.env.GEMINI_MODEL = 'gemini-3.8-flash';
const request = body => new Request('https://app.test/api/ai/parse-product', { method: 'POST', body: JSON.stringify(body) });
test('text endpoint validates input before calling Gemini', async () => {
  const before = calls;
  for (const body of [null, {}, { text: '' }, { text: 4 }, { text: 'x'.repeat(501) }]) assert.equal((await POST(request(body))).status, 400);
  assert.equal(calls, before);
});
test('extracts explicit price and keeps missing or invented prices null', async () => {
  let response = await POST(request({ text: 'Nintendo Switch OLED de 5400 pesos' }));
  assert.deepEqual(await response.json(), { ...answer, source: 'text', needsConfirmation: true });
  answer = { name: 'Laptop Lenovo IdeaPad', price: null, currency: 'MXN' };
  assert.equal((await (await POST(request({ text: 'Laptop Lenovo IdeaPad' }))).json()).price, null);
  answer = { name: 'Sony WH-1000XM5', price: 1000, currency: 'MXN' };
  assert.equal((await (await POST(request({ text: 'Sony WH-1000XM5' }))).json()).price, null);
  answer = { name: 'Laptop Lenovo IdeaPad 3', price: 3, currency: 'MXN' };
  assert.equal((await (await POST(request({ text: 'Laptop Lenovo IdeaPad 3' }))).json()).price, null);
  answer = { name: 'Nike', price: 2500, currency: 'MXN' };
  assert.equal((await (await POST(request({ text: 'Nike de aproximadamente 2000 pesos' }))).json()).price, null);
});
test('returns distinct upstream timeout code after at most one retry', async () => {
  const before = calls; status = 504;
  const response = await POST(request({ text: 'Monitor de 3000 pesos' }));
  assert.equal(calls - before, 2); assert.equal(response.status, 504);
  assert.equal((await response.json()).code, 'gemini_upstream_504'); status = 0;
});
