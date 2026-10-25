import type {
  Commitment,
  CommitmentFrequency,
  Debt,
  FinancialGoal,
  OnboardingProfile,
  PayFrequency,
  RegisteredIncomeSource,
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
  if (typeof value === "string" && !value.trim()) return null;
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
  const text = value.trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);

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

  // Only unambiguous ISO timestamps with a valid calendar date and explicit offset are accepted.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/i.test(text) || !datePartsInMexico(text.slice(0, 10))) return null;
  // Timestamp values are converted to calendar dates in Mexico City.
  const timestamp = new Date(text);
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

function financialDateDetails(value: unknown, now: Date): {
  date: string | null;
  days: number | null;
  status: RegisteredIncomeSource["dateStatus"];
} {
  if (value === null || value === undefined || value === "" || typeof value === "string" && !value.trim()) {
    return { date: null, days: null, status: "missing" };
  }
  const target = datePartsInMexico(value);
  const today = datePartsInMexico(now.toISOString());
  if (!target || !today) return { date: null, days: null, status: "invalid" };
  const difference = Math.round((Date.UTC(target[0], target[1] - 1, target[2]) - Date.UTC(today[0], today[1] - 1, today[2])) / 86_400_000);
  const date = `${String(target[0]).padStart(4, "0")}-${String(target[1]).padStart(2, "0")}-${String(target[2]).padStart(2, "0")}`;
  return { date, days: difference < 0 ? null : difference, status: difference < 0 ? "overdue" : "known" };
}

function nextDateFromSources(
  records: DataRecord[],
  now: Date,
): { days: number | null; amount: number | null; frequency: PayFrequency; sources: RegisteredIncomeSource[]; warnings: string[] } {
  const warnings = new Set<string>();
  const sources = records.map((record): RegisteredIncomeSource => {
    const date = financialDateDetails(record.next_payment_date, now);
    const amount = numberOrNull(record.amount);
    const frequency = normalizePayFrequency(record.frequency);
    if (date.status !== "known") warnings.add(`income_date_${date.status}`);
    if (amount === null) warnings.add("income_amount_unknown");
    if (frequency === "variable" && record.frequency !== "variable") warnings.add("income_frequency_unknown");
    return { amount, frequency, nextPaymentDate: date.date, nextPaymentDays: date.days, dateStatus: date.status };
  });
  if (!sources.length) {
    return { days: null, amount: null, frequency: "variable", sources, warnings: ["income_sources_missing"] };
  }
  if (sources.length === 1) {
    const source = sources[0];
    return { days: source.nextPaymentDays, amount: source.amount, frequency: source.frequency, sources, warnings: [...warnings] };
  }

  // A missing or overdue date prevents identifying the actual next recorded income.
  // Keep all amounts visible in source metadata rather than selecting an arbitrary row.
  if (sources.some(source => source.nextPaymentDays === null)) {
    warnings.add("multiple_income_calendars");
    return { days: null, amount: null, frequency: "variable", sources, warnings: [...warnings] };
  }
  const days = Math.min(...sources.map(source => source.nextPaymentDays!));
  const nextSources = sources.filter(source => source.nextPaymentDays === days);
  const nextAmounts = nextSources.map(source => source.amount === null ? null : Math.round(source.amount * 100));
  const amountCents = nextAmounts.every(amount => amount !== null && Number.isSafeInteger(amount))
    ? nextAmounts.reduce<number>((total, amount) => total + amount!, 0)
    : null;
  const amount = amountCents !== null && Number.isSafeInteger(amountCents) ? amountCents / 100 : null;
  if (amount === null) warnings.add("income_amount_unknown");
  // Only synchronized schedules can be represented as a single repeated paycheck.
  const synchronized = sources.every(source => source.nextPaymentDays === days && source.frequency === sources[0].frequency && source.amount !== null);
  const frequency = synchronized ? sources[0].frequency : "variable";
  if (!synchronized) warnings.add("multiple_income_calendars");
  return { days, amount, frequency, sources, warnings: [...warnings] };
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
  warnings: string[];
} {
  const commitments: Commitment[] = [];
  const debts: Debt[] = [];
  const seenIds = new Set<string>();
  const warnings = new Set<string>();

  for (const record of records) {
    const id = stringOrNull(record.id);
    if (id && seenIds.has(id)) continue;
    if (id) seenIds.add(id);

    const title = stringOrNull(record.title) ?? "Compromiso";
    const amount = numberOrNull(record.amount);
    const frequency = normalizeFrequency(record.frequency);
    const explicitDays = Number.isInteger(record.dueInDays) && Number(record.dueInDays) >= 0 ? Number(record.dueInDays) : null;
    const dueDate = financialDateDetails(record.next_due_date, now);
    const debt = isDebtRecord(record);
    // An active overdue one-time payment remains due; recurring arrears need confirmation.
    const dueInDays = explicitDays ?? (dueDate.status === "overdue" && frequency === "unico" ? 0 : dueDate.days);
    if (explicitDays === null && dueDate.status !== "known") {
      warnings.add(dueDate.status === "overdue" ? debt ? "overdue_debt" : "overdue_commitment"
        : `${debt ? "debt" : "commitment"}_date_${dueDate.status}`);
    }
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

  return { commitments, debts, warnings: [...warnings] };
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

  const activeIncomeSources = asArray(data.incomeSources).filter(source => source.is_active !== false);
  const income = nextDateFromSources(activeIncomeSources, now);
  const payments = mapCommitments(asArray(data.commitments).filter(payment => payment.is_active !== false), now);
  const goals = asArray(data.goals).filter(goal => goal.is_active !== false).map(mapGoal).sort((a, b) => a.id.localeCompare(b.id));
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
    incomeSources: income.sources,
    dataWarnings: [...new Set([...income.warnings, ...payments.warnings])],
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
