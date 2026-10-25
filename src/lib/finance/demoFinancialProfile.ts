import { getDemoProfile } from "./demoProfiles";
import { mapFinancialProfile } from "./financialMapper";

// Supply metadata only for known demo records; custom obligations stay unknown.
export function mapDemoFinancialProfile(input: unknown) {
  if (!input || typeof input !== "object") return null;
  const ui = input as Record<string, unknown>;
  const base = getDemoProfile(ui.id);
  if (!base) return mapFinancialProfile(ui);
  const goal = ui.goal && typeof ui.goal === "object" ? ui.goal as Record<string, unknown> : {};
  const commitments = Array.isArray(ui.commitments) ? ui.commitments.map(item => {
    const record = item as Record<string, unknown>;
    const known = base.commitments.find(payment => payment.title === record.title) ?? base.debts.find(payment => payment.title === record.title);
    return { ...record, frequency: record.frequency ?? known?.frequency };
  }) : [];
  return mapFinancialProfile({ ...ui, commitments, goal: { ...goal, id: base.primaryGoal?.id, category: base.primaryGoal?.category,
    savings_location: goal.savings_location ?? base.primaryGoal?.savingsLocation } });
}
