const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const purchaseReport = require('../src/lib/onboarding/purchaseReport.ts');
const originalBuildReport = purchaseReport.buildPurchaseReport;
let reportCalls = 0;
purchaseReport.buildPurchaseReport = (...args) => { reportCalls++; return originalBuildReport(...args); };
const {
  executeConversationTool, renderConversationFallback, selectConversationFollowUp,
} = require('../src/lib/ai/financialConversation.ts');
const {
  applyDialogueIntent, effectiveConversationRequest, isConfirmation, readConversation,
  signConversation, userIncomeStatement,
} = require('../src/lib/ai/conversationState.ts');
const { fallbackIntent } = require('../src/lib/ai/financialAssistant.ts');
const { sebasProfile, sebasScenarios } = require('../src/lib/ai/scenarios.ts');

const game = { name: 'Metroid Ravenous', price: 1449 };
const partial = {
  id: 'partial-copilot', lifeContext: [], currentBalance: 3000, safetyBuffer: 650,
  dailyEssentialBurn: 210, nextPaydayAmount: null, nextPaydayDays: null,
  payFrequency: 'variable', incomeSources: [], dataWarnings: ['income_sources_missing'],
  commitments: [], debts: [], isOnboarded: true,
};
const intent = (operation, params = {}) => ({
  operation, productName: null, price: null, alternativePrice: null, weeks: null,
  weeklyContribution: null, upfrontAmount: null, reserveAmount: null, goalQuery: null,
  ...params,
});
const request = (message, params = {}) => ({
  requestId: randomUUID(), message, history: [], product: game,
  mode: 'account', deterministicOnly: true, ...params,
});
const initialState = (params = {}) => ({ ...readConversation(randomUUID(), request('Nueva conversación')), ...params });
const text = tool => tool.facts.map(fact => fact.text).join('\n\n');
const cardValue = (tool, label) => tool.cards.find(card => card.label === label)?.value;
function deepFreeze(value) {
  Object.freeze(value);
  for (const child of Object.values(value)) if (child && typeof child === 'object') deepFreeze(child);
  return value;
}

test('A: partial purchase uses the selected real price and preserves accounting balance without inventing a margin', () => {
  reportCalls = 0;
  const profile = deepFreeze(structuredClone(partial));
  const tool = executeConversationTool(profile, intent('purchase'), initialState());
  assert.equal(reportCalls, 1);
  assert.equal(tool.report.purchase.purchaseAmount, 1449);
  assert.equal(tool.report.purchase.assessment, 'no_evaluable');
  assert.equal(tool.report.purchase.safeToSpend, null);
  assert.equal(tool.hypotheticalBalance.hypotheticalBalance, 1551);
  assert.equal(cardValue(tool, 'Saldo registrado'), 3000);
  assert.equal(cardValue(tool, 'Reserva registrada'), 650);
  assert.equal(cardValue(tool, 'Saldo contable hipotético'), 1551);
  assert.ok(!tool.cards.some(card => /libre|margen/i.test(card.label)));
  assert.match(tool.facts.find(fact => fact.id === 'purchase.accounting').text, /no es dinero libre ni confirma la conveniencia de comprar/);
  assert.equal(profile.currentBalance, 3000);
});

test('A follow-up: a signed confirmation acknowledges updated data without rebuilding or repeating the purchase', () => {
  const identity = randomUUID();
  const firstRequest = request('¿Puedo comprar Metroid Ravenous por $1,449?');
  const firstState = readConversation(identity, firstRequest);
  const firstTool = executeConversationTool(partial, intent('purchase'), firstState);
  const followUp = selectConversationFollowUp(firstTool, firstState, partial);
  const firstReply = renderConversationFallback(firstTool, followUp);
  const token = signConversation(firstState, firstRequest, firstTool, firstReply, followUp);
  const secondRequest = request('Sí, están actualizados', { conversationToken: token });
  const secondState = readConversation(identity, secondRequest);
  const interpreted = applyDialogueIntent(intent('purchase'), secondRequest, secondState);
  reportCalls = 0;
  const tool = executeConversationTool(partial, interpreted, secondState);
  const nextQuestion = selectConversationFollowUp(tool, secondState, partial);
  const reply = renderConversationFallback(tool, nextQuestion);
  assert.equal(interpreted.operation, 'confirmation');
  assert.equal(reportCalls, 0);
  assert.equal(tool.report, undefined);
  assert.deepEqual(tool.cards, []);
  assert.deepEqual(tool.facts.map(fact => fact.id), ['dialogue.confirmed', 'dialogue.missing']);
  assert.match(reply, /Gracias por confirmarlo/);
  assert.match(reply, /actualizados.*pueden faltar campos necesarios/);
  assert.notEqual(reply, firstReply);
  assert.equal(nextQuestion, null);
  assert.doesNotMatch(reply, /\$|Saldo registrado|Reserva registrada|gasto.*210|¿.*actualizados/i);
});

test('B: available money with partial data exposes the three known inputs and never invents a purchase', () => {
  reportCalls = 0;
  const tool = executeConversationTool(partial, intent('available'), initialState());
  assert.equal(reportCalls, 0);
  assert.equal(tool.report, undefined);
  assert.deepEqual(tool.product, game);
  assert.equal(cardValue(tool, 'Saldo registrado'), 3000);
  assert.equal(cardValue(tool, 'Reserva registrada'), 650);
  assert.equal(cardValue(tool, 'Gasto esencial diario'), 210);
  assert.equal(cardValue(tool, 'Dinero libre estimado'), undefined);
  assert.match(text(tool), /fuentes de ingreso activas.*próximo pago/);
});

test('C: priorities consult actual obligations and missing dates without building a purchase report', () => {
  reportCalls = 0;
  const profile = deepFreeze({
    ...structuredClone(partial),
    commitments: [{ id: 'rent', title: 'Renta registrada', amount: 400, dueInDays: 5,
      frequency: 'unico', category: 'Vivienda', kind: 'esencial', isConfirmed: true }],
    debts: [{ id: 'debt', title: 'Pago mínimo pendiente de fecha', nextPayment: 100,
      totalBalance: 1000, dueInDays: null, frequency: 'unico' }],
  });
  const tool = executeConversationTool(profile, intent('priorities'), initialState());
  assert.equal(reportCalls, 0);
  assert.equal(tool.report, undefined);
  assert.match(tool.facts.find(fact => fact.id === 'priority.0').text, /Renta registrada/);
  assert.match(text(tool), /vencimientos sin confirmar/);
  assert.doesNotMatch(text(tool), /puedes comprar|compra.*dentro.*margen/i);
  assert.equal(cardValue(tool, 'Gasto esencial diario registrado'), 210);
  assert.equal(cardValue(tool, 'Reserva de seguridad registrada'), 650);
  assert.equal(selectConversationFollowUp(tool, initialState(), profile).kind, 'priority');
});

test('D: four weeks computes 362.25 mathematically while sustainable saving capacity remains unknown', () => {
  reportCalls = 0;
  const state = initialState();
  const req = request('¿Cuánto tendría que ahorrar para comprarlo en cuatro semanas?');
  const interpreted = applyDialogueIntent(fallbackIntent(req), req, state);
  assert.equal(interpreted.operation, 'savings');
  assert.equal(interpreted.weeks, 4);
  const tool = executeConversationTool(deepFreeze(structuredClone(partial)), interpreted, state);
  assert.equal(reportCalls, 0);
  assert.equal(tool.report, undefined);
  assert.equal(tool.mathematicalSavings.target, 1449);
  assert.equal(tool.mathematicalSavings.upfrontAmount, 0);
  assert.equal(tool.mathematicalSavings.requiredWeeklyContribution, 362.25);
  assert.equal(tool.mathematicalSavings.sustainability, 'sin_evaluar');
  assert.equal(tool.savings.status, 'datos_incompletos');
  assert.equal(tool.savings.weeklyCapacity, null);
  assert.equal(cardValue(tool, 'Objetivo semanal matemático'), 362.25);
  assert.equal(cardValue(tool, 'Capacidad semanal comprobada'), undefined);
  assert.match(tool.facts.find(fact => fact.id === 'savings.capacity').text, /no se ha comprobado.*sin afectar tus gastos/);
});

test('explicit waiting retains the product and calculates only known essentials when future income is unknown', () => {
  reportCalls = 0;
  const state = initialState();
  const req = request('¿Y si espero dos semanas?');
  const interpreted = applyDialogueIntent(fallbackIntent(req), req, state);
  assert.equal(interpreted.operation, 'wait');
  assert.equal(interpreted.weeks, 2);
  const tool = executeConversationTool(deepFreeze(structuredClone(partial)), interpreted, state);
  assert.equal(reportCalls, 0);
  assert.equal(tool.report, undefined);
  assert.equal(tool.waitScenario.purchaseAmount, 1449);
  assert.equal(tool.waitScenario.requestedDays, 14);
  assert.equal(tool.waitScenario.essentialExpensesDuringWait, 2940);
  assert.equal(tool.waitScenario.projectedBalance, null);
  assert.equal(tool.waitScenario.hypotheticalBalanceAfterPurchase, null);
  assert.equal(cardValue(tool, 'Gasto esencial durante la espera'), 2940);
  assert.ok(!tool.cards.some(card => /Saldo/.test(card.label)));
  assert.match(tool.facts.find(fact => fact.id === 'wait.essentials').text, /no una proyección completa del saldo/);
});

test('E: a new explicit price updates the same product and subsequent savings use the latest price', () => {
  const identity = randomUUID();
  const req = request('¿Y si el juego costara $900?');
  const state = readConversation(identity, req);
  const tool = executeConversationTool(partial, intent('purchase', { price: 900 }), state);
  assert.deepEqual(tool.product, { name: game.name, price: 900 });
  assert.equal(tool.report.purchase.purchaseAmount, 900);
  assert.equal(tool.hypotheticalBalance.hypotheticalBalance, 2100);
  const token = signConversation(state, req, tool, renderConversationFallback(tool, null), null);
  const next = request('¿Cuánto tendría que ahorrar para comprarlo en cuatro semanas?', { conversationToken: token });
  const remembered = readConversation(identity, next);
  const effective = effectiveConversationRequest(next, remembered);
  const interpreted = applyDialogueIntent(fallbackIntent(effective), effective, remembered);
  const savings = executeConversationTool(partial, interpreted, remembered);
  assert.deepEqual(effective.product, { name: game.name, price: 900 });
  assert.equal(savings.mathematicalSavings.target, 900);
  assert.equal(savings.mathematicalSavings.requiredWeeklyContribution, 225);
});

test('F and G: no-income and variable-income declarations are acknowledged and never assigned a payroll', () => {
  for (const [message, context, factId] of [
    ['No tengo ingresos actualmente', 'none', 'dialogue.no_income'],
    ['Mis ingresos son variables', 'variable', 'dialogue.variable_income'],
  ]) {
    const identity = randomUUID();
    const req = request(message);
    const previous = readConversation(identity, req);
    const state = { ...previous, incomeContext: userIncomeStatement(message) };
    const interpreted = applyDialogueIntent(intent('purchase', { price: 1449 }), req, state);
    reportCalls = 0;
    const profile = deepFreeze(structuredClone(partial));
    const tool = executeConversationTool(profile, interpreted, state);
    assert.equal(interpreted.operation, 'income_update');
    assert.equal(interpreted.incomeStatement, context);
    assert.equal(interpreted.price, null);
    assert.equal(reportCalls, 0);
    assert.equal(tool.report, undefined);
    assert.equal(tool.facts[0].id, factId);
    assert.equal(selectConversationFollowUp(tool, state, profile), null);
    assert.match(text(tool), /no asumiré/i);
    assert.equal(profile.nextPaydayAmount, null);
    assert.equal(profile.nextPaydayDays, null);
    const token = signConversation(state, req, tool, renderConversationFallback(tool, null), null);
    const followRequest = request('¿Puedo comprarlo?', { conversationToken: token });
    const remembered = readConversation(identity, followRequest);
    assert.equal(remembered.incomeContext, context);
    const nextTool = executeConversationTool(profile, intent('purchase'), remembered);
    assert.equal(nextTool.report.purchase.safeToSpend, null);
    assert.equal(selectConversationFollowUp(nextTool, remembered, profile), null);
    assert.doesNotMatch(text(nextTool), /(?:recibirás|cobrarás|recibes) .*?(?:semanal|quincenal|nómina)/i);
  }
});

test('H: a signed conversation is scoped to the account and a new account starts without its remembered context', () => {
  const identity = randomUUID();
  const req = request('No tengo ingresos actualmente');
  const state = readConversation(identity, req);
  const interpreted = applyDialogueIntent(intent('purchase'), req, state);
  const tool = executeConversationTool(partial, interpreted, state);
  const token = signConversation(state, req, tool, renderConversationFallback(tool, null), null);
  const otherIdentity = randomUUID();
  assert.throws(() => readConversation(otherIdentity, request('¿Y si espero?', { conversationToken: token })),
    error => error.code === 'conversation_changed');
  const fresh = readConversation(otherIdentity, request('Nueva conversación', { product: null }));
  assert.equal(fresh.product, null);
  assert.equal(fresh.incomeContext, 'unknown');
  assert.deepEqual(fresh.userTurns, []);
});

test('J: a calculable immediate margin survives an incomplete future projection as a distinct result', () => {
  const profile = deepFreeze(structuredClone(sebasScenarios[9].profile));
  const state = initialState({ product: { name: 'Producto', price: 200 } });
  const tool = executeConversationTool(profile, intent('purchase'), state);
  assert.equal(tool.report.status, 'datos_incompletos');
  assert.equal(tool.report.purchase.safeToSpend, 1100);
  assert.equal(tool.report.purchase.remainingSafeToSpend, 900);
  assert.equal(tool.report.projectionAfter.status, 'datos_incompletos');
  assert.match(tool.facts.find(fact => fact.id === 'ahora.assessment').text, /dentro.*margen/i);
  assert.match(tool.facts.find(fact => fact.id === 'ahora.incomplete').text, /margen inmediato.*conocido.*proyección futura.*incompleta/);
  reportCalls = 0;
  const available = executeConversationTool(profile, intent('available'), state);
  assert.equal(reportCalls, 0);
  assert.equal(available.report, undefined);
  assert.equal(cardValue(available, 'Dinero libre estimado'), 1100);
  assert.match(available.facts.find(fact => fact.id === 'overview.incomplete').text, /proyección futura está incompleta/);
});

test('a conditional savings scenario is not mistaken for an affirmative confirmation', () => {
  const state = initialState();
  const req = request('Si ahorro $250 semanales');
  assert.equal(isConfirmation(req.message), false);
  const interpreted = applyDialogueIntent(fallbackIntent(req), req, state);
  assert.equal(interpreted.operation, 'savings');
  assert.equal(interpreted.weeklyContribution, 250);
  const tool = executeConversationTool(partial, interpreted, state);
  assert.equal(tool.mathematicalSavings.weeklyContribution, 250);
  assert.equal(tool.mathematicalSavings.estimatedWeeks, 6);
  assert.equal(tool.report, undefined);
});

test('critical liquidity risk remains present when a computed immediate margin permits the purchase', () => {
  const tool = executeConversationTool(deepFreeze(structuredClone(sebasProfile)), intent('purchase'),
    initialState({ product: { name: 'Producto', price: 700 } }));
  assert.equal(tool.report.purchase.assessment, 'dentro_del_margen');
  assert.equal(tool.report.purchase.remainingSafeToSpend, 400);
  assert.equal(tool.report.projectionAfter.lowestBalance, 100);
  assert.match(tool.facts.find(fact => fact.id === 'ahora.risk').text, /semanas 6/);
  assert.match(renderConversationFallback(tool, null), /riesgo.*semanas 6/);
});

for (const incomeContext of ['none', 'variable']) {
  const fixedProfile = () => deepFreeze({ ...structuredClone(sebasProfile), nextPaydayAmount: 2000 });

  test(`contradicted fixed income (${incomeContext}): available preserves registered inputs and withholds a spending margin`, () => {
    const profile = fixedProfile();
    const before = JSON.stringify(profile);
    const state = initialState({ incomeContext });
    const baseline = executeConversationTool(profile, intent('available'), initialState());
    assert.equal(cardValue(baseline, 'Dinero libre estimado'), 1100);
    const tool = executeConversationTool(profile, intent('available'), state);
    assert.equal(tool.marginStatus, 'unknown');
    assert.equal(tool.report, undefined);
    assert.equal(cardValue(tool, 'Dinero libre estimado'), undefined);
    assert.ok(!tool.cards.some(card => /margen/i.test(card.label)));
    assert.equal(cardValue(tool, 'Saldo registrado'), 2000);
    assert.equal(cardValue(tool, 'Reserva registrada'), 200);
    assert.equal(cardValue(tool, 'Gasto esencial diario'), 100);
    assert.match(text(tool), /margen.*sin poder calcularse/);
    assert.doesNotMatch(text(tool), /Tu margen inmediato estimado es/);
    assert.equal(selectConversationFollowUp(tool, state, profile), null);
    assert.equal(JSON.stringify(profile), before);
  });

  test(`contradicted fixed income (${incomeContext}): savings keeps arithmetic but exposes no verified capacity or funded completion date`, () => {
    const profile = fixedProfile();
    const before = JSON.stringify(profile);
    const savingsIntent = intent('savings', { weeks: 4 });
    const baseline = executeConversationTool(profile, savingsIntent, initialState(), '2026-10-25');
    assert.equal(baseline.savings.status, 'calculado');
    assert.ok(baseline.savings.weeklyCapacity > 0);
    const tool = executeConversationTool(profile, savingsIntent, initialState({ incomeContext }), '2026-10-25');
    assert.equal(tool.mathematicalSavings.requiredWeeklyContribution, 362.25);
    assert.equal(tool.mathematicalSavings.sustainability, 'sin_evaluar');
    assert.equal(cardValue(tool, 'Capacidad semanal comprobada'), undefined);
    assert.equal(tool.savings?.weeklyCapacity ?? null, null);
    assert.notEqual(tool.savings?.status, 'calculado');
    assert.equal(tool.savings?.estimatedDate ?? null, null);
    assert.doesNotMatch(text(tool), /La capacidad semanal comprobada (?:bajo las condiciones del motor )?es/);
    assert.doesNotMatch(text(tool), /el escenario cabe dentro de ella/);
    assert.equal(JSON.stringify(profile), before);
  });

  test(`contradicted fixed income (${incomeContext}): waiting has no projected balance in either data or visible facts/cards`, () => {
    const profile = fixedProfile();
    const before = JSON.stringify(profile);
    const waitIntent = intent('wait', { weeks: 2 });
    const baseline = executeConversationTool(profile, waitIntent, initialState());
    assert.equal(baseline.waitScenario.projectedBalance, 3600);
    assert.equal(baseline.waitScenario.hypotheticalBalanceAfterPurchase, 2151);
    const tool = executeConversationTool(profile, waitIntent, initialState({ incomeContext }));
    assert.equal(cardValue(tool, 'Gasto esencial durante la espera'), 1400);
    assert.ok(!tool.cards.some(card => /Saldo/.test(card.label)));
    assert.equal(tool.waitScenario?.projectedBalance ?? null, null);
    assert.equal(tool.waitScenario?.hypotheticalBalanceAfterPurchase ?? null, null);
    assert.notEqual(tool.waitScenario?.status, 'calculado');
    assert.ok(tool.facts.some(fact => fact.id === 'wait.unknown'));
    assert.ok(!tool.facts.some(fact => fact.id === 'wait.result'));
    assert.doesNotMatch(text(tool), /estima un saldo de/);
    assert.equal(JSON.stringify(profile), before);
  });

  test(`contradicted fixed income (${incomeContext}): adding a reserve cannot claim a verified favorable margin`, () => {
    const profile = fixedProfile();
    const before = JSON.stringify(profile);
    const reserveIntent = intent('reserve', { reserveAmount: 300 });
    const baseline = executeConversationTool(profile, reserveIntent, initialState());
    assert.equal(cardValue(baseline, 'Margen al añadir la reserva'), 800);
    const tool = executeConversationTool(profile, reserveIntent, initialState({ incomeContext }));
    assert.equal(tool.marginStatus, 'unknown');
    assert.equal(tool.report, undefined);
    assert.equal(cardValue(tool, 'Margen al añadir la reserva'), undefined);
    assert.ok(!tool.cards.some(card => /margen|dinero libre/i.test(card.label)));
    assert.doesNotMatch(text(tool), /margen estimado sería/);
    assert.equal(JSON.stringify(profile), before);
  });
}

test('a repeated confirmation does not ask income type again after the awaiting flag was cleared', () => {
  const state = initialState({ awaiting: 'none', askedTopics: [], previousQuestion: '' });
  const tool = executeConversationTool(partial, intent('confirmation'), state);
  const firstQuestion = selectConversationFollowUp(tool, state, partial);
  assert.equal(firstQuestion.kind, 'income_type');
  const remembered = { ...state, awaiting: 'none', askedTopics: ['income_type'], previousQuestion: '' };
  const nextQuestion = selectConversationFollowUp(tool, remembered, partial);
  assert.equal(nextQuestion, null);
  assert.doesNotMatch(renderConversationFallback(tool, nextQuestion), /[¿?]/);
});

test('priority and horizon follow-ups do not repeat the previous question in deterministic fallback', () => {
  const unknownDueProfile = deepFreeze({
    ...structuredClone(partial),
    commitments: [{ id: 'unknown-date', title: 'Pago registrado', amount: 400, dueInDays: null,
      frequency: 'unico', category: 'Vivienda', kind: 'esencial', isConfirmed: true }],
  });
  for (const [operation, profile, kind] of [
    ['priorities', unknownDueProfile, 'priority'],
    ['savings', partial, 'horizon'],
    ['wait', partial, 'horizon'],
  ]) {
    const state = initialState({ previousQuestion: '' });
    const tool = executeConversationTool(profile, intent(operation), state);
    const firstQuestion = selectConversationFollowUp(tool, state, profile);
    assert.equal(firstQuestion.kind, kind);
    const repeated = selectConversationFollowUp(tool, { ...state, previousQuestion: firstQuestion.text }, profile);
    assert.equal(repeated, null);
    const fallback = renderConversationFallback(tool, repeated);
    assert.doesNotMatch(fallback, /[¿?]/);
    assert.ok(!fallback.includes(firstQuestion.text));
  }
});
