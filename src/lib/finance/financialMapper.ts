import type {
  Commitment,
  CommitmentFrequency,
  Debt,
  FinancialGoal,
  OnboardingProfile,
  PayFrequency,
  SavingsLocation,
} from "../onboarding/financialTypes";

export const FINANCIAL_TIME_ZONE = "America/Mexico_City";

type DataRecord = Record<string, unknown>;

function asRecord(value: unknown): DataRecord | null {
  return typeof value === "object" && value !== null
    ? (value as DataRecord)
    : null;
}

function asArray(value: unknown): DataRecord[] {
  return Array.isArray(value)
    ? value.map(asRecord).filter((item): item is DataRecord => item !== null)
    : [];
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "number" && typeof value !== "string") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizePayFrequency(value: unknown): PayFrequency {
  switch (value) {
    case "weekly":
    case "semanal":
      return "semanal";
    case "biweekly":
    case "quincenal":
      return "quincenal";
    case "monthly":
    case "mensual":
      return "mensual";
    default:
      return "variable";
  }
}

function normalizeFrequency(value: unknown): CommitmentFrequency | null {
  switch (value) {
    case "one_time":
    case "one-time":
    case "unico":
      return "unico";
    case "weekly":
    case "semanal":
      return "semanal";
    case "biweekly":
    case "quincenal":
      return "quincenal";
    case "monthly":
    case "mensual":
      return "mensual";
    default:
      return null;
  }
}

function normalizeGoalCategory(value: unknown): FinancialGoal["category"] {
  const text = (stringOrNull(value) ?? "").toLowerCase();
  if (/emergencia|seguridad|reserva/.test(text)) return "emergencia";
  if (/deuda|credito|tarjeta|prestamo/.test(text)) return "deuda";
  if (/compra|laptop|tenis|celular|audifonos|vehiculo|auto/.test(text)) return "compra";
  if (/ahorro|meta/.test(text)) return "ahorro";
  if (/inversion/.test(text)) return "inversion";
  if (/proteccion/.test(text)) return "proteccion";
  return "otro";
}

function normalizeSavingsLocation(value: unknown): SavingsLocation {
  if (value === "incluido" || value === "separado" || value === "desconocido") {
    return value;
  }
  return "desconocido";
}

function datePartsInMexico(value: unknown): [number, number, number] | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (dateOnly) {
    const parts = dateOnly.slice(1).map(Number) as [number, number, number];
    const parsed = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    if (
      parsed.getUTCFullYear() !== parts[0] ||
      parsed.getUTCMonth() + 1 !== parts[1] ||
      parsed.getUTCDate() !== parts[2]
    ) {
      return null;
    }
    return parts;
  }

  // Timestamp values are converted to calendar dates in Mexico City.
  const timestamp = new Date(value);
  if (!Number.isFinite(timestamp.getTime())) return null;
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone: FINANCIAL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(timestamp);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(formatted);
  return match
    ? (match.slice(1).map(Number) as [number, number, number])
    : null;
}

function daysBetweenCalendarDates(
  value: unknown,
  now: Date,
): number | null {
  const target = datePartsInMexico(value);
  const today = datePartsInMexico(now.toISOString());
  if (!target || !today) return null;

  const targetDay = Date.UTC(target[0], target[1] - 1, target[2]);
  const todayDay = Date.UTC(today[0], today[1] - 1, today[2]);
  const days = Math.round((targetDay - todayDay) / 86_400_000);
  return days < 0 ? null : days;
}

function nextDateFromSources(
  sources: DataRecord[],
  now: Date,
): { days: number | null; amount: number | null; frequency: PayFrequency } {
  const orderedSources = [...sources].sort((left, right) => {
    const leftDays = daysBetweenCalendarDates(left.next_payment_date, now);
    const rightDays = daysBetweenCalendarDates(right.next_payment_date, now);
    return (leftDays ?? Number.MAX_SAFE_INTEGER) -
      (rightDays ?? Number.MAX_SAFE_INTEGER);
  });

  if (orderedSources.length !== 1) {
    return { days: null, amount: null, frequency: "variable" };
  }

  const source = orderedSources[0];
  return {
    days: daysBetweenCalendarDates(source.next_payment_date, now),
    amount: numberOrNull(source.amount),
    frequency: normalizePayFrequency(source.frequency),
  };
}

function mapGoal(record: DataRecord): FinancialGoal {
  const title = stringOrNull(record.title) ?? "Meta financiera";
  return {
    id: stringOrNull(record.id) ?? "goal",
    title,
    category: normalizeGoalCategory(record.category ?? title),
    targetAmount: numberOrNull(record.target_amount ?? record.targetAmount),
    currentSaved: numberOrNull(record.current_saved ?? record.currentSaved),
    targetDate: stringOrNull(record.target_date) ?? undefined,
    weeklyContribution: numberOrNull(
      record.weekly_contribution ?? record.weeklyContribution,
    ),
    savingsLocation: normalizeSavingsLocation(record.savings_location ?? record.savingsLocation),
  };
}

function isDebtRecord(record: DataRecord): boolean {
  const explicitKind = stringOrNull(record.kind)?.toLowerCase();
  if (explicitKind === "deuda" || explicitKind === "debt") return true;
  const category = (stringOrNull(record.category) ?? "").toLowerCase();
  return category === "deuda" || category === "debt";
}

function mapCommitments(
  records: DataRecord[],
  now: Date,
): {
  commitments: Commitment[];
  debts: Debt[];
} {
  const commitments: Commitment[] = [];
  const debts: Debt[] = [];
  const seenIds = new Set<string>();

  for (const record of records) {
    const id = stringOrNull(record.id);
    if (id && seenIds.has(id)) continue;
    if (id) seenIds.add(id);

    const title = stringOrNull(record.title) ?? "Compromiso";
    const amount = numberOrNull(record.amount);
    const dueInDays =
      Number.isInteger(record.dueInDays) && Number(record.dueInDays) >= 0
        ? Number(record.dueInDays)
        : daysBetweenCalendarDates(record.next_due_date, now);
    const frequency = normalizeFrequency(record.frequency);
    const category = stringOrNull(record.category) ?? "Otros";

    if (isDebtRecord(record)) {
      debts.push({
        id: id ?? `${title}-${debts.length}`,
        title,
        totalBalance: numberOrNull(record.total_balance),
        nextPayment: amount,
        dueInDays,
        frequency,
      });
      continue;
    }

    commitments.push({
      id: id ?? `${title}-${commitments.length}`,
      title,
      amount,
      dueInDays,
      category,
      frequency,
      kind: "otro",
      isConfirmed:
        typeof record.is_confirmed === "boolean"
          ? record.is_confirmed
          : true,
    });
  }

  return { commitments, debts };
}

export function mapFinancialProfile(
  input: unknown,
  now = new Date(),
): OnboardingProfile | null {
  const profile = asRecord(input);
  if (!profile) return null;

  const uiGoal = asRecord(profile.goal ?? profile.primaryGoal);
  const goal = uiGoal ? mapGoal(uiGoal) : undefined;
  const mappedPayments = mapCommitments(asArray(profile.commitments), now);
  const tags = Array.isArray(profile.lifeContext)
    ? profile.lifeContext.filter(
        (tag): tag is OnboardingProfile["lifeContext"][number] =>
          ["estudio", "trabajo", "independiente", "dependientes"].includes(
            String(tag),
          ),
      )
    : [];
  const dayValue = profile.nextPaydayDays;

  return {
    id: stringOrNull(profile.id) ?? "profile",
    name: stringOrNull(profile.name) ?? undefined,
    lifeContext: tags,
    currentBalance: numberOrNull(profile.currentBalance),
    payFrequency: normalizePayFrequency(profile.payFrequency),
    nextPaydayAmount: numberOrNull(profile.nextPaydayAmount),
    nextPaydayDays:
      Number.isInteger(dayValue) && Number(dayValue) >= 0
        ? Number(dayValue)
        : null,
    dailyEssentialBurn: numberOrNull(profile.dailyEssentialBurn),
    commitments: mappedPayments.commitments,
    debts: mappedPayments.debts,
    safetyBuffer: numberOrNull(profile.safetyBuffer),
    primaryGoal: goal,
    isOnboarded: profile.isOnboarded === true,
  };
}

export function mapSupabaseRecord(
  data: {
    profile: unknown;
    incomeSources: unknown[];
    commitments: unknown[];
    goals: unknown[];
  },
  now = new Date(),
): OnboardingProfile | null {
  const profile = asRecord(data.profile);
  if (!profile) return null;

  const activeIncomeSources = asArray(data.incomeSources);
  const income = nextDateFromSources(activeIncomeSources, now);
  const payments = mapCommitments(asArray(data.commitments), now);
  const goals = asArray(data.goals).map(mapGoal).sort((a, b) => a.id.localeCompare(b.id));
  const tags = Array.isArray(profile.lifestyle_tags)
    ? profile.lifestyle_tags.filter(
        (tag): tag is OnboardingProfile["lifeContext"][number] =>
          ["estudio", "trabajo", "independiente", "dependientes"].includes(
            String(tag),
          ),
      )
    : [];

  return {
    id: stringOrNull(profile.id) ?? "profile",
    name: stringOrNull(profile.display_name) ?? undefined,
    lifeContext: tags,
    currentBalance: numberOrNull(profile.current_balance),
    payFrequency: income.frequency,
    nextPaydayAmount: income.amount,
    nextPaydayDays: income.days,
    dailyEssentialBurn: numberOrNull(profile.daily_essential_budget),
    commitments: payments.commitments,
    debts: payments.debts,
    safetyBuffer: numberOrNull(profile.safety_buffer),
    primaryGoal: goals[0],
    goals,
    isOnboarded: Boolean(profile.onboarding_completed_at),
  };
}

export function hasCompleteFinancialData(profile: unknown): boolean {
  const mapped = mapFinancialProfile(profile);
  return Boolean(
    mapped?.isOnboarded &&
      mapped.currentBalance !== null &&
      mapped.safetyBuffer !== null &&
      mapped.dailyEssentialBurn !== null &&
      mapped.nextPaydayDays !== null,
  );
}
