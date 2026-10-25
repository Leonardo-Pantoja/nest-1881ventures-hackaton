const assert = require('node:assert/strict');
const { test } = require('node:test');
const server = require('../src/lib/supabase/server.ts');
const { loadAccountSnapshot } = require('../src/lib/finance/accountSnapshot.ts');
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://synthetic.supabase.test';
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'synthetic-public-key';
let authenticated = true, filters = [], tables = [], queryFailure = false;
const rows = {
  profiles: { id: 'owner-A', current_balance: 5000, daily_essential_budget: 100, safety_buffer: 200, onboarding_completed_at: 'yes' },
  income_sources: [{ amount: 2000, frequency: 'weekly', next_payment_date: '2099-01-01' }],
  commitments: [], goals: [],
};
server.createServerSupabaseClient = async () => ({
  auth: { getUser: async () => ({ data: { user: authenticated ? { id: 'owner-A' } : null }, error: null }) },
  from(table) {
    tables.push(table);
    const q = { select() { return q; }, eq(key, value) { filters.push([table, key, value]); return q; },
      maybeSingle() { return Promise.resolve({ data: rows[table], error: null }); },
      then(resolve) { return Promise.resolve({ data: rows[table], error: queryFailure ? { message: 'PRIVATE QUERY DETAIL' } : null }).then(resolve); },
    };
    return q;
  },
});

test('account snapshot derives identity from Auth and filters every collection by that owner and active status', async () => {
  filters = []; tables = [];
  const snapshot = await loadAccountSnapshot();
  assert.equal(snapshot.userId, 'owner-A');
  assert.deepEqual(tables.sort(), ['commitments', 'goals', 'income_sources', 'profiles']);
  assert.ok(filters.some(([t, k, v]) => t === 'profiles' && k === 'id' && v === 'owner-A'));
  for (const table of ['income_sources', 'commitments', 'goals']) {
    assert.ok(filters.some(([t, k, v]) => t === table && k === 'user_id' && v === 'owner-A'));
    assert.ok(filters.some(([t, k, v]) => t === table && k === 'is_active' && v === true));
  }
  assert.equal(snapshot.profile.currentBalance, 5000);
});

test('unauthenticated snapshot never queries financial tables', async () => {
  authenticated = false; tables = [];
  await assert.rejects(loadAccountSnapshot(), error => error.code === 'authentication_required');
  assert.deepEqual(tables, []); authenticated = true;
});

test('query failure cannot become a successful partial financial profile or leak provider messages in logs', async () => {
  queryFailure = true;
  const oldError = console.error, logs = [];
  console.error = (...args) => logs.push(args);
  try {
    await assert.rejects(loadAccountSnapshot(), error => error.code === 'financial_data_unavailable');
    assert.equal(JSON.stringify(logs).includes('PRIVATE QUERY DETAIL'), false);
  } finally { console.error = oldError; queryFailure = false; }
});
