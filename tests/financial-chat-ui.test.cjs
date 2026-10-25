// Isolated React event-handler tests; no browser E2E or real provider calls.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const React = require('react');
const path = require('node:path');
let context = { mode: 'authenticated', profile: { id: 'A' }, financialVersion: 'A-v1' };
const contextFile = path.resolve('src/context/FinancialContext.tsx');
require.cache[contextFile] = { id: contextFile, filename: contextFile, loaded: true, exports: { useFinancial: () => context } };
const { ChatSession, default: FinancialChat } = require('../src/components/FinancialChat.tsx');
const Scanner = require('../src/components/QuickSnapScanner.tsx').default;
function harness(render) {
  const slots = []; let cursor;
  const rerender = () => {
    cursor = 0;
    const saved = Object.fromEntries(['useState', 'useRef', 'useMemo', 'useEffect'].map(k => [k, React[k]]));
    React.useState = initial => { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; };
    React.useRef = initial => { const i = cursor++; return slots[i] ??= { current: initial }; };
    React.useMemo = compute => compute();
    React.useEffect = (effect, deps) => { const i = cursor++; if (!slots[i] || deps.some((v, n) => v !== slots[i].deps[n])) { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: effect() }; } };
    try { return render(); } finally { Object.assign(React, saved); }
  };
  rerender.unmount = () => { for (const slot of slots) slot?.cleanup?.(); };
  return rerender;
}
function elements(node) { if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(elements); return [node, ...elements(node.props?.children)]; }
const flush = () => new Promise(resolve => setImmediate(resolve));
const type = (render, text) => elements(render()).find(e => e.type === 'textarea').props.onChange({ target: { value: text } });
const submit = render => elements(render()).find(e => e.type === 'form').props.onSubmit({ preventDefault() {} });
const result = (more = {}) => ({ reply: 'Respuesta calculada', source: 'gemini', cards: [], product: { name: 'Monitor', price: 1200 }, financialRevision: 'server-v1', ...more });
function setup(t, options = {}) {
  const requests = [], updates = [];
  const oldFetch = global.fetch;
  global.fetch = (url, init) => new Promise(resolve => requests.push({ url, init, resolve }));
  t.after(() => { global.fetch = oldFetch; });
  const render = harness(() => ChatSession({ product: { name: 'Monitor', price: 1200 }, onProduct: (...args) => updates.push(args), ...options }));
  return { render, requests, updates };
}

test('typing, rerenders, suggestion chips and Shift+Enter never call Gemini; Enter locks double submission', async t => {
  const { render, requests } = setup(t);
  for (const text of ['¿', '¿Puedo', '¿Puedo comprarlo?']) { type(render, text); render(); }
  assert.equal(requests.length, 0);
  const textarea = elements(render()).find(e => e.type === 'textarea');
  textarea.props.onKeyDown({ key: 'Enter', shiftKey: true, nativeEvent: {}, preventDefault() { throw Error('Shift+Enter blocked'); } });
  assert.equal(requests.length, 0);
  textarea.props.onKeyDown({ key: 'Enter', shiftKey: false, nativeEvent: { isComposing: false }, preventDefault() {} });
  submit(render); // same immediate frame cannot issue a second request
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, '/api/ai/chat');
  requests[0].resolve({ ok: true, json: async () => result() }); await flush();
  const suggestion = elements(render()).find(e => e.type === 'button' && e.props.children === '¿Cuánto puedo gastar hoy?');
  suggestion.props.onClick(); render(); assert.equal(requests.length, 1);
});

test('success preserves user-only conversation and a changed price for the next question', async t => {
  const { render, requests } = setup(t);
  type(render, '¿Puedo comprar algo de $1200?'); submit(render);
  requests[0].resolve({ ok: true, json: async () => result() }); await flush();
  type(render, '¿Y uno de $900?'); submit(render);
  const second = JSON.parse(requests[1].init.body);
  assert.equal(second.history[0].content, '¿Puedo comprar algo de $1200?');
  assert.ok(second.history.every(h => h.role === 'user'));
  requests[1].resolve({ ok: true, json: async () => result({ product: { name: 'Monitor', price: 900 } }) }); await flush();
  type(render, '¿Cuánto debería ahorrar en cuatro semanas?'); submit(render);
  assert.equal(JSON.parse(requests[2].init.body).product.price, 900);
  requests[2].resolve({ ok: true, json: async () => result() }); await flush();
});

test('explicit retry reuses question and context, a fresh request ID, and exposes deterministic alternative', async t => {
  const { render, requests } = setup(t);
  type(render, '¿Puedo comprarlo?'); submit(render);
  requests[0].resolve({ ok: false, json: async () => ({ error: 'Límite temporal' }) }); await flush();
  assert.ok(elements(render()).some(e => e.props?.role === 'alert'));
  const retry = elements(render()).find(e => e.type === 'button' && e.props.children?.includes?.('Reintentar con Gemini'));
  assert.ok(retry); retry.props.onClick();
  const a = JSON.parse(requests[0].init.body), b = JSON.parse(requests[1].init.body);
  assert.equal(a.message, b.message); assert.deepEqual(a.history, b.history); assert.notEqual(a.requestId, b.requestId);
  requests[1].resolve({ ok: true, json: async () => result({ source: 'deterministic', warning: 'Gemini no respondió.' }) }); await flush();
  const deterministic = elements(render()).find(e => e.type === 'button' && e.props.children?.includes?.('Consultar cifras sin IA'));
  deterministic.props.onClick();
  assert.equal(JSON.parse(requests[2].init.body).deterministicOnly, true);
  requests[2].resolve({ ok: true, json: async () => result({ source: 'deterministic' }) }); await flush();
});

test('cases I and J: identity or external product switches remount, abort and discard late replies', async t => {
  context = { ...context, profile: { id: 'A' }, financialVersion: 'A-v1' };
  const wrapper = harness(() => FinancialChat({ selectionRevision: 1 }));
  const keyA = wrapper().key;
  context = { ...context, profile: { id: 'B' }, financialVersion: 'B-v1' };
  assert.notEqual(wrapper().key, keyA);
  const another = harness(() => FinancialChat({ selectionRevision: 2 }));
  assert.notEqual(wrapper().key, another().key);
  const { render, requests, updates } = setup(t);
  type(render, 'Consulta anterior'); submit(render);
  render.unmount();
  assert.equal(requests[0].init.signal.aborted, true);
  requests[0].resolve({ ok: true, json: async () => result({ product: { name: 'Respuesta antigua', price: 999 } }) }); await flush();
  assert.equal(updates.length, 0);
});

test('image selection cancels a previous reply and confirmed recognition sends exact edited price once', async t => {
  const { render, requests, updates } = setup(t);
  type(render, 'Consulta anterior'); submit(render);
  const scanner = elements(render()).find(e => e.type === Scanner);
  scanner.props.onAttachmentStart(); assert.equal(requests[0].init.signal.aborted, true);
  requests[0].resolve({ ok: true, json: async () => result() }); await flush(); assert.equal(updates.length, 0);
  scanner.props.onScanComplete({ name: 'Producto corregido', price: 150.50, thumbnailDataUrl: 'data:image/png;base64,abc', storeTag: 'Gemini' });
  assert.equal(requests.length, 2); assert.equal(JSON.parse(requests[1].init.body).product.price, 150.5);
  requests[1].resolve({ ok: true, json: async () => result({ product: { name: 'Producto corregido', price: 150.5 } }) }); await flush();
  assert.equal(updates[0][1].thumbnailDataUrl, 'data:image/png;base64,abc');
});

test('attachment preview validates and waits for explicit analysis; deleting sends nothing', async t => {
  const oldReader = global.FileReader, oldFetch = global.fetch; let requests = 0;
  global.FileReader = class { readAsDataURL() { this.result = 'data:image/png;base64,aA=='; this.onload(); } };
  global.fetch = async () => { requests++; return { ok: true, json: async () => ({ name: 'Reconocido', price: 100, currency: 'MXN' }) }; };
  t.after(() => { global.FileReader = oldReader; global.fetch = oldFetch; });
  const render = harness(() => Scanner({ attachmentOnly: true, requireImageConfirmation: true, open: true, onScanComplete() {} }));
  const upload = file => elements(render()).find(e => e.props?.type === 'file').props.onChange({ target: { files: [file], value: '' } });
  upload(new File(['x'], 'image.png', { type: 'image/png' })); await flush(); assert.equal(requests, 0);
  assert.ok(elements(render()).some(e => e.type === 'img' && e.props.alt === 'Imagen adjunta por confirmar'));
  elements(render()).find(e => e.type === 'button' && e.props.children === 'Eliminar imagen').props.onClick(); assert.equal(requests, 0);
  upload(new File(['x'], 'image.svg', { type: 'image/svg+xml' })); await flush(); assert.equal(requests, 0);
  assert.ok(elements(render()).some(e => e.props?.role === 'alert'));
  upload(new File(['x'], 'image.png', { type: 'image/png' })); await flush();
  elements(render()).find(e => e.type === 'button' && e.props.children === 'Analizar imagen').props.onClick(); await flush(); assert.equal(requests, 1);
});

test('confirmed manual price remains evaluable without the model and no request is sent while editing', async t => {
  const { render, requests } = setup(t);
  elements(render()).find(e => e.props?.['aria-label'] === 'Producto para evaluación sin IA').props.onChange({ target: { value: 'Monitor manual' } });
  elements(render()).find(e => e.props?.['aria-label'] === 'Precio en MXN para evaluación sin IA').props.onChange({ target: { value: '150.50' } });
  assert.equal(requests.length, 0);
  const form = elements(render()).find(e => e.type === 'form' && elements(e).some(child => child.type === 'button' && child.props.children === 'Enviar sin IA'));
  form.props.onSubmit({ preventDefault() {} });
  assert.equal(requests.length, 1);
  const data = JSON.parse(requests[0].init.body);
  assert.equal(data.deterministicOnly, true); assert.equal(data.product.price, 150.5);
  requests[0].resolve({ ok: true, json: async () => result({ source: 'deterministic' }) }); await flush();
});
