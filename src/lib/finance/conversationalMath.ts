import type { OnboardingProfile } from "../onboarding/financialTypes";
import { protectedSavingsCents } from "../onboarding/protectedFunds";
import { projectSixWeeks } from "../onboarding/weeklyProjection";
import { validPurchasePrice } from "./money";
import { withGoalContributions } from "./savingsPlan";

function nonNegativeCents(value: number | null): number | null {
  if (value === 0) return 0;
  return validPurchasePrice(value) ? Math.round(value * 100) : null;
}

function validateWeeks(weeks: number): void {
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > 520) throw new Error("Plazo inválido");
}

export interface HypotheticalPurchaseBalance {
  status: "calculado" | "saldo_insuficiente" | "datos_incompletos";
  registeredBalance: number | null;
  purchaseAmount: number;
  hypotheticalBalance: number | null;
  balanceShortfall: number | null;
}

/** Accounting subtraction only. This result is neither a spending margin nor a recommendation. */
export function calculateHypotheticalPurchaseBalance(
  currentBalance: number | null,
  purchaseAmount: number,
): HypotheticalPurchaseBalance {
  if (!validPurchasePrice(purchaseAmount)) throw new Error("Precio inválido");
  const balance = nonNegativeCents(currentBalance);
  const price = Math.round(purchaseAmount * 100);
  if (balance === null) return {
    status: "datos_incompletos", registeredBalance: null, purchaseAmount,
    hypotheticalBalance: null, balanceShortfall: null,
  };
  if (price > balance) return {
    status: "saldo_insuficiente", registeredBalance: balance / 100, purchaseAmount,
    hypotheticalBalance: null, balanceShortfall: (price - balance) / 100,
  };
  return {
    status: "calculado", registeredBalance: balance / 100, purchaseAmount,
    hypotheticalBalance: (balance - price) / 100, balanceShortfall: 0,
  };
}

export interface ArithmeticSavingsTarget {
  basis: "objetivo_aritmetico";
  target: number;
  upfrontAmount: number;
  remainingTarget: number;
  requestedWeeks: number | null;
  requiredWeeklyContribution: number | null;
  weeklyContribution: number | null;
  estimatedWeeks: number | null;
  meetsRequestedDeadline: boolean | null;
  sustainability: "sin_evaluar";
}

/** Only explicitly earmarked money reduces the target; no profile balance is assigned to this purchase. */
export function calculateSavingsTarget(target: number, options: {
  weeks?: number | null;
  weeklyContribution?: number | null;
  upfrontAmount?: number | null;
} = {}): ArithmeticSavingsTarget {
  if (!validPurchasePrice(target)) throw new Error("Precio inválido");
  const upfrontAmount = options.upfrontAmount ?? 0;
  const upfront = nonNegativeCents(upfrontAmount);
  if (upfront === null) throw new Error("Apartado inválido");
  if (options.weeks != null) validateWeeks(options.weeks);
  if (options.weeklyContribution != null && !validPurchasePrice(options.weeklyContribution)) {
    throw new Error("Aportación inválida");
  }
  const remaining = Math.max(0, Math.round(target * 100) - upfront);
  const required = options.weeks == null ? null : Math.ceil(remaining / options.weeks);
  const contribution = options.weeklyContribution == null ? required : Math.round(options.weeklyContribution * 100);
  const estimatedWeeks = remaining === 0 ? 0 : contribution !== null && contribution > 0 ? Math.ceil(remaining / contribution) : null;
  return {
    basis: "objetivo_aritmetico", target, upfrontAmount, remainingTarget: remaining / 100,
    requestedWeeks: options.weeks ?? null,
    requiredWeeklyContribution: required === null ? null : required / 100,
    weeklyContribution: contribution === null ? null : contribution / 100,
    estimatedWeeks,
    meetsRequestedDeadline: options.weeks == null || estimatedWeeks === null ? null : estimatedWeeks <= options.weeks,
    sustainability: "sin_evaluar",
  };
}

export interface ExplicitWaitScenario {
  status: "calculado" | "datos_incompletos";
  purchaseAmount: number;
  requestedWeeks: number;
  requestedDays: number;
  withinProjectionHorizon: boolean;
  currentBalance: number | null;
  essentialExpensesDuringWait: number | null;
  projectedBalance: number | null;
  hypotheticalBalanceAfterPurchase: number | null;
  balanceShortfall: number | null;
  protectedFunds: number | null;
  belowProtectedFundsAfterPurchase: boolean | null;
  riskWeeksDuringWait: number[];
  limitations: string[];
}

/** Read the requested weekly checkpoint from Sebas' engine; never extend its six-week horizon. */
export function calculateWaitScenario(
  profile: OnboardingProfile,
  purchaseAmount: number,
  weeks: number,
): ExplicitWaitScenario {
  if (!validPurchasePrice(purchaseAmount)) throw new Error("Precio inválido");
  validateWeeks(weeks);
  const days = weeks * 7;
  const balance = nonNegativeCents(profile.currentBalance);
  const dailyExpenses = nonNegativeCents(profile.dailyEssentialBurn);
  const essentialExpenses = dailyExpenses === null ? null : dailyExpenses * days;
  const result: ExplicitWaitScenario = {
    status: "datos_incompletos", purchaseAmount, requestedWeeks: weeks, requestedDays: days,
    withinProjectionHorizon: weeks <= 6, currentBalance: balance === null ? null : balance / 100,
    essentialExpensesDuringWait: essentialExpenses !== null && Number.isSafeInteger(essentialExpenses) ? essentialExpenses / 100 : null,
    projectedBalance: null, hypotheticalBalanceAfterPurchase: null, balanceShortfall: null,
    protectedFunds: null, belowProtectedFundsAfterPurchase: null, riskWeeksDuringWait: [], limitations: [],
  };
  if (weeks > 6) {
    result.limitations.push("El plazo solicitado supera las seis semanas que puede simular el motor; no se extrapolan ingresos ni saldos.");
    return result;
  }
  const reserved = withGoalContributions(profile);
  if (!reserved) {
    result.limitations.push("Falta confirmar las aportaciones semanales comprometidas a las metas.");
    return result;
  }
  const projection = projectSixWeeks(reserved);
  if (projection.status !== "calculado") {
    result.limitations.push("No se puede proyectar el saldo al esperar sin ingresos, fechas y obligaciones compatibles y completos; el gasto esencial mostrado es solo aritmético.");
    return result;
  }
  const checkpoint = projection.weeks[weeks - 1];
  const projectedCents = Math.round(checkpoint.endBalance * 100);
  const price = Math.round(purchaseAmount * 100);
  const savings = protectedSavingsCents(reserved);
  const buffer = nonNegativeCents(reserved.safetyBuffer);
  const protectedFunds = savings === null || buffer === null ? null : savings + buffer;
  result.status = "calculado";
  result.projectedBalance = checkpoint.endBalance;
  result.balanceShortfall = Math.max(0, price - projectedCents) / 100;
  result.hypotheticalBalanceAfterPurchase = projectedCents >= price ? (projectedCents - price) / 100 : null;
  result.protectedFunds = protectedFunds === null ? null : protectedFunds / 100;
  result.belowProtectedFundsAfterPurchase = result.hypotheticalBalanceAfterPurchase === null || protectedFunds === null
    ? null : projectedCents - price < protectedFunds;
  result.riskWeeksDuringWait = projection.weeks.slice(0, weeks).filter(week => week.belowProtectedFunds).map(week => week.week);
  result.limitations.push("Simulación condicionada a los ingresos y pagos registrados, con aportaciones comprometidas a metas; no garantiza ingresos futuros.");
  result.limitations.push("El saldo al esperar y el saldo contable tras la compra no son margen seguro; no se ha proyectado el período posterior a esa compra futura.");
  return result;
}
