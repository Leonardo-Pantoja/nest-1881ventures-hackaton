import { buildPurchaseReport, calculateSafeToSpend, calculateGoalImpact, projectSixWeeks } from "../onboarding";
import type { OnboardingProfile } from "../onboarding/financialTypes";
import type { PurchaseReport } from "../onboarding/purchaseReport";
import { allGoals, calculateSavingsPlan, withGoalContributions } from "../finance/savingsPlan";
import { profileAtNextIncome } from "../finance/waitScenario";
import type { FinancialIntent, ProductContext, ToolResult } from "./schemas";

import { formatMXN as mxn } from "../finance/money";
const normalized = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Pure allowlisted read-only operations. No Supabase client or write capability is available here. */
export function executeFinancialTool(profile: OnboardingProfile, intent: FinancialIntent, context: ProductContext | null, financialDate?: string): ToolResult {
  const product = intent.price !== null ? { name: intent.productName || context?.name || "Compra consultada", price: intent.price } : context;
  const result: ToolResult = { operation: intent.operation, product, facts: [], cards: [] };
  const fact = (id: string, text: string, required = true) => result.facts.push({ id, text, required });
  const card = (label: string, value: number | null, unit: "MXN" | "semanas" | "días" = "MXN") => { if (value !== null) result.cards.push({ label, value, unit }); };
  const safe = calculateSafeToSpend(profile);
  function reportFacts(report: PurchaseReport, prefix: string) {
    const p = report.purchase;
    card(`${prefix}: precio`, p.purchaseAmount);
    card(`${prefix}: margen restante`, p.remainingSafeToSpend);
    if (report.status === "saldo_insuficiente") fact(`${prefix}.balance`, `El precio de ${mxn(p.purchaseAmount)} supera el saldo registrado de ${mxn(profile.currentBalance!)}. No se simuló una compra realizada.`);
    if (p.assessment === "no_evaluable") fact(`${prefix}.assessment`, "No hay información suficiente para evaluar esta compra. Confirma la fecha del próximo ingreso, saldo, gastos, pagos y ubicación de ahorros que falten en tu perfil.");
    else if (p.assessment === "excede_margen") {
      fact(`${prefix}.assessment`, `La compra de ${mxn(p.purchaseAmount)} excede tu margen calculado de ${mxn(p.safeToSpend!)} por ${mxn(p.exceedsBy!)}. Podría afectar gastos, compromisos o reservas protegidas; considera esperar o reducir el precio.`);
      card(`${prefix}: exceso sobre el margen`, p.exceedsBy);
    } else fact(`${prefix}.assessment`, `La compra de ${mxn(p.purchaseAmount)} está dentro del margen inmediato calculado. Quedarían ${mxn(p.remainingSafeToSpend!)} de dinero libre estimado.`);
    const risks = report.projectionAfter?.weeks.filter(w => w.belowProtectedFunds) ?? [];
    if (risks.length) fact(`${prefix}.risk`, `Esta simulación muestra riesgo de tocar fondos protegidos en las semanas ${risks.map(w => w.week).join(", ")}. El saldo mínimo proyectado sería ${mxn(report.projectionAfter!.lowestBalance!)}. Conviene explorar esperar o un precio menor.`);
    if (report.status === "datos_incompletos" || report.projectionBefore.status === "datos_incompletos" || report.projectionAfter?.status === "datos_incompletos") fact(`${prefix}.incomplete`, "La proyección futura está incompleta: no puedo estimar de forma confiable las próximas seis semanas. El margen inmediato conocido no confirma la viabilidad futura. Revisa fechas, frecuencias, importes y ubicación de los ahorros; no supongo calendarios mensuales ni ingresos variables.");
    else if (report.projectionAfter && !risks.length) fact(`${prefix}.projection`, "La simulación de seis semanas no muestra fondos por debajo de las reservas registradas. No garantiza que los ingresos lleguen ni incluye gastos no registrados.");
    fact(`${prefix}.goals`, "Esta simulación paga con saldo corriente y no retira ahorros de tus metas. La proyección base no descuenta automáticamente sus aportaciones futuras.");
  }
  if (intent.operation === "clarify") {
    fact("clarify", "Puedo ayudarte a evaluar una compra, revisar tu margen, consultar una meta o comparar un plan. ¿Qué quieres revisar y qué precio tienes en mente?");
  } else if (["purchase", "compare", "wait", "savings"].includes(intent.operation) && !product) {
    fact("missing.price", "Necesito el precio en MXN y el producto que quieres evaluar. No voy a suponer una cantidad.");
  } else if (intent.operation === "purchase" || intent.operation === "compare") {
    result.report = buildPurchaseReport(profile, product!.price);
    reportFacts(result.report, "ahora");
    if (intent.operation === "compare") {
      if (intent.alternativePrice === null) fact("missing.alternative", "¿Qué precio tiene la alternativa que quieres comparar?");
      else reportFacts(buildPurchaseReport(profile, intent.alternativePrice), "alternativa");
    }
  } else if (intent.operation === "savings") {
    const plan = calculateSavingsPlan(profile, product!.price, { weeks: intent.weeks, weeklyContribution: intent.weeklyContribution, upfrontAmount: intent.upfrontAmount, financialDate });
    result.savings = plan;
    card("Objetivo de compra", plan.target); card("Apartado inicial solicitado", plan.upfrontAmount);
    card("Por reunir", plan.remainingTarget); card("Capacidad semanal comprobada", plan.weeklyCapacity);
    card("Aportación semanal del escenario", plan.weeklyContribution); card("Semanas estimadas", plan.weeks, "semanas");
    fact("savings.diagnosis", plan.status === "calculado" ? `El escenario estima una aportación de ${mxn(plan.weeklyContribution!)} por semana durante ${plan.weeks} semanas para reunir ${mxn(plan.remainingTarget)}. Es compatible con los gastos y aportaciones registrados bajo las condiciones de la simulación.`
      : plan.status === "no_sostenible" ? `El plan no resulta sostenible con lo registrado. La capacidad semanal comprobada es ${mxn(plan.weeklyCapacity ?? 0)}${plan.weeklyContribution !== null ? ` y el escenario requiere ${mxn(plan.weeklyContribution)}` : ""}. Podemos revisar un plazo mayor o una alternativa más económica.`
      : "No tengo datos suficientes para comprobar una aportación sostenible. Confirma ingresos, vencimientos y las aportaciones ya comprometidas a tus metas.");
    plan.limitations.forEach((text, i) => fact(`savings.limit.${i}`, text));
    if (plan.estimatedDate) fact("savings.date", `Si comienzas con transferencias semanales desde hoy, la fecha aritmética estimada sería ${plan.estimatedDate}; depende de mantener esas aportaciones.`);
    fact("savings.upfront", "No asigné automáticamente tu margen disponible a esta compra. El apartado inicial solo se utiliza cuando tú lo indicas; las metas existentes siguen protegidas.");
  } else if (intent.operation === "wait") {
    result.report = buildPurchaseReport(profile, product!.price); reportFacts(result.report, "ahora");
    const after = profileAtNextIncome(profile);
    if (!after) fact("wait.unknown", "No puedo calcular la compra al próximo ingreso con las fechas y frecuencias registradas. Necesito un ingreso fijo con fecha conocida y un calendario de pagos compatible, incluidas aportaciones a metas.");
    else {
      const future = buildPurchaseReport(after, product!.price);
      fact("wait.condition", `Escenario condicionado a recibir el próximo ingreso registrado en ${profile.nextPaydayDays} días, descontando gastos, pagos y aportaciones comprometidas hasta entonces. No es un ingreso garantizado.`);
      reportFacts(future, "al recibir ingreso");
    }
  } else if (intent.operation === "goal" || intent.operation === "withdraw_goal") {
    const goals = allGoals(profile);
    const query = normalized(intent.goalQuery ?? "");
    const matches = query ? goals.filter(g => normalized(g.title).includes(query) || query.includes(normalized(g.title))) : goals;
    if (matches.length !== 1) fact("goal.clarify", matches.length > 1 ? "Tienes varias metas que podrían corresponder. ¿Cuál quieres consultar y cuál prefieres priorizar? No asigné una prioridad por ti." : "No encontré una meta que corresponda a esa consulta. Revisa el nombre registrado; no supongo ahorros que no aparecen en tu cuenta.");
    else {
      const goal = matches[0];
      if (goal.currentSaved === null || goal.targetAmount === null) fact("goal.missing", "Falta confirmar el ahorro o el objetivo de esa meta.");
      else if (intent.operation === "withdraw_goal") {
        if (intent.reserveAmount === null) fact("goal.withdraw.amount", "¿Qué cantidad quieres simular retirar de esa meta? La simulación no modifica tus ahorros.");
        else if (intent.reserveAmount > goal.currentSaved) fact("goal.withdraw.invalid", "El retiro solicitado supera los ahorros registrados en esa meta.");
        else {
          const impact = calculateGoalImpact(goal, intent.reserveAmount);
          card("Ahorro después del retiro simulado", impact.savedAfter);
          card("Retraso estimado", impact.delayedByWeeks, "semanas");
          fact("goal.withdraw", `El retiro simulado dejaría ${mxn(impact.savedAfter)} en la meta.${impact.delayedByWeeks === null ? " No hay información suficiente para estimar un retraso." : ` El motor estima ${impact.delayedByWeeks} semanas de retraso aritmético; no confirma una fecha real.`} No se modificó tu ahorro.`);
        }
      } else {
        card("Ahorro registrado en la meta", goal.currentSaved); card("Objetivo de la meta", goal.targetAmount);
        fact("goal.saved", `La meta consultada tiene ${mxn(goal.currentSaved)} ahorrados de un objetivo de ${mxn(goal.targetAmount)}. Este saldo no se utiliza automáticamente para compras.`);
      }
    }
  } else if (intent.operation === "reserve") {
    if (intent.reserveAmount === null || profile.safetyBuffer === null) fact("reserve.missing", "Confirma cuánto quieres añadir al fondo de emergencia y tu reserva actual. No se guardará sin una acción explícita.");
    else {
      const reserved = calculateSafeToSpend({ ...profile, safetyBuffer: (Math.round(profile.safetyBuffer * 100) + Math.round(intent.reserveAmount * 100)) / 100 });
      card("Margen al añadir la reserva", reserved.safeToSpend);
      fact("reserve.result", reserved.safeToSpend === null ? "Faltan datos para calcular este apartado." : `Al añadir ${mxn(intent.reserveAmount)} a la reserva de seguridad, el margen estimado sería ${mxn(reserved.safeToSpend)}.${reserved.shortfall ? ` Faltarían ${mxn(reserved.shortfall)} para cubrir todos los fondos protegidos.` : ""} Es una simulación; no se movió dinero.`);
    }
  } else if (intent.operation === "priorities") {
    fact("priorities.rule", "Primero protege las necesidades esenciales; después revisa obligaciones próximas, pagos mínimos registrados de deudas, reserva de seguridad y aportaciones comprometidas antes de compras discrecionales. Una deuda no desplaza automáticamente la renta o la comida.");
    const ranked = [
      ...profile.commitments.map(c => ({ title: c.title, amount: c.amount, due: c.dueInDays, rank: c.kind === "esencial" || /vivienda|renta|salud|alimenta/i.test(c.category + c.title) ? 0 : 1 })),
      ...profile.debts.map(d => ({ title: d.title, amount: d.nextPayment, due: d.dueInDays, rank: 1 })),
    ].sort((a, b) => a.rank - b.rank || (a.due ?? Infinity) - (b.due ?? Infinity));
    ranked.slice(0, 8).forEach((p, i) => {
      // Names stay in the local response; Gemini only sees anonymized operation facts below.
      fact(`priority.${i}`, `Prioridad registrada: ${p.title.slice(0, 100)}${p.amount === null ? "; importe sin confirmar" : `, pago de ${mxn(p.amount)}`}${p.due === null ? "; vencimiento desconocido o vencido por confirmar" : ` en ${p.due} días`}. Revisa la fecha y las consecuencias reales antes de decidir.`);
    });
    if (ranked.length > 8) fact("priorities.more", "Hay más pagos activos además de los mostrados. Revisa la lista completa de compromisos antes de decidir.");
    if (!ranked.length) fact("priorities.empty", "No aparecen compromisos activos ni pagos de deuda registrados; esto no confirma que no existan gastos pendientes.");
    fact("priorities.unknown", "No tengo tasas, penalizaciones ni prioridades personales confirmadas. Si compiten dos metas, dime cuál quieres priorizar.");
  } else {
    card("Dinero libre estimado", safe.safeToSpend); card("Reserva de seguridad", safe.safetyBuffer);
    fact("available", safe.safeToSpend === null ? "No puedo calcular tu margen sin confirmar saldo, próximo ingreso, gastos, pagos y ubicación de ahorros. ¿Qué dato falta en tu perfil?" : `Tu margen antes del próximo ingreso es ${mxn(safe.safeToSpend)} según lo registrado, después de gastos esenciales, compromisos, deudas y fondos protegidos. No incluye gastos que no has registrado.`);
    const reserved = withGoalContributions(profile);
    const afterContributions = reserved ? calculateSafeToSpend(reserved) : null;
    if (afterContributions?.safeToSpend !== null && afterContributions?.safeToSpend !== undefined) {
      card("Margen tras aportaciones comprometidas", afterContributions.safeToSpend);
      fact("available.contributions", `Si también reservas las aportaciones semanales comprometidas a metas antes del ingreso, el margen estimado es ${mxn(afterContributions.safeToSpend)}.`);
    } else fact("available.contributions", "Falta confirmar las aportaciones futuras a metas; el margen base no las descuenta automáticamente.");
    const projection = projectSixWeeks(profile);
    const risks = projection.weeks.filter(w => w.belowProtectedFunds);
    if (projection.status === "datos_incompletos") fact("overview.incomplete", "La proyección de seis semanas está incompleta; no puedo convertir el margen actual en una garantía futura.");
    else if (risks.length) fact("overview.risk", `La simulación muestra riesgo de tocar fondos protegidos en las semanas ${risks.map(w => w.week).join(", ")}.`);
  }
  fact("limits", "Son estimaciones con tus datos registrados, no una garantía de solvencia ni asesoría financiera profesional. Puedes esperar, comparar o actualizar tus datos; la decisión es tuya.");
  return result;
}
