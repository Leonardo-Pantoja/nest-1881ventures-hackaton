const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const ts = require('typescript');
const account = require('../src/lib/finance/accountSnapshot.ts');
const server = require('../src/lib/supabase/server.ts');
const gemini = require('../src/lib/ai/gemini.ts');
const engine = require('../src/lib/onboarding/purchaseReport.ts');
const { fallbackIntent, validateIntentArguments } = require('../src/lib/ai/financialAssistant.ts');
const { executeFinancialTool } = require('../src/lib/ai/financialTools.ts');
const { sebasProfile } = require('../src/lib/ai/scenarios.ts');
const profile = { ...sebasProfile, currentBalance: 10000, nextPaydayAmount: 2000 };
let identity = randomUUID(), reportPrices = [], failSnapshot = false, nextIntent;
const originalReport = engine.buildPurchaseReport;
engine.buildPurchaseReport = (p, amount) => { reportPrices.push(amount); return originalReport(p, amount); };
server.createServerSupabaseClient = async () => ({ auth: { getUser: async () => ({ data: { user: { id: identity } }, error: null }) } });
account.loadAccountSnapshot = async () => {
  if (failSnapshot) throw new account.EvaluationRequestError('Financial connection unavailable', 503, 'financial_data_unavailable');
  return { userId: identity, revision: 'server-revision', raw: { financialDate: '2026-10-25' }, profile: { ...profile, id: identity } };
};
gemini.generateStructured = async options => options.source === 'chat-intent' ? nextIntent : {
  factIds: JSON.parse(options.prompt).facts.map(f => f.id), followUp: 'price',
};
const evaluate = require('../src/app/api/evaluate/route.ts').POST;
const chat = require('../src/app/api/ai/chat/route.ts').POST;
const request = (path, body) => new Request(`https://app.test${path}`, { method: 'POST', headers: { origin: 'https://app.test', 'content-type': 'application/json' }, body: JSON.stringify(body) });
const intent = params => ({ operation: 'purchase', productName: null, price: null, alternativePrice: null, weeks: null,
  weeklyContribution: null, upfrontAmount: null, reserveAmount: null, goalQuery: null, ...params });
const chatBody = params => ({ requestId: randomUUID(), message: '¿Puedo comprar una laptop?', product: null, ...params });
const reset = () => { identity = randomUUID(); reportPrices = []; failSnapshot = false; nextIntent = intent({ productName: 'laptop' }); };

test('evaluate: laptop without a price requests its price and never builds a report', async () => {
  reset();
  const response = await evaluate(request('/api/evaluate', { userQuestion: '¿Puedo comprar una laptop?' }));
  assert.equal(response.status, 200);
  const value = await response.json();
  assert.equal(value.needsPrice, true); assert.equal(value.pendingProductName, 'laptop');
  assert.equal(value.purchaseReport, null); assert.deepEqual(reportPrices, []);
  assert.match(value.chatReply, /laptop.*cuánto cuesta/i);
  assert.equal(value.consideredExpenses.currentBalance, 10000);
});

test('evaluate: a general financial question uses safe-to-spend without creating a purchase, even with a product selected', async () => {
  reset();
  const response = await evaluate(request('/api/evaluate', { itemName: 'Audífonos', itemPrice: 2300, userQuestion: '¿Cuánto dinero puedo gastar hoy?' }));
  assert.equal(response.status, 200);
  const value = await response.json();
  assert.equal(value.safeToSpend, 9100); assert.equal(value.purchaseReport, null);
  assert.deepEqual(reportPrices, []); assert.match(value.chatReply, /margen/);
});

test('evaluate: explicit purchase and referenced alternative use exactly 2300 and 1800', async () => {
  reset();
  let response = await evaluate(request('/api/evaluate', { userQuestion: 'Quiero unos audífonos de $2,300.' }));
  let value = await response.json();
  assert.equal(response.status, 200); assert.equal(value.detectedItemPrice, 2300);
  assert.ok(reportPrices.length); assert.ok(reportPrices.every(price => price === 2300));
  reportPrices = [];
  response = await evaluate(request('/api/evaluate', { itemName: 'Audífonos', itemPrice: 2300, userQuestion: '¿Y si compro uno de $1,800?' }));
  value = await response.json();
  assert.equal(value.detectedItemName, 'Audífonos'); assert.equal(value.detectedItemPrice, 1800);
  assert.ok(reportPrices.every(price => price === 1800));
});

test('evaluate: another product without price cannot inherit an old price or the legacy generic placeholder', async () => {
  reset();
  for (const data of [
    { itemName: 'Audífonos', itemPrice: 2300 },
    { itemName: 'Producto consultado', itemPrice: 500 },
  ]) {
    const value = await (await evaluate(request('/api/evaluate', { ...data, userQuestion: '¿Puedo comprar una laptop?' }))).json();
    assert.equal(value.purchaseReport, null); assert.equal(value.needsPrice, true);
    assert.equal(value.pendingProductName, 'laptop');
  }
  assert.deepEqual(reportPrices, []);
});

test('evaluate: normal hook and summary contracts survive; invalid prices never reach the engine', async () => {
  reset();
  const normal = await (await evaluate(request('/api/evaluate', { itemName: 'Audífonos', itemPrice: 2300, mode: 'account' }))).json();
  assert.equal(normal.source, 'deterministic'); assert.equal(normal.purchaseReport.purchase.purchaseAmount, 2300);
  reportPrices = [];
  const summary = await (await evaluate(request('/api/evaluate', { itemName: 'Resumen financiero', itemPrice: null, summary: true, mode: 'account' }))).json();
  assert.equal(summary.purchaseReport, null); assert.equal(summary.safeToSpend, 9100);
  for (const price of [0, -1, 0.001, 10.999, '2300']) {
    assert.equal((await evaluate(request('/api/evaluate', { itemName: 'Producto', itemPrice: price }))).status, 400);
  }
  assert.deepEqual(reportPrices, []);
});

test('evaluate: authenticated data wins over browser financialContext; failures remain failures', async () => {
  reset();
  const body = { userQuestion: '¿Cuánto puedo gastar?', financialContext: { currentBalance: 999999, safeToSpend: 888888 }, user_id: 'other-account' };
  const value = await (await evaluate(request('/api/evaluate', body))).json();
  assert.equal(value.consideredExpenses.currentBalance, 10000); assert.equal(value.safeToSpend, 9100);
  failSnapshot = true;
  const failed = await evaluate(request('/api/evaluate', body));
  assert.equal(failed.status, 503); assert.equal((await failed.json()).code, 'financial_data_unavailable');
  assert.deepEqual(reportPrices, []);
});

test('chat: a new unpriced product clears the old product, then an explicit price uses the pending name', async () => {
  reset();
  let response = await chat(request('/api/ai/chat', chatBody({ product: { name: 'Audífonos', price: 2300 } })));
  let value = await response.json();
  assert.equal(response.status, 200); assert.equal(value.product, null);
  assert.equal(value.clearProductContext, true); assert.equal(value.pendingProductName, 'laptop');
  assert.deepEqual(reportPrices, []); assert.match(value.reply, /laptop.*cuánto cuesta/i);
  identity = randomUUID(); nextIntent = intent({ price: 1800 });
  response = await chat(request('/api/ai/chat', chatBody({ message: 'Cuesta $1,800', pendingProductName: 'laptop' })));
  value = await response.json();
  assert.equal(value.product.name, 'laptop'); assert.equal(value.report.purchase.purchaseAmount, 1800);
});

test('chat: available operation preserves context without creating a purchase, and report matches evaluate profile', async () => {
  reset(); nextIntent = intent({ operation: 'available' });
  const product = { name: 'Audífonos', price: 2300 };
  let value = await (await chat(request('/api/ai/chat', chatBody({ message: '¿Cuánto puedo gastar?', product })))).json();
  assert.deepEqual(value.product, product); assert.equal(value.report, undefined); assert.deepEqual(reportPrices, []);
  identity = randomUUID(); nextIntent = intent({ productName: 'Audífonos', price: 2300 });
  value = await (await chat(request('/api/ai/chat', chatBody({ message: 'Quiero unos audífonos de $2,300', product })))).json();
  const evaluated = await (await evaluate(request('/api/evaluate', { itemName: 'Audífonos', itemPrice: 2300 }))).json();
  assert.deepEqual(value.report, evaluated.purchaseReport); assert.equal(value.financialRevision, evaluated.financialRevision);
});

test('offline fallback and model arguments never reuse an unrelated historical price', () => {
  reset();
  const request = chatBody({ message: '¿Puedo comprar una laptop?', history: [{ role: 'user', content: 'Audífonos de $2300' }], product: { name: 'Audífonos', price: 2300 }, mode: 'account', deterministicOnly: true });
  const offline = fallbackIntent(request);
  assert.equal(offline.price, null); assert.equal(offline.productName, 'laptop');
  assert.throws(() => validateIntentArguments(intent({ productName: 'laptop', price: 2300 }), request), /precio de otro artículo/);
  assert.equal(executeFinancialTool(profile, offline, request.product).report, undefined);
  const general = fallbackIntent({ ...request, message: '¿Cuánto puedo gastar hoy?' });
  assert.equal(general.operation, 'available'); assert.equal(general.price, null);
});

test('evaluate route has no assignment to immutable purchase fields and no literal 500 default', () => {
  const source = fs.readFileSync('src/app/api/evaluate/route.ts', 'utf8');
  const ast = ts.createSourceFile('route.ts', source, ts.ScriptTarget.Latest, true);
  const assignments = [], priceDefaults = [];
  function visit(node) {
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ['itemName', 'itemPrice'].includes(node.left.getText(ast))) assignments.push(node.getText(ast));
    if (ts.isConditionalExpression(node) && /itemPrice|validPurchasePrice/.test(node.condition.getText(ast)) && [node.whenTrue, node.whenFalse].some(value => ts.isNumericLiteral(value) && value.text === '500')) priceDefaults.push(node.getText(ast));
    if (ts.isBinaryExpression(node) && [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken].includes(node.operatorToken.kind) && /itemPrice/.test(node.left.getText(ast)) && ts.isNumericLiteral(node.right) && node.right.text === '500') priceDefaults.push(node.getText(ast));
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.deepEqual(assignments, []);
  assert.deepEqual(priceDefaults, []);
  assert.doesNotMatch(source, /buildContextChatReply|financialContext\s*\./);
});

test('chat incomplete diagnosis preserves known balance and income and asks only for missing inputs', () => {
  const input = { ...profile, nextPaydayAmount: null, nextPaydayDays: null,
    incomeSources: [{ amount: 5000, frequency: 'semanal', nextPaymentDate: '2020-01-01', nextPaymentDays: null, dateStatus: 'overdue' }],
    dataWarnings: ['income_date_overdue'] };
  const before = JSON.stringify(input);
  const tool = executeFinancialTool(input, intent({ productName: 'Audífonos', price: 2300 }), null);
  assert.equal(tool.cards.find(card => card.label === 'Saldo registrado').value, 10000);
  assert.equal(tool.cards.find(card => card.label === 'Importe registrado de ingreso 1').value, 5000);
  const diagnosis = tool.facts.find(fact => fact.id === 'ahora.assessment').text;
  assert.match(diagnosis, /próximo ingreso|fecha.*ingreso/);
  assert.doesNotMatch(diagnosis, /Saldo actual desconocido|Reserva de seguridad sin confirmar|Presupuesto.*sin confirmar/);
  assert.equal(tool.report.purchase.safeToSpend, null);
  assert.equal(JSON.stringify(input), before);
});

test('unambiguous quiero plus named article and price is a purchase; other financial actions never become one', async () => {
  reset();
  const cases = ['Quiero apartar $500', 'Quiero ahorrar $500', 'Quiero pagar $500', 'Tengo una deuda de $500', 'Quiero guardar $500 en mi fondo'];
  for (const message of cases) {
    const input = { requestId: randomUUID(), message, history: [], product: { name: 'Audífonos', price: 2300 }, mode: 'account', deterministicOnly: true };
    const result = executeFinancialTool(profile, fallbackIntent(input), input.product);
    assert.equal(result.report, undefined, message);
    const response = await evaluate(request('/api/evaluate', { userQuestion: message, itemName: 'Audífonos', itemPrice: 2300 }));
    assert.equal(response.status, 200); assert.equal((await response.json()).purchaseReport, null, message);
  }
  assert.deepEqual(reportPrices, []);
  const value = await (await evaluate(request('/api/evaluate', { userQuestion: 'Quiero unos audífonos de $2,300.' }))).json();
  assert.equal(value.detectedItemPrice, 2300); assert.match(value.detectedItemName, /audífonos/);
  assert.ok(reportPrices.length && reportPrices.every(price => price === 2300));
});

test('the explicit new product in the user message wins over mislabeled or omitted model product names', () => {
  const request = { requestId: randomUUID(), message: '¿Puedo comprar una laptop?', history: [],
    product: { name: 'Audífonos', price: 2300 }, mode: 'account', deterministicOnly: false };
  for (const productName of ['Audífonos', null]) {
    assert.throws(() => validateIntentArguments(intent({ productName, price: 2300 }), request), /precio de otro artículo/);
    const safe = validateIntentArguments(intent({ productName, price: null }), request);
    assert.equal(safe.productName, 'laptop');
    assert.equal(executeFinancialTool(profile, safe, request.product).report, undefined);
  }
  const explicit = validateIntentArguments(intent({ productName: 'Audífonos', price: 1800 }), { ...request, message: 'Quiero comprar una laptop de $1,800' });
  assert.equal(explicit.productName, 'laptop'); assert.equal(explicit.price, 1800);
  const followUp = validateIntentArguments(intent({ productName: null, price: 1800 }), { ...request, message: '¿Y si compro uno de $1,800?' });
  assert.equal(executeFinancialTool(profile, followUp, request.product).product.name, 'Audífonos');
  const saving = validateIntentArguments(intent({ operation: 'savings', productName: 'Audífonos', price: 2300, weeks: 4 }), {
    ...request, message: '¿Cuánto tendría que ahorrar para comprarlo en cuatro semanas?' });
  assert.equal(saving.price, 2300); assert.equal(saving.weeks, 4);
});
