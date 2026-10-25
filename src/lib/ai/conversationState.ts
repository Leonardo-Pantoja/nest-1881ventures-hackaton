import { createHmac, randomBytes, timingSafeEqual, createHash } from "node:crypto";
import { z } from "zod";
import { EvaluationRequestError } from "../finance/accountSnapshot";
import { productContextSchema, type ChatRequest, type FinancialIntent, type ToolResult } from "./schemas";

export const awaitingSchema = z.enum(["none", "income_type", "payday", "price", "horizon", "contribution", "priority"]);
export type Awaiting = z.infer<typeof awaitingSchema>;
const stateSchema = z.object({
  version: z.literal(1), scope: z.string().length(64), expires: z.number(),
  product: productContextSchema.nullable(), pendingProductName: z.string().max(200).nullable(),
  incomeContext: z.enum(["unknown", "none", "variable", "fixed"]), awaiting: awaitingSchema,
  askedTopics: z.array(awaitingSchema).max(8).default([]),
  lastOperation: z.string().max(40).nullable(), previousReply: z.string().max(1800), previousQuestion: z.string().max(300),
  userTurns: z.array(z.string().max(600)).max(5),
}).strict();
export type ConversationState = z.infer<typeof stateSchema>;
const ephemeralSecret = randomBytes(32).toString("hex");
function secret() { return process.env.CHAT_CONTEXT_SECRET || process.env.GEMINI_API_KEY || ephemeralSecret; }
function scopeFor(identity: string, request: ChatRequest) { return createHash("sha256").update(`${identity}:${request.mode}:${request.demoProfileId ?? ""}`).digest("hex"); }

/** Signed dialogue is conversational context only; every financial value is recalculated from the current account. */
export function readConversation(identity: string, request: ChatRequest): ConversationState {
  const scope = scopeFor(identity, request);
  if (!request.conversationToken) return { version: 1, scope, expires: Date.now() + 1800000,
    product: request.product, pendingProductName: request.pendingProductName ?? null,
    incomeContext: "unknown", awaiting: "none", askedTopics: [], lastOperation: null, previousReply: "", previousQuestion: "", userTurns: request.history.slice(-5).map(turn => turn.content.slice(0, 600)) };
  try {
    const [payload, signature, extra] = request.conversationToken.split(".");
    if (!payload || !signature || extra) throw Error();
    const expected = createHmac("sha256", secret()).update(payload).digest();
    const supplied = Buffer.from(signature, "base64url");
    if (supplied.length !== expected.length || !timingSafeEqual(expected, supplied)) throw Error();
    const state = stateSchema.parse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
    if (state.scope !== scope || state.expires <= Date.now()) throw Error();
    return state;
  } catch { throw new EvaluationRequestError("El contexto de la conversación cambió o expiró. Inicia una conversación nueva.", 409, "conversation_changed"); }
}

export function effectiveConversationRequest(request: ChatRequest, state: ConversationState): ChatRequest {
  return { ...request, product: state.product, pendingProductName: state.pendingProductName ?? undefined,
    history: state.userTurns.map(content => ({ role: "user", content })) };
}

export function userIncomeStatement(message: string): Exclude<ConversationState["incomeContext"], "unknown"> | null {
  // Questions and hypothetical scenarios are not declarations about the user's current income.
  const unasked = message.replace(/¿[^?]*(?:\?|$)/g, " ");
  for (const match of unasked.matchAll(/([^.!?\n]+)([.!?\n]|$)/g)) {
    if (match[2] === "?") continue;
    const text = match[1].normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
      .replace(/^si\s*[,;:]\s*/, "")
      .replace(/^(?:(?:actualmente|ahora(?: mismo)?|por ahora|de momento|pues|entendido)[,:]?\s+|(?:te )?confirmo que\s+|quiero aclarar que\s+)*/, "");
    if (/\b(?:si|supongamos|suponiendo|imagina|imaginemos|hipoteticamente|en caso de|que pasa|que pasaria|tuviera|tuviese|recibiera|en (?:este|ese|un) escenario|(?:en|para) (?:esta|esa|una) simulacion)\b/.test(text)) continue;
    if (/^(?:mis ingresos(?: actualmente| ahora)? (?:son variables|varian|cambian|no son (?:fijos|estables|regulares))|(?:tengo|recibo|percibo|cuento con) (?:ingresos? variables?|un ingreso variable)|no (?:tengo|recibo|percibo|cuento con|dispongo de) (?:un )?(?:ingresos?|salarios?|sueldos?) (?:fijos?|estables?|regulares?))\b/.test(text)
      || /^(?:son )?(?:ingresos? )?variables?[.!\s]*$/.test(text)) return "variable";
    if (/^(?:no (?:tengo|recibo|percibo|cuento con|dispongo de) (?:(?:ningun|ningunos) )?ingresos?|(?:estoy|me encuentro) sin ingresos?)\b/.test(text)
      || /^sin ingresos?[.!\s]*$/.test(text)) return "none";
    if (/^(?:mis ingresos(?: actualmente| ahora)? son fijos|(?:tengo|recibo|percibo|cuento con) (?:ingresos? fijos?|un (?:ingreso|salario|sueldo) fijo)|mi (?:salario|sueldo) es fijo|mi nomina es fija)\b/.test(text)
      || /^(?:son )?(?:ingresos? )?fijos?[.!\s]*$/.test(text)) return "fixed";
  }
  return null;
}

export function isConfirmation(message: string) {
  const text = message.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[.!]/g, "").trim();
  return /^(?:si(?:,? (?:estan|los datos estan|mis datos estan|todo esta|ya estan) actualizad[oa]s?)?|correcto|asi es|confirmo|estan actualizados|todo esta actualizado|ya los actualice)$/.test(text);
}

export function applyDialogueIntent(intent: FinancialIntent, request: ChatRequest, state: ConversationState): FinancialIntent {
  const income = userIncomeStatement(request.message);
  if (income) return { ...intent, operation: "income_update", incomeStatement: income, price: null };
  if (intent.operation === "income_update" && !income) intent = { ...intent, incomeStatement: null };
  if (isConfirmation(request.message)) return { ...intent, operation: "confirmation", price: null };
  if (intent.operation === "follow_up") {
    const previous = ["purchase", "available", "savings", "compare", "wait", "priorities", "goal", "overview", "reserve", "commitments"].includes(state.lastOperation ?? "") ? state.lastOperation : "clarify";
    return { ...intent, operation: previous as FinancialIntent["operation"] };
  }
  return intent;
}

export function signConversation(state: ConversationState, request: ChatRequest, tool: ToolResult, reply: string,
  followUp: { kind: string; text: string } | null): string {
  const income = userIncomeStatement(request.message);
  const awaiting = awaitingSchema.safeParse(followUp?.kind ?? "none");
  const next: ConversationState = { ...state, expires: Date.now() + 1800000,
    product: tool.product, pendingProductName: tool.product ? null : tool.facts.some(f => f.id === "missing.price") ? request.pendingProductName ?? null : state.pendingProductName,
    incomeContext: income ?? state.incomeContext, awaiting: awaiting.success ? awaiting.data : "none",
    askedTopics: [...new Set([...(state.askedTopics ?? []), ...(followUp && awaiting.success ? [awaiting.data] : [])])].slice(-8),
    lastOperation: ["confirmation", "income_update", "clarify"].includes(tool.operation) ? state.lastOperation : tool.operation,
    previousReply: reply.slice(0, 1800), previousQuestion: followUp?.text.slice(0, 300) ?? "",
    userTurns: [...state.userTurns, request.message.slice(0, 600)].slice(-5),
  };
  const payload = Buffer.from(JSON.stringify(next)).toString("base64url");
  return `${payload}.${createHmac("sha256", secret()).update(payload).digest("base64url")}`;
}
