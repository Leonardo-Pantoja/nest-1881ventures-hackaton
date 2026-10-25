"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { mapSupabaseRecord } from "@/lib/finance/financialMapper";
import { mapDemoFinancialProfile } from "@/lib/finance/demoFinancialProfile";
import { isMissingSupabaseSessionError } from "@/lib/finance/evaluationProfile";
import type { OnboardingProfile } from "@/lib/onboarding/financialTypes";
import { validPurchasePrice } from "@/lib/finance/money";
import { createClient } from "@/lib/supabase/client";

export type LifeContextTag =
  | "estudio"
  | "trabajo"
  | "independiente"
  | "dependientes"
  | "apoyo";

export type PayFrequency = "semanal" | "quincenal" | "mensual";

export type CommitmentDbFrequency =
  | "one_time"
  | "weekly"
  | "biweekly"
  | "monthly";

export interface Commitment {
  id: string;
  title: string;
  amount: number;
  dueInDays: number;
  category: string;
  frequency?: CommitmentDbFrequency;
  nextDueDate?: string;
  isActive?: boolean;
}

export interface TransactionRecord {
  id: string;
  title: string;
  amount: number;
  type: "expense" | "income";
  category: string;
  occurredAt: string;
  isUnforeseen?: boolean;
}

export interface PlannedExpenseItem {
  id: string;
  title: string;
  amount: number;
  dueInDays: number;
  category: string;
  frequency: CommitmentDbFrequency;
}

export interface IncomeSourceRecord {
  id: string;
  name: string;
  amount: number;
  frequency: CommitmentDbFrequency;
  nextPaymentDate?: string;
}

export interface GoalSubStage {
  id: string;
  title: string;
  targetAmount: number;
  savedAmount?: number;
}

export interface FinancialGoal {
  id?: string;
  title: string;
  targetAmount: number;
  currentSaved: number;
  weeklyContribution: number;
  deadlineLabel: string;
  savingsLocation?: "incluido" | "separado" | "desconocido";
  subGoals?: GoalSubStage[];
}

export type WishlistDecisionStatus =
  | "postponed"
  | "microsave"
  | "purchased"
  | "discarded";

export interface WishlistItem {
  id: string;
  name: string;
  price: number;
  savedAt: string;
  plannedWeeklySave?: number;
  cooldownDays?: number;
  strategy?: "wait" | "microsave";
  decision?: WishlistDecisionStatus;
  holdUntil?: string;
  savedAmount?: number;
  availableBefore?: number;
  availableAfter?: number;
  awardedXp?: number;
  explanation?: string;
}

export interface PendingPurchaseEvaluation {
  name: string;
  price: number;
  imageName?: string | null;
}

export interface FinancialProfile {
  id: string;
  name: string;
  nickname?: string;
  age?: number | null;
  dependentsCount?: number;
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
  transactions?: TransactionRecord[];
  plannedExpenses?: PlannedExpenseItem[];
  incomeSources?: IncomeSourceRecord[];
  goal: FinancialGoal;
  goalsList?: FinancialGoal[];
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
      {
        id: "c1",
        title: "Renta (Complemento)",
        amount: 2100,
        dueInDays: 2,
        category: "Vivienda",
        frequency: "monthly",
        nextDueDate: "2026-10-26",
        isActive: true,
      },
      {
        id: "c2",
        title: "Tarjeta de Crédito",
        amount: 500,
        dueInDays: 4,
        category: "Deuda",
        frequency: "monthly",
        nextDueDate: "2026-10-28",
        isActive: true,
      },
    ],
    transactions: [
      {
        id: "tx-demo-1",
        title: "Reparación de llanta (Imprevisto)",
        amount: 450,
        type: "expense",
        category: "Transporte",
        occurredAt: "2026-10-23T14:30:00.000Z",
        isUnforeseen: true,
      },
      {
        id: "tx-demo-2",
        title: "Farmacia de emergencia",
        amount: 280,
        type: "expense",
        category: "Salud",
        occurredAt: "2026-10-22T19:15:00.000Z",
        isUnforeseen: true,
      },
    ],
    plannedExpenses: [
      {
        id: "plan-demo-1",
        title: "Despensa quincenal extra",
        amount: 650,
        dueInDays: 4,
        category: "Alimentación",
        frequency: "one_time",
      },
    ],
    incomeSources: [
      {
        id: "inc-carlos-1",
        name: "Nómina Quincenal",
        amount: 9500,
        frequency: "biweekly",
        nextPaymentDate: "2026-10-30",
      },
    ],
    goal: {
      id: "goal-carlos-1",
      title: "Fondo de emergencia",
      targetAmount: 20000,
      currentSaved: 8000,
      weeklyContribution: 600,
      deadlineLabel: "Diciembre",
      savingsLocation: "separado",
      subGoals: [
        { id: "sub-c1", title: "Reserva 1 mes de renta", targetAmount: 6500 },
        { id: "sub-c2", title: "Fondo médico familiar", targetAmount: 6500 },
        { id: "sub-c3", title: "Colchón imprevistos auto", targetAmount: 7000 },
      ],
    },
    goalsList: [
      {
        id: "goal-carlos-1",
        title: "Fondo de emergencia",
        targetAmount: 20000,
        currentSaved: 8000,
        weeklyContribution: 600,
        deadlineLabel: "Diciembre",
        savingsLocation: "separado",
        subGoals: [
          { id: "sub-c1", title: "Reserva 1 mes de renta", targetAmount: 6500 },
          { id: "sub-c2", title: "Fondo médico familiar", targetAmount: 6500 },
          { id: "sub-c3", title: "Colchón imprevistos auto", targetAmount: 7000 },
        ],
      },
      {
        id: "goal-carlos-2",
        title: "Viaje Familiar",
        targetAmount: 50000,
        currentSaved: 15000,
        weeklyContribution: 1000,
        deadlineLabel: "Vacaciones Verano",
        savingsLocation: "separado",
        subGoals: [
          { id: "sub-v1", title: "Vuelos", targetAmount: 12000 },
          { id: "sub-v2", title: "Hospedaje", targetAmount: 18000 },
          { id: "sub-v3", title: "Viáticos y Tours", targetAmount: 20000 },
        ],
      },
    ],
    wishlist: [
      {
        id: "wish-initial-1",
        name: "Chamarra Impermeable",
        price: 1450,
        savedAt: "2026-10-22T10:00:00.000Z",
        holdUntil: "2026-10-30",
        cooldownDays: 6,
        strategy: "wait",
        decision: "postponed",
        availableBefore: 100,
        availableAfter: 0,
        awardedXp: 50,
        explanation:
          "En espera hasta tu próxima quincena para proteger el complemento de renta ($2,100) y tu tarjeta ($500).",
      },
      {
        id: "wish-initial-2",
        name: "Audífonos Inalámbricos Sony",
        price: 2300,
        savedAt: "2026-10-20T10:00:00.000Z",
        plannedWeeklySave: 400,
        savedAmount: 800,
        cooldownDays: 14,
        strategy: "microsave",
        decision: "microsave",
        availableBefore: 100,
        availableAfter: 100,
        awardedXp: 100,
        explanation:
          "Plan de micro-ahorro fijo semanal de $400 MXN sin comprometer tu liquidez ni retirar de tu meta.",
      },
      {
        id: "wish-initial-3",
        name: "Reloj Deportivo",
        price: 1850,
        savedAt: "2026-10-15T10:00:00.000Z",
        cooldownDays: 0,
        strategy: "wait",
        decision: "discarded",
        awardedXp: 75,
        explanation:
          "Descartado tras enfriamiento: decidiste priorizar tu Fondo de emergencia y salvaste $1,850 MXN.",
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
      {
        id: "c3",
        title: "Plan Celular",
        amount: 399,
        dueInDays: 3,
        category: "Servicios",
        frequency: "monthly",
        nextDueDate: "2026-10-27",
        isActive: true,
      },
    ],
    transactions: [
      {
        id: "tx-mateo-1",
        title: "Copias y material de laboratorio",
        amount: 180,
        type: "expense",
        category: "Educación",
        occurredAt: "2026-10-23T11:00:00.000Z",
        isUnforeseen: true,
      },
    ],
    plannedExpenses: [
      {
        id: "plan-mateo-1",
        title: "Boleto de autobús fin de semana",
        amount: 320,
        dueInDays: 5,
        category: "Transporte",
        frequency: "one_time",
      },
    ],
    incomeSources: [
      {
        id: "inc-mateo-1",
        name: "Beca + Medio Tiempo",
        amount: 3500,
        frequency: "biweekly",
        nextPaymentDate: "2026-10-30",
      },
    ],
    goal: {
      id: "goal-mateo-1",
      title: "Laptop",
      targetAmount: 15000,
      currentSaved: 10500,
      weeklyContribution: 500,
      deadlineLabel: "Diciembre",
      savingsLocation: "separado",
      subGoals: [
        { id: "sub-m1", title: "Equipo base MacBook / ThinkPad", targetAmount: 11500 },
        { id: "sub-m2", title: "Memoria RAM / SSD extra", targetAmount: 2000 },
        { id: "sub-m3", title: "Funda y periféricos", targetAmount: 1500 },
      ],
    },
    goalsList: [
      {
        id: "goal-mateo-1",
        title: "Laptop",
        targetAmount: 15000,
        currentSaved: 10500,
        weeklyContribution: 500,
        deadlineLabel: "Diciembre",
        savingsLocation: "separado",
        subGoals: [
          { id: "sub-m1", title: "Equipo base MacBook / ThinkPad", targetAmount: 11500 },
          { id: "sub-m2", title: "Memoria RAM / SSD extra", targetAmount: 2000 },
          { id: "sub-m3", title: "Funda y periféricos", targetAmount: 1500 },
        ],
      },
    ],
    wishlist: [
      {
        id: "wish-initial-1",
        name: "Chamarra Impermeable",
        price: 1450,
        savedAt: "2026-10-22T10:00:00.000Z",
        holdUntil: "2026-10-30",
        cooldownDays: 6,
        strategy: "wait",
        decision: "postponed",
        availableBefore: 2481,
        availableAfter: 1031,
        awardedXp: 50,
        explanation:
          "En espera 6 días para confirmar que no afecte tu gasto diario de transporte y copias.",
      },
      {
        id: "wish-mateo-2",
        name: "Monitor Externo 24 pulgadas",
        price: 2800,
        savedAt: "2026-10-19T10:00:00.000Z",
        plannedWeeklySave: 350,
        savedAmount: 1050,
        cooldownDays: 10,
        strategy: "microsave",
        decision: "microsave",
        availableBefore: 2481,
        availableAfter: 2481,
        awardedXp: 100,
        explanation:
          "Ahorro programado de $350/semana sin tocar los $10,500 MXN ya reservados para tu Laptop.",
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
    weeklyContribution: 0,
    deadlineLabel: "Próximos meses",
  },
  wishlist: [],
  isOnboarded: false,
  plaidConnected: false,
};

const LIFE_CONTEXT_LABELS: Record<LifeContextTag, string> = {
  estudio: "Estudio",
  trabajo: "Trabajo",
  independiente: "Pago mi vivienda",
  dependientes: "Mantengo a otras personas",
  apoyo: "Recibo apoyo económico",
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

export type FinancialMode =
  | "loading"
  | "anonymous"
  | "authenticated"
  | "demo"
  | "error";

export interface OnboardingData {
  lifeContext: LifeContextTag[];
  currentBalance: number;
  payFrequency: PayFrequency;
  nextPaydayDays: number;
  nextPaydayAmount: number;
  commitments: Commitment[];
  goalTitle: string;
  goalTargetAmount: number;
}

interface FinancialContextType {
  profile: FinancialProfile;
  mode: FinancialMode;
  profileError: string | null;
  financialProfile: OnboardingProfile | null;
  financialVersion: string;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  setProfile: React.Dispatch<React.SetStateAction<FinancialProfile>>;
  updateProfile: (partial: Partial<FinancialProfile>) => void;
  loadPreloadedSandboxProfile: (presetKey?: "carlos" | "mateo") => void;
  startFreshOnboarding: (email?: string, demo?: boolean, displayName?: string) => void;
  completeOnboarding: (data: OnboardingData, userId?: string) => void;
  pendingEvaluation: PendingPurchaseEvaluation;
  setPendingEvaluation: (item: PendingPurchaseEvaluation) => void;
  addToWishlist: (
    item: Omit<WishlistItem, "id" | "savedAt">,
    xpReward?: number,
  ) => Promise<number>;
  registerPurchaseAnyway: (name: string, price: number, operationId: string, revision?: string) => Promise<void>;
  awardWisdomXp: (amount?: number) => void;
  incrementStreak: (reason?: string) => void;
  streakCelebration: { id: number; count: number; reason: string } | null;
  addCommitment: (input: {
    title: string;
    amount: number;
    category: string;
    frequency: CommitmentDbFrequency;
    nextDueDate: string;
  }) => Promise<void>;
  updateCommitmentItem: (
    id: string,
    updates: {
      title?: string;
      amount?: number;
      category?: string;
      frequency?: CommitmentDbFrequency;
      nextDueDate?: string;
      isActive?: boolean;
    },
  ) => Promise<void>;
  deactivateCommitment: (id: string) => Promise<void>;
  addExpenseTransaction: (input: {
    title: string;
    amount: number;
    category: string;
    occurredAt?: string;
  }) => Promise<void>;
  addPlannedExpense: (input: {
    title: string;
    amount: number;
    category: string;
    dueInDays: number;
    frequency: CommitmentDbFrequency;
  }) => void;
  removePlannedExpense: (id: string) => void;
  contributeToWishlistItem: (id: string, amount: number) => Promise<void>;
  updateWishlistDecisionStatus: (
    id: string,
    decisionStatus: "purchased" | "discarded",
  ) => Promise<void>;
  saveGoalWithSubGoals: (input: {
    id?: string;
    title: string;
    targetAmount: number;
    currentSaved: number;
    weeklyContribution: number;
    savingsLocation: "incluido" | "separado" | "desconocido";
    deadlineLabel?: string;
    subGoals: GoalSubStage[];
  }) => Promise<void>;
  selectActiveGoal: (goalId: string) => void;
  saveFullProfileSettings: (input: {
    displayName: string;
    nickname?: string;
    age?: number | null;
    dependentsCount?: number;
    lifeContext: LifeContextTag[];
    currentBalance: number;
    safetyBuffer: number;
    dailyEssentialBurn: number;
  }) => Promise<void>;
  upsertIncomeSource: (input: {
    id?: string;
    name: string;
    amount: number;
    frequency: CommitmentDbFrequency;
    nextPaymentDate: string;
  }) => Promise<void>;
  deleteIncomeSource: (id: string) => Promise<void>;
}

const DEMO_STORAGE_KEY = "antesdegastar_demo_profile_v2";
const LEGACY_STORAGE_KEY = "antesdegastar_financial_profile_v1";
const EVAL_STORAGE_KEY = "antesdegastar_pending_eval_v1";
const SUBGOALS_STORAGE_PREFIX = "antesdegastar_goal_subgoals_v1_";
const WISHLIST_META_STORAGE_PREFIX = "antesdegastar_wishlist_meta_v1_";

function readStoredSubGoals(goalId?: string): GoalSubStage[] {
  if (!goalId || typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${SUBGOALS_STORAGE_PREFIX}${goalId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStoredSubGoals(goalId: string, subGoals: GoalSubStage[]): void {
  if (!goalId || typeof window === "undefined") return;
  try {
    localStorage.setItem(
      `${SUBGOALS_STORAGE_PREFIX}${goalId}`,
      JSON.stringify(subGoals),
    );
  } catch {
    // ignore storage quota errors
  }
}

interface StoredWishlistMeta {
  savedAmount?: number;
  decision?: WishlistDecisionStatus;
}

function readWishlistMetaMap(userId: string): Record<string, StoredWishlistMeta> {
  if (!userId || typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(`${WISHLIST_META_STORAGE_PREFIX}${userId}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function writeWishlistMetaMap(
  userId: string,
  map: Record<string, StoredWishlistMeta>,
): void {
  if (!userId || typeof window === "undefined") return;
  try {
    localStorage.setItem(
      `${WISHLIST_META_STORAGE_PREFIX}${userId}`,
      JSON.stringify(map),
    );
  } catch {
    // ignore storage errors
  }
}
const FinancialContext = createContext<FinancialContextType | undefined>(
  undefined,
);

const cleanProfile = (): FinancialProfile => ({
  ...EMPTY_NEW_USER_PROFILE,
  lifeContext: [],
  commitments: [],
  transactions: [],
  plannedExpenses: [],
  incomeSources: [],
  goal: { ...EMPTY_NEW_USER_PROFILE.goal },
  wishlist: [],
});

function dateStringFromDaysUntil(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + Math.max(0, Math.round(days)));
  return d.toISOString().slice(0, 10);
}

function daysUntil(dateValue?: string | null): number {
  if (!dateValue) return 0;
  const [year, month, day] = dateValue.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return 0;
  const today = new Date();
  const a = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const b = Date.UTC(year, month - 1, day);
  return Math.max(0, Math.ceil((b - a) / 86400000));
}

function toFrequency(value?: string | null): PayFrequency {
  return value === "weekly"
    ? "semanal"
    : value === "monthly"
      ? "mensual"
      : "quincenal";
}

export function FinancialProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [mode, setMode] = useState<FinancialMode>("loading");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profile, setProfile] = useState<FinancialProfile>(cleanProfile);
  const requestVersion = useRef(0);
  const [accountFinancialProfile, setAccountFinancialProfile] = useState<OnboardingProfile | null>(null);
  const [accountVersion, setAccountVersion] = useState("");
  const pendingPurchases = useRef(new Map<string, Promise<void>>());
  const completedPurchases = useRef(new Set<string>());
  const [pendingEvaluation, setPendingEvaluationState] =
    useState<PendingPurchaseEvaluation>({
      name: "",
      price: 0,
      imageName: null,
    });
  const [streakCelebration, setStreakCelebration] = useState<{
    id: number;
    count: number;
    reason: string;
  } | null>(null);

  const refreshProfile = useCallback(async (silent = false) => {
    const ticket = ++requestVersion.current;
    if (!silent) { setMode("loading"); setProfile(cleanProfile()); }
    setProfileError(null);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (ticket !== requestVersion.current) return;
      if (authError && !isMissingSupabaseSessionError(authError)) throw authError;
      if (!user) {
        setMode("anonymous");
        return;
      }

      const [
        profileRes,
        incomeRes,
        commitmentRes,
        goalRes,
        wishlistRes,
        transactionsRes,
        analysesRes,
      ] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase
          .from("income_sources")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .order("next_payment_date", { ascending: true }),
        supabase
          .from("commitments")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .order("next_due_date", { ascending: true }),
        supabase
          .from("goals")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .order("created_at", { ascending: true }),
        supabase
          .from("wishlist_items")
          .select("*")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false }),
        supabase
          .from("transactions")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50),
        Promise.resolve(
          supabase
            .from("purchase_analyses")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(50),
        ).catch(() => ({ data: [], error: null })),
      ]);
      if (ticket !== requestVersion.current) return;
      for (const result of [
        profileRes,
        incomeRes,
        commitmentRes,
        goalRes,
        wishlistRes,
      ]) {
        if (result.error) throw result.error;
      }

      const rows = {
        profile: profileRes.data,
        incomeSources: incomeRes.data ?? [],
        commitments: commitmentRes.data ?? [],
        goals: goalRes.data ?? [],
      };
      setAccountFinancialProfile(mapSupabaseRecord(rows));
      setAccountVersion(JSON.stringify(rows));
      const p = profileRes.data;
      const nextIncome = incomeRes.data?.[0];
      const mappedGoalsList: FinancialGoal[] = (goalRes.data ?? []).map(
        (g: Record<string, unknown>) => {
          const gId = String(g.id ?? "");
          const storedSubs = readStoredSubGoals(gId);
          const loc = g.savings_location;
          const savingsLoc: "incluido" | "separado" | "desconocido" =
            loc === "incluido" || loc === "separado" || loc === "desconocido"
              ? loc
              : Number(g.current_saved ?? 0) > 0
                ? "separado"
                : "desconocido";
          return {
            id: gId,
            title: String(g.title ?? "Meta de ahorro"),
            targetAmount: Number(g.target_amount ?? 0),
            currentSaved: Number(g.current_saved ?? 0),
            weeklyContribution: Number(g.weekly_contribution ?? 0),
            deadlineLabel:
              typeof g.target_date === "string" && g.target_date
                ? g.target_date
                : "Sin fecha definida",
            savingsLocation: savingsLoc,
            subGoals: storedSubs,
          };
        },
      );
      const goalRow = mappedGoalsList[0];
      const wishlistMeta = readWishlistMetaMap(user.id);
      const analysesList = Array.isArray(analysesRes?.data)
        ? (analysesRes.data as Record<string, unknown>[])
        : [];
      const tags = (p?.lifestyle_tags ?? []).filter((tag: string) =>
        [
          "estudio",
          "trabajo",
          "independiente",
          "dependientes",
          "apoyo",
        ].includes(tag),
      ) as LifeContextTag[];

      setProfile({
        ...cleanProfile(),
        id: user.id,
        name:
          p?.display_name ||
          user.user_metadata?.display_name ||
          user.user_metadata?.full_name ||
          user.email?.split("@")[0] ||
          "Tu Perfil",
        nickname:
          (typeof p?.nickname === "string" ? p.nickname : undefined) ||
          (typeof p?.apodo === "string" ? p.apodo : undefined) ||
          (typeof user.user_metadata?.nickname === "string"
            ? user.user_metadata.nickname
            : undefined) ||
          "",
        age:
          typeof p?.age === "number"
            ? p.age
            : typeof user.user_metadata?.age === "number"
              ? user.user_metadata.age
              : null,
        dependentsCount:
          typeof p?.dependents_count === "number"
            ? p.dependents_count
            : typeof user.user_metadata?.dependents_count === "number"
              ? user.user_metadata.dependents_count
              : tags.includes("dependientes")
                ? 1
                : 0,
        email: user.email ?? "",
        roleTag: buildRoleTagFromContext(tags),
        lifeContext: tags,
        currentBalance: Number(p?.current_balance ?? 0),
        safetyBuffer: Number(p?.safety_buffer ?? 0),
        dailyEssentialBurn: Number(p?.daily_essential_budget ?? 0),
        payFrequency: toFrequency(nextIncome?.frequency),
        nextPaydayDays: daysUntil(nextIncome?.next_payment_date),
        nextPaydayAmount: Number(nextIncome?.amount ?? 0),
        commitments: (commitmentRes.data ?? []).map((item) => ({
          id: item.id,
          title: item.title,
          amount: Number(Number(item.amount).toFixed(2)),
          dueInDays: daysUntil(item.next_due_date),
          category: item.category,
          frequency: (item.frequency as CommitmentDbFrequency) || "monthly",
          nextDueDate:
            item.next_due_date ??
            dateStringFromDaysUntil(daysUntil(item.next_due_date)),
          isActive: item.is_active !== false,
        })),
        transactions: (transactionsRes.data ?? []).map(
          (tx: Record<string, unknown>) => ({
            id: String(tx.id ?? `tx-${Date.now()}`),
            title: String(
              tx.title ?? tx.description ?? tx.name ?? "Gasto registrado",
            ),
            amount: Number(Number(tx.amount ?? 0).toFixed(2)),
            type: (tx.type === "income" ? "income" : "expense") as
              | "expense"
              | "income",
            category: String(tx.category ?? "Imprevistos"),
            occurredAt: String(
              tx.occurred_at ??
                tx.transaction_date ??
                tx.created_at ??
                new Date().toISOString(),
            ),
            isUnforeseen: true,
          }),
        ),
        incomeSources: (incomeRes.data ?? []).map(
          (inc: Record<string, unknown>) => ({
            id: String(inc.id ?? "income-1"),
            name: String(inc.name ?? inc.title ?? "Ingreso principal"),
            amount: Number(Number(inc.amount ?? 0).toFixed(2)),
            frequency: (inc.frequency as CommitmentDbFrequency) || "biweekly",
            nextPaymentDate:
              typeof inc.next_payment_date === "string"
                ? inc.next_payment_date
                : undefined,
          }),
        ),
        goal: goalRow
          ? goalRow
          : {
              ...EMPTY_NEW_USER_PROFILE.goal,
              currentSaved: 0,
              weeklyContribution: 0,
              savingsLocation: "separado",
              subGoals: [],
            },
        goalsList: mappedGoalsList,
        wishlist: (wishlistRes.data ?? []).map((item) => {
          const matchedAnalysis = analysesList.find(
            (a) =>
              String(a.wishlist_item_id ?? "") === String(item.id) ||
              String(a.item_name ?? a.name ?? "").toLowerCase() ===
                String(item.name ?? "").toLowerCase(),
          );
          const localMeta = wishlistMeta[String(item.id)] ?? {};
          const rawDecision =
            localMeta.decision ??
            (typeof item.decision === "string" ? item.decision : undefined) ??
            (typeof item.status === "string" ? item.status : undefined) ??
            (typeof matchedAnalysis?.decision === "string"
              ? matchedAnalysis.decision
              : undefined);
          const normalizedDecision: WishlistDecisionStatus =
            rawDecision === "purchased" ||
            rawDecision === "discarded" ||
            rawDecision === "microsave" ||
            rawDecision === "postponed"
              ? rawDecision
              : item.strategy === "microsave"
                ? "microsave"
                : "postponed";

          return {
            id: item.id,
            name: item.name,
            price: Number(item.price),
            savedAt: item.saved_at,
            holdUntil:
              typeof item.hold_until === "string" ? item.hold_until : undefined,
            plannedWeeklySave:
              item.planned_weekly_save == null
                ? undefined
                : Number(item.planned_weekly_save),
            savedAmount:
              localMeta.savedAmount ??
              (item.saved_amount != null ? Number(item.saved_amount) : 0),
            cooldownDays: daysUntil(item.hold_until),
            strategy: item.strategy as "wait" | "microsave",
            decision: normalizedDecision,
            availableBefore:
              matchedAnalysis?.available_before != null
                ? Number(matchedAnalysis.available_before)
                : undefined,
            availableAfter:
              matchedAnalysis?.available_after != null
                ? Number(matchedAnalysis.available_after)
                : undefined,
            awardedXp:
              matchedAnalysis?.awarded_xp != null
                ? Number(matchedAnalysis.awarded_xp)
                : item.strategy === "microsave"
                  ? 100
                  : 50,
            explanation:
              typeof matchedAnalysis?.explanation === "string"
                ? matchedAnalysis.explanation
                : undefined,
          };
        }),
        wisdomXp: Number(p?.wisdom_xp ?? 0),
        streakCount: Number(p?.streak_count ?? 0),
        isOnboarded: Boolean(p?.onboarding_completed_at),
        plaidConnected: false,
      });
      setMode("authenticated");
    } catch (error) {
      if (ticket !== requestVersion.current) return;
      console.error("Financial profile loading failed:", error);
      setProfileError(
        error instanceof Error ? error.message : "Error al cargar el perfil",
      );
      setMode("error");
    }
  }, [supabase]);

  useEffect(() => {
    const initialize = () => {
    // Do not reuse the old, shared localStorage profile for different accounts.
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    try {
      const saved = sessionStorage.getItem(DEMO_STORAGE_KEY);
      if (saved) {
        const demo = JSON.parse(saved) as FinancialProfile;
        if (demo?.id && demo?.goal && Array.isArray(demo?.commitments)) {
          setProfile(demo);
          setMode("demo");
        } else {
          sessionStorage.removeItem(DEMO_STORAGE_KEY);
          void refreshProfile();
        }
      } else {
        void refreshProfile();
      }
      const savedEval = sessionStorage.getItem(EVAL_STORAGE_KEY);
      if (savedEval) {
        const value = JSON.parse(savedEval) as PendingPurchaseEvaluation;
        if (typeof value.price === "number") setPendingEvaluationState(value);
      }
    } catch {
      void refreshProfile();
    }

    };
    const initialization = setTimeout(initialize, 0);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        ++requestVersion.current;
        sessionStorage.removeItem(DEMO_STORAGE_KEY);
        setProfile(cleanProfile());
        setMode("anonymous");
        setProfileError(null);
      }
      // Defer Supabase calls outside the auth callback.
      if (event === "SIGNED_IN" && !sessionStorage.getItem(DEMO_STORAGE_KEY)) {
        setTimeout(() => {
          void refreshProfile();
        }, 0);
      }
    });
    return () => {
      clearTimeout(initialization);
      subscription.unsubscribe();
    };
  }, [supabase, refreshProfile]);

  const persistDemo = (value: FinancialProfile) => {
    setProfile(value);
    if (mode === "demo")
      sessionStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(value));
  };

  const setPendingEvaluation = (item: PendingPurchaseEvaluation) => {
    setPendingEvaluationState(item);
    sessionStorage.setItem(EVAL_STORAGE_KEY, JSON.stringify(item));
  };

  const loadPreloadedSandboxProfile = (
    presetKey: "carlos" | "mateo" = "carlos",
  ) => {
    ++requestVersion.current;
    const selected = PRELOADED_SANDBOX_PROFILES[presetKey];
    sessionStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(selected));
    setProfile({ ...selected });
    setMode("demo");
    setProfileError(null);
  };

  const startFreshOnboarding = (email?: string, demo = false, displayName?: string) => {
    ++requestVersion.current;
    const cleanDisplayName = displayName?.trim() || email?.split("@")[0] || "Tu Perfil";
    const fresh = { ...cleanProfile(), name: cleanDisplayName, email: email || "" };
    if (demo) {
      sessionStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(fresh));
      setMode("demo");
    } else {
      sessionStorage.removeItem(DEMO_STORAGE_KEY);
      setMode("authenticated");
    }
    setProfile(fresh);
  };

  const completeOnboarding = (data: OnboardingData, userId?: string) => {
    const defaults = getRealisticEstimateForContext(data.lifeContext);
    const completed: FinancialProfile = {
      ...cleanProfile(),
      id: userId ?? "demo-custom-user",
      name:
        (profile.name && profile.name !== "Tu Perfil" ? profile.name : "") ||
        profile.email?.split("@")[0] ||
        "Tu Perfil",
      email: profile.email,
      roleTag: buildRoleTagFromContext(data.lifeContext),
      lifeContext: data.lifeContext,
      payFrequency: data.payFrequency,
      currentBalance: data.currentBalance,
      nextPaydayDays: data.nextPaydayDays,
      nextPaydayAmount: data.nextPaydayAmount,
      safetyBuffer: defaults.safetyBuffer,
      dailyEssentialBurn: defaults.dailyEssentialBurn,
      commitments: data.commitments,
      goal: {
        title: data.goalTitle.trim() || "Fondo de emergencia",
        targetAmount: data.goalTargetAmount,
        currentSaved: 0,
        weeklyContribution: 0,
        deadlineLabel: "Meta activa",
      },
      wishlist: [],
      wisdomXp: 0,
      streakCount: 0,
      isOnboarded: true,
      plaidConnected: false,
    };
    if (userId) {
      sessionStorage.removeItem(DEMO_STORAGE_KEY);
      setProfile(completed);
      setMode("authenticated");
      // Database is canonical; reload exact persisted values.
      void refreshProfile();
    } else {
      sessionStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(completed));
      setProfile(completed);
      setMode("demo");
    }
  };

  const updateProfile = (partial: Partial<FinancialProfile>) => {
    if (mode === "demo") {
      const updated = { ...profile, ...partial };
      persistDemo(updated);
    } else {
      // Authenticated balance changes must use an atomic database transaction.
      console.warn(
        "updateProfile is demo-only until the database mutation is implemented.",
      );
    }
  };

  const announceStreak = (count: number, reason: string) => {
    const id = Date.now();
    setStreakCelebration({ id, count, reason });
    setTimeout(
      () =>
        setStreakCelebration((current) =>
          current?.id === id ? null : current,
        ),
      3200,
    );
  };

  const addToWishlist = async (
    item: Omit<WishlistItem, "id" | "savedAt">,
    xpReward = 50,
  ): Promise<number> => {
    if (mode === "demo") {
      const next = {
        ...profile,
        wisdomXp: (profile.wisdomXp ?? 0) + xpReward,
        streakCount: (profile.streakCount ?? 0) + 1,
        wishlist: [
          {
            ...item,
            id: `wish-${Date.now()}`,
            savedAt: new Date().toISOString(),
          },
          ...(profile.wishlist || []).filter((w) => w.name !== item.name),
        ],
      };
      persistDemo(next);
      announceStreak(next.streakCount, `¡Enfriamiento activo! +${xpReward} XP`);
      return xpReward;
    }

    if (mode !== "authenticated") {
      throw new Error("Debes iniciar sesión para guardar compras.");
    }
    if (!item.name.trim() || !Number.isFinite(item.price) || item.price <= 0) {
      throw new Error("Selecciona un producto con precio válido.");
    }

    const { data, error } = await supabase.rpc("save_wishlist_item", {
      p_name: item.name.trim(),
      p_price: item.price,
      p_strategy: item.strategy ?? "wait",
      p_cooldown_days: Math.min(365, Math.max(1, item.cooldownDays ?? 7)),
      p_planned_weekly_save:
        item.strategy === "microsave" ? (item.plannedWeeklySave ?? 400) : null,
    });
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Supabase no devolvió la compra guardada.");

    const saved = data as {
      id: string;
      name: string;
      price: number;
      saved_at: string;
      hold_until: string;
      planned_weekly_save: number | null;
      strategy: "wait" | "microsave";
      wisdom_xp: number;
      streak_count: number;
      xp_awarded: number;
    };
    setProfile((prev) => prev.id !== profile.id ? prev : ({
      ...prev,
      wishlist: [
        {
          id: saved.id,
          name: saved.name,
          price: Number(saved.price),
          savedAt: saved.saved_at,
          cooldownDays: daysUntil(saved.hold_until),
          plannedWeeklySave:
            saved.planned_weekly_save == null
              ? undefined
              : Number(saved.planned_weekly_save),
          strategy: saved.strategy,
        },
        ...(prev.wishlist || []).filter(
          (w) => w.id !== saved.id && w.name !== saved.name,
        ),
      ],
      wisdomXp: Number(saved.wisdom_xp),
      streakCount: Number(saved.streak_count),
    }));
    return Number(saved.xp_awarded);
  };

  const registerPurchaseAnyway = (name: string, price: number, operationId: string, revision?: string): Promise<void> => {
    const accountKey = JSON.stringify([mode, profile.id, operationId]);
    const pending = pendingPurchases.current.get(accountKey);
    if (pending) return pending;
    if (completedPurchases.current.has(accountKey)) return Promise.resolve();
    const ticket = requestVersion.current;
    const operation = (async () => {
      if (!name.trim() || !validPurchasePrice(price) || !operationId) throw new Error("Selecciona un producto con precio válido.");
      if (mode === "demo") {
        if (price > profile.currentBalance) throw new Error("Saldo insuficiente.");
        const roundedPrice = Number(price.toFixed(2));
        persistDemo({
          ...profile,
          currentBalance: (Math.round(profile.currentBalance * 100) - Math.round(roundedPrice * 100)) / 100,
          wishlist: (profile.wishlist ?? []).filter((w) => w.name !== name),
          transactions: [
            {
              id: `tx-${Date.now()}`,
              title: name.trim(),
              amount: roundedPrice,
              type: "expense",
              category: "Compras",
              occurredAt: new Date().toISOString(),
              isUnforeseen: true,
            },
            ...(profile.transactions ?? []),
          ],
        });
        return;
      }
      if (mode !== "authenticated") throw new Error("Debes iniciar sesión para registrar una compra.");
      const response = await fetch("/api/purchases", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemName: name.trim(), itemPrice: price, operationId, financialRevision: revision }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudo registrar la compra.");
      if (ticket !== requestVersion.current) { await refreshProfile(true); return; }
      if (typeof result.currentBalance !== "number" || !Number.isFinite(result.currentBalance)) throw new Error("El servidor no confirmó el saldo.");
      setProfile(prev => prev.id === profile.id ? { ...prev, currentBalance: result.currentBalance, wishlist: (prev.wishlist ?? []).filter(w => w.name !== name) } : prev);
      setAccountFinancialProfile(prev => prev?.id === profile.id ? { ...prev, currentBalance: result.currentBalance } : prev);
      await refreshProfile(true);
    })();
    pendingPurchases.current.set(accountKey, operation);
    void operation.then(() => completedPurchases.current.add(accountKey)).catch(() => {}).finally(() => pendingPurchases.current.delete(accountKey));
    return operation;
  };

  const addCommitment = async (input: {
    title: string;
    amount: number;
    category: string;
    frequency: CommitmentDbFrequency;
    nextDueDate: string;
  }): Promise<void> => {
    const cleanTitle = input.title.trim();
    const roundedAmount = Number(Number(input.amount).toFixed(2));
    if (!cleanTitle || !Number.isFinite(roundedAmount) || roundedAmount <= 0) {
      throw new Error("Ingresa un nombre y un monto válido mayor a cero.");
    }
    const dueDays = daysUntil(input.nextDueDate);

    if (mode === "demo") {
      const nextCommitment: Commitment = {
        id: `comm-${Date.now()}`,
        title: cleanTitle,
        amount: roundedAmount,
        dueInDays: dueDays,
        category: input.category || "Otros",
        frequency: input.frequency,
        nextDueDate: input.nextDueDate,
        isActive: true,
      };
      persistDemo({
        ...profile,
        commitments: [...profile.commitments, nextCommitment],
      });
      return;
    }

    if (mode !== "authenticated") {
      throw new Error("Debes iniciar sesión para guardar un compromiso.");
    }

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr || !user) {
      throw new Error("No se pudo verificar el usuario autenticado.");
    }

    const { error } = await supabase.from("commitments").insert({
      user_id: user.id,
      title: cleanTitle,
      amount: roundedAmount,
      category: input.category || "Otros",
      frequency: input.frequency,
      next_due_date: input.nextDueDate,
      is_active: true,
    });

    if (error) throw new Error(error.message);
    await refreshProfile(true);
  };

  const updateCommitmentItem = async (
    id: string,
    updates: {
      title?: string;
      amount?: number;
      category?: string;
      frequency?: CommitmentDbFrequency;
      nextDueDate?: string;
      isActive?: boolean;
    },
  ): Promise<void> => {
    const roundedAmount =
      updates.amount !== undefined
        ? Number(Number(updates.amount).toFixed(2))
        : undefined;

    if (mode === "demo") {
      const nextCommitments = profile.commitments
        .map((c) => {
          if (c.id !== id) return c;
          const nextDate = updates.nextDueDate ?? c.nextDueDate;
          return {
            ...c,
            title: updates.title !== undefined ? updates.title.trim() : c.title,
            amount: roundedAmount !== undefined ? roundedAmount : c.amount,
            category: updates.category ?? c.category,
            frequency: updates.frequency ?? c.frequency,
            nextDueDate: nextDate,
            dueInDays: nextDate ? daysUntil(nextDate) : c.dueInDays,
            isActive: updates.isActive ?? c.isActive,
          };
        })
        .filter((c) => c.isActive !== false);
      persistDemo({
        ...profile,
        commitments: nextCommitments,
      });
      return;
    }

    if (mode !== "authenticated") {
      throw new Error("Debes iniciar sesión para actualizar un compromiso.");
    }

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr || !user) {
      throw new Error("No se pudo verificar el usuario autenticado.");
    }

    const dbPayload: Record<string, unknown> = {
      user_id: user.id,
    };
    if (updates.title !== undefined) dbPayload.title = updates.title.trim();
    if (roundedAmount !== undefined) dbPayload.amount = roundedAmount;
    if (updates.category !== undefined) dbPayload.category = updates.category;
    if (updates.frequency !== undefined) dbPayload.frequency = updates.frequency;
    if (updates.nextDueDate !== undefined)
      dbPayload.next_due_date = updates.nextDueDate;
    if (updates.isActive !== undefined) dbPayload.is_active = updates.isActive;

    const { error } = await supabase
      .from("commitments")
      .update(dbPayload)
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);
    await refreshProfile(true);
  };

  const deactivateCommitment = async (id: string): Promise<void> => {
    await updateCommitmentItem(id, { isActive: false });
  };

  const addExpenseTransaction = async (input: {
    title: string;
    amount: number;
    category: string;
    occurredAt?: string;
  }): Promise<void> => {
    const cleanTitle = input.title.trim();
    const roundedAmount = Number(Number(input.amount).toFixed(2));
    if (!cleanTitle || !Number.isFinite(roundedAmount) || roundedAmount <= 0) {
      throw new Error("Ingresa una descripción y un monto válido mayor a cero.");
    }

    const occurredIso = input.occurredAt
      ? new Date(input.occurredAt).toISOString()
      : new Date().toISOString();

    if (mode === "demo") {
      const nextBalance = Math.max(
        0,
        Number(
          (
            (Math.round(profile.currentBalance * 100) -
              Math.round(roundedAmount * 100)) /
            100
          ).toFixed(2),
        ),
      );
      const nextTx: TransactionRecord = {
        id: `tx-${Date.now()}`,
        title: cleanTitle,
        amount: roundedAmount,
        type: "expense",
        category: input.category || "Imprevistos",
        occurredAt: occurredIso,
        isUnforeseen: true,
      };
      persistDemo({
        ...profile,
        currentBalance: nextBalance,
        transactions: [nextTx, ...(profile.transactions ?? [])],
      });
      return;
    }

    if (mode !== "authenticated") {
      throw new Error("Debes iniciar sesión para registrar un gasto.");
    }

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr || !user) {
      throw new Error("No se pudo verificar el usuario autenticado.");
    }

    const { error: txError } = await supabase.from("transactions").insert({
      user_id: user.id,
      title: cleanTitle,
      amount: roundedAmount,
      type: "expense",
      category: input.category || "Imprevistos",
    });

    if (txError) throw new Error(txError.message);

    // Also update current_balance in profiles if the DB trigger didn't already deduct it
    const nextBalance = Math.max(
      0,
      Number(
        (
          (Math.round(profile.currentBalance * 100) -
            Math.round(roundedAmount * 100)) /
          100
        ).toFixed(2),
      ),
    );
    await supabase
      .from("profiles")
      .update({ current_balance: nextBalance })
      .eq("id", user.id);

    await refreshProfile(true);
  };

  const addPlannedExpense = (input: {
    title: string;
    amount: number;
    category: string;
    dueInDays: number;
    frequency: CommitmentDbFrequency;
  }) => {
    const cleanTitle = input.title.trim();
    const roundedAmount = Number(Number(input.amount).toFixed(2));
    if (!cleanTitle || !Number.isFinite(roundedAmount) || roundedAmount <= 0)
      return;

    const item: PlannedExpenseItem = {
      id: `plan-${Date.now()}`,
      title: cleanTitle,
      amount: roundedAmount,
      dueInDays: Math.max(0, Math.round(input.dueInDays)),
      category: input.category || "Planeado",
      frequency: input.frequency,
    };

    const nextPlanned = [...(profile.plannedExpenses ?? []), item];
    if (mode === "demo") {
      persistDemo({ ...profile, plannedExpenses: nextPlanned });
    } else {
      setProfile((prev) => ({ ...prev, plannedExpenses: nextPlanned }));
    }
  };

  const removePlannedExpense = (id: string) => {
    const nextPlanned = (profile.plannedExpenses ?? []).filter(
      (item) => item.id !== id,
    );
    if (mode === "demo") {
      persistDemo({ ...profile, plannedExpenses: nextPlanned });
    } else {
      setProfile((prev) => ({ ...prev, plannedExpenses: nextPlanned }));
    }
  };

  const contributeToWishlistItem = async (
    id: string,
    amount: number,
  ): Promise<void> => {
    const roundedAmount = Number(Number(amount).toFixed(2));
    if (!Number.isFinite(roundedAmount) || roundedAmount <= 0) {
      throw new Error("Ingresa un abono válido mayor a cero.");
    }

    const targetItem = (profile.wishlist ?? []).find((w) => w.id === id);
    if (!targetItem) {
      throw new Error("No se encontró el artículo en enfriamiento.");
    }

    const nextSavedAmount = Math.min(
      targetItem.price,
      Number(
        (
          (Math.round((targetItem.savedAmount ?? 0) * 100) +
            Math.round(roundedAmount * 100)) /
          100
        ).toFixed(2),
      ),
    );

    if (mode === "demo") {
      const nextWishlist = (profile.wishlist ?? []).map((w) =>
        w.id === id
          ? {
              ...w,
              savedAmount: nextSavedAmount,
              strategy: "microsave" as const,
              decision:
                w.decision === "purchased" || w.decision === "discarded"
                  ? w.decision
                  : ("microsave" as const),
            }
          : w,
      );
      persistDemo({
        ...profile,
        wishlist: nextWishlist,
        wisdomXp: (profile.wisdomXp ?? 0) + 25,
      });
      return;
    }

    if (mode !== "authenticated") {
      throw new Error("Debes iniciar sesión para registrar abonos.");
    }

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr || !user) {
      throw new Error("No se pudo verificar el usuario autenticado.");
    }

    const currentMeta = readWishlistMetaMap(user.id);
    currentMeta[id] = {
      ...currentMeta[id],
      savedAmount: nextSavedAmount,
      decision: currentMeta[id]?.decision ?? "microsave",
    };
    writeWishlistMetaMap(user.id, currentMeta);

    // Best-effort update on wishlist_items if saved_amount column exists
    await Promise.resolve(
      supabase
        .from("wishlist_items")
        .update({
          user_id: user.id,
          saved_amount: nextSavedAmount,
          strategy: "microsave",
        })
        .eq("id", id)
        .eq("user_id", user.id),
    ).catch(() => null);

    setProfile((prev) => ({
      ...prev,
      wishlist: (prev.wishlist ?? []).map((w) =>
        w.id === id
          ? {
              ...w,
              savedAmount: nextSavedAmount,
              strategy: "microsave",
              decision:
                w.decision === "purchased" || w.decision === "discarded"
                  ? w.decision
                  : "microsave",
            }
          : w,
      ),
      wisdomXp: (prev.wisdomXp ?? 0) + 25,
    }));
  };

  const updateWishlistDecisionStatus = async (
    id: string,
    decisionStatus: "purchased" | "discarded",
  ): Promise<void> => {
    const targetItem = (profile.wishlist ?? []).find((w) => w.id === id);
    if (!targetItem) {
      throw new Error("No se encontró el artículo en enfriamiento.");
    }

    const bonusXp = decisionStatus === "discarded" ? 75 : 25;

    if (mode === "demo") {
      const nextBalance =
        decisionStatus === "purchased"
          ? Math.max(
              0,
              Number(
                (
                  (Math.round(profile.currentBalance * 100) -
                    Math.round(targetItem.price * 100)) /
                  100
                ).toFixed(2),
              ),
            )
          : profile.currentBalance;

      const nextWishlist = (profile.wishlist ?? []).map((w) =>
        w.id === id
          ? {
              ...w,
              decision: decisionStatus,
              awardedXp: (w.awardedXp ?? 50) + bonusXp,
            }
          : w,
      );

      persistDemo({
        ...profile,
        currentBalance: nextBalance,
        wishlist: nextWishlist,
        wisdomXp: (profile.wisdomXp ?? 0) + bonusXp,
        streakCount:
          decisionStatus === "discarded"
            ? (profile.streakCount ?? 0) + 1
            : profile.streakCount,
      });
      if (decisionStatus === "discarded") {
        announceStreak(
          (profile.streakCount ?? 0) + 1,
          `¡Compra descartada! Salvaste $${targetItem.price.toLocaleString()} MXN`,
        );
      }
      return;
    }

    if (mode !== "authenticated") {
      throw new Error("Debes iniciar sesión para actualizar el estado.");
    }

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr || !user) {
      throw new Error("No se pudo verificar el usuario autenticado.");
    }

    const currentMeta = readWishlistMetaMap(user.id);
    currentMeta[id] = {
      ...currentMeta[id],
      decision: decisionStatus,
    };
    writeWishlistMetaMap(user.id, currentMeta);

    // Best-effort update on wishlist_items / purchase_analyses
    await Promise.resolve(
      supabase
        .from("wishlist_items")
        .update({
          user_id: user.id,
          status: decisionStatus,
        })
        .eq("id", id)
        .eq("user_id", user.id),
    ).catch(() => null);

    await Promise.resolve(
      supabase.from("purchase_analyses").insert({
        user_id: user.id,
        item_name: targetItem.name,
        price: Number(targetItem.price.toFixed(2)),
        decision: decisionStatus,
        available_before: targetItem.availableBefore ?? profile.currentBalance,
        available_after:
          decisionStatus === "purchased"
            ? Math.max(0, profile.currentBalance - targetItem.price)
            : (targetItem.availableAfter ?? profile.currentBalance),
        awarded_xp: bonusXp,
        explanation:
          decisionStatus === "discarded"
            ? `Compra descartada tras enfriamiento: salvaste $${targetItem.price.toLocaleString()} MXN.`
            : `Compra completada tras evaluación consciente.`,
      }),
    ).catch(() => null);

    if (decisionStatus === "purchased") {
      const nextBalance = Math.max(
        0,
        Number(
          (
            (Math.round(profile.currentBalance * 100) -
              Math.round(targetItem.price * 100)) /
            100
          ).toFixed(2),
        ),
      );
      await supabase.from("transactions").insert({
        user_id: user.id,
        title: targetItem.name,
        amount: Number(targetItem.price.toFixed(2)),
        type: "expense",
        category: "Compras",
      });
      await supabase
        .from("profiles")
        .update({ current_balance: nextBalance })
        .eq("id", user.id);
    }

    setProfile((prev) => ({
      ...prev,
      currentBalance:
        decisionStatus === "purchased"
          ? Math.max(0, prev.currentBalance - targetItem.price)
          : prev.currentBalance,
      wishlist: (prev.wishlist ?? []).map((w) =>
        w.id === id
          ? {
              ...w,
              decision: decisionStatus,
              awardedXp: (w.awardedXp ?? 50) + bonusXp,
            }
          : w,
      ),
      wisdomXp: (prev.wisdomXp ?? 0) + bonusXp,
    }));
  };

  const saveGoalWithSubGoals = async (input: {
    id?: string;
    title: string;
    targetAmount: number;
    currentSaved: number;
    weeklyContribution: number;
    savingsLocation: "incluido" | "separado" | "desconocido";
    deadlineLabel?: string;
    subGoals: GoalSubStage[];
  }): Promise<void> => {
    const cleanTitle = input.title.trim() || "Meta de ahorro";
    const roundedTarget = Number(
      Math.max(1, Number(input.targetAmount) || 0).toFixed(2),
    );
    const roundedSaved = Number(
      Math.max(0, Number(input.currentSaved) || 0).toFixed(2),
    );
    const roundedWeekly = Number(
      Math.max(0, Number(input.weeklyContribution) || 0).toFixed(2),
    );
    const normalizedSubGoals: GoalSubStage[] = (input.subGoals ?? [])
      .filter((s) => s.title.trim() && Number(s.targetAmount) > 0)
      .map((s, idx) => ({
        id: s.id || `sub-${Date.now()}-${idx}`,
        title: s.title.trim(),
        targetAmount: Number(Number(s.targetAmount).toFixed(2)),
        savedAmount:
          s.savedAmount !== undefined
            ? Number(Number(s.savedAmount).toFixed(2))
            : undefined,
      }));

    if (mode === "demo") {
      const goalId = input.id || profile.goal.id || `goal-demo-${Date.now()}`;
      writeStoredSubGoals(goalId, normalizedSubGoals);
      const updatedGoal: FinancialGoal = {
        id: goalId,
        title: cleanTitle,
        targetAmount: roundedTarget,
        currentSaved: roundedSaved,
        weeklyContribution: roundedWeekly,
        deadlineLabel:
          input.deadlineLabel?.trim() ||
          profile.goal.deadlineLabel ||
          "Meta activa",
        savingsLocation: input.savingsLocation,
        subGoals: normalizedSubGoals,
      };
      const existingList = profile.goalsList ?? [profile.goal];
      const hasExisting = existingList.some((g) => g.id === goalId);
      const nextList = hasExisting
        ? existingList.map((g) => (g.id === goalId ? updatedGoal : g))
        : [...existingList, updatedGoal];
      persistDemo({
        ...profile,
        goal: updatedGoal,
        goalsList: nextList,
      });
      return;
    }

    if (mode !== "authenticated") {
      throw new Error("Debes iniciar sesión para guardar tu meta.");
    }

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr || !user) {
      throw new Error("No se pudo verificar el usuario autenticado.");
    }

    let persistedGoalId = input.id;

    if (persistedGoalId) {
      const { error } = await supabase
        .from("goals")
        .update({
          user_id: user.id,
          title: cleanTitle,
          target_amount: roundedTarget,
          current_saved: roundedSaved,
          weekly_contribution: roundedWeekly,
          savings_location: input.savingsLocation,
          target_date:
            input.deadlineLabel && /^\d{4}-\d{2}-\d{2}$/.test(input.deadlineLabel)
              ? input.deadlineLabel
              : null,
          is_active: true,
        })
        .eq("id", persistedGoalId)
        .eq("user_id", user.id);
      if (error) throw new Error(error.message);
    } else {
      const { data, error } = await supabase
        .from("goals")
        .insert({
          user_id: user.id,
          title: cleanTitle,
          target_amount: roundedTarget,
          current_saved: roundedSaved,
          weekly_contribution: roundedWeekly,
          savings_location: input.savingsLocation,
          is_active: true,
        })
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      persistedGoalId = data?.id ? String(data.id) : `goal-${Date.now()}`;
    }

    if (persistedGoalId) {
      writeStoredSubGoals(persistedGoalId, normalizedSubGoals);
    }

    await refreshProfile(true);
  };

  const selectActiveGoal = (goalId: string) => {
    const found = (profile.goalsList ?? []).find((g) => g.id === goalId);
    if (!found) return;
    const reordered = [
      found,
      ...(profile.goalsList ?? []).filter((g) => g.id !== goalId),
    ];
    if (mode === "demo") {
      persistDemo({
        ...profile,
        goal: found,
        goalsList: reordered,
      });
    } else {
      setProfile((prev) => ({
        ...prev,
        goal: found,
        goalsList: reordered,
      }));
    }
  };

  const saveFullProfileSettings = async (input: {
    displayName: string;
    nickname?: string;
    age?: number | null;
    dependentsCount?: number;
    lifeContext: LifeContextTag[];
    currentBalance: number;
    safetyBuffer: number;
    dailyEssentialBurn: number;
  }): Promise<void> => {
    const cleanName = input.displayName.trim() || "Tu Perfil";
    const cleanNickname = input.nickname?.trim() || "";
    const cleanAge =
      input.age !== undefined &&
      input.age !== null &&
      Number.isFinite(Number(input.age)) &&
      Number(input.age) > 0
        ? Math.round(Number(input.age))
        : null;
    const cleanDependents =
      input.dependentsCount !== undefined &&
      Number.isFinite(Number(input.dependentsCount))
        ? Math.max(0, Math.round(Number(input.dependentsCount)))
        : 0;
    const roundedBalance = Number(
      Math.max(0, Number(input.currentBalance) || 0).toFixed(2),
    );
    const roundedBuffer = Number(
      Math.max(0, Number(input.safetyBuffer) || 0).toFixed(2),
    );
    const roundedDailyBurn = Number(
      Math.max(0, Number(input.dailyEssentialBurn) || 0).toFixed(2),
    );

    const updatedTags = Array.from(
      new Set([
        ...input.lifeContext.filter((t) => t !== "dependientes"),
        ...(cleanDependents > 0 || input.lifeContext.includes("dependientes")
          ? (["dependientes"] as LifeContextTag[])
          : []),
      ]),
    );

    if (mode === "demo") {
      persistDemo({
        ...profile,
        name: cleanName,
        nickname: cleanNickname,
        age: cleanAge,
        dependentsCount: cleanDependents,
        lifeContext: updatedTags,
        roleTag: buildRoleTagFromContext(updatedTags),
        currentBalance: roundedBalance,
        safetyBuffer: roundedBuffer,
        dailyEssentialBurn: roundedDailyBurn,
      });
      return;
    }

    if (mode !== "authenticated") {
      throw new Error("Debes iniciar sesión para editar tu perfil.");
    }

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr || !user) {
      throw new Error("No se pudo verificar el usuario autenticado.");
    }

    // Save core columns in public.profiles
    const { error: profileErr } = await supabase
      .from("profiles")
      .update({
        display_name: cleanName,
        current_balance: roundedBalance,
        safety_buffer: roundedBuffer,
        daily_essential_budget: roundedDailyBurn,
        lifestyle_tags: updatedTags,
      })
      .eq("id", user.id);

    if (profileErr) throw new Error(profileErr.message);

    // Best-effort update optional columns in public.profiles if schema supports them
    await Promise.resolve(
      supabase
        .from("profiles")
        .update({
          nickname: cleanNickname || null,
          age: cleanAge,
          dependents_count: cleanDependents,
        })
        .eq("id", user.id),
    ).catch(() => null);

    // Persist nickname, age, dependents_count, display_name in Supabase auth user_metadata (NO gender/sex)
    await Promise.resolve(
      supabase.auth.updateUser({
        data: {
          display_name: cleanName,
          full_name: cleanName,
          nickname: cleanNickname,
          age: cleanAge,
          dependents_count: cleanDependents,
        },
      }),
    ).catch(() => null);

    await refreshProfile(true);
  };

  const upsertIncomeSource = async (input: {
    id?: string;
    name: string;
    amount: number;
    frequency: CommitmentDbFrequency;
    nextPaymentDate: string;
  }): Promise<void> => {
    const cleanName = input.name.trim() || "Ingreso principal";
    const roundedAmount = Number(Number(input.amount).toFixed(2));
    if (!Number.isFinite(roundedAmount) || roundedAmount <= 0) {
      throw new Error("Ingresa un monto de ingreso válido mayor a cero.");
    }

    if (mode === "demo") {
      const existing = profile.incomeSources ?? [];
      const nextId = input.id || `inc-demo-${Date.now()}`;
      const record: IncomeSourceRecord = {
        id: nextId,
        name: cleanName,
        amount: roundedAmount,
        frequency: input.frequency,
        nextPaymentDate: input.nextPaymentDate,
      };
      const hasExisting = existing.some((i) => i.id === nextId);
      const nextSources = hasExisting
        ? existing.map((i) => (i.id === nextId ? record : i))
        : [...existing, record];
      const primary = nextSources[0];
      persistDemo({
        ...profile,
        incomeSources: nextSources,
        nextPaydayAmount: primary ? primary.amount : profile.nextPaydayAmount,
        nextPaydayDays: primary?.nextPaymentDate
          ? daysUntil(primary.nextPaymentDate)
          : profile.nextPaydayDays,
        payFrequency: primary
          ? toFrequency(primary.frequency)
          : profile.payFrequency,
      });
      return;
    }

    if (mode !== "authenticated") {
      throw new Error("Debes iniciar sesión para guardar fuentes de ingreso.");
    }

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr || !user) {
      throw new Error("No se pudo verificar el usuario autenticado.");
    }

    if (input.id) {
      const { error } = await supabase
        .from("income_sources")
        .update({
          user_id: user.id,
          name: cleanName,
          amount: roundedAmount,
          frequency: input.frequency,
          next_payment_date: input.nextPaymentDate,
          is_active: true,
        })
        .eq("id", input.id)
        .eq("user_id", user.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("income_sources").insert({
        user_id: user.id,
        name: cleanName,
        amount: roundedAmount,
        frequency: input.frequency,
        next_payment_date: input.nextPaymentDate,
        is_active: true,
      });
      if (error) throw new Error(error.message);
    }

    await refreshProfile(true);
  };

  const deleteIncomeSource = async (id: string): Promise<void> => {
    if (mode === "demo") {
      const nextSources = (profile.incomeSources ?? []).filter(
        (i) => i.id !== id,
      );
      persistDemo({
        ...profile,
        incomeSources: nextSources,
      });
      return;
    }

    if (mode !== "authenticated") {
      throw new Error("Debes iniciar sesión para eliminar fuentes de ingreso.");
    }

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr || !user) {
      throw new Error("No se pudo verificar el usuario autenticado.");
    }

    const { error } = await supabase
      .from("income_sources")
      .update({ user_id: user.id, is_active: false })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);
    await refreshProfile(true);
  };

  const awardWisdomXp = (amount = 50) => {
    if (mode !== "demo") return;
    persistDemo({ ...profile, wisdomXp: (profile.wisdomXp ?? 0) + amount });
  };

  const incrementStreak = (reason = "¡Buena decisión evaluada!") => {
    if (mode !== "demo") return;
    const count = (profile.streakCount ?? 0) + 1;
    persistDemo({
      ...profile,
      streakCount: count,
      wisdomXp: (profile.wisdomXp ?? 0) + 25,
    });
    announceStreak(count, reason);
  };

  const financialProfile = useMemo(() => {
    if (mode === "authenticated") return accountFinancialProfile?.id === profile.id ? accountFinancialProfile : null;
    if (mode !== "demo") return null;
    return mapDemoFinancialProfile(profile);
  }, [mode, profile, accountFinancialProfile]);
  const financialVersion = JSON.stringify([mode, profile.id, accountVersion, financialProfile]);

  useEffect(() => {
    if (mode !== "authenticated") return;
    const reload = () => { void refreshProfile(true); };
    const onVisibility = () => { if (document.visibilityState === "visible") reload(); };
    window.addEventListener("focus", reload);
    document.addEventListener("visibilitychange", onVisibility);
    const timer = setInterval(reload, 30_000);
    let channel = supabase.channel("financial-profile-" + profile.id);
    for (const table of ["profiles", "income_sources", "commitments", "goals", "transactions"]) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table, filter: (table === "profiles" ? "id" : "user_id") + "=eq." + profile.id }, reload);
    }
    channel.subscribe();
    return () => { clearInterval(timer); window.removeEventListener("focus", reload); document.removeEventListener("visibilitychange", onVisibility); void supabase.removeChannel(channel); };
  }, [mode, profile.id, refreshProfile, supabase]);

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    sessionStorage.removeItem(DEMO_STORAGE_KEY);
    sessionStorage.removeItem(EVAL_STORAGE_KEY);
    ++requestVersion.current;
    setProfile(cleanProfile());
    setMode("anonymous");
  };

  return (
    <FinancialContext.Provider
      value={{
        profile,
        mode,
        profileError,
        financialProfile,
        financialVersion,
        refreshProfile,
        signOut,
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
        addCommitment,
        updateCommitmentItem,
        deactivateCommitment,
        addExpenseTransaction,
        addPlannedExpense,
        removePlannedExpense,
        contributeToWishlistItem,
        updateWishlistDecisionStatus,
        saveGoalWithSubGoals,
        selectActiveGoal,
        saveFullProfileSettings,
        upsertIncomeSource,
        deleteIncomeSource,
      }}
    >
      {children}
    </FinancialContext.Provider>
  );
}

export function useFinancial() {
  const context = useContext(FinancialContext);
  if (!context)
    throw new Error("useFinancial debe usarse dentro de un FinancialProvider");
  return context;
}
