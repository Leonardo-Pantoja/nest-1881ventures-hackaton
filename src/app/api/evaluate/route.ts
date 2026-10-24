import { NextResponse } from "next/server";

export interface EvaluateRequestPayload {
  itemName: string;
  itemPrice: number;
  imageBase64?: string | null;
  imageMimeType?: string | null;
  profile: {
    name?: string;
    roleTag?: string;
    currentBalance: number;
    nextPaydayDays: number;
    nextPaydayAmount: number;
    safetyBuffer: number;
    dailyEssentialBurn: number;
    commitments: {
      id: string;
      title: string;
      amount: number;
      dueInDays: number;
      category: string;
    }[];
    goal: {
      title: string;
      targetAmount: number;
      currentSaved: number;
      weeklyContribution: number;
    };
  };
}

export interface EvaluateApiResponse {
  detectedItemName: string;
  detectedItemPrice: number;
  verdict: "VIABLE" | "PRECAUCION" | "COMPROMETE";
  badgeLabel: "Compra viable hoy" | "Viable con precaución" | "Compromete tu quincena";
  headlineLine1: string;
  headlineLine2: string;
  safeToSpend: number;
  remainingAfterBuyToday: number;
  remainingFreeSafe: number;
  freeMoneyRemainingPct: number;
  usedByPurchasePct: number;
  daysGoalDelayed: number;
  liquidityAfterPayday: number;
  remainingIfWaitPayday: number;
  waitRemainingPct: number;
  suggestedWeeklySave: number;
  weeksNeeded: number;
  source: "ai" | "local-fallback";
}

function buildDeterministicEvaluation(
  payload: EvaluateRequestPayload
): EvaluateApiResponse {
  const itemName = payload.itemName?.trim() || "Artículo escaneado";
  const itemPrice = Math.max(0, Number(payload.itemPrice) || 0);
  const profile = payload.profile;

  const commitmentsTotal = (profile.commitments || [])
    .filter((c) => c.dueInDays <= profile.nextPaydayDays)
    .reduce((acc, c) => acc + c.amount, 0);

  const essentialLivingCost =
    (profile.dailyEssentialBurn || 150) * (profile.nextPaydayDays || 6);

  const safeToSpend = Math.max(
    0,
    (profile.currentBalance || 0) -
      commitmentsTotal -
      essentialLivingCost -
      (profile.safetyBuffer || 500)
  );

  const remainingAfterBuyToday = safeToSpend - itemPrice;
  const remainingFreeSafe = Math.max(0, remainingAfterBuyToday);

  const freeMoneyRemainingPct =
    safeToSpend > 0
      ? Math.max(
          0,
          Math.min(100, Math.round((remainingFreeSafe / safeToSpend) * 100))
        )
      : 0;

  const usedByPurchasePct = 100 - freeMoneyRemainingPct;

  let verdict: "VIABLE" | "PRECAUCION" | "COMPROMETE" = "VIABLE";
  let badgeLabel:
    | "Compra viable hoy"
    | "Viable con precaución"
    | "Compromete tu quincena" = "Compra viable hoy";

  if (remainingAfterBuyToday < 0) {
    verdict = "COMPROMETE";
    badgeLabel = "Compromete tu quincena";
  } else if (remainingAfterBuyToday < (profile.safetyBuffer || 500) * 0.5) {
    verdict = "PRECAUCION";
    badgeLabel = "Viable con precaución";
  }

  const dailyGoalRate = Math.max(
    1,
    (profile.goal?.weeklyContribution || 500) / 7
  );
  const daysGoalDelayed = Math.max(1, Math.round(itemPrice / dailyGoalRate));

  const liquidityAfterPayday = Math.max(
    0,
    safeToSpend + (profile.nextPaydayAmount || 0)
  );
  const remainingIfWaitPayday = Math.max(0, liquidityAfterPayday - itemPrice);
  const waitRemainingPct =
    liquidityAfterPayday > 0
      ? Math.min(
          100,
          Math.round((remainingIfWaitPayday / liquidityAfterPayday) * 100)
        )
      : 100;

  const baseSuggested = Math.round(itemPrice / 6);
  const suggestedWeeklySave = Math.min(
    2000,
    Math.max(100, Math.round(baseSuggested / 50) * 50)
  );
  const weeksNeeded = Math.max(
    1,
    Math.ceil(itemPrice / Math.max(50, suggestedWeeklySave))
  );

  const headlineLine1 =
    verdict === "COMPROMETE"
      ? `Pagar "${itemName}" hoy rebasa tu dinero libre por $${Math.abs(
          remainingAfterBuyToday
        ).toLocaleString()} MXN y tocaría tus pagos fijos.`
      : verdict === "PRECAUCION"
      ? `Puedes pagar "${itemName}" hoy, pero te dejaría con solo $${remainingFreeSafe.toLocaleString()} MXN libres esta semana.`
      : `"${itemName}" cabe en tu liquidez de hoy y aún te deja $${remainingFreeSafe.toLocaleString()} MXN libres.`;

  const headlineLine2 =
    verdict === "COMPROMETE"
      ? `Espera ${profile.nextPaydayDays}d a cobrar o usa micro-ahorro para proteger tu planta 🌱`
      : `Tus pagos próximos ($${commitmentsTotal.toLocaleString()} MXN) y tu colchón siguen protegidos ✨`;

  return {
    detectedItemName: itemName,
    detectedItemPrice: itemPrice,
    verdict,
    badgeLabel,
    headlineLine1,
    headlineLine2,
    safeToSpend,
    remainingAfterBuyToday,
    remainingFreeSafe,
    freeMoneyRemainingPct,
    usedByPurchasePct,
    daysGoalDelayed,
    liquidityAfterPayday,
    remainingIfWaitPayday,
    waitRemainingPct,
    suggestedWeeklySave,
    weeksNeeded,
    source: "local-fallback",
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as EvaluateRequestPayload;
    let baseResult = buildDeterministicEvaluation(body);

    const geminiKey = process.env.GEMINI_API_KEY;

    // Multimodal Gemini API support (Vision + Financial Empathy) with instant local fallback
    if (geminiKey) {
      try {
        const hasImage = Boolean(body.imageBase64);
        const rawBase64 = body.imageBase64
          ? body.imageBase64.replace(/^data:image\/\w+;base64,/, "")
          : null;

        const promptText = hasImage
          ? `Analiza esta captura de tienda o foto de producto en México. Extrae el nombre del producto y su precio en pesos mexicanos (MXN). El usuario tiene $${baseResult.safeToSpend} MXN libres hoy. Devuelve un JSON estricto con: {"detectedItemName": "Nombre corto del producto", "detectedItemPrice": numero_entero_precio, "headlineLine1": "frase empática juvenil de 1 línea con el impacto en su liquidez", "headlineLine2": "segunda línea breve de consejo amigable"}.`
          : `Eres un copiloto financiero juvenil en México. El usuario quiere comprar "${body.itemName}" por $${body.itemPrice} MXN. Su dinero libre real hoy es $${baseResult.safeToSpend} MXN y el veredicto es "${baseResult.badgeLabel}". Devuelve un JSON estricto con {"detectedItemName": "${body.itemName}", "detectedItemPrice": ${body.itemPrice}, "headlineLine1": "frase empática de 1 línea con los montos clave", "headlineLine2": "segunda línea breve de consejo sin tecnicismos"}.`;

        const parts: Record<string, unknown>[] = [{ text: promptText }];
        if (hasImage && rawBase64) {
          parts.push({
            inlineData: {
              mimeType: body.imageMimeType || "image/png",
              data: rawBase64,
            },
          });
        }

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts }],
              generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.25,
              },
            }),
            signal: AbortSignal.timeout(3200),
          }
        );

        if (response.ok) {
          const data = await response.json();
          const rawText =
            data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
          const parsed = JSON.parse(rawText);

          const finalName =
            typeof parsed?.detectedItemName === "string" &&
            parsed.detectedItemName.trim()
              ? parsed.detectedItemName.trim()
              : body.itemName;
          const finalPrice =
            typeof parsed?.detectedItemPrice === "number" &&
            parsed.detectedItemPrice > 0
              ? Math.round(parsed.detectedItemPrice)
              : body.itemPrice;

          // Re-run deterministic math with detected price if image changed it
          baseResult = buildDeterministicEvaluation({
            ...body,
            itemName: finalName,
            itemPrice: finalPrice,
          });

          return NextResponse.json({
            ...baseResult,
            detectedItemName: finalName,
            detectedItemPrice: finalPrice,
            headlineLine1: parsed?.headlineLine1 || baseResult.headlineLine1,
            headlineLine2: parsed?.headlineLine2 || baseResult.headlineLine2,
            source: "ai",
          } satisfies EvaluateApiResponse);
        }
      } catch {
        // Instant silent fallback to local deterministic evaluation
      }
    }

    return NextResponse.json(baseResult);
  } catch {
    return NextResponse.json(
      { error: "No se pudo procesar la evaluación" },
      { status: 400 }
    );
  }
}
