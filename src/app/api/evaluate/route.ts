import { NextResponse } from "next/server";
import { InvalidDemoProfileError, resolveEvaluationProfile } from "@/lib/finance";
import { EvaluationRequestError, loadAccountSnapshot } from "@/lib/finance/accountSnapshot";
import { buildDeterministicEvaluation } from "@/lib/finance/evaluation";
import { validPurchasePrice } from "@/lib/finance/money";
import type { OnboardingProfile } from "@/lib/onboarding/financialTypes";
export type { EvaluateApiResponse } from "@/lib/finance/evaluation";

interface EvaluateRequestPayload {
  itemName?: unknown;
  itemPrice?: unknown;
  mode?: unknown;
  demoProfileId?: unknown;
  summary?: unknown;
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

  const summary = body.summary === true;
  const itemName = typeof body.itemName === "string" ? body.itemName.trim() : "";
  const itemPrice = typeof body.itemPrice === "number" ? body.itemPrice : null;

  if (
    !summary &&
    (!itemName ||
      typeof itemPrice !== "number" ||
      !Number.isFinite(itemPrice) ||
      !validPurchasePrice(itemPrice))
  ) {
    return NextResponse.json(
      { status: "error_procesamiento", error: "Se requiere un producto y un precio confirmado mayor que cero." },
      { status: 400 },
    );
  }

  try {
    let revision: string | undefined;
    let profile: OnboardingProfile;
    try {
      profile = await resolveEvaluationProfile(body, async () => {
        const snapshot = await loadAccountSnapshot();
        revision = snapshot.revision;
        return snapshot.profile;
      });
    } catch (error) {
      if (error instanceof InvalidDemoProfileError) {
        throw new EvaluationRequestError(error.message, 400, "invalid_demo_profile");
      }
      throw error;
    }

    const deterministicResult = buildDeterministicEvaluation(
      summary ? "Resumen financiero" : itemName,
      summary ? null : (itemPrice as number),
      profile,
    );

    return NextResponse.json({
      ...deterministicResult,
      financialRevision: revision,
    });
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

    console.error("Purchase evaluation failed.");
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
