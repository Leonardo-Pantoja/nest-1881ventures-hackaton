import type { OnboardingProfile } from "../onboarding/financialTypes";
import { protectedSavingsCents } from "../onboarding/protectedFunds";

const warningMessages: Record<string, string> = {
  income_sources_missing: "La consulta no muestra fuentes de ingreso activas y visibles. Revisa el perfil; eso no demuestra que se hayan borrado datos.",
  income_date_missing: "Falta la fecha de pago de una fuente de ingreso.",
  income_date_overdue: "Una fecha de ingreso registrada ya pasó; confirma si se recibió el pago y registra la próxima fecha.",
  income_date_invalid: "Una fuente de ingreso tiene una fecha de pago inválida.",
  income_amount_unknown: "Falta confirmar el importe de una fuente de ingreso.",
  income_frequency_unknown: "La frecuencia de una fuente de ingreso es desconocida o variable.",
  multiple_income_calendars: "Las fuentes activas no pueden representarse como una sola nómina repetida. Solo se usa un próximo pago cuando su fecha está confirmada en todas las fuentes; no se extrapolan calendarios incompatibles.",
  overdue_commitment: "Hay un compromiso vencido; confirma su estado y calendario antes de proyectar pagos recurrentes.",
  overdue_debt: "Hay un pago de deuda vencido; confirma su estado y calendario antes de proyectar pagos recurrentes.",
  commitment_date_missing: "Falta la fecha de vencimiento de un compromiso.",
  commitment_date_invalid: "Un compromiso tiene una fecha de vencimiento inválida.",
  debt_date_missing: "Falta la fecha de pago de una deuda.",
  debt_date_invalid: "Una deuda tiene una fecha de pago inválida.",
};

/** Describe missing inputs without inferring unknown account values or weakening engine rules. */
export function getFinancialMissingInformation(profile: OnboardingProfile): string[] {
  const reasons: string[] = [];
  if (!profile.isOnboarded) reasons.push("Onboarding financiero incompleto.");
  if (profile.currentBalance === null) reasons.push("Saldo actual desconocido.");
  if (profile.nextPaydayDays === null) reasons.push("Fecha del próximo ingreso sin confirmar.");
  if (profile.nextPaydayAmount === null) reasons.push("Importe del próximo ingreso sin confirmar; se necesita para proyectar ingresos futuros.");
  if (profile.dailyEssentialBurn === null) reasons.push("Presupuesto de gastos esenciales diarios sin confirmar.");
  if (profile.safetyBuffer === null) reasons.push("Reserva de seguridad sin confirmar.");
  const goals = [...new Map([...(profile.goals ?? []), ...(profile.primaryGoal ? [profile.primaryGoal] : [])].map(goal => [goal.id, goal])).values()];
  if (goals.some(goal => goal.currentSaved === null || goal.targetAmount === null)) reasons.push("Falta confirmar el saldo u objetivo de una meta.");
  if (goals.some(goal => (goal.currentSaved ?? 0) > 0 && goal.savingsLocation === "desconocido")) reasons.push("Confirma si los ahorros de tus metas están incluidos en el saldo o separados de él.");
  if (profile.commitments.some(item => item.amount === null)) reasons.push("Hay compromisos con importe sin confirmar.");
  if (profile.commitments.some(item => item.dueInDays === null)) reasons.push("Hay compromisos con fecha de vencimiento sin confirmar.");
  if (profile.commitments.some(item => item.frequency === null || item.isConfirmed === false)) reasons.push("Hay compromisos con frecuencia o confirmación pendiente.");
  if (profile.commitments.some(item => item.kind === "deuda")) reasons.push("Un pago de deuda aparece como compromiso y requiere clasificación para evitar duplicarlo.");
  if (profile.debts.some(debt => debt.nextPayment === null)) reasons.push("Hay pagos de deuda con importe sin confirmar.");
  if (profile.debts.some(debt => debt.dueInDays === null || debt.frequency === null)) reasons.push("Hay pagos de deuda con fecha o frecuencia sin confirmar.");
  for (const warning of profile.dataWarnings ?? []) if (warningMessages[warning]) reasons.push(warningMessages[warning]);
  return [...new Set(reasons)];
}

export function getFinancialProjectionLimitations(profile: OnboardingProfile): string[] {
  const limitations = getFinancialMissingInformation(profile);
  if (!["semanal", "quincenal"].includes(profile.payFrequency)) limitations.push("La proyección requiere un calendario fijo semanal o quincenal; no se extrapolan ingresos variables ni meses de duración desconocida.");
  if (profile.nextPaydayDays === 0) limitations.push("Hay un ingreso previsto para hoy; confirma su recepción y el próximo pago antes de proyectar semanas futuras.");
  if ([...profile.commitments, ...profile.debts].some(payment => payment.frequency === "mensual" && payment.dueInDays !== null && payment.dueInDays <= 14)) limitations.push("Faltan fechas mensuales exactas para calcular los vencimientos repetidos durante seis semanas.");
  return [...new Set(limitations)];
}

/** Independent registered amounts remain visible when a horizon-dependent calculation is unavailable. */
export function getRegisteredFinancialData(profile: OnboardingProfile) {
  const savings = protectedSavingsCents(profile);
  return {
    currentBalance: profile.currentBalance,
    safetyBuffer: profile.safetyBuffer,
    dailyEssentialBudget: profile.dailyEssentialBurn,
    protectedSavings: savings === null ? null : savings / 100,
    nextIncomeAmount: profile.nextPaydayAmount,
    nextIncomeDays: profile.nextPaydayDays,
    incomeSources: profile.incomeSources ?? (profile.nextPaydayAmount !== null || profile.nextPaydayDays !== null ? [{
      amount: profile.nextPaydayAmount, frequency: profile.payFrequency, nextPaymentDate: null,
      nextPaymentDays: profile.nextPaydayDays, dateStatus: profile.nextPaydayDays === null ? "missing" as const : "known" as const,
    }] : []),
  };
}
