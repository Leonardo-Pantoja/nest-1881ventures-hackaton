"use client";

import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Sprout,
  TreePine,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useFinancialEvaluation } from "@/hooks/useFinancialEvaluation";
import { useFinancial } from "@/context/FinancialContext";
import { playTap, playLevelUp } from "@/lib/soundEffects";
import type { EvaluateApiResponse } from "@/app/api/evaluate/route";

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
  financialEvaluation?: EvaluateApiResponse | null;
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
  financialEvaluation: providedEvaluation,
}: FinancialPlantWidgetProps) {
  const { profile } = useFinancial();
  const summary = useFinancialEvaluation("Resumen financiero", providedEvaluation === undefined ? null : -1);
  const financialEvaluation = providedEvaluation === undefined ? summary.response : providedEvaluation;
  const [previewLevelOverride, setPreviewLevelOverride] =
    useState<PlantLevel | null>(null);

  // Calculate user's financial level & 3-segment liquidity breakdown via deterministic engine
  const computedMetrics = useMemo(() => {
    const hasAuthoritativeEvaluation = true;
    const evaluationComplete =
      financialEvaluation !== null &&
      financialEvaluation !== undefined &&
      financialEvaluation.status !== "datos_incompletos" &&
      financialEvaluation.status !== "error_procesamiento" &&
      financialEvaluation.safeToSpend !== null &&
      financialEvaluation.remainingAfterBuyToday !== null;
    const consideredExpenses = evaluationComplete
      ? financialEvaluation.consideredExpenses
      : null;
    const safeToSpend = evaluationComplete ? financialEvaluation.safeToSpend : null;
    const totalBalance = consideredExpenses?.currentBalance ?? null;
    const evaluatedFixedAndRentTotal =
      consideredExpenses?.essentialExpenses !== null &&
      consideredExpenses?.essentialExpenses !== undefined &&
      consideredExpenses.pendingCommitments !== null &&
      consideredExpenses.pendingDebtPayments !== null
        ? consideredExpenses.essentialExpenses +
          consideredExpenses.pendingCommitments +
          consideredExpenses.pendingDebtPayments
        : null;
    const displayedFixedAndRentTotal = evaluatedFixedAndRentTotal;
    const displayedSafetyBuffer = consideredExpenses?.safetyBuffer ?? null;
    const displayedReserves = displayedSafetyBuffer !== null && consideredExpenses?.protectedSavings != null
      ? displayedSafetyBuffer + consideredExpenses.protectedSavings : null;

    const activeDamage =
      simulationState === "recovered" ? 0 : Math.max(0, previewDamagePrice);
    const isCriticalHit = financialEvaluation?.status === "excede_el_margen";
    const missingAmount = financialEvaluation?.exceedsBy ?? null;

    // 3-Segment Horizontal Bar Percentages (Fixed & Rent | Safety Buffer | Free Today)
    const fixedPct =
      totalBalance !== null &&
      totalBalance > 0 &&
      displayedFixedAndRentTotal !== null
        ? Math.min(
            100,
            Math.max(
              0,
              Math.round((displayedFixedAndRentTotal / totalBalance) * 100),
            ),
          )
        : 0;
    const bufferPct =
      totalBalance !== null &&
      totalBalance > 0 &&
      displayedReserves !== null
        ? Math.min(
            100 - fixedPct,
            Math.max(
              0,
              Math.round((displayedReserves / totalBalance) * 100),
            ),
          )
        : 0;
    const freePct =
      totalBalance !== null && totalBalance > 0 && safeToSpend !== null
        ? Math.min(
            100 - fixedPct - bufferPct,
            Math.max(0, Math.round((safeToSpend / totalBalance) * 100)),
          )
        : 0;

    const goalRatio =
      profile.goal.targetAmount > 0
        ? profile.goal.currentSaved / profile.goal.targetAmount
        : 0;

    const baseXp = profile.wisdomXp ?? 0;

    let derivedLevel: PlantLevel = 2;
    if (safeToSpend !== null && safeToSpend <= 0) {
      derivedLevel = 1;
    } else if (
      safeToSpend !== null &&
      displayedSafetyBuffer !== null &&
      safeToSpend < displayedSafetyBuffer * 1.4 &&
      goalRatio < 0.45
    ) {
      derivedLevel = 2;
    } else if (goalRatio < 0.68 && baseXp < 400) {
      derivedLevel = 3;
    } else if (goalRatio < 0.88 && baseXp < 650) {
      derivedLevel = 4;
    } else {
      derivedLevel = 5;
    }

    const boostedLevel =
      simulationState === "recovered"
        ? (Math.min(5, derivedLevel + 1) as PlantLevel)
        : derivedLevel;

    const activeLevel = previewLevelOverride ?? boostedLevel;
    const config = LEVELS_CONFIG[activeLevel];

    const [minXp, maxXp] = config.xpRange;
    const effectiveXp = previewLevelOverride
      ? Math.round((minXp + maxXp) * 0.65)
      : baseXp;
    const bonusXp = simulationState === "recovered" ? recoveredXpBonus : 0;
    const totalXp = effectiveXp + bonusXp;
    const progressPct = Math.min(
      100,
      Math.max(12, Math.round(((totalXp - minXp) / (maxXp - minXp)) * 100))
    );

    return {
      activeLevel,
      config,
      progressPct,
      hasAuthoritativeEvaluation,
      evaluationComplete,
      safeToSpend,
      totalBalance,
      fixedAndRentTotal: displayedFixedAndRentTotal,
      safetyBuffer: displayedReserves,
      activeDamage,
      isCriticalHit,
      missingAmount,
      fixedPct,
      bufferPct,
      freePct,
    };
  }, [
    profile,
    previewLevelOverride,
    simulationState,
    previewDamagePrice,
    recoveredXpBonus,
    financialEvaluation,
  ]);

  const {
    activeLevel,
    config,
    progressPct,
    hasAuthoritativeEvaluation,
    evaluationComplete,
    safeToSpend,
    totalBalance,
    fixedAndRentTotal,
    safetyBuffer,
    activeDamage,
    isCriticalHit,
    missingAmount,
    fixedPct,
    bufferPct,
    freePct,
  } = computedMetrics;

  const isDanger =
    (simulationState === "danger" || isCriticalHit) &&
    missingAmount !== null &&
    missingAmount > 0;
  const isRecovered = simulationState === "recovered";

  return (
    <div
      className={`relative rounded-3xl border transition-all duration-300 overflow-hidden bg-white shadow-sm ${
        isDanger
          ? "border-amber-300"
          : isRecovered
          ? "border-emerald-300"
          : "border-slate-200"
      } ${compact ? "p-5" : "p-6 sm:p-8"}`}
    >
      {/* 1. Header: Level Badge (Supervivencia -> Abundancia) + XP Progress */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge
            variant="outline"
            className="px-3 py-1 text-xs font-bold font-heading border border-emerald-200 bg-emerald-50 text-emerald-900"
          >
            <Sprout className="w-3.5 h-3.5 text-emerald-600" strokeWidth={1.5} />
            <span>
              Nivel {activeLevel}: {config.name}
            </span>
          </Badge>

          <span className="text-xs font-semibold text-slate-500">
            Progreso de nivel: {progressPct}%
          </span>
        </div>

        {/* 2. DISPONIBLE PARA GASTAR HOY + BARRA DE 3 SEGMENTOS */}
        <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/90 space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <span className="text-xs font-semibold text-slate-500 block">
                {safeToSpend === null
                  ? "Margen financiero no disponible:"
                  : "Disponible para gastar hoy:"}
              </span>
              <span className="text-2xl sm:text-3xl font-bold font-heading text-slate-900 tracking-tight">
                {safeToSpend === null
                  ? "—"
                  : `$${safeToSpend.toLocaleString()}`}{" "}
                {safeToSpend !== null && (
                  <span className="text-xs font-semibold text-slate-400">
                    MXN
                  </span>
                )}
              </span>
            </div>

            {activeDamage > 0 &&
              !isRecovered &&
              (!hasAuthoritativeEvaluation || evaluationComplete) && (
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                  isDanger
                    ? "bg-amber-50 text-amber-900 border-amber-200"
                    : "bg-emerald-50 text-emerald-800 border-emerald-200"
                }`}
              >
                 Evaluando: ${activeDamage.toLocaleString()} MXN
              </span>
            )}
          </div>

          {/* Clean 3-Segment Horizontal Bar */}
          <div className="w-full h-3 rounded-full bg-slate-200/80 overflow-hidden flex gap-0.5 p-0.5">
            <div
              style={{
                width: `${
                  hasAuthoritativeEvaluation && !evaluationComplete
                    ? 0
                    : fixedPct
                }%`,
              }}
              className="h-full rounded-l-full bg-slate-400 transition-all duration-500"
              title={
                fixedAndRentTotal === null
                  ? "Compromisos considerados: desconocidos"
                  : `Compromisos considerados: -$${fixedAndRentTotal.toLocaleString()}`
              }
            />
            <div
              style={{
                width: `${
                  hasAuthoritativeEvaluation && !evaluationComplete
                    ? 0
                    : bufferPct
                }%`,
              }}
              className="h-full bg-slate-300 transition-all duration-500"
              title={
                safetyBuffer === null
                  ? "Reservas protegidas: desconocidas"
                  : `Reservas protegidas: -$${safetyBuffer.toLocaleString()}`
              }
            />
            <div
              style={{
                width: `${
                  hasAuthoritativeEvaluation && !evaluationComplete
                    ? 0
                    : freePct
                }%`,
              }}
              className={`h-full rounded-r-full transition-all duration-500 ${
                isDanger ? "bg-amber-500" : "bg-[#10B981]"
              }`}
              title={
                safeToSpend === null
                  ? "Margen: desconocido"
                  : `Margen: $${safeToSpend.toLocaleString()}`
              }
            />
          </div>

          {/* 1-Glance Breakdown Legend */}
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-slate-600 pt-0.5">
            <span>
              <strong className="text-slate-900">
                Saldo {totalBalance === null ? "—" : `$${totalBalance.toLocaleString()}`}
              </strong>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
              Compromisos considerados:{" "}
              {fixedAndRentTotal === null
                ? "—"
                : `−$${fixedAndRentTotal.toLocaleString()}`}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-slate-300 inline-block" />
              Reservas:{" "}
              {safetyBuffer === null
                ? "—"
                : `−$${safetyBuffer.toLocaleString()}`}
            </span>
            <span className="flex items-center gap-1 font-semibold text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-[#10B981] inline-block" />
              = Margen:{" "}
              {safeToSpend === null
                ? "—"
                : `$${safeToSpend.toLocaleString()}`}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Dynamic Gamified Plant/Tree SVG Stage */}
      <div
        className={`relative flex flex-col items-center justify-center ${
          compact ? "my-3 py-2" : "my-5 py-4"
        }`}
      >
        {/* Floating "+XP de Sabiduría Financiera" Badge when user chooses a positive decision */}
        <AnimatePresence>
          {isRecovered && (
            <motion.div
              key={`xp-wisdom-badge-${recoveredXpBonus}`}
              initial={{ opacity: 0, y: 12, scale: 0.9 }}
              animate={{ opacity: 1, y: -2, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.9 }}
              className="absolute top-0 z-20 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-900 font-bold font-heading text-xs px-3.5 py-1.5 shadow-sm border border-emerald-200"
            >
              <Sparkles
                className="w-3.5 h-3.5 text-emerald-600"
                strokeWidth={1.5}
              />
              <span>+{recoveredXpBonus} XP de Sabiduría Financiera</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Subtle Liquidity Deficit Alert */}
        <AnimatePresence>
          {isDanger && missingAmount !== null && (
            <motion.div
              key="danger-wilting-badge"
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute top-0 z-20 inline-flex items-center gap-1.5 rounded-full bg-amber-50 text-amber-900 font-semibold text-xs px-3.5 py-1.5 shadow-xs border border-amber-200 text-center"
            >
              <AlertTriangle
                className="w-3.5 h-3.5 text-amber-600 shrink-0"
                strokeWidth={1.5}
              />
              <span>
                Te faltan ${missingAmount.toLocaleString()} MXN de margen libre
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
          className={`text-xs font-medium text-center max-w-md ${
            isDanger
              ? "text-amber-800"
              : isRecovered
              ? "text-emerald-800"
              : "text-slate-600"
          }`}
        >
          {isDanger
            ? "Esta compra supera tu disponible libre hoy. Revisa las opciones recomendadas abajo."
            : isRecovered
            ? `¡Excelente decisión! Proteges tus pagos fijos y sumas +${recoveredXpBonus} XP.`
            : config.subtitle}
        </p>
      </div>

      {/* 3. Interactive 5-Level Selector Strip (For exploring all 5 evolution stages) */}
      {allowLevelPreview && (
        <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-slate-500 flex items-center gap-1.5">
            <TreePine className="w-4 h-4 text-emerald-600" strokeWidth={1.5} />
            <span>Explorar los 5 niveles de evolución:</span>
          </span>

          <div className="flex items-center gap-1.5">
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
                  className={`h-7 px-2.5 rounded-lg text-xs font-bold font-heading transition-all cursor-pointer ${
                    isSelected
                      ? "bg-[#10B981] text-white shadow-xs"
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                  title={`Ver Nivel ${lvl}: ${LEVELS_CONFIG[lvl].name}`}
                >
                  Nivel {lvl}
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
                className="text-xs text-slate-400 hover:text-slate-700 ml-1 underline cursor-pointer"
              >
                Actual
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
