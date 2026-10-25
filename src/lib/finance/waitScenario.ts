import type { OnboardingProfile, CommitmentFrequency } from "../onboarding/financialTypes";
import { calculateSafeToSpend } from "../onboarding/financialEngine";
import { withGoalContributions } from "./savingsPlan";

/** Advance only a known single fixed income and known weekly/biweekly/one-time obligations.
 * Expenses up to that day come from Sebas' engine, including payments due today. */
export function profileAtNextIncome(profile: OnboardingProfile): OnboardingProfile | null {
  const reserved = withGoalContributions(profile);
  const days = profile.nextPaydayDays;
  if (!reserved || days === null || days < 1 || days > 42 || profile.nextPaydayAmount === null ||
      !["semanal", "quincenal"].includes(profile.payFrequency) || profile.currentBalance === null) return null;
  const payments = [...profile.commitments, ...profile.debts];
  if (payments.some(p => p.frequency === "mensual" || p.frequency === null || p.dueInDays === null)) return null;
  const safe = calculateSafeToSpend(reserved);
  if (safe.status !== "calculado" || safe.essentialExpenses === null || safe.pendingCommitments === null || safe.pendingDebtPayments === null) return null;
  const nextBalance = Math.round(profile.currentBalance * 100) + Math.round(profile.nextPaydayAmount * 100) -
    Math.round(safe.essentialExpenses * 100) - Math.round(safe.pendingCommitments * 100) - Math.round(safe.pendingDebtPayments * 100);
  if (nextBalance < 0) return null;
  function nextDue(due: number, frequency: CommitmentFrequency): number {
    const interval = frequency === "semanal" ? 7 : 14;
    return due > days! ? due - days! : due + (Math.floor((days! - due) / interval) + 1) * interval - days!;
  }
  const keep = (p: { frequency: CommitmentFrequency | null; dueInDays: number | null }) => !(p.frequency === "unico" && p.dueInDays! <= days!);
  return { ...profile, currentBalance: nextBalance / 100, nextPaydayDays: profile.payFrequency === "semanal" ? 7 : 14,
    commitments: profile.commitments.filter(keep).map(p => ({ ...p, dueInDays: nextDue(p.dueInDays!, p.frequency!) })),
    debts: profile.debts.filter(keep).map(p => ({ ...p, dueInDays: nextDue(p.dueInDays!, p.frequency!) })),
  };
}
