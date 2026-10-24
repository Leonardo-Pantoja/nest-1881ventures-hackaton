
import { calculateGoalImpact } from "./goalImpact";
import type { FinancialGoal } from "./financialTypes";

// ==========================================
// META FINANCIERA DEL ESTUDIANTE
// ==========================================

const metaLaptop: FinancialGoal = {
  id: "meta-001",
  title: "Comprar laptop",
  category: "compra",
  timeframe: "corto",
  targetAmount: 15000,
  currentSaved: 10500,
  weeklyContribution: 500,
  savingsLocation: "separado",
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
// PRUEBA 1: COMPRAR TENIS DE $1,200
// UTILIZANDO DINERO DE LA META
// ==========================================

const compraTenis = calculateGoalImpact(
  metaLaptop,
  1200
);

verificar(
  "Ahorro después de comprar tenis",
  compraTenis.savedAfter,
  9300
);

verificar(
  "Semanas antes de comprar",
  compraTenis.weeksBefore,
  9
);

verificar(
  "Semanas después de comprar",
  compraTenis.weeksAfter,
  12
);

verificar(
  "Retraso de 3 semanas",
  compraTenis.delayedByWeeks,
  3
);

// ==========================================
// PRUEBA 2: NO UTILIZAR LOS AHORROS
// ==========================================

const sinRetiro = calculateGoalImpact(
  metaLaptop,
  0
);

verificar(
  "Los ahorros permanecen intactos",
  sinRetiro.savedAfter,
  10500
);

verificar(
  "No existe retraso en la meta",
  sinRetiro.delayedByWeeks,
  0
);

// ==========================================
// PRUEBA 3: SIN APORTACIÓN SEMANAL
// ==========================================

const sinAportaciones = calculateGoalImpact(
  {
    ...metaLaptop,
    weeklyContribution: 0,
  },
  1200
);

verificar(
  "No inventa semanas de ahorro",
  sinAportaciones.weeksAfter,
  null
);

// ==========================================
// PRUEBA 4: RETIRO MAYOR AL AHORRO
// ==========================================

let errorDetectado = false;

try {
  calculateGoalImpact(metaLaptop, 12000);
} catch {
  errorDetectado = true;
}

verificar(
  "Rechaza retirar más de lo ahorrado",
  errorDetectado,
  true
);

// ==========================================
// RESULTADO FINAL
// ==========================================

console.log("");
console.log("🎉 TODAS LAS PRUEBAS PASARON");
console.log("Impacto en metas: 8 verificaciones correctas");
