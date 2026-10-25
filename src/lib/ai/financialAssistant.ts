import { generateStructured, ProductAIError } from "./gemini";
import { INTENT_PROMPT, EXPLANATION_PROMPT } from "./prompts";
import { intentSchema, explanationSchema, type ChatRequest, type FinancialIntent, type ToolResult } from "./schemas";
import { renderExplanation, evaluateExplanation } from "./responseEvaluation";

export function redactConversation(value: string) {
  return value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[correo omitido]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, "[identificador omitido]")
    .replace(/\b(?:Bearer\s+\S+|(?:sk-|AIza)[\w-]+)\b/gi, "[credencial omitida]")
    .replace(/\b(?:\d[ -]?){13,19}\b/g, "[número personal omitido]");
}

export function fallbackIntent(request: ChatRequest): FinancialIntent {
  return { operation: request.product ? "purchase" : "available", productName: request.product?.name ?? null,
    price: request.product?.price ?? null, alternativePrice: null, weeks: null, weeklyContribution: null, upfrontAmount: null, reserveAmount: null, goalQuery: null };
}

/** Reject invented tool arguments before any calculation. Values can only describe user scenarios. */
export function validateIntentArguments(intent: FinancialIntent, request: ChatRequest) {
  const utterances = [...request.history.map(h => h.content), request.message].join(" ");
  const numbers = new Set((utterances.replace(/,/g, "").match(/\d+(?:\.\d+)?/g) ?? []).map(Number));
  if (request.product) numbers.add(request.product.price);
  for (const amount of [intent.price, intent.alternativePrice, intent.weeklyContribution, intent.upfrontAmount, intent.reserveAmount]) {
    if (amount !== null && !numbers.has(amount)) throw new ProductAIError("gemini_arguments", "El modelo propuso un importe que no confirmaste. Escribe las cantidades en MXN y reintenta.", 422);
  }
  const words = ["cero", "una", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce"];
  if (intent.weeks !== null && !numbers.has(intent.weeks) && !new RegExp(`\\b${words[intent.weeks] ?? "__unsupported__"}\\b`, "i").test(utterances)) {
    throw new ProductAIError("gemini_arguments", "Confirma el plazo en semanas para calcular el plan.", 422);
  }
  if (intent.operation === "withdraw_goal" && !/retir|sac(?:ar|o)|us(?:ar|o).*(?:ahorro|meta)/i.test(utterances)) {
    throw new ProductAIError("gemini_arguments", "Confirma explícitamente si quieres simular un retiro de una meta.", 422);
  }
  if (intent.upfrontAmount !== null && !/inicial|entrada|enganche|apart.*(?:hoy|inicio)|ya.*(?:apart|guard)|usar.*(?:hoy|ahora)/i.test(utterances)) {
    throw new ProductAIError("gemini_arguments", "Confirma cuánto quieres apartar inicialmente; no utilizaré tu margen automáticamente.", 422);
  }
  return intent;
}

export async function interpretFinancialIntent(request: ChatRequest, signal?: AbortSignal) {
  const intent = await generateStructured({ source: "chat-intent", systemInstruction: INTENT_PROMPT, schema: intentSchema,
    prompt: JSON.stringify({ message: redactConversation(request.message), history: request.history.map(h => ({ role: h.role, content: redactConversation(h.content) })),
      product: request.product ? { ...request.product, name: redactConversation(request.product.name) } : null }), signal });
  return validateIntentArguments(intent, request);
}

export async function explainFinancialTool(tool: ToolResult, signal?: AbortSignal) {
  // Only operation-specific facts leave the server. No raw profile, personal names, email, IDs or tokens.
  const facts = tool.facts.map(f => ({ ...f, text: f.id.startsWith("priority.") ? "Pago registrado priorizado por necesidades, fecha e importe; incluir esta prioridad." : f.text }));
  const explanation = await generateStructured({ source: "chat-explanation", systemInstruction: EXPLANATION_PROMPT,
    schema: explanationSchema, prompt: JSON.stringify({ operation: tool.operation, facts }), signal });
  const quality = evaluateExplanation(tool, explanation);
  if (quality.verdict !== "aprobada") throw new ProductAIError("gemini_consistency", "La respuesta no respetó todos los resultados financieros. Puedes reintentar.", 422);
  return { reply: renderExplanation(tool, explanation), quality: { score: quality.score, verdict: quality.verdict } };
}
