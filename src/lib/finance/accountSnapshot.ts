import { createHash } from "node:crypto";
import { createServerSupabaseClient } from "../supabase/server";
import { isMissingSupabaseSessionError } from "./evaluationProfile";
import { FINANCIAL_TIME_ZONE, mapSupabaseRecord } from "./financialMapper";

function canonical(value: unknown): unknown {
 if (Array.isArray(value)) return value.map(canonical).sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
 if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => [k,canonical(v)]));
 return value;
}
export function snapshotRevision(value: unknown): string { return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex"); }

export class EvaluationRequestError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
    readonly code: string,
  ) {
    super(message);
  }
}

export async function loadAccountSnapshot() {
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
  } catch {
    console.error("Supabase client initialization failed.");
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
    console.error("Supabase authentication lookup failed.");
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
    console.error("Financial account query failed.");
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

  const now = new Date();
  const profile = mapSupabaseRecord(
    {
      profile: profileResult.data,
      incomeSources: incomeResult.data ?? [],
      commitments: commitmentResult.data ?? [],
      goals: goalResult.data ?? [],
    }, now,
  );
  if (!profile) {
    throw new EvaluationRequestError(
      "No se pudo interpretar el perfil financiero.",
      422,
      "financial_profile_invalid",
    );
  }

  const financialDate = new Intl.DateTimeFormat("en-CA", { timeZone: FINANCIAL_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const raw = { profile: profileResult.data, incomeSources: incomeResult.data ?? [], commitments: commitmentResult.data ?? [], goals: goalResult.data ?? [], financialDate };
  return { profile, raw, supabase, userId, revision: snapshotRevision(raw) };
}

