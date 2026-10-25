// Optional Chrome CDP smoke test; run a local app and isolated headless Chrome on port 9227 first.
// Uses an initial synthetic demo profile. Does not access browser account sessions or modify Supabase.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PRELOADED_SANDBOX_PROFILES } = require('../src/context/FinancialContext.tsx');
let browserSocket;
async function main() {
  const target = await (await fetch('http://127.0.0.1:9227/json/new?about:blank', { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl); browserSocket = ws;
  await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
  let nextId = 0;
  const pending = new Map(), exceptions = [], chatRequests = [];
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) { const p = pending.get(message.id); pending.delete(message.id); if (message.error) p.reject(Error(message.error.message)); else p.resolve(message.result); }
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text);
    if (message.method === 'Network.requestWillBeSent' && message.params.request.url.endsWith('/api/ai/chat')) chatRequests.push(message.params.request);
  });
  function call(method, params = {}) { return new Promise((resolve, reject) => { const id = ++nextId; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); }); }
  async function js(expression) {
    const response = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (response.exceptionDetails) throw Error('Browser evaluation failed: ' + response.exceptionDetails.text);
    return response.result.value;
  }
  async function until(expression, ms = 20000) {
    const start = Date.now();
    while (Date.now() - start < ms) { if (await js(expression)) return; await new Promise(resolve => setTimeout(resolve, 200)); }
    console.error(await js('document.body.innerText.slice(0, 3000)'));
    throw Error('Browser wait timed out: ' + expression);
  }
  const setValue = (selector, value, textarea = false) => js(`(() => { const input=document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(${textarea ? 'HTMLTextAreaElement' : 'HTMLInputElement'}.prototype,'value').set.call(input,${JSON.stringify(value)}); input.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  await call('Page.enable'); await call('Runtime.enable'); await call('Network.enable');
  await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
  await call('Page.addScriptToEvaluateOnNewDocument', { source: `if(['127.0.0.1','localhost'].includes(location.hostname)){sessionStorage.setItem('antesdegastar_demo_profile_v2',${JSON.stringify(JSON.stringify(PRELOADED_SANDBOX_PROFILES.mateo))});localStorage.setItem('antesdegastar_seen_quick_guide_v1','true');}` });
  await call('Page.navigate', { url: (process.env.ADG_APP_ORIGIN || 'http://localhost:3000') + '/app' });
  await until(`Boolean(document.querySelector('textarea[aria-label="Pregunta a tu copiloto financiero"]'))`);
  const textarea = 'textarea[aria-label="Pregunta a tu copiloto financiero"]';
  await setValue(textarea, '¿Puedo comprar un monitor de $1200?', true);
  await new Promise(resolve => setTimeout(resolve, 500));
  assert.equal(chatRequests.length, 0, 'typing must not issue chat requests');
  await js(`document.querySelector(${JSON.stringify(textarea)}).dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',shiftKey:true,bubbles:true}))`);
  assert.equal(chatRequests.length, 0, 'Shift+Enter must not submit');
  await js(`document.querySelector('#dashboard-financial-chat details').open=true`);
  await setValue('[aria-label="Producto para evaluación sin IA"]', 'Monitor de prueba');
  await setValue('[aria-label="Precio en MXN para evaluación sin IA"]', '1200.50');
  await js(`document.querySelector('[aria-label="Producto para evaluación sin IA"]').form.requestSubmit()`);
  await until(`document.querySelector('[role="log"]').innerText.includes('Motor financiero · sin explicación de IA')`, 60000);
  assert.equal(chatRequests.length, 1);
  assert.equal(JSON.parse(chatRequests[0].postData).product.price, 1200.5);
  assert.equal(JSON.parse(chatRequests[0].postData).deterministicOnly, true);
  assert.equal(await js(`Array.from(document.querySelectorAll('#dashboard-financial-chat button')).some(b => b.innerText.trim()==='Escanear')`), false);
  await setValue(textarea, '¿Y si compro uno de $900?', true);
  await js(`document.querySelector(${JSON.stringify(textarea)}).dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',shiftKey:false,bubbles:true}))`);
  await until(`document.querySelector('[role="log"]').innerText.includes('Gemini · cifras del motor financiero')`, 60000);
  assert.equal(chatRequests.length, 2);
  assert.equal(JSON.parse(chatRequests[1].postData).history[0].content, 'Evaluar Monitor de prueba por $1200.5 MXN sin IA');
  await js(`document.querySelector('#dashboard-financial-chat').scrollIntoView({block:'start'})`);
  const desktop = await call('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('/tmp/antesdegastar-chat-desktop.png', Buffer.from(desktop.data, 'base64'));
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await new Promise(resolve => setTimeout(resolve, 300));
  assert.equal(await js('document.documentElement.scrollWidth <= window.innerWidth'), true, 'mobile must not overflow horizontally');
  await js(`document.querySelector('#dashboard-financial-chat').scrollIntoView({block:'start'})`);
  const mobile = await call('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('/tmp/antesdegastar-chat-mobile.png', Buffer.from(mobile.data, 'base64'));
  assert.deepEqual(exceptions, [], 'no browser runtime exceptions');
  const result = { browser: 'isolated headless Chrome', profile: 'synthetic initial Mateo demo', chatRequests: chatRequests.length,
    typingRequests: 0, shiftEnterRequests: 0, deterministicEvaluation: 'passed', realGeminiFollowUp: 'passed', mobileWidth: 390, horizontalOverflow: false,
    runtimeExceptions: exceptions, screenshots: ['/tmp/antesdegastar-chat-desktop.png', '/tmp/antesdegastar-chat-mobile.png'] };
  fs.writeFileSync('docs/financial-chat-browser-results.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result)); await call('Page.close'); ws.close();
}
main().catch(error => { console.error(error.message); process.exitCode = 1; browserSocket?.close(); });
