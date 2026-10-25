
/**
 * ANTES DE GASTAR
 * Impacto de retirar dinero de una meta.
 *
 * Solo simula un retiro explícito.
 * No asume que toda compra usa los ahorros.
 */

import type { FinancialGoal } from "./financialTypes";

export interface GoalImpactResult {
  goalTitle: string;
  savedBefore: number;
  savedAfter: number;
  remainingBefore: number;
  remainingAfter: number;
  weeksBefore: number | null;
  weeksAfter: number | null;
  delayedByWeeks: number | null;
}

// Convertir pesos a centavos
function toCents(amount: number): number {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Cantidad inválida");
  }

  return Math.round(amount * 100);
}

// Semanas necesarias para alcanzar una meta
function calculateWeeks(
  remaining: number,
  weeklyContribution: number | null | undefined
): number | null {
  if (remaining <= 0) {
    return 0;
  }

  if (
    weeklyContribution == null ||
    weeklyContribution <= 0
  ) {
    return null;
  }

  return Math.ceil(
    remaining / toCents(weeklyContribution)
  );
}

// ==========================================
// IMPACTO SOBRE LA META
// ==========================================

export function calculateGoalImpact(
  goal: FinancialGoal,
  amountFromGoal: number
): GoalImpactResult {
  if (goal.targetAmount === null || goal.currentSaved === null) {
    throw new Error("Los datos de la meta están incompletos.");
  }
  const target = toCents(goal.targetAmount);
  const saved = toCents(goal.currentSaved);
  const withdrawal = toCents(amountFromGoal);

  if (withdrawal > saved) {
    throw new Error(
      "No puedes retirar más de lo ahorrado."
    );
  }

  if (goal.weeklyContribution != null) {
    toCents(goal.weeklyContribution);
  }

  const savedAfter = saved - withdrawal;

  const remainingBefore = Math.max(
    0,
    target - saved
  );

  const remainingAfter = Math.max(
    0,
    target - savedAfter
  );

  const weeksBefore = calculateWeeks(
    remainingBefore,
    goal.weeklyContribution
  );

  const weeksAfter = calculateWeeks(
    remainingAfter,
    goal.weeklyContribution
  );

  const delayedByWeeks =
    weeksBefore !== null && weeksAfter !== null
      ? weeksAfter - weeksBefore
      : null;

  return {
    goalTitle: goal.title,
    savedBefore: saved / 100,
    savedAfter: savedAfter / 100,
    remainingBefore: remainingBefore / 100,
    remainingAfter: remainingAfter / 100,
    weeksBefore,
    weeksAfter,
    delayedByWeeks,
  };
}
