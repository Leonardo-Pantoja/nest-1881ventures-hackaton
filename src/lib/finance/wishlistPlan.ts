import { z } from "zod";
import { validPurchasePrice } from "./money";
import { calculateSavingsTarget } from "./conversationalMath";

const money = z.number().refine(validPurchasePrice, "Indica un importe positivo en MXN con hasta dos decimales.");
export const wishlistPlanSchema = z.object({
  name: z.string().trim().min(1).max(180),
  price: money,
  strategy: z.enum(["wait", "microsave"]),
  plannedWeeklySave: money.optional(),
  planWeeks: z.number().int().min(1).max(520).optional(),
  cooldownDays: z.number().int().min(1).max(365).optional(),
}).strict().superRefine((item, context) => {
  if (item.strategy === "microsave" && item.plannedWeeklySave === undefined)
    context.addIssue({ code: "custom", message: "Configura la aportación semanal del plan.", path: ["plannedWeeklySave"] });
  if (item.strategy === "wait" && (item.plannedWeeklySave !== undefined || item.planWeeks !== undefined))
    context.addIssue({ code: "custom", message: "La estrategia de espera no configura aportaciones." });
});
export type WishlistPlanInput = z.infer<typeof wishlistPlanSchema>;

/** Price is part of identity: a similarly named product at another price is a separate selection. */
export function wishlistProductKey(item: { name: string; price: number }): string {
  return JSON.stringify([item.name.trim().replace(/\s+/g, " ").toLowerCase(), Math.round(item.price * 100)]);
}

export function wishlistPlanMath(price: number, mode: "weeks" | "contribution", value: number, savedAmount = 0) {
  return calculateSavingsTarget(price, { upfrontAmount: savedAmount,
    ...(mode === "weeks" ? { weeks: value } : { weeklyContribution: value }) });
}
