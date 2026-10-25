import { getDemoProfile } from "./demoProfiles";
import type { OnboardingProfile } from "../onboarding/financialTypes";

export interface EvaluationProfileRequest {
  mode?: unknown;
  demoProfileId?: unknown;
}

export class InvalidDemoProfileError extends Error {
  constructor() {
    super("El perfil demo solicitado no está disponible.");
    this.name = "InvalidDemoProfileError";
  }
}

export function isMissingSupabaseSessionError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AuthSessionMissingError"
  );
}

export async function resolveEvaluationProfile(
  request: EvaluationProfileRequest,
  loadAccountProfile: () => Promise<OnboardingProfile>,
): Promise<OnboardingProfile> {
  if (request.mode === "demo") {
    const profile = getDemoProfile(request.demoProfileId);
    if (!profile) throw new InvalidDemoProfileError();
    return profile;
  }

  return loadAccountProfile();
}
