const assert = require('node:assert/strict');
const { test } = require('node:test');
const React = require('react');
const Scanner = require('../src/components/QuickSnapScanner.tsx').default;
function harness(render) {
  const slots = [];
  let cursor;
  return () => {
    cursor = 0;
    const saved = Object.fromEntries(["useState", "useRef", "useMemo", "useEffect"].map(k => [k, React[k]]));
    React.useState = initial => { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial; return [slots[index], value => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }]; };
    React.useRef = value => { const index = cursor++; return slots[index] ??= { current: value }; };
    React.useMemo = compute => compute();
    React.useEffect = (effect, deps) => { const index = cursor++; if (!slots[index] || deps.some((v, i) => v !== slots[index].deps[i])) { slots[index]?.cleanup?.(); slots[index] = { deps, cleanup: effect() }; } };
    try { return render(); } finally { Object.assign(React, saved); }
  };
}
function elements(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(elements);
  return [node, ...elements(node.props?.children)];
}

test('uploaded recognition waits for corrected name and price before completing', async () => {
  let completed = null;
  const oldReader = global.FileReader;
  const oldFetch = global.fetch;
  global.FileReader = class { readAsDataURL() { this.result = 'data:image/png;base64,aA=='; this.onload(); } };
  global.fetch = async () => ({ ok: true, json: async () => ({ name: 'Detected', price: null }) });
  try {
    const render = harness(() => Scanner({ onScanComplete: result => { completed = result; } }));
    elements(render()).find(e => e.props?.title === 'Escanear producto o captura de tienda')?.props.onClick();
    // Use the default full-width trigger.
    if (!elements(render()).some(e => e.props?.type === 'file')) elements(render()).find(e => e.props?.onClick).props.onClick();
    const upload = elements(render()).find(e => e.props?.type === 'file');
    await upload.props.onChange({ target: { files: [new File(['x'], 'p.png', { type: 'image/png' })], value: 'p.png' } });
    assert.equal(completed, null);
    let tree = render();
    const form = elements(tree).find(e => e.type === 'form');
    form.props.onSubmit({ preventDefault() {} });
    assert.equal(completed, null);
    elements(tree).find(e => e.type === 'input' && e.props.maxLength).props.onChange({ target: { value: 'Corrected' } });
    elements(render()).find(e => e.props?.type === 'number').props.onChange({ target: { value: '150.50' } });
    elements(render()).find(e => e.type === 'form').props.onSubmit({ preventDefault() {} });
    assert.equal(completed.name, 'Corrected');
    assert.equal(completed.price, 150.5);
  } finally { global.FileReader = oldReader; global.fetch = oldFetch; }
});
