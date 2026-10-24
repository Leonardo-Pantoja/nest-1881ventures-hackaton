import { NextResponse } from "next/server";

export interface EvaluateRequestPayload {
  itemName: string;
  itemPrice: number;
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
  const itemName = payload.itemName?.trim() || "Artículo consultado";
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
        ).toLocaleString()} MXN y tocaría lo que ya apartaste para tus pagos fijos.`
      : verdict === "PRECAUCION"
      ? `Puedes pagar "${itemName}" hoy sin tocar tus pagos fijos, pero te dejaría con solo $${remainingFreeSafe.toLocaleString()} MXN libres para imprevistos.`
      : `"${itemName}" cabe cómodamente en tu dinero libre de hoy y aún te deja $${remainingFreeSafe.toLocaleString()} MXN tranquilos para el resto de la semana.`;

  const headlineLine2 =
    verdict === "COMPROMETE"
      ? `Compara abajo cómo cambia tu tranquilidad si esperas ${profile.nextPaydayDays} días a cobrar o si lo planeas con micro-ahorro.`
      : `Tus compromisos próximos ($${commitmentsTotal.toLocaleString()} MXN) y tu reserva de paz siguen protegidos.`;

  return {
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
    const baseResult = buildDeterministicEvaluation(body);

    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    // Si hay API key configurada en entorno (local o Vercel), enriquecer las 2 líneas empáticas con IA manteniendo los cálculos deterministas exactos
    if (geminiKey) {
      try {
        const prompt = `Eres un copiloto financiero empático en México. El usuario quiere comprar "${body.itemName}" por $${body.itemPrice} MXN. Su dinero libre real hoy es $${baseResult.safeToSpend} MXN y el veredicto matemático es "${baseResult.badgeLabel}". Devuelve un JSON estricto con {"headlineLine1": "frase empática de 1 línea con los montos clave", "headlineLine2": "segunda línea breve de consejo humano sin tecnicismos"}.`;

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.3,
              },
            }),
            signal: AbortSignal.timeout(3500),
          }
        );

        if (response.ok) {
          const data = await response.json();
          const rawText =
            data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
          const parsed = JSON.parse(rawText);
          if (parsed?.headlineLine1 && parsed?.headlineLine2) {
            return NextResponse.json({
              ...baseResult,
              headlineLine1: parsed.headlineLine1,
              headlineLine2: parsed.headlineLine2,
              source: "ai",
            } satisfies EvaluateApiResponse);
          }
        }
      } catch {
        // Fallback silencioso al motor determinista local
      }
    } else if (openaiKey) {
      try {
        const response = await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${openaiKey}`,
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              response_format: { type: "json_object" },
              messages: [
                {
                  role: "system",
                  content:
                    'Devuelve JSON con {"headlineLine1": "...", "headlineLine2": "..."} en español cercano, sin tecnicismos.',
                },
                {
                  role: "user",
                  content: `Compra: ${body.itemName} ($${body.itemPrice} MXN). Dinero libre hoy: $${baseResult.safeToSpend} MXN. Veredicto: ${baseResult.badgeLabel}.`,
                },
              ],
              temperature: 0.3,
            }),
            signal: AbortSignal.timeout(3500),
          }
        );

        if (response.ok) {
          const data = await response.json();
          const parsed = JSON.parse(
            data?.choices?.[0]?.message?.content || "{}"
          );
          if (parsed?.headlineLine1 && parsed?.headlineLine2) {
            return NextResponse.json({
              ...baseResult,
              headlineLine1: parsed.headlineLine1,
              headlineLine2: parsed.headlineLine2,
              source: "ai",
            } satisfies EvaluateApiResponse);
          }
        }
      } catch {
        // Fallback silencioso al motor determinista local
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

