const assert = require('node:assert/strict');
const { test } = require('node:test');
const { mapSupabaseRecord } = require('../src/lib/finance/financialMapper.ts');
const { calculateSafeToSpend } = require('../src/lib/onboarding/financialEngine.ts');
const { projectSixWeeks } = require('../src/lib/onboarding/weeklyProjection.ts');
const { buildPurchaseReport } = require('../src/lib/onboarding/purchaseReport.ts');

const now = new Date('2026-10-25T18:00:00Z');
const profile = { id: 'owner-A', current_balance: '5000.25', safety_buffer: '200.25', daily_essential_budget: '100', onboarding_completed_at: '2026-10-01', display_name: 'Private Name' };
const income = { id: 'salary', amount: '2000.50', frequency: 'weekly', next_payment_date: '2026-11-01', is_active: true };
const rows = overrides => ({ profile, incomeSources: [income], commitments: [], goals: [], ...overrides });
const mapped = overrides => mapSupabaseRecord(rows(overrides), now);

// These tests exercise source rows and the actual Sebas engine, never a browser-supplied profile.
test('known balance, salary, calendar, obligations and protected savings survive the full adapter-to-engine path', () => {
  const p = mapped({ commitments: [
    { id: 'rent', title: 'Renta', amount: '500.10', next_due_date: '2026-10-27', frequency: 'one_time', category: 'Vivienda' },
    { id: 'debt', title: 'Tarjeta', amount: '200.20', total_balance: '3000', next_due_date: '2026-10-28', frequency: 'one_time', category: 'Deuda' },
  ], goals: [{ id: 'goal', title: 'Laptop', target_amount: '10000', current_saved: '1000.05', savings_location: 'incluido', weekly_contribution: '100' }] });
  assert.equal(p.currentBalance, 5000.25);
  assert.equal(p.nextPaydayAmount, 2000.5);
  assert.equal(p.nextPaydayDays, 7);
  assert.equal(p.dailyEssentialBurn, 100);
  assert.equal(p.safetyBuffer, 200.25);
  assert.equal(p.commitments.length, 1); assert.equal(p.debts.length, 1);
  assert.equal(p.debts[0].nextPayment, 200.2);
  assert.equal(p.goals[0].currentSaved, 1000.05);
  const safe = calculateSafeToSpend(p);
  assert.equal(safe.pendingCommitments, 500.1); assert.equal(safe.pendingDebtPayments, 200.2);
  assert.equal(safe.protectedSavings, 1000.05); assert.equal(safe.safeToSpend, 2399.65);
  const report = buildPurchaseReport(p, 2300);
  assert.equal(report.purchase.purchaseAmount, 2300);
  assert.equal(report.purchase.remainingSafeToSpend, 99.65);
});

test('zero income sources do not erase known balance, reserve or essential budget and never become a zero salary', () => {
  const p = mapped({ incomeSources: [] });
  assert.equal(p.currentBalance, 5000.25); assert.equal(p.safetyBuffer, 200.25); assert.equal(p.dailyEssentialBurn, 100);
  assert.equal(p.nextPaydayAmount, null); assert.equal(p.nextPaydayDays, null);
  assert.deepEqual(p.incomeSources, []);
  assert.ok(p.dataWarnings.includes('income_sources_missing'));
  assert.equal(calculateSafeToSpend(p).safeToSpend, null);
});

test('a single salary remains known when its date is missing, overdue or invalid; no payday is invented', () => {
  for (const [date, status] of [[null, 'missing'], ['2026-10-24', 'overdue'], ['2026-02-30', 'invalid']]) {
    const p = mapped({ incomeSources: [{ ...income, next_payment_date: date }] });
    assert.equal(p.nextPaydayAmount, 2000.5);
    assert.equal(p.nextPaydayDays, null);
    assert.equal(p.incomeSources[0].amount, 2000.5);
    assert.equal(p.incomeSources[0].dateStatus, status);
    assert.ok(p.dataWarnings.includes(`income_date_${status}`));
    assert.equal(calculateSafeToSpend(p).safeToSpend, null);
    if (status === 'overdue') assert.equal(p.incomeSources[0].nextPaymentDate, '2026-10-24');
  }
});

test('multiple complete income calendars use the nearest date regardless of query ordering and do not repeat only one income', () => {
  const list = [
    { id: 'later', amount: 5000, frequency: 'monthly', next_payment_date: '2026-11-10' },
    { id: 'nearer', amount: 1200.25, frequency: 'weekly', next_payment_date: '2026-10-28' },
    { id: 'same-day', amount: 300.35, frequency: 'biweekly', next_payment_date: '2026-10-28' },
  ];
  for (const sources of [list, [...list].reverse()]) {
    const p = mapped({ incomeSources: sources });
    assert.equal(p.nextPaydayDays, 3); assert.equal(p.nextPaydayAmount, 1500.6);
    assert.equal(p.payFrequency, 'variable');
    assert.equal(p.incomeSources.length, 3);
    assert.equal(calculateSafeToSpend(p).safeToSpend, 4500);
    assert.equal(projectSixWeeks(p).status, 'datos_incompletos');
    assert.ok(p.dataWarnings.includes('multiple_income_calendars'));
  }
});

test('fully synchronized fixed income sources sum their recorded amounts in cents without losing the shared schedule', () => {
  const p = mapped({ incomeSources: [income, { ...income, id: 'second', amount: '300.35' }] });
  assert.equal(p.nextPaydayDays, 7); assert.equal(p.nextPaydayAmount, 2300.85); assert.equal(p.payFrequency, 'semanal');
  assert.equal(projectSixWeeks(p).status, 'calculado');
});

test('an unknown or overdue date among multiple sources prevents claiming which paycheck comes next but preserves each amount', () => {
  for (const date of [null, '2026-10-01', 'bad-date']) {
    const p = mapped({ incomeSources: [income, { ...income, id: 'second', amount: 500, next_payment_date: date }] });
    assert.equal(p.nextPaydayAmount, null); assert.equal(p.nextPaydayDays, null);
    assert.deepEqual(p.incomeSources.map(source => source.amount), [2000.5, 500]);
    assert.equal(p.currentBalance, 5000.25); assert.equal(calculateSafeToSpend(p).safeToSpend, null);
  }
});

test('variable or unknown frequency can preserve a confirmed immediate horizon while future projection remains incomplete', () => {
  for (const frequency of ['variable', 'unrecognized', null]) {
    const p = mapped({ incomeSources: [{ ...income, frequency }] });
    assert.equal(p.nextPaydayAmount, 2000.5); assert.equal(p.nextPaydayDays, 7); assert.equal(p.payFrequency, 'variable');
    assert.equal(calculateSafeToSpend(p).safeToSpend, 4100);
    assert.equal(projectSixWeeks(p).status, 'datos_incompletos');
    if (frequency !== 'variable') assert.ok(p.dataWarnings.includes('income_frequency_unknown'));
  }
});

test('a salary due today is not credited to balance by the mapper', () => {
  const p = mapped({ incomeSources: [{ ...income, next_payment_date: '2026-10-25' }] });
  assert.equal(p.nextPaydayDays, 0); assert.equal(p.currentBalance, 5000.25);
  assert.equal(calculateSafeToSpend(p).safeToSpend, 4800);
});

test('overdue one-time obligations stay due, while overdue recurring arrears require calendar confirmation', () => {
  const due = { id: 'payment', title: 'Pago pendiente', amount: 300, next_due_date: '2026-10-24', frequency: 'one_time', category: 'Otros' };
  const p = mapped({ commitments: [due] });
  assert.equal(p.commitments[0].dueInDays, 0);
  assert.equal(calculateSafeToSpend(p).pendingCommitments, 300);
  assert.ok(p.dataWarnings.includes('overdue_commitment'));
  for (const frequency of ['weekly', 'monthly']) {
    const recurring = mapped({ commitments: [{ ...due, frequency }] });
    assert.equal(recurring.commitments[0].dueInDays, null);
    assert.equal(calculateSafeToSpend(recurring).safeToSpend, null);
    assert.equal(projectSixWeeks(recurring).status, 'datos_incompletos');
  }
  const debt = mapped({ commitments: [{ ...due, category: 'Deuda' }] });
  assert.equal(debt.commitments.length, 0); assert.equal(debt.debts[0].dueInDays, 0);
  assert.equal(calculateSafeToSpend(debt).pendingDebtPayments, 300);
  assert.ok(debt.dataWarnings.includes('overdue_debt'));
});

test('missing dates, unknown monetary data and unconfirmed savings locations remain unknown', () => {
  const p = mapped({ profile: { ...profile, daily_essential_budget: ' ' }, incomeSources: [{ ...income, amount: null }],
    commitments: [{ id: 'missing', amount: 100, category: 'Deuda', next_due_date: null, frequency: 'weekly' }],
    goals: [{ id: 'unknown', title: 'Meta', target_amount: 1000, current_saved: 200 }] });
  assert.equal(p.dailyEssentialBurn, null); assert.equal(p.nextPaydayAmount, null);
  assert.equal(p.goals[0].savingsLocation, 'desconocido'); assert.equal(p.debts[0].dueInDays, null);
  assert.ok(p.dataWarnings.includes('income_amount_unknown')); assert.ok(p.dataWarnings.includes('debt_date_missing'));
  assert.equal(calculateSafeToSpend(p).safeToSpend, null);
});

test('inactive rows do not replace the active salary or consume reserves, and source metadata excludes personal fields', () => {
  const p = mapped({ incomeSources: [income, { amount: 9999, frequency: 'monthly', next_payment_date: null, is_active: false }],
    commitments: [{ id: 'inactive', amount: 9999, is_active: false }],
    goals: [{ id: 'inactive', target_amount: 100, current_saved: 9999, is_active: false }] });
  assert.equal(p.nextPaydayAmount, 2000.5); assert.equal(p.incomeSources.length, 1);
  assert.equal(p.commitments.length, 0); assert.equal(p.goals.length, 0);
  assert.deepEqual(Object.keys(p.incomeSources[0]).sort(), ['amount', 'dateStatus', 'frequency', 'nextPaymentDate', 'nextPaymentDays']);
  assert.ok(!JSON.stringify(p.incomeSources).includes('owner-A')); assert.ok(!JSON.stringify(p.incomeSources).includes('Private Name'));
});


test('ambiguous date strings and impossible timestamp dates do not invent a payday; explicit timestamps use the financial timezone', () => {
  for (const date of ['2026', '10/30/2026', '2026-02-30T15:00:00Z', '2026-10-30T12:00:00']) {
    const p = mapped({ incomeSources: [{ ...income, next_payment_date: date }] });
    assert.equal(p.nextPaydayDays, null); assert.equal(p.nextPaydayAmount, 2000.5);
    assert.equal(p.incomeSources[0].dateStatus, 'invalid');
  }
  const p = mapped({ incomeSources: [{ ...income, next_payment_date: '2026-10-26T00:30:00Z' }] });
  assert.equal(p.nextPaydayDays, 0); assert.equal(p.incomeSources[0].nextPaymentDate, '2026-10-25');
});
