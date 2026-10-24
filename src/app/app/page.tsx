"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Compass,
  ChevronDown,
  HelpCircle,
  Sparkles,
  Camera,
  ArrowRight,
  CheckCircle2,
  SlidersHorizontal,
  UserCheck,
  X,
  Send,
  Calendar,
  BookmarkCheck,
  Loader2,
  Flame,
  Trophy,
  Target,
  Zap,
  Headphones,
  Footprints,
  Gamepad2,
  Utensils,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import PurchaseEvaluationFlow from "@/components/PurchaseEvaluationFlow";
import QuickGuideModal from "@/components/QuickGuideModal";
import FinancialPlantWidget from "@/components/FinancialPlantWidget";
import QuincenaEnergyGauge from "@/components/QuincenaEnergyGauge";
import QuickSnapScanner, {
  type ScannedProductResult,
} from "@/components/QuickSnapScanner";
import BottomNav, { type BottomNavTab } from "@/components/BottomNav";
import {
  useFinancial,
  PRELOADED_SANDBOX_PROFILES,
} from "@/context/FinancialContext";
import type { EvaluateApiResponse } from "@/app/api/evaluate/route";

const QUICK_PURCHASE_EXAMPLES = [
  {
    label: "Audífonos $2,300",
    name: "Audífonos Inalámbricos Sony",
    price: 2300,
    icon: Headphones,
    gradient: "from-emerald-50 to-teal-50/60 border-emerald-200/80",
  },
  {
    label: "Tenis $1,800",
    name: "Tenis Deportivos",
    price: 1800,
    icon: Footprints,
    gradient: "from-amber-50 to-orange-50/60 border-amber-200/80",
  },
  {
    label: "Videojuego $1,200",
    name: "Videojuego Edición Estándar",
    price: 1200,
    icon: Gamepad2,
    gradient: "from-sky-50 to-indigo-50/60 border-sky-200/80",
  },
  {
    label: "Cena $550",
    name: "Cena con amigos",
    price: 550,
    icon: Utensils,
    gradient: "from-rose-50 to-pink-50/60 border-rose-200/80",
  },
];

const FIRST_VISIT_GUIDE_KEY = "antesdegastar_seen_quick_guide_v1";

export default function AppDashboardPage() {
  const router = useRouter();
  const {
    profile,
    updateProfile,
    loadPreloadedSandboxProfile,
    setPendingEvaluation,
    incrementStreak,
    streakCelebration,
  } = useFinancial();

  // Mobile-First Navigation & Progressive Disclosure States
  const [activeBottomTab, setActiveBottomTab] = useState<BottomNavTab>("home");
  const [showWhyBreakdown, setShowWhyBreakdown] = useState(false);
  const [showTourModal, setShowTourModal] = useState(false);
  const [showGoalsSheet, setShowGoalsSheet] = useState(false);
  const [showProfileSheet, setShowProfileSheet] = useState(false);

  // Pre-purchase Copilot states
  const [queryText, setQueryText] = useState("Audífonos de $2,300");
  const [parsedItemName, setParsedItemName] = useState("Audífonos Inalámbricos Sony");
  const [parsedItemPrice, setParsedItemPrice] = useState<number>(2300);
  const [scannedThumbnailUrl, setScannedThumbnailUrl] = useState<string | null>(null);
  const [scannedStoreTag, setScannedStoreTag] = useState<string | null>(null);
  const [showEvaluationView, setShowEvaluationView] = useState(false);

  // /api/evaluate state
  const [apiEvaluation, setApiEvaluation] = useState<EvaluateApiResponse | null>(null);
  const [isEvaluatingApi, setIsEvaluatingApi] = useState(false);

  // Quick expense bottom bar & toast feedback
  const [isQuickExpenseOpen, setIsQuickExpenseOpen] = useState(false);
  const [quickExpenseInput, setQuickExpenseInput] = useState("");
  const [toastFeedback, setToastFeedback] = useState<{
    id: number;
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const simulatorSectionRef = useRef<HTMLElement | null>(null);

  // Auto-open the 3-slide welcome guide the first time the user enters /app
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
    }, 4000);
  };

  // Deterministic Financial Calculation
  const financialMetrics = useMemo(() => {
    const commitmentsTotal = profile.commitments
      .filter((c) => c.dueInDays <= profile.nextPaydayDays)
      .reduce((acc, c) => acc + c.amount, 0);

    const essentialLivingCost = profile.dailyEssentialBurn * profile.nextPaydayDays;

    const safeToSpend = Math.max(
      0,
      profile.currentBalance -
        commitmentsTotal -
        essentialLivingCost -
        profile.safetyBuffer
    );

    const goalPct =
      profile.goal.targetAmount > 0
        ? Math.min(
            100,
            Math.round((profile.goal.currentSaved / profile.goal.targetAmount) * 100)
          )
        : 0;

    return {
      commitmentsTotal,
      essentialLivingCost,
      safeToSpend,
      goalPct,
    };
  }, [profile]);

  // Call /api/evaluate + Increment Streak 🔥 for evaluating before spending!
  const runEvaluation = async (name: string, price: number, imageName?: string | null) => {
    setPendingEvaluation({
      name,
      price,
      imageName: imageName ?? null,
    });
    incrementStreak("¡Evaluaste antes de gastar! +1 Racha 🔥");
    setShowEvaluationView(true);
    setIsEvaluatingApi(true);

    try {
      const response = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemName: name,
          itemPrice: price,
          profile,
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as EvaluateApiResponse;
        setApiEvaluation(data);
      } else {
        setApiEvaluation(null);
      }
    } catch {
      setApiEvaluation(null);
    } finally {
      setIsEvaluatingApi(false);
    }
  };

  // Parse free-form text like "Audífonos de $2,300" or "Cafetera 1450" in real time
  const handleQueryInputChange = (value: string) => {
    setQueryText(value);

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
    } else {
      setParsedItemPrice(0);
      setParsedItemName(value.trim() || "Artículo consultado");
    }
  };

  const handleSelectExample = (example: (typeof QUICK_PURCHASE_EXAMPLES)[number]) => {
    setQueryText(example.label);
    setParsedItemName(example.name);
    setParsedItemPrice(example.price);
    setScannedThumbnailUrl(null);
    setScannedStoreTag(null);
    void runEvaluation(example.name, example.price, null);
  };

  const handleScanComplete = (scanned: ScannedProductResult) => {
    setQueryText(`${scanned.name} de $${scanned.price.toLocaleString()}`);
    setParsedItemName(scanned.name);
    setParsedItemPrice(scanned.price);
    setScannedThumbnailUrl(scanned.thumbnailDataUrl);
    setScannedStoreTag(scanned.storeTag);
    setPendingEvaluation({
      name: scanned.name,
      price: scanned.price,
      imageName: scanned.storeTag,
    });
    if (scanned.apiResponse) {
      setApiEvaluation(scanned.apiResponse);
    }
    incrementStreak("¡Escaneaste producto con IA! +1 Racha 🔥");
    setShowEvaluationView(true);
  };

  const handleAnalyzeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryText.trim() && parsedItemPrice <= 0) return;
    void runEvaluation(parsedItemName, parsedItemPrice || 1200, scannedStoreTag);
  };

  const handleQuickExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickExpenseInput.trim()) return;

    const normalized = quickExpenseInput.replace(/,/g, "");
    const match = normalized.match(/(\d+(?:\.\d+)?)/);
    if (!match) return;

    const amount = Math.round(parseFloat(match[1]));
    if (amount <= 0) return;

    updateProfile({
      currentBalance: Math.max(0, profile.currentBalance - amount),
    });

    triggerToast(
      `Gasto registrado: −$${amount.toLocaleString()} MXN (${quickExpenseInput.trim()})`
    );
    setQuickExpenseInput("");
    setIsQuickExpenseOpen(false);
  };

  const handleBottomNavSelect = (tab: BottomNavTab) => {
    setActiveBottomTab(tab);
    if (tab === "home") {
      setShowGoalsSheet(false);
      setShowProfileSheet(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (tab === "simulate") {
      setShowGoalsSheet(false);
      setShowProfileSheet(false);
      simulatorSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (tab === "goals") {
      setShowProfileSheet(false);
      setShowGoalsSheet(true);
    } else if (tab === "profile") {
      setShowGoalsSheet(false);
      setShowProfileSheet(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-slate-900 flex flex-col justify-between font-sans pb-36">
      {/* Compact Mobile-First Header with Streak Counter 🔥 */}
      <header className="sticky top-0 z-30 border-b border-[#E6E1DA]/90 bg-[#FAF8F5]/90 backdrop-blur-md">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-[#FAF8F5] flex items-center justify-center shadow-2xs">
              <Compass className="w-4 h-4" strokeWidth={1.5} />
            </div>
            <span className="text-sm font-bold tracking-tight text-slate-900">
              AntesDeGastar
            </span>
          </Link>

          <div className="flex items-center gap-2">
            {/* Streak Counter Badge 🔥 */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => handleBottomNavSelect("goals")}
              className="h-8 px-3 rounded-full bg-gradient-to-r from-orange-100 via-amber-100 to-yellow-100 border border-orange-300/80 text-orange-950 text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="Racha de Buenas Decisiones"
            >
              <Flame
                className="w-3.5 h-3.5 text-orange-600 fill-orange-500"
                strokeWidth={1.5}
              />
              <span>{profile.streakCount ?? 3}</span>
              <span className="text-[10px] font-semibold text-orange-800 hidden sm:inline">
                Racha
              </span>
            </motion.button>

            {/* Profile Pill */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => handleBottomNavSelect("profile")}
              className="h-8 px-2.5 rounded-full border border-[#E6E1DA] bg-white text-xs font-semibold text-slate-800 flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="truncate max-w-[92px]">
                {profile.name.split(" ")[0]}
              </span>
            </motion.button>

            {/* Quick Tour Help Icon */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => setShowTourModal(true)}
              className="w-8 h-8 rounded-full border border-[#E6E1DA] bg-white text-slate-600 flex items-center justify-center cursor-pointer"
              title="Guía rápida"
            >
              <HelpCircle className="w-4 h-4" strokeWidth={1.5} />
            </motion.button>
          </div>
        </div>
      </header>

      {/* Celebratory Streak Popup Banner 🔥 */}
      <AnimatePresence>
        {streakCelebration && (
          <motion.div
            key={streakCelebration.id}
            initial={{ opacity: 0, y: -24, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -18, scale: 0.92 }}
            transition={{ type: "spring", stiffness: 360, damping: 22 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 rounded-full bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 text-white px-4 py-2 shadow-lg flex items-center gap-2 text-xs font-bold whitespace-nowrap border-2 border-white"
          >
            <Flame className="w-4 h-4 fill-white text-white" strokeWidth={1.5} />
            <span>
              ¡Racha de {streakCelebration.count}! · {streakCelebration.reason}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Mobile-First Feed */}
      <main className="flex-1 max-w-lg w-full mx-auto px-4 pt-4 space-y-4">
        {/* 1. Protagonist Gamified Financial Plant Widget */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <FinancialPlantWidget
            simulationState={
              financialMetrics.safeToSpend < parsedItemPrice && parsedItemPrice > 0
                ? "danger"
                : "normal"
            }
          />
        </motion.section>

        {/* 2. Hero Liquidity Card (Single Protagonist Number + Visual Cues) */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.04 }}
        >
          <Card className="bg-gradient-to-br from-white via-white to-emerald-50/40 border-[#E2DCD3] shadow-xs rounded-3xl py-5 px-1">
            <CardContent className="px-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">
                  Hoy puedes gastar con tranquilidad:
                </span>
                <Badge
                  variant="outline"
                  className="border-emerald-300 bg-emerald-50 text-emerald-900 text-[11px] font-semibold"
                >
                  Nómina en {profile.nextPaydayDays}d
                </Badge>
              </div>

              <div className="flex items-baseline justify-between gap-2">
                <div className="flex items-baseline gap-1.5">
                  <motion.span
                    key={financialMetrics.safeToSpend}
                    initial={{ scale: 0.94 }}
                    animate={{ scale: 1 }}
                    className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 font-mono"
                  >
                    ${financialMetrics.safeToSpend.toLocaleString()}
                  </motion.span>
                  <span className="text-xs font-bold text-slate-400">MXN</span>
                </div>

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setShowWhyBreakdown((prev) => !prev)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 bg-[#FAF8F5] hover:bg-[#F3EFEA] border border-[#E6E1DA] px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                >
                  <span>¿Por qué este monto?</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      showWhyBreakdown ? "rotate-180" : ""
                    }`}
                    strokeWidth={1.5}
                  />
                </motion.button>
              </div>

              <AnimatePresence initial={false}>
                {showWhyBreakdown && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-3 mt-1 border-t border-[#EFECE6] grid grid-cols-2 gap-2">
                      <div className="p-2.5 rounded-2xl bg-[#FAF8F5] border border-[#E6E1DA]">
                        <span className="text-[10px] text-slate-500 block">
                          Saldo en cuenta
                        </span>
                        <span className="text-xs font-bold text-slate-900 font-mono">
                          ${profile.currentBalance.toLocaleString()}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-2xl bg-rose-50/60 border border-rose-200/70">
                        <span className="text-[10px] text-rose-700 block">
                          Pagos fijos ({profile.commitments.length})
                        </span>
                        <span className="text-xs font-bold text-rose-800 font-mono">
                          −${financialMetrics.commitmentsTotal.toLocaleString()}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-2xl bg-amber-50/60 border border-amber-200/70">
                        <span className="text-[10px] text-amber-800 block">
                          Vital ({profile.nextPaydayDays} días)
                        </span>
                        <span className="text-xs font-bold text-amber-900 font-mono">
                          −${financialMetrics.essentialLivingCost.toLocaleString()}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-2xl bg-emerald-50/60 border border-emerald-200/70">
                        <span className="text-[10px] text-emerald-800 block">
                          Colchón paz
                        </span>
                        <span className="text-xs font-bold text-emerald-900 font-mono">
                          −${profile.safetyBuffer.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.section>

        {/* 3. Real-Time Spring Speedometer / Thermometer of Quincena Energy */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
        >
          <QuincenaEnergyGauge
            safeToSpend={financialMetrics.safeToSpend}
            previewPrice={parsedItemPrice}
            nextPaydayDays={profile.nextPaydayDays}
          />
        </motion.section>

        {/* 4. El Copiloto Pre-Compra (Interactive Cards & Chips with Micro-interactions) */}
        <motion.section
          ref={simulatorSectionRef}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.12 }}
          className="space-y-3"
        >
          <Card className="bg-white border-[#E2DCD3] shadow-xs rounded-3xl py-5 px-1">
            <CardContent className="px-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center">
                    <Sparkles className="w-4 h-4" strokeWidth={1.5} />
                  </div>
                  <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">
                    ¿Qué estás pensando comprar hoy?
                  </h2>
                </div>
                <span className="text-[11px] font-semibold text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                  +1 🔥 al evaluar
                </span>
              </div>

              {/* QuickSnapScanner: 📸 Escanear producto o captura de tienda */}
              <QuickSnapScanner onScanComplete={handleScanComplete} />

              {/* Scanned Thumbnail Pill if available */}
              {scannedThumbnailUrl && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-2.5 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={scannedThumbnailUrl}
                      alt={parsedItemName}
                      className="w-11 h-11 rounded-xl object-cover border border-white shadow-2xs shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                        ✓ Captura escaneada · {scannedStoreTag}
                      </span>
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {parsedItemName} ·{" "}
                        <span className="font-mono text-emerald-800">
                          ${parsedItemPrice.toLocaleString()} MXN
                        </span>
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setScannedThumbnailUrl(null);
                      setScannedStoreTag(null);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </button>
                </motion.div>
              )}

              <form onSubmit={handleAnalyzeSubmit} className="space-y-2.5">
                <div className="relative">
                  <input
                    type="text"
                    value={queryText}
                    onChange={(e) => handleQueryInputChange(e.target.value)}
                    placeholder='O escribe precio: ej. "Tenis 1800" o "Cena 450"'
                    className="w-full h-12 px-4 rounded-2xl border border-[#DCD5CA] bg-[#FAF8F5] text-sm sm:text-base font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-emerald-600 focus:outline-none transition-all"
                  />
                </div>

                <motion.button
                  type="submit"
                  whileTap={{ scale: 0.96 }}
                  disabled={isEvaluatingApi}
                  className="w-full h-12 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-[#FAF8F5] font-bold text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  {isEvaluatingApi ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
                      <span>Analizando impacto...</span>
                    </>
                  ) : (
                    <>
                      <span>Analizar compra</span>
                      <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                    </>
                  )}
                </motion.button>
              </form>

              {/* Interactive Gradient Quick Purchase Chips */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Toca un antojo rápido para simular:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_PURCHASE_EXAMPLES.map((example) => {
                    const Icon = example.icon;
                    const isSelected = parsedItemPrice === example.price;
                    return (
                      <motion.button
                        key={example.label}
                        type="button"
                        whileTap={{ scale: 0.96 }}
                        onClick={() => handleSelectExample(example)}
                        className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-2.5 cursor-pointer bg-gradient-to-br ${
                          example.gradient
                        } ${
                          isSelected
                            ? "ring-2 ring-slate-900 shadow-xs"
                            : "hover:opacity-90"
                        }`}
                      >
                        <div className="w-8 h-8 rounded-xl bg-white/90 border border-white text-slate-800 flex items-center justify-center shrink-0 shadow-2xs">
                          <Icon className="w-4 h-4" strokeWidth={1.5} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {example.name.split(" ")[0]}
                          </p>
                          <p className="text-[11px] font-mono font-semibold text-slate-600">
                            ${example.price.toLocaleString()}
                          </p>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Saved Wishlist Pill */}
          {profile.wishlist && profile.wishlist.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50/80 to-white px-4 py-3 flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2 text-xs font-medium text-emerald-950 truncate">
                <BookmarkCheck
                  className="w-4 h-4 text-emerald-700 shrink-0"
                  strokeWidth={1.5}
                />
                <span className="truncate">
                  En deseos:{" "}
                  {profile.wishlist
                    .map((w) => `${w.name} ($${w.price.toLocaleString()})`)
                    .join(" · ")}
                </span>
              </div>
              <span className="text-[10px] font-bold text-emerald-800 bg-white px-2 py-0.5 rounded-full border border-emerald-200 shrink-0">
                +50 XP
              </span>
            </motion.div>
          )}
        </motion.section>
      </main>

      {/* Discreet Floating Pill Above BottomNav: Quick Text Expense */}
      <div className="fixed bottom-20 inset-x-0 z-30 px-4 pointer-events-none">
        <div className="max-w-lg mx-auto flex justify-end pointer-events-auto">
          <AnimatePresence mode="wait">
            {!isQuickExpenseOpen ? (
              <motion.button
                key="collapsed-quick-expense"
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={() => setIsQuickExpenseOpen(true)}
                className="h-10 px-4 rounded-full bg-slate-900 text-[#FAF8F5] shadow-md text-xs font-semibold flex items-center gap-2 cursor-pointer border border-slate-700"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" strokeWidth={1.5} />
                <span>Gasto rápido (“Gasté 150”)</span>
              </motion.button>
            ) : (
              <motion.form
                key="expanded-quick-expense"
                initial={{ opacity: 0, y: 10, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                onSubmit={handleQuickExpenseSubmit}
                className="w-full rounded-2xl bg-white border border-slate-300 shadow-xl p-2 flex items-center gap-2"
              >
                <input
                  type="text"
                  autoFocus
                  value={quickExpenseInput}
                  onChange={(e) => setQuickExpenseInput(e.target.value)}
                  placeholder='Ej. "Gasté 150 en comida"'
                  className="flex-1 h-9 px-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 bg-transparent focus:outline-none"
                />
                <motion.button
                  type="submit"
                  whileTap={{ scale: 0.96 }}
                  className="h-9 px-3.5 rounded-xl bg-slate-900 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>Restar</span>
                </motion.button>
                <button
                  type="button"
                  onClick={() => setIsQuickExpenseOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Sheet Modal: Retos y Metas (Tab 3 of BottomNav) */}
      <AnimatePresence>
        {showGoalsSheet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-end sm:items-center justify-center p-3"
            onClick={() => {
              setShowGoalsSheet(false);
              setActiveBottomTab("home");
            }}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-3xl bg-[#FAF8F5] border border-[#E6E1DA] shadow-xl p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-600" strokeWidth={1.5} />
                  <h3 className="text-base font-bold text-slate-900">
                    Retos, Rachas y tu Meta
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowGoalsSheet(false);
                    setActiveBottomTab("home");
                  }}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </div>

              {/* Active Streak Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-[11px] uppercase tracking-wider opacity-90 font-semibold">
                    Racha de Buenas Decisiones
                  </span>
                  <p className="text-2xl font-bold font-mono">
                    {profile.streakCount ?? 3} seguidas 🔥
                  </p>
                  <p className="text-xs opacity-90">
                    Suma +1 cada vez que evalúas o decides esperar.
                  </p>
                </div>
                <Flame className="w-10 h-10 text-white/90 fill-white/30" strokeWidth={1.5} />
              </div>

              {/* Active Savings Goal Progress */}
              <div className="p-4 rounded-2xl bg-white border border-[#E6E1DA] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-emerald-700" strokeWidth={1.5} />
                    <span className="text-xs font-bold text-slate-900">
                      {profile.goal.title}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-700">
                    {financialMetrics.goalPct}%
                  </span>
                </div>

                <div className="h-3 w-full rounded-full bg-[#F3EFEA] overflow-hidden p-0.5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${financialMetrics.goalPct}%` }}
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                  />
                </div>

                <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                  <span>Ahorrado: ${profile.goal.currentSaved.toLocaleString()}</span>
                  <span>Meta: ${profile.goal.targetAmount.toLocaleString()}</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sheet Modal: Cambiar Perfil (Tab 4 of BottomNav) */}
      <AnimatePresence>
        {showProfileSheet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-end sm:items-center justify-center p-3"
            onClick={() => {
              setShowProfileSheet(false);
              setActiveBottomTab("home");
            }}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-3xl bg-[#FAF8F5] border border-[#E6E1DA] shadow-xl p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-emerald-700" strokeWidth={1.5} />
                  <h3 className="text-base font-bold text-slate-900">
                    Cambiar Perfil o Contexto
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileSheet(false);
                    setActiveBottomTab("home");
                  }}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </div>

              <div className="space-y-2">
                {(["carlos", "mateo"] as const).map((key) => {
                  const item = PRELOADED_SANDBOX_PROFILES[key];
                  const isCurrent = profile.id === item.id;
                  return (
                    <motion.button
                      key={key}
                      type="button"
                      whileTap={{ scale: 0.96 }}
                      onClick={() => {
                        loadPreloadedSandboxProfile(key);
                        setShowProfileSheet(false);
                        setActiveBottomTab("home");
                        triggerToast(`Perfil activo: ${item.name}`);
                      }}
                      className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                        isCurrent
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-white text-slate-900 border-[#E6E1DA]"
                      }`}
                    >
                      <div>
                        <p className="text-sm font-bold">{item.name}</p>
                        <p
                          className={`text-xs ${
                            isCurrent ? "text-slate-300" : "text-slate-500"
                          }`}
                        >
                          Saldo ${item.currentBalance.toLocaleString()} ·{" "}
                          {item.commitments.length} compromisos fijos
                        </p>
                      </div>
                      {isCurrent && (
                        <CheckCircle2
                          className="w-4 h-4 text-emerald-400 shrink-0"
                          strokeWidth={1.5}
                        />
                      )}
                    </motion.button>
                  );
                })}
              </div>

              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={() => router.push("/onboarding")}
                className="w-full h-11 rounded-2xl border border-[#DCD5CA] bg-white text-xs font-bold text-slate-800 flex items-center justify-center gap-2 cursor-pointer"
              >
                <SlidersHorizontal className="w-4 h-4" strokeWidth={1.5} />
                <span>Personalizar desde cero (Onboarding)</span>
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen Animated Panel inside /app for Interactive Purchase Evaluation */}
      <AnimatePresence>
        {showEvaluationView && (
          <motion.div
            key="evaluation-fullscreen-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs overflow-y-auto flex items-start sm:items-center justify-center p-2.5 sm:p-6 pb-20"
            onClick={() => setShowEvaluationView(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xl my-auto"
            >
              <PurchaseEvaluationFlow
                itemName={parsedItemName}
                itemPrice={parsedItemPrice}
                thumbnailDataUrl={scannedThumbnailUrl}
                storeTag={scannedStoreTag}
                apiEvaluation={apiEvaluation}
                isLoadingApi={isEvaluatingApi}
                onClose={() => setShowEvaluationView(false)}
                onActionCompleted={(msg) => triggerToast(msg)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Visual Feedback */}
      <AnimatePresence>
        {toastFeedback && (
          <motion.div
            key={toastFeedback.id}
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 rounded-2xl bg-slate-900 text-[#FAF8F5] px-4 py-2.5 shadow-lg border border-slate-800 flex items-center gap-2.5 text-xs font-semibold max-w-sm w-[90%]"
          >
            <CheckCircle2
              className="w-4 h-4 text-emerald-400 shrink-0"
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

      {/* Native-Style Fixed Mobile Bottom Navigation */}
      <BottomNav
        activeTab={activeBottomTab}
        onSelectTab={handleBottomNavSelect}
      />
    </div>
  );
}
