import { generateStructured, ProductAIError } from "./gemini";
import { INTENT_PROMPT } from "./prompts";
import { intentSchema, type ChatRequest, type FinancialIntent, type ToolResult } from "./schemas";
import { generateConversationalReply, type ReplyContextInput } from "./conversationalReply";
import type { ConversationState } from "./conversationState";
import { isConfirmation, userIncomeStatement } from "./conversationState";
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
  const income = userIncomeStatement(message);
  if (income) return { ...base, operation: "income_update", incomeStatement: income };
  if (isConfirmation(message)) return { ...base, operation: "confirmation" };
  const weekMatch = normalized.match(/(?:en|hasta|durante|espero|esperar)\s*(?:unas?\s*)?(\d+|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\s*semanas?/);
  const numberWords: Record<string, number> = { una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12 };
  const weeks = weekMatch ? numberWords[weekMatch[1]] ?? Number(weekMatch[1]) : null;
  if (/prioriz|pagar primero|renta o/.test(normalized)) return { ...base, operation: "priorities" };
  if (/compromisos|que pagos|pagos pendientes|cuando vence/.test(normalized)) return { ...base, operation: "commitments" };
  if (/esper|dentro de.*seman/.test(normalized) && (request.product || request.pendingProductName)) return { ...base, operation: "wait", weeks };
  if (/ahorr|cuanto tiempo|cuando podria reunir/.test(normalized) && (request.product || request.pendingProductName)) return { ...base, operation: "savings", weeks,
    weeklyContribution: /semanal|por semana/.test(normalized) && monetary.length === 1 ? monetary[0] : null };
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
    (/\b(?:cuesta|costara|costase|costaria|vale|precio|uno|una|otro|otra)\b/.test(normalized) || /^\s*(?:\$\s*)?\d[\d,.]*(?:\s*(?:mxn|pesos))?[?.!]?\s*$/.test(normalized));
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
  const refersToSelected = request.product && /\b(?:el|ese|este)\s+(?:juego|producto|articulo)\b/i.test(request.message) && !requestedName;
  // The user's explicit article takes precedence over a stale or mislabeled model argument.
  const candidate = ["purchase", "compare", "wait", "savings"].includes(intent.operation) && requestedName
    ? { ...intent, productName: requestedName } : refersToSelected ? { ...intent, productName: request.product!.name } : intent;
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

export async function interpretFinancialIntent(request: ChatRequest, signal?: AbortSignal, conversation?: ConversationState) {
  const intent = await generateStructured({ source: "chat-intent", systemInstruction: INTENT_PROMPT, schema: intentSchema,
    prompt: JSON.stringify({ dialogue: conversation ? { lastOperation: conversation.lastOperation, awaiting: conversation.awaiting, incomeContext: conversation.incomeContext, previousQuestion: redactConversation(conversation.previousQuestion) } : null, message: redactConversation(request.message), history: request.history.map(h => ({ role: h.role, content: redactConversation(h.content) })),
      pendingProductName: request.pendingProductName ? redactConversation(request.pendingProductName) : null,
      product: request.product ? { ...request.product, name: redactConversation(request.product.name) } : null }), signal });
  return validateIntentArguments(intent, request);
}

export async function explainFinancialTool(tool: ToolResult, signal?: AbortSignal, input: ReplyContextInput = { question: "Explica el resultado financiero relevante." }) {
  return generateConversationalReply(tool, input, signal);
}
