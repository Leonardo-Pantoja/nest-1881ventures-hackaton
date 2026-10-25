const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
let user = null;
const clientPath = path.resolve('src/lib/supabase/server.ts');
require.cache[clientPath] = { id: clientPath, filename: clientPath, loaded: true, exports: {
  createServerSupabaseClient: async () => ({ auth: { getUser: async () => ({ data: { user }, error: null }) } }),
} };
const { authorizeRecognition } = require('../src/lib/ai/recognitionAccess.ts');
const req = (headers = {}) => new Request('https://app.test/api/ai/recognize-product', { method: 'POST', headers: { origin: 'https://app.test', ...headers } });
test('requires same-origin access and verified auth or valid demo profile', async () => {
  assert.equal((await authorizeRecognition(req({ origin: 'https://evil.test' }))).status, 403);
  assert.equal((await authorizeRecognition(req())).status, 401);
  assert.equal((await authorizeRecognition(req({ 'x-recognition-mode': 'demo', 'x-demo-profile': 'invalid' }))).status, 403);
  user = { id: 'verified-user' }; assert.equal(await authorizeRecognition(req()), null);
});
test('limits authenticated usage and shares demo budget across profile changes', async () => {
  user = { id: 'rate-test' };
  for (let i = 0; i < 6; i++) assert.equal(await authorizeRecognition(req()), null);
  const denied = await authorizeRecognition(req()); assert.equal(denied.status, 429); assert.ok(Number(denied.headers.get('retry-after')) > 0);
  for (let i = 0; i < 3; i++) assert.equal(await authorizeRecognition(req({ 'x-recognition-mode': 'demo', 'x-demo-profile': 'mateo' })), null);
  assert.equal((await authorizeRecognition(req({ 'x-recognition-mode': 'demo', 'x-demo-profile': 'carlos' }))).status, 429);
});
