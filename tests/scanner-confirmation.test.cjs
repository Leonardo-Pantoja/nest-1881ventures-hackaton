const assert = require('node:assert/strict');
const { test } = require('node:test');
const React = require('react');
const Scanner = require('../src/components/QuickSnapScanner.tsx').default;
function harness(render) {
  const slots = [];
  let cursor;
  const rerender = () => {
    cursor = 0;
    const saved = Object.fromEntries(["useState", "useRef", "useMemo", "useEffect"].map(k => [k, React[k]]));
    React.useState = initial => { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial; return [slots[index], value => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }]; };
    React.useRef = value => { const index = cursor++; return slots[index] ??= { current: value }; };
    React.useMemo = compute => compute();
    React.useEffect = (effect, deps) => { const index = cursor++; if (!slots[index] || deps.some((v, i) => v !== slots[index].deps[i])) { slots[index]?.cleanup?.(); slots[index] = { deps, cleanup: effect() }; } };
    try { return render(); } finally { Object.assign(React, saved); }
  };
  rerender.unmount = () => { for (const slot of slots) slot?.cleanup?.(); };
  return rerender;
}
function elements(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(elements);
  return [node, ...elements(node.props?.children)];
}

const flush = () => new Promise(resolve => setImmediate(resolve));
const file = (type = 'image/png') => new File(['image'], 'untrusted-name.png', { type });
const upload = (render, image = file()) => elements(render()).find(e => e.props?.type === 'file').props.onChange({ target: { files: [image], value: '' } });
const form = render => elements(render()).find(e => e.props?.onSubmit);
const submit = render => form(render).props.onSubmit({ preventDefault() {} });
const cancel = render => elements(render()).find(e => e.props?.children === 'Cancelar' && e.props.onClick).props.onClick();
const changePrice = (render, price) => elements(render()).find(e => e.props?.type === 'number').props.onChange({ target: { value: price } });

function setup(t, fetcher) {
  const oldReader = global.FileReader, oldFetch = global.fetch;
  global.FileReader = class { readAsDataURL() { this.result = 'data:image/png;base64,aA=='; this.onload(); } };
  global.fetch = fetcher ?? (async () => ({ ok: true, json: async () => ({ name: 'Detected', price: 2300, currency: 'MXN' }) }));
  t.after(() => { global.FileReader = oldReader; global.fetch = oldFetch; });
  const completions = [];
  const render = harness(() => Scanner({ embedded: true, accessMode: 'demo', demoProfileId: 'mateo', onScanComplete: result => completions.push(result) }));
  return { render, completions };
}
test('recognition waits for edited name and price before completing; sends only image and demo access', async t => {
  const { render, completions } = setup(t, async (url, options) => {
    assert.equal(url, '/api/ai/recognize-product');
    assert.deepEqual([...options.body.keys()], ['image']);
    assert.equal(options.headers['x-demo-profile'], 'mateo');
    return { ok: true, json: async () => ({ name: 'Detected', price: 2300, currency: 'MXN' }) };
  });
  upload(render); await flush(); assert.equal(completions.length, 0);
  elements(render()).find(e => e.props?.maxLength).props.onChange({ target: { value: 'Corrected' } });
  changePrice(render, '150.50'); submit(render);
  assert.equal(completions.length, 1); assert.equal(completions[0].name, 'Corrected'); assert.equal(completions[0].price, 150.5);
  assert.equal(completions[0].source, 'gemini');
});
test('photo without price leaves blank field and refuses invalid confirmation', async t => {
  const { render, completions } = setup(t, async () => ({ ok: true, json: async () => ({ name: 'Photo product', price: null, currency: null }) }));
  upload(render); await flush();
  assert.equal(elements(render()).find(e => e.props?.type === 'number').props.value, '');
  for (const price of ['', '0', '-1', '0.001']) { changePrice(render, price); submit(render); assert.equal(completions.length, 0); }
  changePrice(render, '50'); submit(render); assert.equal(completions[0].price, 50);
});
test('cancel clears recognition without completing or writing financial state', async t => {
  const { render, completions } = setup(t); upload(render); await flush(); cancel(render);
  assert.equal(form(render), undefined); assert.deepEqual(completions, []);
});
test('invalid format and API failure are visible and allow retry', async t => {
  let calls = 0;
  const { render, completions } = setup(t, async () => { calls++; return { ok: false, json: async () => ({ error: 'Gemini quota exceeded' }) }; });
  upload(render, file('image/svg+xml')); await flush(); assert.equal(calls, 0); assert.ok(elements(render()).some(e => e.props?.role === 'alert'));
  upload(render); await flush(); assert.equal(calls, 1); assert.equal(form(render), undefined); assert.deepEqual(completions, []);
  assert.ok(elements(render()).some(e => e.props?.children === 'Gemini quota exceeded'));
  global.fetch = async () => ({ ok: true, json: async () => ({ name: 'Retry', price: 25, currency: 'MXN' }) });
  upload(render); await flush(); submit(render); assert.equal(completions[0].name, 'Retry');
});
test('cancel and a subsequently selected demo product discard a late response', async t => {
  let resolveFetch;
  const { render, completions } = setup(t, () => new Promise(resolve => { resolveFetch = resolve; }));
  upload(render); await flush(); cancel(render);
  resolveFetch({ ok: true, json: async () => ({ name: 'Late', price: 50, currency: 'MXN' }) }); await flush();
  assert.equal(form(render), undefined); assert.equal(completions.length, 0);
  upload(render); await flush();
  elements(render()).find(e => e.props?.onClick && e.key === 'jordan').props.onClick();
  resolveFetch({ ok: true, json: async () => ({ name: 'Late', price: 50, currency: 'MXN' }) }); await flush();
  submit(render); assert.equal(completions[0].name, 'Air Jordan 1 Mid SE'); assert.equal(completions[0].source, 'demo');
});
test('foreign prices are displayed but not silently evaluated as MXN', async t => {
  const { render, completions } = setup(t, async () => ({ ok: true, json: async () => ({ name: 'Imported', price: 100, currency: 'USD' }) }));
  upload(render); await flush(); assert.equal(elements(render()).find(e => e.props?.type === 'number').props.value, '');
  submit(render); assert.equal(completions.length, 0);
});

test('replacing the component on product or account change aborts and ignores in-flight recognition', async t => {
  let finish, signal, reads = 0;
  const { render, completions } = setup(t, (_url, options) => {
    signal = options.signal;
    return new Promise(resolve => { finish = resolve; });
  });
  upload(render); await flush();
  render.unmount(); assert.equal(signal.aborted, true);
  finish({ ok: true, json: async () => { reads++; return { name: 'Stale', price: 100, currency: 'MXN' }; } });
  await flush(); assert.equal(completions.length, 0); assert.equal(reads, 1);
});

test('dragging an image uses the same recognition and confirmation flow', async t => {
  const { render, completions } = setup(t);
  elements(render()).find(e => e.props?.onDrop).props.onDrop({ preventDefault() {}, dataTransfer: { files: [file()] } });
  await flush(); assert.ok(form(render)); assert.equal(completions.length, 0);
  submit(render); assert.equal(completions.length, 1);
});

test('unidentified images are errors rather than fabricated file-name products', async t => {
  const { render, completions } = setup(t, async () => ({ ok: true, json: async () => ({ name: null, price: null, currency: null }) }));
  upload(render); await flush();
  assert.equal(form(render), undefined); assert.equal(completions.length, 0);
  assert.ok(elements(render()).some(e => e.props?.role === 'alert'));
});
function setupText(t, fetcher) {
  const original = global.fetch;
  t.after(() => { global.fetch = original; });
  const requests = [], completions = [];
  global.fetch = (url, options) => {
    requests.push({ url, options });
    return fetcher ? fetcher(url, options) : Promise.resolve({ ok: true, json: async () => ({ name: 'Nintendo Switch OLED', price: 5400, currency: 'MXN', source: 'text', needsConfirmation: true }) });
  };
  let query = '';
  const render = harness(() => Scanner({ embedded: true, textQuery: query, textFormId: 'product-ai-search', onScanComplete: result => completions.push(result) }));
  return { render, requests, completions, type: value => { query = value; render(); } };
}
const sendText = render => elements(render()).find(e => e.props?.id === 'product-ai-search').props.onSubmit({ preventDefault() {} });
const confirmText = render => elements(render()).find(e => e.props?.['data-product-confirmation']).props.onSubmit({ preventDefault() {} });
test('typing and rerenders send zero requests; explicit submit sends one and locks duplicate clicks', async t => {
  let finish;
  const { render, requests, completions, type } = setupText(t, () => new Promise(resolve => { finish = resolve; }));
  render();
  for (const value of ['N', 'Ni', 'Nintendo', 'Nintendo Switch de 5400 pesos']) type(value);
  render(); render(); assert.equal(requests.length, 0);
  sendText(render); sendText(render);
  assert.equal(requests.length, 1); assert.equal(requests[0].url, '/api/ai/parse-product');
  assert.deepEqual(JSON.parse(requests[0].options.body), { text: 'Nintendo Switch de 5400 pesos' });
  const button = elements(render()).find(e => e.props?.type === 'submit' && !e.props?.onSubmit && Array.isArray(e.props.children) && e.props.children.includes('Buscar con IA'));
  assert.equal(button.props.disabled, true);
  finish({ ok: true, json: async () => ({ name: 'Nintendo Switch OLED', price: 5400, currency: 'MXN' }) }); await flush();
  render(); assert.equal(requests.length, 1); assert.equal(completions.length, 0);
  changePrice(render, '4200.50'); confirmText(render);
  assert.equal(completions.length, 1); assert.equal(completions[0].price, 4200.5); assert.equal(completions[0].source, 'text');
  assert.equal(requests.length, 1);
});
test('dashboard uses the shared chat and scanner retains explicit form submission', async t => {
  const fs = require('node:fs');
  const ts = require('typescript');
  const source = ts.createSourceFile('page.tsx', fs.readFileSync('src/app/app/page.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let integratedChat = false;
  const visit = node => {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === 'FinancialChat') integratedChat = true;
    ts.forEachChild(node, visit);
  };
  visit(source); assert.equal(integratedChat, true);
  const { render, requests, type } = setupText(t); type('Monitor de 3000 pesos'); sendText(render); await flush();
  assert.equal(requests.length, 1);
});
test('text with no price requires input and upstream 504 offers manual retry', async t => {
  let attempts = 0;
  const { render, requests, completions, type } = setupText(t, async () => {
    attempts++;
    return attempts === 1 ? { ok: false, json: async () => ({ error: 'Gemini returned 504. Retry.' }) }
      : { ok: true, json: async () => ({ name: 'Laptop Lenovo IdeaPad', price: null, currency: 'MXN' }) };
  });
  type('Laptop Lenovo IdeaPad'); sendText(render); await flush();
  assert.ok(elements(render()).some(e => e.props?.role === 'alert' && e.props.children.includes('504')));
  assert.equal(requests.length, 1);
  elements(render()).find(e => e.props?.onClick && typeof e.props.children === 'string' && e.props.children.startsWith('Reintentar')).props.onClick();
  await flush(); assert.equal(requests.length, 2);
  assert.equal(elements(render()).find(e => e.props?.type === 'number').props.value, '');
  confirmText(render); assert.equal(completions.length, 0);
  changePrice(render, '100'); confirmText(render); assert.equal(completions[0].price, 100);
});
test('changing the product cancels pending text analysis and discards its late response', async t => {
  let finish;
  const { render, completions, type } = setupText(t, () => new Promise(resolve => { finish = resolve; }));
  type('Old product'); sendText(render); render.unmount();
  finish({ ok: true, json: async () => ({ name: 'Old product', price: 500, currency: 'MXN' }) });
  await flush(); assert.equal(completions.length, 0);
});
