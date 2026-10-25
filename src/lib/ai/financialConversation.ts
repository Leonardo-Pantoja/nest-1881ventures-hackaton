import type { OnboardingProfile } from "../onboarding/financialTypes";
import type { FinancialIntent, ToolResult, FinancialFact } from "./schemas";
import { executeFinancialTool } from "./financialTools";
import { profileAtNextIncome } from "../finance/waitScenario";
import { calculateSafeToSpend } from "../onboarding/financialEngine";
import { calculateSavingsPlan } from "../finance/savingsPlan";
import { calculateHypotheticalPurchaseBalance, calculateSavingsTarget, calculateWaitScenario } from "../finance/conversationalMath";
import { resolveIntentProduct, identifiedProductName } from "./productContext";
import { getRegisteredFinancialData, getFinancialMissingInformation } from "../finance/profileDiagnostics";
import { formatMXN } from "../finance/money";
import type { ReplyFollowUp } from "./conversationalReply";
import type { ConversationState } from "./conversationState";

function missingReason(profile: OnboardingProfile, state: ConversationState) {
  if (state.incomeContext === "none") return "No asumiré una nómina futura. Con lo registrado no hay un horizonte de ingreso confirmado para calcular dinero libre.";
  if (state.incomeContext === "variable" && profile.nextPaydayDays === null) return "Tus ingresos son variables y no hay un próximo cobro confirmado; no puedo calcular un margen antes de ese cobro.";
  if ((profile.dataWarnings ?? []).includes("income_sources_missing")) return "No aparecen fuentes de ingreso activas y visibles ni una fecha de próximo pago confirmada.";
  return getFinancialMissingInformation(profile).slice(0, 2).join(" ") || "Falta confirmar el calendario financiero registrado.";
}

/** Select just the operation requested; narrative policy never changes Sebas' formulas. */
export function executeConversationTool(profile: OnboardingProfile, intent: FinancialIntent, state: ConversationState, financialDate?: string, message = ""): ToolResult {
  const product = ["purchase", "compare", "savings", "wait"].includes(intent.operation) ? resolveIntentProduct(intent, state.product) : state.product;
  const result: ToolResult = { operation: intent.operation, product, facts: [], cards: [] };
  const fact = (id: string, text: string, required = true) => result.facts.push({ id, text, required });
  const card = (label: string, value: number | null, unit: "MXN" | "semanas" | "días" = "MXN") => { if (value !== null) result.cards.push({ label, value, unit }); };
  const registered = getRegisteredFinancialData(profile);
  const incomeContradicted = state.incomeContext === "none" || state.incomeContext === "variable" && ["semanal", "quincenal", "mensual"].includes(profile.payFrequency);
  // Dialogue can invalidate a payroll assumption without changing the registered profile or engine formulas.
  const evaluationProfile: OnboardingProfile = incomeContradicted
    ? { ...profile, nextPaydayAmount: null, nextPaydayDays: null, payFrequency: "variable" }
    : profile;
  result.marginStatus = ["purchase", "compare", "available", "overview"].includes(intent.operation) && (profile.nextPaydayDays === null || incomeContradicted) ? "unknown" : "not_applicable";
  if (intent.operation === "confirmation" || intent.operation === "income_update") {
    const incomeContext = intent.incomeStatement ?? state.incomeContext;
    if (incomeContext === "none") fact("dialogue.no_income", "Entendido: indicas que actualmente no tienes ingresos. No asumiré una nómina ni una fecha de cobro. Esta aclaración queda en la conversación; no modifica tus registros.");
    else if (incomeContext === "variable") fact("dialogue.variable_income", "Tomo tus ingresos como variables en esta conversación; no asumiré una frecuencia fija para tus cobros.");
    else if (intent.operation === "income_update") {
      fact("dialogue.income_context", "Entendido. Tomo esa información como contexto de la conversación; no la guardaré ni la convertiré en un ingreso confirmado automáticamente.");
      if (profile.nextPaydayDays === null) fact("dialogue.missing", missingReason(profile, state));
    } else {
      fact("dialogue.confirmed", "Gracias por confirmarlo. Los datos están actualizados, aunque todavía pueden faltar campos necesarios.");
      if (profile.nextPaydayDays === null || registered.incomeSources.length === 0) fact("dialogue.missing", missingReason(profile, state));
      else fact("dialogue.registered", "Los datos registrados se consultaron de nuevo. Podemos continuar con el producto o cambiar a ahorro, compromisos o prioridades.", false);
    }
    return result;
  }
  if (["purchase", "compare", "savings", "wait"].includes(intent.operation) && !product) {
    fact("missing.price", `Falta confirmar el precio en MXN de ${identifiedProductName(intent.productName) ?? state.pendingProductName ?? "la compra que quieres revisar"}.`);
    return result;
  }
  if (intent.operation === "savings") {
    const math = calculateSavingsTarget(product!.price, { weeks: intent.weeks, weeklyContribution: intent.weeklyContribution, upfrontAmount: intent.upfrontAmount });
    result.mathematicalSavings = math;
    const plan = calculateSavingsPlan(evaluationProfile, product!.price, { weeks: intent.weeks, weeklyContribution: intent.weeklyContribution, upfrontAmount: intent.upfrontAmount, financialDate });
    result.savings = plan;
    card("Objetivo de compra", math.target); card("Apartado inicial indicado", math.upfrontAmount);
    card("Por reunir", math.remainingTarget); card("Objetivo semanal matemático", math.requiredWeeklyContribution);
    card("Aportación semanal indicada", math.weeklyContribution); card("Semanas aritméticas", math.estimatedWeeks, "semanas");
    if (math.requiredWeeklyContribution !== null) fact("savings.math", `Para reunir ${formatMXN(math.remainingTarget)} en ${math.requestedWeeks} semanas desde un apartado inicial de ${formatMXN(math.upfrontAmount)}, el objetivo matemático es ${formatMXN(math.requiredWeeklyContribution)} por semana.`);
    else if (math.weeklyContribution !== null && math.estimatedWeeks !== null) fact("savings.math", `Con aportaciones constantes de ${formatMXN(math.weeklyContribution)} por semana, reunir ${formatMXN(math.remainingTarget)} tomaría ${math.estimatedWeeks} semanas aritméticas.`);
    else fact("savings.math", `Faltan reunir ${formatMXN(math.remainingTarget)}. Necesito un plazo o una aportación para calcular el objetivo semanal o el tiempo aritmético.`);
    if (plan.status === "datos_incompletos" || incomeContradicted) {
      fact("savings.capacity", "Es un objetivo matemático; todavía no se ha comprobado que puedas apartarlo sin afectar tus gastos.");
    } else {
      card("Capacidad semanal comprobada", plan.weeklyCapacity);
      fact("savings.capacity", plan.status === "calculado" ? `La capacidad semanal comprobada bajo las condiciones del motor es ${formatMXN(plan.weeklyCapacity!)}; el escenario cabe dentro de ella, sin garantizar ingresos futuros.` : `La capacidad semanal comprobada es ${formatMXN(plan.weeklyCapacity ?? 0)} y el escenario no resulta sostenible con los gastos registrados.`);
    }
    if (math.estimatedWeeks !== null && math.estimatedWeeks > 6 || plan.beyondProjection) fact("savings.horizon", "Más allá de seis semanas es una estimación condicionada a aportaciones constantes, no una proyección financiera completa.");
    return result;
  }
  if (intent.operation === "wait" && intent.weeks === null) {
    if (/proxim[oa].*(?:pago|ingreso|quincena)|siguiente pago/i.test(message)) {
      const after = incomeContradicted ? null : profileAtNextIncome(profile);
      if (!after) fact("wait.unknown", `No puedo simular un cobro no confirmado. ${missingReason(profile, state)}`);
      else {
        const afterPurchase = calculateHypotheticalPurchaseBalance(after.currentBalance, product!.price);
        card("Saldo simulado al próximo ingreso", after.currentBalance);
        card("Saldo contable tras compra diferida", afterPurchase.hypotheticalBalance);
        fact("wait.result", `Si se recibe el próximo ingreso registrado, el escenario estima un saldo de ${formatMXN(after.currentBalance!)} antes de comprar.${afterPurchase.hypotheticalBalance === null ? " El precio supera ese saldo." : ` Tras la compra quedarían ${formatMXN(afterPurchase.hypotheticalBalance)} contables.`} No representa margen seguro ni garantiza recibir ese ingreso.`);
        const margin = calculateSafeToSpend(profile);
        if ((margin.shortfall ?? 0) > 0) fact("wait.risk", "El motor detecta un faltante para cubrir los fondos protegidos antes del ingreso; esperar por sí solo no resuelve ese riesgo.");
      }
    } else fact("wait.missing_horizon", "Necesito confirmar el plazo de espera. No lo sustituiré por el próximo pago ni asumiré que llegaron ingresos.");
    return result;
  }
  if (intent.operation === "wait" && intent.weeks !== null) {
    const scenario = calculateWaitScenario(evaluationProfile, product!.price, intent.weeks);
    result.waitScenario = scenario;
    card("Semanas de espera", scenario.requestedWeeks, "semanas");
    card("Gasto esencial durante la espera", scenario.essentialExpensesDuringWait);
    card("Saldo proyectado al esperar", scenario.projectedBalance);
    card("Saldo contable tras compra diferida", scenario.hypotheticalBalanceAfterPurchase);
    if (scenario.status === "calculado" && !incomeContradicted) {
      fact("wait.result", `La simulación al esperar ${scenario.requestedWeeks} semanas estima un saldo de ${formatMXN(scenario.projectedBalance!)} antes de comprar y ${scenario.hypotheticalBalanceAfterPurchase === null ? "sin saldo suficiente para completar la compra" : `un saldo contable de ${formatMXN(scenario.hypotheticalBalanceAfterPurchase)} después`}. Ese saldo no representa dinero libre garantizado.`);
      if (scenario.riskWeeksDuringWait.length || scenario.belowProtectedFundsAfterPurchase) fact("wait.risk", `Hay riesgo de tocar fondos protegidos${scenario.riskWeeksDuringWait.length ? ` durante las semanas ${scenario.riskWeeksDuringWait.join(", ")}` : " tras la compra diferida"}. No es una recomendación favorable por esperar.`);
    } else {
      // A user's statement that income stopped invalidates a future-income assumption, not the stored account.
      result.cards = result.cards.filter(c => !/Saldo/.test(c.label));
      fact("wait.unknown", `No puedo proyectar el saldo tras ese plazo sin un calendario de ingresos y pagos confirmado.`);
      if (scenario.essentialExpensesDuringWait !== null) fact("wait.essentials", `Los gastos esenciales registrados sumarían ${formatMXN(scenario.essentialExpensesDuringWait)} durante ese plazo. Es aritmética de gastos, no una proyección completa del saldo.`);
    }
    return result;
  }
  if (intent.operation === "commitments") {
    fact("commitments.summary", "Estos son los pagos activos registrados; no se está evaluando una compra.");
    const payments = [...profile.commitments.map(item => ({ amount: item.amount, due: item.dueInDays })), ...profile.debts.map(item => ({ amount: item.nextPayment, due: item.dueInDays }))];
    payments.slice(0, 4).forEach((payment, index) => { card(`Pago registrado ${index + 1}`, payment.amount); fact(`commitments.${index}`, `Pago registrado ${index + 1}: ${payment.amount === null ? "importe pendiente" : formatMXN(payment.amount)}, ${payment.due === null ? "fecha sin confirmar" : `vence en ${payment.due} días`}.`, index === 0); });
    if (!payments.length) fact("commitments.empty", "No aparecen compromisos ni pagos de deuda activos en la consulta. Eso no confirma que no existan obligaciones sin registrar.");
    else if (payments.some(payment => payment.due === null)) fact("commitments.unknown", "Faltan vencimientos para establecer un orden exacto de pagos.");
    return result;
  }
  const legacy = executeFinancialTool(evaluationProfile, intent, state.product, financialDate);
  result.report = legacy.report; result.savings = legacy.savings;
  if (intent.operation === "purchase" || intent.operation === "compare") {
    result.product = legacy.product;
    result.cards = legacy.cards.filter(c => /precio|restante|exceso/.test(c.label));
    const report = legacy.report!;
    const partial = calculateHypotheticalPurchaseBalance(profile.currentBalance, product!.price);
    result.hypotheticalBalance = partial;
    if (report.purchase.assessment === "no_evaluable" || incomeContradicted) {
      result.marginStatus = "unknown";
      result.cards = result.cards.filter(c => !/restante/.test(c.label));
      fact("ahora.assessment", `No puedo determinar si la compra cabe en tu margen. ${missingReason(profile, state)}`);
      card("Saldo registrado", registered.currentBalance); card("Reserva registrada", registered.safetyBuffer);
      if (partial.hypotheticalBalance !== null) {
        card("Saldo contable hipotético", partial.hypotheticalBalance);
        fact("purchase.accounting", `El saldo contable hipotético tras la compra sería ${formatMXN(partial.hypotheticalBalance)}; no es dinero libre ni confirma la conveniencia de comprar.`);
      }
    } else {
      result.marginStatus = "calculated";
      for (const item of legacy.facts.filter(f => /assessment$|balance$|risk$/.test(f.id))) result.facts.push(item);
    }
    for (const item of legacy.facts.filter(f => f.id.endsWith(".incomplete"))) if (report.purchase.safeToSpend !== null && !incomeContradicted) fact(item.id, "El margen inmediato es conocido, pero la proyección futura está incompleta; no confirma la viabilidad de la compra.");
    for (const item of legacy.facts.filter(f => f.id.endsWith(".goals"))) fact(item.id, "La compra corriente no retira dinero de tus metas.", false);
    if (report.status === "saldo_insuficiente" && !result.facts.some(f => f.id.endsWith(".balance"))) fact("ahora.balance", "El precio supera el saldo registrado; no se simuló una compra realizada.");
  } else if (intent.operation === "available" || intent.operation === "overview") {
    const available = incomeContradicted ? null : legacy.cards.find(c => c.label === "Dinero libre estimado")?.value ?? null;
    if (available === null) {
      result.marginStatus = "unknown";
      fact("available", `El margen libre sigue sin poder calcularse. ${missingReason(profile, state)}`);
      card("Saldo registrado", registered.currentBalance); card("Reserva registrada", registered.safetyBuffer); card("Gasto esencial diario", registered.dailyEssentialBudget);
      fact("registered.known", "El saldo, la reserva y los gastos que sí aparecen en las tarjetas son datos registrados, no un margen calculado.", false);
    } else {
      result.marginStatus = "calculated";
      card("Dinero libre estimado", available);
      fact("available", `Tu margen inmediato estimado es ${formatMXN(available)}, según los gastos, pagos y reservas registrados.`);
      for (const item of legacy.facts.filter(f => f.id === "overview.risk")) result.facts.push(item);
      if (legacy.facts.some(f => f.id === "overview.incomplete")) fact("overview.incomplete", "La proyección futura está incompleta aunque el margen inmediato sí puede calcularse.");
    }
  } else if (intent.operation === "priorities") {
    fact("priorities.rule", "Protege primero necesidades esenciales, obligaciones próximas y pagos mínimos confirmados; después reserva y aportaciones comprometidas, antes de compras discrecionales.");
    const selected = legacy.facts.filter(f => /^priority\./.test(f.id)).slice(0, 3);
    for (const item of selected) fact(item.id, item.text, item === selected[0]);
    if (!selected.length) fact("priorities.empty", "No aparecen pagos activos registrados. Sin vencimientos confirmados solo puedo darte prioridades generales condicionadas.");
    if ([...profile.commitments, ...profile.debts].some(p => p.dueInDays === null)) fact("priorities.unknown", "Hay vencimientos sin confirmar; no puedo afirmar qué pago vence este mes ni establecer un orden exacto.");
    if (registered.dailyEssentialBudget !== null) card("Gasto esencial diario registrado", registered.dailyEssentialBudget);
    if (registered.safetyBuffer !== null) card("Reserva de seguridad registrada", registered.safetyBuffer);
  } else if (intent.operation === "reserve" && incomeContradicted) {
    result.marginStatus = "unknown";
    result.cards = legacy.cards;
    fact("reserve.unknown", `No puedo calcular un margen al añadir fondos a la reserva. ${missingReason(profile, state)} La simulación no modifica tu cuenta.`);
  } else {
    result.facts = legacy.facts.filter(f => f.id !== "limits").map(f => ({ ...f, text: f.text.replace(/¿[^?]+\?/g, "").trim() })); result.cards = legacy.cards;
  }
  if (state.incomeContext === "none" && result.report?.projectionAfter) fact("income.reported_none", "Has indicado que no tienes ingresos actualmente; los cobros registrados no se deben tratar como confirmados para recomendar la compra. Revisa el perfil antes de confiar en una proyección que los use.");
  return result;
}

export function selectConversationFollowUp(tool: ToolResult, state: ConversationState, profile: OnboardingProfile): ReplyFollowUp | null {
  const question = (kind: ReplyFollowUp["kind"], text: string): ReplyFollowUp | null => state.previousQuestion === text ? null : { kind, text };
  if (tool.facts.some(f => f.id === "missing.price")) return question("price", "¿Cuál es su precio en MXN?");
  if (tool.operation === "income_update") return null;
  if (tool.operation === "confirmation") {
    if (state.incomeContext === "none" || state.incomeContext === "variable" || state.awaiting === "income_type" || state.askedTopics?.includes("income_type")) return null;
    if (profile.nextPaydayDays === null) return question("income_type", "¿Recibes ingresos con una fecha fija o son variables?");
    return null;
  }
  if (tool.facts.some(f => f.id === "wait.missing_horizon")) return question("horizon", "¿Cuántas semanas quieres esperar?");
  if (tool.operation === "savings" && tool.mathematicalSavings?.requiredWeeklyContribution === null && tool.mathematicalSavings?.estimatedWeeks === null) return question("horizon", "¿En cuántas semanas te gustaría reunirlo?");
  if (tool.report?.purchase.assessment === "no_evaluable" || tool.operation === "available" && profile.nextPaydayDays === null) {
    if (state.incomeContext === "none" || state.incomeContext === "variable") return null;
    if (state.awaiting === "income_type" || state.askedTopics?.includes("income_type")) return null;
    return question("income_type", "¿Tus ingresos tienen una fecha fija o son variables?");
  }
  if (tool.operation === "priorities" && [...profile.commitments, ...profile.debts].some(p => p.dueInDays === null)) return question("priority", "¿Cuál es el vencimiento más próximo que tienes confirmado?");
  return null;
}

/** Transparent, focused offline output; never a fabricated new Gemini reply. */
export function renderConversationFallback(tool: ToolResult, followUp: { kind: string; text: string } | null): string {
  const facts: FinancialFact[] = tool.facts.filter(f => f.required);
  return facts.map(f => f.text).join("\n\n") + (followUp ? `\n\n${followUp.text}` : "");
}
