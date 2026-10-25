const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  calculateHypotheticalPurchaseBalance,
  calculateSavingsTarget,
  calculateWaitScenario,
} = require('../src/lib/finance/conversationalMath.ts');
const { calculateSafeToSpend } = require('../src/lib/onboarding/financialEngine.ts');
const { projectSixWeeks } = require('../src/lib/onboarding/weeklyProjection.ts');
const { withGoalContributions } = require('../src/lib/finance/savingsPlan.ts');

const partial = {
  id: 'partial', lifeContext: [], currentBalance: 3000, payFrequency: 'variable',
  nextPaydayAmount: null, nextPaydayDays: null, dailyEssentialBurn: 210,
  safetyBuffer: 650, commitments: [], debts: [], isOnboarded: true,
};
const fixed = {
  ...partial, id: 'fixed', currentBalance: 5000, payFrequency: 'semanal',
  nextPaydayAmount: 2000, nextPaydayDays: 7, dailyEssentialBurn: 100,
  primaryGoal: {
    id: 'laptop', title: 'Laptop', category: 'compra', targetAmount: 10000,
    currentSaved: 2000, weeklyContribution: 200, savingsLocation: 'separado',
  },
};

function deepFreeze(value) {
  Object.freeze(value);
  for (const child of Object.values(value)) if (child && typeof child === 'object') deepFreeze(child);
  return value;
}

test('partial data preserves the hypothetical accounting balance without creating a spending margin', () => {
  const profile = deepFreeze(structuredClone(partial));
  const result = calculateHypotheticalPurchaseBalance(profile.currentBalance, 1449);
  assert.deepEqual(result, {
    status: 'calculado', registeredBalance: 3000, purchaseAmount: 1449,
    hypotheticalBalance: 1551, balanceShortfall: 0,
  });
  assert.equal(calculateSafeToSpend(profile).safeToSpend, null);
  assert.equal('safeToSpend' in result, false);
  assert.equal(profile.currentBalance, 3000);
});

test('insufficient or unknown accounting balances never simulate an impossible purchase', () => {
  assert.deepEqual(calculateHypotheticalPurchaseBalance(100, 1449), {
    status: 'saldo_insuficiente', registeredBalance: 100, purchaseAmount: 1449,
    hypotheticalBalance: null, balanceShortfall: 1349,
  });
  assert.equal(calculateHypotheticalPurchaseBalance(0, 1).balanceShortfall, 1);
  for (const unknown of [null, NaN, Infinity, -1, 1.001]) {
    const result = calculateHypotheticalPurchaseBalance(unknown, 1449);
    assert.equal(result.status, 'datos_incompletos');
    assert.equal(result.hypotheticalBalance, null);
  }
  assert.equal(calculateHypotheticalPurchaseBalance(0.3, 0.1).hypotheticalBalance, 0.2);
});

test('invalid purchase prices are rejected consistently by all additional helpers', () => {
  for (const price of [0, -1, NaN, Infinity, 0.001, 1.001]) {
    assert.throws(() => calculateHypotheticalPurchaseBalance(3000, price));
    assert.throws(() => calculateSavingsTarget(price, { weeks: 4 }));
    assert.throws(() => calculateWaitScenario(fixed, price, 2));
  }
});

test('the mathematical four-week target survives missing income and never claims sustainable capacity', () => {
  const result = calculateSavingsTarget(1449, { weeks: 4 });
  assert.equal(result.requiredWeeklyContribution, 362.25);
  assert.equal(result.weeklyContribution, 362.25);
  assert.equal(result.remainingTarget, 1449);
  assert.equal(result.upfrontAmount, 0);
  assert.equal(result.estimatedWeeks, 4);
  assert.equal(result.sustainability, 'sin_evaluar');
  assert.equal('weeklyCapacity' in result, false);
  assert.equal('estimatedDate' in result, false);
});

test('only an explicit earmarked amount reduces the arithmetic target and only explicit contributions estimate time', () => {
  assert.equal(calculateSavingsTarget(1449, { weeks: 4, upfrontAmount: 449 }).requiredWeeklyContribution, 250);
  assert.equal(calculateSavingsTarget(1449, { weeklyContribution: 100 }).estimatedWeeks, 15);
  assert.equal(calculateSavingsTarget(1449).estimatedWeeks, null);
  assert.equal(calculateSavingsTarget(1449, { upfrontAmount: 1449 }).estimatedWeeks, 0);
  assert.equal(calculateSavingsTarget(900, { upfrontAmount: 1449 }).remainingTarget, 0);
});

test('cent rounding funds the full target and explicit contributions retain their actual timeline', () => {
  const rounded = calculateSavingsTarget(10.01, { weeks: 3 });
  assert.equal(rounded.requiredWeeklyContribution, 3.34);
  assert.equal(rounded.estimatedWeeks, 3);
  const slow = calculateSavingsTarget(1449, { weeks: 4, weeklyContribution: 100 });
  assert.equal(slow.requiredWeeklyContribution, 362.25);
  assert.equal(slow.weeklyContribution, 100);
  assert.equal(slow.estimatedWeeks, 15);
  assert.equal(slow.meetsRequestedDeadline, false);
  for (const weeks of [0, -1, 1.5, 521, NaN, Infinity]) {
    assert.throws(() => calculateSavingsTarget(1449, { weeks }));
    assert.throws(() => calculateWaitScenario(fixed, 1449, weeks));
  }
  assert.throws(() => calculateSavingsTarget(1449, { weeklyContribution: 0 }));
  assert.throws(() => calculateSavingsTarget(1449, { upfrontAmount: -1 }));
});

test('two weeks means the engine second-week checkpoint, including already committed goal contributions', () => {
  const profile = deepFreeze(structuredClone(fixed));
  const result = calculateWaitScenario(profile, 1449, 2);
  assert.equal(result.status, 'calculado');
  assert.equal(result.requestedDays, 14);
  assert.equal(result.projectedBalance, 7200);
  assert.equal(result.hypotheticalBalanceAfterPurchase, 5751);
  assert.equal(result.essentialExpensesDuringWait, 1400);
  assert.equal(result.projectedBalance, projectSixWeeks(withGoalContributions(profile)).weeks[1].endBalance);
  assert.equal(calculateWaitScenario(profile, 1449, 1).projectedBalance, 6100);
  assert.equal(profile.currentBalance, 5000);
  assert.equal(profile.primaryGoal.currentSaved, 2000);
  assert.equal(profile.commitments.length, 0);
  assert.match(result.limitations.join(' '), /no son margen seguro/);
});

test('missing income allows known essential-outflow arithmetic without inventing a future balance', () => {
  const result = calculateWaitScenario(deepFreeze(structuredClone(partial)), 1449, 2);
  assert.equal(result.status, 'datos_incompletos');
  assert.equal(result.currentBalance, 3000);
  assert.equal(result.essentialExpensesDuringWait, 2940);
  assert.equal(result.projectedBalance, null);
  assert.equal(result.hypotheticalBalanceAfterPurchase, null);
  assert.equal(result.balanceShortfall, null);
  assert.equal(result.belowProtectedFundsAfterPurchase, null);
});

test('variable income and incompatible monthly calendars are never converted into fixed paychecks', () => {
  assert.equal(calculateWaitScenario({ ...fixed, payFrequency: 'variable' }, 1449, 2).projectedBalance, null);
  const monthly = { ...fixed, commitments: [{
    id: 'rent', title: 'Renta', amount: 500, dueInDays: 10, frequency: 'mensual',
    category: 'Vivienda', kind: 'esencial', isConfirmed: true,
  }] };
  const result = calculateWaitScenario(monthly, 1449, 2);
  assert.equal(result.status, 'datos_incompletos');
  assert.equal(result.essentialExpensesDuringWait, 1400);
  assert.equal(result.projectedBalance, null);
});

test('wait never extrapolates the engine beyond six weeks', () => {
  assert.equal(calculateWaitScenario(fixed, 1449, 6).status, 'calculado');
  const beyond = calculateWaitScenario(fixed, 1449, 7);
  assert.equal(beyond.withinProjectionHorizon, false);
  assert.equal(beyond.requestedDays, 49);
  assert.equal(beyond.projectedBalance, null);
  assert.equal(beyond.hypotheticalBalanceAfterPurchase, null);
  assert.equal(beyond.essentialExpensesDuringWait, 4900);
  assert.match(beyond.limitations.join(' '), /no se extrapolan/);
});

test('wait reports existing protected-fund risk and distinguishes a post-purchase accounting shortfall', () => {
  const low = { ...fixed, currentBalance: 1000, primaryGoal: undefined };
  const touching = calculateWaitScenario(low, 2000, 1);
  assert.equal(touching.projectedBalance, 2300);
  assert.equal(touching.protectedFunds, 650);
  assert.equal(touching.hypotheticalBalanceAfterPurchase, 300);
  assert.equal(touching.belowProtectedFundsAfterPurchase, true);
  assert.deepEqual(touching.riskWeeksDuringWait, [1]);
  const insufficient = calculateWaitScenario(low, 2500, 1);
  assert.equal(insufficient.balanceShortfall, 200);
  assert.equal(insufficient.hypotheticalBalanceAfterPurchase, null);
  assert.equal(insufficient.belowProtectedFundsAfterPurchase, null);
});

test('all due payments are delegated to the unchanged engine, including day zero and debts', () => {
  const profile = deepFreeze({
    ...structuredClone(fixed),
    commitments: [{ id: 'now', title: 'Pago hoy', amount: 100, dueInDays: 0, frequency: 'unico', kind: 'otro' }],
    debts: [{ id: 'debt', title: 'Deuda', totalBalance: 1000, nextPayment: 50, dueInDays: 3, frequency: 'semanal' }],
  });
  const result = calculateWaitScenario(profile, 1449, 2);
  assert.equal(result.projectedBalance, 7000);
  assert.equal(result.projectedBalance, projectSixWeeks(withGoalContributions(profile)).weeks[1].endBalance);
  assert.equal(result.hypotheticalBalanceAfterPurchase, 5551);
  assert.equal(profile.commitments[0].dueInDays, 0);
  assert.equal(profile.debts[0].nextPayment, 50);
});

test('unknown goal contributions prevent a wait simulation that would silently omit them', () => {
  const result = calculateWaitScenario({
    ...fixed, primaryGoal: { ...fixed.primaryGoal, weeklyContribution: null },
  }, 1449, 2);
  assert.equal(result.status, 'datos_incompletos');
  assert.equal(result.projectedBalance, null);
  assert.match(result.limitations.join(' '), /aportaciones semanales/);
});
