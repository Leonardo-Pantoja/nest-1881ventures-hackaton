
import { evaluatePurchase } from "./onboarding/purchaseDecision";
import type { OnboardingProfile } from "./onboarding/financialTypes";

const perfil: OnboardingProfile = {
  id: "test-precision",
  lifeContext: ["estudio"],
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

let aprobadas = 0;

function verificar(
  nombre: string,
  condicion: boolean
): void {
  if (!condicion) {
    throw new Error(`❌ FALLÓ: ${nombre}`);
  }

  aprobadas++;
  console.log(`✅ ${nombre}`);
}

function debeRechazar(
  nombre: string,
  precio: number
): void {
  let rechazado = false;

  try {
    evaluatePurchase(perfil, precio);
  } catch {
    rechazado = true;
  }

  verificar(nombre, rechazado);
}

// PRECIOS INVÁLIDOS
debeRechazar("Rechaza $0.001", 0.001);
debeRechazar("Rechaza $10.999", 10.999);
debeRechazar("Rechaza $1.005", 1.005);
debeRechazar("Rechaza precio enorme", 1e15);

// PRECIOS VÁLIDOS
const minimo = evaluatePurchase(perfil, 0.01);
verificar(
  "Acepta $0.01",
  minimo.purchaseAmount === 0.01
);

const decimal = evaluatePurchase(perfil, 10.99);
verificar(
  "Acepta $10.99",
  decimal.purchaseAmount === 10.99
);

console.log("");
console.log("🎉 PRUEBAS DE PRECISIÓN APROBADAS");
console.log(`${aprobadas}/6 verificaciones correctas`);
