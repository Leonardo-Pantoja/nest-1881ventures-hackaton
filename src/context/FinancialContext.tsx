"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type LifeContextTag =
  | "estudio"
  | "trabajo"
  | "independiente"
  | "dependientes";

export type PayFrequency = "semanal" | "quincenal" | "mensual";

export interface Commitment {
  id: string;
  title: string;
  amount: number;
  dueInDays: number;
  category: string;
}

export interface FinancialGoal {
  title: string;
  targetAmount: number;
  currentSaved: number;
  weeklyContribution: number;
  deadlineLabel: string;
}

export interface WishlistItem {
  id: string;
  name: string;
  price: number;
  savedAt: string;
  plannedWeeklySave?: number;
  cooldownDays?: number;
  strategy?: "wait" | "microsave";
}

export interface PendingPurchaseEvaluation {
  name: string;
  price: number;
  imageName?: string | null;
}

export interface FinancialProfile {
  id: string;
  name: string;
  email?: string;
  roleTag: string;
  lifeContext: LifeContextTag[];
  payFrequency: PayFrequency;
  currentBalance: number;
  nextPaydayDays: number;
  nextPaydayAmount: number;
  safetyBuffer: number;
  dailyEssentialBurn: number;
  commitments: Commitment[];
  goal: FinancialGoal;
  wishlist?: WishlistItem[];
  wisdomXp?: number;
  streakCount?: number;
  isOnboarded: boolean;
  plaidConnected?: boolean;
  institutionName?: string;
}

export const PRELOADED_SANDBOX_PROFILES: Record<string, FinancialProfile> = {
  carlos: {
    id: "carlos",
    name: "Carlos Mendoza",
    email: "carlos.demo@plaid-sandbox.dev",
    roleTag: "Trabajo · Vivo por mi cuenta · Mantengo a otras personas",
    lifeContext: ["trabajo", "independiente", "dependientes"],
    payFrequency: "quincenal",
    currentBalance: 5000,
    nextPaydayDays: 6,
    nextPaydayAmount: 9500,
    safetyBuffer: 800,
    dailyEssentialBurn: 250,
    commitments: [
      { id: "c1", title: "Renta (Complemento)", amount: 2100, dueInDays: 2, category: "Vivienda" },
      { id: "c2", title: "Tarjeta de Crédito", amount: 500, dueInDays: 4, category: "Deuda" },
    ],
    goal: {
      title: "Fondo de emergencia",
      targetAmount: 20000,
      currentSaved: 8000,
      weeklyContribution: 600,
      deadlineLabel: "Diciembre",
    },
    wishlist: [
      {
        id: "wish-initial-1",
        name: "Chamarra Impermeable",
        price: 1450,
        savedAt: "2026-10-22T10:00:00.000Z",
        cooldownDays: 6,
        strategy: "wait",
      },
    ],
    wisdomXp: 120,
    streakCount: 3,
    isOnboarded: true,
    plaidConnected: true,
    institutionName: "BBVA Sandbox (Plaid)",
  },
  mateo: {
    id: "mateo",
    name: "Mateo Rivera",
    email: "mateo.demo@plaid-sandbox.dev",
    roleTag: "Estudio · Trabajo · Sin dependientes",
    lifeContext: ["estudio", "trabajo"],
    payFrequency: "quincenal",
    currentBalance: 5000,
    nextPaydayDays: 6,
    nextPaydayAmount: 3500,
    safetyBuffer: 400,
    dailyEssentialBurn: 120,
    commitments: [
      { id: "c3", title: "Plan Celular", amount: 399, dueInDays: 3, category: "Servicios" },
    ],
    goal: {
      title: "Laptop",
      targetAmount: 15000,
      currentSaved: 10500,
      weeklyContribution: 500,
      deadlineLabel: "Diciembre",
    },
    wishlist: [
      {
        id: "wish-initial-1",
        name: "Chamarra Impermeable",
        price: 1450,
        savedAt: "2026-10-22T10:00:00.000Z",
        cooldownDays: 6,
        strategy: "wait",
      },
    ],
    wisdomXp: 240,
    streakCount: 5,
    isOnboarded: true,
    plaidConnected: true,
    institutionName: "Nu México Sandbox (Plaid)",
  },
};

export const EMPTY_NEW_USER_PROFILE: FinancialProfile = {
  id: "new-user",
  name: "Tu Perfil",
  email: "",
  roleTag: "Configuración personalizada",
  lifeContext: [],
  payFrequency: "quincenal",
  currentBalance: 0,
  nextPaydayDays: 7,
  nextPaydayAmount: 0,
  safetyBuffer: 500,
  dailyEssentialBurn: 150,
  commitments: [],
  goal: {
    title: "Fondo de emergencia",
    targetAmount: 15000,
    currentSaved: 0,
    weeklyContribution: 500,
    deadlineLabel: "Próximos meses",
  },
  wishlist: [],
  isOnboarded: false,
  plaidConnected: false,
};

const LIFE_CONTEXT_LABELS: Record<LifeContextTag, string> = {
  estudio: "Estudio",
  trabajo: "Trabajo",
  independiente: "Vivo por mi cuenta",
  dependientes: "Mantengo a otras personas",
};

export function buildRoleTagFromContext(tags: LifeContextTag[]): string {
  if (!tags || tags.length === 0) return "Perfil Personalizado";
  return tags.map((t) => LIFE_CONTEXT_LABELS[t]).join(" · ");
}

export function getRealisticEstimateForContext(tags: LifeContextTag[]) {
  const hasDependents = tags.includes("dependientes");
  const livesAlone = tags.includes("independiente");
  const works = tags.includes("trabajo");
  const studiesOnly = tags.includes("estudio") && !works;

  if (hasDependents) {
    return {
      currentBalance: 6400,
      nextPaydayAmount: 9800,
      nextPaydayDays: 6,
      payFrequency: "quincenal" as PayFrequency,
      dailyEssentialBurn: 260,
      safetyBuffer: 900,
    };
  }

  if (livesAlone) {
    return {
      currentBalance: 5200,
      nextPaydayAmount: 8200,
      nextPaydayDays: 6,
      payFrequency: "quincenal" as PayFrequency,
      dailyEssentialBurn: 210,
      safetyBuffer: 650,
    };
  }

  if (studiesOnly) {
    return {
      currentBalance: 2400,
      nextPaydayAmount: 1800,
      nextPaydayDays: 5,
      payFrequency: "semanal" as PayFrequency,
      dailyEssentialBurn: 95,
      safetyBuffer: 300,
    };
  }

  return {
    currentBalance: 4800,
    nextPaydayAmount: 6500,
    nextPaydayDays: 6,
    payFrequency: "quincenal" as PayFrequency,
    dailyEssentialBurn: 150,
    safetyBuffer: 500,
  };
}

interface FinancialContextType {
  profile: FinancialProfile;
  setProfile: React.Dispatch<React.SetStateAction<FinancialProfile>>;
  updateProfile: (partial: Partial<FinancialProfile>) => void;
  loadPreloadedSandboxProfile: (presetKey?: "carlos" | "mateo") => void;
  startFreshOnboarding: (email?: string) => void;
  completeOnboarding: (data: {
    lifeContext: LifeContextTag[];
    currentBalance: number;
    payFrequency: PayFrequency;
    nextPaydayDays: number;
    nextPaydayAmount: number;
    commitments: Commitment[];
    goalTitle: string;
    goalTargetAmount: number;
  }) => void;
  pendingEvaluation: PendingPurchaseEvaluation;
  setPendingEvaluation: (item: PendingPurchaseEvaluation) => void;
  addToWishlist: (
    item: Omit<WishlistItem, "id" | "savedAt">,
    xpReward?: number
  ) => void;
  registerPurchaseAnyway: (name: string, price: number) => void;
  awardWisdomXp: (amount?: number) => void;
  incrementStreak: (reason?: string) => void;
  streakCelebration: { id: number; count: number; reason: string } | null;
}

const STORAGE_KEY = "antesdegastar_financial_profile_v1";
const EVAL_STORAGE_KEY = "antesdegastar_pending_eval_v1";

const FinancialContext = createContext<FinancialContextType | undefined>(undefined);

export function FinancialProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<FinancialProfile>(PRELOADED_SANDBOX_PROFILES.carlos);
  const [pendingEvaluation, setPendingEvaluationState] = useState<PendingPurchaseEvaluation>({
    name: "Audífonos Inalámbricos Sony",
    price: 2300,
    imageName: null,
  });
  const [streakCelebration, setStreakCelebration] = useState<{
    id: number;
    count: number;
    reason: string;
  } | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object" && "currentBalance" in parsed) {
          setProfile({
            ...PRELOADED_SANDBOX_PROFILES.carlos,
            ...parsed,
            lifeContext: Array.isArray(parsed.lifeContext) ? parsed.lifeContext : [],
            commitments: Array.isArray(parsed.commitments) ? parsed.commitments : [],
            wishlist: Array.isArray(parsed.wishlist) ? parsed.wishlist : [],
          });
        }
      }
      const savedEval = localStorage.getItem(EVAL_STORAGE_KEY);
      if (savedEval) {
        const parsedEval = JSON.parse(savedEval);
        if (parsedEval && typeof parsedEval === "object" && "price" in parsedEval) {
          setPendingEvaluationState(parsedEval);
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const persistProfile = (next: FinancialProfile) => {
    setProfile(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore localStorage errors
    }
  };

  const setPendingEvaluation = (item: PendingPurchaseEvaluation) => {
    setPendingEvaluationState(item);
    try {
      localStorage.setItem(EVAL_STORAGE_KEY, JSON.stringify(item));
    } catch {
      // Ignore
    }
  };

  const updateProfile = (partial: Partial<FinancialProfile>) => {
    setProfile((prev) => {
      const updated = { ...prev, ...partial };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore
      }
      return updated;
    });
  };

  const loadPreloadedSandboxProfile = (presetKey: "carlos" | "mateo" = "carlos") => {
    const selected = PRELOADED_SANDBOX_PROFILES[presetKey] || PRELOADED_SANDBOX_PROFILES.carlos;
    persistProfile(selected);
  };

  const startFreshOnboarding = (email?: string) => {
    const fresh: FinancialProfile = {
      ...EMPTY_NEW_USER_PROFILE,
      email: email || "",
    };
    persistProfile(fresh);
  };

  const completeOnboarding = (data: {
    lifeContext: LifeContextTag[];
    currentBalance: number;
    payFrequency: PayFrequency;
    nextPaydayDays: number;
    nextPaydayAmount: number;
    commitments: Commitment[];
    goalTitle: string;
    goalTargetAmount: number;
  }) => {
    const defaults = getRealisticEstimateForContext(data.lifeContext);
    const roleTag = buildRoleTagFromContext(data.lifeContext);
    const target = Math.max(500, data.goalTargetAmount || 10000);
    const suggestedWeekly = Math.max(
      200,
      Math.round((data.nextPaydayAmount || defaults.nextPaydayAmount) * 0.08)
    );

    const completed: FinancialProfile = {
      id: "custom-user",
      name: profile.email ? profile.email.split("@")[0] : "Tu Perfil",
      email: profile.email,
      roleTag,
      lifeContext: data.lifeContext,
      payFrequency: data.payFrequency,
      currentBalance: data.currentBalance,
      nextPaydayDays: data.nextPaydayDays,
      nextPaydayAmount: data.nextPaydayAmount || defaults.nextPaydayAmount,
      safetyBuffer: defaults.safetyBuffer,
      dailyEssentialBurn: defaults.dailyEssentialBurn,
      commitments: data.commitments,
      goal: {
        title: data.goalTitle.trim() || "Fondo de emergencia",
        targetAmount: target,
        currentSaved: Math.round(target * 0.2),
        weeklyContribution: suggestedWeekly,
        deadlineLabel: "Meta activa",
      },
      wishlist: [
      {
        id: "wish-initial-1",
        name: "Chamarra Impermeable",
        price: 1450,
        savedAt: "2026-10-22T10:00:00.000Z",
        cooldownDays: 6,
        strategy: "wait",
      },
    ],
      isOnboarded: true,
      plaidConnected: false,
    };

    persistProfile(completed);
  };

  const addToWishlist = (
    item: Omit<WishlistItem, "id" | "savedAt">,
    xpReward = 50
  ) => {
    setProfile((prev) => {
      const existing = prev.wishlist || [];
      const newItem: WishlistItem = {
        ...item,
        id: `wish-${Date.now()}`,
        savedAt: new Date().toISOString(),
      };
      const nextStreak = (prev.streakCount ?? 3) + 1;
      const updated = {
        ...prev,
        wisdomXp: (prev.wisdomXp || 100) + xpReward,
        streakCount: nextStreak,
        wishlist: [newItem, ...existing.filter((w) => w.name !== item.name)],
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore
      }
      const celId = Date.now();
      setStreakCelebration({
        id: celId,
        count: nextStreak,
        reason: `¡Enfriamiento activo! +${xpReward} XP`,
      });
      setTimeout(() => {
        setStreakCelebration((cur) => (cur?.id === celId ? null : cur));
      }, 3200);
      return updated;
    });
  };

  const incrementStreak = (reason = "¡Buena decisión evaluada!") => {
    setProfile((prev) => {
      const nextStreak = (prev.streakCount ?? 3) + 1;
      const updated = {
        ...prev,
        streakCount: nextStreak,
        wisdomXp: (prev.wisdomXp || 100) + 25,
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore
      }
      const celId = Date.now();
      setStreakCelebration({
        id: celId,
        count: nextStreak,
        reason,
      });
      setTimeout(() => {
        setStreakCelebration((cur) => (cur?.id === celId ? null : cur));
      }, 3000);
      return updated;
    });
  };

  const awardWisdomXp = (amount = 50) => {
    setProfile((prev) => {
      const updated = {
        ...prev,
        wisdomXp: (prev.wisdomXp || 100) + amount,
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore
      }
      return updated;
    });
  };

  const registerPurchaseAnyway = (name: string, price: number) => {
    setProfile((prev) => {
      const updated = {
        ...prev,
        currentBalance: Math.max(0, prev.currentBalance - price),
        wishlist: (prev.wishlist || []).filter((w) => w.name !== name),
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore
      }
      return updated;
    });
  };

  return (
    <FinancialContext.Provider
      value={{
        profile,
        setProfile,
        updateProfile,
        loadPreloadedSandboxProfile,
        startFreshOnboarding,
        completeOnboarding,
        pendingEvaluation,
        setPendingEvaluation,
        addToWishlist,
        registerPurchaseAnyway,
        awardWisdomXp,
        incrementStreak,
        streakCelebration,
      }}
    >
      {children}
    </FinancialContext.Provider>
  );
}

export function useFinancial() {
  const context = useContext(FinancialContext);
  if (!context) {
    throw new Error("useFinancial debe usarse dentro de un FinancialProvider");
  }
  return context;
}
