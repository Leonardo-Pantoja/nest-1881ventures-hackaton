
import { calculateSafeToSpend } from "./financialEngine";
import type { OnboardingProfile } from "./financialTypes";

// ==========================================
// PERFIL BASE
// ==========================================

const estudiante: OnboardingProfile = {
  id: "test-001",
  name: "Carlos",
  lifeContext: ["estudio", "trabajo"],

  currentBalance: 5000,
  payFrequency: "semanal",
  nextPaydayAmount: 9500,
  nextPaydayDays: 6,

  dailyEssentialBurn: 200,
  safetyBuffer: 800,

  commitments: [
    {
      id: "renta",
      title: "Renta",
      amount: 2100,
      dueInDays: 2,
      category: "Vivienda",
      frequency: "mensual",
      kind: "esencial",
      isConfirmed: true,
    },
  ],

  debts: [
    {
      id: "tarjeta",
      title: "Tarjeta de crédito",
      totalBalance: 12000,
      nextPayment: 500,
      dueInDays: 4,
      frequency: "mensual",
    },
  ],

  isOnboarded: true,
};

// ==========================================
// VERIFICADOR
// ==========================================

function verificar(
  nombre: string,
  actual: unknown,
  esperado: unknown
): void {
  if (actual !== esperado) {
    throw new Error(
      `FALLÓ: ${nombre}. Esperado: ${esperado}, recibido: ${actual}`
    );
  }

  console.log(`✅ ${nombre}`);
}

// ==========================================
// PRUEBA 1: ESCENARIO NORMAL
// ==========================================

const normal = calculateSafeToSpend(estudiante);

verificar("Cálculo normal", normal.safeToSpend, 400);
verificar("Sin déficit", normal.shortfall, 0);

// ==========================================
// PRUEBA 2: DINERO INSUFICIENTE
// ==========================================

const sinDinero = calculateSafeToSpend({
  ...estudiante,
  currentBalance: 3000,
});

verificar("Gasto seguro es cero", sinDinero.safeToSpend, 0);
verificar("Detecta déficit de $1600", sinDinero.shortfall, 1600);

// ==========================================
// PRUEBA 3: INGRESO DESCONOCIDO
// ==========================================

const ingresoDesconocido = calculateSafeToSpend({
  ...estudiante,
  payFrequency: "variable",
  nextPaydayDays: null,
  nextPaydayAmount: null,
});

verificar(
  "Detecta datos incompletos",
  ingresoDesconocido.status,
  "datos_incompletos"
);

verificar(
  "No inventa dinero disponible",
  ingresoDesconocido.safeToSpend,
  null
);

// ==========================================
// PRUEBA 4: PAGOS SEMANALES
// ==========================================

const pagosSemanales = calculateSafeToSpend({
  ...estudiante,
  nextPaydayDays: 16,
  debts: [],
  commitments: [
    {
      id: "pago-semanal",
      title: "Suscripción semanal",
      amount: 100,
      dueInDays: 2,
      category: "Suscripciones",
      frequency: "semanal",
      kind: "suscripcion",
      isConfirmed: true,
    },
  ],
});

// Pagos en los días 2, 9 y 16
verificar(
  "Cuenta tres pagos semanales",
  pagosSemanales.pendingCommitments,
  300
);

verificar(
  "Calcula $700 después de gastos",
  pagosSemanales.safeToSpend,
  700
);

// ==========================================
// PRUEBA 5: PAGOS QUINCENALES
// ==========================================

const pagosQuincenales = calculateSafeToSpend({
  ...estudiante,
  currentBalance: 2000,
  nextPaydayDays: 30,
  dailyEssentialBurn: 0,
  safetyBuffer: 0,
  debts: [],
  commitments: [
    {
      id: "pago-quincenal",
      title: "Compromiso quincenal",
      amount: 200,
      dueInDays: 1,
      category: "Servicios",
      frequency: "quincenal",
      kind: "otro",
      isConfirmed: true,
    },
  ],
});

// Pagos en los días 1, 15 y 29
verificar(
  "Cuenta tres pagos quincenales",
  pagosQuincenales.pendingCommitments,
  600
);

verificar(
  "Saldo seguro quincenal",
  pagosQuincenales.safeToSpend,
  1400
);

// ==========================================
// PRUEBA 6: MES CON FECHA INCIERTA
// ==========================================

const pagoMensualIncierto = calculateSafeToSpend({
  ...estudiante,
  nextPaydayDays: 31,
  debts: [],
});

verificar(
  "No inventa fechas de pagos mensuales",
  pagoMensualIncierto.status,
  "datos_incompletos"
);

// ==========================================
// PRUEBA 7: EVITAR DEUDAS DUPLICADAS
// ==========================================

const deudaDuplicada = calculateSafeToSpend({
  ...estudiante,
  commitments: [
    {
      id: "tarjeta-duplicada",
      title: "Tarjeta de crédito",
      amount: 500,
      dueInDays: 4,
      category: "Deuda",
      frequency: "mensual",
      kind: "deuda",
      isConfirmed: true,
    },
  ],
});

verificar(
  "Rechaza compromisos de tipo deuda",
  deudaDuplicada.status,
  "datos_incompletos"
);

// ==========================================
// RESULTADO FINAL
// ==========================================

console.log("");
console.log("🎉 TODAS LAS PRUEBAS PASARON");
console.log("Motor financiero: 12 verificaciones correctas");
