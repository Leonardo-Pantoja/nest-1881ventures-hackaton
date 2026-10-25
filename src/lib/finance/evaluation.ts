import { buildPurchaseReport, calculateSafeToSpend, evaluatePurchase, projectSixWeeks } from "../onboarding";
import type { OnboardingProfile } from "../onboarding/financialTypes";

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
    | "Viable con precaución"
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
  projectionStatus: "calculado" | "datos_incompletos";
  projection: ReturnType<typeof buildPurchaseReport>["projectionBefore"] | null;
  goalImpact: null;
  source: "deterministic";
  financialRevision?: string;
}

export function buildDeterministicEvaluation(
  itemName: string,
  itemPrice: number | null,
  profile: OnboardingProfile,
): EvaluateApiResponse {
  const safe = calculateSafeToSpend(profile);
  const purchase = itemPrice === null ? { status: safe.status === "calculado" ? "evaluada" : "datos_incompletos", assessment: "dentro_del_margen", remainingSafeToSpend: safe.safeToSpend, exceedsBy: 0, explanation: "Resumen del margen disponible calculado." } : evaluatePurchase(profile, itemPrice);
  const projectionBefore = itemPrice === null ? projectSixWeeks(profile) : buildPurchaseReport(profile, itemPrice).projectionBefore;
  const isComplete =
    profile.isOnboarded &&
    safe.status === "calculado" &&
    safe.safeToSpend !== null &&
    purchase.status === "evaluada" &&
    purchase.remainingSafeToSpend !== null;
  const missingInformation: string[] = [];
  if (!profile.isOnboarded) missingInformation.push("Onboarding financiero incompleto.");
  if (profile.currentBalance === null) missingInformation.push("Saldo actual desconocido.");
  if (profile.nextPaydayDays === null) missingInformation.push("Fecha del próximo ingreso desconocida.");
  if (profile.nextPaydayAmount === null) missingInformation.push("Importe del próximo ingreso desconocido.");
  if (profile.dailyEssentialBurn === null) missingInformation.push("Gastos esenciales diarios desconocidos.");
  if (profile.safetyBuffer === null) missingInformation.push("Colchón de seguridad desconocido.");
  if (
    profile.commitments.some(
      (item) =>
        item.amount === null ||
        item.dueInDays === null ||
        item.frequency === null ||
        item.isConfirmed === false,
    )
  ) {
    missingInformation.push("Hay compromisos con importe, fecha o frecuencia sin confirmar.");
  }
  if (
    profile.debts.some(
      (debt) =>
        debt.nextPayment === null ||
        debt.dueInDays === null ||
        debt.frequency === null,
    )
  ) {
    missingInformation.push("Hay pagos de deuda con importe, fecha o frecuencia desconocidos.");
  }
  if (
    profile.primaryGoal &&
    (profile.primaryGoal.currentSaved === null ||
      profile.primaryGoal.targetAmount === null ||
      (profile.primaryGoal.currentSaved > 0 &&
        profile.primaryGoal.savingsLocation === "desconocido"))
  ) {
    missingInformation.push("Falta información sobre el saldo o la ubicación de los ahorros de tu meta.");
  }
  if (!isComplete && missingInformation.length === 0) {
    missingInformation.push("Faltan datos necesarios para calcular el margen disponible.");
  }

  let status: EvaluationStatus = "datos_incompletos";
  if (isComplete && purchase.assessment === "excede_margen") {
    status = "excede_el_margen";
  } else if (
    isComplete &&
    purchase.remainingSafeToSpend !== null &&
    safe.safetyBuffer !== null &&
    purchase.remainingSafeToSpend < safe.safetyBuffer * 0.5
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
          ? "Viable con precaución"
          : "Compra viable hoy";

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
  const headlineLine1 =
    status === "datos_incompletos"
      ? "No podemos evaluar esta compra con seguridad porque faltan datos financieros."
      : status === "excede_el_margen"
        ? purchase.exceedsBy !== null
          ? `"${itemName}" supera tu margen calculado por $${purchase.exceedsBy.toLocaleString()} MXN.`
          : `"${itemName}" supera tu margen calculado.`
        : status === "precaucion"
          ? `"${itemName}" cabe en tu margen, pero dejaría menos de la mitad de tu colchón de seguridad disponible.`
          : `"${itemName}" está dentro de tu margen calculado.`;

  return {
    status,
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
      protectedSavings: safe.protectedSavings,
    },
    missingInformation,
    projectionStatus: projectionBefore.status,
    projection:
      projectionBefore.status === "calculado"
        ? projectionBefore
        : null,
    goalImpact: null,
    source: "deterministic",
  };
}

