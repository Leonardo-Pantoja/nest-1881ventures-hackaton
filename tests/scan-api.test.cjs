const assert = require('node:assert/strict');
const { test, before } = require('node:test');
const sharp = require('sharp');
const Module = require('node:module');
const originalLoad = Module._load;
let output = { name: 'Sony', price: 2300, currency: 'MXN' };
let failure = null;
let raw = null;
let calls = 0;
Module._load = function(name, ...args) {
  if (name === '@google/genai') return { GoogleGenAI: class {
    constructor() { this.models = { generateContent: async (params) => {
      calls++;
      assert.equal(params.model, 'test-model');
      assert.equal(params.contents[0].parts[1].inlineData.mimeType, 'image/jpeg');
      assert.equal(params.contents[0].parts.length, 2);
      assert.equal(JSON.stringify(params).includes('currentBalance'), false);
      if (failure) throw failure;
      return { text: raw ?? JSON.stringify(output) };
    } }; }
  } };
  if (name === '@/lib/ai/recognitionAccess') return { authorizeRecognition: async () => null };
  return originalLoad.call(this, name, ...args);
};
const { POST } = require('../src/app/api/ai/recognize-product/route.ts');
const legacy = require('../src/app/api/scan/route.ts');
Module._load = originalLoad;
process.env.GEMINI_API_KEY = 'test-key'; process.env.GEMINI_MODEL = 'test-model';
let png;
before(async () => { png = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#ffffff' } }).png().toBuffer(); });
const request = (type = 'image/png', data = png) => {
  const form = new FormData(); form.append('image', new File([data], 'capture.png', { type }));
  return new Request('https://app.test/api/ai/recognize-product', { method: 'POST', body: form });
};
test('extracts product and currency without financial data and preserves null fields', async () => {
  assert.equal(legacy.POST, POST);
  let response = await POST(request());
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { ...output, source: 'image', needsConfirmation: true });
  output = { name: 'Sony', price: null, currency: null, xp: 100, balance: 1000 };
  response = await POST(request());
  assert.deepEqual(await response.json(), { name: 'Sony', price: null, currency: null, source: 'image', needsConfirmation: true });
  output = { name: null, price: null, currency: null };
  assert.deepEqual(await (await POST(request())).json(), { ...output, source: 'image', needsConfirmation: true });
});
test('rejects invalid or oversized images and missing configuration before calling Gemini', async () => {
  const before = calls;
  assert.equal((await POST(request('image/svg+xml'))).status, 400);
  assert.equal((await POST(request('image/png', 'not an image'))).status, 400);
  assert.equal((await POST(request('image/png', ''))).status, 413);
  assert.equal((await POST(request('image/png', Buffer.alloc(8 * 1024 * 1024 + 1)))).status, 413);
  delete process.env.GEMINI_API_KEY; assert.equal((await POST(request())).status, 503);
  process.env.GEMINI_API_KEY = 'test-key'; assert.equal(calls, before);
});
test('reports malformed model data, network failures and quota failures', async () => {
  for (const invalid of [{ name: '', price: null, currency: null }, { name: 'Sony', price: -1, currency: 'MXN' }, { name: 'Sony', price: '2300', currency: 'MXN' }]) {
    output = invalid; assert.equal((await POST(request())).status, 422);
  }
  raw = 'not JSON'; assert.equal((await POST(request())).status, 422); raw = null;
  failure = new Error('network'); assert.equal((await POST(request())).status, 502);
  failure = { status: 429 }; const response = await POST(request()); assert.equal(response.status, 429); assert.equal(response.headers.get('retry-after'), '60');
  failure = null;
});
