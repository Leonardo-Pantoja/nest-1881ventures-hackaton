
import { buildPurchaseReport } from "./purchaseReport";
import type { OnboardingProfile } from "./financialTypes";

// ==========================================
// PERFIL DE PRUEBA
// ==========================================

const estudiante: OnboardingProfile = {
  id: "test-reporte",
  name: "Carlos",
  lifeContext: ["estudio", "trabajo"],

  currentBalance: 2000,
  payFrequency: "semanal",
  nextPaydayAmount: 600,
  nextPaydayDays: 7,

  dailyEssentialBurn: 100,
  safetyBuffer: 200,

  commitments: [],
  debts: [],

  primaryGoal: {
    id: "meta-laptop",
    title: "Comprar laptop",
    category: "compra",
    targetAmount: 10000,
    currentSaved: 2000,
    weeklyContribution: 500,
    savingsLocation: "separado",
  },

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
// PRUEBA 1: COMPRA NORMAL DE $400
// ==========================================

const reporte = buildPurchaseReport(
  estudiante,
  400
);

verificar(
  "Genera reporte completo",
  reporte.status,
  "calculado"
);

verificar(
  "Compra dentro del margen",
  reporte.purchase.assessment,
  "dentro_del_margen"
);

verificar(
  "Dinero disponible inicial",
  reporte.purchase.safeToSpend,
  1100
);

verificar(
  "Margen después de comprar",
  reporte.purchase.remainingSafeToSpend,
  700
);

// ==========================================
// PRUEBA 2: PROTEGER META DE AHORRO
// ==========================================

verificar(
  "No retira dinero de la meta",
  reporte.goalImpact?.savedAfter,
  2000
);

verificar(
  "No retrasa la meta",
  reporte.goalImpact?.delayedByWeeks,
  0
);

// ==========================================
// PRUEBA 3: PROYECCIONES
// ==========================================

verificar(
  "Calcula proyección original",
  reporte.projectionBefore.status,
  "calculado"
);

verificar(
  "Calcula proyección con compra",
  reporte.projectionAfter?.status,
  "calculado"
);

verificar(
  "Saldo semana 6 sin compra",
  reporte.projectionBefore.weeks[5].endBalance,
  1400
);

verificar(
  "Saldo semana 6 con compra",
  reporte.projectionAfter?.weeks[5].endBalance,
  1000
);

verificar(
  "La diferencia proyectada es -$400",
  reporte.projectedBalanceDifference,
  -400
);

// ==========================================
// PRUEBA 4: NO MODIFICAR DATOS
// ==========================================

verificar(
  "Conserva el saldo original",
  estudiante.currentBalance,
  2000
);

// ==========================================
// PRUEBA 5: COMPRA QUE EXCEDE EL MARGEN
// ==========================================

const compraRiesgosa = buildPurchaseReport(
  estudiante,
  1200
);

verificar(
  "Detecta compra fuera del margen",
  compraRiesgosa.purchase.assessment,
  "excede_margen"
);

verificar(
  "Excede margen por $100",
  compraRiesgosa.purchase.exceedsBy,
  100
);

verificar(
  "Puede simular una compra riesgosa",
  compraRiesgosa.status,
  "calculado"
);

// ==========================================
// PRUEBA 6: SALDO INSUFICIENTE
// ==========================================

const sinSaldo = buildPurchaseReport(
  estudiante,
  2500
);

verificar(
  "Detecta saldo insuficiente",
  sinSaldo.status,
  "saldo_insuficiente"
);

verificar(
  "No proyecta compra sin saldo",
  sinSaldo.projectionAfter,
  null
);

verificar(
  "No inventa diferencia",
  sinSaldo.projectedBalanceDifference,
  null
);

// ==========================================
// PRUEBA 7: DATOS INCOMPLETOS
// ==========================================

const incompleto = buildPurchaseReport(
  {
    ...estudiante,
    nextPaydayDays: null,
    nextPaydayAmount: null,
  },
  200
);

verificar(
  "Detecta información incompleta",
  incompleto.status,
  "datos_incompletos"
);

verificar(
  "No evalúa sin datos suficientes",
  incompleto.purchase.assessment,
  "no_evaluable"
);

// ==========================================
// PRUEBA 8: PRECIOS INVÁLIDOS
// ==========================================

verificarError(
  "Rechaza precio cero",
  () => buildPurchaseReport(estudiante, 0)
);

verificarError(
  "Rechaza precio negativo",
  () => buildPurchaseReport(estudiante, -100)
);

verificarError(
  "Rechaza precio no numérico",
  () => buildPurchaseReport(estudiante, NaN)
);

// ==========================================
// RESULTADOS
// ==========================================

console.log("");
console.log("🎉 TODAS LAS PRUEBAS PASARON");

console.log(
  `Reporte integrado: ${pruebasAprobadas} verificaciones correctas`
);

console.log("");
console.log("REPORTE DE COMPRA DE $400:");
console.log(reporte);
