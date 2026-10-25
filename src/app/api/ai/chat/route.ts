import { createHash } from "node:crypto";
import { chatRequestSchema, type ChatResponse } from "@/lib/ai/schemas";
import { authorizeChat, acquireChat, readChatBody } from "@/lib/ai/chatAccess";
import { interpretFinancialIntent, fallbackIntent, explainFinancialTool } from "@/lib/ai/financialAssistant";
import { executeFinancialTool } from "@/lib/ai/financialTools";
import { deterministicExplanation } from "@/lib/ai/responseEvaluation";
import { EvaluationRequestError, loadAccountSnapshot } from "@/lib/finance/accountSnapshot";
import { getDemoProfile } from "@/lib/finance/demoProfiles";
import { ProductAIError } from "@/lib/ai/gemini";

export const maxDuration = 60;
const headers = { "Cache-Control": "no-store" };
export async function POST(request: Request) {
  let release: (() => void) | undefined;
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin) throw new EvaluationRequestError("Solicitud no autorizada.", 403, "invalid_origin");
    if (!request.headers.get("content-type")?.startsWith("application/json")) throw new EvaluationRequestError("Usa una consulta JSON.", 415, "invalid_content_type");
    const parsed = chatRequestSchema.safeParse(await readChatBody(request));
    if (!parsed.success) throw new EvaluationRequestError("Revisa la longitud del mensaje y los datos de la consulta.", 400, "invalid_request");
    const body = parsed.data;
    const identity = await authorizeChat(body);
    release = acquireChat(identity, body.requestId, createHash("sha256").update(JSON.stringify(body)).digest("hex"), !body.deterministicOnly);
    // Both phases share a single deadline, rather than two successive 55-second calls.
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(50_000)]);
    let intent = fallbackIntent(body);
    let aiError: ProductAIError | undefined;
    if (!body.deterministicOnly) {
      try { intent = await interpretFinancialIntent(body, signal); }
      catch (error) { aiError = error instanceof ProductAIError ? error : new ProductAIError("gemini_connection", "Gemini no respondió.", 502); }
    }
    request.signal.throwIfAborted();
    const snapshot = body.mode === "demo" ? null : await loadAccountSnapshot();
    if (snapshot && snapshot.userId !== identity) throw new EvaluationRequestError("La sesión cambió. Vuelve a enviar tu consulta.", 409, "session_changed");
    const profile = snapshot?.profile ?? getDemoProfile(body.demoProfileId);
    if (!profile) throw new EvaluationRequestError("Selecciona un perfil válido.", 400, "invalid_profile");
    const tool = executeFinancialTool(profile, intent, body.product, snapshot?.raw.financialDate);
    let reply = deterministicExplanation(tool);
    let quality: ChatResponse["quality"];
    if (!body.deterministicOnly && !aiError) {
      try { const explained = await explainFinancialTool(tool, signal); reply = explained.reply; quality = explained.quality; }
      catch (error) { aiError = error instanceof ProductAIError ? error : new ProductAIError("gemini_connection", "Gemini no respondió.", 502); }
    }
    request.signal.throwIfAborted();
    const source = body.deterministicOnly || aiError ? "deterministic" : "gemini";
    const response: ChatResponse = {
      reply, source, product: tool.product, cards: tool.cards, report: tool.report, savings: tool.savings,
      financialRevision: snapshot?.revision ?? `demo:${body.demoProfileId}`,
      ...(quality ? { quality } : {}),
      ...(aiError ? { code: aiError.code, warning: `Gemini no completó la respuesta. Mostramos ${tool.product ? "la evaluación calculada del producto confirmado" : "el resumen calculado de tu margen"}. Puedes reintentar la pregunta o consultar las cifras sin IA.` } : {}),
    };
    return Response.json(response, { headers });
  } catch (error) {
    if (error instanceof EvaluationRequestError) return Response.json({ error: error.message, code: error.code }, {
      status: error.httpStatus, headers: { ...headers, ...(error.httpStatus === 429 ? { "Retry-After": "60" } : {}) },
    });
    if (request.signal.aborted) return Response.json({ error: "Consulta cancelada.", code: "request_cancelled" }, { status: 499, headers });
    // Never log provider exceptions or account data.
    return Response.json({ error: "No se pudo completar la consulta. Intenta de nuevo.", code: "chat_failed" }, { status: 500, headers });
  } finally { release?.(); }
}
