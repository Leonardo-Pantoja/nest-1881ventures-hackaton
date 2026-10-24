
/**
 * ANTES DE GASTAR
 * Evaluador de compras
 *
 * Compara una compra con el dinero
 * disponible calculado por Safe-to-Spend.
 */

import type { OnboardingProfile } from "./financialTypes";

import { calculateSafeToSpend } from "./financialEngine";

// ==========================================
// TIPOS DE RESULTADO
// ==========================================

export interface PurchaseDecision {
  status: "evaluada" | "datos_incompletos";
  assessment:
    | "dentro_del_margen"
    | "excede_margen"
    | "no_evaluable";
  purchaseAmount: number;
  safeToSpend: number | null;
  remainingSafeToSpend: number | null;
  exceedsBy: number | null;
  explanation: string;
}

// ==========================================
// VALIDAR CANTIDADES
// ==========================================

function toCents(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(
      "El precio debe ser un número positivo."
    );
  }

  return Math.round(amount * 100);
}

// ==========================================
// EVALUAR COMPRA
// ==========================================

export function evaluatePurchase(
  profile: OnboardingProfile,
  purchaseAmount: number
): PurchaseDecision {
  const price = toCents(purchaseAmount);

  const financialResult =
    calculateSafeToSpend(profile);

  if (
    financialResult.status === "datos_incompletos" ||
    financialResult.safeToSpend === null
  ) {
    return {
      status: "datos_incompletos",
      assessment: "no_evaluable",
      purchaseAmount: price / 100,
      safeToSpend: null,
      remainingSafeToSpend: null,
      exceedsBy: null,
      explanation:
        "Faltan datos financieros para evaluar esta compra.",
    };
  }

  const available = Math.round(
    financialResult.safeToSpend * 100
  );

  const remaining = available - price;

  // COMPRA DENTRO DEL MARGEN
  if (remaining >= 0) {
    return {
      status: "evaluada",
      assessment: "dentro_del_margen",
      purchaseAmount: price / 100,
      safeToSpend: available / 100,
      remainingSafeToSpend: remaining / 100,
      exceedsBy: 0,
      explanation:
        "La compra está dentro de tu margen calculado. Verifica que tus datos estén actualizados.",
    };
  }

  // COMPRA QUE EXCEDE EL MARGEN
  return {
    status: "evaluada",
    assessment: "excede_margen",
    purchaseAmount: price / 100,
    safeToSpend: available / 100,
    remainingSafeToSpend: 0,
    exceedsBy: Math.abs(remaining) / 100,
    explanation:
      "Esta compra supera tu margen disponible y podría comprometer gastos o reservas.",
  };
}
