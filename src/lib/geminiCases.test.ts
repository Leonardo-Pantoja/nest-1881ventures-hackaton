
import { buildPurchaseReport } from "./purchaseReport";
import type { OnboardingProfile } from "./financialTypes";

// Perfil utilizado en los 10 escenarios
const perfil: OnboardingProfile = {
  id: "gemini-test",
  name: "Estudiante demo",
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
    id: "laptop",
    title: "Comprar laptop",
    category: "compra",
    targetAmount: 10000,
    currentSaved: 2000,
    weeklyContribution: 500,
    savingsLocation: "separado",
  },
  isOnboarded: true,
};

let aprobados = 0;

function comprobar(
  condicion: boolean,
  descripcion: string
): void {
  if (!condicion) {
    throw new Error(`❌ ${descripcion}`);
  }
}

function aprobar(nombre: string): void {
  aprobados++;
  console.log(`✅ ${nombre}`);
}

// CASOS 1 AL 7: COMPRAS CON SALDO SUFICIENTE
const casos = [
  { precio: 200, restante: 900, minimo: 600, riesgo: false },
  { precio: 400, restante: 700, minimo: 400, riesgo: false },
  { precio: 600, restante: 500, minimo: 200, riesgo: false },
  { precio: 700, restante: 400, minimo: 100, riesgo: true },
  { precio: 900, restante: 200, minimo: -100, riesgo: true },
  { precio: 1100, restante: 0, minimo: -300, riesgo: true },
  { precio: 1200, restante: 0, minimo: -400, riesgo: true },
];

casos.forEach((caso, indice) => {
  const reporte = buildPurchaseReport(perfil, caso.precio);

  comprobar(
    reporte.status === "calculado",
    `Caso ${indice + 1}: reporte`
  );

  comprobar(
    reporte.purchase.assessment ===
      (caso.precio <= 1100
        ? "dentro_del_margen"
        : "excede_margen"),
    `Caso ${indice + 1}: diagnóstico`
  );

  comprobar(
    reporte.purchase.remainingSafeToSpend === caso.restante,
    `Caso ${indice + 1}: margen restante`
  );

  comprobar(
    reporte.projectionAfter?.lowestBalance === caso.minimo,
    `Caso ${indice + 1}: saldo mínimo`
  );

  comprobar(
    reporte.projectionAfter?.weeks[5].belowProtectedFunds ===
      caso.riesgo,
    `Caso ${indice + 1}: riesgo`
  );

  comprobar(
    reporte.goalImpact?.savedAfter === 2000,
    `Caso ${indice + 1}: ahorros protegidos`
  );

  aprobar(`Caso ${indice + 1}: compra de $${caso.precio}`);
});

// CASO 8: SALDO INSUFICIENTE
const caso8 = buildPurchaseReport(perfil, 2500);

comprobar(
  caso8.status === "saldo_insuficiente" &&
  caso8.purchase.exceedsBy === 1400 &&
  caso8.projectionAfter === null,
  "Caso 8: saldo insuficiente"
);

aprobar("Caso 8: saldo insuficiente");

// CASO 9: DATOS DESCONOCIDOS
const caso9 = buildPurchaseReport(
  {
    ...perfil,
    nextPaydayDays: null,
    nextPaydayAmount: null,
  },
  200
);

comprobar(
  caso9.status === "datos_incompletos" &&
  caso9.purchase.assessment === "no_evaluable" &&
  caso9.purchase.safeToSpend === null,
  "Caso 9: datos incompletos"
);

aprobar("Caso 9: datos incompletos");

// CASO 10: PROYECCIÓN MENSUAL INCIERTA
const caso10 = buildPurchaseReport(
  {
    ...perfil,
    commitments: [
      {
        id: "renta",
        title: "Renta",
        amount: 500,
        dueInDays: 10,
        category: "Vivienda",
        frequency: "mensual",
        kind: "esencial",
        isConfirmed: true,
      },
    ],
  },
  200
);

comprobar(
  caso10.status === "datos_incompletos" &&
  caso10.purchase.safeToSpend === 1100 &&
  caso10.projectionAfter?.status === "datos_incompletos",
  "Caso 10: proyección incompleta"
);

aprobar("Caso 10: proyección incompleta");

// RESULTADO FINAL
console.log("");
console.log("🎉 ESCENARIOS FINANCIEROS VALIDADOS");
console.log(`${aprobados}/10 casos correctos`);
