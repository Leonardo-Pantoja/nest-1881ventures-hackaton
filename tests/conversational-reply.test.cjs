const assert = require('node:assert/strict');
const { test } = require('node:test');
const gemini = require('../src/lib/ai/gemini.ts');
let provider;
gemini.generateStructured = options => provider(options);
const { buildReplyContext, validateRenderConversationalReply, generateConversationalReply,
  conversationalReplySchema } = require('../src/lib/ai/conversationalReply.ts');
const { userIncomeStatement } = require('../src/lib/ai/conversationState.ts');

const fact = (id, text, required = true) => ({ id, text, required });
const tool = (facts, more = {}) => ({ operation: 'purchase', product: { name: 'Metroid Ravenous', price: 1449 }, cards: [], facts, ...more });
const partial = tool([
  fact('registered.balance', 'El saldo registrado es $3,000.00 MXN.', false),
  fact('purchase.ledger', 'La compra dejaría un saldo contable hipotético de $1,551.00 MXN.'),
  fact('purchase.unknown', 'El margen seguro no está calculado; falta una fecha de próximo ingreso.'),
]);
const referenceAll = result => ({ body: result.facts.filter(f => f.required).map(f => `{{fact:${f.id}}}`).join('\n\n'),
  factIds: result.facts.filter(f => f.required).map(f => f.id), followUp: null });

test('income questions and hypothetical scenarios do not become declarations or financial context', () => {
  for (const message of ['¿Qué pasa si no tengo ingresos?', 'Qué pasa si no tengo ingresos?', '¿Cómo registro ingresos variables?',
    '¿Mis ingresos son variables?', 'Si no tengo ingresos, quiero revisar un escenario.', 'Supongamos que mis ingresos son fijos.',
    'En caso de no tener ingresos, quiero esperar.', 'Imagina que mis ingresos son variables.', '¿Debo registrar ingresos fijos?', 'No tengo ingresos en este escenario.']) {
    assert.equal(userIncomeStatement(message), null, message);
  }
});

test('current first-person income declarations remain conversational facts, including negative and variable statements', () => {
  for (const message of ['No tengo ingresos actualmente', 'Actualmente no tengo ingresos.', 'No recibo ningún ingreso.',
    'No cuento con ingresos', 'Estoy sin ingresos']) assert.equal(userIncomeStatement(message), 'none', message);
  for (const message of ['Mis ingresos son variables', 'Sí, mis ingresos son variables.', 'Tengo ingresos variables.',
    'No tengo ingresos fijos', 'No cuento con ingresos fijos.', 'Mis ingresos no son fijos', 'Son variables', 'Variables', 'Mis ingresos son variables. ¿Puedes ayudarme?']) {
    assert.equal(userIncomeStatement(message), 'variable', message);
  }
  for (const message of ['Mis ingresos son fijos', 'Tengo ingresos fijos.', 'Recibo un sueldo fijo.', 'Mi nómina es fija.', 'Son fijos']) {
    assert.equal(userIncomeStatement(message), 'fixed', message);
  }
});

test('employment status or another person\'s income does not establish absence of personal income', () => {
  for (const message of ['No tengo trabajo, pero recibo una pensión mensual', 'Estoy desempleado.', 'Mi hermano no tiene ingresos.',
    'Mi amigo tiene ingresos variables.', 'No tengo salario, pero recibo una pensión.']) assert.equal(userIncomeStatement(message), null, message);
});

test('only current deterministic facts create slots; stale user financial claims cannot create values', () => {
  const context = buildReplyContext(partial, { question: 'Sí, están actualizados', history: [{ role: 'user', content: 'Mi saldo antiguo era $999,999.' }],
    previousReply: '¿Tus datos están actualizados?', previousQuestion: '¿Tus datos están actualizados?', acknowledgement: 'El usuario confirmó que están actualizados.' });
  assert.equal(context.question, 'Sí, están actualizados');
  assert.equal(context.previousQuestion, '¿Tus datos están actualizados?');
  assert.equal(context.history.length, 1);
  assert.ok(context.slots.some(s => s.text === '$1,551.00 MXN' && s.factId === 'purchase.ledger'));
  assert.ok(!context.slots.some(s => s.text.includes('999')));
  assert.match(context.facts.find(f => f.id === 'purchase.ledger').text, /\{\{n\d+\}\}/);
  assert.ok(!('profile' in context));
});

test('new generated prose can acknowledge confirmation without repeating the previous report or question', () => {
  const input = { question: 'Sí, están actualizados', previousReply: 'Reporte anterior completo.',
    previousQuestion: '¿Tus datos están actualizados?', incomeContext: 'unknown', acknowledgement: 'Confirmó que están actualizados.' };
  const answer = validateRenderConversationalReply(partial, input, { body: 'Perfecto, tomo en cuenta tu confirmación. Actualizados no significa que estén completos.\n\n{{fact:purchase.ledger}}\n\n{{fact:purchase.unknown}}',
    factIds: ['purchase.ledger', 'purchase.unknown'], followUp: { kind: 'income_type', text: '¿Recibes ingresos con una fecha fija o son variables?' } });
  assert.match(answer.reply, /^Perfecto/);
  assert.ok(!answer.reply.includes('¿Tus datos están actualizados?'));
  assert.ok(answer.reply.includes('$1,551.00 MXN'));
  assert.equal((answer.reply.match(/\?/g) || []).length, 1);
  assert.equal(answer.followUp.kind, 'income_type');
  assert.equal(answer.quality.verdict, 'aprobada');
});

test('numeric references render exact fresh amounts and must cite their originating fact', () => {
  const result = tool([fact('savings.math', 'El objetivo matemático es $362.25 MXN por semana.'),
    fact('savings.limit', 'Esto no demuestra una capacidad de ahorro sostenible.')], { operation: 'savings' });
  const context = buildReplyContext(result, { question: '¿Cuánto necesito por semana?' });
  const slot = context.slots.find(s => s.factId === 'savings.math');
  const rendered = validateRenderConversationalReply(result, { question: '¿Cuánto necesito por semana?' }, {
    body: `Para ese plazo, la meta matemática semanal es {{${slot.id}}}.\n\n{{fact:savings.limit}}`, factIds: ['savings.math', 'savings.limit'], followUp: null,
  });
  assert.match(rendered.reply, /\$362\.25 MXN/);
  assert.match(rendered.reply, /no demuestra una capacidad/);
  assert.throws(() => validateRenderConversationalReply(result, { question: 'ahorro' }, {
    body: `Necesitarías {{${slot.id}}}.`, factIds: ['savings.limit'], followUp: null,
  }), /no respetó/);
});

test('arbitrary figures, dates, foreign currency, malformed slots and financial promises are rejected', () => {
  for (const body of ['Puedes gastar $2,000.', 'Llegará el 2026-11-03.', 'Tienes cien pesos libres.', 'Ahorrarías cuatro semanas.',
    'La compra es totalmente segura.', 'Te aseguro solvencia.', 'Recibirás una nómina.', 'Tienes trescientos pesos libres.', '{{n999}}', '{{fact:invented}}', '{{broken', 'Saldo: ١٠٠', 'Rentabilidad del 8%.']) {
    assert.throws(() => validateRenderConversationalReply(partial, { question: 'compra' }, { ...referenceAll(partial), body }), /no respetó/, body);
  }
});

test('a valid number slot cannot relabel a recorded balance or price as safe margin', () => {
  const result = tool([fact('purchase.assessment', 'El precio es $700.00 MXN y el margen calculado es $1,100.00 MXN.'),
    fact('registered.balance', 'El saldo registrado es $2,000.00 MXN.', false)], { report: { purchase: { safeToSpend: 1100 } } });
  const context = buildReplyContext(result, { question: '¿Cuánto puedo gastar?' });
  for (const source of ['price', 'balance']) {
    const slot = context.slots.find(s => s.meaning === source);
    assert.ok(slot);
    assert.throws(() => validateRenderConversationalReply(result, { question: 'disponible' }, {
      body: `Tu margen calculado es {{${slot.id}}}.`, factIds: result.facts.map(f => f.id), followUp: null,
    }), /no respetó/);
  }
});

test('math capacity, accounting and explicitly requested horizons remain critical; explicit no-question policy is honored', () => {
  const result = tool([fact('ledger.accounting', 'El saldo contable hipotético no equivale a dinero libre.'),
    fact('savings.capacity', 'El requisito matemático no demuestra capacidad sostenible.'),
    fact('wait.horizon', 'El plazo solicitado se analiza sin inventar ingresos futuros.')]);
  const answer = validateRenderConversationalReply(result, { question: 'seguimiento', suggestedFollowUp: null }, {
    body: 'Podemos revisar cada escenario con sus límites.', factIds: result.facts.map(f => f.id), followUp: null,
  });
  for (const source of result.facts) assert.ok(answer.reply.includes(source.text));
  assert.throws(() => validateRenderConversationalReply(result, { question: 'seguimiento', suggestedFollowUp: null }, {
    ...referenceAll(result), followUp: { kind: 'horizon', text: '¿En qué plazo lo quieres?' },
  }), /no respetó/);
  assert.throws(() => validateRenderConversationalReply(result, { question: 'seguimiento' }, {
    ...referenceAll(result), body: '¿Quieres revisar otro escenario?', followUp: null,
  }), /no respetó/);
});

test('invented or omitted required facts are rejected and quoted critical warnings survive rendering', () => {
  const result = tool([fact('purchase.assessment', 'Está dentro del margen inmediato calculado.'),
    fact('purchase.risk', 'La simulación muestra riesgo de tocar fondos protegidos en la semana 6.')]);
  assert.throws(() => validateRenderConversationalReply(result, { question: 'compra' }, {
    body: '{{fact:purchase.assessment}}', factIds: ['purchase.assessment'], followUp: null,
  }), /no respetó/);
  assert.throws(() => validateRenderConversationalReply(result, { question: 'compra' }, {
    ...referenceAll(result), factIds: ['purchase.assessment', 'purchase.risk', 'invented'],
  }), /no respetó/);
  const rendered = validateRenderConversationalReply(result, { question: 'compra' }, {
    body: '{{fact:purchase.assessment}}', factIds: ['purchase.assessment', 'purchase.risk'], followUp: null,
  });
  assert.match(rendered.reply, /riesgo.*semana 6/);
  const quoted = validateRenderConversationalReply(result, { question: 'compra' }, referenceAll(result));
  assert.equal(quoted.reply.split('fondos protegidos').length - 1, 1);
});

test('unknown safe margin cannot be relabeled from known balance and known margin is not erased by future uncertainty', () => {
  const unknown = { ...partial, report: { purchase: { safeToSpend: null } }, facts: [...partial.facts] };
  assert.throws(() => validateRenderConversationalReply(unknown, { question: 'disponible' }, {
    ...referenceAll(unknown), body: 'Tu margen seguro es {{n0}}.', factIds: unknown.facts.map(f => f.id),
  }), /no respetó/);
  const current = tool([fact('purchase.assessment', 'El margen inmediato calculado es $1,100.00 MXN.'),
    fact('future.incomplete', 'La proyección futura está incompleta y no confirma viabilidad futura.')], { report: { purchase: { safeToSpend: 1100 } } });
  const answer = validateRenderConversationalReply(current, { question: 'margen' }, referenceAll(current));
  assert.match(answer.reply, /margen inmediato.*1,100/);
  assert.match(answer.reply, /proyección futura está incompleta/);
  assert.throws(() => validateRenderConversationalReply(current, { question: 'margen' }, { ...referenceAll(current), body: 'No puedo calcular tu margen.' }), /no respetó/);
});

test('an explicit unknown available margin preserves known balance without relabeling it as spending money', () => {
  const result = tool([fact('available', 'El margen libre sigue sin poder calcularse; falta un próximo cobro confirmado.'),
    fact('registered.balance', 'El saldo registrado es $3,000.00 MXN.', false)], { operation: 'available', marginStatus: 'unknown' });
  const context = buildReplyContext(result, { question: '¿Cuánto puedo gastar?' });
  assert.equal(context.marginStatus, 'unknown');
  assert.ok(context.preserveFactIds.includes('available'));
  const slot = context.slots.find(s => s.factId === 'registered.balance');
  const valid = validateRenderConversationalReply(result, { question: 'disponible' }, {
    body: `El saldo registrado es {{${slot.id}}}.\n\n{{fact:available}}`, factIds: ['available', 'registered.balance'], followUp: null,
  });
  assert.match(valid.reply, /saldo registrado es \$3,000/);
  assert.match(valid.reply, /margen libre sigue sin poder calcularse/);
  assert.throws(() => validateRenderConversationalReply(result, { question: 'disponible' }, {
    body: `Tu margen disponible es {{${slot.id}}}.`, factIds: ['available', 'registered.balance'], followUp: null,
  }), /no respetó/);
});

test('an explicit unknown margin rejects spending promises even without numbers or a purchase report', () => {
  const result = tool([fact('available', 'No hay un margen validado con el calendario actual.')], { operation: 'available', marginStatus: 'unknown' });
  for (const body of ['Podrías gastarlo sin afectar reservas.', 'Puedes gastarlo.', 'Podrías comprarlo.']) {
    assert.throws(() => validateRenderConversationalReply(result, { question: 'disponible' }, {
      body, factIds: ['available'], followUp: null,
    }), /no respetó/, body);
  }
});

test('generated accounting and unknown-margin paraphrases are replaced once by canonical critical statements', () => {
  const result = tool([
    fact('ahora.assessment', 'No puedo determinar si la compra cabe en tu margen; falta un próximo cobro confirmado.'),
    fact('purchase.accounting', 'El saldo contable hipotético sería $1,551.00 MXN; no es dinero libre ni una recomendación.'),
    fact('purchase.price', 'El precio es $1,449.00 MXN.', false),
    fact('registered.balance', 'El saldo registrado es $3,000.00 MXN.', false),
  ], { marginStatus: 'unknown' });
  const context = buildReplyContext(result, { question: 'compra' });
  const slot = id => context.slots.find(s => s.factId === id).id;
  const body = `No puedo determinar si {{product}} cabe en tu margen actual. Restar {{${slot('purchase.price')}}} al saldo registrado de {{${slot('registered.balance')}}} dejaría {{${slot('purchase.accounting')}}} de saldo contable hipotético. Esto no significa que sea dinero libre.`;
  const reply = validateRenderConversationalReply(result, { question: 'compra' }, {
    body, factIds: result.facts.map(f => f.id), followUp: null,
  }).reply;
  assert.equal((reply.match(/saldo contable hipotético/g) || []).length, 1);
  assert.equal((reply.match(/margen/g) || []).length, 1);
  assert.equal((reply.match(/dinero libre/g) || []).length, 1);
  assert.ok(reply.includes(result.facts[0].text));
  assert.ok(reply.includes(result.facts[1].text));
});

test('capacity caveats are deduplicated without deleting the mathematical weekly target', () => {
  const result = tool([fact('savings.math', 'El objetivo matemático es $225.00 MXN por semana.'),
    fact('savings.capacity', 'La capacidad sostenible sigue sin comprobarse; el objetivo matemático no basta para confirmarla.')], { operation: 'savings', marginStatus: 'not_applicable' });
  const context = buildReplyContext(result, { question: 'ahorro' });
  const weekly = context.slots.find(s => s.factId === 'savings.math').id;
  for (const body of [`El objetivo matemático es {{${weekly}}} por semana. Este objetivo matemático no demuestra una aportación sostenible.`,
    `El objetivo matemático es {{${weekly}}} por semana; este objetivo no demuestra sostenibilidad.`]) {
    const reply = validateRenderConversationalReply(result, { question: 'ahorro' }, {
      body, factIds: ['savings.math', 'savings.capacity'], followUp: null,
    }).reply;
    assert.equal((reply.match(/\$225\.00 MXN/g) || []).length, 1);
    assert.equal((reply.match(/sostenible/g) || []).length, 1);
    assert.ok(reply.includes(result.facts[1].text));
    assert.match(reply, /\$225\.00 MXN por semana/);
  }
});

test('liquidity risk and exact repeated acknowledgements appear once while protected facts remain intact', () => {
  const risky = tool([fact('purchase.risk', 'La simulación muestra riesgo de tocar fondos protegidos en la semana 6.')]);
  const risk = validateRenderConversationalReply(risky, { question: 'riesgo' }, {
    body: 'La simulación podría tocar fondos protegidos.', factIds: ['purchase.risk'], followUp: null,
  }).reply;
  assert.equal(risk, risky.facts[0].text);
  const income = tool([fact('dialogue.variable_income', 'Entendido: tus ingresos son variables. No asumiré una frecuencia fija.')], { operation: 'income_update' });
  const reply = validateRenderConversationalReply(income, { question: 'Mis ingresos son variables', incomeContext: 'variable' }, {
    body: 'Entendido: tus ingresos son variables. {{fact:dialogue.variable_income}}', factIds: ['dialogue.variable_income'], followUp: null,
  }).reply;
  assert.equal((reply.match(/Entendido: tus ingresos son variables/g) || []).length, 1);
  assert.ok(reply.includes('No asumiré una frecuencia fija.'));
});

test('one specific follow-up is permitted and already answered income questions are rejected', () => {
  for (const [input, followUp] of [
    [{ incomeContext: 'none' }, { kind: 'income_type', text: '¿Tus ingresos son fijos o variables?' }],
    [{ incomeContext: 'variable' }, { kind: 'income_type', text: '¿Tus ingresos son fijos o variables?' }],
    [{ previousQuestion: '¿Cuál es el precio?' }, { kind: 'price', text: '¿Cuál es el precio?' }],
    [{}, { kind: 'price', text: '¿Cuál es el precio? ¿Y el producto?' }],
    [{}, { kind: 'price', text: '¿Cuesta $900?' }],
  ]) assert.throws(() => validateRenderConversationalReply(partial, { question: 'seguimiento', ...input }, { ...referenceAll(partial), followUp }), /no respetó/);
  assert.throws(() => validateRenderConversationalReply(partial, { question: 'seguimiento' }, {
    ...referenceAll(partial), body: '¿Quieres comprarlo?', followUp: { kind: 'horizon', text: '¿En qué plazo lo quieres?' },
  }), /no respetó/);
  for (const incomeContext of ['none', 'variable']) {
    assert.throws(() => validateRenderConversationalReply(partial, { question: 'seguimiento', incomeContext }, {
      ...referenceAll(partial), body: 'Tus ingresos son quincenales.',
    }), /no respetó/);
    const answer = validateRenderConversationalReply(partial, { question: 'seguimiento', incomeContext }, {
      ...referenceAll(partial), body: 'Entiendo lo que me comentas.\n\n{{fact:purchase.ledger}}\n\n{{fact:purchase.unknown}}',
    });
    assert.match(answer.reply, /^Entiendo/);
  }
});

test('dialogue is bounded and personal values are redacted without transmitting payment titles', () => {
  const result = tool([fact('priority.0', 'Prioridad registrada: PRIVATE PAYEE NAME, pago de $600.00 MXN en 5 días.')], { operation: 'priorities' });
  const context = buildReplyContext(result, { question: 'private@example.test Bearer secret-token',
    history: Array.from({ length: 20 }, (_, i) => ({ role: 'user', content: `turno ${i}` })),
    previousReply: 'Correo private@example.test' });
  assert.equal(context.history.length, 6);
  assert.ok(!JSON.stringify(context).includes('private@example.test'));
  assert.ok(!JSON.stringify(context).includes('secret-token'));
  assert.ok(!JSON.stringify(context).includes('PRIVATE PAYEE NAME'));
  const answer = validateRenderConversationalReply(result, { question: 'prioridades' }, referenceAll(result));
  assert.match(answer.reply, /PRIVATE PAYEE NAME/);
});

test('the actual SDK abstraction receives current question, valid dialogue and schema; provider failure remains an error', async () => {
  let captured;
  provider = async options => { captured = options; return { ...referenceAll(partial), body: 'Perfecto, gracias por confirmarlo.\n\n{{fact:purchase.ledger}}\n\n{{fact:purchase.unknown}}' }; };
  const abort = new AbortController();
  const result = await generateConversationalReply(partial, { question: 'Sí, están actualizados', previousQuestion: '¿Tus datos están actualizados?', incomeContext: 'unknown' }, abort.signal);
  assert.match(result.reply, /^Perfecto/);
  assert.equal(captured.source, 'chat-explanation');
  assert.equal(captured.schema, conversationalReplySchema);
  assert.equal(captured.signal, abort.signal);
  const sent = JSON.parse(captured.prompt);
  assert.equal(sent.question, 'Sí, están actualizados');
  assert.equal(sent.previousQuestion, '¿Tus datos están actualizados?');
  provider = async () => { throw new gemini.ProductAIError('gemini_upstream_503', 'not available', 503); };
  await assert.rejects(generateConversationalReply(partial, { question: '¿Y ahora?' }), error => error.code === 'gemini_upstream_503');
});
