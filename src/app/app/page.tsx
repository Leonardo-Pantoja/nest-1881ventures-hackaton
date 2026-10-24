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
  ArrowRight,
  Award,
  Zap,
  Shield,
  Coins,
  PiggyBank,
  CloudRain,
  Sun,
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

// RPG Shop Item Cards (Grid of 4 columns, zero truncated text, 3D tactile border, coin price badge)
const RPG_SHOP_ITEMS = [
  {
    id: "audifonos",
    emoji: "🎧",
    name: "Audífonos",
    fullName: "Audífonos Inalámbricos",
    price: 2300,
    iconBg: "bg-emerald-50 border-emerald-100",
  },
  {
    id: "videojuego",
    emoji: "🎮",
    name: "Videojuego",
    fullName: "Videojuego Edición Estándar",
    price: 1200,
    iconBg: "bg-indigo-50 border-indigo-100",
  },
  {
    id: "tenis",
    emoji: "👟",
    name: "Tenis",
    fullName: "Tenis Deportivos",
    price: 1800,
    iconBg: "bg-amber-50 border-amber-100",
  },
  {
    id: "comida",
    emoji: "🍔",
    name: "Comida",
    fullName: "Comida a domicilio",
    price: 350,
    iconBg: "bg-rose-50 border-rose-100",
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
 * Hero World: Panoramic Living Illustrated Diorama (Finch / Duolingo / Forest style)
 * - Dynamic weather: Sunny & vibrant when viable or waiting/microsaving; Cloudy/amber with raindrops & wind when in deficit.
 * - Large 135px animated SVG Plant/Tree on the left/center with live RPG speech bubble.
 * - Translucent bottom bar (`bg-white/90 backdrop-blur-md rounded-2xl p-4`) with the 3-segment liquidity breakdown.
 */
function HeroWorldDiorama({
  userName,
  currentLevel,
  currentLevelName,
  nextPaydayDays,
  totalBalance,
  fixedAndRentTotal,
  safetyBuffer,
  safeToSpend,
  fixedPct,
  bufferPct,
  freePct,
  parsedItemName,
  parsedItemPrice,
  isDeficit,
  missingLiquidity,
  selectedDecision,
  decisionXpBonus,
  onExploreTree,
}: {
  userName: string;
  currentLevel: PlantLevel;
  currentLevelName: string;
  nextPaydayDays: number;
  totalBalance: number;
  fixedAndRentTotal: number;
  safetyBuffer: number;
  safeToSpend: number;
  fixedPct: number;
  bufferPct: number;
  freePct: number;
  parsedItemName: string;
  parsedItemPrice: number;
  isDeficit: boolean;
  missingLiquidity: number;
  selectedDecision: "idle" | "wait" | "microsave" | "bought";
  decisionXpBonus: number;
  onExploreTree: () => void;
}) {
  const firstName = (userName || "Carlos").split(" ")[0];
  const isStormy =
    isDeficit &&
    selectedDecision !== "wait" &&
    selectedDecision !== "microsave";
  const isCelebrating =
    selectedDecision === "wait" || selectedDecision === "microsave";

  // Live RPG Speech Bubble Message
  let rpgSpeechMessage = `¡Hola ${firstName}! Tienes $${safeToSpend.toLocaleString()} MXN libres hoy. ¿Qué evaluamos? 🌱`;
  if (isCelebrating) {
    rpgSpeechMessage =
      selectedDecision === "wait"
        ? `¡Gran jugada ${firstName}! En ${nextPaydayDays} días cobramos y subimos +50 XP ☀️`
        : `¡Plan maestro ${firstName}! Con micro-ahorro protegemos tu quincena y ganamos +100 XP ✨`;
  } else if (isStormy) {
    rpgSpeechMessage = `¡Cuidado ${firstName}! Con "${parsedItemName}" ($${parsedItemPrice.toLocaleString()}) nos quedaríamos sin para la renta 🌧️`;
  } else if (parsedItemPrice > 0) {
    rpgSpeechMessage = `¡Sí nos alcanza para "${parsedItemName}"! Aún conservarías $${Math.max(
      0,
      safeToSpend - parsedItemPrice
    ).toLocaleString()} MXN libres ☀️`;
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative rounded-3xl overflow-hidden border-2 border-b-4 transition-all duration-500 shadow-sm ${
        isStormy
          ? "border-amber-300 border-b-amber-500 bg-gradient-to-b from-amber-100/90 via-orange-50/80 to-amber-100/60"
          : "border-emerald-300 border-b-emerald-500 bg-gradient-to-b from-sky-100/90 via-emerald-50/60 to-emerald-100/80"
      }`}
    >
      {/* 1. Animated Panoramic SVG Landscape Background (Sky, Clouds, Sun/Rain, Rolling Hills & Sparkles) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <svg
          viewBox="0 0 900 340"
          preserveAspectRatio="none"
          className="w-full h-full"
        >
          <defs>
            <linearGradient id="hillBackSunny" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#A7F3D0" />
              <stop offset="100%" stopColor="#6EE7B7" />
            </linearGradient>
            <linearGradient id="hillFrontSunny" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6EE7B7" />
              <stop offset="100%" stopColor="#34D399" />
            </linearGradient>
            <linearGradient id="hillBackStorm" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FDE68A" />
              <stop offset="100%" stopColor="#FCD34D" />
            </linearGradient>
            <linearGradient id="hillFrontStorm" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FCD34D" />
              <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>
          </defs>

          {/* Sun or Storm Glow */}
          {!isStormy ? (
            <motion.g
              animate={{ scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <circle cx="780" cy="68" r="46" fill="#FDE047" opacity="0.35" />
              <circle cx="780" cy="68" r="28" fill="#FACC15" />
            </motion.g>
          ) : (
            <g>
              <circle cx="780" cy="68" r="36" fill="#F59E0B" opacity="0.25" />
            </g>
          )}

          {/* Slowly Floating Cloud 1 */}
          <motion.g
            animate={{ x: [-12, 18, -12] }}
            transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
            opacity={isStormy ? 0.85 : 0.75}
          >
            <path
              d="M110 72 C110 58 124 50 138 54 C146 42 166 42 174 54 C188 54 198 64 196 76 C196 84 188 88 176 88 L122 88 C114 88 110 80 110 72 Z"
              fill={isStormy ? "#CBD5E1" : "#FFFFFF"}
            />
          </motion.g>

          {/* Slowly Floating Cloud 2 */}
          <motion.g
            animate={{ x: [16, -16, 16] }}
            transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
            opacity={isStormy ? 0.9 : 0.7}
          >
            <path
              d="M520 56 C520 44 532 36 546 40 C554 28 572 28 580 40 C592 40 602 48 600 60 C600 68 592 72 580 72 L530 72 C522 72 520 64 520 56 Z"
              fill={isStormy ? "#94A3B8" : "#FFFFFF"}
            />
          </motion.g>

          {/* Raindrops & Wind Lines when Stormy (Deficit) */}
          {isStormy && (
            <g>
              {[
                { x: 145, y: 95, d: 0 },
                { x: 175, y: 102, d: 0.3 },
                { x: 545, y: 80, d: 0.15 },
                { x: 575, y: 88, d: 0.5 },
                { x: 740, y: 92, d: 0.25 },
              ].map((drop, i) => (
                <motion.line
                  key={i}
                  x1={drop.x}
                  y1={drop.y}
                  x2={drop.x - 8}
                  y2={drop.y + 18}
                  stroke="#64748B"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  animate={{ y: [0, 48], opacity: [0, 0.85, 0] }}
                  transition={{
                    duration: 1.1,
                    delay: drop.d,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                />
              ))}
            </g>
          )}

          {/* Sparkling Particles when Sunny / Celebrating */}
          {!isStormy && (
            <g>
              {[
                { cx: 280, cy: 52, r: 3.5, d: 0 },
                { cx: 430, cy: 78, r: 3, d: 0.8 },
                { cx: 680, cy: 48, r: 4, d: 1.4 },
                { cx: 830, cy: 115, r: 3, d: 0.4 },
              ].map((sp, idx) => (
                <motion.circle
                  key={idx}
                  cx={sp.cx}
                  cy={sp.cy}
                  r={sp.r}
                  fill="#FBBF24"
                  animate={{ y: [0, -8, 0], opacity: [0.35, 1, 0.35] }}
                  transition={{
                    duration: 2.4,
                    delay: sp.d,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </g>
          )}

          {/* Rolling Back Hill */}
          <path
            d="M0 230 Q220 165 470 215 T900 195 L900 340 L0 340 Z"
            fill={isStormy ? "url(#hillBackStorm)" : "url(#hillBackSunny)"}
            opacity="0.7"
          />

          {/* Rolling Front Green Hill */}
          <path
            d="M0 250 Q260 195 540 240 T900 225 L900 340 L0 340 Z"
            fill={isStormy ? "url(#hillFrontStorm)" : "url(#hillFrontSunny)"}
            opacity="0.85"
          />
        </svg>
      </div>

      {/* 2. Foreground Diorama Content */}
      <div className="relative z-10 p-5 sm:p-7 space-y-5">
        {/* Top Row: Level Pill + Weather Indicator */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-heading bg-white/90 backdrop-blur-xs text-slate-900 border border-white shadow-2xs">
              <Sprout
                className="w-3.5 h-3.5 text-emerald-600"
                strokeWidth={1.5}
              />
              Nivel {currentLevel}: {currentLevelName}
            </span>

            <button
              type="button"
              onClick={() => {
                playTap();
                onExploreTree();
              }}
              className="px-3 py-1 rounded-full text-xs font-bold font-heading bg-white/75 hover:bg-white text-slate-700 border border-white/80 transition-colors cursor-pointer"
            >
              Ver evolución (5 niveles) →
            </button>
          </div>

          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-heading border shadow-2xs ${
              isStormy
                ? "bg-amber-900/90 text-amber-100 border-amber-700"
                : "bg-white/90 text-emerald-900 border-white"
            }`}
          >
            {isStormy ? (
              <>
                <CloudRain
                  className="w-3.5 h-3.5 text-amber-300"
                  strokeWidth={1.5}
                />
                <span>Clima en alerta · Déficit</span>
              </>
            ) : (
              <>
                <Sun
                  className="w-3.5 h-3.5 text-amber-500"
                  strokeWidth={1.5}
                />
                <span>
                  {isCelebrating
                    ? `¡Sol radiante! +${decisionXpBonus} XP`
                    : `Clima soleado · Nómina en ${nextPaydayDays}d`}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Center Stage: Large 135px Animated Plant/Tree + Comic/RPG Speech Bubble */}
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 pt-1 pb-2">
          {/* Large 135px Animated Financial Tree */}
          <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
            {isCelebrating && (
              <motion.div
                animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.75, 0.4] }}
                transition={{ duration: 2.2, repeat: Infinity }}
                className="absolute w-32 h-32 rounded-full bg-amber-300/50 blur-xl"
              />
            )}

            <svg
              viewBox="0 0 180 170"
              className="w-36 h-36 overflow-visible drop-shadow-sm"
              aria-label="Tu Planta Financiera en el escenario vivo"
            >
              <ellipse
                cx="90"
                cy="154"
                rx="46"
                ry="8"
                fill="rgba(15,23,42,0.14)"
              />
              {/* Terracotta Pot */}
              <path
                d="M58 116 L122 116 L113 150 C112 153 109 155 105 155 L75 155 C71 155 68 153 67 150 Z"
                fill="#D97757"
              />
              <rect
                x="52"
                y="108"
                width="76"
                height="10"
                rx="5"
                fill="#C86849"
              />
              <ellipse cx="90" cy="109" rx="32" ry="5" fill="#78350F" />

              {/* Animated Tree/Plant Body */}
              <motion.g
                style={{ originX: "90px", originY: "109px" }}
                animate={
                  isStormy
                    ? {
                        rotate: [0, 12, 9, 13, 10],
                        y: [0, 3, 2, 3],
                        scaleY: 0.93,
                      }
                    : isCelebrating
                    ? {
                        rotate: [0, -5, 5, -3, 0],
                        scale: [1, 1.09, 1.04, 1.07],
                      }
                    : {
                        rotate: [-2, 2, -2],
                        y: [0, -2, 0],
                      }
                }
                transition={
                  isStormy
                    ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
                    : isCelebrating
                    ? { duration: 1.2, ease: "easeOut" }
                    : { duration: 3.5, repeat: Infinity, ease: "easeInOut" }
                }
              >
                {/* Trunk */}
                <path d="M84 110 L87 56 L93 56 L96 110 Z" fill="#78350F" />
                <path
                  d="M88 80 L70 62 M92 76 L110 60"
                  stroke="#78350F"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                />

                {/* Lush Canopy */}
                <circle
                  cx="68"
                  cy="58"
                  r="22"
                  fill={isStormy ? "#D97706" : "#059669"}
                />
                <circle
                  cx="112"
                  cy="58"
                  r="22"
                  fill={isStormy ? "#F59E0B" : "#10B981"}
                />
                <circle
                  cx="90"
                  cy="40"
                  r="27"
                  fill={isStormy ? "#FBBF24" : "#34D399"}
                />

                {/* Cute Finch/Duolingo Style Expressive Eyes on the Canopy/Pot */}
                <circle cx="82" cy="132" r="3" fill="#1E293B" />
                <circle cx="98" cy="132" r="3" fill="#1E293B" />
                {isStormy ? (
                  <path
                    d="M85 141 Q90 137 95 141"
                    stroke="#1E293B"
                    strokeWidth="2.2"
                    fill="none"
                    strokeLinecap="round"
                  />
                ) : (
                  <path
                    d="M84 138 Q90 143 96 138"
                    stroke="#1E293B"
                    strokeWidth="2.2"
                    fill="none"
                    strokeLinecap="round"
                  />
                )}

                {/* Flowers / Golden Fruits when Healthy */}
                {!isStormy && (
                  <>
                    <circle cx="76" cy="36" r="5" fill="#FDE047" />
                    <circle cx="104" cy="42" r="5" fill="#FDE047" />
                    <circle cx="60" cy="60" r="4.5" fill="#F472B6" />
                    <circle cx="120" cy="60" r="4.5" fill="#F472B6" />
                  </>
                )}
              </motion.g>

              {/* Sweat Drop when Stormy */}
              {isStormy && (
                <motion.path
                  d="M50 42 C50 42 45 50 45 54 C45 57 47.2 59 50 59 C52.8 59 55 57 55 54 C55 50 50 42 50 42 Z"
                  fill="#38BDF8"
                  animate={{ y: [0, 16, 24], opacity: [0, 1, 0] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                />
              )}
            </svg>
          </div>

          {/* Floating RPG / Comic Speech Bubble */}
          <motion.div
            key={rpgSpeechMessage}
            initial={{ opacity: 0, scale: 0.94, x: -8 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}
            className={`relative flex-1 rounded-3xl border-2 border-b-4 p-4 sm:p-5 shadow-sm ${
              isStormy
                ? "bg-white/95 border-amber-300 border-b-amber-400 text-slate-900"
                : isCelebrating
                ? "bg-white/95 border-emerald-400 border-b-emerald-500 text-slate-900"
                : "bg-white/95 border-white border-b-slate-200 text-slate-900"
            }`}
          >
            {/* Comic Speech Pointer Triangle (Desktop left arrow) */}
            <div
              aria-hidden="true"
              className="hidden sm:block absolute -left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rotate-45 bg-white border-l-2 border-b-2 border-slate-200"
            />

            <div className="flex items-center justify-between gap-2 mb-1">
              <span
                className={`text-[11px] font-bold font-heading uppercase tracking-wider ${
                  isStormy ? "text-amber-700" : "text-emerald-700"
                }`}
              >
                {isStormy
                  ? "⚠️ Alerta de tu Árbol"
                  : isCelebrating
                  ? "🌟 ¡Sabiduría desbloqueada!"
                  : "💬 Tu Copiloto Vivo"}
              </span>

              {isDeficit && !isCelebrating && (
                <span className="text-[11px] font-bold font-heading px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900">
                  Faltan ${missingLiquidity.toLocaleString()} MXN
                </span>
              )}
            </div>

            <p className="text-base sm:text-lg font-bold font-heading text-slate-900 leading-snug">
              “{rpgSpeechMessage}”
            </p>
          </motion.div>
        </div>

        {/* 3. Translucent Integrated Bottom Liquidity Bar (bg-white/90 backdrop-blur-md rounded-2xl p-4) */}
        <div className="bg-white/90 backdrop-blur-md rounded-2xl p-4 border border-white shadow-xs space-y-2.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-xs font-bold font-heading text-slate-600">
              Disponible para gastar hoy:
            </span>
            <span className="text-xl sm:text-2xl font-bold font-heading text-slate-900">
              ${safeToSpend.toLocaleString()}{" "}
              <span className="text-xs font-semibold text-slate-500">MXN</span>
            </span>
          </div>

          {/* 3-Segment Bar */}
          <div className="w-full h-3 rounded-full bg-slate-200/80 overflow-hidden flex gap-0.5 p-0.5">
            <div
              style={{ width: `${fixedPct}%` }}
              className="h-full rounded-l-full bg-slate-500 transition-all duration-500"
            />
            <div
              style={{ width: `${bufferPct}%` }}
              className="h-full bg-slate-300 transition-all duration-500"
            />
            <div
              style={{ width: `${freePct}%` }}
              className={`h-full rounded-r-full transition-all duration-500 ${
                isStormy ? "bg-amber-500" : "bg-[#10B981]"
              }`}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-slate-700">
            <span>
              <strong className="text-slate-900">
                Saldo ${totalBalance.toLocaleString()}
              </strong>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-500" />
              Apartado para renta y pagos fijos: −$
              {fixedAndRentTotal.toLocaleString()}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-300" />
              Colchón: −${safetyBuffer.toLocaleString()}
            </span>
            <span className="flex items-center gap-1.5 font-bold text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-[#10B981]" />= Libre hoy:
              ${safeToSpend.toLocaleString()} MXN
            </span>
          </div>
        </div>
      </div>
    </motion.section>
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

  const [selectedDecision, setSelectedDecision] = useState<
    "idle" | "wait" | "microsave" | "bought"
  >("idle");
  const [decisionXpBonus, setDecisionXpBonus] = useState<number>(50);

  // Quick expense floating game button & toast feedback
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

  // Select RPG Shop Item Card
  const handleSelectShopItem = (item: (typeof RPG_SHOP_ITEMS)[number]) => {
    setSelectedDecision("idle");
    setQueryText(`${item.name} $${item.price.toLocaleString()}`);
    setParsedItemName(item.name);
    setParsedItemPrice(item.price);
    setScannedThumbnailUrl(null);
    setScannedStoreTag(null);
    setPendingEvaluation({
      name: item.name,
      price: item.price,
      imageName: null,
    });

    if (item.price > financialMetrics.safeToSpend) {
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
          VIEW 1: "SIMULAR COMPRA" (Hero World Diorama + RPG Shop Items + 3 Collectible Cards)
         ===================================================================== */}
      {activeBottomTab === "simulate" && (
        <div className="space-y-8">
          {/* 1. HERO WORLD DIORAMA: Panoramic Living Illustrated Stage */}
          <HeroWorldDiorama
            userName={profile.name}
            currentLevel={financialMetrics.currentLevel}
            currentLevelName={financialMetrics.currentLevelName}
            nextPaydayDays={profile.nextPaydayDays}
            totalBalance={financialMetrics.totalBalance}
            fixedAndRentTotal={financialMetrics.fixedAndRentTotal}
            safetyBuffer={financialMetrics.safetyBuffer}
            safeToSpend={financialMetrics.safeToSpend}
            fixedPct={financialMetrics.fixedPct}
            bufferPct={financialMetrics.bufferPct}
            freePct={financialMetrics.freePct}
            parsedItemName={parsedItemName}
            parsedItemPrice={parsedItemPrice}
            isDeficit={financialMetrics.isDeficit}
            missingLiquidity={financialMetrics.missingLiquidity}
            selectedDecision={selectedDecision}
            decisionXpBonus={decisionXpBonus}
            onExploreTree={() => setActiveBottomTab("home")}
          />

          {/* 2. SIMULATOR & RPG SHOP ITEM CARDS */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-white rounded-3xl border-2 border-b-4 border-slate-200 shadow-sm p-6 sm:p-8 space-y-6"
          >
            <div className="space-y-1">
              <h1 className="text-xl sm:text-2xl font-bold font-heading text-slate-900 tracking-tight">
                ¿Qué estás pensando comprar?
              </h1>
              <p className="text-sm text-slate-500">
                Elige un ítem de la tienda para simular el impacto en tu árbol o
                escribe cualquier precio.
              </p>
            </div>

            {/* Clean Search Input Bar with Integrated Camera Button on the Right */}
            <div className="relative flex items-center">
              <Search
                className="w-5 h-5 text-slate-400 absolute left-4 pointer-events-none"
                strokeWidth={1.5}
              />
              <input
                type="text"
                value={queryText}
                onChange={(e) => handleQueryInputChange(e.target.value)}
                placeholder="Ej. Audífonos $2,300 o escribe cualquier artículo..."
                className="w-full h-14 pl-12 pr-36 rounded-2xl border-2 border-slate-200 bg-slate-50/70 text-base font-semibold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#10B981] focus:outline-none transition-all"
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
                <QuickSnapScanner
                  inlineIconTrigger
                  onScanComplete={handleScanComplete}
                />
              </div>
            </div>

            {/* 4 RPG Shop Item Cards (grid-cols-2 sm:grid-cols-4 gap-3, zero truncated text, 3D border) */}
            <div className="space-y-2.5">
              <span className="text-xs font-bold font-heading text-slate-400 uppercase tracking-wider block">
                Ítems de prueba rápida:
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {RPG_SHOP_ITEMS.map((item) => {
                  const isSelected = parsedItemPrice === item.price;
                  return (
                    <motion.button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectShopItem(item)}
                      className={`border-2 border-b-4 rounded-2xl p-3 transition-transform hover:-translate-y-0.5 active:translate-y-0.5 flex flex-col items-center text-center gap-2.5 cursor-pointer ${
                        isSelected
                          ? "bg-emerald-50/50 border-[#10B981] border-b-emerald-600 shadow-sm"
                          : "bg-white border-slate-200 border-b-slate-300 hover:border-slate-300 shadow-2xs"
                      }`}
                    >
                      {/* Top Pastel Square with Large Emoji Illustration */}
                      <div
                        className={`w-full h-16 rounded-xl border flex items-center justify-center ${item.iconBg}`}
                      >
                        <span className="text-3xl select-none">
                          {item.emoji}
                        </span>
                      </div>

                      {/* Full Item Title (No truncation) */}
                      <span className="text-sm font-bold font-heading text-slate-900 leading-snug">
                        {item.name}
                      </span>

                      {/* Price Badge with Coin Icon */}
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold font-heading border ${
                          isSelected
                            ? "bg-[#10B981] text-white border-[#10B981]"
                            : "bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        <Coins
                          className={`w-3.5 h-3.5 ${
                            isSelected ? "text-amber-200" : "text-amber-500"
                          }`}
                          strokeWidth={1.5}
                        />
                        ${item.price.toLocaleString()}
                      </span>
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
                    <p className="text-sm font-bold text-slate-900">
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

          {/* 3. LAS 3 CARTAS DE CAMINO ILUSTRADAS (Collectible 3D Path Cards) */}
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
                  <h2 className="text-lg sm:text-xl font-bold font-heading text-slate-900">
                    Elige tu jugada para:{" "}
                    <span className="text-emerald-700">
                      {parsedItemName} (${parsedItemPrice.toLocaleString()} MXN)
                    </span>
                  </h2>
                  <span className="text-xs font-semibold text-slate-500">
                    Toca una carta para resolver la simulación
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* CARTA 1: Comprar hoy (Medallón Ámbar/Coral + Barra visual de impacto) */}
                  <motion.div
                    onClick={handleDecisionBuyToday}
                    className={`rounded-3xl bg-white border-2 border-b-4 p-6 shadow-sm flex flex-col justify-between gap-5 transition-all hover:-translate-y-1 active:translate-y-0.5 cursor-pointer ${
                      selectedDecision === "bought"
                        ? "border-amber-400 border-b-amber-600 ring-2 ring-amber-400/20"
                        : "border-slate-200 border-b-slate-300 hover:border-amber-300"
                    }`}
                  >
                    <div className="space-y-4">
                      {/* Top Header with 56x56 Animated Medallion & Badge */}
                      <div className="flex items-start justify-between gap-3">
                        <motion.div
                          animate={{ y: [0, -4, 0] }}
                          transition={{
                            duration: 2.8,
                            repeat: Infinity,
                            ease: "easeInOut",
                          }}
                          className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 border-2 border-amber-300 flex items-center justify-center shrink-0 shadow-xs"
                        >
                          <Zap
                            className="w-7 h-7 text-amber-600 fill-amber-400"
                            strokeWidth={1.5}
                          />
                        </motion.div>

                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold font-heading bg-amber-50 text-amber-900 border border-amber-200 text-right">
                          {financialMetrics.isDeficit
                            ? `Te faltan $${financialMetrics.missingLiquidity.toLocaleString()} libres`
                            : `Margen restante: $${Math.max(
                                0,
                                financialMetrics.netAfterPurchase
                              ).toLocaleString()}`}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-lg font-bold font-heading text-slate-900">
                          Comprar hoy
                        </h3>
                        <p className="text-sm text-slate-600 leading-relaxed mt-1">
                          {financialMetrics.isDeficit
                            ? `Tomaría $${financialMetrics.missingLiquidity.toLocaleString()} MXN del dinero apartado para tu renta/pagos fijos y retrasaría tu meta ${financialMetrics.weeksGoalDelayed} semanas.`
                            : `Lo cubres con tu disponible hoy, pero retrasas tu meta "${profile.goal.title}" ${financialMetrics.weeksGoalDelayed} semanas.`}
                        </p>
                      </div>

                      {/* Visual Impact Mini Bar */}
                      <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-1.5">
                        <div className="flex justify-between text-[11px] font-bold font-heading text-amber-900">
                          <span>Impacto en tu quincena</span>
                          <span>
                            {financialMetrics.isDeficit
                              ? "Sobregiro de pagos fijos"
                              : `−${financialMetrics.weeksGoalDelayed} sem de meta`}
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-amber-200/70 overflow-hidden">
                          <div className="h-full w-full bg-amber-500 rounded-full" />
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="w-full h-11 rounded-xl border-2 border-b-4 border-slate-200 border-b-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold font-heading transition-colors cursor-pointer"
                    >
                      Registrar compra hoy
                    </button>
                  </motion.div>

                  {/* CARTA 2 (Destacada Esmeralda): Esperar a tu nómina (Medallón Esmeralda + Escudo Brillante +50 XP) */}
                  <motion.div
                    onClick={handleDecisionWaitPayroll}
                    className={`rounded-3xl bg-white border-2 border-b-4 p-6 shadow-sm flex flex-col justify-between gap-5 transition-all hover:-translate-y-1 active:translate-y-0.5 cursor-pointer ${
                      selectedDecision === "wait"
                        ? "border-[#10B981] border-b-emerald-700 ring-4 ring-emerald-500/15"
                        : "border-emerald-400 border-b-emerald-600"
                    }`}
                  >
                    <div className="space-y-4">
                      {/* Top Header with 56x56 Animated Emerald Shield Medallion & Floating +50 XP Pill */}
                      <div className="flex items-start justify-between gap-3">
                        <motion.div
                          animate={{ y: [0, -5, 0] }}
                          transition={{
                            duration: 2.5,
                            repeat: Infinity,
                            ease: "easeInOut",
                          }}
                          className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 border-2 border-emerald-400 flex items-center justify-center shrink-0 shadow-xs"
                        >
                          <Shield
                            className="w-7 h-7 text-emerald-600 fill-emerald-400/40"
                            strokeWidth={1.5}
                          />
                        </motion.div>

                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold font-heading bg-emerald-50 text-emerald-900 border border-emerald-300">
                          <Sparkles
                            className="w-3.5 h-3.5 text-emerald-600"
                            strokeWidth={1.5}
                          />
                          Recomendada · +50 XP
                        </span>
                      </div>

                      <div>
                        <h3 className="text-lg font-bold font-heading text-slate-900">
                          Esperar a tu nómina (en {profile.nextPaydayDays} días)
                        </h3>
                        <p className="text-sm text-slate-600 leading-relaxed mt-1">
                          En {profile.nextPaydayDays} días cobras $
                          {profile.nextPaydayAmount.toLocaleString()} MXN y lo
                          compras con tranquilidad sin tocar el dinero de tu
                          renta ni pagos fijos.
                        </p>
                      </div>

                      {/* Visual Protection Bar */}
                      <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 space-y-1.5">
                        <div className="flex justify-between text-[11px] font-bold font-heading text-emerald-900">
                          <span>Pagos fijos protegidos</span>
                          <span>100% intactos</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-emerald-200/70 overflow-hidden">
                          <div className="h-full w-full bg-[#10B981] rounded-full" />
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="w-full h-11 rounded-xl bg-[#10B981] hover:bg-emerald-600 border-2 border-emerald-600 border-b-4 border-b-emerald-800 text-white text-xs font-bold font-heading shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Clock className="w-4 h-4" strokeWidth={1.5} />
                      <span>Esperar {profile.nextPaydayDays} días (+50 XP)</span>
                      <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                  </motion.div>

                  {/* CARTA 3: Plan de Micro-ahorro (Medallón Violeta/Azul + Alcancía Brillante +100 XP) */}
                  <motion.div
                    onClick={handleDecisionMicroSave}
                    className={`rounded-3xl bg-white border-2 border-b-4 p-6 shadow-sm flex flex-col justify-between gap-5 transition-all hover:-translate-y-1 active:translate-y-0.5 cursor-pointer ${
                      selectedDecision === "microsave"
                        ? "border-indigo-400 border-b-indigo-600 ring-2 ring-indigo-400/20"
                        : "border-slate-200 border-b-slate-300 hover:border-indigo-300"
                    }`}
                  >
                    <div className="space-y-4">
                      {/* Top Header with 56x56 Animated Violet/Indigo PiggyBank Medallion & +100 XP */}
                      <div className="flex items-start justify-between gap-3">
                        <motion.div
                          animate={{ y: [0, -4, 0] }}
                          transition={{
                            duration: 2.7,
                            delay: 0.2,
                            repeat: Infinity,
                            ease: "easeInOut",
                          }}
                          className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 border-2 border-indigo-300 flex items-center justify-center shrink-0 shadow-xs"
                        >
                          <PiggyBank
                            className="w-7 h-7 text-indigo-600 fill-indigo-300/40"
                            strokeWidth={1.5}
                          />
                        </motion.div>

                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold font-heading bg-indigo-50 text-indigo-900 border border-indigo-200">
                          <Sparkles
                            className="w-3.5 h-3.5 text-indigo-600"
                            strokeWidth={1.5}
                          />
                          Sin estrés · +100 XP
                        </span>
                      </div>

                      <div>
                        <h3 className="text-lg font-bold font-heading text-slate-900">
                          Plan de Micro-ahorro
                        </h3>
                        <p className="text-sm text-slate-600 leading-relaxed mt-1">
                          Aparta{" "}
                          <strong className="text-slate-900">
                            ${financialMetrics.suggestedWeeklySave}/semana
                          </strong>{" "}
                          y cómpralo en{" "}
                          <strong className="text-slate-900">
                            {financialMetrics.microSaveWeeks} semanas
                          </strong>{" "}
                          sin afectar tu colchón ni tu meta principal.
                        </p>
                      </div>

                      {/* Visual Weekly Progress Bar */}
                      <div className="p-3 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 space-y-1.5">
                        <div className="flex justify-between text-[11px] font-bold font-heading text-indigo-900">
                          <span>Meta en {financialMetrics.microSaveWeeks} pasos</span>
                          <span>${financialMetrics.suggestedWeeklySave}/sem</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-indigo-200/70 overflow-hidden">
                          <div className="h-full w-4/5 bg-indigo-500 rounded-full" />
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="w-full h-11 rounded-xl border-2 border-b-4 border-indigo-200 border-b-indigo-300 bg-indigo-50/60 hover:bg-indigo-100/80 text-indigo-950 text-xs font-bold font-heading transition-colors cursor-pointer"
                    >
                      Apartar ${financialMetrics.suggestedWeeklySave}/sem (+100 XP)
                    </button>
                  </motion.div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          {/* Saved Wishlist Summary Strip */}
          {profile.wishlist && profile.wishlist.length > 0 && (
            <div className="rounded-2xl border-2 border-slate-200 bg-white px-5 py-4 shadow-2xs flex items-center justify-between gap-3">
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
              <span className="text-xs font-bold font-heading text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-0.5 rounded-full shrink-0">
                +XP Activo
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
          <FinancialPlantWidget
            simulationState={plantSimulationState}
            previewDamagePrice={0}
            recoveredXpBonus={decisionXpBonus}
            allowLevelPreview
          />

          <section className="bg-white rounded-3xl border-2 border-b-4 border-slate-200 shadow-sm p-6 sm:p-8 space-y-5">
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
                    className={`rounded-2xl border-2 border-b-4 p-4 flex flex-col justify-between gap-2 transition-all ${
                      isCurrent
                        ? "border-[#10B981] border-b-emerald-600 bg-emerald-50/40 shadow-2xs"
                        : "border-slate-200 border-b-slate-300 bg-white"
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

          <section className="bg-white rounded-3xl border-2 border-b-4 border-slate-200 shadow-sm p-6 sm:p-8 space-y-4">
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
          <div className="bg-white rounded-3xl border-2 border-b-4 border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
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
                className="px-4 py-2 rounded-xl bg-[#10B981] text-white text-xs font-bold font-heading cursor-pointer"
              >
                Celebrar avance 🎉
              </motion.button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl border-2 border-b-4 border-slate-200 bg-slate-50/60 space-y-1">
                <span className="text-xs font-semibold text-slate-500">
                  Racha actual
                </span>
                <p className="text-2xl font-bold font-heading text-slate-900">
                  {profile.streakCount ?? 3} días consecutivos 🔥
                </p>
                <p className="text-xs text-slate-600">
                  Consultando al simulador antes de realizar compras no
                  planeadas.
                </p>
              </div>

              <div className="p-5 rounded-2xl border-2 border-b-4 border-slate-200 bg-slate-50/60 space-y-1">
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

            <div className="p-5 rounded-2xl border-2 border-b-4 border-slate-200 bg-white space-y-3">
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
          <div className="bg-white rounded-3xl border-2 border-b-4 border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
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
                    className={`text-left p-5 rounded-2xl border-2 border-b-4 transition-all flex items-center justify-between cursor-pointer ${
                      isCurrent
                        ? "bg-emerald-50/50 border-[#10B981] border-b-emerald-600 shadow-2xs"
                        : "bg-white border-slate-200 border-b-slate-300 hover:border-slate-300"
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
              className="w-full h-12 rounded-2xl border-2 border-b-4 border-slate-200 border-b-slate-300 bg-slate-50 hover:bg-slate-100 text-sm font-bold font-heading text-slate-800 flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4" strokeWidth={1.5} />
              <span>Personalizar perfil desde cero (Onboarding)</span>
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* 5. Game-Style Action Button: "Registrar gasto rápido" with Golden Lightning Icon */}
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
              className="bg-slate-900 text-white border-b-4 border-slate-950 rounded-2xl px-5 py-3 shadow-xl hover:scale-105 transition flex items-center gap-2.5 text-xs sm:text-sm font-bold font-heading cursor-pointer"
            >
              <Zap
                className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0"
                strokeWidth={1.5}
              />
              <span>Registrar gasto rápido</span>
            </motion.button>
          ) : (
            <motion.form
              key="expanded-quick-expense"
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              onSubmit={handleQuickExpenseSubmit}
              className="w-80 sm:w-96 rounded-2xl bg-slate-900 text-white border-2 border-b-4 border-slate-950 shadow-2xl p-2.5 flex items-center gap-2"
            >
              <Zap
                className="w-4 h-4 text-amber-400 fill-amber-400 ml-2 shrink-0"
                strokeWidth={1.5}
              />
              <input
                type="text"
                autoFocus
                value={quickExpenseInput}
                onChange={(e) => setQuickExpenseInput(e.target.value)}
                placeholder='Ej. "Gasté 150 en comida"'
                className="flex-1 h-9 px-2 text-xs sm:text-sm font-medium text-white placeholder:text-slate-400 bg-transparent focus:outline-none"
              />
              <motion.button
                type="submit"
                whileTap={{ scale: 0.96 }}
                className="h-9 px-3.5 rounded-xl bg-[#10B981] hover:bg-emerald-600 text-white text-xs font-bold font-heading flex items-center gap-1 cursor-pointer shrink-0"
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
                className="p-1.5 rounded-xl text-slate-400 hover:text-white cursor-pointer"
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
