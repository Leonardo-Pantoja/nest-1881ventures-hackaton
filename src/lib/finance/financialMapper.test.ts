import { calculateSafeToSpend } from "../onboarding/financialEngine";
import type { OnboardingProfile } from "../onboarding/financialTypes";
import {
  FINANCIAL_TIME_ZONE,
  mapFinancialProfile,
  mapSupabaseRecord,
} from "./financialMapper";
import { getDemoProfile } from "./demoProfiles";
import {
  isMissingSupabaseSessionError,
  resolveEvaluationProfile,
  type EvaluationProfileRequest,
} from "./evaluationProfile";

function verify(name: string, actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(
      `FAILED: ${name}. Expected ${String(expected)}, received ${String(actual)}`,
    );
  }
}

const now = new Date("2026-10-24T18:00:00.000Z");

const fullRows = {
  profile: {
    id: "auth-user",
    current_balance: 5000,
    safety_buffer: 800,
    daily_essential_budget: 200,
    lifestyle_tags: ["trabajo"],
    onboarding_completed_at: "2026-10-01T00:00:00.000Z",
  },
  incomeSources: [
    {
      amount: 9500,
      frequency: "biweekly",
      next_payment_date: "2026-10-30",
    },
  ],
  commitments: [
    {
      id: "rent",
      title: "Renta",
      amount: 2000,
      category: "Vivienda",
      frequency: "monthly",
      next_due_date: "2026-10-26",
      is_active: true,
    },
  ],
  goals: [],
};

const completeProfile = mapSupabaseRecord(fullRows, now);
if (!completeProfile) throw new Error("Expected mapped financial profile");
verify("Authenticated profile maps complete data", completeProfile.isOnboarded, true);
verify("Income date uses calendar-day difference", completeProfile.nextPaydayDays, 6);
verify("Commitment date uses next_due_date", completeProfile.commitments[0].dueInDays, 2);
verify("Financial calendar timezone is explicit", FINANCIAL_TIME_ZONE, "America/Mexico_City");
verify(
  "Complete profile calculates safe-to-spend",
  calculateSafeToSpend(completeProfile).status,
  "calculado",
);
const oneTimeResult = mapSupabaseRecord(
  {
    ...fullRows,
    incomeSources: [
      { amount: 1000, frequency: "weekly", next_payment_date: "2026-10-25" },
    ],
    commitments: [
      {
        id: "one-time",
        title: "Pago único",
        amount: 50,
        category: "Otros",
        frequency: "one_time",
        next_due_date: "2026-10-25",
      },
    ],
  },
  now,
);
if (!oneTimeResult) throw new Error("Expected one-time result mapping");
verify("One-time payment is counted exactly once", calculateSafeToSpend(oneTimeResult).pendingCommitments, 50);

const incompleteProfile = mapSupabaseRecord(
  {
    ...fullRows,
    profile: { ...fullRows.profile, current_balance: null },
  },
  now,
);
if (!incompleteProfile) throw new Error("Expected incomplete profile mapping");
verify("Missing balance is preserved as null", incompleteProfile.currentBalance, null);
verify(
  "Incomplete profile is not evaluated",
  calculateSafeToSpend(incompleteProfile).safeToSpend,
  null,
);

const oneTimeProfile = mapSupabaseRecord(
  {
    ...fullRows,
    commitments: [
      {
        id: "one-time",
        title: "Pago único",
        amount: 50,
        category: "Otros",
        frequency: "one_time",
        next_due_date: "2026-10-25",
      },
    ],
  },
  now,
);
if (!oneTimeProfile) throw new Error("Expected one-time mapping");
verify("one_time frequency is preserved", oneTimeProfile.commitments[0].frequency, "unico");
verify("Real one-time commitment date is mapped", oneTimeProfile.commitments[0].dueInDays, 1);

const unknownPayment = mapSupabaseRecord(
  {
    ...fullRows,
    commitments: [{ id: "unknown", amount: 75, title: "Unknown" }],
  },
  now,
);
if (!unknownPayment) throw new Error("Expected unknown commitment mapping");
verify("Unknown due date is not today", unknownPayment.commitments[0].dueInDays, null);
verify("Unknown frequency stays unknown", unknownPayment.commitments[0].frequency, null);
verify(
  "Unknown commitment prevents calculation",
  calculateSafeToSpend(unknownPayment).safeToSpend,
  null,
);

const multipleIncomeProfile = mapSupabaseRecord(
  {
    ...fullRows,
    incomeSources: [
      { amount: 1000, frequency: "weekly", next_payment_date: "2026-10-25" },
      { amount: 5000, frequency: "monthly", next_payment_date: "2026-11-01" },
    ],
  },
  now,
);
if (!multipleIncomeProfile) throw new Error("Expected multiple-income mapping");
verify("Multiple incomes use the next confirmed date", multipleIncomeProfile.nextPaydayDays, 1);
verify("Only amounts due on that date are included", multipleIncomeProfile.nextPaydayAmount, 1000);
verify("Different income schedules do not become one repeated paycheck", multipleIncomeProfile.payFrequency, "variable");
verify(
  "Multiple dated incomes preserve an immediate conservative margin",
  calculateSafeToSpend(multipleIncomeProfile).safeToSpend,
  4000,
);

const unknownSavings = mapSupabaseRecord(
  {
    ...fullRows,
    goals: [
      {
        id: "goal",
        title: "Ahorro",
        target_amount: 1000,
        current_saved: 500,
        weekly_contribution: 100,
      },
    ],
  },
  now,
);
if (!unknownSavings?.primaryGoal) throw new Error("Expected mapped savings goal");
verify("Unknown savings location is not guessed", unknownSavings.primaryGoal.savingsLocation, "desconocido");
verify(
  "Unknown savings location blocks calculation",
  calculateSafeToSpend(unknownSavings).safeToSpend,
  null,
);

const legacyProfile = mapFinancialProfile({
  id: "legacy-profile",
  currentBalance: 500,
  payFrequency: "weekly",
  nextPaydayAmount: 300,
  nextPaydayDays: 3,
  dailyEssentialBurn: 20,
  safetyBuffer: 50,
  commitments: [],
  goal: {
    title: "Ahorro",
    targetAmount: 1000,
    currentSaved: 200,
    weeklyContribution: 50,
  },
  isOnboarded: true,
}, now);
if (!legacyProfile?.primaryGoal) throw new Error("Expected legacy goal mapping");
verify("Legacy savings location remains unknown", legacyProfile.primaryGoal.savingsLocation, "desconocido");
verify(
  "Legacy unknown savings are not evaluated",
  calculateSafeToSpend(legacyProfile).status,
  "datos_incompletos",
);

const duplicateDebtRows = mapSupabaseRecord(
  {
    ...fullRows,
    commitments: [
      {
        id: "debt-payment",
        title: "Tarjeta",
        amount: 200,
        category: "Deuda",
        frequency: "monthly",
        next_due_date: "2026-10-26",
      },
      {
        id: "debt-payment",
        title: "Tarjeta",
        amount: 200,
        category: "Deuda",
        frequency: "monthly",
        next_due_date: "2026-10-26",
      },
    ],
  },
  now,
);
if (!duplicateDebtRows) throw new Error("Expected debt mapping");
verify("Debt payment is represented once", duplicateDebtRows.debts.length, 1);
verify("Debt is not duplicated as a commitment", duplicateDebtRows.commitments.length, 0);

async function testEvaluationAccess(): Promise<void> {
  const fakeClientProfile = {
    currentBalance: 999999,
    nextPaydayDays: 0,
    safetyBuffer: 0,
  };
  let accountLoadCount = 0;
  const unauthenticatedLoad = async (): Promise<OnboardingProfile> => {
    accountLoadCount += 1;
    throw new Error("authentication_required");
  };

  try {
    await resolveEvaluationProfile(
      { mode: "account", profile: fakeClientProfile } as EvaluationProfileRequest,
      unauthenticatedLoad,
    );
    throw new Error("Expected unauthenticated account lookup to fail");
  } catch (error) {
    verify(
      "Fake browser profile cannot replace missing session",
      (error as Error).message,
      "authentication_required",
    );
  }
  verify("Unauthenticated request never trusts supplied profile", accountLoadCount, 1);
  verify(
    "Supabase missing-session error is classified as unauthenticated",
    isMissingSupabaseSessionError({ name: "AuthSessionMissingError" }),
    true,
  );
  verify(
    "Supabase connection errors are not classified as unauthenticated",
    isMissingSupabaseSessionError({ name: "AuthRetryableFetchError" }),
    false,
  );

  const connectionError = new Error("supabase_unavailable");
  try {
    await resolveEvaluationProfile(
      { profile: fakeClientProfile } as EvaluationProfileRequest,
      async () => {
        throw connectionError;
      },
    );
    throw new Error("Expected connection failure to propagate");
  } catch (error) {
    verify("Supabase connection failure is not masked", error, connectionError);
  }

  let demoAccountQueries = 0;
  const demoProfile = await resolveEvaluationProfile(
    { mode: "demo", demoProfileId: "mateo", profile: fakeClientProfile } as EvaluationProfileRequest,
    async () => {
      demoAccountQueries += 1;
      throw new Error("Demo must not access account data");
    },
  );
  verify("Recognized demo is synthetic", demoProfile.id, "mateo");
  verify("Demo does not query account data", demoAccountQueries, 0);
  verify("Unknown demo profile is rejected", getDemoProfile("other"), null);
  verify(
    "Unknown demo selection is rejected",
    await resolveEvaluationProfile(
      { mode: "demo", demoProfileId: "not-a-server-profile" },
      unauthenticatedLoad,
    ).then(
      () => false,
      () => true,
    ),
    true,
  );

  const authenticatedResult = await resolveEvaluationProfile(
    { mode: "account" },
    async () => {
      if (!completeProfile) throw new Error("Missing authenticated profile fixture");
      return completeProfile;
    },
  );
  verify("Authenticated account uses server-loaded profile", authenticatedResult.id, "auth-user");
  const incompleteAuthenticatedResult = await resolveEvaluationProfile(
    { mode: "account" },
    async () => {
      if (!incompleteProfile) throw new Error("Missing incomplete profile fixture");
      return incompleteProfile;
    },
  );
  verify(
    "Authenticated incomplete data is returned without browser fallback",
    incompleteAuthenticatedResult.currentBalance,
    null,
  );
  console.log("Financial mapper and evaluation-access tests passed.");
}

void testEvaluationAccess().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
