"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Compass,
  ArrowLeft,
  ArrowRight,
  GraduationCap,
  Briefcase,
  Home,
  Users,
  CheckCircle2,
  Sparkles,
  Laptop,
  Plane,
  ShieldCheck,
  Car,
  Zap,
  Award,
  HandHeart,
  Plus,
  Trash2,
} from "lucide-react";
import {
  useFinancial,
  type LifeContextTag,
  type PayFrequency,
  type Commitment,
} from "@/context/FinancialContext";
import FinancialPlantWidget, {
  type PlantLevel,
} from "@/components/FinancialPlantWidget";
import { playTap, playCoin, playLevelUp } from "@/lib/soundEffects";
import {
  saveOnboardingToSupabase,
  type OnboardingInput,
} from "@/lib/onboarding/saveOnboarding";

const TOTAL_STEPS = 4;

const LIFE_CONTEXT_CARDS: {
  id: LifeContextTag;
  emoji: string;
  title: string;
  tag: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  cardStyle: string;
}[] = [
  {
    id: "estudio",
    emoji: "🎒",
    title: "Estudio",
    tag: "Uni / Beca",
    icon: GraduationCap,
    cardStyle:
      "border-sky-300 border-b-sky-500 bg-gradient-to-b from-white to-sky-50/60 text-slate-900",
  },
  {
    id: "trabajo",
    emoji: "💼",
    title: "Trabajo",
    tag: "Nómina / Freelance",
    icon: Briefcase,
    cardStyle:
      "border-emerald-300 border-b-emerald-500 bg-gradient-to-b from-white to-emerald-50/60 text-slate-900",
  },
  {
    id: "independiente",
    emoji: "🏠",
    title: "Pago mi vivienda",
    tag: "Renta, hipoteca o casa",
    icon: Home,
    cardStyle:
      "border-amber-300 border-b-amber-500 bg-gradient-to-b from-white to-amber-50/60 text-slate-900",
  },
  {
    id: "dependientes",
    emoji: "🤝",
    title: "Mantengo a alguien",
    tag: "Familia o dependientes",
    icon: Users,
    cardStyle:
      "border-purple-300 border-b-purple-500 bg-gradient-to-b from-white to-purple-50/60 text-slate-900",
  },
  {
    id: "apoyo",
    emoji: "💚",
    title: "Recibo apoyo económico",
    tag: "Familia, pareja u otra persona",
    icon: HandHeart,
    cardStyle:
      "border-teal-300 border-b-teal-500 bg-gradient-to-b from-white to-teal-50/60 text-slate-900",
  },
];

const QUINCENA_LEVEL_TIERS = [
  {
    id: "tier-1500",
    emoji: "🪙",
    label: "$1,500",
    tag: "Ejemplo rápido",
    currentBalance: 1500,
    cardStyle:
      "border-amber-300 border-b-amber-500 bg-gradient-to-b from-white to-amber-50/70",
  },
  {
    id: "tier-3000",
    emoji: "💰",
    label: "$3,000",
    tag: "Ejemplo rápido",
    currentBalance: 3000,
    cardStyle:
      "border-emerald-300 border-b-emerald-600 bg-gradient-to-b from-white to-emerald-50/70",
  },
  {
    id: "tier-5000",
    emoji: "💎",
    label: "$5,000+",
    tag: "Ejemplo rápido",
    currentBalance: 5500,
    cardStyle:
      "border-teal-300 border-b-teal-600 bg-gradient-to-b from-white to-teal-50/70",
  },
];

type CommitmentSuggestion = {
  id: string;
  emoji: string;
  title: string;
  category: string;
  suggestedFor?: LifeContextTag[];
  cardStyle: string;
};

// Suggestions are never automatically added to the user's expenses.
const QUICK_COMMITMENT_CARDS: CommitmentSuggestion[] = [
  {
    id: "celular",
    emoji: "📱",
    title: "Celular / Internet",
    category: "Servicios",
    cardStyle: "border-sky-300 border-b-sky-500 bg-gradient-to-b from-white to-sky-50/70",
  },
  {
    id: "transporte",
    emoji: "🚌",
    title: "Transporte",
    category: "Transporte",
    suggestedFor: ["estudio", "trabajo"],
    cardStyle: "border-amber-300 border-b-amber-500 bg-gradient-to-b from-white to-amber-50/70",
  },
  {
    id: "escuela",
    emoji: "📚",
    title: "Gastos escolares",
    category: "Educación",
    suggestedFor: ["estudio"],
    cardStyle: "border-blue-300 border-b-blue-500 bg-gradient-to-b from-white to-blue-50/70",
  },
  {
    id: "deuda",
    emoji: "💳",
    title: "Tarjeta o préstamo",
    category: "Deuda",
    cardStyle: "border-orange-300 border-b-orange-500 bg-gradient-to-b from-white to-orange-50/70",
  },
  {
    id: "renta",
    emoji: "🏡",
    title: "Renta / Hipoteca",
    category: "Vivienda",
    suggestedFor: ["independiente"],
    cardStyle: "border-rose-300 border-b-rose-500 bg-gradient-to-b from-white to-rose-50/70",
  },
  {
    id: "hogar",
    emoji: "💡",
    title: "Servicios del hogar",
    category: "Vivienda",
    suggestedFor: ["independiente"],
    cardStyle: "border-yellow-300 border-b-yellow-500 bg-gradient-to-b from-white to-yellow-50/70",
  },
  {
    id: "familia",
    emoji: "🤝",
    title: "Apoyo familiar",
    category: "Familia",
    suggestedFor: ["dependientes"],
    cardStyle: "border-purple-300 border-b-purple-500 bg-gradient-to-b from-white to-purple-50/70",
  },
  {
    id: "salud",
    emoji: "💊",
    title: "Salud / Medicinas",
    category: "Salud",
    cardStyle: "border-emerald-300 border-b-emerald-500 bg-gradient-to-b from-white to-emerald-50/70",
  },
  {
    id: "suscripciones",
    emoji: "🎬",
    title: "Suscripciones",
    category: "Suscripciones",
    cardStyle: "border-slate-300 border-b-slate-500 bg-gradient-to-b from-white to-slate-50/70",
  },
];

const GOAL_CARDS = [
  {
    id: "emergencia",
    emoji: "🛡️",
    title: "Fondo de paz",
    amount: 15000,
    icon: ShieldCheck,
    cardStyle:
      "border-emerald-300 border-b-emerald-600 bg-gradient-to-b from-white to-emerald-50/80",
  },
  {
    id: "laptop",
    emoji: "💻",
    title: "Laptop nueva",
    amount: 18000,
    icon: Laptop,
    cardStyle:
      "border-sky-300 border-b-sky-500 bg-gradient-to-b from-white to-sky-50/70",
  },
  {
    id: "viaje",
    emoji: "✈️",
    title: "Viaje con amigos",
    amount: 12000,
    icon: Plane,
    cardStyle:
      "border-amber-300 border-b-amber-500 bg-gradient-to-b from-white to-amber-50/70",
  },
  {
    id: "auto",
    emoji: "🚗",
    title: "Moto o Auto",
    amount: 35000,
    icon: Car,
    cardStyle:
      "border-purple-300 border-b-purple-500 bg-gradient-to-b from-white to-purple-50/70",
  },
];

const UNLOCKED_LEVEL_BADGES: {
  level: PlantLevel;
  emoji: string;
  name: string;
}[] = [
  { level: 1, emoji: "🌱", name: "1. Supervivencia 🌱" },
  { level: 2, emoji: "🌿", name: "2. Estabilidad 🌿" },
  { level: 3, emoji: "🪴", name: "3. Seguridad 🪴" },
  { level: 4, emoji: "🌳", name: "4. Libertad 🌳" },
  { level: 5, emoji: "✨", name: "5. Abundancia ✨" },
];

/**
 * Reactive Animated Plant Header that reacts and grows from Step 1 to Step 4
 */
function OnboardingReactivePlant({
  step,
  balancePreview,
}: {
  step: number;
  balancePreview: number;
}) {
  const moodEmoji =
    step === 1
      ? "🌱"
      : step === 2
        ? balancePreview >= 4500
          ? "💎"
          : balancePreview >= 2500
            ? "💰"
            : "🪙"
        : step === 3
          ? "🛡️"
          : "🌳";

  const stepBadgeText =
    step === 1
      ? "Semilla lista"
      : step === 2
        ? `Nutriendo +$${balancePreview.toLocaleString()}`
        : step === 3
          ? "Escudo activo"
          : "¡Casi florece!";

  return (
    <motion.div
      key={`plant-stage-${step}-${balancePreview}`}
      initial={{ scale: 0.92, opacity: 0.85 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 20 }}
      className="relative mx-auto flex flex-col items-center justify-center pt-1 pb-2"
    >
      <div className="relative w-28 h-24 flex items-center justify-center">
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.35, 0.65, 0.35] }}
          transition={{ duration: 2.6, repeat: Infinity }}
          className="absolute w-24 h-24 rounded-full bg-gradient-to-tr from-emerald-300/50 via-teal-200/40 to-amber-200/40 blur-lg"
        />

        <svg
          viewBox="0 0 140 120"
          className="w-full h-full overflow-visible drop-shadow-xs"
          aria-label="Tu planta financiera reaccionando"
        >
          {/* Shadow & Terracotta Pot */}
          <ellipse cx="70" cy="110" rx="34" ry="6" fill="#E2DCD3" />
          <path
            d="M46 80 L94 80 L87 107 C86 109 84 110 81 110 L59 110 C56 110 54 109 53 107 Z"
            fill="#D97757"
          />
          <rect x="42" y="74" width="56" height="8" rx="4" fill="#C86849" />
          <ellipse cx="70" cy="75" rx="24" ry="4" fill="#78350F" />

          {/* Animated Stem & Leaves growing with step */}
          <motion.g
            style={{ originX: "70px", originY: "75px" }}
            animate={{ rotate: [-2.5, 2.5, -2.5], y: [0, -2, 0] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          >
            {/* Base Sprout (Always visible) */}
            <path
              d={
                step === 1
                  ? "M70 75 Q70 60 70 54"
                  : step === 2
                    ? "M70 75 Q70 52 70 42"
                    : "M70 75 Q70 44 70 30"
              }
              stroke="#059669"
              strokeWidth="4.5"
              strokeLinecap="round"
              fill="none"
            />

            {/* Left & Right Sprout Leaves */}
            <path
              d="M70 60 C56 56 48 46 58 38 C65 34 70 48 70 60 Z"
              fill="#10B981"
            />
            <path
              d="M70 54 C84 50 92 40 82 32 C75 28 70 42 70 54 Z"
              fill="#34D399"
            />

            {/* Upper Leaves unlocked on Step >= 2 */}
            {step >= 2 && (
              <>
                <path
                  d="M70 44 C54 38 50 26 60 20 C68 16 70 32 70 44 Z"
                  fill="#059669"
                />
                <path
                  d="M70 42 C86 36 90 24 80 18 C72 14 70 30 70 42 Z"
                  fill="#10B981"
                />
              </>
            )}

            {/* Crown & Blossom unlocked on Step >= 3 */}
            {step >= 3 && <circle cx="70" cy="22" r="11" fill="#34D399" />}
            {step >= 4 && (
              <>
                <circle cx="62" cy="18" r="4.5" fill="#FBBF24" />
                <circle cx="78" cy="20" r="4.5" fill="#F472B6" />
              </>
            )}
          </motion.g>
        </svg>

        {/* Floating Reaction Pill */}
        <motion.span
          key={moodEmoji}
          initial={{ scale: 0.5, y: 6 }}
          animate={{ scale: 1, y: 0 }}
          className="absolute -top-1 right-1 w-7 h-7 rounded-full bg-white border-2 border-[#E6E1DA] shadow-xs flex items-center justify-center text-sm"
        >
          {moodEmoji}
        </motion.span>
      </div>

      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100/90 border border-emerald-300 px-3 py-0.5 text-[11px] font-bold font-heading text-emerald-950">
        <Sparkles className="w-3 h-3 text-emerald-700" strokeWidth={1.5} />
        {stepBadgeText}
      </span>
    </motion.div>
  );
}

export default function OnboardingWizardPage() {
  const router = useRouter();
  const { completeOnboarding } = useFinancial();

  const [step, setStep] = useState<number>(1);
  const [isUnlockedScreen, setIsUnlockedScreen] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Step 1: Multiple lifestyle choices. No automatic advancement.
  const [selectedLifeContext, setSelectedLifeContext] = useState<LifeContextTag[]>([]);

  // Step 2: Actual available balance and explicitly provided income information.
  const [selectedQuincenaAllowance, setSelectedQuincenaAllowance] = useState<number>(0);
  const [hasRegularIncome, setHasRegularIncome] = useState(true);
  const [payFrequency, setPayFrequency] = useState<PayFrequency>("semanal");
  const [nextPaydayDays, setNextPaydayDays] = useState<number>(7);
  const [nextPaydayAmount, setNextPaydayAmount] = useState<number>(0);

  // Step 3: Multiple editable commitments, including custom expenses.
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [showAllCommitments, setShowAllCommitments] = useState(false);
  const [customCommitmentTitle, setCustomCommitmentTitle] = useState("");
  const [commitmentsError, setCommitmentsError] = useState<string | null>(null);

  // Step 4: Meta principal (1 toque)
  const [selectedGoalTitle, setSelectedGoalTitle] =
    useState<string>("Fondo de paz");
  const [selectedGoalAmount, setSelectedGoalAmount] = useState<number>(15000);

  const progressPercentage = (step / TOTAL_STEPS) * 100;

  // Toggle all applicable lifestyle tags independently.
  const handleSelectLifeCard = (tag: LifeContextTag) => {
    playTap();
    setSelectedLifeContext((previous) =>
      previous.includes(tag)
        ? previous.filter((value) => value !== tag)
        : [...previous, tag]
    );
  };

  // Balance shortcuts never imply or change the payment frequency.
  const handleSelectQuincenaTier = (tier: (typeof QUINCENA_LEVEL_TIERS)[number]) => {
    playTap();
    setSelectedQuincenaAllowance(tier.currentBalance);
  };

  const suggestedCommitments = QUICK_COMMITMENT_CARDS.filter(
    (option) =>
      showAllCommitments ||
      !option.suggestedFor ||
      option.suggestedFor.some((tag) => selectedLifeContext.includes(tag))
  );

  // Add or remove a commitment without advancing the wizard.
  const handleSelectCommitmentCard = (card: CommitmentSuggestion) => {
    playTap();
    setCommitmentsError(null);
    setCommitments((previous) =>
      previous.some((item) => item.id === card.id)
        ? previous.filter((item) => item.id !== card.id)
        : [
            ...previous,
            {
              id: card.id,
              title: card.title,
              category: card.category,
              amount: 0,
              dueInDays: -1,
            },
          ]
    );
  };

  const updateCommitment = (
    id: string,
    updates: Partial<Pick<Commitment, "title" | "amount" | "dueInDays">>
  ) => {
    setCommitmentsError(null);
    setCommitments((previous) =>
      previous.map((item) => item.id === id ? { ...item, ...updates } : item)
    );
  };

  const addCustomCommitment = () => {
    const title = customCommitmentTitle.trim();
    if (!title) return;
    setCommitments((previous) => [
      ...previous,
      {
        id: `custom-${Date.now()}`,
        title,
        amount: 0,
        dueInDays: -1,
        category: "Otros",
      },
    ]);
    setCustomCommitmentTitle("");
    setCommitmentsError(null);
  };

  const continueFromCommitments = () => {
    if (commitments.some((item) => !item.title.trim() || !Number.isFinite(item.amount) || item.amount <= 0 || !Number.isInteger(item.dueInDays) || item.dueInDays < 0 || item.dueInDays > 365)) {
      setCommitmentsError("Completa el monto y los días restantes de todos los pagos seleccionados, o elimínalos.");
      return;
    }
    playTap();
    setStep(4);
  };

  // Step 4: Save onboarding before displaying the success screen.

  const handleSelectGoalAndFinish = async (
    goal: (typeof GOAL_CARDS)[number],
  ) => {
    if (isSaving) return;

    playTap();
    setIsSaving(true);
    setSaveError(null);

    // Do not invent bank balances or income figures from UI presets.
    const computedCurrentBalance = selectedQuincenaAllowance;
    const computedNextPaydayAmount = hasRegularIncome ? nextPaydayAmount : 0;

    const onboardingData: OnboardingInput = {
      lifeContext:
        selectedLifeContext.length > 0 ? selectedLifeContext : ["trabajo"],

      currentBalance: computedCurrentBalance,
      payFrequency,
      nextPaydayDays: hasRegularIncome ? nextPaydayDays : 0,
      nextPaydayAmount: computedNextPaydayAmount,
      commitments,
      goalTitle: goal.title,
      goalTargetAmount: goal.amount,
    };

    try {
      // Demo onboarding does not write to Supabase.
      const isDemo =
        new URLSearchParams(window.location.search).get("demo") === "1";

      if (isDemo) {
        completeOnboarding(onboardingData);
      } else {
        // Persist the financial information first.
        const userId = await saveOnboardingToSupabase(onboardingData);

        // Update frontend state only after saving.
        completeOnboarding(onboardingData, userId);
      }

      setSelectedGoalTitle(goal.title);
      setSelectedGoalAmount(goal.amount);

      setIsUnlockedScreen(true);
      playLevelUp();
    } catch (error) {
      console.error("Onboarding error:", error);

      setSaveError(
        error instanceof Error
          ? error.message
          : "No se pudo guardar tu perfil.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate unlocked level for the celebration screen
  const unlockedLevel: PlantLevel =
    selectedQuincenaAllowance >= 5000
      ? 4
      : selectedQuincenaAllowance >= 3000
        ? 3
        : 2;

  const unlockedMeta =
    UNLOCKED_LEVEL_BADGES.find((b) => b.level === unlockedLevel) ??
    UNLOCKED_LEVEL_BADGES[1];

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-slate-900 flex flex-col justify-between relative overflow-hidden">
      {/* Warm Ambient Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden flex justify-center"
      >
        <div className="w-[620px] h-[360px] rounded-full bg-gradient-to-b from-emerald-100/60 via-[#EDE6DA]/40 to-transparent blur-3xl -top-16 absolute" />
      </div>

      {/* Minimalist Top Bar + Duolingo Animated Progress Bar */}
      <header className="sticky top-0 z-30 bg-[#FAF8F5]/90 backdrop-blur-md border-b border-[#E6E1DA]/80">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between gap-3">
          {step > 1 && !isUnlockedScreen ? (
            <motion.button
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={() => {
                playTap();
                setStep((s) => Math.max(1, s - 1));
              }}
              className="h-9 px-3 rounded-xl border-2 border-b-4 border-[#DCD5CA] bg-white text-slate-800 text-xs font-bold font-heading flex items-center gap-1 cursor-pointer active:border-b-2 active:translate-y-0.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Atrás</span>
            </motion.button>
          ) : (
            <Link
              href="/auth"
              onClick={() => playTap()}
              className="flex items-center gap-2 group"
            >
              <div className="w-8 h-8 rounded-xl bg-slate-900 text-[#FAF8F5] flex items-center justify-center shadow-2xs">
                <Compass className="w-4 h-4" strokeWidth={1.5} />
              </div>
              <span className="text-sm font-bold font-heading text-slate-900">
                AntesDeGastar
              </span>
            </Link>
          )}

          {/* Duolingo-style Chunky Progress Bar */}
          {!isUnlockedScreen && (
            <div className="flex-1 max-w-[200px] h-3.5 bg-[#E6E1DA] rounded-full overflow-hidden p-0.5">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                initial={{ width: "25%" }}
                animate={{ width: `${progressPercentage}%` }}
                transition={{ type: "spring", stiffness: 260, damping: 24 }}
              />
            </div>
          )}

          <span className="text-xs font-bold font-heading text-slate-600 bg-white border border-[#E6E1DA] px-2.5 py-1 rounded-full">
            {isUnlockedScreen ? "🎉 Listo" : `${step}/${TOTAL_STEPS}`}
          </span>
        </div>
      </header>

      {/* Main Tactile Wizard Stage */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-4 sm:py-6">
        <div className="w-full max-w-md mx-auto">
          <AnimatePresence mode="wait">
            {isUnlockedScreen ? (
              /* FINAL CELEBRATION: Unlocked Financial Plant Card + Confetti */
              <motion.div
                key="unlocked-plant-celebration"
                initial={{ opacity: 0, scale: 0.92, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 280, damping: 22 }}
                className="space-y-4 text-center"
              >
                <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 border-2 border-amber-300 px-3.5 py-1 text-xs font-bold font-heading text-amber-950 shadow-2xs">
                  <Award className="w-4 h-4 text-amber-700" strokeWidth={1.5} />
                  <span>¡Planta Financiera Desbloqueada!</span>
                </div>

                {/* Maximum 6 words title */}
                <h1 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900 tracking-tight">
                  ¡Desbloqueaste tu Planta Financiera! 🌱
                </h1>

                {/* Unlocked Level Pills (1 to 5 visual progression) */}
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  {UNLOCKED_LEVEL_BADGES.map((item) => {
                    const isCurrent = item.level === unlockedLevel;
                    return (
                      <button
                        key={item.level}
                        type="button"
                        onClick={() => playLevelUp()}
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-bold font-heading border transition-all cursor-pointer ${
                          isCurrent
                            ? "bg-slate-900 text-white border-slate-900 shadow-xs scale-105"
                            : "bg-white/80 text-slate-500 border-[#E6E1DA]"
                        }`}
                      >
                        {item.name}
                      </button>
                    );
                  })}
                </div>

                {/* Protagonist Financial Plant Widget */}
                <div className="text-left">
                  <FinancialPlantWidget
                    simulationState="recovered"
                    compact
                    allowLevelPreview
                  />
                </div>

                {/* Quick Summary Chips */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-2xl bg-white border-2 border-b-4 border-[#E6E1DA] text-left">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">
                      Saldo de hoy
                    </span>
                    <span className="text-lg font-bold font-heading text-emerald-700">
                      ${selectedQuincenaAllowance.toLocaleString()} MXN
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-white border-2 border-b-4 border-[#E6E1DA] text-left">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">
                      Tu Meta
                    </span>
                    <span className="text-sm font-bold font-heading text-slate-900 truncate block">
                      {selectedGoalTitle} ($
                      {selectedGoalAmount.toLocaleString()})
                    </span>
                  </div>
                </div>

                {/* 3D Primary Action Button to enter /app */}
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={() => {
                    playCoin();
                    router.push("/app");
                  }}
                  className="w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-heading text-base border-2 border-emerald-700 border-b-4 border-b-emerald-800 active:border-b-2 active:translate-y-0.5 shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Entrar a mi Copiloto</span>
                  <ArrowRight className="w-5 h-5" strokeWidth={1.5} />
                </motion.button>
              </motion.div>
            ) : (
              /* STEPS 1 TO 4: Zero Visual Noise + Reactive Plant + 3D Auto-Advance Cards */
              <motion.div
                key={`step-${step}`}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="space-y-4"
              >
                {/* Reactive Plant at the top */}
                <OnboardingReactivePlant
                  step={step}
                  balancePreview={selectedQuincenaAllowance}
                />

                {/* STEP 1: Multiselect lifestyle. */}
                {step === 1 && (
                  <div className="space-y-4">
                    <h1 className="text-2xl sm:text-3xl font-bold font-heading text-center text-slate-900 tracking-tight">
                      ¿Cómo es tu situación actual?
                    </h1>
                    <p className="text-center text-sm text-slate-600">
                      Selecciona todas las opciones que te describan.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {LIFE_CONTEXT_CARDS.map((item) => {
                        const Icon = item.icon;
                        const selected = selectedLifeContext.includes(item.id);
                        return (
                          <motion.button
                            key={item.id}
                            type="button"
                            aria-pressed={selected}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleSelectLifeCard(item.id)}
                            className={`p-4 rounded-3xl border-2 border-b-4 transition-all text-left flex flex-col justify-between gap-3 cursor-pointer shadow-2xs ${item.cardStyle} ${selected ? "ring-2 ring-emerald-700" : ""}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-2xl">{item.emoji}</span>
                              {selected ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                              ) : (
                                <Icon className="w-5 h-5 text-slate-600" strokeWidth={1.5} />
                              )}
                            </div>
                            <div>
                              <p className="text-sm sm:text-base font-bold font-heading text-slate-900 leading-tight">
                                {item.title}
                              </p>
                              <span className="text-[11px] font-semibold text-slate-500">{item.tag}</span>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                    <motion.button
                      type="button"
                      disabled={selectedLifeContext.length === 0}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => { playTap(); setStep(2); }}
                      className="w-full h-12 rounded-2xl bg-slate-900 text-white font-bold font-heading text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      Continuar ({selectedLifeContext.length} seleccionadas)
                      <ArrowRight className="w-4 h-4" />
                    </motion.button>
                  </div>
                )}

                {/* STEP 2: Actual balance and flexible income cadence. */}
                {step === 2 && (
                  <div className="space-y-4">
                    <h1 className="text-2xl sm:text-3xl font-bold font-heading text-center text-slate-900 tracking-tight">
                      ¿Con cuánto cuentas hoy?
                    </h1>
                    <p className="text-center text-sm text-slate-600">
                      No importa si recibes nómina, beca o apoyo económico.
                    </p>
                    <div className="grid grid-cols-3 gap-2.5">
                      {QUINCENA_LEVEL_TIERS.map((tier) => (
                        <motion.button
                          key={tier.id}
                          type="button"
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleSelectQuincenaTier(tier)}
                          className={`p-3 rounded-2xl border-2 border-b-4 text-center cursor-pointer ${tier.cardStyle} ${selectedQuincenaAllowance === tier.currentBalance ? "ring-2 ring-slate-900" : ""}`}
                        >
                          <span className="block text-xl">{tier.emoji}</span>
                          <span className="block text-sm font-bold">{tier.label}</span>
                          <span className="text-[10px] text-slate-600">{tier.tag}</span>
                        </motion.button>
                      ))}
                    </div>
                    <div className="p-4 rounded-3xl bg-white border-2 border-b-4 border-[#E6E1DA] space-y-4">
                      <label className="block text-sm font-bold text-slate-800">
                        Saldo de hoy, antes de pagos próximos (MXN)
                        <input
                          type="number"
                          min={0}
                          max={999999999}
                          step="0.01"
                          value={selectedQuincenaAllowance}
                          onChange={(event) => setSelectedQuincenaAllowance(Math.max(0, Number(event.target.value) || 0))}
                          className="mt-2 w-full h-11 rounded-xl border border-slate-300 px-3 text-base"
                        />
                      </label>
                      <label className="flex items-start gap-2 text-sm font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={!hasRegularIncome}
                          onChange={(event) => setHasRegularIncome(!event.target.checked)}
                          className="mt-1 accent-emerald-700"
                        />
                        No recibo dinero de forma regular
                      </label>
                      {hasRegularIncome && (
                        <div className="space-y-3">
                          <label className="block text-sm font-bold text-slate-800">
                            ¿Cada cuándo recibes dinero?
                            <select
                              value={payFrequency}
                              onChange={(event) => setPayFrequency(event.target.value as PayFrequency)}
                              className="mt-2 w-full h-11 rounded-xl border border-slate-300 px-3 bg-white"
                            >
                              <option value="semanal">Cada semana</option>
                              <option value="quincenal">Cada quincena</option>
                              <option value="mensual">Cada mes</option>
                            </select>
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                            <label className="block text-xs font-bold text-slate-700">
                              Próximo ingreso (MXN)
                              <input
                                type="number"
                                min={0}
                                max={999999999}
                                step="0.01"
                                value={nextPaydayAmount}
                                onChange={(event) => setNextPaydayAmount(Math.max(0, Number(event.target.value) || 0))}
                                className="mt-2 w-full h-11 rounded-xl border border-slate-300 px-3 text-sm"
                              />
                            </label>
                            <label className="block text-xs font-bold text-slate-700">
                              Días hasta recibirlo
                              <input
                                type="number"
                                min={0}
                                max={365}
                                step={1}
                                value={nextPaydayDays}
                                onChange={(event) => setNextPaydayDays(Math.min(365, Math.max(0, Number(event.target.value) || 0)))}
                                className="mt-2 w-full h-11 rounded-xl border border-slate-300 px-3 text-sm"
                              />
                            </label>
                          </div>
                          <p className="text-xs text-slate-500">Si tienes varios ingresos, por ahora registra el próximo. Después podrás agregar los demás.</p>
                        </div>
                      )}
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.96 }}
                        onClick={() => { playTap(); setStep(3); }}
                        className="w-full h-11 rounded-2xl bg-slate-900 text-white font-bold font-heading text-sm flex items-center justify-center gap-2"
                      >
                        Continuar <ArrowRight className="w-4 h-4" />
                      </motion.button>
                    </div>
                  </div>
                )}

                {/* STEP 3: Contextual suggestions, optional multiselect and editing. */}
                {step === 3 && (
                  <div className="space-y-4">
                    <h1 className="text-2xl sm:text-3xl font-bold font-heading text-center text-slate-900 tracking-tight">
                      ¿Qué pagos tienes pendientes?
                    </h1>
                    <p className="text-center text-sm text-slate-600">
                      Puedes seleccionar varios, agregar otros o continuar sin pagos.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {suggestedCommitments.map((card) => {
                        const selected = commitments.some((item) => item.id === card.id);
                        return (
                          <motion.button
                            key={card.id}
                            type="button"
                            aria-pressed={selected}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleSelectCommitmentCard(card)}
                            className={`p-4 rounded-3xl border-2 border-b-4 transition-all text-left flex flex-col gap-2 cursor-pointer shadow-2xs ${card.cardStyle} ${selected ? "ring-2 ring-emerald-700" : ""}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-2xl">{card.emoji}</span>
                              {selected && <CheckCircle2 className="w-5 h-5 text-emerald-700" />}
                            </div>
                            <p className="text-sm font-bold text-slate-900">{card.title}</p>
                          </motion.button>
                        );
                      })}
                    </div>
                    <button type="button" className="block mx-auto text-xs font-bold text-emerald-800 underline" onClick={() => setShowAllCommitments((prev) => !prev)}>
                      {showAllCommitments ? "Mostrar sugerencias principales" : "Ver todas las categorías"}
                    </button>
                    {commitments.length > 0 && (
                      <div className="p-4 rounded-2xl bg-white border-2 border-[#E6E1DA] space-y-3">
                        <p className="text-sm font-bold text-slate-800">Indica el monto y vencimiento de cada pago</p>
                        {commitments.map((item) => (
                          <div key={item.id} className="border-b border-slate-100 pb-3 last:border-b-0 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-slate-700">{item.title}</span>
                              <button type="button" aria-label={`Eliminar ${item.title}`} onClick={() => setCommitments((prev) => prev.filter((v) => v.id !== item.id))} className="p-1 text-rose-600">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <label className="text-xs text-slate-600">
                                Monto (MXN)
                                <input
                                  type="number" min={0} max={999999999} step="0.01"
                                  value={item.amount || ""}
                                  placeholder="Ej. 300"
                                  onChange={(event) => updateCommitment(item.id, {amount: Math.max(0, Number(event.target.value) || 0)})}
                                  className="mt-1 w-full h-10 rounded-lg border border-slate-300 px-2 text-sm"
                                />
                              </label>
                              <label className="text-xs text-slate-600">
                                Vence en (días)
                                <input
                                  type="number" min={0} max={365} step={1}
                                  value={item.dueInDays < 0 ? "" : item.dueInDays}
                                  onChange={(event) => updateCommitment(item.id, {dueInDays: event.target.value === "" ? -1 : Math.min(365, Math.max(0, Number(event.target.value) || 0))})}
                                  className="mt-1 w-full h-10 rounded-lg border border-slate-300 px-2 text-sm"
                                />
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        type="text" value={customCommitmentTitle}
                        onChange={(event) => setCustomCommitmentTitle(event.target.value)}
                        placeholder="Otro pago (ej. veterinario)"
                        className="flex-1 min-w-0 h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm"
                      />
                      <button type="button" disabled={!customCommitmentTitle.trim()} onClick={addCustomCommitment} className="h-11 px-3 rounded-xl bg-white border border-slate-300 disabled:opacity-40">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    {commitmentsError && <p role="alert" className="text-xs text-rose-700">{commitmentsError}</p>}
                    <motion.button
                      type="button" whileTap={{scale: 0.96}}
                      onClick={continueFromCommitments}
                      className="w-full h-12 rounded-2xl bg-slate-900 text-white font-bold font-heading text-sm flex items-center justify-center gap-2"
                    >
                      {commitments.length === 0 ? "No tengo pagos pendientes" : `Continuar con ${commitments.length} pago(s)`}
                      <ArrowRight className="w-4 h-4" />
                    </motion.button>
                  </div>
                )}

                {/* STEP 4: Tu meta principal (Max 6 words title, 1-tap triggers playLevelUp + confetti) */}
                {step === 4 && (
                  <div className="space-y-4">
                    <h1 className="text-2xl sm:text-3xl font-bold font-heading text-center text-slate-900 tracking-tight">
                      ¿Cuál es tu meta principal?
                    </h1>
                    <div className="grid grid-cols-2 gap-3">
                      {GOAL_CARDS.map((goal) => {
                        const Icon = goal.icon;

                        return (
                          <motion.button
                            key={goal.id}
                            type="button"
                            disabled={isSaving}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleSelectGoalAndFinish(goal)}
                            className={`p-4 rounded-3xl border-2 border-b-4 active:border-b-2 active:translate-y-0.5 transition-all text-left flex flex-col justify-between gap-3 cursor-pointer shadow-2xs hover:shadow-md ${goal.cardStyle}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-2xl">{goal.emoji}</span>
                              <Icon className="w-4 h-4" />
                            </div>

                            <div>
                              <p className="font-bold">{goal.title}</p>
                              <span className="text-xs">
                                Meta: ${goal.amount.toLocaleString()}
                              </span>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                    {isSaving && (
                      <p className="text-center text-sm text-emerald-700">
                        Guardando tu perfil financiero...
                      </p>
                    )}
                    {saveError && (
                      <p
                        role="alert"
                        className="text-center text-sm text-red-600"
                      >
                        {saveError}
                      </p>
                    )}
                    
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Compact Footer Indicator */}
      <footer className="py-3 text-center text-[11px] font-bold font-heading text-slate-400">
        <span className="inline-flex items-center gap-1">
          <Zap className="w-3 h-3 text-emerald-600" strokeWidth={1.5} />Tú eliges
          qué registrar · Opciones adaptadas a ti
        </span>
      </footer>
    </div>
  );
}
