"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
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
  Volume2,
  VolumeX,
  Link2,
  Snowflake,
  Home,
  Loader2,
  ExternalLink,
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
    fullName: "Audífonos Inalámbricos Sony",
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

// Firecrawl / URL Smart Parser Demo Store Presets
const STORE_URL_PRESETS = [
  {
    url: "https://amazon.com.mx/dp/B0863TXGM3/audifonos-sony-wh1000xm5",
    domain: "amazon.com.mx",
    name: "Audífonos Sony WH-1000XM4 ANC",
    price: 2300,
    svgThumb: `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
        <rect width="120" height="120" rx="20" fill="#ECFDF5"/>
        <path d="M34 68 A 26 26 0 0 1 86 68" fill="none" stroke="#0F172A" stroke-width="8" stroke-linecap="round"/>
        <rect x="26" y="60" width="16" height="28" rx="8" fill="#10B981"/>
        <rect x="78" y="60" width="16" height="28" rx="8" fill="#10B981"/>
      </svg>
    `)}`,
  },
  {
    url: "https://mercadolibre.com.mx/tenis-nike-air-force-1800",
    domain: "mercadolibre.com.mx",
    name: "Tenis Nike Air Force 1",
    price: 1800,
    svgThumb: `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
        <rect width="120" height="120" rx="20" fill="#FEF3C7"/>
        <path d="M24 72 L52 50 L68 60 L96 66 L96 82 L24 82 Z" fill="#D97706"/>
        <rect x="22" y="80" width="76" height="10" rx="5" fill="#FFFFFF" stroke="#0F172A" stroke-width="2"/>
      </svg>
    `)}`,
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
    description:
      "Brote joven: tus compromisos de los próximos días están cubiertos.",
    milestone: "100 – 250 XP",
  },
  {
    level: 3,
    title: "Seguridad",
    description:
      "Planta frondosa: cuentas con tu colchón de tranquilidad intacto.",
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
    description:
      "Árbol radiante: dominio total de tu liquidez y ahorro constante.",
    milestone: "700+ XP",
  },
];

const UNLOCKED_MEDALS = [
  {
    id: "m1",
    emoji: "🧊",
    title: "Maestro del Enfriamiento",
    desc: "Congelaste una compra impulsiva por 6 días",
    unlocked: true,
  },
  {
    id: "m2",
    emoji: "🛡️",
    title: "Guardián de la Renta",
    desc: "Protegiste el 100% de tus pagos fijos esta semana",
    unlocked: true,
  },
  {
    id: "m3",
    emoji: "🔥",
    title: "Racha Imparable",
    desc: "3+ días consultando a tu copiloto antes de pagar",
    unlocked: true,
  },
];

const FIRST_VISIT_GUIDE_KEY = "antesdegastar_seen_quick_guide_v1";

/**
 * Hero World: Panoramic Living Illustrated Diorama (Optimized height for Zero-Scroll on Desktop)
 * Includes Native Web Speech API (window.speechSynthesis) Voice Button & Auto-Voice Toggle
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
  rpgSpeechMessage,
  isSpeaking,
  autoVoiceEnabled,
  onSpeakNow,
  onToggleAutoVoice,
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
  rpgSpeechMessage: string;
  isSpeaking: boolean;
  autoVoiceEnabled: boolean;
  onSpeakNow: () => void;
  onToggleAutoVoice: () => void;
  onExploreTree: () => void;
}) {
  const isStormy =
    isDeficit &&
    selectedDecision !== "wait" &&
    selectedDecision !== "microsave";
  const isCelebrating =
    selectedDecision === "wait" || selectedDecision === "microsave";

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative rounded-3xl overflow-hidden border-2 border-b-4 transition-all duration-500 shadow-sm ${
        isStormy
          ? "border-amber-300 border-b-amber-500 bg-gradient-to-b from-amber-100/90 via-orange-50/80 to-amber-100/60"
          : "border-emerald-300 border-b-emerald-500 bg-gradient-to-b from-sky-100/90 via-emerald-50/60 to-emerald-100/80"
      }`}
    >
      {/* 1. Animated Panoramic SVG Landscape Background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <svg
          viewBox="0 0 900 280"
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

          {!isStormy ? (
            <motion.g
              animate={{ scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <circle cx="800" cy="54" r="40" fill="#FDE047" opacity="0.35" />
              <circle cx="800" cy="54" r="24" fill="#FACC15" />
            </motion.g>
          ) : (
            <circle cx="800" cy="54" r="32" fill="#F59E0B" opacity="0.25" />
          )}

          {/* Floating Clouds */}
          <motion.g
            animate={{ x: [-12, 18, -12] }}
            transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
            opacity={isStormy ? 0.85 : 0.75}
          >
            <path
              d="M110 58 C110 46 124 38 138 42 C146 30 166 30 174 42 C188 42 198 52 196 64 C196 72 188 76 176 76 L122 76 C114 76 110 68 110 58 Z"
              fill={isStormy ? "#CBD5E1" : "#FFFFFF"}
            />
          </motion.g>

          <motion.g
            animate={{ x: [16, -16, 16] }}
            transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
            opacity={isStormy ? 0.9 : 0.7}
          >
            <path
              d="M520 46 C520 34 532 26 546 30 C554 18 572 18 580 30 C592 30 602 38 600 50 C600 58 592 62 580 62 L530 62 C522 62 520 54 520 46 Z"
              fill={isStormy ? "#94A3B8" : "#FFFFFF"}
            />
          </motion.g>

          {/* Raindrops when Stormy */}
          {isStormy && (
            <g>
              {[
                { x: 145, y: 80, d: 0 },
                { x: 175, y: 88, d: 0.3 },
                { x: 545, y: 68, d: 0.15 },
                { x: 575, y: 76, d: 0.5 },
                { x: 740, y: 78, d: 0.25 },
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
                  animate={{ y: [0, 44], opacity: [0, 0.85, 0] }}
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

          {/* Sparkling Particles when Sunny */}
          {!isStormy && (
            <g>
              {[
                { cx: 280, cy: 42, r: 3.5, d: 0 },
                { cx: 430, cy: 64, r: 3, d: 0.8 },
                { cx: 680, cy: 38, r: 4, d: 1.4 },
              ].map((sp, idx) => (
                <motion.circle
                  key={idx}
                  cx={sp.cx}
                  cy={sp.cy}
                  r={sp.r}
                  fill="#FBBF24"
                  animate={{ y: [0, -7, 0], opacity: [0.35, 1, 0.35] }}
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

          {/* Rolling Hills */}
          <path
            d="M0 190 Q220 140 470 180 T900 165 L900 280 L0 280 Z"
            fill={isStormy ? "url(#hillBackStorm)" : "url(#hillBackSunny)"}
            opacity="0.7"
          />
          <path
            d="M0 210 Q260 165 540 200 T900 190 L900 280 L0 280 Z"
            fill={isStormy ? "url(#hillFrontStorm)" : "url(#hillFrontSunny)"}
            opacity="0.85"
          />
        </svg>
      </div>

      {/* 2. Foreground Diorama Content (Compact vertical padding lg:p-5 so everything fits on 1 desktop screen) */}
      <div className="relative z-10 p-4 sm:p-5 space-y-3">
        {/* Top Row: Level Pill + Copilot Voice Toggle + Weather Indicator */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
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
              className="px-2.5 py-1 rounded-full text-xs font-bold font-heading bg-white/75 hover:bg-white text-slate-700 border border-white/80 transition-colors cursor-pointer"
            >
              Ver evolución →
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Voz del Copiloto 🔊 Toggle */}
            <button
              type="button"
              onClick={onToggleAutoVoice}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-heading border transition-all cursor-pointer shadow-2xs ${
                autoVoiceEnabled
                  ? "bg-[#10B981] text-white border-emerald-600"
                  : "bg-white/90 text-slate-700 border-white hover:bg-white"
              }`}
              title="Activar o desactivar lectura automática en voz alta"
            >
              {autoVoiceEnabled ? (
                <Volume2 className="w-3.5 h-3.5" strokeWidth={1.5} />
              ) : (
                <VolumeX
                  className="w-3.5 h-3.5 text-slate-400"
                  strokeWidth={1.5}
                />
              )}
              <span>Voz del Copiloto 🔊</span>
            </button>

            <div
              className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-heading border shadow-2xs ${
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
                  <span>Clima en alerta</span>
                </>
              ) : (
                <>
                  <Sun
                    className="w-3.5 h-3.5 text-amber-500"
                    strokeWidth={1.5}
                  />
                  <span>
                    {isCelebrating
                      ? `+${decisionXpBonus} XP`
                      : `Nómina en ${nextPaydayDays}d`}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Center Stage: Large 125px Animated Plant/Tree + Comic/RPG Speech Bubble with Interactive Speaker */}
        <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-5">
          {/* 125px Animated Financial Tree */}
          <div className="relative w-28 h-28 sm:w-32 sm:h-32 shrink-0 flex items-center justify-center">
            {isCelebrating && (
              <motion.div
                animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.75, 0.4] }}
                transition={{ duration: 2.2, repeat: Infinity }}
                className="absolute w-28 h-28 rounded-full bg-amber-300/50 blur-xl"
              />
            )}

            <svg
              viewBox="0 0 180 170"
              className="w-full h-full overflow-visible drop-shadow-sm"
              aria-label="Tu Planta Financiera en el escenario vivo"
            >
              <ellipse
                cx="90"
                cy="154"
                rx="46"
                ry="8"
                fill="rgba(15,23,42,0.14)"
              />
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
                <path d="M84 110 L87 56 L93 56 L96 110 Z" fill="#78350F" />
                <path
                  d="M88 80 L70 62 M92 76 L110 60"
                  stroke="#78350F"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                />

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

                {!isStormy && (
                  <>
                    <circle cx="76" cy="36" r="5" fill="#FDE047" />
                    <circle cx="104" cy="42" r="5" fill="#FDE047" />
                    <circle cx="60" cy="60" r="4.5" fill="#F472B6" />
                    <circle cx="120" cy="60" r="4.5" fill="#F472B6" />
                  </>
                )}
              </motion.g>

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

          {/* Floating RPG Speech Bubble + Circular Speaker Button with Animated Waves */}
          <motion.div
            key={rpgSpeechMessage}
            initial={{ opacity: 0, scale: 0.96, x: -6 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}
            className={`relative flex-1 rounded-3xl border-2 border-b-4 p-3.5 sm:p-4 shadow-sm ${
              isStormy
                ? "bg-white/95 border-amber-300 border-b-amber-400 text-slate-900"
                : isCelebrating
                  ? "bg-white/95 border-emerald-400 border-b-emerald-500 text-slate-900"
                  : "bg-white/95 border-white border-b-slate-200 text-slate-900"
            }`}
          >
            <div
              aria-hidden="true"
              className="hidden sm:block absolute -left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rotate-45 bg-white border-l-2 border-b-2 border-slate-200"
            />

            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
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
                    <span className="text-[11px] font-bold font-heading px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                      Faltan ${missingLiquidity.toLocaleString()} MXN
                    </span>
                  )}
                </div>

                <p className="text-sm sm:text-base font-bold font-heading text-slate-900 leading-snug">
                  “{rpgSpeechMessage}”
                </p>
              </div>

              {/* Circular Speaker Button with Animated Sound Waves */}
              <motion.button
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={onSpeakNow}
                className={`relative w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0 cursor-pointer transition-all ${
                  isSpeaking
                    ? "bg-[#10B981] text-white border-emerald-600 shadow-sm"
                    : "bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border-slate-200"
                }`}
                title="Escuchar consejo de tu planta en voz alta"
                aria-label="Escuchar consejo en voz alta"
              >
                {isSpeaking && (
                  <>
                    <motion.span
                      animate={{ scale: [1, 1.55], opacity: [0.6, 0] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="absolute inset-0 rounded-full border-2 border-emerald-400"
                    />
                    <motion.span
                      animate={{ scale: [1, 1.3], opacity: [0.8, 0] }}
                      transition={{
                        duration: 1,
                        delay: 0.3,
                        repeat: Infinity,
                      }}
                      className="absolute inset-0 rounded-full border-2 border-emerald-500"
                    />
                  </>
                )}
                <Volume2 className="w-4 h-4 relative z-10" strokeWidth={1.5} />
              </motion.button>
            </div>
          </motion.div>
        </div>

        {/* 3. Translucent Integrated Bottom Liquidity Bar (Compact p-3.5) */}
        <div className="bg-white/90 backdrop-blur-md rounded-2xl p-3 sm:p-3.5 border border-white shadow-xs space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-xs font-bold font-heading text-slate-600">
              Disponible para gastar hoy:
            </span>
            <span className="text-lg sm:text-xl font-bold font-heading text-slate-900">
              ${safeToSpend.toLocaleString()}{" "}
              <span className="text-xs font-semibold text-slate-500">MXN</span>
            </span>
          </div>

          <div className="w-full h-2.5 rounded-full bg-slate-200/80 overflow-hidden flex gap-0.5 p-0.5">
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

          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] sm:text-xs text-slate-700">
            <span>
              <strong className="text-slate-900">
                Saldo ${totalBalance.toLocaleString()}
              </strong>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-slate-500" />
              Apartado renta y pagos fijos: −$
              {fixedAndRentTotal.toLocaleString()}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-slate-300" />
              Colchón: −${safetyBuffer.toLocaleString()}
            </span>
            <span className="flex items-center gap-1 font-bold text-emerald-700">
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
    mode,
    profileError,
    refreshProfile,
    signOut,
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

  // Simulator State
  const [queryText, setQueryText] = useState("");
  const [parsedItemName, setParsedItemName] = useState("");
  const [parsedItemPrice, setParsedItemPrice] = useState<number>(0);
  const [scannedThumbnailUrl, setScannedThumbnailUrl] = useState<string | null>(
    null,
  );
  const [scannedStoreTag, setScannedStoreTag] = useState<string | null>(null);

  // Firecrawl / URL Smart Parser State
  const [isExtractingUrl, setIsExtractingUrl] = useState(false);
  const [extractingDomain, setExtractingDomain] = useState("");
  const [urlPresetIndex, setUrlPresetIndex] = useState(0);

  // Native Text-to-Speech (Voz Interactiva para la Planta)
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoVoiceEnabled, setAutoVoiceEnabled] = useState(false);

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

  useEffect(() => {
    if (mode === "anonymous") router.replace("/auth");
    if (mode === "authenticated" && !profile.isOnboarded)
      router.replace("/onboarding");
  }, [mode, profile.isOnboarded, router]);

  const triggerToast = (message: string) => {
    const id = Date.now();
    setToastFeedback({ id, message });
    setTimeout(() => {
      setToastFeedback((current) => (current?.id === id ? null : current));
    }, 4200);
  };

  // Financial, 3-Segment Liquidity & Pre-Purchase Real-Life Cost Pills Metrics
  const financialMetrics = useMemo(() => {
    const commitmentsTotal = profile.commitments
      .filter((c) => c.dueInDays <= profile.nextPaydayDays)
      .reduce((acc, c) => acc + c.amount, 0);

    const essentialLivingCost =
      profile.dailyEssentialBurn * profile.nextPaydayDays;

    const fixedAndRentTotal = commitmentsTotal + essentialLivingCost;

    const safeToSpend = Math.max(
      0,
      profile.currentBalance - fixedAndRentTotal - profile.safetyBuffer,
    );

    const totalBalance = Math.max(
      1,
      profile.currentBalance ||
        fixedAndRentTotal + profile.safetyBuffer + safeToSpend,
    );

    const fixedPct = Math.min(
      82,
      Math.max(15, Math.round((fixedAndRentTotal / totalBalance) * 100)),
    );
    const bufferPct = Math.min(
      35,
      Math.max(10, Math.round((profile.safetyBuffer / totalBalance) * 100)),
    );
    const freePct = Math.max(8, 100 - fixedPct - bufferPct);

    const netAfterPurchase = safeToSpend - parsedItemPrice;
    const isDeficit = parsedItemPrice > 0 && netAfterPurchase < 0;
    const missingLiquidity = isDeficit ? Math.abs(netAfterPurchase) : 0;

    const weeklyGoalContribution = Math.max(
      300,
      profile.goal.weeklyContribution || 500,
    );
    const weeksGoalDelayed = Math.max(
      1,
      Math.ceil(parsedItemPrice / weeklyGoalContribution),
    );

    // Real-Life Cost Psychology Pills:
    // 1. Work Hours (assuming ~80 work hours per quincena)
    const hourlyWage = Math.max(
      45,
      Math.round((profile.nextPaydayAmount || 6500) / 80),
    );
    const workHoursEquivalent =
      parsedItemPrice > 0
        ? Math.max(1, Math.round(parsedItemPrice / hourlyWage))
        : 0;

    // 2. Percentage of fixed weekly payments
    const fixedCommitmentsBase = Math.max(1000, fixedAndRentTotal);
    const fixedPaymentsPct =
      parsedItemPrice > 0
        ? Math.round((parsedItemPrice / fixedCommitmentsBase) * 100)
        : 0;

    // 3. Days main goal is delayed
    const dailyGoalRate = Math.max(25, weeklyGoalContribution / 7);
    const daysGoalDelayed =
      parsedItemPrice > 0
        ? Math.max(1, Math.round(parsedItemPrice / dailyGoalRate))
        : 0;

    const suggestedWeeklySave = 400;
    const microSaveWeeks = Math.max(
      1,
      Math.ceil(parsedItemPrice / suggestedWeeklySave),
    );

    const goalPct =
      profile.goal.targetAmount > 0
        ? Math.min(
            100,
            Math.round(
              (profile.goal.currentSaved / profile.goal.targetAmount) * 100,
            ),
          )
        : 0;

    // Total Protected Money in Impulse Freezer ("Compras en Enfriamiento 🧊")
    const totalProtectedMoney = (profile.wishlist || []).reduce(
      (sum, item) => sum + item.price,
      0,
    );

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
      workHoursEquivalent,
      fixedPaymentsPct,
      daysGoalDelayed,
      suggestedWeeklySave,
      microSaveWeeks,
      goalPct,
      totalProtectedMoney,
      currentLevel,
      currentLevelName: levelNames[currentLevel],
    };
  }, [profile, parsedItemPrice]);

  // Build Live RPG Speech Message
  const rpgSpeechMessage = useMemo(() => {
    const firstName = (profile.name || "Carlos").split(" ")[0];
    const isStormy =
      financialMetrics.isDeficit &&
      selectedDecision !== "wait" &&
      selectedDecision !== "microsave";
    const isCelebrating =
      selectedDecision === "wait" || selectedDecision === "microsave";

    if (isCelebrating) {
      return selectedDecision === "wait"
        ? `¡Gran jugada ${firstName}! Guardado en el congelador por ${profile.nextPaydayDays} días y subimos +50 XP ☀️`
        : `¡Plan maestro ${firstName}! Con micro-ahorro protegemos tu quincena y ganamos +100 XP ✨`;
    }
    if (isStormy) {
      return `¡Cuidado ${firstName}! Con "${parsedItemName}" ($${parsedItemPrice.toLocaleString()}) nos quedaríamos sin para la renta 🌧️`;
    }
    if (parsedItemPrice > 0) {
      return `¡Sí nos alcanza para "${parsedItemName}"! Aún conservarías $${Math.max(
        0,
        financialMetrics.safeToSpend - parsedItemPrice,
      ).toLocaleString()} MXN libres ☀️`;
    }
    return `¡Hola ${firstName}! Tienes $${financialMetrics.safeToSpend.toLocaleString()} MXN libres hoy. ¿Qué evaluamos? 🌱`;
  }, [
    profile.name,
    profile.nextPaydayDays,
    financialMetrics.isDeficit,
    financialMetrics.safeToSpend,
    selectedDecision,
    parsedItemName,
    parsedItemPrice,
  ]);

  // Native Text-to-Speech Function (window.speechSynthesis in friendly Spanish)
  const speakAdviceText = useCallback((textToRead: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      // Strip emojis so speechSynthesis reads natural Spanish words cleanly
      const cleanText = textToRead
        .replace(
          /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
          "",
        )
        .replace(/\$/g, "")
        .replace(/MXN/g, "pesos")
        .trim();

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = "es-MX";
      utterance.rate = 1.04;
      utterance.pitch = 1.08;

      const voices = window.speechSynthesis.getVoices();
      const spanishVoice =
        voices.find(
          (v) =>
            v.lang.includes("es-MX") ||
            v.lang.includes("es-ES") ||
            v.lang.startsWith("es"),
        ) || null;
      if (spanishVoice) {
        utterance.voice = spanishVoice;
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    } catch {
      setIsSpeaking(false);
    }
  }, []);

  // Auto-read when autoVoiceEnabled is active and the speech message updates
  useEffect(() => {
    if (autoVoiceEnabled && rpgSpeechMessage) {
      speakAdviceText(rpgSpeechMessage);
    }
  }, [autoVoiceEnabled, rpgSpeechMessage, speakAdviceText]);

  // Firecrawl / Smart Store URL Parser Simulator
  const triggerStoreUrlExtraction = async (rawUrl: string) => {
    playTap();
    setSelectedDecision("idle");

    let domain = "amazon.com.mx";
    try {
      const parsed = new URL(
        rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`,
      );
      domain = parsed.hostname.replace(/^www\./, "");
    } catch {
      domain = "tienda online";
    }

    setExtractingDomain(domain);
    setIsExtractingUrl(true);

    // 1.25s animated Firecrawl extraction state
    await new Promise((resolve) => setTimeout(resolve, 1250));

    const lower = rawUrl.toLowerCase();
    let extractedName = "Audífonos Sony WH-1000XM4 ANC";
    let extractedPrice = 2300;
    let thumb = STORE_URL_PRESETS[0].svgThumb;

    if (
      lower.includes("tenis") ||
      lower.includes("nike") ||
      lower.includes("jordan")
    ) {
      extractedName = "Tenis Nike Air Force 1";
      extractedPrice = 1800;
      thumb = STORE_URL_PRESETS[1].svgThumb;
    } else if (
      lower.includes("switch") ||
      lower.includes("juego") ||
      lower.includes("gamer")
    ) {
      extractedName = "Videojuego Edición Especial";
      extractedPrice = 1200;
    } else {
      const numMatch = rawUrl.match(/(\d{3,5})/);
      if (numMatch) {
        extractedPrice = Number(numMatch[1]);
      }
    }

    setIsExtractingUrl(false);
    setParsedItemName(extractedName);
    setParsedItemPrice(extractedPrice);
    setScannedThumbnailUrl(thumb);
    setScannedStoreTag(`Firecrawl · ${domain}`);
    setPendingEvaluation({
      name: extractedName,
      price: extractedPrice,
      imageName: domain,
    });

    if (extractedPrice > financialMetrics.safeToSpend) {
      playDamage();
    } else {
      playCoin();
    }
  };

  // Real-Time Input Handler (Detects URLs automatically or parses text + price)
  const handleQueryInputChange = (value: string) => {
    setQueryText(value);
    setSelectedDecision("idle");

    if (!value.trim()) {
      setParsedItemName("");
      setParsedItemPrice(0);
      return;
    }

    // Detect if user pasted a store link (http://, https://, amazon., mercadolibre.)
    if (
      /^https?:\/\//i.test(value.trim()) ||
      /amazon\.com|mercadolibre\.com|liverpool\.com/i.test(value.trim())
    ) {
      void triggerStoreUrlExtraction(value.trim());
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

  // Demo Button: "🔗 Probar con link de tienda"
  const handleDemoStoreLinkClick = () => {
    const preset = STORE_URL_PRESETS[urlPresetIndex % STORE_URL_PRESETS.length];
    setUrlPresetIndex((prev) => prev + 1);
    setQueryText(preset.url);
    void triggerStoreUrlExtraction(preset.url);
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
    if (mode !== "demo") {
      triggerToast(
        "El registro real de compras requiere guardar la transacción en Supabase.",
      );
      return;
    }
    playDamage();
    setSelectedDecision("bought");
    registerPurchaseAnyway(parsedItemName, parsedItemPrice);
    triggerToast(
      `Compra registrada: −$${parsedItemPrice.toLocaleString()} MXN (${parsedItemName})`,
    );
  };

  // Decision 2: "Esperar a tu nómina (en X días)" -> Saves to "Compras en Enfriamiento 🧊" (+50 XP)
  const handleDecisionWaitPayroll = () => {
    if (mode !== "demo") {
      triggerToast(
        "La wishlist real se conectará a Supabase en el siguiente paso.",
      );
      return;
    }
    playCoin();
    triggerConfettiBurst();
    setDecisionXpBonus(50);
    setSelectedDecision("wait");
    addToWishlist(
      {
        name: parsedItemName,
        price: parsedItemPrice,
        cooldownDays: profile.nextPaydayDays,
        strategy: "wait",
      },
      50,
    );
    triggerToast(
      `🧊 ¡Guardado en tu Congelador por ${profile.nextPaydayDays} días! Acabas de proteger $${parsedItemPrice.toLocaleString()} MXN de tu quincena`,
    );
  };

  // Decision 3: "Plan de Micro-ahorro" -> Saves to "Compras en Enfriamiento 🧊" (+100 XP)
  const handleDecisionMicroSave = () => {
    if (mode !== "demo") {
      triggerToast(
        "La wishlist real se conectará a Supabase en el siguiente paso.",
      );
      return;
    }
    playCoin();
    triggerConfettiBurst();
    setDecisionXpBonus(100);
    setSelectedDecision("microsave");
    addToWishlist(
      {
        name: parsedItemName,
        price: parsedItemPrice,
        plannedWeeklySave: financialMetrics.suggestedWeeklySave,
        cooldownDays: profile.nextPaydayDays,
        strategy: "microsave",
      },
      100,
    );
    triggerToast(
      `🧊 ¡Guardado en tu Congelador por ${profile.nextPaydayDays} días! Acabas de proteger $${parsedItemPrice.toLocaleString()} MXN de tu quincena`,
    );
  };

  const handleQuickExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode !== "demo") {
      triggerToast(
        "El registro de gastos reales aún requiere una operación en Supabase.",
      );
      return;
    }
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
      `Gasto registrado: −$${amount.toLocaleString()} MXN (${quickExpenseInput.trim()})`,
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

  if (mode === "loading") {
    return (
      <div className="min-h-screen grid place-items-center">
        Cargando tu perfil financiero...
      </div>
    );
  }
  if (mode === "error") {
    return (
      <div className="min-h-screen grid place-items-center p-6 text-center">
        <div>
          <p role="alert">No pudimos cargar tu perfil: {profileError}</p>
          <button
            type="button"
            onClick={() => void refreshProfile()}
            className="mt-3 underline"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }
  if (
    mode === "anonymous" ||
    (mode === "authenticated" && !profile.isOnboarded)
  ) {
    return (
      <div className="min-h-screen grid place-items-center">
        Redirigiendo...
      </div>
    );
  }

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
          VIEW 1: "SIMULAR COMPRA" (Zero-Scroll Desktop Layout: Diorama + Search/Pills + 3 Decision Cards)
         ===================================================================== */}
      {activeBottomTab === "simulate" && (
        <div className="space-y-4">
          {/* 1. HERO WORLD DIORAMA: Panoramic Living Stage with Voice Synthesis */}
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
            rpgSpeechMessage={rpgSpeechMessage}
            isSpeaking={isSpeaking}
            autoVoiceEnabled={autoVoiceEnabled}
            onSpeakNow={() => speakAdviceText(rpgSpeechMessage)}
            onToggleAutoVoice={() => {
              playTap();
              const nextState = !autoVoiceEnabled;
              setAutoVoiceEnabled(nextState);
              if (nextState) {
                speakAdviceText(rpgSpeechMessage);
              } else if (
                typeof window !== "undefined" &&
                "speechSynthesis" in window
              ) {
                window.speechSynthesis.cancel();
                setIsSpeaking(false);
              }
            }}
            onExploreTree={() => setActiveBottomTab("home")}
          />

          {/* 2. COMPACT SIMULATOR, STORE LINK PARSER & RPG SHOP ITEM CARDS */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 }}
            className="bg-white rounded-3xl border-2 border-b-4 border-slate-200 shadow-sm p-4 sm:p-5 space-y-3.5"
          >
            {/* Header Row + "🔗 Probar con link de tienda" Button */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h1 className="text-lg sm:text-xl font-bold font-heading text-slate-900 tracking-tight">
                  ¿Qué estás pensando comprar?
                </h1>
              </div>

              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={handleDemoStoreLinkClick}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-200 text-xs font-bold font-heading text-slate-700 hover:text-emerald-800 transition-colors cursor-pointer"
              >
                <Link2
                  className="w-3.5 h-3.5 text-emerald-600"
                  strokeWidth={1.5}
                />
                <span>🔗 Probar con link de tienda</span>
              </motion.button>
            </div>

            {/* Clean Search / URL Input Bar with Integrated Camera Button on the Right */}
            <div className="relative flex items-center">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none"
                strokeWidth={1.5}
              />
              <input
                type="text"
                value={queryText}
                onChange={(e) => handleQueryInputChange(e.target.value)}
                placeholder="Escribe ej. Audífonos $2,300 o pega un link de Amazon / MercadoLibre..."
                className="w-full h-12 pl-10 pr-32 rounded-2xl border-2 border-slate-200 bg-slate-50/70 text-sm sm:text-base font-semibold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#10B981] focus:outline-none transition-all"
              />
              <div className="absolute right-1.5 flex items-center gap-1">
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
                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
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

            {/* Animated Firecrawl / Store URL Extraction Banner */}
            <AnimatePresence>
              {isExtractingUrl && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-2xl border border-emerald-300 bg-emerald-50/80 px-4 py-3 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5">
                    <Loader2
                      className="w-4 h-4 text-emerald-600 animate-spin shrink-0"
                      strokeWidth={1.5}
                    />
                    <span className="text-xs sm:text-sm font-bold font-heading text-emerald-950">
                      Extrayendo producto y precio de la tienda online (
                      {extractingDomain})...
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-white text-emerald-700 border border-emerald-200">
                    Firecrawl Parser
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Real-Life Cost Psychology Pills (Píldoras de Costo de Vida Real) */}
            <AnimatePresence>
              {hasSelectedProduct && !isExtractingUrl && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex flex-wrap items-center gap-2 pt-0.5"
                >
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-heading bg-slate-100 text-slate-800 border border-slate-200">
                    <Clock
                      className="w-3.5 h-3.5 text-emerald-600 shrink-0"
                      strokeWidth={1.5}
                    />
                    <span>
                      ⏱️ Equivale a{" "}
                      <strong>
                        {financialMetrics.workHoursEquivalent} horas
                      </strong>{" "}
                      de tu trabajo
                    </span>
                  </span>

                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-heading bg-slate-100 text-slate-800 border border-slate-200">
                    <Home
                      className="w-3.5 h-3.5 text-amber-600 shrink-0"
                      strokeWidth={1.5}
                    />
                    <span>
                      🏠 Representa el{" "}
                      <strong>{financialMetrics.fixedPaymentsPct}%</strong> de
                      tus pagos fijos de esta semana
                    </span>
                  </span>

                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-heading bg-slate-100 text-slate-800 border border-slate-200">
                    <Target
                      className="w-3.5 h-3.5 text-indigo-600 shrink-0"
                      strokeWidth={1.5}
                    />
                    <span>
                      🎯 Retrasa tu meta principal{" "}
                      <strong>{financialMetrics.daysGoalDelayed} días</strong>
                    </span>
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Scanned / Extracted URL Product Card Preview */}
            {scannedThumbnailUrl && !isExtractingUrl && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={scannedThumbnailUrl}
                    alt={parsedItemName}
                    className="w-10 h-10 rounded-xl object-cover border border-slate-200 bg-white shrink-0"
                  />
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" strokeWidth={1.5} />
                      {scannedStoreTag}
                    </span>
                    <p className="text-xs sm:text-sm font-bold font-heading text-slate-900 truncate">
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

            {/* 4 Compact RPG Shop Item Cards (grid-cols-2 sm:grid-cols-4 gap-2.5, zero truncated text, fits on 1 screen) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {RPG_SHOP_ITEMS.map((item) => {
                const isSelected = parsedItemPrice === item.price;
                return (
                  <motion.button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectShopItem(item)}
                    className={`border-2 border-b-4 rounded-2xl p-2.5 transition-transform hover:-translate-y-0.5 active:translate-y-0.5 flex items-center gap-2.5 text-left cursor-pointer ${
                      isSelected
                        ? "bg-emerald-50/60 border-[#10B981] border-b-emerald-600 shadow-sm"
                        : "bg-white border-slate-200 border-b-slate-300 hover:border-slate-300 shadow-2xs"
                    }`}
                  >
                    <div
                      className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${item.iconBg}`}
                    >
                      <span className="text-2xl select-none">{item.emoji}</span>
                    </div>

                    <div className="min-w-0">
                      <span className="text-xs sm:text-sm font-bold font-heading text-slate-900 block leading-tight">
                        {item.name}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[11px] font-bold font-heading border ${
                          isSelected
                            ? "bg-[#10B981] text-white border-[#10B981]"
                            : "bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        <Coins
                          className={`w-3 h-3 ${
                            isSelected ? "text-amber-200" : "text-amber-500"
                          }`}
                          strokeWidth={1.5}
                        />
                        ${item.price.toLocaleString()}
                      </span>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.section>

          {/* 3. LAS 3 CARTAS DE CAMINO ILUSTRADAS (Compact p-4 sm:p-5 so all 3 fit on screen without excessive scrolling) */}
          <AnimatePresence mode="wait">
            {hasSelectedProduct && (
              <motion.section
                key={`decision-options-${parsedItemPrice}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-3"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* CARTA 1: Comprar hoy */}
                  <motion.div
                    onClick={handleDecisionBuyToday}
                    className={`rounded-3xl bg-white border-2 border-b-4 p-4 sm:p-5 shadow-sm flex flex-col justify-between gap-3.5 transition-all hover:-translate-y-1 active:translate-y-0.5 cursor-pointer ${
                      selectedDecision === "bought"
                        ? "border-amber-400 border-b-amber-600 ring-2 ring-amber-400/20"
                        : "border-slate-200 border-b-slate-300 hover:border-amber-300"
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
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

                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold font-heading bg-amber-50 text-amber-900 border border-amber-200 text-right">
                          {financialMetrics.isDeficit
                            ? `Te faltan $${financialMetrics.missingLiquidity.toLocaleString()} de liquidez libre`
                            : `Margen: $${Math.max(
                                0,
                                financialMetrics.netAfterPurchase,
                              ).toLocaleString()}`}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-base sm:text-lg font-bold font-heading text-slate-900">
                          Comprar hoy
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-600 leading-snug mt-1">
                          {financialMetrics.isDeficit
                            ? `Tomaría $${financialMetrics.missingLiquidity.toLocaleString()} MXN de tu renta/pagos fijos y retrasaría tu meta ${financialMetrics.weeksGoalDelayed} semanas.`
                            : `Lo cubres con tu disponible hoy, pero retrasas tu meta "${profile.goal.title}" ${financialMetrics.weeksGoalDelayed} semanas.`}
                        </p>
                      </div>

                      <div className="p-2.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-1">
                        <div className="flex justify-between text-[10px] font-bold font-heading text-amber-900">
                          <span>Impacto en tu quincena</span>
                          <span>
                            {financialMetrics.isDeficit
                              ? "Toma de pagos fijos"
                              : `−${financialMetrics.weeksGoalDelayed} sem de meta`}
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-amber-200/70 overflow-hidden">
                          <div className="h-full w-full bg-amber-500 rounded-full" />
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="w-full h-10 rounded-xl border-2 border-b-4 border-slate-200 border-b-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold font-heading transition-colors cursor-pointer"
                    >
                      Registrar compra hoy
                    </button>
                  </motion.div>

                  {/* CARTA 2 (Destacada Esmeralda): Esperar a tu nómina */}
                  <motion.div
                    onClick={handleDecisionWaitPayroll}
                    className={`rounded-3xl bg-white border-2 border-b-4 p-4 sm:p-5 shadow-sm flex flex-col justify-between gap-3.5 transition-all hover:-translate-y-1 active:translate-y-0.5 cursor-pointer ${
                      selectedDecision === "wait"
                        ? "border-[#10B981] border-b-emerald-700 ring-4 ring-emerald-500/15"
                        : "border-emerald-400 border-b-emerald-600"
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
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

                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold font-heading bg-emerald-50 text-emerald-900 border border-emerald-300">
                          <Sparkles
                            className="w-3 h-3 text-emerald-600"
                            strokeWidth={1.5}
                          />
                          Decisión recomendada · +50 XP
                        </span>
                      </div>

                      <div>
                        <h3 className="text-base sm:text-lg font-bold font-heading text-slate-900">
                          Esperar a tu nómina (en {profile.nextPaydayDays} días)
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-600 leading-snug mt-1">
                          En {profile.nextPaydayDays} días cobras $
                          {profile.nextPaydayAmount.toLocaleString()} MXN y lo
                          compras sin tocar el dinero de tu renta ni pagos
                          fijos.
                        </p>
                      </div>

                      <div className="p-2.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 space-y-1">
                        <div className="flex justify-between text-[10px] font-bold font-heading text-emerald-900">
                          <span>Congelador de compras 🧊</span>
                          <span>
                            Protege ${parsedItemPrice.toLocaleString()}
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-emerald-200/70 overflow-hidden">
                          <div className="h-full w-full bg-[#10B981] rounded-full" />
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="w-full h-10 rounded-xl bg-[#10B981] hover:bg-emerald-600 border-2 border-emerald-600 border-b-4 border-b-emerald-800 text-white text-xs font-bold font-heading shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Snowflake className="w-3.5 h-3.5" strokeWidth={1.5} />
                      <span>
                        Congelar {profile.nextPaydayDays} días (+50 XP)
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </button>
                  </motion.div>

                  {/* CARTA 3: Plan de Micro-ahorro */}
                  <motion.div
                    onClick={handleDecisionMicroSave}
                    className={`rounded-3xl bg-white border-2 border-b-4 p-4 sm:p-5 shadow-sm flex flex-col justify-between gap-3.5 transition-all hover:-translate-y-1 active:translate-y-0.5 cursor-pointer ${
                      selectedDecision === "microsave"
                        ? "border-indigo-400 border-b-indigo-600 ring-2 ring-indigo-400/20"
                        : "border-slate-200 border-b-slate-300 hover:border-indigo-300"
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
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

                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold font-heading bg-indigo-50 text-indigo-900 border border-indigo-200">
                          <Sparkles
                            className="w-3 h-3 text-indigo-600"
                            strokeWidth={1.5}
                          />
                          Sin estrés · +100 XP
                        </span>
                      </div>

                      <div>
                        <h3 className="text-base sm:text-lg font-bold font-heading text-slate-900">
                          Plan de Micro-ahorro
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-600 leading-snug mt-1">
                          Aparta{" "}
                          <strong className="text-slate-900">
                            ${financialMetrics.suggestedWeeklySave}/semana
                          </strong>{" "}
                          y cómpralo en{" "}
                          <strong className="text-slate-900">
                            {financialMetrics.microSaveWeeks} semanas
                          </strong>{" "}
                          sin afectar tu colchón ni tu meta.
                        </p>
                      </div>

                      <div className="p-2.5 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 space-y-1">
                        <div className="flex justify-between text-[10px] font-bold font-heading text-indigo-900">
                          <span>
                            Meta en {financialMetrics.microSaveWeeks} sem
                          </span>
                          <span>
                            ${financialMetrics.suggestedWeeklySave}/sem
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-indigo-200/70 overflow-hidden">
                          <div className="h-full w-4/5 bg-indigo-500 rounded-full" />
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="w-full h-10 rounded-xl border-2 border-b-4 border-indigo-200 border-b-indigo-300 bg-indigo-50/60 hover:bg-indigo-100/80 text-indigo-950 text-xs font-bold font-heading transition-colors cursor-pointer"
                    >
                      Apartar ${financialMetrics.suggestedWeeklySave}/sem (+100
                      XP)
                    </button>
                  </motion.div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* =====================================================================
          VIEW 2: "TU PLANTA" (Dedicated Large Evolutionary Tree, 5 Levels & Goals)
         ===================================================================== */}
      {activeBottomTab === "home" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
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
                const isCurrent = item.level === financialMetrics.currentLevel;
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
          VIEW 3: "RETOS Y METAS" (El Congelador de Compras Impulsivas 🧊 + Dinero Protegido + Medallas)
         ===================================================================== */}
      {activeBottomTab === "goals" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* 1. Large Hero Counter: Dinero Protegido de Compras Impulsivas */}
          <div className="bg-gradient-to-br from-emerald-50 via-white to-sky-50/70 rounded-3xl border-2 border-b-4 border-emerald-300 border-b-emerald-500 shadow-sm p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-heading bg-white text-emerald-800 border border-emerald-200 shadow-2xs">
                <Snowflake
                  className="w-3.5 h-3.5 text-sky-500"
                  strokeWidth={1.5}
                />
                El Congelador de Compras Impulsivas 🧊
              </span>
              <h2 className="text-xl sm:text-2xl font-bold font-heading text-slate-900">
                Dinero Protegido de Compras Impulsivas:
              </h2>
              <p className="text-3xl sm:text-4xl font-bold font-heading text-emerald-600 tracking-tight">
                ${financialMetrics.totalProtectedMoney.toLocaleString()}{" "}
                <span className="text-base font-semibold text-slate-500">
                  MXN
                </span>
              </p>
            </div>

            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => playLevelUp()}
              className="px-5 py-3 rounded-2xl bg-[#10B981] hover:bg-emerald-600 text-white text-xs sm:text-sm font-bold font-heading border-2 border-emerald-600 border-b-4 border-b-emerald-800 shadow-sm cursor-pointer shrink-0"
            >
              Celebrar logro 🎉
            </motion.button>
          </div>

          {/* 2. Compras en Enfriamiento 🧊 (Tarjetas con barra de cuenta regresiva) */}
          <div className="bg-white rounded-3xl border-2 border-b-4 border-slate-200 shadow-sm p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-center">
                  <Snowflake
                    className="w-5 h-5 text-sky-600"
                    strokeWidth={1.5}
                  />
                </div>
                <div>
                  <h3 className="text-lg font-bold font-heading text-slate-900">
                    Compras en Enfriamiento 🧊
                  </h3>
                  <p className="text-xs text-slate-500">
                    Artículos pausados inteligentemente hasta tu próxima nómina
                  </p>
                </div>
              </div>

              <span className="text-xs font-bold font-heading px-3 py-1 rounded-full bg-sky-50 text-sky-900 border border-sky-200">
                {(profile.wishlist || []).length} en espera
              </span>
            </div>

            {profile.wishlist && profile.wishlist.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {profile.wishlist.map((item) => {
                  const daysWait = item.cooldownDays ?? profile.nextPaydayDays;
                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl border-2 border-b-4 border-sky-200 border-b-sky-300 bg-gradient-to-b from-white to-sky-50/40 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-bold font-heading uppercase tracking-wider text-sky-700 block">
                            {item.strategy === "microsave"
                              ? `Plan Micro-ahorro ($${item.plannedWeeklySave ?? 400}/sem)`
                              : "Congelado hasta nómina"}
                          </span>
                          <p className="text-base font-bold font-heading text-slate-900 mt-0.5">
                            {item.name}
                          </p>
                        </div>
                        <span className="text-sm font-bold font-heading text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl shrink-0">
                          ${item.price.toLocaleString()} MXN
                        </span>
                      </div>

                      {/* Countdown Progress Bar */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                          <span className="flex items-center gap-1">
                            <Clock
                              className="w-3.5 h-3.5 text-sky-600"
                              strokeWidth={1.5}
                            />
                            Faltan {daysWait} días para reevaluar con tu nómina
                          </span>
                          <span className="text-[11px] font-bold text-sky-700">
                            En enfriamiento
                          </span>
                        </div>
                        <div className="w-full h-2.5 rounded-full bg-sky-100 overflow-hidden p-0.5 border border-sky-200">
                          <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-sky-400 to-emerald-400" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 rounded-2xl border border-dashed border-slate-300 text-center space-y-2">
                <p className="text-sm font-bold font-heading text-slate-700">
                  Tu congelador está vacío por ahora
                </p>
                <p className="text-xs text-slate-500">
                  Cuando simules una compra y elijas “Esperar a tu nómina” o
                  “Plan de Micro-ahorro”, aparecerá aquí.
                </p>
              </div>
            )}
          </div>

          {/* 3. Progreso de tu Meta Principal + Medallas Desbloqueadas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Active Goal Card */}
            <div className="p-6 rounded-3xl border-2 border-b-4 border-slate-200 bg-white space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                    <Target
                      className="w-4 h-4 text-emerald-600"
                      strokeWidth={1.5}
                    />
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">
                      Meta principal
                    </span>
                    <span className="text-base font-bold font-heading text-slate-900">
                      {profile.goal.title}
                    </span>
                  </div>
                </div>
                <span className="text-lg font-bold font-heading text-emerald-600">
                  {financialMetrics.goalPct}%
                </span>
              </div>

              <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden p-0.5 border border-slate-200">
                <div
                  style={{ width: `${financialMetrics.goalPct}%` }}
                  className="h-full rounded-full bg-[#10B981]"
                />
              </div>

              <div className="flex justify-between text-xs font-semibold text-slate-600">
                <span>
                  Ahorrado: ${profile.goal.currentSaved.toLocaleString()} MXN
                </span>
                <span>
                  Objetivo: ${profile.goal.targetAmount.toLocaleString()} MXN
                </span>
              </div>
            </div>

            {/* Unlocked Medals */}
            <div className="p-6 rounded-3xl border-2 border-b-4 border-slate-200 bg-white space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-base font-bold font-heading text-slate-900">
                  Medallas Desbloqueadas
                </span>
                <Trophy className="w-4 h-4 text-amber-500" strokeWidth={1.5} />
              </div>

              <div className="space-y-2">
                {UNLOCKED_MEDALS.map((medal) => (
                  <div
                    key={medal.id}
                    className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3"
                  >
                    <span className="text-2xl">{medal.emoji}</span>
                    <div>
                      <p className="text-xs font-bold font-heading text-slate-900">
                        {medal.title}
                      </p>
                      <p className="text-[11px] text-slate-500">{medal.desc}</p>
                    </div>
                  </div>
                ))}
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
                  {mode === "demo"
                    ? "Cambiar Perfil de Simulación"
                    : "Mi cuenta"}
                </h2>
                <p className="text-sm text-slate-500">
                  {mode === "demo"
                    ? "Elige un perfil precargado o configura tus datos desde cero"
                    : "Consulta tu perfil financiero autenticado"}
                </p>
              </div>
            </div>

            {mode === "demo" ? (
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
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm space-y-2">
                <p>
                  <strong>Cuenta:</strong> {profile.email}
                </p>
                <p>
                  <strong>Perfil:</strong> {profile.roleTag}
                </p>
                <p>
                  Tu información se obtiene de Supabase. No puedes sustituirla
                  por usuarios demo.
                </p>
              </div>
            )}

            {mode === "demo" && (
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  playTap();
                  router.push("/onboarding?demo=1");
                }}
                className="w-full h-12 rounded-2xl border-2 border-b-4 border-slate-200 border-b-slate-300 bg-slate-50 hover:bg-slate-100 text-sm font-bold font-heading text-slate-800 flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <SlidersHorizontal className="w-4 h-4" strokeWidth={1.5} />
                <span>Personalizar perfil desde cero (Onboarding)</span>
              </motion.button>
            )}

            {mode === "authenticated" && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await signOut();
                    router.replace("/auth");
                  } catch (error) {
                    console.error("Logout failed:", error);
                  }
                }}
                className="w-full h-12 rounded-xl border border-slate-300 bg-white text-slate-800 font-semibold"
              >
                Cerrar sesión
              </button>
            )}
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
            className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-40 rounded-2xl bg-slate-900 text-white px-5 py-3 shadow-xl border border-slate-700 flex items-center gap-2.5 text-xs sm:text-sm font-bold font-heading max-w-lg w-[92%]"
          >
            <CheckCircle2
              className="w-4 h-4 text-[#10B981] shrink-0"
              strokeWidth={1.5}
            />
            <span className="leading-snug">{toastFeedback.message}</span>
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
