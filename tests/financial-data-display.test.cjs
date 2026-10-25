const assert = require('node:assert/strict');
const { test } = require('node:test');
const React = require('react');
const path = require('node:path');
const { buildDeterministicEvaluation } = require('../src/lib/finance/evaluation.ts');
const { mapSupabaseRecord } = require('../src/lib/finance/financialMapper.ts');
const { getFinancialMissingInformation } = require('../src/lib/finance/profileDiagnostics.ts');
const { resolveInitialProfileMode } = require('../src/lib/finance/initialProfile.ts');
const Status = require('../src/components/FinancialDataStatus.tsx').default;
const now = new Date('2026-10-25T18:00:00Z');
const rows = { profile: { id: 'owner-A', current_balance: 5500, safety_buffer: 200, daily_essential_budget: 100, onboarding_completed_at: 'yes' },
  incomeSources: [{ amount: 1500, frequency: 'weekly', next_payment_date: null }], commitments: [], goals: [] };
const profile = mapSupabaseRecord(rows, now);
const evaluation = buildDeterministicEvaluation('Laptop', 2300, profile);
function content(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(content).join(' ');
  return content(node.props?.children);
}

test('incomplete payday preserves authenticated balance, salary, reserves and daily expenses in the API presentation', () => {
  assert.equal(evaluation.safeToSpend, null);
  assert.equal(evaluation.consideredExpenses.currentBalance, 5500);
  assert.equal(evaluation.consideredExpenses.safetyBuffer, 200);
  assert.equal(evaluation.registeredData.incomeSources[0].amount, 1500);
  assert.equal(evaluation.registeredData.incomeSources[0].dateStatus, 'missing');
  assert.equal(evaluation.registeredData.dailyEssentialBudget, 100);
  const rendered = content(Status({ evaluation }));
  for (const amount of ['5,500.00', '1,500.00', '200.00', '100.00']) assert.ok(rendered.includes(amount), amount);
  assert.match(rendered, /falta información para calcular el margen/);
  assert.match(rendered, /Próxima fecha por confirmar/);
  assert.ok(!evaluation.missingInformation.includes('Saldo actual desconocido.'));
});

test('unknown fields remain unknown and are never presented as zero currency values', () => {
  const p = mapSupabaseRecord({ ...rows, profile: { ...rows.profile, current_balance: null, safety_buffer: null, daily_essential_budget: null }, incomeSources: [] }, now);
  const partial = buildDeterministicEvaluation('Resumen financiero', null, p);
  const rendered = content(Status({ evaluation: partial }));
  assert.equal(partial.consideredExpenses.currentBalance, null);
  assert.match(rendered, /Por confirmar/); assert.ok(!rendered.includes('$0.00'));
  assert.equal(partial.purchaseReport, null); assert.equal(partial.purchaseDecision, undefined);
});

test('known immediate margin remains distinct from an incomplete monthly forecast', () => {
  const p = mapSupabaseRecord({ ...rows, profile: { ...rows.profile, current_balance: 2000 },
    incomeSources: [{ amount: 600, frequency: 'weekly', next_payment_date: '2026-11-01' }],
    commitments: [{ id: 'rent', title: 'Renta', amount: 500, next_due_date: '2026-11-04', frequency: 'monthly', is_confirmed: true }],
  }, now);
  const calculated = buildDeterministicEvaluation('Producto', 200, p);
  assert.equal(calculated.safeToSpend, 1100);
  assert.equal(calculated.projectionStatus, 'datos_incompletos');
  const rendered = content(Status({ evaluation: calculated }));
  assert.match(rendered, /Margen inmediato calculado/);
  assert.match(rendered, /Proyección de seis semanas incompleta/);
  assert.match(rendered, /fechas mensuales exactas/);
});

test('loading, failed connection and incomplete information have different visible states', () => {
  assert.equal(Status({ evaluation: null, loading: true }).props.role, 'status');
  assert.equal(Status({ evaluation: null, error: 'Servicio no disponible' }).props.role, 'alert');
  assert.match(content(Status({ evaluation: null, error: 'Servicio no disponible' })), /No se pudieron consultar/);
  assert.match(content(Status({ evaluation })), /Datos registrados disponibles/);
});

test('multiple incomes with an unknown date never claim that the next payment was identified', () => {
  const p = mapSupabaseRecord({ ...rows, incomeSources: [{ amount: 1500, frequency: 'weekly', next_payment_date: '2026-11-01' }, { amount: 500, frequency: 'monthly', next_payment_date: null }] }, now);
  assert.equal(p.nextPaydayDays, null);
  const reasons = getFinancialMissingInformation(p).join(' ');
  assert.ok(!reasons.includes('el margen usa el próximo pago confirmado'));
});

test('reload checks authenticated identity before stored demos and never replaces a signed-in account', async () => {
  let demoReads = 0;
  const mode = await resolveInitialProfileMode(async () => ({ data: { user: { id: 'owner-A' } }, error: null }), () => { demoReads++; return { id: 'demo' }; });
  assert.equal(mode.mode, 'account'); assert.equal(mode.userId, 'owner-A'); assert.equal(demoReads, 0);
  const anonymous = await resolveInitialProfileMode(async () => ({ data: { user: null }, error: { name: 'AuthSessionMissingError' } }), () => ({ id: 'demo' }));
  assert.equal(anonymous.mode, 'demo');
  await assert.rejects(resolveInitialProfileMode(async () => ({ data: { user: null }, error: Error('network') }), () => { throw Error('Must not restore demo after failed authentication'); }));
});

test('the existing plant still displays known balance while its margin is unavailable', () => {
  const contextFile = path.resolve('src/context/FinancialContext.tsx');
  require.cache[contextFile] = { id: contextFile, filename: contextFile, loaded: true, exports: { useFinancial: () => ({ profile: { goal: { targetAmount: 10000, currentSaved: 0 }, wisdomXp: 0 }, financialVersion: 'A', mode: 'authenticated' }) } };
  const Plant = require('../src/components/FinancialPlantWidget.tsx').default;
  const saved = Object.fromEntries(['useState', 'useEffect', 'useMemo'].map(key => [key, React[key]]));
  React.useState = initial => [initial, () => {}]; React.useEffect = () => {}; React.useMemo = compute => compute();
  try {
    const rendered = content(Plant({ financialEvaluation: evaluation }));
    assert.match(rendered, /Saldo.*5,500/); assert.match(rendered, /Margen financiero no disponible/);
    assert.match(rendered, /Reservas:.*200/);
  } finally { Object.assign(React, saved); }
});

test('a financial summary does not recommend a fictitious purchase and includes baseline projection risk', () => {
  const p = { id: 'A', lifeContext: [], currentBalance: 1300, safetyBuffer: 200, dailyEssentialBurn: 100,
    nextPaydayDays: 7, nextPaydayAmount: 600, payFrequency: 'semanal', commitments: [], debts: [], isOnboarded: true };
  const summary = buildDeterministicEvaluation('Resumen financiero', null, p);
  assert.equal(summary.summary, true); assert.equal(summary.purchaseReport, null); assert.equal(summary.purchaseDecision, undefined);
  assert.equal(summary.status, 'precaucion'); assert.equal(summary.badgeLabel, 'Riesgo en la proyección');
  assert.match(summary.headlineLine1, /semanas 6/); assert.ok(!summary.headlineLine1.includes('compra'));
  const normal = buildDeterministicEvaluation('Resumen financiero', null, { ...p, nextPaydayAmount: 1500 });
  assert.equal(normal.badgeLabel, 'Margen calculado');
});

test('clearing an unknown product price cannot revive a previous URL or session product price', () => {
  const { resolveEvaluationSelection } = require('../src/lib/finance/evaluationSelection.ts');
  const old = { name: 'Audífonos', price: 2300 };
  const cleared = resolveEvaluationSelection({ name: 'Laptop', price: 0 }, 'Audífonos', '2300', old);
  assert.equal(cleared.name, 'Laptop'); assert.equal(cleared.price, null);
  const query = resolveEvaluationSelection(null, 'Laptop', null, old);
  assert.equal(query.name, 'Laptop'); assert.equal(query.price, null);
  assert.equal(resolveEvaluationSelection(null, 'Laptop', '10.999', old).price, null);
  assert.deepEqual(resolveEvaluationSelection(null, null, null, old), old);
});
