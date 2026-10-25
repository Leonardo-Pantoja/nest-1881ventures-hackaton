// Component-handler tests with isolated hooks; these are not browser E2E tests.
const assert = require("node:assert/strict");
const { test } = require("node:test");
const React = require("react");
const path = require("node:path");

let writes = 0;
let cancelled = 0;
let succeeded = 0;
let fail = false;
let context = { profile: { nextPaydayDays: 7, goal: { title: "Laptop" } }, financialVersion: "A-v1", mode: "authenticated",
  registerPurchaseAnyway: async () => { writes++; if (fail) throw Error("Supabase unavailable"); }, addToWishlist: async () => 50 };
const contextFile = path.resolve("src/context/FinancialContext.tsx");
require.cache[contextFile] = { id: contextFile, filename: contextFile, loaded: true, exports: { useFinancial: () => context } };
const soundFile = path.resolve("src/lib/soundEffects.ts");
require.cache[soundFile] = { id: soundFile, filename: soundFile, loaded: true, exports: { playTap() {}, playCoin() {}, playDamage() {}, triggerConfettiBurst() {} } };
const Flow = require("../src/components/PurchaseEvaluationFlow.tsx").default;
const Modal = require("../src/components/PurchaseConfirmationModal.tsx").default;
const Plant = require("../src/components/FinancialPlantWidget.tsx").default;
const { useFinancialEvaluation } = require("../src/hooks/useFinancialEvaluation.ts");

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
const evaluation = { status: "dentro_del_margen", safeToSpend: 1000, remainingAfterBuyToday: 900, financialRevision: "revision" };

test("selecting Comprar hoy opens confirmation and Cancelar never persists", () => {
  writes = 0;
  const render = harness(() => Flow({ itemName: "Product", itemPrice: 100, apiEvaluation: evaluation }));
  let tree = render();
  const card = elements(tree).find(e => e.props?.onClick && elements(e).some(child => child.type === "h3" && child.props.children === "Comprar hoy"));
  assert.ok(card);
  card.props.onClick();
  tree = render();
  const modal = elements(tree).find(e => e.type === Modal);
  assert.ok(modal);
  assert.equal(writes, 0);
  modal.props.onCancel();
  assert.equal(elements(render()).some(e => e.type === Modal), false);
  assert.equal(writes, 0);
});

test("failed persistence is visible and never invokes the success callback", async () => {
  fail = true; writes = 0; succeeded = 0;
  const render = harness(() => Modal({ itemName: "Product", itemPrice: 100, evaluation, onCancel: () => cancelled++, onSuccess: () => succeeded++ }));
  const button = elements(render()).find(e => e.type === "button" && e.props.children === "Confirmar compra");
  button.props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(writes, 1);
  assert.equal(succeeded, 0);
  assert.ok(elements(render()).some(e => e.props?.role === "alert" && e.props.children === "Supabase unavailable"));
  fail = false;
});

test("flow forwards the engine evaluation unchanged to the plant", () => {
  const input = { ...evaluation, consideredExpenses: { currentBalance: 5000, essentialExpenses: 700, pendingCommitments: 0, pendingDebtPayments: 0, safetyBuffer: 500, protectedSavings: 2800 }, safeToSpend: 1000 };
  const flow = harness(() => Flow({ itemName: "Product", itemPrice: 100, apiEvaluation: input }))();
  const widget = elements(flow).find(e => e.type === Plant);
  assert.equal(widget.props.financialEvaluation, input);
  const plant = harness(() => Plant(widget.props))();
  const text = JSON.stringify(plant, (key, value) => key === "_owner" ? undefined : value);
  assert.ok(text.includes("1,000"));
});

test("two immediate confirm clicks persist once and cancel alone makes no write", async () => {
  writes = 0; succeeded = 0;
  const render = harness(() => Modal({ itemName: "Product", itemPrice: 100, evaluation, onCancel: () => cancelled++, onSuccess: () => succeeded++ }));
  const tree = render();
  elements(tree).find(e => e.type === "button" && e.props.children === "Cancelar").props.onClick();
  assert.equal(writes, 0);
  const button = elements(tree).find(e => e.type === "button" && e.props.children === "Confirmar compra");
  button.props.onClick(); button.props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(writes, 1);
});

test("changing balance or account immediately hides old evaluations and discards late responses", async () => {
  const pending = [];
  const originalFetch = global.fetch;
  global.fetch = () => new Promise(resolve => pending.push(resolve));
  try {
    context = { ...context, financialProfile: null, financialVersion: "A-balance-5000" };
    const render = harness(() => useFinancialEvaluation("Product", 100));
    assert.equal(render().loading, true);
    context = { ...context, financialVersion: "A-balance-4000" };
    assert.equal(render().response, null);
    pending[1]({ ok: true, json: async () => ({ ...evaluation, source: "deterministic", missingInformation: [], consideredExpenses: {}, safeToSpend: 400 }) });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(render().response.safeToSpend, 400);
    pending[0]({ ok: true, json: async () => ({ ...evaluation, source: "deterministic", missingInformation: [], consideredExpenses: {}, safeToSpend: 999 }) });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(render().response.safeToSpend, 400);
    context = { ...context, financialVersion: "B-balance-8000" };
    assert.equal(render().response, null);
  } finally { global.fetch = originalFetch; }
});
