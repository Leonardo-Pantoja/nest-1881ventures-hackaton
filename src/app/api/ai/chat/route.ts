import { createHash } from "node:crypto";
import { chatRequestSchema, type ChatResponse } from "@/lib/ai/schemas";
import { authorizeChat, acquireChat, readChatBody } from "@/lib/ai/chatAccess";
import { interpretFinancialIntent, fallbackIntent, explainFinancialTool } from "@/lib/ai/financialAssistant";
import { executeConversationTool, renderConversationFallback, selectConversationFollowUp } from "@/lib/ai/financialConversation";
import { readConversation, effectiveConversationRequest, applyDialogueIntent, signConversation, userIncomeStatement, isConfirmation } from "@/lib/ai/conversationState";
import { EvaluationRequestError, loadAccountSnapshot } from "@/lib/finance/accountSnapshot";
import { getDemoProfile } from "@/lib/finance/demoProfiles";
import { getRegisteredFinancialData } from "@/lib/finance/profileDiagnostics";
import { ProductAIError } from "@/lib/ai/gemini";
import { identifiedProductName } from "@/lib/ai/productContext";

export const maxDuration = 60;
const headers = { "Cache-Control": "no-store" };
function log(stage: string, result: string, code?: string, operation?: string) {
  // Operational categories only: never identities, dialogue, account amounts, tokens or provider errors.
  console.info("financial_chat", { stage, result, ...(code ? { code } : {}), ...(operation ? { operation } : {}) });
}
export async function POST(request: Request) {
  let release: (() => void) | undefined;
  let stage = "validation";
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin) throw new EvaluationRequestError("Solicitud no autorizada.", 403, "invalid_origin");
    if (!request.headers.get("content-type")?.startsWith("application/json")) throw new EvaluationRequestError("Usa una consulta JSON.", 415, "invalid_content_type");
    const parsed = chatRequestSchema.safeParse(await readChatBody(request));
    if (!parsed.success) throw new EvaluationRequestError("Revisa la longitud del mensaje y los datos de la consulta.", 400, "invalid_request");
    stage = "authentication";
    const identity = await authorizeChat(parsed.data);
    const storedState = readConversation(identity, parsed.data);
    const body = effectiveConversationRequest(parsed.data, storedState);
    const state = { ...storedState, incomeContext: userIncomeStatement(body.message) ?? storedState.incomeContext };
    release = acquireChat(identity, body.requestId, createHash("sha256").update(JSON.stringify(body)).digest("hex"), !body.deterministicOnly);
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(50_000)]);
    let intent = fallbackIntent(body);
    let aiError: ProductAIError | undefined;
    stage = "intent";
    if (!body.deterministicOnly) {
      try { intent = await interpretFinancialIntent(body, signal, state); log(stage, "gemini", undefined, intent.operation); }
      catch (error) { aiError = error instanceof ProductAIError ? error : new ProductAIError("gemini_connection", "Gemini no respondió.", 502); log(stage, "error", aiError.code); }
    }
    intent = applyDialogueIntent(intent, body, state);
    request.signal.throwIfAborted();
    stage = "financial_data";
    const snapshot = body.mode === "demo" ? null : await loadAccountSnapshot();
    if (snapshot && snapshot.userId !== identity) throw new EvaluationRequestError("La sesión cambió. Vuelve a enviar tu consulta.", 409, "session_changed");
    const profile = snapshot?.profile ?? getDemoProfile(body.demoProfileId);
    if (!profile) throw new EvaluationRequestError("Selecciona un perfil válido.", 400, "invalid_profile");
    log(stage, "loaded");
    stage = "engine";
    const tool = executeConversationTool(profile, intent, state, snapshot?.raw.financialDate, body.message);
    log(stage, tool.marginStatus === "unknown" || tool.report?.status === "datos_incompletos" || tool.savings?.status === "datos_incompletos" || tool.waitScenario?.status === "datos_incompletos" || tool.facts.some(f => /unknown|missing/.test(f.id)) ? "partial_data" : "calculated", undefined, tool.operation);
    const awaitingPrice = tool.facts.some(fact => fact.id === "missing.price");
    const pendingName = awaitingPrice ? identifiedProductName(intent.productName) ?? body.pendingProductName : undefined;
    let followUp = selectConversationFollowUp(tool, state, profile);
    let reply = renderConversationFallback(tool, followUp);
    let quality: ChatResponse["quality"];
    stage = "explanation";
    if (!body.deterministicOnly && !aiError) {
      try {
        const explained = await explainFinancialTool(tool, signal, { question: body.message, history: body.history,
          previousReply: state.previousReply, previousQuestion: state.previousQuestion, incomeContext: state.incomeContext,
          acknowledgement: tool.operation === "confirmation" ? "Reconoce la confirmación del usuario y distingue datos actualizados de datos completos. No repitas la pregunta anterior."
            : tool.operation === "income_update" ? "Reconoce la declaración de ingresos sin guardar ni inventar movimientos." : undefined,
          suggestedFollowUp: followUp,
        });
        reply = explained.reply; followUp = explained.followUp; quality = explained.quality;
        // A completed answer must never be followed by a renamed version of the same unanswered income loop.
        if (followUp && ((["none", "variable"].includes(state.incomeContext) && ["income_type", "payday"].includes(followUp.kind))
          || isConfirmation(body.message) && state.awaiting === followUp.kind || tool.operation === "income_update")) {
          reply = reply.replace(`\n\n${followUp.text}`, ""); followUp = null;
        }
        log(stage, "gemini", undefined, tool.operation);
      } catch (error) { aiError = error instanceof ProductAIError ? error : new ProductAIError("gemini_connection", "Gemini no respondió.", 502); log(stage, "error", aiError.code); }
    }
    request.signal.throwIfAborted();
    const source = body.deterministicOnly || aiError ? "deterministic" : "gemini";
    if (source === "deterministic") log("response", "fallback", aiError?.code ?? "requested_without_ai", tool.operation);
    const registered = getRegisteredFinancialData(profile);
    const response: ChatResponse = {
      reply, source, product: tool.product, cards: tool.cards, report: tool.report, savings: tool.savings,
      mathematicalSavings: tool.mathematicalSavings, hypotheticalBalance: tool.hypotheticalBalance,
      financialRevision: snapshot?.revision ?? `demo:${body.demoProfileId}`, followUp,
      conversationToken: signConversation(state, { ...body, pendingProductName: pendingName ?? body.pendingProductName }, tool, reply, followUp),
      ...(awaitingPrice ? { clearProductContext: true, ...(pendingName ? { pendingProductName: pendingName } : {}) } : {}),
      ...(state.incomeContext !== "none" && ["purchase", "available", "confirmation", "savings"].includes(tool.operation) && (registered.incomeSources.length === 0 || profile.nextPaydayDays === null) ? { actions: [{ type: "complete_income", label: "Completar ingresos en mi perfil" }] } : {}),
      ...(quality ? { quality } : {}),
      ...(aiError ? { code: aiError.code, warning: "El asistente conversacional no está disponible en este intento. Se muestran únicamente resultados deterministas; puedes reintentar con Gemini sin perder el historial." } : {}),
    };
    return Response.json(response, { headers });
  } catch (error) {
    if (error instanceof EvaluationRequestError) {
      log(stage, "error", error.code);
      return Response.json({ error: error.message, code: error.code }, { status: error.httpStatus,
        headers: { ...headers, ...(error.httpStatus === 429 ? { "Retry-After": "60" } : {}) } });
    }
    if (request.signal.aborted) return Response.json({ error: "Consulta cancelada.", code: "request_cancelled" }, { status: 499, headers });
    log(stage, "error", stage === "engine" ? "engine_failed" : "chat_failed");
    return Response.json({ error: "No se pudo completar la consulta. Intenta de nuevo.", code: "chat_failed" }, { status: 500, headers });
  } finally { release?.(); }
}
