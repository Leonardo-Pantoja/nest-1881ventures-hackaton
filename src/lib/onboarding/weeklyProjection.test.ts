
import { projectSixWeeks } from "./weeklyProjection";
import type { OnboardingProfile } from "./financialTypes";

// ==========================================
// PERFIL FINANCIERO DE PRUEBA
// ==========================================

const estudiante: OnboardingProfile = {
  id: "test-proyeccion",
  name: "Carlos",
  lifeContext: ["estudio", "trabajo"],

  currentBalance: 1000,
  payFrequency: "semanal",
  nextPaydayAmount: 500,
  nextPaydayDays: 7,

  dailyEssentialBurn: 50,
  safetyBuffer: 100,

  commitments: [],
  debts: [],

  isOnboarded: true,
};

// ==========================================
// FUNCIÓN PARA VERIFICAR
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

// ==========================================
// PRUEBA 1: PROYECCIÓN NORMAL
// ==========================================

const normal = projectSixWeeks(estudiante);

verificar(
  "La proyección se calcula",
  normal.status,
  "calculado"
);

verificar(
  "Genera exactamente 6 semanas",
  normal.weeks.length,
  6
);

verificar(
  "Ingreso de la primera semana",
  normal.weeks[0].income,
  500
);

verificar(
  "Gastos de la primera semana",
  normal.weeks[0].expenses,
  350
);

verificar(
  "Saldo al terminar la primera semana",
  normal.weeks[0].endBalance,
  1150
);

verificar(
  "Saldo al terminar la sexta semana",
  normal.weeks[5].endBalance,
  1900
);

verificar(
  "Saldo mínimo durante las seis semanas",
  normal.lowestBalance,
  650
);

// ==========================================
// PRUEBA 2: COMPROMISO SEMANAL
// ==========================================

const pagoSemanal = projectSixWeeks({
  ...estudiante,
  commitments: [
    {
      id: "suscripcion",
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

verificar(
  "Cuenta gasto recurrente semanal",
  pagoSemanal.weeks[0].expenses,
  450
);

verificar(
  "Saldo tras seis pagos semanales",
  pagoSemanal.weeks[5].endBalance,
  1300
);

// ==========================================
// PRUEBA 3: COMPROMISO QUINCENAL
// ==========================================

const pagoQuincenal = projectSixWeeks({
  ...estudiante,
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

// Vencimientos: días 1, 15 y 29
verificar(
  "Pago quincenal en semana 1",
  pagoQuincenal.weeks[0].expenses,
  550
);

verificar(
  "Pago quincenal en semana 3",
  pagoQuincenal.weeks[2].expenses,
  550
);

verificar(
  "Pago quincenal en semana 5",
  pagoQuincenal.weeks[4].expenses,
  550
);

// ==========================================
// PRUEBA 4: INGRESO DESCONOCIDO
// ==========================================

const ingresoDesconocido = projectSixWeeks({
  ...estudiante,
  payFrequency: "variable",
  nextPaydayAmount: null,
  nextPaydayDays: null,
});

verificar(
  "No inventa ingresos futuros",
  ingresoDesconocido.status,
  "datos_incompletos"
);

// ==========================================
// PRUEBA 5: PAGO MENSUAL INCIERTO
// ==========================================

const mensual = projectSixWeeks({
  ...estudiante,
  commitments: [
    {
      id: "renta",
      title: "Renta mensual",
      amount: 500,
      dueInDays: 10,
      category: "Vivienda",
      frequency: "mensual",
      kind: "esencial",
      isConfirmed: true,
    },
  ],
});

verificar(
  "No inventa fechas mensuales",
  mensual.status,
  "datos_incompletos"
);

// ==========================================
// PRUEBA 6: RESERVA DE SEGURIDAD
// ==========================================

const reservaAlta = projectSixWeeks({
  ...estudiante,
  safetyBuffer: 900,
});

verificar(
  "Detecta riesgo de tocar la reserva",
  reservaAlta.weeks[0].belowProtectedFunds,
  true
);

// ==========================================
// RESULTADOS FINALES
// ==========================================

console.log("");
console.log("🎉 TODAS LAS PRUEBAS PASARON");
console.log(
  `Proyección financiera: ${pruebasAprobadas} verificaciones correctas`
);

console.table(normal.weeks);
