import type { Commitment, OnboardingProfile } from "../onboarding/financialTypes";
import { calculateSafeToSpend } from "../onboarding/financialEngine";
import { projectSixWeeks } from "../onboarding/weeklyProjection";
import { validPurchasePrice } from "./money";

const cents = (amount: number) => Math.round(amount * 100);
export function allGoals(profile: OnboardingProfile) {
  return [...new Map([...(profile.goals ?? []), ...(profile.primaryGoal ? [profile.primaryGoal] : [])].map(goal => [goal.id, goal])).values()];
}

/** Future contributions are explicit reserved transfers for these additional scenarios.
 * The underlying engine/report is unchanged: its documented baseline excludes them. */
export function withGoalContributions(profile: OnboardingProfile): OnboardingProfile | null {
  const goals = allGoals(profile);
  if (goals.some(g => g.weeklyContribution == null || !Number.isFinite(g.weeklyContribution) || g.weeklyContribution < 0)) return null;
  const transfers: Commitment[] = goals.filter(g => (g.weeklyContribution ?? 0) > 0).map((g, i) => ({
    id: `reserved-contribution-${i}`, title: "Aportación comprometida a meta", amount: g.weeklyContribution!,
    frequency: "semanal", dueInDays: 7, category: "Ahorro", kind: "meta", isConfirmed: true,
  }));
  return { ...profile, commitments: [...profile.commitments, ...transfers] };
}

export interface SavingsPlan {
  status: "calculado" | "no_sostenible" | "datos_incompletos";
  target: number;
  upfrontAmount: number;
  remainingTarget: number;
  weeklyCapacity: number | null;
  weeklyContribution: number | null;
  weeks: number | null;
  requestedWeeks: number | null;
  estimatedDate: string | null;
  beyondProjection: boolean;
  limitations: string[];
}

export function calculateSavingsPlan(profile: OnboardingProfile, target: number, options: {
  weeks?: number | null; weeklyContribution?: number | null; upfrontAmount?: number | null; financialDate?: string;
} = {}): SavingsPlan {
  if (!validPurchasePrice(target)) throw Error("Precio inválido");
  const upfront = options.upfrontAmount ?? 0; // No current money is assigned without an explicit instruction.
  if (upfront !== 0 && !validPurchasePrice(upfront)) throw Error("Apartado inválido");
  if (options.weeks != null && (!Number.isInteger(options.weeks) || options.weeks < 1 || options.weeks > 520)) throw Error("Plazo inválido");
  if (options.weeklyContribution != null && !validPurchasePrice(options.weeklyContribution)) throw Error("Aportación inválida");
  const remaining = Math.max(0, cents(target) - cents(upfront));
  const result: SavingsPlan = {
    status: "datos_incompletos", target, upfrontAmount: upfront, remainingTarget: remaining / 100,
    weeklyCapacity: null, weeklyContribution: null, weeks: null, requestedWeeks: options.weeks ?? null,
    estimatedDate: null, beyondProjection: false, limitations: [],
  };
  const reserved = withGoalContributions(profile);
  if (!reserved) { result.limitations.push("Confirma las aportaciones semanales ya comprometidas a todas tus metas."); return result; }
  const safe = calculateSafeToSpend(reserved);
  const before = projectSixWeeks(reserved);
  if (safe.safeToSpend === null || before.status !== "calculado" || profile.nextPaydayAmount === null || profile.dailyEssentialBurn === null) {
    result.limitations.push("Faltan fechas, importes, ubicación de ahorros o calendarios compatibles; los ingresos variables y los vencimientos mensuales repetidos no se extrapolan."); return result;
  }
  if (cents(upfront) > cents(safe.safeToSpend) || upfront > target) {
    result.status = "no_sostenible"; result.limitations.push("El apartado inicial supera el margen calculado o el precio objetivo."); return result;
  }
  // Bound by recurring net surplus, so the six-week window cannot justify consuming capital forever.
  const interval = profile.payFrequency === "semanal" ? 1 : 2;
  let weeklyNet = Math.floor(cents(profile.nextPaydayAmount) / interval) - cents(profile.dailyEssentialBurn) * 7;
  for (const payment of [...reserved.commitments.map(c => ({ amount: c.amount, frequency: c.frequency })), ...reserved.debts.map(d => ({ amount: d.nextPayment, frequency: d.frequency }))]) {
    if (payment.amount === null || payment.frequency === null || payment.frequency === "mensual") {
      result.limitations.push("Necesito confirmar el calendario de los pagos antes de estimar una aportación constante."); return result;
    }
    if (payment.frequency !== "unico") weeklyNet -= Math.ceil(cents(payment.amount) / (payment.frequency === "semanal" ? 1 : 2));
  }
  const canReserve = (weekly: number) => {
    const scenario: OnboardingProfile = { ...reserved, currentBalance: (cents(profile.currentBalance!) - cents(upfront)) / 100,
      commitments: [...reserved.commitments, { id: "purchase-saving-simulation", title: "Apartado para compra", amount: weekly / 100,
        dueInDays: 7, frequency: "semanal", category: "Ahorro", kind: "meta", isConfirmed: true }] };
    const projection = projectSixWeeks(scenario);
    return calculateSafeToSpend(scenario).shortfall === 0 && projection.status === "calculado" && !projection.weeks.some(w => w.belowProtectedFunds);
  };
  let lo = 0, hi = Math.max(0, weeklyNet);
  if (!canReserve(0)) hi = 0;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (canReserve(mid)) lo = mid; else hi = mid - 1;
  }
  result.weeklyCapacity = lo / 100;
  const required = options.weeks ? Math.ceil(remaining / options.weeks) : null;
  const contribution = options.weeklyContribution != null ? cents(options.weeklyContribution) : required ?? lo;
  result.weeklyContribution = contribution / 100;
  result.weeks = remaining === 0 ? 0 : contribution > 0 ? Math.ceil(remaining / contribution) : null;
  const fitsDeadline = options.weeks == null || (result.weeks !== null && result.weeks <= options.weeks);
  result.status = canReserve(0) && (remaining === 0 || contribution > 0 && contribution <= lo && fitsDeadline) ? "calculado" : "no_sostenible";
  result.beyondProjection = (result.weeks ?? options.weeks ?? 0) > 6;
  result.limitations.push("Estimación condicionada a ingresos y aportaciones constantes, gastos registrados y transferencias semanales desde el saldo; no garantiza solvencia.");
  if (result.beyondProjection) result.limitations.push("Después de seis semanas es una estimación aritmética, no una proyección financiera completa.");
  if (result.status === "no_sostenible") result.limitations.push("La aportación solicitada no cabe en la capacidad comprobada o hay riesgo previo; revisemos el plazo o los gastos registrados.");
  if (result.status === "calculado" && result.weeks !== null && options.financialDate && /^\d{4}-\d{2}-\d{2}$/.test(options.financialDate)) {
    const date = new Date(`${options.financialDate}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + result.weeks * 7);
    result.estimatedDate = date.toISOString().slice(0, 10);
  }
  return result;
}
