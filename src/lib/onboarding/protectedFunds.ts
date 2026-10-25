import type { OnboardingProfile } from "./financialTypes";

// Keep the existing emergency-buffer overlap rule in one place.
export function protectedSavingsCents(profile: OnboardingProfile): number | null {
  if (profile.safetyBuffer === null) return null;
  const goals = [...(profile.goals ?? []), ...(profile.primaryGoal ? [profile.primaryGoal] : [])];
  const seen = new Map<string, string>();
  let savings = 0;
  let emergencySavings = 0;
  for (const goal of goals) {
    const signature = JSON.stringify(goal);
    if (seen.has(goal.id)) {
      if (seen.get(goal.id) !== signature) return null;
      continue;
    }
    seen.set(goal.id, signature);
    if (goal.currentSaved === null || goal.targetAmount === null ||
      !Number.isFinite(goal.currentSaved) || goal.currentSaved < 0 ||
      (goal.currentSaved > 0 && !["incluido", "separado"].includes(goal.savingsLocation))) return null;
    if (goal.savingsLocation !== "incluido") continue;
    const cents = Math.round(goal.currentSaved * 100);
    if (goal.category === "emergencia") emergencySavings += cents;
    else savings += cents;
  }
  return savings + Math.max(0, emergencySavings - Math.round(profile.safetyBuffer * 100));
}
