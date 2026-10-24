"use client";

import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Sprout,
  TreePine,
  AlertTriangle,
  Zap,
  Award,
  Flame,
  Heart,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useFinancial } from "@/context/FinancialContext";
import { playTap, playLevelUp } from "@/lib/soundEffects";

export type PlantLevel = 1 | 2 | 3 | 4 | 5;

export type PlantSimulationState = "normal" | "danger" | "recovered";

interface FinancialPlantWidgetProps {
  /**
   * "normal": default state based on user's financial level
   * "danger": user is previewing "Comprar hoy" with liquidity deficit (plant wilts, coral alert, sweat drops & falling leaves)
   * "recovered": user selected "Esperar a nómina" or "Micro-ahorro" (plant recovers immediately, glows, shows "+XP de Sabiduría Financiera")
   */
  simulationState?: PlantSimulationState;
  compact?: boolean;
  allowLevelPreview?: boolean;
  previewDamagePrice?: number;
  recoveredXpBonus?: number;
}

interface LevelMetadata {
  level: PlantLevel;
  name: string;
  subtitle: string;
  nextMilestoneHint: string;
  accentColor: string;
  badgeClasses: string;
  xpRange: [number, number];
}

const LEVELS_CONFIG: Record<PlantLevel, LevelMetadata> = {
  1: {
    level: 1,
    name: "Supervivencia",
    subtitle: "Semilla firme · Tu primer margen está creciendo 🌱",
    nextMilestoneHint:
      "Mantén saldo libre positivo para subir a Nivel 2: Estabilidad",
    accentColor: "#D97706",
    badgeClasses: "bg-amber-100/90 text-amber-900 border-amber-300",
    xpRange: [0, 100],
  },
  2: {
    level: 2,
    name: "Estabilidad",
    subtitle: "Brote joven · Tus pagos de la semana están cubiertos 🌿",
    nextMilestoneHint:
      "Protege tu colchón 1 quincena más para subir a Nivel 3: Seguridad",
    accentColor: "#10B981",
    badgeClasses: "bg-emerald-100/90 text-emerald-900 border-emerald-300",
    xpRange: [100, 250],
  },
  3: {
    level: 3,
    name: "Seguridad",
    subtitle: "Planta frondosa · Tu reserva de paz está activa ✨",
    nextMilestoneHint:
      "Llega al 60% de tu meta para subir a Nivel 4: Libertad",
    accentColor: "#059669",
    badgeClasses: "bg-teal-100/90 text-teal-900 border-teal-300",
    xpRange: [250, 450],
  },
  4: {
    level: 4,
    name: "Libertad",
    subtitle: "Árbol en flor · Decides tus compras con calma 🌸",
    nextMilestoneHint:
      "Alcanza el 85% de tu meta para subir a Nivel 5: Abundancia",
    accentColor: "#0D9488",
    badgeClasses: "bg-pink-100/90 text-pink-900 border-pink-300",
    xpRange: [450, 700],
  },
  5: {
    level: 5,
    name: "Abundancia",
    subtitle: "Árbol dorado · Dominio financiero total 🏆",
    nextMilestoneHint:
      "¡Nivel máximo! Cada buena decisión suma XP a tu bosque",
    accentColor: "#F59E0B",
    badgeClasses: "bg-amber-100 text-amber-950 border-amber-400",
    xpRange: [700, 1000],
  },
};

export default function FinancialPlantWidget({
  simulationState = "normal",
  compact = false,
  allowLevelPreview = true,
  previewDamagePrice = 0,
  recoveredXpBonus = 50,
}: FinancialPlantWidgetProps) {
  const { profile } = useFinancial();
  const [previewLevelOverride, setPreviewLevelOverride] =
    useState<PlantLevel | null>(null);

  // Calculate user's financial level & HP bar dynamically from liquidity & goal progress
  const computedMetrics = useMemo(() => {
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

    const maxQuincenaHp = Math.max(5000, profile.currentBalance || 5000);
    const activeDamage =
      simulationState === "recovered" ? 0 : Math.max(0, previewDamagePrice);
    const netHpAfterPurchase = safeToSpend - activeDamage;
    const isCriticalHit = activeDamage > 0 && netHpAfterPurchase < 0;
    const missingAmount = isCriticalHit ? Math.abs(netHpAfterPurchase) : 0;

    const baseHpPct = Math.min(
      100,
      Math.max(8, Math.round((safeToSpend / maxQuincenaHp) * 100))
    );
    const remainingHpPct = Math.min(
      100,
      Math.max(0, Math.round((Math.max(0, netHpAfterPurchase) / maxQuincenaHp) * 100))
    );
    const damageFlashPct = Math.max(0, baseHpPct - remainingHpPct);

    const goalRatio =
      profile.goal.targetAmount > 0
        ? profile.goal.currentSaved / profile.goal.targetAmount
        : 0;

    const baseXp = profile.wisdomXp || 120;

    let derivedLevel: PlantLevel = 2;
    if (safeToSpend <= 0) {
      derivedLevel = 1;
    } else if (safeToSpend < profile.safetyBuffer * 1.4 && goalRatio < 0.45) {
      derivedLevel = 2;
    } else if (goalRatio < 0.68 && baseXp < 400) {
      derivedLevel = 3;
    } else if (goalRatio < 0.88 && baseXp < 650) {
      derivedLevel = 4;
    } else {
      derivedLevel = 5;
    }

    // Evolve visual level +1 when recovered / Power-Up is chosen!
    const boostedLevel =
      simulationState === "recovered"
        ? (Math.min(5, derivedLevel + 1) as PlantLevel)
        : derivedLevel;

    const activeLevel = previewLevelOverride ?? boostedLevel;
    const config = LEVELS_CONFIG[activeLevel];

    // Calculate XP progress bar inside current level
    const [minXp, maxXp] = config.xpRange;
    const effectiveXp = previewLevelOverride
      ? Math.round((minXp + maxXp) * 0.65)
      : Math.max(minXp + 20, baseXp);
    const bonusXp = simulationState === "recovered" ? recoveredXpBonus : 0;
    const totalXp = effectiveXp + bonusXp;
    const progressPct = Math.min(
      100,
      Math.max(12, Math.round(((totalXp - minXp) / (maxXp - minXp)) * 100))
    );

    return {
      activeLevel,
      config,
      totalXp,
      maxXp,
      progressPct,
      safeToSpend,
      maxQuincenaHp,
      activeDamage,
      netHpAfterPurchase,
      isCriticalHit,
      missingAmount,
      baseHpPct,
      remainingHpPct,
      damageFlashPct,
    };
  }, [
    profile,
    previewLevelOverride,
    simulationState,
    previewDamagePrice,
    recoveredXpBonus,
  ]);

  const {
    activeLevel,
    config,
    totalXp,
    maxXp,
    progressPct,
    safeToSpend,
    maxQuincenaHp,
    activeDamage,
    isCriticalHit,
    missingAmount,
    remainingHpPct,
    damageFlashPct,
  } = computedMetrics;

  const isDanger = simulationState === "danger" || isCriticalHit;
  const isRecovered = simulationState === "recovered";

  return (
    <div
      className={`relative rounded-3xl border-2 border-b-4 transition-all duration-300 overflow-hidden ${
        isDanger
          ? "bg-gradient-to-b from-rose-50/95 via-[#FAF8F5] to-rose-100/50 border-rose-300 border-b-rose-500 shadow-md"
          : isRecovered
          ? "bg-gradient-to-b from-emerald-50/95 via-[#FAF8F5] to-amber-50/50 border-emerald-300 border-b-emerald-500 shadow-md"
          : "bg-gradient-to-b from-[#F4F1EA] via-[#FAF8F5] to-white border-[#E2DCD3] border-b-[#CFC7BC] shadow-xs"
      } ${compact ? "p-4 sm:p-5" : "p-5 sm:p-6"}`}
    >
      {/* 1. Floating Island Header: Level Badge (Supervivencia -> Abundancia) + Streak 🔥 + XP */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className={`px-2.5 py-1 text-xs font-bold font-heading border ${
                isDanger
                  ? "bg-rose-100 text-rose-900 border-rose-300"
                  : config.badgeClasses
              }`}
            >
              <Sprout className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>
                Nivel {activeLevel}: {config.name}
              </span>
            </Badge>

            {/* Streak Flame Pill 🔥 */}
            <div className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white px-2.5 py-0.5 text-xs font-bold font-heading shadow-2xs">
              <Flame
                className="w-3.5 h-3.5 fill-white text-white"
                strokeWidth={1.5}
              />
              <span>{profile.streakCount ?? 3} días 🔥</span>
            </div>
          </div>

          {/* XP Counter */}
          <div className="flex items-center gap-1.5 text-xs font-bold font-heading text-slate-800 bg-white/95 border border-[#E6E1DA] px-2.5 py-1 rounded-xl shadow-2xs">
            <Zap
              className={`w-3.5 h-3.5 ${
                isRecovered ? "text-amber-500" : "text-emerald-600"
              }`}
              strokeWidth={1.5}
            />
            <span>
              {totalXp} / {maxXp} XP
            </span>
          </div>
        </div>

        {/* 2. BARRA DE VIDA VERDE (HP DE TU QUINCENA) */}
        <div
          className={`p-3 rounded-2xl border-2 transition-colors ${
            isDanger
              ? "bg-rose-50/90 border-rose-300"
              : "bg-white/95 border-emerald-200/90"
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-1.5">
              <Heart
                className={`w-4 h-4 ${
                  isDanger
                    ? "text-rose-600 fill-rose-500 animate-pulse"
                    : "text-emerald-600 fill-emerald-500"
                }`}
                strokeWidth={1.5}
              />
              <span className="text-xs sm:text-sm font-bold font-heading text-slate-900">
                HP: ${safeToSpend.toLocaleString()} / $
                {maxQuincenaHp.toLocaleString()} MXN
              </span>
            </div>

            {/* Real-Time Damage Hit Indicator (-2,300 HP) */}
            {activeDamage > 0 && !isRecovered ? (
              <motion.span
                key={activeDamage}
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{
                  scale: [1, 1.08, 1],
                  opacity: [1, 0.7, 1],
                }}
                transition={{ duration: 0.9, repeat: Infinity }}
                className={`text-xs font-bold font-heading px-2 py-0.5 rounded-lg border ${
                  isDanger
                    ? "bg-rose-600 text-white border-rose-700"
                    : "bg-amber-100 text-amber-900 border-amber-300"
                }`}
              >
                −{activeDamage.toLocaleString()} HP
              </motion.span>
            ) : (
              <span className="text-[11px] font-bold font-heading text-emerald-700">
                Barra de Vida Libre
              </span>
            )}
          </div>

          {/* Animated Green/Coral HP Bar with Flashing Damage Segment */}
          <div className="relative w-full h-4 rounded-full bg-slate-200/80 overflow-hidden p-0.5 border border-slate-300/60">
            <div className="relative w-full h-full rounded-full overflow-hidden flex">
              {/* Remaining Safe HP Segment */}
              <motion.div
                initial={false}
                animate={{
                  width: `${ isDanger && remainingHpPct === 0 ? 100 : remainingHpPct }%`,
                }}
                transition={{ type: "spring", stiffness: 260, damping: 24 }}
                className={`h-full transition-colors ${
                  isDanger
                    ? "bg-gradient-to-r from-rose-600 via-red-500 to-orange-500"
                    : "bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400"
                }`}
              />

              {/* Flashing Damage Segment when previewing a purchase */}
              {activeDamage > 0 && !isRecovered && damageFlashPct > 0 && (
                <motion.div
                  animate={{ opacity: [0.95, 0.25, 0.95] }}
                  transition={{ duration: 0.65, repeat: Infinity }}
                  style={{ width: `${damageFlashPct}%` }}
                  className="h-full bg-rose-500"
                />
              )}
            </div>
          </div>
        </div>

        {/* XP Animated Progress Bar */}
        <div className="space-y-1">
          <div className="w-full h-2 rounded-full bg-[#E6E1DA]/90 overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${
                isDanger
                  ? "bg-rose-400"
                  : isRecovered
                  ? "bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400"
                  : "bg-gradient-to-r from-emerald-600 to-teal-500"
              }`}
              initial={{ width: "20%" }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
          {!compact && (
            <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 truncate">
              <Award
                className="w-3 h-3 text-emerald-700 shrink-0"
                strokeWidth={1.5}
              />
              <span className="truncate">{config.nextMilestoneHint}</span>
            </p>
          )}
        </div>
      </div>

      {/* 3. Dynamic Gamified Plant/Tree SVG Stage (Floating Island) */}
      <div
        className={`relative flex flex-col items-center justify-center ${
          compact ? "my-2 py-2" : "my-3 py-2"
        }`}
      >
        {/* Floating "+XP de Sabiduría Financiera" Badge when user chooses Green or Gold Card */}
        <AnimatePresence>
          {isRecovered && (
            <motion.div
              key={`xp-wisdom-badge-${recoveredXpBonus}`}
              initial={{ opacity: 0, y: 16, scale: 0.85 }}
              animate={{ opacity: 1, y: -4, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.9 }}
              transition={{
                type: "spring",
                stiffness: 340,
                damping: 22,
              }}
              className="absolute top-0 z-20 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-300 text-slate-950 font-bold font-heading text-xs px-3.5 py-1.5 shadow-md border-2 border-white"
            >
              <Sparkles className="w-3.5 h-3.5 text-slate-900" strokeWidth={1.5} />
              <span>+{recoveredXpBonus} XP de Sabiduría Financiera</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Short Critical Hit Banner when HP drops below 0 */}
        <AnimatePresence>
          {isDanger && (
            <motion.div
              key="danger-wilting-badge"
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute top-0 z-20 inline-flex items-center gap-1.5 rounded-2xl bg-rose-600 text-white font-bold font-heading text-xs px-3.5 py-1.5 shadow-md border-2 border-white text-center"
            >
              <AlertTriangle className="w-4 h-4 shrink-0" strokeWidth={1.5} />
              <span>
                ¡Golpe crítico a tu quincena! Te faltan $
                {(missingAmount > 0 ? missingAmount : 1500).toLocaleString()}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* SVG Illustration Canvas */}
        <div
          className={`relative flex items-center justify-center ${
            compact ? "w-44 h-40" : "w-56 h-48"
          }`}
        >
          {/* Radiant Background Aura for Level 5 or Recovered State */}
          {(activeLevel === 5 || isRecovered) && !isDanger && (
            <motion.div
              animate={{
                scale: [1, 1.12, 1],
                opacity: [0.45, 0.75, 0.45],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="absolute w-36 h-36 rounded-full bg-gradient-to-tr from-amber-300/45 via-emerald-300/40 to-teal-200/30 blur-xl pointer-events-none"
            />
          )}

          {/* Coral Danger Pulse Aura */}
          {isDanger && (
            <motion.div
              animate={{
                scale: [1, 1.08, 1],
                opacity: [0.35, 0.6, 0.35],
              }}
              transition={{ duration: 1.4, repeat: Infinity }}
              className="absolute w-36 h-36 rounded-full bg-rose-400/30 blur-xl pointer-events-none"
            />
          )}

          <svg
            viewBox="0 0 220 200"
            className="w-full h-full overflow-visible"
            aria-label={`Planta financiera nivel ${activeLevel}`}
          >
            <defs>
              <linearGradient id="potGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#D97757" />
                <stop offset="100%" stopColor="#B85A3A" />
              </linearGradient>
              <linearGradient id="soilGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#78350F" />
                <stop offset="100%" stopColor="#92400E" />
              </linearGradient>
              <linearGradient id="leafHealthy" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#34D399" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>
              <linearGradient id="leafWilted" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#F87171" />
                <stop offset="100%" stopColor="#D97706" />
              </linearGradient>
              <linearGradient id="goldFruit" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#FDE047" />
                <stop offset="100%" stopColor="#F59E0B" />
              </linearGradient>
            </defs>

            {/* Ground Soft Shadow */}
            <ellipse
              cx="110"
              cy="184"
              rx="52"
              ry="8"
              fill={isDanger ? "#FECDD3" : "#E2DCD3"}
            />

            {/* Terracotta Pot / Earth Base */}
            <path
              d="M74 142 L146 142 L136 180 C135 183 132 185 128 185 L92 185 C88 185 85 183 84 180 Z"
              fill="url(#potGrad)"
            />
            <rect
              x="68"
              y="134"
              width="84"
              height="11"
              rx="5"
              fill="#C86849"
            />
            {/* Warm Soil Mound */}
            <ellipse cx="110" cy="135" rx="36" ry="6" fill="url(#soilGrad)" />

            {/* Animated Plant Group (Tilts/Wilts when isDanger, Bounces/Glows when isRecovered) */}
            <motion.g
              style={{ originX: "110px", originY: "135px" }}
              animate={
                isDanger
                  ? {
                      rotate: [0, 14, 11, 15, 12],
                      y: [0, 4, 3, 4],
                      scaleY: 0.92,
                    }
                  : isRecovered
                  ? {
                      rotate: [0, -4, 4, -2, 0],
                      scale: [1, 1.08, 1.03, 1.05],
                      y: [0, -3, 0],
                    }
                  : {
                      rotate: [-1.5, 1.5, -1.5],
                      scale: 1,
                      y: 0,
                    }
              }
              transition={
                isDanger
                  ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
                  : isRecovered
                  ? { duration: 1.2, ease: "easeOut" }
                  : { duration: 4, repeat: Infinity, ease: "easeInOut" }
              }
            >
              {/* LEVEL 1: Supervivencia (Small Seed & Tiny Amber/Earth Bud) */}
              {activeLevel === 1 && (
                <g>
                  <ellipse
                    cx="110"
                    cy="128"
                    rx="11"
                    ry="8"
                    fill="#D97706"
                    stroke="#92400E"
                    strokeWidth="2"
                  />
                  <path
                    d="M110 122 Q112 110 118 106"
                    stroke={isDanger ? "#F87171" : "#84CC16"}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <ellipse
                    cx="121"
                    cy="105"
                    rx="7"
                    ry="4.5"
                    transform="rotate(-20 121 105)"
                    fill={isDanger ? "url(#leafWilted)" : "#A3E635"}
                  />
                </g>
              )}

              {/* LEVEL 2: Estabilidad (Young Sprout with 2 Green Leaves) */}
              {activeLevel === 2 && (
                <g>
                  <path
                    d="M110 135 Q110 105 110 86"
                    stroke={isDanger ? "#D97706" : "#10B981"}
                    strokeWidth="5"
                    strokeLinecap="round"
                    fill="none"
                  />
                  {/* Left Leaf */}
                  <path
                    d="M110 106 C92 102 80 88 92 78 C102 72 110 92 110 106 Z"
                    fill={isDanger ? "url(#leafWilted)" : "url(#leafHealthy)"}
                  />
                  {/* Right Leaf */}
                  <path
                    d="M110 94 C128 90 140 76 128 66 C118 60 110 80 110 94 Z"
                    fill={isDanger ? "url(#leafWilted)" : "#34D399"}
                  />
                </g>
              )}

              {/* LEVEL 3: Seguridad (Lush Leafy Plant with Floating Particles) */}
              {activeLevel === 3 && (
                <g>
                  <path
                    d="M110 135 Q108 98 110 64"
                    stroke={isDanger ? "#B45309" : "#047857"}
                    strokeWidth="6"
                    strokeLinecap="round"
                    fill="none"
                  />
                  {/* Lower Leaves */}
                  <path
                    d="M109 112 C84 110 70 92 84 80 C96 72 108 96 109 112 Z"
                    fill={isDanger ? "url(#leafWilted)" : "#059669"}
                  />
                  <path
                    d="M111 110 C136 108 150 90 136 78 C124 70 112 94 111 110 Z"
                    fill={isDanger ? "url(#leafWilted)" : "#10B981"}
                  />
                  {/* Middle Leaves */}
                  <path
                    d="M109 88 C82 82 74 62 90 54 C104 48 110 72 109 88 Z"
                    fill={isDanger ? "url(#leafWilted)" : "url(#leafHealthy)"}
                  />
                  <path
                    d="M111 86 C138 80 146 60 130 52 C116 46 110 70 111 86 Z"
                    fill={isDanger ? "url(#leafWilted)" : "#34D399"}
                  />
                  {/* Crown Leaf */}
                  <path
                    d="M110 68 C98 48 110 32 110 32 C110 32 122 48 110 68 Z"
                    fill={isDanger ? "url(#leafWilted)" : "#6EE7B7"}
                  />
                </g>
              )}

              {/* LEVEL 4: Libertad (Young Tree with Vibrant Flowers) */}
              {activeLevel === 4 && (
                <g>
                  {/* Tree Trunk & Branches */}
                  <path
                    d="M104 136 L107 78 L113 78 L116 136 Z"
                    fill="#78350F"
                  />
                  <path
                    d="M109 98 L88 78 M111 94 L132 76"
                    stroke="#78350F"
                    strokeWidth="4.5"
                    strokeLinecap="round"
                  />
                  {/* Canopy */}
                  <circle
                    cx="86"
                    cy="70"
                    r="24"
                    fill={isDanger ? "url(#leafWilted)" : "#059669"}
                  />
                  <circle
                    cx="134"
                    cy="70"
                    r="24"
                    fill={isDanger ? "url(#leafWilted)" : "#10B981"}
                  />
                  <circle
                    cx="110"
                    cy="52"
                    r="29"
                    fill={isDanger ? "url(#leafWilted)" : "url(#leafHealthy)"}
                  />
                  {/* Vibrant Blossoms */}
                  {!isDanger && (
                    <>
                      <circle cx="94" cy="48" r="5.5" fill="#F472B6" />
                      <circle cx="94" cy="48" r="2.2" fill="#FEF08A" />
                      <circle cx="126" cy="54" r="5.5" fill="#FB7185" />
                      <circle cx="126" cy="54" r="2.2" fill="#FEF08A" />
                      <circle cx="76" cy="72" r="5" fill="#F472B6" />
                      <circle cx="76" cy="72" r="2" fill="#FEF08A" />
                      <circle cx="140" cy="72" r="5" fill="#FB7185" />
                      <circle cx="140" cy="72" r="2" fill="#FEF08A" />
                    </>
                  )}
                </g>
              )}

              {/* LEVEL 5: Abundancia (Radiant Tree with Golden Fruits & Luminous Aura) */}
              {activeLevel === 5 && (
                <g>
                  {/* Strong Trunk */}
                  <path
                    d="M101 136 L105 72 L115 72 L119 136 Z"
                    fill="#78350F"
                  />
                  <path
                    d="M108 98 L82 74 M112 94 L138 72"
                    stroke="#78350F"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                  {/* Lush Multi-layered Canopy */}
                  <circle
                    cx="80"
                    cy="68"
                    r="26"
                    fill={isDanger ? "url(#leafWilted)" : "#047857"}
                  />
                  <circle
                    cx="140"
                    cy="68"
                    r="26"
                    fill={isDanger ? "url(#leafWilted)" : "#059669"}
                  />
                  <circle
                    cx="96"
                    cy="46"
                    r="26"
                    fill={isDanger ? "url(#leafWilted)" : "#10B981"}
                  />
                  <circle
                    cx="124"
                    cy="46"
                    r="26"
                    fill={isDanger ? "url(#leafWilted)" : "#10B981"}
                  />
                  <circle
                    cx="110"
                    cy="38"
                    r="25"
                    fill={isDanger ? "url(#leafWilted)" : "#34D399"}
                  />
                  {/* Golden Fruits */}
                  <circle
                    cx="88"
                    cy="56"
                    r="6.5"
                    fill="url(#goldFruit)"
                    stroke="#B45309"
                    strokeWidth="1"
                  />
                  <circle
                    cx="132"
                    cy="58"
                    r="6.5"
                    fill="url(#goldFruit)"
                    stroke="#B45309"
                    strokeWidth="1"
                  />
                  <circle
                    cx="110"
                    cy="34"
                    r="7"
                    fill="url(#goldFruit)"
                    stroke="#B45309"
                    strokeWidth="1"
                  />
                  <circle
                    cx="72"
                    cy="76"
                    r="5.5"
                    fill="url(#goldFruit)"
                    stroke="#B45309"
                    strokeWidth="1"
                  />
                  <circle
                    cx="146"
                    cy="76"
                    r="5.5"
                    fill="url(#goldFruit)"
                    stroke="#B45309"
                    strokeWidth="1"
                  />
                </g>
              )}
            </motion.g>

            {/* Floating Magical Particles for Level >= 3 or Recovered State */}
            {(activeLevel >= 3 || isRecovered) && !isDanger && (
              <g>
                {[
                  { cx: 56, cy: 62, r: 3, delay: 0 },
                  { cx: 164, cy: 54, r: 3.5, delay: 0.6 },
                  { cx: 68, cy: 32, r: 2.5, delay: 1.1 },
                  { cx: 152, cy: 30, r: 3, delay: 1.6 },
                ].map((p, idx) => (
                  <motion.circle
                    key={idx}
                    cx={p.cx}
                    cy={p.cy}
                    r={p.r}
                    fill={activeLevel === 5 || isRecovered ? "#FBBF24" : "#34D399"}
                    animate={{
                      y: [0, -10, 0],
                      opacity: [0.3, 1, 0.3],
                    }}
                    transition={{
                      duration: 2.4,
                      delay: p.delay,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                ))}
              </g>
            )}

            {/* Danger Effects: Sweat Drops & Falling Leaves when "Comprar hoy" causes deficit */}
            {isDanger && (
              <g>
                {/* Animated Sweat Drops */}
                <motion.path
                  d="M62 56 C62 56 56 66 56 70 C56 73.5 58.7 76 62 76 C65.3 76 68 73.5 68 70 C68 66 62 56 62 56 Z"
                  fill="#38BDF8"
                  animate={{ y: [0, 18, 26], opacity: [0, 1, 0] }}
                  transition={{ duration: 1.3, repeat: Infinity }}
                />
                <motion.path
                  d="M162 48 C162 48 157 56 157 60 C157 63 159.2 65 162 65 C164.8 65 167 63 167 60 C167 56 162 48 162 48 Z"
                  fill="#38BDF8"
                  animate={{ y: [0, 18, 26], opacity: [0, 1, 0] }}
                  transition={{ duration: 1.3, delay: 0.45, repeat: Infinity }}
                />

                {/* Falling Wilted Leaves */}
                <motion.ellipse
                  cx="78"
                  cy="96"
                  rx="7"
                  ry="4"
                  fill="#F87171"
                  animate={{
                    y: [0, 38],
                    x: [0, -12, 6],
                    rotate: [0, 45, 90],
                    opacity: [1, 0.8, 0],
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <motion.ellipse
                  cx="144"
                  cy="92"
                  rx="7"
                  ry="4"
                  fill="#FB923C"
                  animate={{
                    y: [0, 42],
                    x: [0, 10, -6],
                    rotate: [0, -50, -95],
                    opacity: [1, 0.8, 0],
                  }}
                  transition={{ duration: 2.2, delay: 0.7, repeat: Infinity }}
                />
              </g>
            )}
          </svg>
        </div>

        {/* Subtitle Status Line */}
        <p
          className={`text-xs font-bold font-heading text-center max-w-md ${
            isDanger
              ? "text-rose-800"
              : isRecovered
              ? "text-emerald-900"
              : "text-slate-600"
          }`}
        >
          {isDanger
            ? "Usa una Carta de Poder abajo para salvar tu planta 👇"
            : isRecovered
            ? `¡Power-Up activado! Tu planta evoluciona y gana +${recoveredXpBonus} XP ✨`
            : config.subtitle}
        </p>
      </div>

      {/* 3. Interactive 5-Level Selector Strip (For exploring all 5 evolution stages) */}
      {allowLevelPreview && (
        <div className="pt-3 border-t border-[#E6E1DA]/80 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] text-slate-500 flex items-center gap-1">
            <TreePine className="w-3.5 h-3.5 text-emerald-700" strokeWidth={1.5} />
            <span>Explorar evolución (5 niveles):</span>
          </span>

          <div className="flex items-center gap-1">
            {([1, 2, 3, 4, 5] as PlantLevel[]).map((lvl) => {
              const isSelected = activeLevel === lvl;
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => {
                    if (lvl > activeLevel) {
                      playLevelUp();
                    } else {
                      playTap();
                    }
                    setPreviewLevelOverride(
                      previewLevelOverride === lvl ? null : lvl
                    );
                  }}
                  className={`h-6 px-2 rounded-lg text-[11px] font-bold font-heading transition-all cursor-pointer ${
                    isSelected
                      ? "bg-slate-900 text-[#FAF8F5] shadow-2xs"
                      : "bg-white/80 text-slate-600 hover:bg-white border border-[#E6E1DA]"
                  }`}
                  title={`Ver Nivel ${lvl}: ${LEVELS_CONFIG[lvl].name}`}
                >
                  N{lvl}
                </button>
              );
            })}
            {previewLevelOverride && (
              <button
                type="button"
                onClick={() => {
                  playTap();
                  setPreviewLevelOverride(null);
                }}
                className="text-[10px] text-slate-400 hover:text-slate-700 ml-1 underline cursor-pointer"
              >
                Auto
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

