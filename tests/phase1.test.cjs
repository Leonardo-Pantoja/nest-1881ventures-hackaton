const assert = require("node:assert/strict");
const { test } = require("node:test");
const { calculateSafeToSpend } = require("../src/lib/onboarding/financialEngine.ts");
const { projectSixWeeks } = require("../src/lib/onboarding/weeklyProjection.ts");
const { buildDeterministicEvaluation } = require("../src/lib/finance/evaluation.ts");
const { mapSupabaseRecord } = require("../src/lib/finance/financialMapper.ts");
const { internalRedirect } = require("../src/lib/auth/internalRedirect.ts");
const { pendingPurchaseOperation, PurchaseConfirmation } = require("../src/lib/finance/purchaseConfirmation.ts");
const { mapDemoFinancialProfile } = require("../src/lib/finance/demoFinancialProfile.ts");

const profile = { id: "A", lifeContext: [], currentBalance: 5000, payFrequency: "semanal", nextPaydayAmount: 1000, nextPaydayDays: 7,
  dailyEssentialBurn: 100, safetyBuffer: 500, commitments: [], debts: [], isOnboarded: true };
const goal = (id, currentSaved, savingsLocation = "incluido", category = "ahorro") => ({ id, title: id, currentSaved, targetAmount: 10000, savingsLocation, category });

test("all reserves are shared by summary, simulator and projection without duplicating the primary goal", () => {
  const first = goal("laptop", 1000);
  const input = { ...profile, primaryGoal: first, goals: [first, goal("trip", 2000)] };
  assert.equal(calculateSafeToSpend(input).safeToSpend, 800);
  const summary = buildDeterministicEvaluation("Resumen", null, input);
  const simulator = buildDeterministicEvaluation("Product", 100, input);
  assert.equal(summary.safeToSpend, 800);
  assert.equal(simulator.safeToSpend, summary.safeToSpend);
  assert.equal(simulator.consideredExpenses.protectedSavings, 3000);
  assert.equal(projectSixWeeks(input).weeks[0].belowProtectedFunds, false);
  assert.equal(calculateSafeToSpend({ ...input, goals: [first, goal("unknown", 100, "desconocido")] }).status, "datos_incompletos");
});

test("separated savings and overlapping emergency buffer are not deducted twice", () => {
  const input = { ...profile, goals: [goal("outside", 2000, "separado"), goal("emergency", 800, "incluido", "emergencia")] };
  assert.equal(calculateSafeToSpend(input).protectedSavings, 300);
  assert.equal(calculateSafeToSpend(input).safeToSpend, 3500);
});

test("Supabase mapper preserves all goals and unknown reserves never become viable", () => {
  const mapped = mapSupabaseRecord({ profile: { id: "A", current_balance: 5000, daily_essential_budget: 100, safety_buffer: 500, onboarding_completed_at: "yes" },
    incomeSources: [{ amount: 1000, frequency: "weekly", next_payment_date: "2026-10-31" }], commitments: [],
    goals: [{ id: "g1", title: "Laptop", target_amount: 10000, current_saved: 1000, savings_location: "incluido" },
      { id: "g2", title: "Trip", target_amount: 10000, current_saved: 2000, savings_location: "incluido" }] }, new Date("2026-10-24T18:00:00Z"));
  assert.equal(mapped.goals.length, 2);
  assert.equal(calculateSafeToSpend(mapped).safeToSpend, 800);
  const incomplete = buildDeterministicEvaluation("Product", 100, { ...profile, goals: [goal("missing", null)] });
  assert.equal(incomplete.verdict, "DATOS_INCOMPLETOS");
  assert.equal(incomplete.safeToSpend, null);
});

test("internal redirect accepts internal paths and rejects external or ambiguous destinations", () => {
  for (const input of ["/app", "/app/evaluate?name=Sony&price=100", "/auth#login"]) assert.equal(internalRedirect(input, "https://app.test"), input);
  for (const input of ["https://evil.test", "//evil.test", "javascript:alert(1)", "/\\evil.test", "/%2f%2fevil.test", "/%252fevil.test", "/../app", "/app\n"]) assert.equal(internalRedirect(input, "https://app.test"), null, input);
});

test("confirmation creation/cancellation makes no write; concurrent confirmations share one operation", async () => {
  let writes = 0;
  let release;
  const confirmation = new PurchaseConfirmation(async () => { writes++; await new Promise(resolve => { release = resolve; }); });
  assert.equal(writes, 0);
  const first = confirmation.confirm();
  const second = confirmation.confirm();
  assert.equal(first, second);
  await Promise.resolve();
  assert.equal(writes, 1);
  release();
  await first;
  await confirmation.confirm();
  assert.equal(writes, 1);
});

test("failed confirmation remains retryable with the same idempotency key", async () => {
  const ids = [];
  const confirmation = new PurchaseConfirmation(async id => { ids.push(id); if (ids.length === 1) throw Error("offline"); });
  await assert.rejects(confirmation.confirm(), /offline/);
  await confirmation.confirm();
  assert.equal(ids.length, 2);
  assert.equal(ids[0], ids[1]);
});

test("unconfirmed receipts retain their operation ID across modal reopening or reload", () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const first = pendingPurchaseOperation("A", "Product", 100, storage);
  const retry = pendingPurchaseOperation("A", "Product", 100, storage);
  assert.equal(retry.id, first.id);
  assert.notEqual(pendingPurchaseOperation("B", "Product", 100, storage).id, first.id);
  retry.complete();
  assert.notEqual(pendingPurchaseOperation("A", "Product", 100, storage).id, first.id);
});

test("demo financial changes use current values without trusting a real-account profile", () => {
  const ui = { ...profile, id: "mateo", commitments: [{ id: "c3", title: "Plan Celular", amount: 399, dueInDays: 3, category: "Servicios" }],
    goal: { title: "Laptop", targetAmount: 15000, currentSaved: 10500, weeklyContribution: 500 } };
  const before = calculateSafeToSpend(mapDemoFinancialProfile(ui)).safeToSpend;
  const after = calculateSafeToSpend(mapDemoFinancialProfile({ ...ui, currentBalance: 4500 })).safeToSpend;
  assert.equal(before - after, 500);
  assert.equal(mapDemoFinancialProfile({ ...ui, commitments: [{ ...ui.commitments[0], amount: 500 }] }).commitments[0].amount, 500);
});
