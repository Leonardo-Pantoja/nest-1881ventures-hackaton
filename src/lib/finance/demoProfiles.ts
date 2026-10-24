import type { OnboardingProfile } from "../onboarding/financialTypes";

export type DemoProfileId = "carlos" | "mateo";

export function getDemoProfile(id: unknown): OnboardingProfile | null {
  if (id === "carlos") {
    return {
      id,
      name: "Carlos Mendoza",
      lifeContext: ["trabajo", "independiente", "dependientes"],
      currentBalance: 5000,
      payFrequency: "quincenal",
      nextPaydayAmount: 9500,
      nextPaydayDays: 6,
      dailyEssentialBurn: 250,
      safetyBuffer: 800,
      commitments: [
        {
          id: "demo-rent",
          title: "Renta (Complemento)",
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
          id: "demo-card",
          title: "Tarjeta de Crédito",
          totalBalance: null,
          nextPayment: 500,
          dueInDays: 4,
          frequency: "mensual",
        },
      ],
      primaryGoal: {
        id: "demo-emergency-fund",
        title: "Fondo de emergencia",
        category: "emergencia",
        targetAmount: 20000,
        currentSaved: 8000,
        weeklyContribution: 600,
        savingsLocation: "separado",
      },
      isOnboarded: true,
    };
  }

  if (id === "mateo") {
    return {
      id,
      name: "Mateo Rivera",
      lifeContext: ["estudio", "trabajo"],
      currentBalance: 5000,
      payFrequency: "quincenal",
      nextPaydayAmount: 3500,
      nextPaydayDays: 6,
      dailyEssentialBurn: 120,
      safetyBuffer: 400,
      commitments: [
        {
          id: "demo-phone-plan",
          title: "Plan Celular",
          amount: 399,
          dueInDays: 3,
          category: "Servicios",
          frequency: "mensual",
          kind: "suscripcion",
          isConfirmed: true,
        },
      ],
      debts: [],
      primaryGoal: {
        id: "demo-laptop",
        title: "Laptop",
        category: "compra",
        targetAmount: 15000,
        currentSaved: 10500,
        weeklyContribution: 500,
        savingsLocation: "separado",
      },
      isOnboarded: true,
    };
  }

  return null;
}
