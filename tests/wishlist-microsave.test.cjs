// Integration against an isolated persistence double; deployed Supabase/RLS needs a separate audit.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const React = require('react');
const { wishlistPlanMath, wishlistProductKey } = require('../src/lib/finance/wishlistPlan.ts');
const storage = () => { const map = new Map(); return { getItem: k => map.get(k) ?? null, setItem: (k,v) => map.set(k,String(v)), removeItem: k => map.delete(k), clear: () => map.clear() }; };
global.localStorage = storage(); global.sessionStorage = storage();
global.window = { addEventListener() {}, removeEventListener() {}, localStorage, sessionStorage };
global.document = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} };
let userId = 'A', authCallback, rpcError = null, rpcCalls = [], requests = [], rpcGate = null, navigation = [], nextId = 0, foreignReceipt = false;
const fixture = id => ({ profiles: { id, current_balance: 3000, safety_buffer: 650, daily_essential_budget: 210, display_name: id,
  onboarding_completed_at: 'yes', wisdom_xp: 0, streak_count: 0 }, income_sources: [], commitments: [], transactions: [], purchase_analyses: [], wishlist_items: [],
  goals: [{ id: `goal-${id}`, title: 'Otra meta', current_saved: 1000, target_amount: 10000, weekly_contribution: 0, savings_location: 'separado', is_active: true }] });
const database = { A: fixture('A'), B: fixture('B') };
function client(fixedOwner) {
  const ownerNow = () => fixedOwner ?? userId;
  return {
    auth: { getUser: async () => ({ data: { user: ownerNow() ? { id: ownerNow(), user_metadata: {} } : null }, error: null }),
      onAuthStateChange(callback) { authCallback = callback; return { data: { subscription: { unsubscribe() {} } } }; } },
    from(table) {
      let owner = ownerNow(), rowId;
      const read = () => {
        const value = database[owner]?.[table];
        return structuredClone(Array.isArray(value) && rowId ? value.find(row => row.id === rowId) ?? null : value);
      };
      const query = { select() { return query; }, order() { return query; }, limit() { return query; },
        eq(key,value) { if (key === 'user_id' || key === 'id' && table === 'profiles') owner = value; else if (key === 'id') rowId = value; return query; },
        maybeSingle: async () => ({ data: foreignReceipt && table === 'wishlist_items' ? { ...read(), user_id: 'B' } : read(), error: null }),
        then(resolve) { return Promise.resolve({ data: read(), error: null }).then(resolve); } };
      return query;
    },
    async rpc(name,args) {
      const owner = ownerNow(); rpcCalls.push({ owner, name, args });
      if (rpcGate) await rpcGate;
      if (rpcError) return { data: null, error: rpcError };
      assert.equal(name, 'save_wishlist_plan_checked_v1');
      const rows = database[owner].wishlist_items;
      let row = rows.find(item => wishlistProductKey(item) === wishlistProductKey({ name: args.p_name, price: args.p_price }));
      const isNew = !row;
      if (!row) { row = { id: `wishlist-${++nextId}`, user_id: owner, name: args.p_name, price: args.p_price,
        saved_at: new Date().toISOString(), saved_amount: 0, hold_until: '2027-01-01' }; rows.push(row); }
      Object.assign(row, { strategy: args.p_strategy, planned_weekly_save: args.p_planned_weekly_save, plan_weeks: args.p_plan_weeks });
      const awarded = isNew ? args.p_strategy === 'microsave' ? 100 : 50 : 0;
      database[owner].profiles.wisdom_xp += awarded; database[owner].profiles.streak_count += Number(isNew);
      return { data: { id: row.id, xp_awarded: awarded, wisdom_xp: database[owner].profiles.wisdom_xp, streak_count: database[owner].profiles.streak_count }, error: null };
    },
    channel() { const channel = { on() { return channel; }, subscribe() {} }; return channel; }, removeChannel: async () => {},
  };
}
const stub = (file,exports) => { const id = require.resolve(file); require.cache[id] = { id, filename: id, loaded: true, exports }; };
stub('../src/lib/supabase/client.ts', { createClient: () => client() });
stub('../src/lib/supabase/server.ts', { createServerSupabaseClient: async () => client(userId) });
stub('next/navigation', { useRouter: () => ({ push: value => navigation.push(value) }) });
stub('../src/lib/soundEffects.ts', { playTap() {}, playCoin() {}, playLevelUp() {}, triggerConfettiBurst() {} });
const { POST } = require('../src/app/api/wishlist/route.ts');
const context = require('../src/context/FinancialContext.tsx');
const Provider = context.FinancialProvider;
let componentContext;
context.useFinancial = () => componentContext;
const { PlanForm } = require('../src/components/MicroSavingsPlanModal.tsx');
const MicroModal = require('../src/components/MicroSavingsPlanModal.tsx').default;
const Flow = require('../src/components/PurchaseEvaluationFlow.tsx').default;
const Chat = require('../src/components/FinancialChat.tsx').default;
const Goals = require('../src/components/GoalsAndCoolingView.tsx').default;
global.fetch = async (url,options) => { requests.push(url); assert.equal(url,'/api/wishlist'); return POST(new Request('http://localhost/api/wishlist', {
  method: 'POST', headers: { ...options.headers, origin: 'http://localhost' }, body: options.body })); };
function harness(render) {
  const slots = []; let cursor;
  const run = () => {
    cursor = 0;
    const names = ['useState','useRef','useMemo','useCallback','useEffect'];
    const originals = Object.fromEntries(names.map(key => [key,React[key]]));
    React.useState = initial => { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; };
    React.useRef = initial => { const i = cursor++; return slots[i] ??= { current: initial }; };
    React.useMemo = (compute,deps) => { const i = cursor++; if (!slots[i] || deps.some((value,j) => value !== slots[i].deps[j])) slots[i] = { deps, value: compute() }; return slots[i].value; };
    React.useCallback = (fn,deps) => React.useMemo(() => fn,deps);
    React.useEffect = (effect,deps) => { const i = cursor++; if (!slots[i] || deps.some((value,j) => value !== slots[i].deps[j])) { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: effect() }; } };
    try { return render(); } finally { Object.assign(React,originals); }
  };
  run.unmount = () => slots.forEach(slot => slot?.cleanup?.());
  return run;
}
const elements = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(elements) : [node,...elements(node.props?.children)];
const text = node => JSON.stringify(node, (key,value) => key === '_owner' || key === 'type' ? undefined : value);
const flush = () => new Promise(resolve => setTimeout(resolve,20));
const provider = () => harness(() => Provider({ children: null }).props.value);
const start = async () => { userId = 'A'; rpcError = null; rpcGate = null; foreignReceipt = false; requests = []; rpcCalls = []; sessionStorage.clear();
  const render = provider(); render(); await flush(); return render; };
const form = (onSaved = () => {}) => harness(() => PlanForm({ itemName: 'Tenis', itemPrice: 1800, onClose() {}, onSaved }));
const submit = tree => elements(tree).find(e => e.type === 'form').props.onSubmit({ preventDefault() {} });

test('six weeks means 300 MXN mathematically, including cent rounding and explicit existing savings only', () => {
  assert.equal(wishlistPlanMath(1800,'weeks',6).weeklyContribution,300);
  assert.equal(wishlistPlanMath(1449,'weeks',4).weeklyContribution,362.25);
  assert.equal(wishlistPlanMath(100,'weeks',3).weeklyContribution,33.34);
  assert.equal(wishlistPlanMath(1800,'contribution',200).estimatedWeeks,9);
  assert.equal(wishlistPlanMath(1800,'weeks',6,300).weeklyContribution,250);
  assert.throws(() => wishlistPlanMath(1800,'weeks',0));
  assert.throws(() => wishlistPlanMath(1800,'contribution',0));
});

test('Micro-ahorro opens a real plan with confirmed product and never sends Gemini or saves on selection', () => {
  let saves = 0;
  componentContext = { profile: { id: 'A', nextPaydayDays: 7 }, mode: 'authenticated', addToWishlist: () => saves++ };
  const render = harness(() => Flow({ itemName: 'Tenis', itemPrice: 1800 }));
  let tree = render();
  const card = elements(tree).find(e => e.props?.onClick && elements(e).some(child => child.type === 'h3' && child.props.children === 'Plan de Micro-ahorro'));
  card.props.onClick(); tree = render();
  const modal = elements(tree).find(e => e.type === MicroModal);
  assert.equal(modal.props.itemName,'Tenis'); assert.equal(modal.props.itemPrice,1800); assert.equal(saves,0);
  assert.equal(elements(tree).find(e => e.type === Chat).props.suggestion,undefined);
  modal.props.onConsultGemini(); tree = render();
  assert.match(elements(tree).find(e => e.type === Chat).props.suggestion.text,/sin afectar mis compromisos/);
  assert.equal(saves,0);
});

test('explicit save waits for API and database receipt, coalesces double clicks and leaves balance and other goals untouched', async () => {
  database.A = fixture('A'); const render = await start(); let notified = 0;
  try {
    componentContext = render(); const plan = form(() => notified++);
    const beforeBalance = database.A.profiles.current_balance, beforeGoals = structuredClone(database.A.goals);
    assert.match(text(plan()),/300/);
    let release; rpcGate = new Promise(resolve => release = resolve);
    const pending = submit(plan()); await submit(plan()); await flush();
    assert.equal(requests.length,1); assert.equal(rpcCalls.length,1); assert.equal(notified,0);
    assert.equal(render().profile.wishlist.length,0); assert.match(text(plan()),/Guardando plan/);
    release(); await pending; rpcGate = null;
    assert.equal(notified,1); assert.match(text(plan()),/Plan guardado en Wishlist/);
    const saved = render().profile.wishlist[0];
    assert.equal(saved.strategy,'microsave'); assert.equal(saved.price,1800); assert.equal(saved.plannedWeeklySave,300); assert.equal(saved.planWeeks,6); assert.equal(saved.savedAmount,0);
    assert.equal(database.A.profiles.current_balance,beforeBalance); assert.deepEqual(database.A.goals,beforeGoals);
    assert.equal(database.A.wishlist_items.length,1); assert.equal(database.A.profiles.wisdom_xp,100);
    plan.unmount();
  } finally { render.unmount(); }
});

test('persisted plans survive provider recreation and ignore browser progress; changing account exposes only its rows', async () => {
  const render = await start();
  try {
    localStorage.setItem('antesdegastar_wishlist_meta_v1_A',JSON.stringify({ [database.A.wishlist_items[0].id]: { savedAmount: 1800 } }));
    await render().refreshProfile(); let state = render();
    assert.equal(state.profile.wishlist[0].savedAmount,0); assert.equal(state.profile.wishlist[0].plannedWeeklySave,300); assert.equal(state.profile.wishlist[0].planWeeks,6);
    userId = 'B'; authCallback('SIGNED_IN',{ user: { id: 'B' } });
    assert.equal(render().mode,'loading'); assert.deepEqual(render().profile.wishlist,[]); await flush();
    state = render(); assert.equal(state.profile.id,'B'); assert.deepEqual(state.profile.wishlist,[]);
  } finally { render.unmount(); }
  userId = 'A'; const reload = provider();
  try { reload(); await flush(); assert.equal(reload().profile.wishlist[0].name,'Tenis'); } finally { reload.unmount(); }
});

test('Supabase errors preserve the selected form and never announce false success; retry recovers the same product', async () => {
  database.A = fixture('A'); const render = await start();
  try {
    componentContext = render(); let notifications = 0; const plan = form(() => notifications++);
    rpcError = { code: 'PGRST202' }; await submit(plan());
    assert.equal(notifications,0); assert.equal(render().profile.wishlist.length,0); assert.match(text(plan()),/guardado de planes aún no está disponible/);
    assert.ok(!text(plan()).includes('Plan guardado en Wishlist.')); assert.match(text(plan()),/Tenis/);
    rpcError = null; await submit(plan());
    assert.equal(notifications,1); assert.equal(database.A.wishlist_items.length,1); plan.unmount();
  } finally { render.unmount(); }
});

test('reopening updates the existing plan without duplicate XP, preserves saved amount, and separates equal names at different prices', async () => {
  const render = await start();
  try {
    const first = render().profile.wishlist[0]; database.A.wishlist_items[0].saved_amount = 300;
    await render().refreshProfile();
    await render().addToWishlist({ name:'Tenis',price:1800,strategy:'microsave',plannedWeeklySave:125,planWeeks:12 },100);
    let saved = render().profile.wishlist[0]; assert.equal(saved.id,first.id); assert.equal(saved.savedAmount,300); assert.equal(saved.plannedWeeklySave,125);
    assert.equal(database.A.wishlist_items.length,1); assert.equal(database.A.profiles.wisdom_xp,100);
    await render().addToWishlist({ name:'Tenis',price:2000,strategy:'microsave',plannedWeeklySave:200 },100);
    assert.equal(render().profile.wishlist.length,2); assert.equal(database.A.wishlist_items.length,2);
    await render().refreshProfile(); componentContext = render(); const plan = form();
    assert.equal(elements(plan()).find(e => e.props?.['aria-label'] === 'Plazo de ahorro en semanas').props.value,'12');
    elements(plan()).find(e => e.props?.['aria-label'] === 'Configurar plan por').props.onChange({ target:{ value:'contribution' } });
    elements(plan()).find(e => e.props?.['aria-label'] === 'Aportación semanal objetivo').props.onChange({ target:{ value:'200' } });
    await submit(plan()); assert.equal(database.A.wishlist_items.find(row => row.price === 1800).plan_weeks,null);
    plan.unmount();
  } finally { render.unmount(); }
});

test('API rejects changed accounts, financial state injected by clients, unauthenticated writes and foreign receipts', async () => {
  const invoke = body => POST(new Request('http://localhost/api/wishlist',{ method:'POST', headers:{ origin:'http://localhost','content-type':'application/json' }, body:JSON.stringify(body) }));
  const item = { name:'Tenis',price:1800,strategy:'microsave',plannedWeeklySave:300,planWeeks:6 };
  userId='A'; const calls=rpcCalls.length;
  assert.equal((await invoke({ accountId:'B',item })).status,409); assert.equal(rpcCalls.length,calls);
  assert.equal((await invoke({ accountId:'A',item:{ ...item,currentBalance:3000 } })).status,400);
  assert.equal((await invoke({ accountId:'A',item:{ ...item,plannedWeeklySave:undefined } })).status,400);
  userId=null; assert.equal((await invoke({ accountId:'A',item })).status,401);
  userId='A'; foreignReceipt=true; assert.equal((await invoke({ accountId:'A',item })).status,503); foreignReceipt=false;
});

test('Goals shows product-specific zero progress, configured contribution and unvalidated capacity; editing reuses the plan form', async () => {
  const render = await start();
  try {
    const state=render(); componentContext={ ...state, profile:{ ...state.profile,wishlist:[{ id:'specific',name:'Tenis',price:1800,savedAt:new Date().toISOString(),savedAmount:0,strategy:'microsave',plannedWeeklySave:300,planWeeks:6 }] } };
    const goals=harness(() => Goals({ onShowToast() {},totalProtectedMoney:1000,goalPct:10,unlockedMedals:[] }));
    let tree=goals(); assert.match(text(tree),/300 MXN\/sem objetivo/); assert.match(text(tree),/aportación sostenible sin validar/);
    assert.ok(!text(tree).includes('400 MXN/sem')); assert.ok(!text(tree).includes('Listo para comprar sin afectar'));
    elements(tree).find(e => e.type==='button' && e.props.children==='Editar plan de ahorro').props.onClick();
    tree=goals(); assert.equal(elements(tree).find(e => e.type===MicroModal).props.itemPrice,1800); goals.unmount();
  } finally { render.unmount(); }
});

test('demo plan persistence stays in the demo session and never calls authenticated Wishlist API', async () => {
  const render=await start(); const before=structuredClone(database.A);
  try {
    render().loadPreloadedSandboxProfile('mateo'); let state=render(); assert.equal(state.mode,'demo');
    const count=requests.length;
    await state.addToWishlist({ name:'Demo-only product',price:1800,strategy:'microsave',plannedWeeklySave:300,planWeeks:6 },100);
    state=render(); assert.equal(requests.length,count); assert.equal(state.profile.wishlist[0].savedAmount,0);
    assert.equal(state.profile.wishlist[0].name,'Demo-only product'); assert.deepEqual(database.A,before);
    await state.addToWishlist({ name:'Demo-only product',price:2000,strategy:'microsave',plannedWeeklySave:200 },100);
    await render().registerPurchaseAnyway('Demo-only product',1800,crypto.randomUUID());
    const remaining=render().profile.wishlist.filter(item => item.name==='Demo-only product');
    assert.equal(remaining.length,1); assert.equal(remaining[0].price,2000); assert.deepEqual(database.A,before);
  } finally { render.unmount(); }
  userId=null; const reload=provider();
  try { reload(); await flush(); assert.equal(reload().mode,'demo'); assert.equal(reload().profile.wishlist[0].name,'Demo-only product'); }
  finally { reload.unmount(); sessionStorage.clear(); userId='A'; }
});


test('dashboard opens the same save flow for Tenis even with an incomplete evaluation and no Gemini call', async () => {
  const render = await start();
  window.location = { hash: '' };
  stub('../src/hooks/useFinancialEvaluation.ts', { useFinancialEvaluation: () => ({ response: null, error: null, loading: false }) });
  const Page = require('../src/app/app/page.tsx').default;
  try {
    componentContext = render();
    const Dashboard = Page().type;
    const dashboard = harness(() => Dashboard());
    let tree = dashboard();
    const selection = elements(tree).find(e => e.props?.onClick && elements(e).some(child => child.type === 'span' && child.props.children === 'Tenis'));
    assert.ok(selection); selection.props.onClick(); tree = dashboard();
    const card = elements(tree).find(e => e.props?.onClick && elements(e).some(child => child.type === 'h3' && child.props.children === 'Plan de Micro-ahorro'));
    assert.ok(card); card.props.onClick(); tree = dashboard();
    const modal = elements(tree).find(e => e.type === MicroModal);
    assert.equal(modal.props.itemName,'Tenis'); assert.equal(modal.props.itemPrice,1800);
    assert.equal(elements(tree).find(e => e.type === Chat).props.suggestion,undefined);
    assert.equal(requests.length,0); assert.equal(rpcCalls.length,0);
    dashboard.unmount();
  } finally { render.unmount(); }
});
