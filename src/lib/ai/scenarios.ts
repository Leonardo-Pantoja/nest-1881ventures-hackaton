import type { OnboardingProfile } from "../onboarding/financialTypes";

// Synthetic fixtures from docs/gemini-test-cases.md. Never account data.
export const sebasProfile: OnboardingProfile = {
  id: "synthetic-test", lifeContext: [], currentBalance: 2000, payFrequency: "semanal", nextPaydayAmount: 600,
  nextPaydayDays: 7, dailyEssentialBurn: 100, safetyBuffer: 200, commitments: [], debts: [], isOnboarded: true,
  primaryGoal: { id: "synthetic-laptop", title: "Comprar laptop", category: "compra", targetAmount: 10000,
    currentSaved: 2000, weeklyContribution: 500, savingsLocation: "separado" },
};
export const sebasScenarios = [200, 400, 600, 700, 900, 1100, 1200, 2500, 200, 200].map((price, i) => ({
  caseNumber: i + 1, price,
  profile: i === 8 ? { ...sebasProfile, nextPaydayDays: null, nextPaydayAmount: null } : i === 9 ? {
    ...sebasProfile, commitments: [{ id: "synthetic-rent", title: "Renta", amount: 500, dueInDays: 10, frequency: "mensual" as const,
      category: "Vivienda", kind: "esencial" as const, isConfirmed: true }],
  } : sebasProfile,
}));

const conversationProfile: OnboardingProfile = { ...sebasProfile, currentBalance: 5000, nextPaydayAmount: 2000,
  primaryGoal: { ...sebasProfile.primaryGoal!, weeklyContribution: 200 } };
export const conversationScenarios = [
  { caseNumber: "A", message: "¿Puedo comprar algo de $1,200?", profile: conversationProfile, product: null, operation: "purchase", expectedPrice: 1200 },
  { caseNumber: "B", message: "¿Qué pasa si compro uno de $900?", profile: conversationProfile, product: { name: "Audífonos", price: 1200 }, operation: "purchase", expectedPrice: 900 },
  { caseNumber: "C", message: "¿Cuánto tendría que ahorrar para comprarlo en cuatro semanas?", profile: conversationProfile, product: { name: "Audífonos", price: 900 }, operation: "savings", expectedPrice: 900 },
  { caseNumber: "D", message: "¿Qué debería priorizar, mi renta o los audífonos?", profile: { ...conversationProfile, commitments: [
    { id: "rent", title: "Renta", amount: 500, dueInDays: 3, frequency: "unico" as const, kind: "esencial" as const, category: "Vivienda", isConfirmed: true },
  ] }, product: { name: "Audífonos", price: 900 }, operation: "priorities", expectedPrice: null },
  { caseNumber: "E", message: "¿Cuánto tengo ahorrado para mi laptop?", profile: conversationProfile, product: null, operation: "goal", expectedPrice: null },
  { caseNumber: "F", message: "¿Puedo comprar algo de $200?", profile: sebasScenarios[8].profile, product: null, operation: "purchase", expectedPrice: 200 },
  { caseNumber: "G", message: "¿Puedo comprar algo de $700?", profile: sebasProfile, product: null, operation: "purchase", expectedPrice: 700 },
  { caseNumber: "H", message: "Confirmé el precio de la imagen. ¿Puedo comprarlo?", profile: conversationProfile, product: { name: "Producto confirmado de imagen", price: 150.5 }, operation: "purchase", expectedPrice: 150.5 },
];
