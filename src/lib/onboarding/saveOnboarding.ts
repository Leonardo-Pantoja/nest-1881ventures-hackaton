
import { createClient } from "@/lib/supabase/client";

import {
  getRealisticEstimateForContext,
  type Commitment,
  type LifeContextTag,
  type PayFrequency,
} from "@/context/FinancialContext";

export interface OnboardingInput {
  lifeContext: LifeContextTag[];
  currentBalance: number;
  payFrequency: PayFrequency;
  nextPaydayDays: number;
  nextPaydayAmount: number;
  commitments: Commitment[];
  goalTitle: string;
  goalTargetAmount: number;
}

const frequencyMap: Record<PayFrequency, string> = {
  semanal: "weekly",
  quincenal: "biweekly",
  mensual: "monthly",
};

export async function saveOnboardingToSupabase(
  data: OnboardingInput
): Promise<string> {
  const supabase = createClient();

  // Verify the authenticated user.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Debes iniciar sesión para guardar tus datos.");
  }

  // Validate basic financial input.
  const amounts = [
    data.currentBalance,
    data.nextPaydayAmount,
    data.goalTargetAmount,
    ...data.commitments.map((item) => item.amount),
  ];

  if (
    amounts.some(
      (amount) => !Number.isFinite(amount) || amount < 0
    ) ||
    !Number.isInteger(data.nextPaydayDays) ||
    data.nextPaydayDays < 0 ||
    data.nextPaydayDays > 365 ||
    data.commitments.some(
      (item) =>
        !item.title.trim() ||
        !Number.isInteger(item.dueInDays) ||
        item.dueInDays < 0 ||
        item.dueInDays > 365 ||
        item.amount <= 0
    )
  ) {
    throw new Error("Revisa los montos y las fechas ingresadas.");
  }

  // Estimates based on the selected lifestyle.
  const estimates = getRealisticEstimateForContext(
    data.lifeContext
  );

  const displayName =
    user.user_metadata?.display_name ||
    user.user_metadata?.full_name ||
    user.email?.split("@")[0] ||
    "Tu Perfil";

  const { error } = await supabase.rpc(
    "complete_financial_onboarding",
    {
      p_display_name: String(displayName),
      p_lifestyle_tags: data.lifeContext,
      p_current_balance: data.currentBalance,
      p_safety_buffer: estimates.safetyBuffer,
      p_daily_essential_budget: estimates.dailyEssentialBurn,
      p_pay_frequency: frequencyMap[data.payFrequency],
      p_next_payday_days: data.nextPaydayDays,
      p_next_payday_amount: data.nextPaydayAmount,
      p_commitments: data.commitments.map((item) => ({
        title: item.title,
        amount: item.amount,
        dueInDays: item.dueInDays,
        category: item.category,
      })),
      p_goal_title:
        data.goalTitle.trim() || "Fondo de emergencia",
      p_goal_target_amount: Math.max(
        500,
        data.goalTargetAmount || 10000
      ),
    }
  );

  if (error) {
    console.error("Onboarding persistence failed.");
    throw new Error(
      "No se pudo guardar tu información financiera. Inténtalo de nuevo."
    );
  }

  return user.id;
}
