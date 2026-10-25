import { NextResponse } from "next/server";
import { InvalidDemoProfileError, resolveEvaluationProfile } from "@/lib/finance";
import { EvaluationRequestError, loadAccountSnapshot } from "@/lib/finance/accountSnapshot";
import { buildDeterministicEvaluation, type EvaluateApiResponse } from "@/lib/finance/evaluation";
import { validPurchasePrice } from "@/lib/finance/money";
import type { OnboardingProfile } from "@/lib/onboarding/financialTypes";
export type { EvaluateApiResponse } from "@/lib/finance/evaluation";

export interface ChatTurnMessage {
  role: "user" | "assistant";
  content: string;
}

interface EvaluateRequestPayload {
  itemName?: unknown;
  itemPrice?: unknown;
  mode?: unknown;
  demoProfileId?: unknown;
  summary?: unknown;
  imageBase64?: unknown;
  imageMimeType?: unknown;
  chatMessages?: unknown;
  userQuestion?: unknown;
  financialContext?: unknown;
}

function buildLocalChatFallback(
  evaluation: EvaluateApiResponse,
  profile: OnboardingProfile,
  userQuestion?: string,
): { aiExplanation: string; chatReply: string } {
  const safe = evaluation.safeToSpend ?? 0;
  const price = evaluation.detectedItemPrice;
  const name = evaluation.detectedItemName;
  const goalTitle = profile.primaryGoal?.title || "tu meta principal";
  const goalSaved = profile.primaryGoal?.currentSaved ?? 0;
  const goalTarget = profile.primaryGoal?.targetAmount ?? 0;
  const weeksBefore = evaluation.goalImpact?.weeksBefore;
  const diff6Weeks = evaluation.projectedBalanceDifference;
  const nextPaydayDays = evaluation.daysUntilNextIncome ?? 7;

  const baseDiagnosis =
    evaluation.status === "datos_incompletos"
      ? `Faltan datos financieros confirmados (${evaluation.missingInformation.join(" ")}) para darte un veredicto definitivo sobre "${name}".`
      : evaluation.status === "excede_el_margen"
        ? `Comprar "${name}" ($${price.toLocaleString()} MXN) hoy rebasa tu margen seguro ($${safe.toLocaleString()} MXN) por $${(evaluation.exceedsBy ?? 0).toLocaleString()} MXN. Tu ahorro fijo de $${goalSaved.toLocaleString()} MXN en "${goalTitle}" permanece 100% protegido y no se toca.`
        : evaluation.status === "precaucion"
          ? `"${name}" ($${price.toLocaleString()} MXN) cabe dentro de tu margen de $${safe.toLocaleString()} MXN, pero te dejaría con $${(evaluation.remainingAfterBuyToday ?? 0).toLocaleString()} MXN libres (menos de la mitad de tu colchón de seguridad). Tu ahorro fijo en "${goalTitle}" no se ve afectado.`
          : `"${name}" ($${price.toLocaleString()} MXN) está dentro de tu margen seguro de $${safe.toLocaleString()} MXN y te deja $${(evaluation.remainingAfterBuyToday ?? 0).toLocaleString()} MXN libres antes de tu próximo ingreso en ${nextPaydayDays} días.`;

  const projectionNote =
    diff6Weeks !== null && evaluation.projectionAfter
      ? ` En la proyección a 6 semanas (weeklyProjection), tu saldo final pasaría de $${evaluation.projection?.weeks[5]?.endBalance.toLocaleString()} a $${evaluation.projectionAfter.weeks[5]?.endBalance.toLocaleString()} MXN (${diff6Weeks >= 0 ? "+" : ""}$${diff6Weeks.toLocaleString()} MXN), con un saldo mínimo proyectado de $${evaluation.projectionAfter.lowestBalance?.toLocaleString()} MXN.`
      : "";

  const aiExplanation = `${baseDiagnosis}${projectionNote}`;

  if (!userQuestion || !userQuestion.trim()) {
    return { aiExplanation, chatReply: aiExplanation };
  }

  const q = userQuestion.toLowerCase();
  const numMatches = userQuestion.replace(/,/g, "").match(/\d+(?:\.\d+)?/g);
  const altPrice = numMatches
    ? numMatches
        .map((n) => Number(n))
        .find((n) => n > 0 && n !== price && n < 500000)
    : undefined;

  if (altPrice !== undefined && evaluation.safeToSpend !== null) {
    const altRemaining = safe - altPrice;
    const altViable = altRemaining >= 0;
    return {
      aiExplanation,
      chatReply: altViable
        ? `Si eliges una alternativa de $${altPrice.toLocaleString()} MXN en lugar de $${price.toLocaleString()} MXN, te ahorras $${Math.max(0, price - altPrice).toLocaleString()} MXN y te quedarían $${altRemaining.toLocaleString()} MXN libres en tu margen seguro sin tocar tu ahorro fijo en "${goalTitle}". ¡Es un escenario mucho más cómodo!`
        : `Incluso con una alternativa de $${altPrice.toLocaleString()} MXN, superarías tu margen libre actual ($${safe.toLocaleString()} MXN) por $${Math.abs(altRemaining).toLocaleString()} MXN. Te conviene guardarla para reevaluar en ${nextPaydayDays} días o armar un plan de micro-ahorro (+100 XP).`,
    };
  }

  if (q.includes("esper") || q.includes("quincena") || q.includes("nómina") || q.includes("nomina")) {
    return {
      aiExplanation,
      chatReply: `Si eliges "Guardar y reevaluar después" (+50 XP), congelas "${name}" durante ${nextPaydayDays} días hasta tu próximo ingreso ($${(profile.nextPaydayAmount ?? 0).toLocaleString()} MXN). Así no descuentas nada hoy y proteges tus compromisos fijos ($${((evaluation.consideredExpenses.pendingCommitments ?? 0) + (evaluation.consideredExpenses.pendingDebtPayments ?? 0)).toLocaleString()} MXN) y tu colchón de $${(evaluation.consideredExpenses.safetyBuffer ?? 0).toLocaleString()} MXN.`,
    };
  }

  if (q.includes("meta") || q.includes("ahorro") || q.includes("micro")) {
    const weeklySave4 = Math.max(100, Math.ceil(price / 4));
    return {
      aiExplanation,
      chatReply: `Tu meta "${goalTitle}" tiene $${goalSaved.toLocaleString()} de $${goalTarget.toLocaleString()} MXN ahorrados${weeksBefore != null ? ` (~${weeksBefore} semanas restantes)` : ""}. Como el motor respeta el ahorro fijo, ninguna compra retira dinero de tu meta. Si eliges "Plan de Micro-ahorro" (+100 XP), podrías apartar ~$${weeklySave4.toLocaleString()} MXN por semana durante 4 semanas sin estresar tu liquidez.`,
    };
  }

  if (q.includes("semana") || q.includes("proyecc") || q.includes("futuro")) {
    const lowBefore = evaluation.projection?.lowestBalance;
    const lowAfter = evaluation.projectionAfter?.lowestBalance;
    return {
      aiExplanation,
      chatReply:
        lowBefore != null
          ? `Según la proyección determinista de 6 semanas, sin comprar hoy tu punto más bajo de liquidez sería $${lowBefore.toLocaleString()} MXN${lowAfter != null ? `, y comprando hoy bajaría a $${lowAfter.toLocaleString()} MXN` : ""}. ${evaluation.status === "excede_el_margen" ? "Comprar hoy comprometería tus fondos protegidos." : "Tus reservas siguen cubiertas en las 6 semanas."}`
          : `Para proyectar las 6 semanas necesitamos que todos tus compromisos e ingresos periódicos estén confirmados.`,
    };
  }

  return {
    aiExplanation,
    chatReply: `${baseDiagnosis}${projectionNote} Puedes elegir: 1) Comprar hoy, 2) Guardar y reevaluar en ${nextPaydayDays} días (+50 XP), o 3) Crear un plan de Micro-ahorro (+100 XP).`,
  };
}

function buildContextChatReply(
  rawContext: unknown,
  itemName: string,
  itemPrice: number | null,
  question: string,
): string {
  const ctx = (rawContext && typeof rawContext === "object" ? rawContext : {}) as Record<string, unknown>;
  const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  const balance = num(ctx.currentBalance);
  const buffer = num(ctx.safetyBuffer);
  const safe = typeof ctx.safeToSpend === "number" ? ctx.safeToSpend : Math.max(0, balance - buffer);
  const price = itemPrice ?? num(ctx.itemPrice);
  const name = itemName || "este producto";
  const days = num(ctx.nextPaydayDays, 7);
  const money = (n: number) => `$${Math.round(n).toLocaleString("es-MX")} MXN`;
  const remaining = safe - price;
  const goals = Array.isArray(ctx.goals) ? (ctx.goals as Record<string, unknown>[]) : [];
  const goalNote = goals[0]
    ? ` Tu ahorro de ${money(num(goals[0].currentSaved))} en "${String(goals[0].title ?? "tu meta")}" no se toca.`
    : "";
  const verdict =
    remaining >= 0
      ? `"${name}" (${money(price)}) cabe en tu margen seguro de ${money(safe)} y te dejaría ${money(remaining)} libres.`
      : `"${name}" (${money(price)}) supera tu margen seguro de ${money(safe)} por ${money(Math.abs(remaining))}.`;
  const q = question.toLowerCase();
  if (q.includes("esper") || q.includes("quincena")) {
    return `Si esperas ${days} días a tu próximo ingreso no descuentas nada hoy. ${verdict}${goalNote}`;
  }
  if (q.includes("micro") || q.includes("ahorro")) {
    return `Podrías apartar ~${money(Math.max(100, Math.ceil(price / 4)))} por semana durante 4 semanas sin afectar tu liquidez.${goalNote}`;
  }
  if (q.includes("alternativ") || q.includes("mitad")) {
    const alt = Math.round(price / 2);
    return `Con una alternativa de ${money(alt)} te quedarían ${money(safe - alt)} en tu margen.${goalNote}`;
  }
  return `${verdict}${goalNote} Puedes comprar hoy, guardarla para reevaluar en ${days} días o crear un plan de micro-ahorro.`;
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
  let itemName = typeof body.itemName === "string" ? body.itemName.trim() : "";
  let itemPrice = typeof body.itemPrice === "number" ? body.itemPrice : null;
  const hasImage = typeof body.imageBase64 === "string" && body.imageBase64.trim().length > 0;
  const userQuestion = typeof body.userQuestion === "string" ? body.userQuestion.trim() : "";
  const chatMessages: ChatTurnMessage[] = Array.isArray(body.chatMessages)
    ? body.chatMessages
        .filter(
          (m): m is ChatTurnMessage =>
            typeof m === "object" &&
            m !== null &&
            ((m as ChatTurnMessage).role === "user" || (m as ChatTurnMessage).role === "assistant") &&
            typeof (m as ChatTurnMessage).content === "string",
        )
        .slice(-8)
    : [];

  const geminiKey = process.env.GEMINI_API_KEY;

  // Optional step 1: If an image was uploaded and itemName/itemPrice need extraction via Gemini Vision
  if (hasImage && geminiKey && (!itemName || itemPrice === null || !validPurchasePrice(itemPrice))) {
    try {
      const rawBase64 = (body.imageBase64 as string).replace(/^data:image\/[\w+.-]+;base64,/, "");
      const visionRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: 'Extrae el nombre del producto y su precio en pesos mexicanos (MXN) de esta imagen. Devuelve únicamente JSON con {"detectedItemName": "Nombre del producto", "detectedItemPrice": numero_positivo}.',
                  },
                  {
                    inlineData: {
                      mimeType:
                        typeof body.imageMimeType === "string" && body.imageMimeType
                          ? body.imageMimeType
                          : "image/png",
                      data: rawBase64,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.1,
            },
          }),
          signal: AbortSignal.timeout(4000),
        },
      );
      if (visionRes.ok) {
        const visionData = await visionRes.json();
        const text = visionData?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const parsed = JSON.parse(text);
        if (!itemName && typeof parsed?.detectedItemName === "string" && parsed.detectedItemName.trim()) {
          itemName = parsed.detectedItemName.trim();
        }
        if (
          (itemPrice === null || !validPurchasePrice(itemPrice)) &&
          typeof parsed?.detectedItemPrice === "number" &&
          validPurchasePrice(Math.round(parsed.detectedItemPrice))
        ) {
          itemPrice = Math.round(parsed.detectedItemPrice);
        }
      }
    } catch {
      // Continue with deterministic validation
    }
  }

  if (userQuestion && !summary && (!itemName || typeof itemPrice !== "number" || !validPurchasePrice(itemPrice))) {
    itemName = itemName || "Producto consultado";
    itemPrice = typeof itemPrice === "number" && validPurchasePrice(itemPrice) ? itemPrice : 500;
  }

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

    const fallbackTexts = buildLocalChatFallback(deterministicResult, profile, userQuestion);
    let aiExplanation = fallbackTexts.aiExplanation;
    let chatReply = fallbackTexts.chatReply;

    // Optional step 2: If Gemini API key is configured and the request asks for conversational chat or image explanation
    if (geminiKey && !summary && (hasImage || userQuestion || chatMessages.length > 0)) {
      try {
        const historyText = chatMessages
          .map((m) => `${m.role === "user" ? "Usuario" : "Copiloto"}: ${m.content}`)
          .join("\n");

        const promptText = `Eres el Copiloto Financiero de AntesDeGastar en México.
Datos calculados por el motor determinista (NO inventes ni cambies cifras, el ahorro de metas es FIJO y nunca se retira para compras):
- Usuario: ${profile.name || "Usuario"}
- Producto evaluado: "${deterministicResult.detectedItemName}" ($${deterministicResult.detectedItemPrice} MXN)
- Veredicto del motor: ${deterministicResult.badgeLabel} (${deterministicResult.status})
- Margen seguro disponible hoy (Safe-to-Spend): $${deterministicResult.safeToSpend ?? 0} MXN
- Margen restante si compra hoy: $${deterministicResult.remainingAfterBuyToday ?? 0} MXN
- Exceso sobre el margen: $${deterministicResult.exceedsBy ?? 0} MXN
- Saldo actual: $${deterministicResult.consideredExpenses.currentBalance ?? 0} MXN
- Gastos esenciales hasta próximo ingreso (${deterministicResult.daysUntilNextIncome ?? 0} días): $${deterministicResult.consideredExpenses.essentialExpenses ?? 0} MXN
- Compromisos y deudas pendientes: $${(deterministicResult.consideredExpenses.pendingCommitments ?? 0) + (deterministicResult.consideredExpenses.pendingDebtPayments ?? 0)} MXN
- Colchón de seguridad: $${deterministicResult.consideredExpenses.safetyBuffer ?? 0} MXN
- Ahorros protegidos (fijos): $${deterministicResult.consideredExpenses.protectedSavings ?? 0} MXN
- Impacto en saldo a 6 semanas: ${deterministicResult.projectedBalanceDifference ?? 0} MXN
${historyText ? `\nHistorial de conversación:\n${historyText}` : ""}
${userQuestion ? `\nPregunta actual del usuario: "${userQuestion}"` : "\nDa un diagnóstico breve y empático explicando el resultado del motor y las 3 opciones (Comprar hoy, Guardar y reevaluar, o Plan de Micro-ahorro)."}

Devuelve un JSON estricto con:
{
  "aiExplanation": "resumen empático de 2 oraciones sobre el diagnóstico del motor",
  "chatReply": "respuesta directa, cálida y accionable (máximo 3 oraciones) a la pregunta o escenario del usuario usando los datos reales del motor"
}`;

        const parts: Record<string, unknown>[] = [{ text: promptText }];
        if (hasImage && typeof body.imageBase64 === "string") {
          const rawBase64 = body.imageBase64.replace(/^data:image\/[\w+.-]+;base64,/, "");
          parts.push({
            inlineData: {
              mimeType:
                typeof body.imageMimeType === "string" && body.imageMimeType
                  ? body.imageMimeType
                  : "image/png",
              data: rawBase64,
            },
          });
        }

        const geminiRes = await fetch(
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
            signal: AbortSignal.timeout(8000),
          },
        );

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";
          const parsed = JSON.parse(
            String(rawText).replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim(),
          );
          if (typeof parsed?.aiExplanation === "string" && parsed.aiExplanation.trim()) {
            aiExplanation = parsed.aiExplanation.trim();
          }
          if (typeof parsed?.chatReply === "string" && parsed.chatReply.trim()) {
            chatReply = parsed.chatReply.trim();
          }
        }
      } catch {
        // Silent fallback to deterministic explanation
      }
    }

    return NextResponse.json({
      ...deterministicResult,
      aiExplanation,
      chatReply,
      financialRevision: revision,
    });
  } catch (error) {
    if (error instanceof EvaluationRequestError && userQuestion && !summary) {
      return NextResponse.json({
        chatReply: buildContextChatReply(body.financialContext, itemName, itemPrice, userQuestion),
        fallback: true,
      });
    }
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
    if (userQuestion && !summary) {
      // El chat nunca debe fallar: respuesta contextual con las cifras del cliente
      return NextResponse.json({
        chatReply: buildContextChatReply(body.financialContext, itemName, itemPrice, userQuestion),
        fallback: true,
      });
    }
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
