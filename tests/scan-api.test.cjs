const assert = require('node:assert/strict');
const { test } = require('node:test');
const Module = require('node:module');
const originalLoad = Module._load;
let output = { name: 'Audífonos Sony', price: 2300 };
let calls = 0;
Module._load = function(name, ...args) {
  if (name === '@google/genai') return { GoogleGenAI: class {
    constructor() { this.models = { generateContent: async (params) => {
      calls++;
      assert.equal(params.model, 'test-model');
      assert.equal(params.contents[0].parts[1].inlineData.mimeType, 'image/png');
      return { text: JSON.stringify(output) };
    } }; }
  } };
  return originalLoad.call(this, name, ...args);
};
const { POST } = require('../src/app/api/scan/route.ts');
Module._load = originalLoad;
process.env.GEMINI_API_KEY = 'test-key';
process.env.GEMINI_MODEL = 'test-model';
const request = (type = 'image/png', data = 'image-bytes') => {
  const form = new FormData();
  form.append('image', new File([data], 'capture.png', { type }));
  return new Request('https://app.test/api/scan', { method: 'POST', body: form });
};
test('recognition returns only product fields and preserves unreadable prices as null', async () => {
  let response = await POST(request());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), output);
  output = { name: 'Sony', price: null, xp: 100, balance: 1000 };
  response = await POST(request());
  assert.deepEqual(await response.json(), { name: 'Sony', price: null });
});
test('rejects invalid inputs and configuration before calling Gemini', async () => {
  const before = calls;
  assert.equal((await POST(request('image/svg+xml'))).status, 400);
  assert.equal((await POST(request('image/png', ''))).status, 413);
  assert.equal((await POST(request('image/png', 'x'.repeat(8 * 1024 * 1024 + 1)))).status, 413);
  delete process.env.GEMINI_API_KEY;
  assert.equal((await POST(request())).status, 503);
  process.env.GEMINI_API_KEY = 'test-key';
  assert.equal(calls, before);
});
test('does not accept invented malformed or negative product data', async () => {
  for (const invalid of [{ name: '', price: null }, { name: 'Sony', price: -1 }, { name: 'Sony', price: '2300' }]) {
    output = invalid;
    assert.equal((await POST(request())).status, 422);
  }
});
