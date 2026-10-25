const assert = require("node:assert/strict");
const { test } = require("node:test");
const account = require("../src/lib/finance/accountSnapshot.ts");
let balance = 5000;
let mutations = 0;
let unavailable = false;
let fail = false;
let receipt = null;
let observedFilters = [];
const profile = { id: "A", lifeContext: [], currentBalance: 5000, payFrequency: "semanal", nextPaydayAmount: 1000,
  nextPaydayDays: 7, dailyEssentialBurn: 100, safetyBuffer: 500, commitments: [], debts: [], isOnboarded: true };
const supabase = {
  from() {
    const q = { select() { return q; }, eq(key, value) { observedFilters.push([key, value]); return q; },
      async maybeSingle() { return { data: receipt, error: unavailable ? { code: "42P01" } : null }; } };
    return q;
  },
  async rpc(name, params) {
    assert.equal(name, "record_purchase_checked_v1");
    assert.equal(params.p_user_id, "A");
    assert.equal(params.p_expected_snapshot.profile.id, "A");
    if (fail) return { data: null, error: { code: "XX000" } };
    if (!receipt) { mutations++; balance -= params.p_price; receipt = { item_name: params.p_name, price: params.p_price, current_balance: balance }; }
    return { data: receipt, error: null };
  },
};
account.loadAccountSnapshot = async () => ({ profile: { ...profile, currentBalance: balance }, revision: "current", raw: { profile: { id: "A", current_balance: balance } }, userId: "A", supabase });
const writerModule = require("../src/lib/supabase/purchaseWriter.ts");
writerModule.createPurchaseWriter = () => supabase;
const { POST } = require("../src/app/api/purchases/route.ts");
const base = { itemName: "Product", itemPrice: 100, operationId: "12345678-1234-4123-8123-123456789abc", financialRevision: "current", userId: "B" };
const request = body => new Request("https://app.test/api/purchases", { method: "POST", body: JSON.stringify(body) });

test("server refuses stale and incomplete data before calling persistence", async () => {
  const response = await POST(request({ ...base, financialRevision: "old" }));
  assert.equal(response.status, 409);
  assert.equal(mutations, 0);
  const load = account.loadAccountSnapshot;
  account.loadAccountSnapshot = async () => ({ ...await load(), profile: { ...profile, safetyBuffer: null } });
  try { assert.equal((await POST(request(base))).status, 422); assert.equal(mutations, 0); }
  finally { account.loadAccountSnapshot = load; }
});

test("unverified storage and failed transactions return errors, never success", async () => {
  unavailable = true;
  assert.equal((await POST(request(base))).status, 503);
  unavailable = false; fail = true;
  assert.equal((await POST(request(base))).status, 503);
  assert.equal(balance, 5000);
  fail = false;
});

test("missing private server writer cannot fall back to the browser RPC", async () => {
  const originalWriter = writerModule.createPurchaseWriter;
  writerModule.createPurchaseWriter = () => { throw new account.EvaluationRequestError("Not configured", 503, "purchase_writer_not_configured"); };
  try {
    const response = await POST(request(base));
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, "purchase_writer_not_configured");
    assert.equal(mutations, 0);
  } finally { writerModule.createPurchaseWriter = originalWriter; }
});

test("API passes stable operation IDs and reads only the authenticated owner's receipts", async () => {
  observedFilters = [];
  const first = await POST(request(base));
  assert.equal(first.status, 200);
  assert.equal((await first.json()).currentBalance, 4900);
  assert.ok(observedFilters.some(([key, value]) => key === "user_id" && value === "A"));
  assert.ok(!observedFilters.some(([key, value]) => key === "user_id" && value === "B"));
  const replay = await POST(request({ ...base, financialRevision: "old" }));
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).replayed, true);
  assert.equal(mutations, 1);
  assert.equal((await POST(request({ ...base, itemPrice: 200 }))).status, 409);
});

test("sub-cent amounts and malformed operation IDs are client errors", async () => {
  assert.equal((await POST(request({ ...base, itemPrice: 0.001 }))).status, 400);
  assert.equal((await POST(request({ ...base, operationId: "invalid" }))).status, 400);
});

test("snapshot revisions change for every financial collection and account", () => {
  const raw = { profile: { id: "A", current_balance: 100 }, incomeSources: [], commitments: [], goals: [] };
  const initial = account.snapshotRevision(raw);
  for (const field of ["incomeSources", "commitments", "goals"]) assert.notEqual(account.snapshotRevision({ ...raw, [field]: [{ id: "new" }] }), initial);
  assert.notEqual(account.snapshotRevision({ ...raw, profile: { id: "B", current_balance: 100 } }), initial);
  assert.notEqual(account.snapshotRevision({ ...raw, profile: { id: "A", current_balance: 99 } }), initial);
});
