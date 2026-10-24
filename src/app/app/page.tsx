"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  CheckCircle2,
  SlidersHorizontal,
  UserCheck,
  X,
  Send,
  BookmarkCheck,
  Flame,
  Trophy,
  Target,
  Sprout,
  Search,
  Clock,
  CalendarCheck,
  ShoppingBag,
  ArrowRight,
  Award,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import QuickGuideModal from "@/components/QuickGuideModal";
import FinancialPlantWidget, {
  type PlantSimulationState,
  type PlantLevel,
} from "@/components/FinancialPlantWidget";
import QuickSnapScanner, {
  type ScannedProductResult,
} from "@/components/QuickSnapScanner";
import { type BottomNavTab } from "@/components/BottomNav";
import {
  useFinancial,
  PRELOADED_SANDBOX_PROFILES,
} from "@/context/FinancialContext";
import {
  playTap,
  playCoin,
  playDamage,
  playLevelUp,
  triggerConfettiBurst,
} from "@/lib/soundEffects";

// Horizontal Quick Example Pills (Never truncated, Monochrome + Emerald active)
const QUICK_EXAMPLE_PILLS = [
  {
    id: "audifonos",
    label: "🎧 Audífonos $2,300",
    name: "Audífonos Inalámbricos",
    price: 2300,
  },
  {
    id: "videojuego",
    label: "🎮 Videojuego $1,200",
    name: "Videojuego",
    price: 1200,
  },
  {
    id: "tenis",
    label: "👟 Tenis $1,800",
    name: "Tenis Deportivos",
    price: 1800,
  },
  {
    id: "comida",
    label: "🍔 Comida $350",
    name: "Comida a domicilio",
    price: 350,
  },
];

const FIVE_EVOLUTION_LEVELS: {
  level: PlantLevel;
  title: string;
  description: string;
  milestone: string;
}[] = [
  {
    level: 1,
    title: "Supervivencia",
    description: "Semilla firme: conociendo tus gastos fijos de la quincena.",
    milestone: "0 – 100 XP",
  },
  {
    level: 2,
    title: "Estabilidad",
    description: "Brote joven: tus compromisos de los próximos días están cubiertos.",
    milestone: "100 – 250 XP",
  },
  {
    level: 3,
    title: "Seguridad",
    description: "Planta frondosa: cuentas con tu colchón de tranquilidad intacto.",
    milestone: "250 – 450 XP",
  },
  {
    level: 4,
    title: "Libertad",
    description: "Árbol en flor: planeas tus compras sin afectar tus metas.",
    milestone: "450 – 700 XP",
  },
  {
    level: 5,
    title: "Abundancia",
    description: "Árbol radiante: dominio total de tu liquidez y ahorro constante.",
    milestone: "700+ XP",
  },
];

const FIRST_VISIT_GUIDE_KEY = "antesdegastar_seen_quick_guide_v1";

/**
 * Miniature SVG Plant for the Compact Header inside "Simular Compra"
 */
function MiniHeaderPlant({ isDeficit }: { isDeficit: boolean }) {
  return (
    <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
      <svg viewBox="0 0 64 64" className="w-9 h-9 overflow-visible">
        <path
          d="M22 44 L42 44 L39 56 C38.5 57.5 37 58 35.5 58 L28.5 58 C27 58 25.5 57.5 25 56 Z"
          fill="#D97757"
        />
        <rect x="20" y="40" width="24" height="5" rx="2.5" fill="#C86849" />
        <motion.g
          style={{ originX: "32px", originY: "40px" }}
          animate={
            isDeficit
              ? { rotate: [0, 10, 8] }
              : { rotate: [-2, 2, -2], y: [0, -1, 0] }
          }
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <path
            d="M32 40 Q32 26 32 18"
            stroke={isDeficit ? "#D97706" : "#059669"}
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M32 32 C22 28 18 20 25 16 C30 14 32 24 32 32 Z"
            fill={isDeficit ? "#F59E0B" : "#10B981"}
          />
          <path
            d="M32 27 C42 23 46 15 39 11 C34 9 32 19 32 27 Z"
            fill={isDeficit ? "#FBBF24" : "#34D399"}
          />
        </motion.g>
      </svg>
    </div>
  );
}

export default function AppDashboardPage() {
  const router = useRouter();
  const {
    profile,
    updateProfile,
    loadPreloadedSandboxProfile,
    setPendingEvaluation,
    addToWishlist,
    registerPurchaseAnyway,
    streakCelebration,
  } = useFinancial();

  // Default to "simulate" ("Simular Compra") or switch cleanly via Left Sidebar / BottomNav
  const [activeBottomTab, setActiveBottomTab] =
    useState<BottomNavTab>("simulate");
  const [showTourModal, setShowTourModal] = useState(false);

  // Simulator State: Starts empty so the 3 Decision Cards ONLY appear AFTER the user selects or types a product
  const [queryText, setQueryText] = useState("");
  const [parsedItemName, setParsedItemName] = useState("");
  const [parsedItemPrice, setParsedItemPrice] = useState<number>(0);
  const [scannedThumbnailUrl, setScannedThumbnailUrl] = useState<string | null>(
    null
  );
  const [scannedStoreTag, setScannedStoreTag] = useState<string | null>(null);

  // Decision Resolution State
  const [selectedDecision, setSelectedDecision] = useState<
    "idle" | "wait" | "microsave" | "bought"
  >("idle");
  const [decisionXpBonus, setDecisionXpBonus] = useState<number>(50);

  // Quick expense bottom bar & toast feedback
  const [isQuickExpenseOpen, setIsQuickExpenseOpen] = useState(false);
  const [quickExpenseInput, setQuickExpenseInput] = useState("");
  const [toastFeedback, setToastFeedback] = useState<{
    id: number;
    message: string;
  } | null>(null);

  useEffect(() => {
    try {
      const hasSeen = localStorage.getItem(FIRST_VISIT_GUIDE_KEY);
      if (!hasSeen) {
        setShowTourModal(true);
        localStorage.setItem(FIRST_VISIT_GUIDE_KEY, "true");
      }
    } catch {
      // Ignore storage access errors
    }
  }, []);

  const triggerToast = (message: string) => {
    const id = Date.now();
    setToastFeedback({ id, message });
    setTimeout(() => {
      setToastFeedback((current) => (current?.id === id ? null : current));
    }, 3800);
  };

  // Financial & 3-Segment Liquidity Metrics
  const financialMetrics = useMemo(() => {
    const commitmentsTotal = profile.commitments
      .filter((c) => c.dueInDays <= profile.nextPaydayDays)
      .reduce((acc, c) => acc + c.amount, 0);

    const essentialLivingCost =
      profile.dailyEssentialBurn * profile.nextPaydayDays;

    const fixedAndRentTotal = commitmentsTotal + essentialLivingCost;

    const safeToSpend = Math.max(
      0,
      profile.currentBalance - fixedAndRentTotal - profile.safetyBuffer
    );

    const totalBalance = Math.max(
      1,
      profile.currentBalance ||
        fixedAndRentTotal + profile.safetyBuffer + safeToSpend
    );

    // 3-Segment Horizontal Bar Percentages
    const fixedPct = Math.min(
      82,
      Math.max(15, Math.round((fixedAndRentTotal / totalBalance) * 100))
    );
    const bufferPct = Math.min(
      35,
      Math.max(10, Math.round((profile.safetyBuffer / totalBalance) * 100))
    );
    const freePct = Math.max(8, 100 - fixedPct - bufferPct);

    const netAfterPurchase = safeToSpend - parsedItemPrice;
    const isDeficit = parsedItemPrice > 0 && netAfterPurchase < 0;
    const missingLiquidity = isDeficit ? Math.abs(netAfterPurchase) : 0;

    const weeklyGoalContribution = Math.max(
      300,
      profile.goal.weeklyContribution || 500
    );
    const weeksGoalDelayed = Math.max(
      1,
      Math.ceil(parsedItemPrice / weeklyGoalContribution)
    );

    const suggestedWeeklySave = 400;
    const microSaveWeeks = Math.max(
      1,
      Math.ceil(parsedItemPrice / suggestedWeeklySave)
    );

    const goalPct =
      profile.goal.targetAmount > 0
        ? Math.min(
            100,
            Math.round(
              (profile.goal.currentSaved / profile.goal.targetAmount) * 100
            )
          )
        : 0;

    // Derive current Plant Level
    let currentLevel: PlantLevel = 2;
    const goalRatio =
      profile.goal.targetAmount > 0
        ? profile.goal.currentSaved / profile.goal.targetAmount
        : 0;
    const baseXp = profile.wisdomXp || 120;
    if (safeToSpend <= 0) {
      currentLevel = 1;
    } else if (safeToSpend < profile.safetyBuffer * 1.4 && goalRatio < 0.45) {
      currentLevel = 2;
    } else if (goalRatio < 0.68 && baseXp < 400) {
      currentLevel = 3;
    } else if (goalRatio < 0.88 && baseXp < 650) {
      currentLevel = 4;
    } else {
      currentLevel = 5;
    }

    const levelNames: Record<PlantLevel, string> = {
      1: "Supervivencia",
      2: "Estabilidad",
      3: "Seguridad",
      4: "Libertad",
      5: "Abundancia",
    };

    return {
      safeToSpend,
      totalBalance: profile.currentBalance,
      fixedAndRentTotal,
      safetyBuffer: profile.safetyBuffer,
      fixedPct,
      bufferPct,
      freePct,
      netAfterPurchase,
      isDeficit,
      missingLiquidity,
      weeksGoalDelayed,
      suggestedWeeklySave,
      microSaveWeeks,
      goalPct,
      currentLevel,
      currentLevelName: levelNames[currentLevel],
    };
  }, [profile, parsedItemPrice]);

  // Real-Time Input Handler
  const handleQueryInputChange = (value: string) => {
    setQueryText(value);
    setSelectedDecision("idle");

    if (!value.trim()) {
      setParsedItemName("");
      setParsedItemPrice(0);
      return;
    }

    const normalized = value.replace(/,/g, "");
    const priceMatch = normalized.match(/(\d+(?:\.\d+)?)/);
    if (priceMatch) {
      const price = Math.max(0, Math.round(parseFloat(priceMatch[1])));
      setParsedItemPrice(price);
      const cleanedName = value
        .replace(/\$?\s*\d[\d,.]*/g, "")
        .replace(/\bde\b|\bpor\b|\bmxn\b|\bpesos\b/gi, "")
        .trim();
      setParsedItemName(cleanedName || "Artículo consultado");

      if (price > financialMetrics.safeToSpend) {
        playDamage();
      } else {
        playTap();
      }
    } else {
      setParsedItemPrice(0);
      setParsedItemName(value.trim());
    }
  };

  // Select Horizontal Pill Example
  const handleSelectExamplePill = (
    pill: (typeof QUICK_EXAMPLE_PILLS)[number]
  ) => {
    setSelectedDecision("idle");
    setQueryText(`${pill.name} $${pill.price.toLocaleString()}`);
    setParsedItemName(pill.name);
    setParsedItemPrice(pill.price);
    setScannedThumbnailUrl(null);
    setScannedStoreTag(null);
    setPendingEvaluation({
      name: pill.name,
      price: pill.price,
      imageName: null,
    });

    if (pill.price > financialMetrics.safeToSpend) {
      playDamage();
    } else {
      playTap();
    }
  };

  // Camera / QuickSnapScanner Handler
  const handleScanComplete = (scanned: ScannedProductResult) => {
    setSelectedDecision("idle");
    setQueryText(`${scanned.name} $${scanned.price.toLocaleString()}`);
    setParsedItemName(scanned.name);
    setParsedItemPrice(scanned.price);
    setScannedThumbnailUrl(scanned.thumbnailDataUrl);
    setScannedStoreTag(scanned.storeTag);
    setPendingEvaluation({
      name: scanned.name,
      price: scanned.price,
      imageName: scanned.storeTag,
    });

    if (scanned.price > financialMetrics.safeToSpend) {
      playDamage();
    } else {
      playCoin();
    }
  };

  // Decision 1: "Comprar hoy"
  const handleDecisionBuyToday = () => {
    playDamage();
    setSelectedDecision("bought");
    registerPurchaseAnyway(parsedItemName, parsedItemPrice);
    triggerToast(
      `Compra registrada: −$${parsedItemPrice.toLocaleString()} MXN (${parsedItemName})`
    );
  };

  // Decision 2: "Esperar a tu nómina (en X días)" (+50 XP)
  const handleDecisionWaitPayroll = () => {
    playCoin();
    triggerConfettiBurst();
    setDecisionXpBonus(50);
    setSelectedDecision("wait");
    addToWishlist(
      {
        name: parsedItemName,
        price: parsedItemPrice,
      },
      50
    );
    triggerToast(
      `Decisión recomendada: Esperar ${profile.nextPaydayDays} días a tu nómina · +50 XP`
    );
  };

  // Decision 3: "Plan de Micro-ahorro" (+100 XP)
  const handleDecisionMicroSave = () => {
    playCoin();
    triggerConfettiBurst();
    setDecisionXpBonus(100);
    setSelectedDecision("microsave");
    addToWishlist(
      {
        name: parsedItemName,
        price: parsedItemPrice,
        plannedWeeklySave: financialMetrics.suggestedWeeklySave,
      },
      100
    );
    triggerToast(
      `Plan de Micro-ahorro activado ($${financialMetrics.suggestedWeeklySave}/sem) · +100 XP`
    );
  };

  const handleQuickExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickExpenseInput.trim()) return;

    const normalized = quickExpenseInput.replace(/,/g, "");
    const match = normalized.match(/(\d+(?:\.\d+)?)/);
    if (!match) return;

    const amount = Math.round(parseFloat(match[1]));
    if (amount <= 0) return;

    playTap();
    updateProfile({
      currentBalance: Math.max(0, profile.currentBalance - amount),
    });

    triggerToast(
      `Gasto registrado: −$${amount.toLocaleString()} MXN (${quickExpenseInput.trim()})`
    );
    setQuickExpenseInput("");
    setIsQuickExpenseOpen(false);
  };

  const plantSimulationState: PlantSimulationState =
    selectedDecision === "wait" || selectedDecision === "microsave"
      ? "recovered"
      : financialMetrics.isDeficit
      ? "danger"
      : "normal";

  const hasSelectedProduct = parsedItemPrice > 0;

  return (
    <AppShell
      activeTab={activeBottomTab}
      onSelectTab={(tab) => setActiveBottomTab(tab)}
      onOpenGuide={() => setShowTourModal(true)}
    >
      {/* Celebratory Streak Popup Banner */}
      <AnimatePresence>
        {streakCelebration && (
          <motion.div
            key={streakCelebration.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -14, scale: 0.95 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 rounded-full bg-slate-900 text-white px-4 py-2 shadow-lg flex items-center gap-2 text-xs font-bold font-heading whitespace-nowrap border border-slate-700"
          >
            <Flame
              className="w-4 h-4 text-amber-400 fill-amber-400"
              strokeWidth={1.5}
            />
            <span>
              Racha de {streakCelebration.count} días ·{" "}
              {streakCelebration.reason}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =====================================================================
          VIEW 1: "SIMULAR COMPRA" (Compact Top Header + Full-Width Simulator)
         ===================================================================== */}
      {activeBottomTab === "simulate" && (
        <div className="space-y-8">
          {/* 1. Compact Header with Miniature Plant, Level & 3-Segment Free Money Breakdown */}
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <MiniHeaderPlant
                  isDeficit={
                    financialMetrics.isDeficit &&
                    selectedDecision !== "wait" &&
                    selectedDecision !== "microsave"
                  }
                />
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      <Sprout className="w-3.5 h-3.5" strokeWidth={1.5} />
                      Nivel {financialMetrics.currentLevel}:{" "}
                      {financialMetrics.currentLevelName}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        playTap();
                        setActiveBottomTab("home");
                      }}
                      className="text-xs font-semibold text-slate-500 hover:text-emerald-600 underline cursor-pointer"
                    >
                      Ver mi árbol completo
                    </button>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">
                    Próxima nómina en{" "}
                    <strong className="text-slate-900">
                      {profile.nextPaydayDays} días
                    </strong>{" "}
                    (${profile.nextPaydayAmount.toLocaleString()} MXN)
                  </p>
                </div>
              </div>

              <div className="sm:text-right">
                <span className="text-xs font-semibold text-slate-500 block">
                  Disponible para gastar hoy:
                </span>
                <span className="text-2xl sm:text-3xl font-bold font-heading text-slate-900 tracking-tight">
                  ${financialMetrics.safeToSpend.toLocaleString()}{" "}
                  <span className="text-sm font-semibold text-slate-400">
                    MXN
                  </span>
                </span>
              </div>
            </div>

            {/* Clean 3-Segment Horizontal Liquidity Bar */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden flex gap-0.5 p-0.5 border border-slate-200/80">
                <div
                  style={{ width: `${financialMetrics.fixedPct}%` }}
                  className="h-full rounded-l-full bg-slate-400 transition-all duration-500"
                />
                <div
                  style={{ width: `${financialMetrics.bufferPct}%` }}
                  className="h-full bg-slate-300 transition-all duration-500"
                />
                <div
                  style={{ width: `${financialMetrics.freePct}%` }}
                  className={`h-full rounded-r-full transition-all duration-500 ${
                    financialMetrics.isDeficit &&
                    selectedDecision !== "wait" &&
                    selectedDecision !== "microsave"
                      ? "bg-amber-500"
                      : "bg-[#10B981]"
                  }`}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-xs text-slate-600">
                <span>
                  <strong className="text-slate-900">
                    Saldo ${financialMetrics.totalBalance.toLocaleString()}
                  </strong>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  Apartado para renta y pagos fijos: −$
                  {financialMetrics.fixedAndRentTotal.toLocaleString()}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-300" />
                  Colchón: −${financialMetrics.safetyBuffer.toLocaleString()}
                </span>
                <span className="flex items-center gap-1.5 font-bold text-emerald-700">
                  <span className="w-2 h-2 rounded-full bg-[#10B981]" />= Libre
                  hoy: ${financialMetrics.safeToSpend.toLocaleString()}
                </span>
              </div>
            </div>
          </motion.section>

          {/* 2. Full-Width Simulator Card with Generous Whitespace (p-8) */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6"
          >
            <div className="space-y-1">
              <h1 className="text-xl sm:text-2xl font-bold font-heading text-slate-900 tracking-tight">
                ¿Qué estás pensando comprar?
              </h1>
              <p className="text-sm text-slate-500">
                Escribe el artículo y su precio, elige un ejemplo rápido o
                escanea una captura de tienda.
              </p>
            </div>

            {/* Clean Search Input Bar with Integrated Camera Icon on the Right */}
            <div className="relative flex items-center">
              <Search
                className="w-5 h-5 text-slate-400 absolute left-4 pointer-events-none"
                strokeWidth={1.5}
              />
              <input
                type="text"
                value={queryText}
                onChange={(e) => handleQueryInputChange(e.target.value)}
                placeholder="Ej. Audífonos $2,300 o Tenis $1,800..."
                className="w-full h-14 pl-12 pr-36 rounded-2xl border border-slate-200 bg-slate-50/70 text-base font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#10B981] focus:ring-2 focus:ring-emerald-500/15 focus:outline-none transition-all"
              />
              <div className="absolute right-2 flex items-center gap-1.5">
                {queryText && (
                  <button
                    type="button"
                    onClick={() => {
                      playTap();
                      setQueryText("");
                      setParsedItemName("");
                      setParsedItemPrice(0);
                      setSelectedDecision("idle");
                      setScannedThumbnailUrl(null);
                      setScannedStoreTag(null);
                    }}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                    title="Limpiar"
                  >
                    <X className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                )}
                {/* Integrated Clean Camera Button inside Input */}
                <QuickSnapScanner
                  inlineIconTrigger
                  onScanComplete={handleScanComplete}
                />
              </div>
            </div>

            {/* Horizontal Quick Example Pills (Never truncated, rounded-full px-4 py-2, flex-wrap) */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Ejemplos rápidos:
              </span>
              <div className="flex flex-wrap items-center gap-2.5">
                {QUICK_EXAMPLE_PILLS.map((pill) => {
                  const isSelected = parsedItemPrice === pill.price;
                  return (
                    <motion.button
                      key={pill.id}
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleSelectExamplePill(pill)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition-all cursor-pointer border ${
                        isSelected
                          ? "bg-[#10B981] text-white border-[#10B981] shadow-sm"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-2xs"
                      }`}
                    >
                      {pill.label}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Scanned Capture Preview Pill (if scanned via camera) */}
            {scannedThumbnailUrl && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={scannedThumbnailUrl}
                    alt={parsedItemName}
                    className="w-12 h-12 rounded-xl object-cover border border-slate-200 bg-white shrink-0"
                  />
                  <div className="min-w-0">
                    <span className="text-[11px] font-semibold text-emerald-700 block">
                      Captura analizada · {scannedStoreTag}
                    </span>
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {parsedItemName} · ${parsedItemPrice.toLocaleString()} MXN
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    playTap();
                    setScannedThumbnailUrl(null);
                    setScannedStoreTag(null);
                  }}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </div>
            )}
          </motion.section>

          {/* 3. THE 3 DECISION OPTIONS (Only displayed AFTER the user selects or types a product) */}
          <AnimatePresence mode="wait">
            {hasSelectedProduct && (
              <motion.section
                key={`decision-options-${parsedItemPrice}`}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                  <h2 className="text-lg font-bold font-heading text-slate-900">
                    3 caminos para:{" "}
                    <span className="text-emerald-700">
                      {parsedItemName} (${parsedItemPrice.toLocaleString()} MXN)
                    </span>
                  </h2>
                  <span className="text-xs font-medium text-slate-500">
                    Selecciona la opción que prefieras para continuar
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* TARJETA 1: Comprar hoy */}
                  <motion.div
                    whileHover={{ y: -2 }}
                    className={`rounded-3xl bg-white border p-6 shadow-sm flex flex-col justify-between gap-5 transition-all ${
                      selectedDecision === "bought"
                        ? "border-amber-400 ring-2 ring-amber-400/20"
                        : "border-slate-200"
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          {financialMetrics.isDeficit
                            ? `Te faltan $${financialMetrics.missingLiquidity.toLocaleString()} de liquidez libre`
                            : `Reduce tu margen a $${Math.max(
                                0,
                                financialMetrics.netAfterPurchase
                              ).toLocaleString()}`}
                        </span>
                        <ShoppingBag
                          className="w-4 h-4 text-slate-400 shrink-0"
                          strokeWidth={1.5}
                        />
                      </div>

                      <h3 className="text-lg font-bold font-heading text-slate-900">
                        Comprar hoy
                      </h3>

                      <p className="text-sm text-slate-600 leading-relaxed">
                        {financialMetrics.isDeficit
                          ? `Tomaría $${financialMetrics.missingLiquidity.toLocaleString()} MXN del dinero apartado para tu renta/pagos fijos y retrasaría tu meta "${profile.goal.title}" ${financialMetrics.weeksGoalDelayed} semanas.`
                          : `Cubres el gasto con tu dinero libre hoy, pero retrasas tu meta "${profile.goal.title}" aproximadamente ${financialMetrics.weeksGoalDelayed} semanas.`}
                      </p>
                    </div>

                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      onClick={handleDecisionBuyToday}
                      className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Registrar compra hoy
                    </motion.button>
                  </motion.div>

                  {/* TARJETA 2 (Destacada con borde esmeralda suave): Esperar a tu nómina */}
                  <motion.div
                    whileHover={{ y: -2 }}
                    className={`rounded-3xl bg-white border-2 p-6 shadow-sm flex flex-col justify-between gap-5 transition-all ${
                      selectedDecision === "wait"
                        ? "border-[#10B981] ring-4 ring-emerald-500/15"
                        : "border-emerald-400/80"
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <Sparkles
                            className="w-3 h-3 text-emerald-600"
                            strokeWidth={1.5}
                          />
                          Decisión recomendada · +50 XP
                        </span>
                        <Clock
                          className="w-4 h-4 text-emerald-600 shrink-0"
                          strokeWidth={1.5}
                        />
                      </div>

                      <h3 className="text-lg font-bold font-heading text-slate-900">
                        Esperar a tu nómina (en {profile.nextPaydayDays} días)
                      </h3>

                      <p className="text-sm text-slate-600 leading-relaxed">
                        En {profile.nextPaydayDays} días recibes tu ingreso de $
                        {profile.nextPaydayAmount.toLocaleString()} MXN y lo
                        compras con tranquilidad sin tocar el dinero de tus
                        pagos fijos.
                      </p>
                    </div>

                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      onClick={handleDecisionWaitPayroll}
                      className="w-full h-11 rounded-xl bg-[#10B981] hover:bg-emerald-600 text-white text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Elegir esperar {profile.nextPaydayDays} días</span>
                      <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                    </motion.button>
                  </motion.div>

                  {/* TARJETA 3: Plan de Micro-ahorro */}
                  <motion.div
                    whileHover={{ y: -2 }}
                    className={`rounded-3xl bg-white border p-6 shadow-sm flex flex-col justify-between gap-5 transition-all ${
                      selectedDecision === "microsave"
                        ? "border-indigo-400 ring-2 ring-indigo-400/20"
                        : "border-slate-200"
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200">
                          Sin estrés · +100 XP
                        </span>
                        <CalendarCheck
                          className="w-4 h-4 text-indigo-600 shrink-0"
                          strokeWidth={1.5}
                        />
                      </div>

                      <h3 className="text-lg font-bold font-heading text-slate-900">
                        Plan de Micro-ahorro
                      </h3>

                      <p className="text-sm text-slate-600 leading-relaxed">
                        Aparta{" "}
                        <strong className="text-slate-900">
                          ${financialMetrics.suggestedWeeklySave}/semana
                        </strong>{" "}
                        y cómpralo en{" "}
                        <strong className="text-slate-900">
                          {financialMetrics.microSaveWeeks} semanas
                        </strong>{" "}
                        manteniendo intacto tu colchón y tu meta principal.
                      </p>
                    </div>

                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      onClick={handleDecisionMicroSave}
                      className="w-full h-11 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Activar plan de ${financialMetrics.suggestedWeeklySave}/sem
                    </motion.button>
                  </motion.div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          {/* Saved Wishlist Summary Strip */}
          {profile.wishlist && profile.wishlist.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-2xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-sm text-slate-700 truncate">
                <BookmarkCheck
                  className="w-4 h-4 text-emerald-600 shrink-0"
                  strokeWidth={1.5}
                />
                <span className="truncate">
                  Planeados con sabiduría:{" "}
                  <strong className="text-slate-900">
                    {profile.wishlist
                      .slice(0, 3)
                      .map((w) => `${w.name} ($${w.price.toLocaleString()})`)
                      .join(" · ")}
                  </strong>
                </span>
              </div>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-0.5 rounded-full shrink-0">
                Decisiones activas
              </span>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          VIEW 2: "TU PLANTA" (Dedicated Large Evolutionary Tree, 5 Levels & Goals)
         ===================================================================== */}
      {activeBottomTab === "home" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Large Protagonist Evolutionary Tree */}
          <FinancialPlantWidget
            simulationState={plantSimulationState}
            previewDamagePrice={0}
            recoveredXpBonus={decisionXpBonus}
            allowLevelPreview
          />

          {/* 5 Evolutionary Levels Reference Grid (Supervivencia -> Abundancia) */}
          <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-lg sm:text-xl font-bold font-heading text-slate-900">
                  Los 5 Niveles de Evolución Financiera
                </h2>
                <p className="text-sm text-slate-500">
                  Cada vez que evalúas antes de comprar o eliges esperar, tu
                  planta suma sabiduría.
                </p>
              </div>
              <Award
                className="w-6 h-6 text-emerald-600 shrink-0"
                strokeWidth={1.5}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              {FIVE_EVOLUTION_LEVELS.map((item) => {
                const isCurrent =
                  item.level === financialMetrics.currentLevel;
                return (
                  <div
                    key={item.level}
                    className={`rounded-2xl border p-4 flex flex-col justify-between gap-2 transition-all ${
                      isCurrent
                        ? "border-[#10B981] bg-emerald-50/40 shadow-2xs"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-700">
                          Nivel {item.level}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] font-bold bg-[#10B981] text-white px-2 py-0.5 rounded-full">
                            Actual
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-bold font-heading text-slate-900">
                        {item.title}
                      </p>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 pt-2 border-t border-slate-100">
                      {item.milestone}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Progress of User's Savings Goal */}
          <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                  <Target
                    className="w-5 h-5 text-emerald-600"
                    strokeWidth={1.5}
                  />
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">
                    Progreso de tu meta principal
                  </span>
                  <h3 className="text-lg font-bold font-heading text-slate-900">
                    {profile.goal.title}
                  </h3>
                </div>
              </div>
              <span className="text-xl font-bold font-heading text-emerald-600">
                {financialMetrics.goalPct}%
              </span>
            </div>

            <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden p-0.5 border border-slate-200">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${financialMetrics.goalPct}%` }}
                className="h-full rounded-full bg-[#10B981]"
              />
            </div>

            <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-600 font-medium">
              <span>
                Ahorrado actual:{" "}
                <strong className="text-slate-900">
                  ${profile.goal.currentSaved.toLocaleString()} MXN
                </strong>
              </span>
              <span>
                Meta objetivo:{" "}
                <strong className="text-slate-900">
                  ${profile.goal.targetAmount.toLocaleString()} MXN
                </strong>
              </span>
            </div>
          </section>
        </motion.div>
      )}

      {/* =====================================================================
          VIEW 3: "RETOS Y METAS"
         ===================================================================== */}
      {activeBottomTab === "goals" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                  <Trophy
                    className="w-5 h-5 text-emerald-600"
                    strokeWidth={1.5}
                  />
                </div>
                <div>
                  <h2 className="text-xl font-bold font-heading text-slate-900">
                    Retos y Metas Financieras
                  </h2>
                  <p className="text-sm text-slate-500">
                    Mantén tu racha evaluando tus compras antes de pagar
                  </p>
                </div>
              </div>
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={() => playLevelUp()}
                className="px-4 py-2 rounded-xl bg-[#10B981] text-white text-xs font-semibold cursor-pointer"
              >
                Celebrar avance
              </motion.button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-1">
                <span className="text-xs font-semibold text-slate-500">
                  Racha actual
                </span>
                <p className="text-2xl font-bold font-heading text-slate-900">
                  {profile.streakCount ?? 3} días consecutivos
                </p>
                <p className="text-xs text-slate-600">
                  Consultando al simulador antes de realizar compras no
                  planeadas.
                </p>
              </div>

              <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-1">
                <span className="text-xs font-semibold text-slate-500">
                  Experiencia acumulada
                </span>
                <p className="text-2xl font-bold font-heading text-emerald-600">
                  {profile.wisdomXp ?? 120} XP
                </p>
                <p className="text-xs text-slate-600">
                  Nivel {financialMetrics.currentLevel}:{" "}
                  {financialMetrics.currentLevelName}
                </p>
              </div>
            </div>

            {/* Active Goal Card */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-white space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900">
                  Meta: {profile.goal.title}
                </span>
                <span className="text-sm font-bold text-emerald-600">
                  {financialMetrics.goalPct}% completado
                </span>
              </div>
              <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden p-0.5 border border-slate-200">
                <div
                  style={{ width: `${financialMetrics.goalPct}%` }}
                  className="h-full rounded-full bg-[#10B981]"
                />
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>
                  Ahorrado: ${profile.goal.currentSaved.toLocaleString()} MXN
                </span>
                <span>
                  Objetivo: ${profile.goal.targetAmount.toLocaleString()} MXN
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* =====================================================================
          VIEW 4: "CAMBIAR PERFIL"
         ===================================================================== */}
      {activeBottomTab === "profile" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <UserCheck
                  className="w-5 h-5 text-emerald-600"
                  strokeWidth={1.5}
                />
              </div>
              <div>
                <h2 className="text-xl font-bold font-heading text-slate-900">
                  Cambiar Perfil de Simulación
                </h2>
                <p className="text-sm text-slate-500">
                  Elige un perfil precargado o configura tus datos desde cero
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(["carlos", "mateo"] as const).map((key) => {
                const item = PRELOADED_SANDBOX_PROFILES[key];
                const isCurrent = profile.id === item.id;
                return (
                  <motion.button
                    key={key}
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      playCoin();
                      loadPreloadedSandboxProfile(key);
                      setActiveBottomTab("simulate");
                      triggerToast(`Perfil cargado: ${item.name}`);
                    }}
                    className={`text-left p-5 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                      isCurrent
                        ? "bg-emerald-50/50 border-[#10B981] shadow-2xs"
                        : "bg-white border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="space-y-1">
                      <p className="text-base font-bold font-heading text-slate-900">
                        {item.name}
                      </p>
                      <p className="text-xs text-slate-600">
                        Saldo: ${item.currentBalance.toLocaleString()} MXN ·{" "}
                        {item.commitments.length} compromisos fijos
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Meta: {item.goal.title} ($
                        {item.goal.targetAmount.toLocaleString()})
                      </p>
                    </div>
                    {isCurrent && (
                      <CheckCircle2
                        className="w-5 h-5 text-[#10B981] shrink-0"
                        strokeWidth={1.5}
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>

            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                playTap();
                router.push("/onboarding");
              }}
              className="w-full h-12 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-sm font-semibold text-slate-800 flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4" strokeWidth={1.5} />
              <span>Personalizar perfil desde cero (Onboarding)</span>
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* Discreet Floating Pill: Quick Text Expense */}
      <div className="fixed bottom-20 md:bottom-6 right-4 z-30 pointer-events-auto">
        <AnimatePresence mode="wait">
          {!isQuickExpenseOpen ? (
            <motion.button
              key="collapsed-quick-expense"
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                playTap();
                setIsQuickExpenseOpen(true);
              }}
              className="h-10 px-4 rounded-full bg-white text-slate-800 shadow-md text-xs font-semibold flex items-center gap-2 cursor-pointer border border-slate-200 hover:border-slate-300"
            >
              <span>Registrar gasto rápido</span>
            </motion.button>
          ) : (
            <motion.form
              key="expanded-quick-expense"
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              onSubmit={handleQuickExpenseSubmit}
              className="w-80 sm:w-96 rounded-2xl bg-white border border-slate-200 shadow-xl p-2 flex items-center gap-2"
            >
              <input
                type="text"
                autoFocus
                value={quickExpenseInput}
                onChange={(e) => setQuickExpenseInput(e.target.value)}
                placeholder='Ej. "Gasté 150 en comida"'
                className="flex-1 h-9 px-3 text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 bg-transparent focus:outline-none"
              />
              <motion.button
                type="submit"
                whileTap={{ scale: 0.96 }}
                className="h-9 px-3.5 rounded-xl bg-[#10B981] text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>Guardar</span>
              </motion.button>
              <button
                type="button"
                onClick={() => {
                  playTap();
                  setIsQuickExpenseOpen(false);
                }}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      {/* Toast Visual Feedback */}
      <AnimatePresence>
        {toastFeedback && (
          <motion.div
            key={toastFeedback.id}
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-40 rounded-2xl bg-slate-900 text-white px-4 py-2.5 shadow-lg flex items-center gap-2.5 text-xs font-semibold max-w-sm w-[90%]"
          >
            <CheckCircle2
              className="w-4 h-4 text-[#10B981] shrink-0"
              strokeWidth={1.5}
            />
            <span className="truncate">{toastFeedback.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3-Slide Interactive Quick Guide Modal */}
      <QuickGuideModal
        isOpen={showTourModal}
        onClose={() => setShowTourModal(false)}
      />
    </AppShell>
  );
}
