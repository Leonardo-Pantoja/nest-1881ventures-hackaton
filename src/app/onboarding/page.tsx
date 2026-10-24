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
  SlidersHorizontal,
  Zap,
  Award,
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
    title: "Vivo por mi cuenta",
    tag: "Renta / Roomies",
    icon: Home,
    cardStyle:
      "border-amber-300 border-b-amber-500 bg-gradient-to-b from-white to-amber-50/60 text-slate-900",
  },
  {
    id: "dependientes",
    emoji: "🤝",
    title: "Apoyo a familia",
    tag: "Hogar / Dependientes",
    icon: Users,
    cardStyle:
      "border-purple-300 border-b-purple-500 bg-gradient-to-b from-white to-purple-50/60 text-slate-900",
  },
];

const QUINCENA_LEVEL_TIERS = [
  {
    id: "tier-1500",
    emoji: "🪙",
    label: "$1,500",
    tag: "Modo Estudiante",
    currentBalance: 1500,
    nextPaydayAmount: 2600,
    nextPaydayDays: 6,
    payFrequency: "quincenal" as PayFrequency,
    cardStyle:
      "border-amber-300 border-b-amber-500 bg-gradient-to-b from-white to-amber-50/70",
  },
  {
    id: "tier-3000",
    emoji: "💰",
    label: "$3,000",
    tag: "Equilibrio Quincenal",
    currentBalance: 3000,
    nextPaydayAmount: 6500,
    nextPaydayDays: 6,
    payFrequency: "quincenal" as PayFrequency,
    cardStyle:
      "border-emerald-300 border-b-emerald-600 bg-gradient-to-b from-white to-emerald-50/70",
  },
  {
    id: "tier-5000",
    emoji: "💎",
    label: "$5,000+",
    tag: "Colchón Sólido",
    currentBalance: 5500,
    nextPaydayAmount: 9800,
    nextPaydayDays: 6,
    payFrequency: "quincenal" as PayFrequency,
    cardStyle:
      "border-teal-300 border-b-teal-600 bg-gradient-to-b from-white to-teal-50/70",
  },
];

const QUICK_COMMITMENT_CARDS: {
  id: string;
  emoji: string;
  title: string;
  amount: number;
  dueInDays: number;
  category: string;
  cardStyle: string;
}[] = [
  {
    id: "chip-none",
    emoji: "✨",
    title: "Libre esta semana",
    amount: 0,
    dueInDays: 0,
    category: "Libre",
    cardStyle:
      "border-emerald-300 border-b-emerald-600 bg-gradient-to-b from-white to-emerald-50/80",
  },
  {
    id: "chip-servicios",
    emoji: "📱",
    title: "Celular / Internet",
    amount: 550,
    dueInDays: 3,
    category: "Servicios",
    cardStyle:
      "border-sky-300 border-b-sky-500 bg-gradient-to-b from-white to-sky-50/70",
  },
  {
    id: "chip-tdc",
    emoji: "💳",
    title: "Tarjeta de crédito",
    amount: 1200,
    dueInDays: 4,
    category: "Deuda",
    cardStyle:
      "border-amber-300 border-b-amber-500 bg-gradient-to-b from-white to-amber-50/70",
  },
  {
    id: "chip-renta",
    emoji: "🏡",
    title: "Renta o Depa",
    amount: 2200,
    dueInDays: 2,
    category: "Vivienda",
    cardStyle:
      "border-rose-300 border-b-rose-500 bg-gradient-to-b from-white to-rose-50/70",
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

  // Step 1: Contexto de vida (sin pedir género)
  const [selectedLifeContext, setSelectedLifeContext] = useState<
    LifeContextTag[]
  >(["trabajo"]);

  // Step 2: Sliders con Emojis y Niveles Visuales + Botones 1-toque
  const [selectedQuincenaAllowance, setSelectedQuincenaAllowance] =
    useState<number>(3000);
  const [payFrequency, setPayFrequency] = useState<PayFrequency>("quincenal");
  const [nextPaydayDays] = useState<number>(6);

  // Step 3: Compromisos próximos (1 toque)
  const [commitments, setCommitments] = useState<Commitment[]>([]);

  // Step 4: Meta principal (1 toque)
  const [selectedGoalTitle, setSelectedGoalTitle] =
    useState<string>("Fondo de paz");
  const [selectedGoalAmount, setSelectedGoalAmount] = useState<number>(15000);

  const progressPercentage = (step / TOTAL_STEPS) * 100;

  // Step 1 tap: Auto-advance on tap with playTap()
  const handleSelectLifeCard = (tag: LifeContextTag) => {
    playTap();
    const updated = selectedLifeContext.includes(tag)
      ? selectedLifeContext
      : [tag, ...selectedLifeContext.slice(0, 1)];
    setSelectedLifeContext(updated);

    // Pre-tune slider default based on context
    if (tag === "estudio") {
      setSelectedQuincenaAllowance(1500);
    } else if (tag === "dependientes" || tag === "independiente") {
      setSelectedQuincenaAllowance(5000);
    } else {
      setSelectedQuincenaAllowance(3000);
    }

    setTimeout(() => {
      setStep(2);
    }, 160);
  };

  // Step 2 tap: 1-tap Tier button auto-advances immediately
  const handleSelectQuincenaTier = (
    tier: (typeof QUINCENA_LEVEL_TIERS)[number],
  ) => {
    playTap();
    setSelectedQuincenaAllowance(tier.currentBalance);
    setPayFrequency(tier.payFrequency);

    setTimeout(() => {
      setStep(3);
    }, 160);
  };

  // Step 3 tap: 1-tap Commitment card auto-advances immediately
  const handleSelectCommitmentCard = (
    card: (typeof QUICK_COMMITMENT_CARDS)[number],
  ) => {
    playTap();
    if (card.amount <= 0) {
      setCommitments([]);
    } else {
      setCommitments([
        {
          id: card.id,
          title: card.title,
          amount: card.amount,
          dueInDays: card.dueInDays,
          category: card.category,
        },
      ]);
    }

    setTimeout(() => {
      setStep(4);
    }, 160);
  };

  // Step 4 tap: Final tap -> completeOnboarding + playLevelUp() + Confetti + Unlocked Financial Plant Card

  const handleSelectGoalAndFinish = async (
    goal: (typeof GOAL_CARDS)[number],
  ) => {
    if (isSaving) return;

    playTap();
    setIsSaving(true);
    setSaveError(null);

    const commitmentSum = commitments.reduce(
      (acc, commitment) => acc + commitment.amount,
      0,
    );

    const computedCurrentBalance =
      selectedQuincenaAllowance + commitmentSum + 1400;

    const computedNextPaydayAmount = Math.max(
      3200,
      Math.round(selectedQuincenaAllowance * 1.9),
    );

    const onboardingData: OnboardingInput = {
      lifeContext:
        selectedLifeContext.length > 0 ? selectedLifeContext : ["trabajo"],

      currentBalance: computedCurrentBalance,
      payFrequency,
      nextPaydayDays,
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
                      Quincena libre
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

                {/* STEP 1: Contexto de vida (Max 6 words title, 3D tactile cards, auto-advance, NO gender) */}
                {step === 1 && (
                  <div className="space-y-4">
                    <h1 className="text-2xl sm:text-3xl font-bold font-heading text-center text-slate-900 tracking-tight">
                      ¿Cuál es tu ritmo hoy?
                    </h1>

                    <div className="grid grid-cols-2 gap-3">
                      {LIFE_CONTEXT_CARDS.map((item) => {
                        const Icon = item.icon;
                        return (
                          <motion.button
                            key={item.id}
                            type="button"
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleSelectLifeCard(item.id)}
                            className={`p-4 rounded-3xl border-2 border-b-4 active:border-b-2 active:translate-y-0.5 transition-all text-left flex flex-col justify-between gap-3 cursor-pointer shadow-2xs hover:shadow-md ${item.cardStyle}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-2xl">{item.emoji}</span>
                              <div className="w-8 h-8 rounded-xl bg-white/90 border border-slate-200/80 flex items-center justify-center text-slate-800">
                                <Icon className="w-4 h-4" strokeWidth={1.5} />
                              </div>
                            </div>
                            <div>
                              <p className="text-base font-bold font-heading text-slate-900 leading-tight">
                                {item.title}
                              </p>
                              <span className="text-[11px] font-semibold text-slate-500">
                                {item.tag}
                              </span>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* STEP 2: Quincena libre con Emojis, Slider Visual y Botones 1-Toque */}
                {step === 2 && (
                  <div className="space-y-4">
                    {/* Max 6 words title */}
                    <h1 className="text-2xl sm:text-3xl font-bold font-heading text-center text-slate-900 tracking-tight">
                      Mi quincena libre anda por:
                    </h1>

                    {/* 1-Tap 3D Level Buttons (🪙 $1,500 | 💰 $3,000 | 💎 $5,000+) */}
                    <div className="grid grid-cols-3 gap-2.5">
                      {QUINCENA_LEVEL_TIERS.map((tier) => {
                        const isSelected =
                          Math.abs(
                            selectedQuincenaAllowance - tier.currentBalance,
                          ) < 400;
                        return (
                          <motion.button
                            key={tier.id}
                            type="button"
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleSelectQuincenaTier(tier)}
                            className={`p-3.5 rounded-3xl border-2 border-b-4 active:border-b-2 active:translate-y-0.5 transition-all flex flex-col items-center text-center gap-1.5 cursor-pointer shadow-2xs ${
                              tier.cardStyle
                            } ${isSelected ? "ring-2 ring-slate-900" : ""}`}
                          >
                            <span className="text-2xl">{tier.emoji}</span>
                            <span className="text-base sm:text-lg font-bold font-heading text-slate-900">
                              {tier.label}
                            </span>
                            <span className="text-[10px] font-bold text-slate-500">
                              {tier.tag}
                            </span>
                          </motion.button>
                        );
                      })}
                    </div>

                    {/* Interactive Emoji Visual Level Slider */}
                    <div className="p-4 rounded-3xl bg-white border-2 border-b-4 border-[#E6E1DA] space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold font-heading text-slate-500 flex items-center gap-1.5">
                          <SlidersHorizontal
                            className="w-3.5 h-3.5 text-emerald-700"
                            strokeWidth={1.5}
                          />
                          Desliza tu nivel
                        </span>
                        <span className="text-xl font-bold font-heading text-emerald-800">
                          {selectedQuincenaAllowance < 2200
                            ? "🪙"
                            : selectedQuincenaAllowance < 4200
                              ? "💰"
                              : "💎"}{" "}
                          ${selectedQuincenaAllowance.toLocaleString()} MXN
                        </span>
                      </div>

                      <input
                        type="range"
                        min={500}
                        max={8000}
                        step={250}
                        value={selectedQuincenaAllowance}
                        onChange={(e) => {
                          playTap();
                          setSelectedQuincenaAllowance(Number(e.target.value));
                        }}
                        className="w-full h-3 bg-[#E6E1DA] rounded-lg appearance-none cursor-pointer accent-emerald-600"
                      />

                      <div className="flex justify-between text-[11px] font-bold font-heading text-slate-400">
                        <span>🪙 $500</span>
                        <span>💰 $3,000</span>
                        <span>💎 $8,000+</span>
                      </div>

                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.96 }}
                        onClick={() => {
                          playTap();
                          setStep(3);
                        }}
                        className="w-full h-11 rounded-2xl bg-slate-900 text-white font-bold font-heading text-xs border-2 border-slate-950 border-b-4 active:border-b-2 active:translate-y-0.5 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span>
                          Confirmar $
                          {selectedQuincenaAllowance.toLocaleString()}
                        </span>
                        <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                      </motion.button>
                    </div>
                  </div>
                )}

                {/* STEP 3: Compromisos próximos (Max 6 words title, 1-tap 3D cards auto-advance) */}
                {step === 3 && (
                  <div className="space-y-4">
                    <h1 className="text-2xl sm:text-3xl font-bold font-heading text-center text-slate-900 tracking-tight">
                      ¿Pagos fuertes esta semana?
                    </h1>

                    <div className="grid grid-cols-2 gap-3">
                      {QUICK_COMMITMENT_CARDS.map((card) => (
                        <motion.button
                          key={card.id}
                          type="button"
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleSelectCommitmentCard(card)}
                          className={`p-4 rounded-3xl border-2 border-b-4 active:border-b-2 active:translate-y-0.5 transition-all text-left flex flex-col justify-between gap-2.5 cursor-pointer shadow-2xs hover:shadow-md ${card.cardStyle}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-2xl">{card.emoji}</span>
                            <span className="text-xs font-bold font-heading px-2 py-0.5 rounded-full bg-white/90 border border-slate-200 text-slate-800">
                              {card.amount === 0
                                ? "$0"
                                : `$${card.amount.toLocaleString()}`}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm sm:text-base font-bold font-heading text-slate-900 leading-tight">
                              {card.title}
                            </p>
                            <span className="text-[11px] font-semibold text-slate-500">
                              {card.amount === 0
                                ? "Sin cobros próximos"
                                : `Vence en ${card.dueInDays} días`}
                            </span>
                          </div>
                        </motion.button>
                      ))}
                    </div>
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
          <Zap className="w-3 h-3 text-emerald-600" strokeWidth={1.5} />1 toque
          para avanzar · Cero formularios
        </span>
      </footer>
    </div>
  );
}
