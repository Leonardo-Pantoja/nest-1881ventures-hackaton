const assert = require('node:assert/strict');
const { test } = require('node:test');
const { calculateSavingsPlan } = require('../src/lib/finance/savingsPlan.ts');
const { profileAtNextIncome } = require('../src/lib/finance/waitScenario.ts');
const { executeFinancialTool } = require('../src/lib/ai/financialTools.ts');
const { deterministicExplanation, renderExplanation, evaluateExplanation } = require('../src/lib/ai/responseEvaluation.ts');
const { sebasScenarios, sebasProfile } = require('../src/lib/ai/scenarios.ts');
const { validateIntentArguments } = require('../src/lib/ai/financialAssistant.ts');
const { intentSchema } = require('../src/lib/ai/schemas.ts');
const intent = (operation = 'purchase', params = {}) => ({ operation, productName: 'Producto', price: null, alternativePrice: null,
  weeks: null, weeklyContribution: null, upfrontAmount: null, reserveAmount: null, goalQuery: null, ...params });
const profile = { ...sebasProfile, currentBalance: 5000, nextPaydayAmount: 2000, dailyEssentialBurn: 100,
  primaryGoal: { ...sebasProfile.primaryGoal, weeklyContribution: 200 } };

for (const scenario of sebasScenarios) test(`Sebas ${scenario.caseNumber}: document figures and five-dimensional response rubric (deterministic)`, () => {
  const tool = executeFinancialTool(scenario.profile, intent('purchase', { price: scenario.price }), null);
  const report = tool.report;
  assert.ok(report);
  assert.equal(report.purchase.safeToSpend, scenario.caseNumber === 9 ? null : 1100);
  if (scenario.caseNumber <= 7) {
    const minima = [600, 400, 200, 100, -100, -300, -400];
    assert.equal(report.projectionAfter.lowestBalance, minima[scenario.caseNumber - 1]);
    assert.equal(report.projectionBefore.weeks[5].endBalance, 1400);
    assert.equal(report.projectionAfter.weeks[5].endBalance, 1400 - scenario.price);
    assert.equal(report.purchase.remainingSafeToSpend, Math.max(0, 1100 - scenario.price));
    assert.equal(report.goalImpact.savedAfter, 2000);
  }
  if (scenario.caseNumber === 3) assert.ok(!tool.facts.some(f => f.id === 'ahora.risk'));
  if (scenario.caseNumber === 4) assert.match(tool.facts.find(f => f.id === 'ahora.risk').text, /semanas 6/);
  if (scenario.caseNumber === 7) assert.equal(report.purchase.exceedsBy, 100);
  if (scenario.caseNumber === 8) { assert.equal(report.status, 'saldo_insuficiente'); assert.equal(report.projectionAfter, null); assert.equal(report.purchase.exceedsBy, 1400); }
  if (scenario.caseNumber === 9) { assert.equal(report.purchase.assessment, 'no_evaluable'); assert.equal(report.projectedBalanceDifference, null); }
  if (scenario.caseNumber === 10) { assert.equal(report.status, 'datos_incompletos'); assert.equal(report.projectionAfter.status, 'datos_incompletos'); }
  const answer = { factIds: tool.facts.map(f => f.id), followUp: 'compare' };
  assert.equal(evaluateExplanation(tool, answer).score, 10);
  assert.equal(evaluateExplanation(tool, answer).verdict, 'aprobada');
  assert.ok(renderExplanation(tool, answer).includes('decisión es tuya'));
  assert.equal(evaluateExplanation(tool, { ...answer, factIds: [...answer.factIds, 'invented-999'] }).verdict, 'rechazada');
  assert.equal(evaluateExplanation(tool, { ...answer, prose: 'La compra es 100% segura' }).verdict, 'rechazada');
  if (tool.facts.some(f => f.id.endsWith('.risk'))) {
    assert.equal(evaluateExplanation(tool, { ...answer, factIds: answer.factIds.filter(id => !id.endsWith('.risk')) }).criticalFailure, true);
  }
});

test('savings uses integer cents, all existing contributions, no implicit upfront money, and does not mutate', () => {
  const frozen = JSON.stringify(profile);
  const plan = calculateSavingsPlan(profile, 4000, { weeks: 4, financialDate: '2026-10-25' });
  assert.equal(plan.upfrontAmount, 0);
  assert.equal(plan.weeklyCapacity, 1100);
  assert.equal(plan.weeklyContribution, 1000);
  assert.equal(plan.weeks, 4);
  assert.equal(plan.status, 'calculado');
  assert.equal(plan.estimatedDate, '2026-11-22');
  assert.equal(JSON.stringify(profile), frozen);
  const cents = calculateSavingsPlan(profile, 1000.01, { weeks: 4 });
  assert.equal(cents.weeklyContribution, 250.01);
  assert.equal(cents.weeks, 4);
  const goals = [profile.primaryGoal, { ...profile.primaryGoal, id: 'g2', weeklyContribution: 300 }];
  assert.equal(calculateSavingsPlan({ ...profile, goals }, 4000).weeklyCapacity, 800);
  assert.equal(calculateSavingsPlan(profile, 4000, { weeklyContribution: 2000 }).status, 'no_sostenible');
  assert.equal(calculateSavingsPlan(profile, 4000, { weeks: 1 }).status, 'no_sostenible');
  assert.equal(calculateSavingsPlan(profile, 4000, { weeks: 4, weeklyContribution: 100 }).status, 'no_sostenible');
});

test('savings never extrapolates unknown, monthly, variable, negative-surplus or previous-risk profiles', () => {
  assert.equal(calculateSavingsPlan({ ...profile, nextPaydayDays: null }, 4000).status, 'datos_incompletos');
  assert.equal(calculateSavingsPlan({ ...profile, payFrequency: 'variable' }, 4000).status, 'datos_incompletos');
  assert.equal(calculateSavingsPlan({ ...profile, primaryGoal: { ...profile.primaryGoal, weeklyContribution: null } }, 4000).status, 'datos_incompletos');
  assert.equal(calculateSavingsPlan(sebasProfile, 4000, { weeks: 4 }).status, 'no_sostenible');
  assert.equal(calculateSavingsPlan({ ...profile, nextPaydayAmount: 500 }, 4000).weeklyCapacity, 0);
  assert.equal(calculateSavingsPlan(profile, 4000, { upfrontAmount: 4001 }).status, 'no_sostenible');
  const beyond = calculateSavingsPlan(profile, 4000, { weeklyContribution: 250 });
  assert.equal(beyond.weeks, 16); assert.equal(beyond.beyondProjection, true);
  assert.match(beyond.limitations.join(' '), /estimación aritmética/);
  assert.equal(beyond.estimatedDate, null);
});

test('savings biweekly capacity and late one-time costs protect reserves', () => {
  const p = { ...profile, currentBalance: 1000, payFrequency: 'quincenal', nextPaydayDays: 2, nextPaydayAmount: 2400,
    commitments: [{ id: 'late', title: 'Pago', amount: 1400, dueInDays: 10, frequency: 'unico', category: 'Otros', kind: 'otro', isConfirmed: true }] };
  const plan = calculateSavingsPlan(p, 1000);
  assert.ok(plan.weeklyCapacity < 300); // recurring surplus is 300 but liquidity further constrains it
});

test('conversation tools A–H: price changes, referenced savings, rent priorities, authorized goal, missing dates and photo context', () => {
  const a = executeFinancialTool(profile, intent('purchase', { price: 1200 }), null);
  const b = executeFinancialTool(profile, intent('purchase', { price: 900 }), a.product);
  assert.equal(b.report.purchase.purchaseAmount, 900);
  const c = executeFinancialTool(profile, intent('savings', { weeks: 4 }), b.product);
  assert.equal(c.savings.target, 900); assert.equal(c.savings.weeklyContribution, 225);
  const rent = { id: 'rent', title: 'Mi renta registrada', amount: 500, dueInDays: 3, frequency: 'unico', kind: 'esencial', category: 'Vivienda' };
  const d = executeFinancialTool({ ...profile, commitments: [rent] }, intent('priorities'), b.product);
  assert.match(d.facts.find(f => f.id === 'priority.0').text, /Mi renta registrada/);
  const e = executeFinancialTool(profile, intent('goal', { goalQuery: 'laptop' }), b.product);
  assert.equal(e.cards.find(c => c.label === 'Ahorro registrado en la meta').value, 2000);
  const f = executeFinancialTool({ ...profile, nextPaydayDays: null }, intent('purchase'), b.product);
  assert.equal(f.report.purchase.safeToSpend, null);
  const g = executeFinancialTool(sebasProfile, intent('purchase', { price: 700 }), null);
  assert.match(deterministicExplanation(g), /riesgo.*semanas 6/);
  const h = executeFinancialTool(profile, intent('purchase'), { name: 'Producto de imagen confirmado', price: 150.50 });
  assert.equal(h.report.purchase.purchaseAmount, 150.5);
  assert.equal(h.product.name, 'Producto de imagen confirmado');
  const compare = executeFinancialTool(profile, intent('compare', { price: 3000, alternativePrice: 1800 }), null);
  assert.ok(compare.cards.some(c => c.label === 'alternativa: precio' && c.value === 1800));
});

test('wait is deterministic, debits due payments and goals, and requires a known fixed calendar', () => {
  const p = { ...profile, commitments: [{ id: 'paid', title: 'Pago único', amount: 100, dueInDays: 0, frequency: 'unico', kind: 'otro' }] };
  const after = profileAtNextIncome(p);
  assert.equal(after.currentBalance, 6000); // 5000 + 2000 - 700 - 100 - 200 reserved contribution
  assert.equal(after.commitments.length, 0); assert.equal(after.nextPaydayDays, 7);
  assert.equal(p.currentBalance, 5000);
  assert.equal(profileAtNextIncome({ ...p, nextPaydayDays: null }), null);
  assert.equal(profileAtNextIncome({ ...p, commitments: [{ ...p.commitments[0], frequency: 'mensual' }] }), null);
});

test('goal withdrawals require explicit allowlisted operation; reserve simulations never write', () => {
  const before = JSON.stringify(profile);
  const reserve = executeFinancialTool(profile, intent('reserve', { reserveAmount: 500 }), null);
  assert.equal(reserve.cards[0].value, 3600);
  const withdrawal = executeFinancialTool(profile, intent('withdraw_goal', { goalQuery: 'laptop', reserveAmount: 500 }), null);
  assert.equal(withdrawal.cards[0].value, 1500);
  assert.equal(JSON.stringify(profile), before);
  const competing = executeFinancialTool({ ...profile, goals: [profile.primaryGoal, { ...profile.primaryGoal, id: 'other' }] }, intent('goal'), null);
  assert.match(competing.facts[0].text, /varias metas/);
});

test('invented argument amounts, subcent amounts, arbitrary operations and unmentioned periods are rejected', () => {
  const request = { message: '¿Puedo comprar algo de $1,200?', history: [], product: null };
  assert.equal(validateIntentArguments(intent('purchase', { price: 1200 }), request).price, 1200);
  assert.throws(() => validateIntentArguments(intent('purchase', { price: 9999 }), request));
  assert.throws(() => validateIntentArguments(intent('savings', { weeks: 99 }), request));
  assert.equal(validateIntentArguments(intent('savings', { weeks: 4 }), { ...request, message: 'en cuatro semanas' }).weeks, 4);
  assert.equal(intentSchema.safeParse(intent('purchase', { price: 0.001 })).success, false);
  assert.equal(intentSchema.safeParse(intent('transfer')).success, false);
  assert.equal(intentSchema.safeParse({ ...intent(), user_id: 'another' }).success, false);
});

test('existing evaluation widgets also surface future risk and incomplete projection without hiding known margin', () => {
  const { buildDeterministicEvaluation } = require('../src/lib/finance/evaluation.ts');
  const risky = buildDeterministicEvaluation('Producto', 700, sebasProfile);
  assert.equal(risky.status, 'precaucion'); assert.equal(risky.badgeLabel, 'Riesgo en la proyección');
  assert.equal(risky.safeToSpend, 1100); assert.match(risky.headlineLine1, /semanas 6/);
  const monthly = buildDeterministicEvaluation('Producto', 200, sebasScenarios[9].profile);
  assert.equal(monthly.safeToSpend, 1100); assert.equal(monthly.badgeLabel, 'Proyección por confirmar');
  assert.equal(monthly.purchaseReport.status, 'datos_incompletos');
  assert.equal(buildDeterministicEvaluation('Producto', 600, sebasProfile).status, 'dentro_del_margen');
});

test('model cannot invent permission to withdraw a goal or assign an upfront contribution', () => {
  const request = { message: 'Quiero comprar algo de $500', history: [], product: null };
  assert.throws(() => validateIntentArguments(intent('withdraw_goal', { reserveAmount: 500 }), request));
  assert.throws(() => validateIntentArguments(intent('savings', { upfrontAmount: 500 }), request));
  assert.equal(validateIntentArguments(intent('withdraw_goal', { reserveAmount: 500 }), { ...request, message: '¿Qué pasa si retiro $500 de mi meta?' }).reserveAmount, 500);
});

test('priorities consider due dates across debt and other obligations while preserving immediate essentials', () => {
  const p = { ...profile, commitments: [{ id: 'subscription', title: 'Suscripción futura', amount: 100, dueInDays: 20, frequency: 'unico', kind: 'suscripcion', category: 'Servicio' }],
    debts: [{ id: 'debt', title: 'Pago de deuda hoy', nextPayment: 200, totalBalance: null, dueInDays: 0, frequency: 'unico' }] };
  const result = executeFinancialTool(p, intent('priorities'), null);
  assert.match(result.facts.find(f => f.id === 'priority.0').text, /deuda hoy/);
});
