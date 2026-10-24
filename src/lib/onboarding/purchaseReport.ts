
/**
 * ANTES DE GASTAR
 * Reporte integrado de una compra.
 *
 * Escenario: compra pagada con saldo actual.
 * No retira dinero de metas de ahorro.
 */

import type { OnboardingProfile } from "./financialTypes";

import {
  evaluatePurchase,
  type PurchaseDecision,
} from "./purchaseDecision";

import {
  calculateGoalImpact,
  type GoalImpactResult,
} from "./goalImpact";

import {
  projectSixWeeks,
  type SixWeekProjection,
} from "./weeklyProjection";

export interface PurchaseReport {
  status:
    | "calculado"
    | "datos_incompletos"
    | "saldo_insuficiente";

  purchase: PurchaseDecision;
  goalImpact: GoalImpactResult | null;
  projectionBefore: SixWeekProjection;
  projectionAfter: SixWeekProjection | null;
  projectedBalanceDifference: number | null;
}

// ==========================================
// CONSTRUIR REPORTE
// ==========================================

export function buildPurchaseReport(
  profile: OnboardingProfile,
  purchaseAmount: number
): PurchaseReport {
  // 1. Evaluar la compra
  const purchase = evaluatePurchase(
    profile,
    purchaseAmount
  );

  const amountCents = Math.round(
    purchaseAmount * 100
  );

  if (amountCents < 1) {
    throw new Error(
      "La compra debe ser de al menos $0.01."
    );
  }

  if (profile.currentBalance === null) {
    return {
      status: "datos_incompletos",
      purchase,
      goalImpact: null,
      projectionBefore: projectSixWeeks(profile),
      projectionAfter: null,
      projectedBalanceDifference: null,
    };
  }

  const balanceCents = Math.round(profile.currentBalance * 100);

  // 2. La meta no se toca en este escenario
  const goalImpact =
    profile.primaryGoal &&
    profile.primaryGoal.targetAmount !== null &&
    profile.primaryGoal.currentSaved !== null
    ? calculateGoalImpact(
        profile.primaryGoal,
        0
      )
    : null;

  // 3. Proyección sin realizar la compra
  const projectionBefore = projectSixWeeks(
    profile
  );

  // 4. Comprobar si alcanza el saldo actual
  if (amountCents > balanceCents) {
    return {
      status: "saldo_insuficiente",
      purchase,
      goalImpact,
      projectionBefore,
      projectionAfter: null,
      projectedBalanceDifference: null,
    };
  }

  // 5. Simular compra sin modificar el perfil
  const profileAfterPurchase: OnboardingProfile = {
    ...profile,
    currentBalance:
      (balanceCents - amountCents) / 100,
  };

  const projectionAfter = projectSixWeeks(
    profileAfterPurchase
  );

  // 6. Identificar si faltan datos
  const incomplete =
    purchase.status === "datos_incompletos" ||
    projectionBefore.status === "datos_incompletos" ||
    projectionAfter.status === "datos_incompletos";

  if (incomplete) {
    return {
      status: "datos_incompletos",
      purchase,
      goalImpact,
      projectionBefore,
      projectionAfter,
      projectedBalanceDifference: null,
    };
  }

  // 7. Diferencia en saldo final proyectado
  const lastWeekBefore =
    projectionBefore.weeks[5];

  const lastWeekAfter =
    projectionAfter.weeks[5];

  const differenceCents =
    Math.round(lastWeekAfter.endBalance * 100) -
    Math.round(lastWeekBefore.endBalance * 100);

  return {
    status: "calculado",
    purchase,
    goalImpact,
    projectionBefore,
    projectionAfter,
    projectedBalanceDifference:
      differenceCents / 100,
  };
}
