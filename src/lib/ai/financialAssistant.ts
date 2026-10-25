import { generateStructured, ProductAIError } from "./gemini";
import { INTENT_PROMPT, EXPLANATION_PROMPT } from "./prompts";
import { intentSchema, explanationSchema, type ChatRequest, type FinancialIntent, type ToolResult } from "./schemas";
import { renderExplanation, evaluateExplanation } from "./responseEvaluation";
import { explicitMonetaryAmounts, identifiedProductName, requestedProductName, sameProductName } from "./productContext";
import { validPurchasePrice } from "../finance/money";

export function redactConversation(value: string) {
  return value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[correo omitido]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, "[identificador omitido]")
    .replace(/\b(?:Bearer\s+\S+|(?:sk-|AIza)[\w-]+)\b/gi, "[credencial omitida]")
    .replace(/\b(?:\d[ -]?){13,19}\b/g, "[número personal omitido]");
}

/** A conservative offline path for explicit prices, product references and margin questions. */
export function fallbackIntent(request: ChatRequest): FinancialIntent {
  const base: FinancialIntent = { operation: "available", productName: null, price: null,
    alternativePrice: null, weeks: null, weeklyContribution: null, upfrontAmount: null, reserveAmount: null, goalQuery: null };
  const message = request.message.trim();
  const normalized = message.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const monetary = explicitMonetaryAmounts(message);
  if (monetary.some(amount => !validPurchasePrice(amount))) return { ...base, operation: "clarify" };
  const purchase = /\b(?:comprar(?:me)?|compro|comprarlo|compra|producto|evaluar|evaluacion)\b/.test(normalized);
  const generalMargin = /(?:cuanto|dinero|margen).*(?:gastar|gasto|disponible)|cuanto puedo gastar|dinero libre/.test(normalized);
  if (generalMargin && !/\bcompr(?:ar|o)/.test(normalized)) return base;
  const named = requestedProductName(message);
  const isReference = named === null;
  const name = named && !isReference ? named : request.pendingProductName ?? request.product?.name ?? null;
  const otherFinancialAction = /\b(?:ahorrar|apartar|pagar|abonar|transferir|reservar|guardar|ahorro|deuda|fondo|ingreso|salario)\b/.test(normalized);
  if (otherFinancialAction && !/evaluacion determinista/.test(normalized)) return base;
  const wantsNamedItem = /\bquiero\b/.test(normalized) && named !== null && !isReference;
  const priceReference = Boolean(request.product || request.pendingProductName) &&
    (/\b(?:cuesta|vale|precio|uno|una|otro|otra)\b/.test(normalized) || /^\s*(?:\$\s*)?\d[\d,.]*(?:\s*(?:mxn|pesos))?[?.!]?\s*$/.test(normalized));
  if (monetary.length === 1 && (purchase || wantsNamedItem || priceReference)) {
    return { ...base, operation: "purchase", productName: name, price: monetary[0] };
  }
  if (purchase) {
    const resolvedName = identifiedProductName(name);
    const inherited = request.product && (!resolvedName || sameProductName(resolvedName, request.product.name)) ? request.product : null;
    return { ...base, operation: "purchase", productName: name, price: inherited?.price ?? null };
  }
  return base;
}

/** Reject invented tool arguments before any calculation. Values can only describe user scenarios. */
export function validateIntentArguments(intent: FinancialIntent, request: ChatRequest) {
  const requestedName = requestedProductName(request.message);
  // The user's explicit article takes precedence over a stale or mislabeled model argument.
  const candidate = ["purchase", "compare", "wait", "savings"].includes(intent.operation) && requestedName
    ? { ...intent, productName: requestedName } : intent;
  const utterances = [...request.history.map(h => h.content), request.message].join(" ");
  const numbers = new Set((utterances.replace(/,/g, "").match(/\d+(?:\.\d+)?/g) ?? []).map(Number));
  if (request.product) numbers.add(request.product.price);
  for (const amount of [candidate.price, candidate.alternativePrice, candidate.weeklyContribution, candidate.upfrontAmount, candidate.reserveAmount]) {
    if (amount !== null && !numbers.has(amount)) throw new ProductAIError("gemini_arguments", "El modelo propuso un importe que no confirmaste. Escribe las cantidades en MXN y reintenta.", 422);
  }
  if (["purchase", "compare", "wait", "savings"].includes(candidate.operation) && candidate.price !== null) {
    const explicitCurrent = explicitMonetaryAmounts(request.message).includes(candidate.price);
    const named = identifiedProductName(candidate.productName);
    const sameContext = request.product && (!named || sameProductName(named, request.product.name));
    if (!explicitCurrent && !(sameContext && request.product?.price === candidate.price)) {
      throw new ProductAIError("gemini_arguments", "Confirma el precio de este producto; no usaré el precio de otro artículo del historial.", 422);
    }
  }
  const words = ["cero", "una", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce"];
  if (candidate.weeks !== null && !numbers.has(candidate.weeks) && !new RegExp(`\\b${words[candidate.weeks] ?? "__unsupported__"}\\b`, "i").test(utterances)) {
    throw new ProductAIError("gemini_arguments", "Confirma el plazo en semanas para calcular el plan.", 422);
  }
  if (candidate.operation === "withdraw_goal" && !/retir|sac(?:ar|o)|us(?:ar|o).*(?:ahorro|meta)/i.test(utterances)) {
    throw new ProductAIError("gemini_arguments", "Confirma explícitamente si quieres simular un retiro de una meta.", 422);
  }
  if (candidate.upfrontAmount !== null && !/inicial|entrada|enganche|apart.*(?:hoy|inicio)|ya.*(?:apart|guard)|usar.*(?:hoy|ahora)/i.test(utterances)) {
    throw new ProductAIError("gemini_arguments", "Confirma cuánto quieres apartar inicialmente; no utilizaré tu margen automáticamente.", 422);
  }
  if (["purchase", "compare", "wait", "savings"].includes(candidate.operation) && !identifiedProductName(candidate.productName) && request.pendingProductName) {
    return { ...candidate, productName: request.pendingProductName };
  }
  return candidate;
}

export async function interpretFinancialIntent(request: ChatRequest, signal?: AbortSignal) {
  const intent = await generateStructured({ source: "chat-intent", systemInstruction: INTENT_PROMPT, schema: intentSchema,
    prompt: JSON.stringify({ message: redactConversation(request.message), history: request.history.map(h => ({ role: h.role, content: redactConversation(h.content) })),
      pendingProductName: request.pendingProductName ? redactConversation(request.pendingProductName) : null,
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
