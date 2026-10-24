
/**
 * ANTES DE GASTAR
 * Modelos de datos financieros
 *
 * Onboarding + Motor financiero
 */

// ==========================================
// 1. CONTEXTO PERSONAL
// ==========================================

export type LifeContextTag =
  | "estudio"
  | "trabajo"
  | "independiente"
  | "dependientes";

export type PayFrequency =
  | "semanal"
  | "quincenal"
  | "mensual"
  | "variable";

// ==========================================
// 2. METAS FINANCIERAS
// ==========================================

export type GoalCategory =
  | "emergencia"
  | "deuda"
  | "compra"
  | "ahorro"
  | "inversion"
  | "proteccion"
  | "otro";

export type GoalTimeframe =
  | "corto"
  | "mediano"
  | "largo";

// Indica dónde está guardado el ahorro
export type SavingsLocation =
  | "incluido"
  | "separado"
  | "desconocido";

export interface FinancialGoal {
  id: string;
  title: string;
  category: GoalCategory;

  targetAmount: number;
  currentSaved: number;

  // Opcional si el usuario aún no sabe cuándo
  targetDate?: string;
  timeframe?: GoalTimeframe;

  // Aportación que planea realizar
  weeklyContribution?: number;

  // ¿Por qué quiere conseguir esta meta?
  reason?: string;

  // Evita contar sus ahorros dos veces
  savingsLocation: SavingsLocation;
}

// ==========================================
// 3. GASTOS Y COMPROMISOS
// ==========================================

export type CommitmentFrequency =
  | "unico"
  | "semanal"
  | "quincenal"
  | "mensual";

export type CommitmentKind =
  | "esencial"
  | "deuda"
  | "suscripcion"
  | "meta"
  | "otro";

export interface Commitment {
  id: string;
  title: string;
  amount: number;
  dueInDays: number;
  category: string;
  frequency: CommitmentFrequency;
  kind: CommitmentKind;
  isConfirmed?: boolean;
}

// ==========================================
// 4. DEUDAS
// ==========================================

export interface Debt {
  id: string;
  title: string;

  totalBalance: number;
  nextPayment: number;
  dueInDays: number;

  frequency: CommitmentFrequency;
  apr?: number;
}

// ==========================================
// 5. PERFIL FINANCIERO DEL USUARIO
// ==========================================

export interface OnboardingProfile {
  id: string;
  name?: string;

  // Pantalla 1: Situación personal
  lifeContext: LifeContextTag[];

  // Pantalla 2: Ingresos
  currentBalance: number;
  payFrequency: PayFrequency;

  // null = todavía no conocemos el dato
  nextPaydayAmount: number | null;
  nextPaydayDays: number | null;

  // Pantalla 3: Gastos y deudas
  dailyEssentialBurn: number;
  commitments: Commitment[];
  debts: Debt[];

  // Pantalla 4: Metas y seguridad
  safetyBuffer: number;
  primaryGoal?: FinancialGoal;

  // Estado del onboarding
  isOnboarded: boolean;
}
