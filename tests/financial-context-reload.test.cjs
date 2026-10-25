// Provider integration with an isolated Supabase/storage double, never a real account.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const React = require('react');
const path = require('node:path');
const { calculateSafeToSpend } = require('../src/lib/onboarding/financialEngine.ts');
const storage = () => { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) }; };
global.localStorage = storage(); global.sessionStorage = storage();
global.window = { addEventListener() {}, removeEventListener() {}, localStorage, sessionStorage };
global.document = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} };
const dateInDays = days => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + days * 86400000));
const rows = id => ({ profiles: { id, current_balance: id === 'A' ? 5000 : 9000, safety_buffer: 200, daily_essential_budget: 100, onboarding_completed_at: 'yes', display_name: `Synthetic ${id}` },
  income_sources: [{ id: `salary-${id}`, title: 'Ingreso registrado', amount: 1500, frequency: 'weekly', next_payment_date: dateInDays(7), is_active: true }],
  commitments: [{ id: `rent-${id}`, title: 'Renta', amount: 500, category: 'Vivienda', frequency: 'one_time', next_due_date: dateInDays(4), is_active: true }],
  goals: [{ id: `goal-${id}`, title: 'Laptop', current_saved: 1000, target_amount: 10000, weekly_contribution: 100, savings_location: 'separado', is_active: true }],
  wishlist_items: [], transactions: [], purchase_analyses: [],
});
const database = { A: rows('A'), B: rows('B') };
let userId = 'A', authCallback, mutations = [], filters = [];
const supabase = {
  auth: { getUser: async () => ({ data: { user: { id: userId, user_metadata: {} } }, error: null }),
    onAuthStateChange(callback) { authCallback = callback; return { data: { subscription: { unsubscribe() {} } } }; } },
  from(table) {
    let owner = userId;
    const q = { select() { return q; }, order() { return q; }, limit() { return q; },
      eq(key, value) { if (key === 'id' && table === 'profiles' || key === 'user_id') owner = value; filters.push([table, key, value]); return q; },
      maybeSingle: async () => ({ data: database[owner][table], error: null }),
      then(resolve) { return Promise.resolve({ data: structuredClone(database[owner][table]), error: null }).then(resolve); },
      async insert(value) { mutations.push([table, value]); database[value.user_id][table].push({ ...value, id: `created-${mutations.length}` }); return { error: null }; },
    }; return q;
  },
  channel() { const channel = { on() { return channel; }, subscribe() {} }; return channel; },
  async removeChannel() {},
};
const clientFile = path.resolve('src/lib/supabase/client.ts');
require.cache[clientFile] = { id: clientFile, filename: clientFile, loaded: true, exports: { createClient: () => supabase } };
const { FinancialProvider } = require('../src/context/FinancialContext.tsx');
function harness() {
  const slots = []; let cursor;
  const render = () => {
    cursor = 0;
    const saved = Object.fromEntries(['useState', 'useRef', 'useMemo', 'useCallback', 'useEffect'].map(k => [k, React[k]]));
    React.useState = initial => { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; };
    React.useRef = initial => { const i = cursor++; return slots[i] ??= { current: initial }; };
    React.useMemo = (compute, deps) => { const i = cursor++; if (!slots[i] || deps.some((v, n) => v !== slots[i].deps[n])) slots[i] = { deps, value: compute() }; return slots[i].value; };
    React.useCallback = (callback, deps) => React.useMemo(() => callback, deps);
    React.useEffect = (effect, deps) => { const i = cursor++; if (!slots[i] || deps.some((v, n) => v !== slots[i].deps[n])) { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: effect() }; } };
    try { return FinancialProvider({ children: null }).props.value; } finally { Object.assign(React, saved); }
  };
  render.unmount = () => { for (const slot of slots) slot?.cleanup?.(); };
  return render;
}
const flush = () => new Promise(resolve => setTimeout(resolve, 15));

test('authenticated reload ignores a stored demo and recovers persisted balance, salary, calendar, obligations and goals', async () => {
  userId = 'A'; mutations = []; filters = [];
  sessionStorage.setItem('antesdegastar_demo_profile_v2', JSON.stringify({ id: 'demo', goal: {}, commitments: [] }));
  const render = harness();
  try {
    assert.equal(render().mode, 'loading'); await flush();
    const state = render();
    assert.equal(state.mode, 'authenticated'); assert.equal(state.profile.id, 'A');
    assert.equal(state.financialProfile.currentBalance, 5000); assert.equal(state.financialProfile.nextPaydayAmount, 1500);
    assert.equal(state.financialProfile.nextPaydayDays, 7); assert.equal(state.financialProfile.commitments[0].amount, 500);
    assert.equal(state.financialProfile.primaryGoal.currentSaved, 1000); assert.equal(state.financialProfile.safetyBuffer, 200);
    assert.equal(calculateSafeToSpend(state.financialProfile).safeToSpend, 3600);
    assert.equal(sessionStorage.getItem('antesdegastar_demo_profile_v2'), null);
    assert.equal(mutations.length, 0); assert.ok(filters.some(([table, key, value]) => table === 'income_sources' && key === 'user_id' && value === 'A'));
    render.unmount();
    const reload = harness();
    try { reload(); await flush(); assert.equal(reload().financialProfile.currentBalance, 5000); }
    finally { reload.unmount(); }
  } finally { render.unmount(); }
});

test('post-onboarding refresh reads database values and account switches immediately clear the previous financial profile', async () => {
  userId = 'A'; const render = harness();
  try {
    render(); await flush(); let state = render();
    const oldVersion = state.financialVersion;
    database.A.profiles.current_balance = 6200;
    await state.refreshProfile(); state = render();
    assert.equal(state.financialProfile.currentBalance, 6200); assert.notEqual(state.financialVersion, oldVersion);
    userId = 'B'; authCallback('SIGNED_IN', { user: { id: 'B' } });
    state = render(); assert.equal(state.mode, 'loading'); assert.equal(state.financialProfile, null);
    await flush(); state = render();
    assert.equal(state.profile.id, 'B'); assert.equal(state.financialProfile.currentBalance, 9000);
    assert.ok(!state.financialVersion.includes('salary-A'));
  } finally { render.unmount(); }
});

test('unknown savings location stays unknown, and explicit income creation uses the same title column as updates', async () => {
  userId = 'A'; database.A.goals[0].savings_location = null;
  const render = harness();
  try {
    render(); await flush(); let state = render();
    assert.equal(state.profile.goal.savingsLocation, 'desconocido');
    assert.equal(state.financialProfile.primaryGoal.savingsLocation, 'desconocido');
    assert.equal(calculateSafeToSpend(state.financialProfile).safeToSpend, null);
    mutations = [];
    await state.upsertIncomeSource({ name: 'Ingreso adicional', amount: 400, frequency: 'weekly', nextPaymentDate: dateInDays(3) });
    assert.equal(mutations.length, 1); assert.equal(mutations[0][1].title, 'Ingreso adicional'); assert.equal(mutations[0][1].name, undefined);
    state = render(); assert.equal(state.financialProfile.nextPaydayAmount, 400); assert.equal(state.financialProfile.nextPaydayDays, 3);
    assert.equal(state.financialProfile.incomeSources.length, 2); assert.equal(state.financialProfile.payFrequency, 'variable');
  } finally { render.unmount(); }
});
