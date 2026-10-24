import { NextResponse } from "next/server";

import {
  InvalidDemoProfileError,
  isMissingSupabaseSessionError,
  mapSupabaseRecord,
  resolveEvaluationProfile,
} from "@/lib/finance";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  buildPurchaseReport,
  calculateSafeToSpend,
  evaluatePurchase,
} from "@/lib/onboarding";
import type { OnboardingProfile } from "@/lib/onboarding/financialTypes";

export interface EvaluateRequestPayload {
  itemName?: unknown;
  itemPrice?: unknown;
  mode?: unknown;
  demoProfileId?: unknown;
}

export type EvaluationStatus =
  | "dentro_del_margen"
  | "excede_el_margen"
  | "precaucion"
  | "datos_incompletos"
  | "error_procesamiento";

export interface EvaluateApiResponse {
  status: EvaluationStatus;
  detectedItemName: string;
  detectedItemPrice: number;
  verdict: "VIABLE" | "PRECAUCION" | "COMPROMETE" | "DATOS_INCOMPLETOS";
  badgeLabel:
    | "Compra viable hoy"
    | "Viable con precaución"
    | "Compromete tu quincena"
    | "Datos financieros incompletos";
  headlineLine1: string;
  headlineLine2: string;
  safeToSpend: number | null;
  daysUntilNextIncome: number | null;
  remainingAfterBuyToday: number | null;
  remainingFreeSafe: number | null;
  exceedsBy: number | null;
  freeMoneyRemainingPct: number | null;
  usedByPurchasePct: number | null;
  daysGoalDelayed: number | null;
  liquidityAfterPayday: number | null;
  remainingIfWaitPayday: number | null;
  waitRemainingPct: number | null;
  suggestedWeeklySave: number | null;
  weeksNeeded: number | null;
  consideredExpenses: {
    currentBalance: number | null;
    essentialExpenses: number | null;
    pendingCommitments: number | null;
    pendingDebtPayments: number | null;
    safetyBuffer: number | null;
    protectedSavings: number | null;
  };
  missingInformation: string[];
  projectionStatus: "calculado" | "datos_incompletos";
  projection: ReturnType<typeof buildPurchaseReport>["projectionBefore"] | null;
  goalImpact: null;
  source: "deterministic";
}

class EvaluationRequestError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
    readonly code: string,
  ) {
    super(message);
  }
}

async function loadAccountProfile(): Promise<OnboardingProfile> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    throw new EvaluationRequestError(
      "El servicio financiero no está configurado.",
      503,
      "supabase_not_configured",
    );
  }

  let supabase;
  try {
    supabase = await createServerSupabaseClient();
  } catch (error) {
    console.error("Supabase client initialization failed:", error);
    throw new EvaluationRequestError(
      "No se pudo conectar con el servicio financiero.",
      503,
      "supabase_unavailable",
    );
  }

  const { data: authData, error: authError } =
    await supabase.auth.getUser();
  if (authError) {
    if (isMissingSupabaseSessionError(authError)) {
      throw new EvaluationRequestError(
        "Inicia sesión para evaluar una compra.",
        401,
        "authentication_required",
      );
    }
    console.error("Supabase authentication lookup failed:", authError.message);
    throw new EvaluationRequestError(
      "No se pudo verificar la sesión. Inténtalo de nuevo.",
      503,
      "session_verification_failed",
    );
  }
  if (!authData.user) {
    throw new EvaluationRequestError(
      "Inicia sesión para evaluar una compra.",
      401,
      "authentication_required",
    );
  }

  const userId = authData.user.id;
  const [profileResult, incomeResult, commitmentResult, goalResult] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase
        .from("income_sources")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true),
      supabase
        .from("commitments")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true),
      supabase
        .from("goals")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true),
    ]);

  const queryError = [
    profileResult.error,
    incomeResult.error,
    commitmentResult.error,
    goalResult.error,
  ].find((error) => error !== null);
  if (queryError) {
    console.error("Financial account query failed:", queryError.message);
    throw new EvaluationRequestError(
      "No fue posible cargar todos tus datos financieros.",
      503,
      "financial_data_unavailable",
    );
  }

  if (!profileResult.data) {
    throw new EvaluationRequestError(
      "No encontramos un perfil financiero para esta cuenta.",
      422,
      "financial_profile_missing",
    );
  }

  const profile = mapSupabaseRecord(
    {
      profile: profileResult.data,
      incomeSources: incomeResult.data ?? [],
      commitments: commitmentResult.data ?? [],
      goals: goalResult.data ?? [],
    },
  );
  if (!profile) {
    throw new EvaluationRequestError(
      "No se pudo interpretar el perfil financiero.",
      422,
      "financial_profile_invalid",
    );
  }

  return profile;
}

function buildDeterministicEvaluation(
  itemName: string,
  itemPrice: number,
  profile: OnboardingProfile,
): EvaluateApiResponse {
  const safe = calculateSafeToSpend(profile);
  const purchase = evaluatePurchase(profile, itemPrice);
  const report = buildPurchaseReport(profile, itemPrice);
  const isComplete =
    profile.isOnboarded &&
    safe.status === "calculado" &&
    safe.safeToSpend !== null &&
    profile.nextPaydayAmount !== null &&
    purchase.status === "evaluada" &&
    purchase.remainingSafeToSpend !== null;
  const missingInformation: string[] = [];
  if (!profile.isOnboarded) missingInformation.push("Onboarding financiero incompleto.");
  if (profile.currentBalance === null) missingInformation.push("Saldo actual desconocido.");
  if (profile.nextPaydayDays === null) missingInformation.push("Fecha del próximo ingreso desconocida.");
  if (profile.nextPaydayAmount === null) missingInformation.push("Importe del próximo ingreso desconocido.");
  if (profile.dailyEssentialBurn === null) missingInformation.push("Gastos esenciales diarios desconocidos.");
  if (profile.safetyBuffer === null) missingInformation.push("Colchón de seguridad desconocido.");
  if (
    profile.commitments.some(
      (item) =>
        item.amount === null ||
        item.dueInDays === null ||
        item.frequency === null ||
        item.isConfirmed === false,
    )
  ) {
    missingInformation.push("Hay compromisos con importe, fecha o frecuencia sin confirmar.");
  }
  if (
    profile.debts.some(
      (debt) =>
        debt.nextPayment === null ||
        debt.dueInDays === null ||
        debt.frequency === null,
    )
  ) {
    missingInformation.push("Hay pagos de deuda con importe, fecha o frecuencia desconocidos.");
  }
  if (
    profile.primaryGoal &&
    (profile.primaryGoal.currentSaved === null ||
      profile.primaryGoal.targetAmount === null ||
      (profile.primaryGoal.currentSaved > 0 &&
        profile.primaryGoal.savingsLocation === "desconocido"))
  ) {
    missingInformation.push("Falta información sobre el saldo o la ubicación de los ahorros de tu meta.");
  }
  if (!isComplete && missingInformation.length === 0) {
    missingInformation.push("Faltan datos necesarios para calcular el margen disponible.");
  }

  let status: EvaluationStatus = "datos_incompletos";
  if (isComplete && purchase.assessment === "excede_margen") {
    status = "excede_el_margen";
  } else if (
    isComplete &&
    purchase.remainingSafeToSpend !== null &&
    safe.safetyBuffer !== null &&
    purchase.remainingSafeToSpend < safe.safetyBuffer * 0.5
  ) {
    status = "precaucion";
  } else if (isComplete) {
    status = "dentro_del_margen";
  }

  const verdict =
    status === "datos_incompletos"
      ? "DATOS_INCOMPLETOS"
      : status === "excede_el_margen"
        ? "COMPROMETE"
        : status === "precaucion"
          ? "PRECAUCION"
          : "VIABLE";
  const badgeLabel =
    status === "datos_incompletos"
      ? "Datos financieros incompletos"
      : status === "excede_el_margen"
        ? "Compromete tu quincena"
        : status === "precaucion"
          ? "Viable con precaución"
          : "Compra viable hoy";

  const remaining = purchase.remainingSafeToSpend;
  const remainingAfterPurchase =
    purchase.status === "evaluada" &&
    purchase.assessment === "excede_margen" &&
    purchase.exceedsBy !== null
      ? -purchase.exceedsBy
      : remaining;
  const pct =
    safe.safeToSpend !== null && remaining !== null && safe.safeToSpend > 0
      ? Math.round((remaining / safe.safeToSpend) * 100)
      : null;
  const headlineLine1 =
    status === "datos_incompletos"
      ? "No podemos evaluar esta compra con seguridad porque faltan datos financieros."
      : status === "excede_el_margen"
        ? purchase.exceedsBy !== null
          ? `"${itemName}" supera tu margen calculado por $${purchase.exceedsBy.toLocaleString()} MXN.`
          : `"${itemName}" supera tu margen calculado.`
        : status === "precaucion"
          ? `"${itemName}" cabe en tu margen, pero dejaría menos de la mitad de tu colchón de seguridad disponible.`
          : `"${itemName}" está dentro de tu margen calculado.`;

  return {
    status,
    detectedItemName: itemName,
    detectedItemPrice: itemPrice,
    verdict,
    badgeLabel,
    headlineLine1,
    headlineLine2: purchase.explanation,
    safeToSpend: isComplete ? safe.safeToSpend : null,
    daysUntilNextIncome: profile.nextPaydayDays,
    remainingAfterBuyToday: isComplete ? remainingAfterPurchase : null,
    remainingFreeSafe: isComplete ? remaining : null,
    exceedsBy: isComplete ? purchase.exceedsBy : null,
    freeMoneyRemainingPct: isComplete ? pct : null,
    usedByPurchasePct: isComplete && pct !== null ? 100 - pct : null,
    daysGoalDelayed: null,
    liquidityAfterPayday: null,
    remainingIfWaitPayday: null,
    waitRemainingPct: null,
    suggestedWeeklySave: null,
    weeksNeeded: null,
    consideredExpenses: {
      currentBalance: safe.currentBalance,
      essentialExpenses: safe.essentialExpenses,
      pendingCommitments: safe.pendingCommitments,
      pendingDebtPayments: safe.pendingDebtPayments,
      safetyBuffer: safe.safetyBuffer,
      protectedSavings: safe.protectedSavings,
    },
    missingInformation,
    projectionStatus: report.projectionBefore.status,
    projection:
      report.projectionBefore.status === "calculado"
        ? report.projectionBefore
        : null,
    goalImpact: null,
    source: "deterministic",
  };
}

export async function POST(request: Request) {
  let body: EvaluateRequestPayload;
  try {
    body = (await request.json()) as EvaluateRequestPayload;
  } catch {
    return NextResponse.json(
      { status: "error_procesamiento", error: "El cuerpo JSON no es válido." },
      { status: 400 },
    );
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { status: "error_procesamiento", error: "El cuerpo de la solicitud no es válido." },
      { status: 400 },
    );
  }

  const itemName =
    typeof body.itemName === "string" ? body.itemName.trim() : "";
  const itemPrice = body.itemPrice;
  if (
    !itemName ||
    typeof itemPrice !== "number" ||
    !Number.isFinite(itemPrice) ||
    itemPrice <= 0
  ) {
    return NextResponse.json(
      { status: "error_procesamiento", error: "Se requiere un producto y un precio confirmado mayor que cero." },
      { status: 400 },
    );
  }

  try {
    let profile: OnboardingProfile;
    try {
      profile = await resolveEvaluationProfile(body, loadAccountProfile);
    } catch (error) {
      if (error instanceof InvalidDemoProfileError) {
        throw new EvaluationRequestError(error.message, 400, "invalid_demo_profile");
      }
      throw error;
    }
    return NextResponse.json(
      buildDeterministicEvaluation(itemName, itemPrice, profile),
    );
  } catch (error) {
    if (error instanceof EvaluationRequestError) {
      return NextResponse.json(
        {
          status:
            error.httpStatus >= 500
              ? "error_procesamiento"
              : "datos_incompletos",
          error: error.message,
          code: error.code,
        },
        { status: error.httpStatus },
      );
    }

    console.error("Purchase evaluation failed:", error);
    return NextResponse.json(
      {
        status: "error_procesamiento",
        error: "No se pudo completar la evaluación financiera.",
        code: "evaluation_failed",
      },
      { status: 500 },
    );
  }
}
