
/**
 * ANTES DE GASTAR
 * Motor financiero determinista
 *
 * Calcula el dinero disponible antes
 * del próximo ingreso conocido.
 */

import type {
  OnboardingProfile,
  CommitmentFrequency,
} from "./financialTypes";

// ==========================================
// TIPOS DE RESULTADO
// ==========================================

export interface SafeToSpendResult {
  status: "calculado" | "datos_incompletos";
  currentBalance: number;
  essentialExpenses: number;
  pendingCommitments: number;
  pendingDebtPayments: number;
  safetyBuffer: number;
  protectedSavings: number;
  safeToSpend: number | null;
  shortfall: number | null;
}

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================

// Trabajamos en centavos para reducir
// problemas con decimales.
function toCents(amount: number): number {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(
      "El importe debe ser un número no negativo."
    );
  }

  return Math.round(amount * 100);
}

// Determina cuántas veces vence un pago
// dentro del periodo analizado.
function contarPagos(
  dueInDays: number,
  frequency: CommitmentFrequency,
  days: number
): number | null {
  if (
    !Number.isInteger(dueInDays) ||
    dueInDays < 0
  ) {
    return null;
  }

  if (dueInDays > days) {
    return 0;
  }

  if (frequency === "unico") {
    return 1;
  }

  if (frequency === "semanal") {
    return Math.floor(
      (days - dueInDays) / 7
    ) + 1;
  }

  if (frequency === "quincenal") {
    return Math.floor(
      (days - dueInDays) / 14
    ) + 1;
  }

  if (frequency === "mensual") {
    // Los meses no duran siempre 30 días.
    // Si puede existir un segundo vencimiento,
    // necesitamos fechas exactas para calcularlo.
    if (dueInDays + 28 <= days) {
      return null;
    }

    return 1;
  }

  return null;
}

// ==========================================
// SAFE TO SPEND
// ==========================================

export function calculateSafeToSpend(
  profile: OnboardingProfile
): SafeToSpendResult {
  const balance = toCents(profile.currentBalance);
  const buffer = toCents(profile.safetyBuffer);

  const incomplete: SafeToSpendResult = {
    status: "datos_incompletos",
    currentBalance: balance / 100,
    essentialExpenses: 0,
    pendingCommitments: 0,
    pendingDebtPayments: 0,
    safetyBuffer: buffer / 100,
    protectedSavings: 0,
    safeToSpend: null,
    shortfall: null,
  };

  const days = profile.nextPaydayDays;

  // No calculamos sin una fecha de ingreso
  // ni con un onboarding incompleto.
  if (
    !profile.isOnboarded ||
    days === null ||
    !Number.isInteger(days) ||
    days < 0
  ) {
    return incomplete;
  }

  const goal = profile.primaryGoal;

  if (
    goal &&
    goal.currentSaved > 0 &&
    goal.savingsLocation === "desconocido"
  ) {
    return incomplete;
  }

  // Evitamos contar deudas en ambas listas.
  // Las deudas se registran únicamente en debts.
  if (
    profile.commitments.some(
      (item) => item.kind === "deuda"
    )
  ) {
    return incomplete;
  }

  // ========================================
  // GASTOS ESENCIALES DIARIOS
  // ========================================

  const essentialExpenses =
    toCents(profile.dailyEssentialBurn) * days;

  // ========================================
  // COMPROMISOS RECURRENTES
  // ========================================

  let pendingCommitments = 0;

  for (const item of profile.commitments) {
    if (item.isConfirmed === false) {
      return incomplete;
    }

    const paymentCount = contarPagos(
      item.dueInDays,
      item.frequency,
      days
    );

    if (paymentCount === null) {
      return incomplete;
    }

    pendingCommitments +=
      toCents(item.amount) * paymentCount;
  }

  // ========================================
  // PAGOS RECURRENTES DE DEUDAS
  // ========================================

  let pendingDebtPayments = 0;

  for (const debt of profile.debts) {
    const paymentCount = contarPagos(
      debt.dueInDays,
      debt.frequency,
      days
    );

    if (paymentCount === null) {
      return incomplete;
    }

    pendingDebtPayments +=
      toCents(debt.nextPayment) * paymentCount;
  }

  // ========================================
  // AHORROS PROTEGIDOS
  // ========================================

  let protectedSavings = 0;

  if (goal?.savingsLocation === "incluido") {
    const saved = toCents(goal.currentSaved);

    // Conservamos la regla inicial:
    // se supone que un fondo de emergencia
    // comparte dinero con el safetyBuffer.
    if (goal.category === "emergencia") {
      protectedSavings = Math.max(
        0,
        saved - buffer
      );
    } else {
      protectedSavings = saved;
    }
  }

  // ========================================
  // RESULTADO FINAL
  // ========================================

  const remaining =
    balance -
    essentialExpenses -
    pendingCommitments -
    pendingDebtPayments -
    buffer -
    protectedSavings;

  return {
    status: "calculado",
    currentBalance: balance / 100,
    essentialExpenses: essentialExpenses / 100,
    pendingCommitments: pendingCommitments / 100,
    pendingDebtPayments: pendingDebtPayments / 100,
    safetyBuffer: buffer / 100,
    protectedSavings: protectedSavings / 100,
    safeToSpend: Math.max(0, remaining) / 100,
    shortfall: Math.max(0, -remaining) / 100,
  };
}
