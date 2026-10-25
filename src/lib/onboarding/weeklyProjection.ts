import { protectedSavingsCents } from "./protectedFunds";

/**
 * ANTES DE GASTAR
 * Proyección financiera de 6 semanas.
 *
 * Simulación determinista de 42 días.
 * No garantiza ingresos futuros.
 */

import type {
  OnboardingProfile,
  CommitmentFrequency,
} from "./financialTypes";

export interface ProjectedWeek {
  week: number;
  income: number;
  expenses: number;
  endBalance: number;
  lowestBalance: number;
  belowProtectedFunds: boolean;
}

export interface SixWeekProjection {
  status: "calculado" | "datos_incompletos";
  weeks: ProjectedWeek[];
  lowestBalance: number | null;
}

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================

function toCents(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Importe inválido");
  }

  return Math.round(value * 100);
}

function paymentDue(
  day: number,
  dueInDays: number | null,
  frequency: CommitmentFrequency | null
): boolean {
  if (dueInDays === null || frequency === null) return false;

  if (day < dueInDays) {
    return false;
  }

  const difference = day - dueInDays;

  switch (frequency) {
    case "unico":
      return difference === 0;

    case "semanal":
      return difference % 7 === 0;

    case "quincenal":
      return difference % 14 === 0;

    case "mensual":
      // No asumimos que todos los meses
      // tienen la misma duración.
      return difference === 0;
  }

  return false;
}

// ==========================================
// PROYECCIÓN DE SEIS SEMANAS
// ==========================================

export function projectSixWeeks(
  profile: OnboardingProfile
): SixWeekProjection {
  const incomplete: SixWeekProjection = {
    status: "datos_incompletos",
    weeks: [],
    lowestBalance: null,
  };

  const firstPayday = profile.nextPaydayDays;
  const paycheck = profile.nextPaydayAmount;
  const currentBalance = profile.currentBalance;
  const dailyEssentialBurn = profile.dailyEssentialBurn;
  const safetyBuffer = profile.safetyBuffer;

  // Solo proyectamos ingresos de frecuencia
  // semanal o quincenal conocida.
  if (
    !profile.isOnboarded ||
    currentBalance === null ||
    dailyEssentialBurn === null ||
    safetyBuffer === null ||
    firstPayday === null ||
    !Number.isInteger(firstPayday) ||
    firstPayday < 1 ||
    paycheck === null ||
    !Number.isFinite(paycheck) ||
    paycheck < 0 ||
    !["semanal", "quincenal"].includes(
      profile.payFrequency
    )
  ) {
    return incomplete;
  }

  const payInterval =
    profile.payFrequency === "semanal" ? 7 : 14;

  // Si no sabemos dónde están los ahorros,
  // no podemos estimar dinero disponible.
  const protectedSavings = protectedSavingsCents(profile);
  if (protectedSavings === null) return incomplete;

  // Evitamos duplicar pagos de deudas.
  if (
    profile.commitments.some(
      (item) =>
        item.kind === "deuda" ||
        item.isConfirmed === false
    )
  ) {
    return incomplete;
  }

  const candidatePayments = [
    ...profile.commitments.map((item) => ({
      dueInDays: item.dueInDays,
      frequency: item.frequency,
      amount: item.amount,
    })),
    ...profile.debts.map((item) => ({
      dueInDays: item.dueInDays,
      frequency: item.frequency,
      amount: item.nextPayment,
    })),
  ];
  const payments: Array<{
    dueInDays: number;
    frequency: CommitmentFrequency;
    amount: number;
  }> = [];

  for (const payment of candidatePayments) {
    if (
      payment.dueInDays === null ||
      payment.frequency === null ||
      !Number.isInteger(payment.dueInDays) ||
      payment.dueInDays < 0 ||
      payment.amount === null ||
      !Number.isFinite(payment.amount) ||
      payment.amount < 0
    ) {
      return incomplete;
    }

    payments.push({
      dueInDays: payment.dueInDays,
      frequency: payment.frequency,
      amount: payment.amount,
    });

    // En un horizonte de 42 días puede existir
    // un segundo pago mensual. Sin fechas exactas
    // no calculamos ese escenario.
    if (
      payment.frequency === "mensual" &&
      payment.dueInDays <= 14
    ) {
      return incomplete;
    }
  }

  const dailyCost = toCents(dailyEssentialBurn);

  const buffer = toCents(safetyBuffer);
  const protectedFloor = buffer + protectedSavings;

  function expensesForDay(day: number): number {
    let total = 0;

    for (const payment of payments) {
      if (
        paymentDue(
          day,
          payment.dueInDays,
          payment.frequency
        )
      ) {
        total += toCents(payment.amount);
      }
    }

    return total;
  }

  let balance = toCents(currentBalance);
  let lowestBalance = balance;

  const weeks: ProjectedWeek[] = [];

  for (let week = 1; week <= 6; week++) {
    let weeklyIncome = 0;
    let weeklyExpenses = 0;
    let weeklyLowest = balance;

    // Pagos que vencen hoy.
    if (week === 1) {
      const todayExpenses = expensesForDay(0);
      balance -= todayExpenses;
      weeklyExpenses += todayExpenses;
      weeklyLowest = Math.min(weeklyLowest, balance);
    }

    const startDay = (week - 1) * 7 + 1;
    const endDay = week * 7;

    for (let day = startDay; day <= endDay; day++) {
      const expenses =
        dailyCost + expensesForDay(day);

      // Por precaución se descuentan los gastos
      // antes de acreditar el ingreso del día.
      balance -= expenses;
      weeklyExpenses += expenses;

      weeklyLowest = Math.min(weeklyLowest, balance);

      // Se asume que cada nómina futura tiene
      // el mismo importe registrado.
      if (
        day >= firstPayday &&
        (day - firstPayday) % payInterval === 0
      ) {
        const income = toCents(paycheck);
        balance += income;
        weeklyIncome += income;
      }

      weeklyLowest = Math.min(weeklyLowest, balance);
    }

    lowestBalance = Math.min(
      lowestBalance,
      weeklyLowest
    );

    weeks.push({
      week,
      income: weeklyIncome / 100,
      expenses: weeklyExpenses / 100,
      endBalance: balance / 100,
      lowestBalance: weeklyLowest / 100,
      belowProtectedFunds:
        weeklyLowest < protectedFloor,
    });
  }

  return {
    status: "calculado",
    weeks,
    lowestBalance: lowestBalance / 100,
  };
}
