export { mapFinancialProfile, mapSupabaseRecord, hasCompleteFinancialData } from "./financialMapper";
export { getDemoProfile } from "./demoProfiles";
export {
  InvalidDemoProfileError,
  isMissingSupabaseSessionError,
  resolveEvaluationProfile,
} from "./evaluationProfile";
export { calculateSafeToSpend } from "@/lib/onboarding/financialEngine";
export { evaluatePurchase } from "@/lib/onboarding/purchaseDecision";
export { buildPurchaseReport } from "@/lib/onboarding/purchaseReport";
export { projectSixWeeks } from "@/lib/onboarding/weeklyProjection";
export { calculateGoalImpact } from "@/lib/onboarding/goalImpact";
