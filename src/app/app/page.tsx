"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
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
  Zap,
  Shield,
  FlaskConical,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import AppShell from "@/components/AppShell";
import QuickGuideModal from "@/components/QuickGuideModal";
import FinancialPlantWidget, {
  type PlantSimulationState,
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

const GAME_PURCHASE_CHIPS = [
  {
    id: "audifonos",
    emoji: "🎧",
    label: "🎧 Audífonos $2,300",
    name: "Audífonos Sony",
    price: 2300,
    style:
      "from-emerald-50 to-teal-50 border-emerald-300 border-b-emerald-500 text-slate-900",
  },
  {
    id: "juego",
    emoji: "🎮",
    label: "🎮 Juego $1,200",
    name: "Videojuego",
    price: 1200,
    style:
      "from-sky-50 to-indigo-50 border-sky-300 border-b-sky-500 text-slate-900",
  },
  {
    id: "tenis",
    emoji: "👟",
    label: "👟 Tenis $1,800",
    name: "Tenis Deportivos",
    price: 1800,
    style:
      "from-amber-50 to-orange-50 border-amber-300 border-b-amber-500 text-slate-900",
  },
  {
    id: "ubereats",
    emoji: "🍔",
    label: "🍔 UberEats $350",
    name: "UberEats Cena",
    price: 350,
    style:
      "from-rose-50 to-pink-50 border-rose-300 border-b-rose-500 text-slate-900",
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
    addToWishlist,
    registerPurchaseAnyway,
    streakCelebration,
  } = useFinancial();

  // Navigation & Sheets
  const [activeBottomTab, setActiveBottomTab] = useState<BottomNavTab>("home");
  const [showTourModal, setShowTourModal] = useState(false);
  const [showGoalsSheet, setShowGoalsSheet] = useState(false);
  const [showProfileSheet, setShowProfileSheet] = useState(false);

  // Game Box Purchase State (Default: 🎧 Audífonos $2,300)
  const [queryText, setQueryText] = useState("🎧 Audífonos $2,300");
  const [parsedItemName, setParsedItemName] = useState("Audífonos Sony");
  const [parsedItemPrice, setParsedItemPrice] = useState<number>(2300);
  const [scannedThumbnailUrl, setScannedThumbnailUrl] = useState<string | null>(
    null
  );
  const [scannedStoreTag, setScannedStoreTag] = useState<string | null>(null);

  // Power-Up Resolution State ("idle" | "shield" | "potion" | "bought")
  const [activePowerUp, setActivePowerUp] = useState<
    "idle" | "shield" | "potion" | "bought"
  >("idle");
  const [powerUpXpBonus, setPowerUpXpBonus] = useState<number>(50);

  // Quick expense pill & toast feedback
  const [isQuickExpenseOpen, setIsQuickExpenseOpen] = useState(false);
  const [quickExpenseInput, setQuickExpenseInput] = useState("");
  const [toastFeedback, setToastFeedback] = useState<{
    id: number;
    message: string;
  } | null>(null);

  const simulatorSectionRef = useRef<HTMLElement | null>(null);

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
    }, 3600);
  };

  // Real-Time Financial & HP Metrics
  const financialMetrics = useMemo(() => {
    const commitmentsTotal = profile.commitments
      .filter((c) => c.dueInDays <= profile.nextPaydayDays)
      .reduce((acc, c) => acc + c.amount, 0);

    const essentialLivingCost =
      profile.dailyEssentialBurn * profile.nextPaydayDays;

    const safeToSpend = Math.max(
      0,
      profile.currentBalance -
        commitmentsTotal -
        essentialLivingCost -
        profile.safetyBuffer
    );

    const netHpAfterPurchase = safeToSpend - parsedItemPrice;
    const isCriticalHit = parsedItemPrice > 0 && netHpAfterPurchase < 0;
    const missingAmount = isCriticalHit ? Math.abs(netHpAfterPurchase) : 0;

    const weeklyGoalContribution = Math.max(
      300,
      profile.goal.weeklyContribution || 500
    );
    const weeksGoalDelayed = Math.max(
      1,
      Math.ceil(parsedItemPrice / weeklyGoalContribution)
    );

    const suggestedPotionSave = 400;
    const potionWeeks = Math.max(
      1,
      Math.ceil(parsedItemPrice / suggestedPotionSave)
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

    return {
      safeToSpend,
      netHpAfterPurchase,
      isCriticalHit,
      missingAmount,
      weeksGoalDelayed,
      suggestedPotionSave,
      potionWeeks,
      goalPct,
    };
  }, [profile, parsedItemPrice]);

  // Real-Time Input Parser (Zero Paragraphs, Immediate Visual Reaction)
  const handleQueryInputChange = (value: string) => {
    setQueryText(value);
    setActivePowerUp("idle");

    const normalized = value.replace(/,/g, "");
    const priceMatch = normalized.match(/(\d+(?:\.\d+)?)/);
    if (priceMatch) {
      const price = Math.max(0, Math.round(parseFloat(priceMatch[1])));
      setParsedItemPrice(price);
      const cleanedName = value
        .replace(/\$?\s*\d[\d,.]*/g, "")
        .replace(/\bde\b|\bpor\b|\bmxn\b|\bpesos\b/gi, "")
        .trim();
      setParsedItemName(cleanedName || "Compra");

      if (price > financialMetrics.safeToSpend) {
        playDamage();
      } else {
        playTap();
      }
    } else {
      setParsedItemPrice(0);
      setParsedItemName(value.trim() || "Compra");
    }
  };

  // Select 1-Tap Visual Chip
  const handleSelectChip = (chip: (typeof GAME_PURCHASE_CHIPS)[number]) => {
    setActivePowerUp("idle");
    setQueryText(chip.label);
    setParsedItemName(chip.name);
    setParsedItemPrice(chip.price);
    setScannedThumbnailUrl(null);
    setScannedStoreTag(null);
    setPendingEvaluation({
      name: chip.name,
      price: chip.price,
      imageName: null,
    });

    if (chip.price > financialMetrics.safeToSpend) {
      playDamage();
    } else {
      playTap();
    }
  };

  // Camera / QuickSnap Scanner callback
  const handleScanComplete = (scanned: ScannedProductResult) => {
    setActivePowerUp("idle");
    setQueryText(`📸 ${scanned.name} $${scanned.price.toLocaleString()}`);
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

  // POWER-UP 1: Carta Roja "⚡ Comprar ya"
  const handleRedCardBuyNow = () => {
    playDamage();
    setActivePowerUp("bought");
    registerPurchaseAnyway(parsedItemName, parsedItemPrice);
    triggerToast(
      `⚡ Comprado: −$${parsedItemPrice.toLocaleString()} HP (${parsedItemName})`
    );
  };

  // POWER-UP 2: Carta Verde "🛡️ Escudo de Nómina (+50 XP)"
  const handleGreenCardPayrollShield = () => {
    playCoin();
    triggerConfettiBurst();
    setPowerUpXpBonus(50);
    setActivePowerUp("shield");
    addToWishlist(
      {
        name: parsedItemName,
        price: parsedItemPrice,
      },
      50
    );
    triggerToast(
      `🛡️ ¡Escudo de Nómina activado! +50 XP · Esperando ${profile.nextPaydayDays} días`
    );
  };

  // POWER-UP 3: Carta Dorada "🧪 Poción de Ahorro (+100 XP)"
  const handleGoldCardSavingPotion = () => {
    playCoin();
    triggerConfettiBurst();
    setPowerUpXpBonus(100);
    setActivePowerUp("potion");
    addToWishlist(
      {
        name: parsedItemName,
        price: parsedItemPrice,
        plannedWeeklySave: financialMetrics.suggestedPotionSave,
      },
      100
    );
    triggerToast(
      `🧪 ¡Poción de Ahorro! Apartas $${financialMetrics.suggestedPotionSave}/sem y ganas +100 XP`
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

    playDamage();
    updateProfile({
      currentBalance: Math.max(0, profile.currentBalance - amount),
    });

    triggerToast(`−$${amount.toLocaleString()} HP (${quickExpenseInput.trim()})`);
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
      simulatorSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    } else if (tab === "goals") {
      setShowProfileSheet(false);
      setShowGoalsSheet(true);
    } else if (tab === "profile") {
      setShowGoalsSheet(false);
      setShowProfileSheet(true);
    }
  };

  // Determine Real-Time Plant Simulation State
  const plantSimulationState: PlantSimulationState =
    activePowerUp === "shield" || activePowerUp === "potion"
      ? "recovered"
      : financialMetrics.isCriticalHit
      ? "danger"
      : "normal";

  return (
    <AppShell
      activeTab={activeBottomTab}
      onSelectTab={handleBottomNavSelect}
      onOpenGuide={() => setShowTourModal(true)}
    >
      {/* Celebratory Streak Popup Banner 🔥 */}
      <AnimatePresence>
        {streakCelebration && (
          <motion.div
            key={streakCelebration.id}
            initial={{ opacity: 0, y: -24, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -18, scale: 0.92 }}
            transition={{ type: "spring", stiffness: 360, damping: 22 }}
            className="fixed top-16 md:top-6 left-1/2 -translate-x-1/2 z-50 rounded-full bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 text-white px-4 py-2 shadow-lg flex items-center gap-2 text-xs font-bold font-heading whitespace-nowrap border-2 border-white"
          >
            <Flame className="w-4 h-4 fill-white text-white" strokeWidth={1.5} />
            <span>
              ¡Racha de {streakCelebration.count}! · {streakCelebration.reason}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ONLY 2 PROTAGONISTS ON SCREEN:
          1. Arriba/Derecha: Tu Isla Flotante con Planta SVG, Nivel, Racha 🔥 y Barra de Vida Verde (HP)
          2. Centro/Izquierda: Caja de Juego "¿Qué quieres comprar?" + Simulación en Vivo + 3 Cartas de Poder */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* PROTAGONIST 1 (Top on Mobile, Right Floating Island on Desktop): Isla Flotante + Barra de Vida HP */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="lg:col-span-5 lg:order-2 lg:sticky lg:top-6"
        >
          <FinancialPlantWidget
            simulationState={plantSimulationState}
            previewDamagePrice={parsedItemPrice}
            recoveredXpBonus={powerUpXpBonus}
          />
        </motion.section>

        {/* PROTAGONIST 2 (Center / Main Arena): Caja de Juego "¿Qué quieres comprar?" + 3 Cartas de Poder */}
        <motion.section
          ref={simulatorSectionRef}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, delay: 0.05 }}
          className="lg:col-span-7 lg:order-1 space-y-4"
        >
          {/* Vibrant Game Box: "¿Qué quieres comprar?" */}
          <Card className="bg-white border-2 border-b-4 border-[#DCD5CA] rounded-3xl py-4 px-1 shadow-xs">
            <CardContent className="px-4 sm:px-5 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-2xs">
                    <Sparkles className="w-4 h-4" strokeWidth={1.5} />
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold font-heading tracking-tight text-slate-900">
                    ¿Qué quieres comprar?
                  </h1>
                </div>

                {parsedItemPrice > 0 && (
                  <span
                    className={`text-xs font-bold font-heading px-3 py-1 rounded-full border-2 ${
                      financialMetrics.isCriticalHit
                        ? "bg-rose-100 text-rose-900 border-rose-300 animate-pulse"
                        : "bg-emerald-100 text-emerald-900 border-emerald-300"
                    }`}
                  >
                    −{parsedItemPrice.toLocaleString()} HP
                  </span>
                )}
              </div>

              {/* Instant Live Input Box */}
              <div className="relative">
                <input
                  type="text"
                  value={queryText}
                  onChange={(e) => handleQueryInputChange(e.target.value)}
                  placeholder="Escribe ej. Audífonos 2300 o toca un chip 👇"
                  className="w-full h-13 px-4 rounded-2xl border-2 border-[#DCD5CA] bg-[#FAF8F5] text-base sm:text-lg font-bold font-heading text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-emerald-600 focus:outline-none transition-all"
                />
              </div>

              {/* 4 Visual Emoji Chips (🎧 Audífonos $2,300, 🎮 Juego $1,200, 👟 Tenis $1,800, 🍔 UberEats $350) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {GAME_PURCHASE_CHIPS.map((chip) => {
                  const isSelected = parsedItemPrice === chip.price;
                  return (
                    <motion.button
                      key={chip.id}
                      type="button"
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleSelectChip(chip)}
                      className={`p-3 rounded-2xl border-2 border-b-4 active:border-b-2 active:translate-y-0.5 transition-all flex flex-col items-start gap-1 cursor-pointer bg-gradient-to-b ${
                        chip.style
                      } ${
                        isSelected
                          ? "ring-2 ring-slate-900 shadow-xs"
                          : "hover:opacity-95"
                      }`}
                    >
                      <span className="text-2xl leading-none">{chip.emoji}</span>
                      <span className="text-xs font-bold font-heading text-slate-900 truncate w-full text-left">
                        {chip.name}
                      </span>
                      <span className="text-xs font-bold font-heading text-emerald-800">
                        ${chip.price.toLocaleString()}
                      </span>
                    </motion.button>
                  );
                })}
              </div>

              {/* Camera Button / QuickSnapScanner */}
              <QuickSnapScanner onScanComplete={handleScanComplete} />

              {/* Scanned Capture Thumbnail Preview */}
              {scannedThumbnailUrl && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/70 p-2.5 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={scannedThumbnailUrl}
                      alt={parsedItemName}
                      className="w-11 h-11 rounded-xl object-cover border border-white shadow-2xs shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold uppercase text-emerald-800 block">
                        📸 {scannedStoreTag}
                      </span>
                      <p className="text-xs font-bold font-heading text-slate-900 truncate">
                        {parsedItemName} · −${parsedItemPrice.toLocaleString()}{" "}
                        HP
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
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                </motion.div>
              )}
            </CardContent>
          </Card>

          {/* REAL-TIME VISUAL DAMAGE BANNER & 3 POWER-UP CARDS (1-Tap Resolution) */}
          <AnimatePresence mode="wait">
            {parsedItemPrice > 0 && (
              <motion.div
                key={`powerups-${parsedItemPrice}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-3"
              >
                {/* Critical Hit Alert or Safe Hit Banner */}
                <div
                  className={`rounded-2xl border-2 border-b-4 px-4 py-3 flex items-center justify-between gap-3 ${
                    activePowerUp === "shield" || activePowerUp === "potion"
                      ? "bg-emerald-600 border-emerald-700 border-b-emerald-900 text-white"
                      : financialMetrics.isCriticalHit
                      ? "bg-rose-600 border-rose-700 border-b-rose-900 text-white"
                      : "bg-amber-100 border-amber-300 border-b-amber-500 text-amber-950"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {activePowerUp === "shield" ||
                    activePowerUp === "potion" ? (
                      <Sparkles
                        className="w-5 h-5 text-amber-300 shrink-0"
                        strokeWidth={1.5}
                      />
                    ) : (
                      <AlertTriangle
                        className="w-5 h-5 shrink-0"
                        strokeWidth={1.5}
                      />
                    )}
                    <span className="text-sm sm:text-base font-bold font-heading leading-tight">
                      {activePowerUp === "shield"
                        ? `¡Escudo activado! Protegiste tu quincena y ganaste +50 XP`
                        : activePowerUp === "potion"
                        ? `¡Poción activa! Apartas $${financialMetrics.suggestedPotionSave}/sem y ganaste +100 XP`
                        : financialMetrics.isCriticalHit
                        ? `¡Golpe crítico a tu quincena! Te faltan $${financialMetrics.missingAmount.toLocaleString()}`
                        : `Impacto directo: −$${parsedItemPrice.toLocaleString()} HP a tu quincena`}
                    </span>
                  </div>
                  <span className="text-xs font-bold font-heading px-2.5 py-1 rounded-xl bg-black/15 shrink-0">
                    Elige 1 Carta 👇
                  </span>
                </div>

                {/* 3 CARTAS DE PODER (POWER-UPS) ESTILO VIDEOJUEGO */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* CARTA ROJA: ⚡ Comprar ya */}
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={handleRedCardBuyNow}
                    className={`p-4 rounded-3xl border-2 border-b-4 active:border-b-2 active:translate-y-0.5 text-left transition-all flex flex-col justify-between gap-3 cursor-pointer bg-gradient-to-b from-rose-50 via-white to-rose-100/80 border-rose-400 border-b-rose-600 shadow-xs hover:shadow-md ${
                      activePowerUp === "bought" ? "ring-2 ring-rose-600" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="px-2.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-bold font-heading uppercase">
                        Carta Roja · −HP
                      </span>
                      <Zap
                        className="w-4 h-4 text-rose-600"
                        strokeWidth={1.5}
                      />
                    </div>
                    <div>
                      <p className="text-base font-bold font-heading text-rose-950 leading-snug">
                        ⚡ Comprar ya
                      </p>
                      <p className="text-xs font-bold font-heading text-rose-700 mt-1 leading-snug">
                        (Pierdes escudo y retrasas tu meta{" "}
                        {financialMetrics.weeksGoalDelayed} sem)
                      </p>
                    </div>
                  </motion.button>

                  {/* CARTA VERDE: 🛡️ Escudo de Nómina */}
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={handleGreenCardPayrollShield}
                    className={`p-4 rounded-3xl border-2 border-b-4 active:border-b-2 active:translate-y-0.5 text-left transition-all flex flex-col justify-between gap-3 cursor-pointer bg-gradient-to-b from-emerald-50 via-white to-emerald-100/80 border-emerald-400 border-b-emerald-600 shadow-xs hover:shadow-md ${
                      activePowerUp === "shield"
                        ? "ring-2 ring-emerald-700 scale-[1.02]"
                        : ""
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold font-heading uppercase">
                        Carta Verde · +50 XP
                      </span>
                      <Shield
                        className="w-4 h-4 text-emerald-600"
                        strokeWidth={1.5}
                      />
                    </div>
                    <div>
                      <p className="text-base font-bold font-heading text-emerald-950 leading-snug">
                        🛡️ Escudo de Nómina
                      </p>
                      <p className="text-xs font-bold font-heading text-emerald-800 mt-1 leading-snug">
                        (Espera {profile.nextPaydayDays} días y gana +50 XP)
                      </p>
                    </div>
                  </motion.button>

                  {/* CARTA DORADA: 🧪 Poción de Ahorro */}
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={handleGoldCardSavingPotion}
                    className={`p-4 rounded-3xl border-2 border-b-4 active:border-b-2 active:translate-y-0.5 text-left transition-all flex flex-col justify-between gap-3 cursor-pointer bg-gradient-to-b from-amber-50 via-white to-yellow-100/90 border-amber-400 border-b-amber-600 shadow-xs hover:shadow-md ${
                      activePowerUp === "potion"
                        ? "ring-2 ring-amber-600 scale-[1.02]"
                        : ""
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold font-heading uppercase">
                        Carta Dorada · +100 XP
                      </span>
                      <FlaskConical
                        className="w-4 h-4 text-amber-600"
                        strokeWidth={1.5}
                      />
                    </div>
                    <div>
                      <p className="text-base font-bold font-heading text-amber-950 leading-snug">
                        🧪 Poción de Ahorro
                      </p>
                      <p className="text-xs font-bold font-heading text-amber-900 mt-1 leading-snug">
                        (Aparta ${financialMetrics.suggestedPotionSave}/sem y
                        gana +100 XP)
                      </p>
                    </div>
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Active Power-Up / Wishlist Pill */}
          {profile.wishlist && profile.wishlist.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border-2 border-emerald-200 bg-white px-4 py-2.5 flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2 text-xs font-bold font-heading text-emerald-950 truncate">
                <BookmarkCheck
                  className="w-4 h-4 text-emerald-600 shrink-0"
                  strokeWidth={1.5}
                />
                <span className="truncate">
                  Escudos activos:{" "}
                  {profile.wishlist
                    .slice(0, 2)
                    .map((w) => `${w.name} ($${w.price.toLocaleString()})`)
                    .join(" · ")}
                </span>
              </div>
              <span className="text-[10px] font-bold font-heading text-amber-950 bg-amber-200 px-2.5 py-0.5 rounded-full shrink-0">
                +XP Activo
              </span>
            </motion.div>
          )}
        </motion.section>
      </div>

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
              className="h-10 px-4 rounded-full bg-slate-900 text-[#FAF8F5] shadow-md text-xs font-bold font-heading flex items-center gap-2 cursor-pointer border-2 border-slate-700"
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
              className="w-80 sm:w-96 rounded-2xl bg-white border-2 border-slate-300 shadow-xl p-2 flex items-center gap-2"
            >
              <input
                type="text"
                autoFocus
                value={quickExpenseInput}
                onChange={(e) => setQuickExpenseInput(e.target.value)}
                placeholder='Ej. "Gasté 150 en comida"'
                className="flex-1 h-9 px-3 text-xs sm:text-sm font-bold font-heading text-slate-900 placeholder:text-slate-400 bg-transparent focus:outline-none"
              />
              <motion.button
                type="submit"
                whileTap={{ scale: 0.96 }}
                className="h-9 px-3.5 rounded-xl bg-slate-900 text-white text-xs font-bold font-heading flex items-center gap-1 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>−HP</span>
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

      {/* Sheet Modal: Retos y Metas */}
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
              className="w-full max-w-md rounded-3xl bg-[#FAF8F5] border-2 border-[#E6E1DA] shadow-xl p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-600" strokeWidth={1.5} />
                  <h3 className="text-base font-bold font-heading text-slate-900">
                    Retos, Rachas y tu Meta
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    playTap();
                    setShowGoalsSheet(false);
                    setActiveBottomTab("home");
                  }}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </div>

              <div
                onClick={() => playLevelUp()}
                className="p-4 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white flex items-center justify-between cursor-pointer border-2 border-b-4 border-orange-700"
              >
                <div className="space-y-0.5">
                  <span className="text-[11px] uppercase tracking-wider opacity-90 font-bold">
                    Racha de Buenas Decisiones
                  </span>
                  <p className="text-2xl font-bold font-heading">
                    {profile.streakCount ?? 3} días 🔥
                  </p>
                  <p className="text-xs opacity-90">
                    Toca para celebrar con confeti 🎉
                  </p>
                </div>
                <Flame
                  className="w-10 h-10 text-white/90 fill-white/30"
                  strokeWidth={1.5}
                />
              </div>

              <div className="p-4 rounded-2xl bg-white border-2 border-[#E6E1DA] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target
                      className="w-4 h-4 text-emerald-700"
                      strokeWidth={1.5}
                    />
                    <span className="text-xs font-bold font-heading text-slate-900">
                      {profile.goal.title}
                    </span>
                  </div>
                  <span className="text-xs font-bold font-heading text-emerald-700">
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

                <div className="flex justify-between text-[11px] text-slate-500 font-bold font-heading">
                  <span>
                    Ahorrado: ${profile.goal.currentSaved.toLocaleString()}
                  </span>
                  <span>
                    Meta: ${profile.goal.targetAmount.toLocaleString()}
                  </span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sheet Modal: Cambiar Perfil */}
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
              className="w-full max-w-md rounded-3xl bg-[#FAF8F5] border-2 border-[#E6E1DA] shadow-xl p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCheck
                    className="w-5 h-5 text-emerald-700"
                    strokeWidth={1.5}
                  />
                  <h3 className="text-base font-bold font-heading text-slate-900">
                    Cambiar Perfil
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    playTap();
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
                        playCoin();
                        loadPreloadedSandboxProfile(key);
                        setShowProfileSheet(false);
                        setActiveBottomTab("home");
                        triggerToast(`Perfil activo: ${item.name}`);
                      }}
                      className={`w-full text-left p-3.5 rounded-2xl border-2 border-b-4 transition-all flex items-center justify-between cursor-pointer ${
                        isCurrent
                          ? "bg-slate-900 text-white border-slate-950"
                          : "bg-white text-slate-900 border-[#E6E1DA]"
                      }`}
                    >
                      <div>
                        <p className="text-sm font-bold font-heading">
                          {item.name}
                        </p>
                        <p
                          className={`text-xs ${
                            isCurrent ? "text-slate-300" : "text-slate-500"
                          }`}
                        >
                          Saldo ${item.currentBalance.toLocaleString()} ·{" "}
                          {item.commitments.length} compromisos
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
                onClick={() => {
                  playTap();
                  router.push("/onboarding");
                }}
                className="w-full h-11 rounded-2xl border-2 border-b-4 border-[#DCD5CA] bg-white text-xs font-bold font-heading text-slate-800 flex items-center justify-center gap-2 cursor-pointer"
              >
                <SlidersHorizontal className="w-4 h-4" strokeWidth={1.5} />
                <span>Personalizar desde cero (Onboarding)</span>
              </motion.button>
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
            className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-40 rounded-2xl bg-slate-900 text-[#FAF8F5] px-4 py-2.5 shadow-lg border border-slate-800 flex items-center gap-2.5 text-xs font-bold font-heading max-w-sm w-[90%]"
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
    </AppShell>
  );
}
