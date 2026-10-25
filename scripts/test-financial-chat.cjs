// Opt-in real Gemini evaluation. Uses only Sebas' synthetic fixtures, never Supabase accounts.
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { sebasScenarios, conversationScenarios } = require('../src/lib/ai/scenarios.ts');
const { interpretFinancialIntent, explainFinancialTool } = require('../src/lib/ai/financialAssistant.ts');
const { executeFinancialTool } = require('../src/lib/ai/financialTools.ts');

async function main() {
  if (!process.env.GEMINI_API_KEY || !process.env.GEMINI_MODEL) {
    console.error('SKIPPED: GEMINI_API_KEY and GEMINI_MODEL are required. No live responses were validated.');
    process.exitCode = 2; return;
  }
  const conversation = process.argv.includes('--conversation');
  const scenarios = conversation ? conversationScenarios : sebasScenarios;
  const reportPath = conversation ? 'docs/financial-chat-conversation-live-results.json' : 'docs/financial-chat-live-results.json';
  let results = [];
  if (process.argv.includes('--resume') && fs.existsSync(reportPath)) {
    const previous = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    if (previous.model === process.env.GEMINI_MODEL && previous.syntheticDataOnly) results = previous.results.filter(r => r.quality?.verdict === 'aprobada');
  }
  for (const scenario of scenarios) {
    if (results.some(r => r.case === scenario.caseNumber)) continue;
    try {
      const request = { requestId: randomUUID(), message: scenario.message ?? `¿Me conviene comprar un producto de $${scenario.price} MXN?`, history: [],
        product: scenario.product ?? null, mode: 'demo', demoProfileId: 'mateo', deterministicOnly: false };
      const signal = AbortSignal.timeout(50_000);
      const intent = await interpretFinancialIntent(request, signal);
      if (intent.operation !== (scenario.operation ?? 'purchase')) throw Object.assign(Error(), { code: 'wrong_intent' });
      const tool = executeFinancialTool(scenario.profile, intent, request.product);
      const expectedPrice = scenario.expectedPrice === undefined ? scenario.price : scenario.expectedPrice;
      if (expectedPrice !== null && tool.product?.price !== expectedPrice) throw Object.assign(Error(), { code: 'wrong_intent' });
      if (scenario.caseNumber === 'C' && (intent.weeks !== 4 || tool.savings.weeklyContribution !== 225)) throw Object.assign(Error(), { code: 'wrong_savings_plan' });
      const answer = await explainFinancialTool(tool, signal);
      results.push({ case: scenario.caseNumber, source: 'live-gemini', intent, ...answer });
      console.log(`LIVE case ${scenario.caseNumber}: ${answer.quality.score}/10 ${answer.quality.verdict}`);
    } catch (error) {
      results.push({ case: scenario.caseNumber, source: 'live-gemini', error: error.code || 'live_failure', status: error.status || null });
      console.error(`LIVE case ${scenario.caseNumber}: FAILED (${error.code || 'live_failure'})`);
      // Stop after a transport failure; do not spend the remaining budget on the same outage.
      if (error.code !== 'gemini_consistency' && error.code !== 'wrong_intent' && error.code !== 'gemini_arguments') break;
    }
  }
  results.sort((a, b) => String(a.case).localeCompare(String(b.case), undefined, { numeric: true }));
  const report = { evaluatedAt: new Date().toISOString(), model: process.env.GEMINI_MODEL, syntheticDataOnly: true,
    expectedCases: scenarios.length, completedCases: results.length, approved: results.filter(r => r.quality?.verdict === 'aprobada').length, results };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(`Live Gemini: ${report.approved}/${scenarios.length} approved; ${scenarios.length - report.completedCases} not executed.`);
  if (report.approved !== scenarios.length) process.exitCode = 1;
}
main().catch(() => { console.error('Live runner failed; no account data or provider details logged.'); process.exitCode = 1; });
