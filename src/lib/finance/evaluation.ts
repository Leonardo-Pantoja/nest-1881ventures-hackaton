import { buildPurchaseReport, calculateSafeToSpend, evaluatePurchase, projectSixWeeks } from "../onboarding";
import type { OnboardingProfile } from "../onboarding/financialTypes";
import type { PurchaseReport } from "../onboarding/purchaseReport";
import type { PurchaseDecision } from "../onboarding/purchaseDecision";
import type { GoalImpactResult } from "../onboarding/goalImpact";
import type { SixWeekProjection } from "../onboarding/weeklyProjection";
import { getFinancialMissingInformation, getFinancialProjectionLimitations, getRegisteredFinancialData } from "./profileDiagnostics";

export type EvaluationStatus =
  | "dentro_del_margen"
  | "excede_el_margen"
  | "precaucion"
  | "datos_incompletos"
  | "error_procesamiento";

export interface EvaluateApiResponse {
  status: EvaluationStatus;
  detectedItemName: string;
  detectedItemPrice: number;
  verdict: "VIABLE" | "PRECAUCION" | "COMPROMETE" | "DATOS_INCOMPLETOS";
  badgeLabel:
    | "Compra viable hoy"
    | "Margen calculado"
    | "Viable con precaución"
    | "Riesgo en la proyección"
    | "Proyección por confirmar"
    | "Compromete tu quincena"
    | "Datos financieros incompletos";
  headlineLine1: string;
  headlineLine2: string;
  safeToSpend: number | null;
  daysUntilNextIncome: number | null;
  remainingAfterBuyToday: number | null;
  remainingFreeSafe: number | null;
  exceedsBy: number | null;
  freeMoneyRemainingPct: number | null;
  usedByPurchasePct: number | null;
  daysGoalDelayed: number | null;
  liquidityAfterPayday: number | null;
  remainingIfWaitPayday: number | null;
  waitRemainingPct: number | null;
  suggestedWeeklySave: number | null;
  weeksNeeded: number | null;
  consideredExpenses: {
    currentBalance: number | null;
    essentialExpenses: number | null;
    pendingCommitments: number | null;
    pendingDebtPayments: number | null;
    safetyBuffer: number | null;
    protectedSavings: number | null;
  };
  missingInformation: string[];
  registeredData?: ReturnType<typeof getRegisteredFinancialData>;
  projectionLimitations?: string[];
  projectionStatus: "calculado" | "datos_incompletos";
  projection: SixWeekProjection | null;
  projectionAfter: SixWeekProjection | null;
  projectedBalanceDifference: number | null;
  goalImpact: GoalImpactResult | null;
  purchaseDecision?: PurchaseDecision;
  purchaseReport?: PurchaseReport | null;
  aiExplanation?: string | null;
  chatReply?: string | null;
  source: "deterministic";
  financialRevision?: string;
  summary?: boolean;
}

export function buildDeterministicEvaluation(
  itemName: string,
  itemPrice: number | null,
  profile: OnboardingProfile,
): EvaluateApiResponse {
  const safe = calculateSafeToSpend(profile);
  const report = itemPrice === null ? null : buildPurchaseReport(profile, itemPrice);
  const purchase: PurchaseDecision =
    itemPrice === null
      ? {
          status: safe.status === "calculado" ? "evaluada" : "datos_incompletos",
          assessment: "dentro_del_margen",
          purchaseAmount: 0,
          safeToSpend: safe.safeToSpend,
          remainingSafeToSpend: safe.safeToSpend,
          exceedsBy: 0,
          explanation: "Resumen del margen disponible calculado.",
        }
      : report
        ? report.purchase
        : evaluatePurchase(profile, itemPrice);
  const projectionBefore = report ? report.projectionBefore : projectSixWeeks(profile);
  const projectionAfter = report?.projectionAfter ?? null;
  const projectedBalanceDifference = report?.projectedBalanceDifference ?? null;
  const goalImpact = report?.goalImpact ?? null;
  const riskWeeks = (report ? projectionAfter : projectionBefore)?.weeks.filter(week => week.belowProtectedFunds).map(week => week.week) ?? [];
  const futureRisk = riskWeeks.length > 0;
  const projectionIncomplete = projectionBefore.status === "datos_incompletos" || projectionAfter?.status === "datos_incompletos";
  const isComplete =
    profile.isOnboarded &&
    safe.status === "calculado" &&
    safe.safeToSpend !== null &&
    purchase.status === "evaluada" &&
    purchase.remainingSafeToSpend !== null;
  const missingInformation = getFinancialMissingInformation(profile);
  const projectionLimitations = projectionIncomplete ? getFinancialProjectionLimitations(profile) : [];
  if (!isComplete && missingInformation.length === 0) missingInformation.push("Faltan datos necesarios para calcular el margen disponible.");
  const registeredData = getRegisteredFinancialData(profile);

  let status: EvaluationStatus = "datos_incompletos";
  if (isComplete && purchase.assessment === "excede_margen") {
    status = "excede_el_margen";
  } else if (
    isComplete &&
    purchase.remainingSafeToSpend !== null &&
    safe.safetyBuffer !== null &&
    (futureRisk || projectionIncomplete || purchase.remainingSafeToSpend < safe.safetyBuffer * 0.5)
  ) {
    status = "precaucion";
  } else if (isComplete) {
    status = "dentro_del_margen";
  }

  const verdict =
    status === "datos_incompletos"
      ? "DATOS_INCOMPLETOS"
      : status === "excede_el_margen"
        ? "COMPROMETE"
        : status === "precaucion"
          ? "PRECAUCION"
          : "VIABLE";
  const badgeLabel =
    status === "datos_incompletos"
      ? "Datos financieros incompletos"
      : status === "excede_el_margen"
        ? "Compromete tu quincena"
        : status === "precaucion"
          ? futureRisk ? "Riesgo en la proyección" : projectionIncomplete ? "Proyección por confirmar" : "Viable con precaución"
          : itemPrice === null ? "Margen calculado" : "Compra viable hoy";

  const remaining = purchase.remainingSafeToSpend;
  const remainingAfterPurchase =
    purchase.status === "evaluada" &&
    purchase.assessment === "excede_margen" &&
    purchase.exceedsBy !== null
      ? -purchase.exceedsBy
      : remaining;
  const pct =
    safe.safeToSpend !== null && remaining !== null && safe.safeToSpend > 0
      ? Math.round((remaining / safe.safeToSpend) * 100)
      : null;
  const headlineLine1 = itemPrice === null
    ? safe.safeToSpend === null
      ? "Falta información para calcular tu margen. Los importes registrados siguen disponibles."
      : futureRisk
        ? `Tu margen inmediato estimado es $${safe.safeToSpend.toLocaleString()} MXN, pero la simulación muestra riesgo de tocar fondos protegidos en las semanas ${riskWeeks.join(", ")}.`
        : projectionIncomplete
          ? `Tu margen inmediato estimado es $${safe.safeToSpend.toLocaleString()} MXN. La proyección futura está incompleta.`
          : `Tu margen inmediato estimado es $${safe.safeToSpend.toLocaleString()} MXN según los datos registrados.`
    : status === "datos_incompletos"
      ? "No podemos evaluar esta compra con seguridad porque faltan datos financieros."
      : status === "excede_el_margen"
        ? purchase.exceedsBy !== null
          ? `"${itemName}" supera tu margen calculado por $${purchase.exceedsBy.toLocaleString()} MXN.`
          : `"${itemName}" supera tu margen calculado.`
        : status === "precaucion"
          ? futureRisk
            ? `"${itemName}" cabe en el margen inmediato, pero la simulación muestra riesgo de tocar fondos protegidos en las semanas ${riskWeeks.join(", ")}.`
            : projectionIncomplete
              ? `"${itemName}" cabe en el margen inmediato; la proyección futura está incompleta y no confirma su viabilidad.`
              : `"${itemName}" cabe en tu margen, pero dejaría poco dinero libre adicional.`
          : `"${itemName}" está dentro de tu margen calculado.`;

  return {
    status,
    summary: itemPrice === null,
    detectedItemName: itemName,
    detectedItemPrice: itemPrice ?? 0,
    verdict,
    badgeLabel,
    headlineLine1,
    headlineLine2: purchase.explanation,
    safeToSpend: isComplete ? safe.safeToSpend : null,
    daysUntilNextIncome: profile.nextPaydayDays,
    remainingAfterBuyToday: isComplete ? remainingAfterPurchase : null,
    remainingFreeSafe: isComplete ? remaining : null,
    exceedsBy: isComplete ? purchase.exceedsBy : null,
    freeMoneyRemainingPct: isComplete ? pct : null,
    usedByPurchasePct: isComplete && pct !== null ? 100 - pct : null,
    daysGoalDelayed: null,
    liquidityAfterPayday: null,
    remainingIfWaitPayday: null,
    waitRemainingPct: null,
    suggestedWeeklySave: null,
    weeksNeeded: null,
    consideredExpenses: {
      currentBalance: safe.currentBalance,
      essentialExpenses: safe.essentialExpenses,
      pendingCommitments: safe.pendingCommitments,
      pendingDebtPayments: safe.pendingDebtPayments,
      safetyBuffer: safe.safetyBuffer,
      protectedSavings: safe.protectedSavings ?? registeredData.protectedSavings,
    },
    missingInformation,
    registeredData,
    projectionLimitations,
    projectionStatus: projectionBefore.status,
    projection:
      projectionBefore.status === "calculado"
        ? projectionBefore
        : null,
    projectionAfter:
      projectionAfter?.status === "calculado"
        ? projectionAfter
        : null,
    projectedBalanceDifference,
    goalImpact,
    purchaseDecision: report ? purchase : undefined,
    purchaseReport: report,
    source: "deterministic",
  };
}

