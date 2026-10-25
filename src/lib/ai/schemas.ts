import { z } from "zod";

const money = z.number().finite().min(0.01).max(999_999_999).multipleOf(0.01);
export const productContextSchema = z.object({ name: z.string().trim().min(1).max(200), price: money }).strict();
export const chatRequestSchema = z.object({
  requestId: z.uuid(),
  message: z.string().trim().min(1).max(1500),
  // Previous financial answers are never accepted as financial evidence.
  history: z.array(z.object({ role: z.literal("user"), content: z.string().trim().min(1).max(1500) }).strict()).max(10).default([]),
  product: productContextSchema.nullable().default(null),
  mode: z.enum(["account", "demo"]).default("account"),
  demoProfileId: z.enum(["mateo", "carlos"]).optional(),
  deterministicOnly: z.boolean().default(false),
}).strict();
export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ProductContext = z.infer<typeof productContextSchema>;

/** An allowlisted tool request, never executable code or a financial profile. */
export const intentSchema = z.object({
  operation: z.enum(["purchase", "available", "savings", "compare", "wait", "priorities", "goal", "overview", "reserve", "withdraw_goal", "clarify"]),
  productName: z.string().max(200).nullable(),
  price: money.nullable(),
  alternativePrice: money.nullable(),
  weeks: z.number().int().min(1).max(520).nullable(),
  weeklyContribution: money.nullable(),
  upfrontAmount: money.nullable(),
  reserveAmount: money.nullable(),
  goalQuery: z.string().max(200).nullable(),
}).strict();
export type FinancialIntent = z.infer<typeof intentSchema>;

export const explanationSchema = z.object({
  factIds: z.array(z.string().min(1).max(80)).min(1).max(24),
  followUp: z.enum(["savings", "compare", "update", "priority", "price", "contribution"]),
}).strict();
export type Explanation = z.infer<typeof explanationSchema>;
export interface FinancialFact { id: string; text: string; required: boolean }
export interface FinancialCard { label: string; value: number; unit: "MXN" | "semanas" | "días" }
export interface ToolResult {
  operation: FinancialIntent["operation"];
  product: ProductContext | null;
  facts: FinancialFact[];
  cards: FinancialCard[];
  report?: import("../onboarding/purchaseReport").PurchaseReport;
  savings?: import("../finance/savingsPlan").SavingsPlan;
}
export interface ChatResponse {
  reply: string;
  source: "gemini" | "deterministic";
  product: ProductContext | null;
  cards: FinancialCard[];
  report?: ToolResult["report"];
  savings?: ToolResult["savings"];
  financialRevision: string;
  warning?: string;
  code?: string;
  quality?: { score: number; verdict: string };
}
