"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

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

export interface FinancialProfile {
  id: string;
  name: string;
  email?: string;
  roleTag: string;
  currentBalance: number;
  nextPaydayDays: number;
  nextPaydayAmount: number;
  safetyBuffer: number;
  dailyEssentialBurn: number;
  commitments: Commitment[];
  goal: FinancialGoal;
  isOnboarded: boolean;
  plaidConnected?: boolean;
  institutionName?: string;
}

export const PRELOADED_SANDBOX_PROFILES: Record<string, FinancialProfile> = {
  carlos: {
    id: "carlos",
    name: "Carlos Mendoza",
    email: "carlos.demo@plaid-sandbox.dev",
    roleTag: "Plaid Sandbox · Nómina Quincenal · 2 compromisos próximos",
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
      title: "Fondo de Emergencia",
      targetAmount: 20000,
      currentSaved: 8000,
      weeklyContribution: 600,
      deadlineLabel: "Diciembre",
    },
    isOnboarded: true,
    plaidConnected: true,
    institutionName: "BBVA Sandbox (Plaid)",
  },
  mateo: {
    id: "mateo",
    name: "Mateo Rivera",
    email: "mateo.demo@plaid-sandbox.dev",
    roleTag: "Plaid Sandbox · Becario · Sin dependientes",
    currentBalance: 5000,
    nextPaydayDays: 6,
    nextPaydayAmount: 3500,
    safetyBuffer: 400,
    dailyEssentialBurn: 120,
    commitments: [
      { id: "c3", title: "Plan Celular", amount: 399, dueInDays: 3, category: "Servicios" },
    ],
    goal: {
      title: "Laptop de Trabajo",
      targetAmount: 15000,
      currentSaved: 10500,
      weeklyContribution: 500,
      deadlineLabel: "Diciembre",
    },
    isOnboarded: true,
    plaidConnected: true,
    institutionName: "Nu México Sandbox (Plaid)",
  },
};

export const EMPTY_NEW_USER_PROFILE: FinancialProfile = {
  id: "new-user",
  name: "Nuevo Usuario",
  email: "",
  roleTag: "Configuración en progreso",
  currentBalance: 0,
  nextPaydayDays: 7,
  nextPaydayAmount: 0,
  safetyBuffer: 500,
  dailyEssentialBurn: 150,
  commitments: [],
  goal: {
    title: "Mi primera meta",
    targetAmount: 10000,
    currentSaved: 0,
    weeklyContribution: 400,
    deadlineLabel: "Próximos meses",
  },
  isOnboarded: false,
  plaidConnected: false,
};

interface FinancialContextType {
  profile: FinancialProfile;
  setProfile: React.Dispatch<React.SetStateAction<FinancialProfile>>;
  updateProfile: (partial: Partial<FinancialProfile>) => void;
  loadPreloadedSandboxProfile: (presetKey?: "carlos" | "mateo") => void;
  startFreshOnboarding: (email?: string) => void;
}

const STORAGE_KEY = "antesdegastar_financial_profile_v1";

const FinancialContext = createContext<FinancialContextType | undefined>(undefined);

export function FinancialProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<FinancialProfile>(PRELOADED_SANDBOX_PROFILES.carlos);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object" && "currentBalance" in parsed) {
          setProfile(parsed);
        }
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const persistProfile = (next: FinancialProfile) => {
    setProfile(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage errors
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

  return (
    <FinancialContext.Provider
      value={{
        profile,
        setProfile,
        updateProfile,
        loadPreloadedSandboxProfile,
        startFreshOnboarding,
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

