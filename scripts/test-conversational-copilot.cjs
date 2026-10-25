// Opt-in real Gemini conversation on a synthetic partial profile. Never queries Supabase.
// Run through scripts/test.cjs for the repository's TypeScript loader; add --live explicitly.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { chatRequestSchema } = require('../src/lib/ai/schemas.ts');
const { interpretFinancialIntent, fallbackIntent, explainFinancialTool } = require('../src/lib/ai/financialAssistant.ts');
const {
  readConversation, effectiveConversationRequest, applyDialogueIntent, signConversation, userIncomeStatement,
} = require('../src/lib/ai/conversationState.ts');
const {
  executeConversationTool, selectConversationFollowUp, renderConversationFallback,
} = require('../src/lib/ai/financialConversation.ts');

const profile = {
  id: 'synthetic-partial-profile', lifeContext: [], currentBalance: 3000,
  safetyBuffer: 650, dailyEssentialBurn: 210, payFrequency: 'variable',
  nextPaydayDays: null, nextPaydayAmount: null, incomeSources: [],
  dataWarnings: ['income_sources_missing'], goals: [], commitments: [], debts: [], isOnboarded: true,
};
const cases = [
  { id: 'A', message: '¿Puedo comprar Metroid Ravenous por $1,449?', operation: 'purchase', price: 1449 },
  { id: 'A-follow-up', message: 'Sí, están actualizados', operation: 'confirmation', price: 1449 },
  { id: 'wait', message: '¿Y si espero dos semanas?', operation: 'wait', price: 1449, weeks: 2 },
  { id: 'E', message: '¿Y si el juego costara $900?', operation: 'purchase', price: 900 },
  { id: 'D', message: '¿Cuánto tendría que ahorrar para comprarlo en cuatro semanas?', operation: 'savings', price: 900, weeks: 4 },
  { id: 'C', message: '¿Qué debería priorizar este mes?', operation: 'priorities', price: 900 },
  { id: 'F', message: 'No tengo ingresos actualmente', operation: 'income_update', price: 900, incomeContext: 'none' },
  { id: 'G', message: 'Mis ingresos son variables', operation: 'income_update', price: 900, incomeContext: 'variable' },
];
const identity = 'synthetic-conversational-copilot';
const reportPath = path.resolve('docs/conversational-copilot-live-results.json');
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function safeError(error) {
  // Provider messages can contain sensitive transport details; retain allowlisted classifications only.
  const code = typeof error?.code === 'string' && /^[a-z_]+$/.test(error.code) ? error.code : 'live_failure';
  const status = Number.isInteger(error?.status) ? error.status : null;
  return { code, status };
}

function checksFor(scenario, intent, tool, state, reply, followUp, previousReply, originalProfile) {
  const checks = [];
  const check = (name, fn) => {
    try { fn(); checks.push({ name, passed: true }); }
    catch { checks.push({ name, passed: false }); }
  };
  check('operation_matches_current_question', () => assert.equal(intent.operation, scenario.operation));
  check('latest_confirmed_price_is_preserved', () => assert.equal(tool.product?.price, scenario.price));
  check('selected_product_is_preserved', () => assert.match(tool.product?.name ?? '', /metroid/i));
  check('partial_profile_is_read_only', () => assert.equal(JSON.stringify(profile), originalProfile));
  check('no_income_is_fabricated', () => {
    assert.equal(profile.nextPaydayAmount, null); assert.equal(profile.nextPaydayDays, null);
    assert.equal(profile.incomeSources.length, 0);
    assert.ok(!tool.cards.some(card => /ingreso|nomina|cobro/i.test(card.label)));
    assert.ok(!/\b(?:recibiras|cobraras|te llegara)\b/.test(normalize(reply)));
    if (tool.report) assert.equal(tool.report.purchase.safeToSpend, null);
    if (tool.savings) assert.equal(tool.savings.weeklyCapacity, null);
  });
  check('at_most_one_follow_up', () => assert.ok((reply.match(/\?/g) ?? []).length <= 1));
  if (previousReply) check('reply_does_not_repeat_previous_report', () => assert.notEqual(normalize(reply).trim(), normalize(previousReply).trim()));
  if (scenario.id === 'A') {
    check('accounting_balance_is_1551_not_safe_margin', () => {
      assert.equal(tool.hypotheticalBalance?.hypotheticalBalance, 1551);
      assert.equal(tool.report.purchase.safeToSpend, null);
      assert.equal(tool.report.purchase.assessment, 'no_evaluable');
    });
  }
  if (scenario.operation === 'confirmation') {
    check('confirmation_acknowledged_without_same_question', () => {
      assert.ok(tool.facts.some(fact => fact.id === 'dialogue.confirmed'));
      assert.ok(!/tus ingresos, vencimientos y gastos registrados estan actualizados/.test(normalize(reply)));
      assert.equal(tool.report, undefined);
      assert.ok(/gracias|confirm|perfecto|actualizad|entendido/.test(normalize(reply)));
    });
  }
  if (scenario.operation === 'wait') {
    check('requested_wait_is_two_weeks_without_projected_income', () => {
      assert.equal(intent.weeks, 2); assert.equal(tool.waitScenario?.requestedWeeks, 2);
      assert.equal(tool.waitScenario?.essentialExpensesDuringWait, 2940);
      assert.equal(tool.waitScenario?.projectedBalance, null);
      assert.equal(tool.waitScenario?.status, 'datos_incompletos');
    });
  }
  if (scenario.operation === 'savings') {
    check('four_week_savings_math_uses_latest_price', () => {
      assert.equal(intent.weeks, 4); assert.equal(tool.mathematicalSavings?.target, 900);
      assert.equal(tool.mathematicalSavings?.upfrontAmount, 0);
      assert.equal(tool.mathematicalSavings?.requiredWeeklyContribution, 225);
      assert.equal(tool.mathematicalSavings?.sustainability, 'sin_evaluar');
      assert.equal(tool.savings?.status, 'datos_incompletos');
      assert.ok(tool.facts.some(fact => fact.id === 'savings.capacity'));
    });
  }
  if (scenario.operation === 'priorities') {
    check('priorities_do_not_execute_purchase', () => {
      assert.equal(tool.report, undefined); assert.equal(tool.savings, undefined);
      assert.ok(tool.facts.some(fact => fact.id.startsWith('priorities.')));
      assert.ok(!tool.facts.some(fact => fact.id.startsWith('ahora.')));
    });
  }
  if (scenario.incomeContext) {
    check('income_statement_is_respected_without_new_payday_question', () => {
      assert.equal(state.incomeContext, scenario.incomeContext);
      assert.equal(tool.report, undefined); assert.equal(followUp, null);
      assert.ok(tool.facts.some(fact => fact.id === (scenario.incomeContext === 'none' ? 'dialogue.no_income' : 'dialogue.variable_income')));
      assert.ok(!/\b(?:tus ingresos son (?:fijos|semanales|quincenales)|cobras (?:cada|semanal|quincenal))\b/.test(normalize(reply)));
    });
  }
  return checks;
}

async function run(live) {
  if (live && (!process.env.GEMINI_API_KEY || !process.env.GEMINI_MODEL)) {
    console.error('SKIPPED: GEMINI_API_KEY and GEMINI_MODEL are required. No provider calls or live results were produced.');
    process.exitCode = 2; return;
  }
  const originalProfile = JSON.stringify(profile);
  let conversationToken;
  const results = [];
  for (const scenario of cases) {
    const request = chatRequestSchema.parse({ requestId: randomUUID(), message: scenario.message,
      history: [], product: null, mode: 'demo', demoProfileId: 'mateo', deterministicOnly: !live,
      ...(conversationToken ? { conversationToken } : {}),
    });
    const stored = readConversation(identity, request);
    const body = effectiveConversationRequest(request, stored);
    const state = { ...stored, incomeContext: userIncomeStatement(body.message) ?? stored.incomeContext };
    const signal = AbortSignal.timeout(50_000);
    const errors = [];
    let intent = fallbackIntent(body);
    let intentSource = 'deterministic';
    if (live) {
      try { intent = await interpretFinancialIntent(body, signal, state); intentSource = 'gemini'; }
      catch (error) { errors.push({ stage: 'intent', ...safeError(error) }); }
    }
    intent = applyDialogueIntent(intent, body, state);
    const tool = executeConversationTool(profile, intent, state, '2026-10-25');
    let followUp = selectConversationFollowUp(tool, state, profile);
    let reply = renderConversationFallback(tool, followUp);
    let source = 'deterministic';
    let quality = null;
    if (live && !errors.length) {
      try {
        const answer = await explainFinancialTool(tool, signal, {
          question: body.message, history: body.history, previousReply: state.previousReply,
          previousQuestion: state.previousQuestion, incomeContext: state.incomeContext,
          acknowledgement: tool.operation === 'confirmation'
            ? 'Reconoce la confirmación del usuario y distingue datos actualizados de datos completos. No repitas la pregunta anterior.'
            : tool.operation === 'income_update' ? 'Reconoce la declaración de ingresos sin guardar ni inventar movimientos.' : undefined,
          suggestedFollowUp: followUp,
        });
        reply = answer.reply; followUp = answer.followUp; quality = answer.quality; source = 'gemini';
      } catch (error) { errors.push({ stage: 'explanation', ...safeError(error) }); }
    }
    const checks = checksFor(scenario, intent, tool, state, reply, followUp, state.previousReply, originalProfile);
    conversationToken = signConversation(state, body, tool, reply, followUp);
    const restored = readConversation(identity, { ...request, conversationToken });
    checks.push({ name: 'signed_context_preserves_latest_price', passed: restored.product?.price === scenario.price });
    if (scenario.incomeContext) checks.push({ name: 'signed_context_preserves_income_statement', passed: restored.incomeContext === scenario.incomeContext });
    const approved = checks.every(check => check.passed) && (!live || source === 'gemini' && intentSource === 'gemini' && quality?.verdict === 'aprobada');
    results.push({ case: scenario.id, question: scenario.message, expectedOperation: scenario.operation,
      intentSource, source, fallback: live && source === 'deterministic', passed: approved, intent, reply, followUp,
      product: tool.product, cards: tool.cards, mathematicalSavings: tool.mathematicalSavings ?? null,
      hypotheticalBalance: tool.hypotheticalBalance ?? null, waitScenario: tool.waitScenario ?? null,
      incomeContext: restored.incomeContext, quality, checks, errors,
    });
    console.log(`${live ? 'LIVE' : 'OFFLINE CONTRACT'} ${scenario.id}: ${approved ? 'PASSED' : 'FAILED'} (intent=${intentSource}, reply=${source})`);
    for (const check of checks.filter(check => !check.passed)) console.log(`  Failed check: ${check.name}`);
    if (live && errors.some(error => error.code !== 'gemini_consistency' && error.code !== 'gemini_arguments' && error.code !== 'gemini_validation')) {
      // Stop on an outage, timeout or quota failure instead of repeating the remaining provider requests.
      break;
    }
  }
  const approved = results.filter(result => result.passed).length;
  if (live) {
    const report = { evaluatedAt: new Date().toISOString(), model: process.env.GEMINI_MODEL,
      syntheticDataOnly: true, supabaseRead: false, databaseWrites: false, liveProvider: 'Gemini',
      expectedTurns: cases.length, executedTurns: results.length, approvedTurns: approved,
      unexecutedCases: cases.slice(results.length).map(scenario => scenario.id),
      budget: { maximumTurns: 8, structuredCallsPerTurn: 2, maximumTransportAttemptsPerStructuredCall: 2 },
      syntheticProfile: profile, results,
    };
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`Live Gemini: ${approved}/${cases.length} turns approved; results saved to docs/conversational-copilot-live-results.json.`);
  } else {
    console.log(`Offline loader/contracts: ${approved}/${cases.length} passed. No provider calls; no live results file written.`);
  }
  if (approved !== cases.length) process.exitCode = 1;
}

run(process.argv.includes('--live')).catch(error => {
  console.error(`Conversation runner failed (${safeError(error).code}); no provider messages or credentials logged.`);
  process.exitCode = 1;
});
