import { GoogleGenAI, ThinkingLevel, type Part } from "@google/genai";
import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";

export const GEMINI_TIMEOUT_MS = 55_000;
export const productSchema = z.object({
  name: z.string().trim().min(1).max(200).nullable(),
  price: z.number().finite().nonnegative().nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
});
export type RecognizedProduct = z.infer<typeof productSchema>;

export class ProductAIError extends Error {
  constructor(public code: string, message: string, public status: number) { super(message); }
}

export function productAIErrorResponse(error: unknown) {
  const known = error instanceof ProductAIError ? error : new ProductAIError("gemini_connection", "No se pudo conectar con Gemini. Puedes reintentar o ingresar los datos manualmente.", 502);
  return Response.json({ error: known.message, code: known.code }, {
    status: known.status, headers: { "Cache-Control": "no-store", ...(known.status === 429 ? { "Retry-After": "60" } : {}) },
  });
}

/** At most two provider calls share one deadline; transient failures may use a configured fallback. */
export async function extractProduct(options: {
  source: "text" | "image";
  prompt: string;
  image?: { bytes: Buffer; originalBytes: number; mimeType: string };
  signal?: AbortSignal;
}): Promise<RecognizedProduct> {
  const primaryModel = process.env.GEMINI_MODEL?.trim();
  const fallbackModel = process.env.GEMINI_FALLBACK_MODEL?.trim();
  if (!primaryModel || !process.env.GEMINI_API_KEY) throw new ProductAIError("gemini_unavailable", "El reconocimiento no está disponible temporalmente.", 503);
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const started = Date.now();
  const deadline = AbortSignal.timeout(GEMINI_TIMEOUT_MS);
  const signal = options.signal ? AbortSignal.any([options.signal, deadline]) : deadline;
  const parts: Part[] = [{ text: options.prompt }];
  if (options.image) parts.push({ inlineData: { mimeType: options.image.mimeType, data: options.image.bytes.toString("base64") } });
  for (let attempt = 1; attempt <= 2; attempt++) {
    const model = attempt === 2 && fallbackModel ? fallbackModel : primaryModel;
    const thinkingConfig = /^gemini-3(?:\.|-)/.test(model) ? { thinkingLevel: ThinkingLevel.LOW }
      : /^gemini-2\.5-flash/.test(model) ? { thinkingBudget: 0 } : undefined;
    const attemptStarted = Date.now();
    let code = "ok";
    let status = 200;
    let providerStatus: number | null = null;
    try {
      signal.throwIfAborted();
      const result = await ai.models.generateContent({ model, contents: [{ role: "user", parts }], config: {
        abortSignal: signal,
        httpOptions: { timeout: Math.max(1, GEMINI_TIMEOUT_MS - (Date.now() - started)), retryOptions: { attempts: 1 } },
        thinkingConfig, automaticContinuation: false, maxOutputTokens: 2048, responseMimeType: "application/json",
        responseJsonSchema: { type: "object", properties: { name: { type: ["string", "null"] }, price: { type: ["number", "null"] }, currency: { type: ["string", "null"] } }, required: ["name", "price", "currency"], additionalProperties: false },
      } });
      let value: unknown;
      try { value = JSON.parse(result.text || "null"); } catch { throw new ProductAIError("gemini_validation", "Gemini devolvió una respuesta inválida. Puedes reintentar.", 422); }
      const parsed = productSchema.safeParse(value);
      if (!parsed.success) throw new ProductAIError("gemini_validation", "Gemini devolvió datos inválidos. Puedes reintentar.", 422);
      return parsed.data;
    } catch (error) {
      const upstreamStatus = typeof error === "object" && error !== null && "status" in error ? Number(error.status) : 0;
      providerStatus = Number.isFinite(upstreamStatus) && upstreamStatus > 0 ? upstreamStatus : null;
      const name = error instanceof Error ? error.name : "";
      let mapped: ProductAIError;
      if (options.signal?.aborted) mapped = new ProductAIError("request_cancelled", "El análisis fue cancelado.", 499);
      else if (deadline.aborted || name === "TimeoutError" || name === "AbortError") mapped = new ProductAIError("gemini_local_timeout", "Se agotó el tiempo de espera local de Gemini. Puedes reintentar.", 504);
      else if (error instanceof ProductAIError) mapped = error;
      else if (upstreamStatus === 504) mapped = new ProductAIError("gemini_upstream_504", "Gemini devolvió un error 504 y no terminó el análisis. Puedes reintentar.", 504);
      else if (upstreamStatus === 503) mapped = new ProductAIError("gemini_upstream_503", "Gemini no está disponible temporalmente. Puedes reintentar.", 503);
      else if (upstreamStatus === 429) mapped = new ProductAIError("gemini_quota", "Gemini alcanzó su cuota. Espera antes de reintentar.", 429);
      else if ([400, 401, 403].includes(upstreamStatus)) mapped = new ProductAIError("gemini_rejected", "Gemini rechazó la solicitud. Revisa la configuración del servicio o ingresa los datos manualmente.", 502);
      else mapped = new ProductAIError("gemini_connection", "No se pudo conectar con Gemini. Puedes reintentar o ingresar los datos manualmente.", 502);
      code = mapped.code; status = mapped.status;
      if (attempt === 1 && [503, 504].includes(upstreamStatus) && !signal.aborted && GEMINI_TIMEOUT_MS - (Date.now() - started) > 2000) {
        try { await delay(750, undefined, { signal }); } catch {
          throw options.signal?.aborted ? new ProductAIError("request_cancelled", "El análisis fue cancelado.", 499)
            : new ProductAIError("gemini_local_timeout", "Se agotó el tiempo de espera local de Gemini. Puedes reintentar.", 504);
        }
        continue;
      }
      throw mapped;
    } finally {
      // Never log prompts, image contents, provider messages, credentials or financial data.
      console.info("product_ai", { model, source: options.source, attempt, code, status, providerStatus,
        durationMs: Date.now() - attemptStarted, totalDurationMs: Date.now() - started,
        imageBytes: options.image?.bytes.length ?? 0, originalImageBytes: options.image?.originalBytes ?? 0 });
    }
  }
  throw new ProductAIError("gemini_connection", "No se pudo completar el análisis.", 502);
}
