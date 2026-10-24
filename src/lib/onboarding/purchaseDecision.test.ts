
import { evaluatePurchase } from "./purchaseDecision";
import type { OnboardingProfile } from "./financialTypes";

// ==========================================
// PERFIL FINANCIERO DE PRUEBA
// ==========================================

const estudiante: OnboardingProfile = {
  id: "test-compra",
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

let pruebasAprobadas = 0;

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

  pruebasAprobadas++;
  console.log(`✅ ${nombre}`);
}

function verificarError(
  nombre: string,
  accion: () => void
): void {
  let lanzoError = false;

  try {
    accion();
  } catch {
    lanzoError = true;
  }

  verificar(nombre, lanzoError, true);
}

// ==========================================
// PRUEBA 1: COMPRA DE $200
// ==========================================

const compraPequena = evaluatePurchase(
  estudiante,
  200
);

verificar(
  "La compra se evalúa",
  compraPequena.status,
  "evaluada"
);

verificar(
  "Compra dentro del margen",
  compraPequena.assessment,
  "dentro_del_margen"
);

verificar(
  "Dinero disponible original",
  compraPequena.safeToSpend,
  400
);

verificar(
  "Quedan $200 disponibles",
  compraPequena.remainingSafeToSpend,
  200
);

// ==========================================
// PRUEBA 2: COMPRA DE $1200
// ==========================================

const compraGrande = evaluatePurchase(
  estudiante,
  1200
);

verificar(
  "Compra excede el margen",
  compraGrande.assessment,
  "excede_margen"
);

verificar(
  "Excede por $800",
  compraGrande.exceedsBy,
  800
);

verificar(
  "No muestra saldo seguro negativo",
  compraGrande.remainingSafeToSpend,
  0
);

// ==========================================
// PRUEBA 3: COMPRA EXACTA DE $400
// ==========================================

const compraExacta = evaluatePurchase(
  estudiante,
  400
);

verificar(
  "Compra exacta dentro del margen",
  compraExacta.assessment,
  "dentro_del_margen"
);

verificar(
  "Compra exacta deja $0",
  compraExacta.remainingSafeToSpend,
  0
);

// ==========================================
// PRUEBA 4: DATOS INCOMPLETOS
// ==========================================

const datosIncompletos = evaluatePurchase(
  {
    ...estudiante,
    nextPaydayDays: null,
    nextPaydayAmount: null,
  },
  200
);

verificar(
  "Detecta datos incompletos",
  datosIncompletos.status,
  "datos_incompletos"
);

verificar(
  "No evalúa sin información",
  datosIncompletos.assessment,
  "no_evaluable"
);

// ==========================================
// PRUEBA 5: PRECIO CON CENTAVOS
// ==========================================

const compraDecimal = evaluatePurchase(
  estudiante,
  100.25
);

verificar(
  "Calcula centavos correctamente",
  compraDecimal.remainingSafeToSpend,
  299.75
);

// ==========================================
// PRUEBA 6: PRECIOS INVÁLIDOS
// ==========================================

verificarError(
  "Rechaza precio cero",
  () => evaluatePurchase(estudiante, 0)
);

verificarError(
  "Rechaza precio negativo",
  () => evaluatePurchase(estudiante, -100)
);

verificarError(
  "Rechaza precio no numérico",
  () => evaluatePurchase(estudiante, NaN)
);

// ==========================================
// RESULTADO FINAL
// ==========================================

console.log("");
console.log("🎉 TODAS LAS PRUEBAS PASARON");
console.log(
  `Evaluador de compras: ${pruebasAprobadas} verificaciones correctas`
);

console.log("");
console.log("EJEMPLO: COMPRA DE $1200");
console.log(compraGrande);
