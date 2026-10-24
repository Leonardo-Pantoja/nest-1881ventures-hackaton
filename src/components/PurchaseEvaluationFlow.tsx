"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Wallet,
  Clock,
  PiggyBank,
  BookmarkCheck,
  ShoppingBag,
  ArrowLeft,
  Calendar,
  Target,
  Sparkles,
  X,
  Loader2,
  Flame,
  Zap,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import FinancialPlantWidget, {
  type PlantSimulationState,
} from "@/components/FinancialPlantWidget";
import QuincenaEnergyGauge from "@/components/QuincenaEnergyGauge";
import { useFinancial } from "@/context/FinancialContext";
import type { EvaluateApiResponse } from "@/app/api/evaluate/route";

interface PurchaseEvaluationFlowProps {
  itemName: string;
  itemPrice: number;
  thumbnailDataUrl?: string | null;
  storeTag?: string | null;
  apiEvaluation?: EvaluateApiResponse | null;
  isLoadingApi?: boolean;
  onClose?: () => void;
  onActionCompleted?: (message: string) => void;
  isStandalonePage?: boolean;
}

export default function PurchaseEvaluationFlow({
  itemName,
  itemPrice,
  thumbnailDataUrl = null,
  storeTag = null,
  apiEvaluation = null,
  isLoadingApi = false,
  onClose,
  onActionCompleted,
  isStandalonePage = false,
}: PurchaseEvaluationFlowProps) {
  const {
    profile,
    addToWishlist,
    registerPurchaseAnyway,
    incrementStreak,
  } = useFinancial();

  const [activeTab, setActiveTab] = useState<"today" | "wait" | "microsave">(
    "today"
  );
  const hasAwardedTabStreakRef = useRef(false);

  const defaultSuggestedWeekly = useMemo(() => {
    if (apiEvaluation?.suggestedWeeklySave) {
      return apiEvaluation.suggestedWeeklySave;
    }
    const base = Math.round(itemPrice / 6);
    return Math.min(2000, Math.max(100, Math.round(base / 50) * 50));
  }, [itemPrice, apiEvaluation]);

  const [weeklySaveAmount, setWeeklySaveAmount] = useState<number>(
    defaultSuggestedWeekly
  );

  useEffect(() => {
    setWeeklySaveAmount(defaultSuggestedWeekly);
  }, [defaultSuggestedWeekly]);

  const handleSelectScenarioTab = (tab: "today" | "wait" | "microsave") => {
    setActiveTab(tab);
    if ((tab === "wait" || tab === "microsave") && !hasAwardedTabStreakRef.current) {
      hasAwardedTabStreakRef.current = true;
      incrementStreak(
        tab === "wait"
          ? "¡Elegiste esperar a nómina! +1 Racha 🔥"
          : "¡Activaste plan de Micro-ahorro! +1 Racha 🔥"
      );
    }
  };

  // Core Deterministic Financial Engine
  const metrics = useMemo(() => {
    const commitmentsTotal = profile.commitments
      .filter((c) => c.dueInDays <= profile.nextPaydayDays)
      .reduce((acc, c) => acc + c.amount, 0);

    const essentialLivingCost =
      profile.dailyEssentialBurn * profile.nextPaydayDays;

    const safeToSpend =
      apiEvaluation?.safeToSpend ??
      Math.max(
        0,
        profile.currentBalance -
          commitmentsTotal -
          essentialLivingCost -
          profile.safetyBuffer
      );

    const remainingAfterBuyToday = safeToSpend - itemPrice;
    const remainingFreeSafe = Math.max(0, remainingAfterBuyToday);

    const freeMoneyRemainingPct =
      safeToSpend > 0
        ? Math.max(
            0,
            Math.min(100, Math.round((remainingFreeSafe / safeToSpend) * 100))
          )
        : 0;

    const usedByPurchasePct = 100 - freeMoneyRemainingPct;

    let verdict: "VIABLE" | "PRECAUCION" | "COMPROMETE" =
      apiEvaluation?.verdict ?? "VIABLE";
    if (!apiEvaluation) {
      if (remainingAfterBuyToday < 0) {
        verdict = "COMPROMETE";
      } else if (remainingAfterBuyToday < profile.safetyBuffer * 0.5) {
        verdict = "PRECAUCION";
      }
    }

    const dailyGoalRate = Math.max(1, profile.goal.weeklyContribution / 7);
    const daysGoalDelayed =
      apiEvaluation?.daysGoalDelayed ??
      Math.max(1, Math.round(itemPrice / dailyGoalRate));

    const liquidityAfterPayday = Math.max(
      0,
      safeToSpend + profile.nextPaydayAmount
    );
    const remainingIfWaitPayday = Math.max(
      0,
      liquidityAfterPayday - itemPrice
    );
    const waitRemainingPct =
      liquidityAfterPayday > 0
        ? Math.min(
            100,
            Math.round((remainingIfWaitPayday / liquidityAfterPayday) * 100)
          )
        : 100;

    const weeksNeeded = Math.max(
      1,
      Math.ceil(itemPrice / Math.max(50, weeklySaveAmount))
    );

    const headlineLine1 =
      verdict === "COMPROMETE"
        ? `Faltan $${Math.abs(remainingAfterBuyToday).toLocaleString()} MXN libres hoy`
        : verdict === "PRECAUCION"
        ? `Te deja con $${remainingFreeSafe.toLocaleString()} MXN libres esta semana`
        : `¡Sí te alcanza! Te sobran $${remainingFreeSafe.toLocaleString()} MXN libres`;

    const headlineLine2 =
      verdict === "COMPROMETE"
        ? `Espera ${profile.nextPaydayDays}d a tu nómina o usa micro-ahorro para cuidar tu planta 🌱`
        : `Tus pagos fijos ($${commitmentsTotal.toLocaleString()}) y tu colchón están a salvo ✨`;

    return {
      commitmentsTotal,
      essentialLivingCost,
      safeToSpend,
      remainingAfterBuyToday,
      remainingFreeSafe,
      freeMoneyRemainingPct,
      usedByPurchasePct,
      verdict,
      daysGoalDelayed,
      liquidityAfterPayday,
      remainingIfWaitPayday,
      waitRemainingPct,
      weeksNeeded,
      headlineLine1,
      headlineLine2,
    };
  }, [profile, itemPrice, weeklySaveAmount, apiEvaluation]);

  const handleSaveToWishlist = () => {
    addToWishlist({
      name: itemName,
      price: itemPrice,
      plannedWeeklySave: weeklySaveAmount,
    });
    const msg = `🔥 ¡Racha +1! Guardado en deseos: "${itemName}" ($${itemPrice.toLocaleString()})`;
    if (onActionCompleted) {
      onActionCompleted(msg);
    }
    if (onClose) {
      onClose();
    }
  };

  const handleRegisterAnyway = () => {
    registerPurchaseAnyway(itemName, itemPrice);
    const msg = `Compra registrada: −$${itemPrice.toLocaleString()} MXN (${itemName})`;
    if (onActionCompleted) {
      onActionCompleted(msg);
    }
    if (onClose) {
      onClose();
    }
  };

  // Real-time plant state linked to active tab and deficit status
  const plantSimulationState: PlantSimulationState =
    activeTab === "wait" || activeTab === "microsave"
      ? "recovered"
      : metrics.verdict === "COMPROMETE"
      ? "danger"
      : "normal";

  return (
    <div className="w-full max-w-xl mx-auto">
      <Card className="bg-[#FAF8F5] border-[#DCD5CA] shadow-xl rounded-3xl overflow-hidden py-0 gap-0">
        {/* Top Bar with Item Context, Streak Pill & Close Button */}
        <div className="bg-white border-b border-[#E6E1DA] px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {onClose && (
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={onClose}
                className="p-2 -ml-1 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-[#FAF8F5] transition-colors cursor-pointer shrink-0"
                aria-label="Volver"
              >
                <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
              </motion.button>
            )}
            {thumbnailDataUrl && (
              <div className="w-11 h-11 rounded-xl overflow-hidden border border-[#DCD5CA] bg-white shrink-0 shadow-2xs">
                <img
                  src={thumbnailDataUrl}
                  alt={itemName}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="truncate">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                  {storeTag ? `📸 ${storeTag}` : "Simulador en vivo"}
                </span>
                {isLoadingApi && (
                  <Loader2
                    className="w-3 h-3 animate-spin text-emerald-600"
                    strokeWidth={1.5}
                  />
                )}
              </div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                {itemName} ·{" "}
                <span className="font-mono text-emerald-800">
                  ${itemPrice.toLocaleString()}
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Streak Pill */}
            <div className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-orange-100 to-amber-100 border border-orange-300/80 px-2.5 py-1 text-xs font-bold text-orange-900">
              <Flame
                className="w-3.5 h-3.5 text-orange-600 fill-orange-500"
                strokeWidth={1.5}
              />
              <span>{profile.streakCount ?? 3}</span>
            </div>

            {onClose && !isStandalonePage && (
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-[#FAF8F5] transition-colors cursor-pointer"
                aria-label="Cerrar panel"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </motion.button>
            )}
          </div>
        </div>

        <CardContent className="p-4 sm:p-6 space-y-5">
          {/* 1. Compact Visual Verdict Cue */}
          <div
            className={`rounded-2xl border p-4 transition-colors ${
              metrics.verdict === "COMPROMETE"
                ? "bg-gradient-to-r from-rose-50 via-white to-rose-50/60 border-rose-200 text-rose-950"
                : metrics.verdict === "PRECAUCION"
                ? "bg-gradient-to-r from-amber-50 via-white to-amber-50/60 border-amber-200 text-amber-950"
                : "bg-gradient-to-r from-emerald-50 via-white to-teal-50/60 border-emerald-200 text-emerald-950"
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
              <Badge
                variant="outline"
                className={`px-2.5 py-0.5 text-xs font-bold border ${
                  metrics.verdict === "COMPROMETE"
                    ? "bg-rose-100 text-rose-900 border-rose-300"
                    : metrics.verdict === "PRECAUCION"
                    ? "bg-amber-100 text-amber-900 border-amber-300"
                    : "bg-emerald-100 text-emerald-900 border-emerald-300"
                }`}
              >
                {metrics.verdict === "COMPROMETE" ? (
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-700" strokeWidth={1.5} />
                ) : metrics.verdict === "PRECAUCION" ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-700" strokeWidth={1.5} />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" strokeWidth={1.5} />
                )}
                <span>
                  {metrics.verdict === "COMPROMETE"
                    ? "Compromete tu quincena"
                    : metrics.verdict === "PRECAUCION"
                    ? "Viable con precaución"
                    : "Compra viable hoy"}
                </span>
              </Badge>

              <span className="text-xs font-mono font-semibold text-slate-600">
                Libre hoy: ${metrics.safeToSpend.toLocaleString()}
              </span>
            </div>

            <p className="text-base font-bold leading-snug">{metrics.headlineLine1}</p>
            <p className="text-xs opacity-85 mt-0.5">{metrics.headlineLine2}</p>
          </div>

          {/* 2. Gamified Financial Plant Widget connected in real-time */}
          <FinancialPlantWidget
            simulationState={plantSimulationState}
            compact
            allowLevelPreview={false}
          />

          {/* 3. Comparador Interactivo de 3 Caminos (Mobile-First Vibrant Tabs) */}
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-1.5 p-1.5 rounded-2xl bg-[#EFECE6] border border-[#E2DCD3]">
              {(
                [
                  { id: "today", label: "Comprar hoy", icon: Wallet },
                  {
                    id: "wait",
                    label: `Esperar ${profile.nextPaydayDays}d`,
                    icon: Clock,
                  },
                  { id: "microsave", label: "Micro-ahorro", icon: PiggyBank },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const isSelected = activeTab === tab.id;
                return (
                  <motion.button
                    key={tab.id}
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    onClick={() => handleSelectScenarioTab(tab.id)}
                    className={`relative py-2.5 px-2 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer z-10 ${
                      isSelected
                        ? "text-slate-900"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {isSelected && (
                      <motion.div
                        layoutId="activeScenarioTabBg"
                        className="absolute inset-0 rounded-xl bg-white shadow-xs border border-[#DCD5CA]"
                        transition={{
                          type: "spring",
                          stiffness: 380,
                          damping: 30,
                        }}
                      />
                    )}
                    <Icon
                      className="w-3.5 h-3.5 relative z-10 shrink-0"
                      strokeWidth={1.5}
                    />
                    <span className="relative z-10 truncate">{tab.label}</span>
                  </motion.button>
                );
              })}
            </div>

            {/* Tab Content Container with Visual Cues */}
            <div className="rounded-3xl bg-white border border-[#E6E1DA] p-4 sm:p-5 shadow-2xs">
              <AnimatePresence mode="wait">
                {/* TAB 1: Comprar hoy */}
                {activeTab === "today" && (
                  <motion.div
                    key="tab-today"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.22 }}
                    className="space-y-4"
                  >
                    <QuincenaEnergyGauge
                      safeToSpend={metrics.safeToSpend}
                      previewPrice={itemPrice}
                      nextPaydayDays={profile.nextPaydayDays}
                    />

                    {/* Visual Goal Delay Cue */}
                    <div className="rounded-2xl bg-gradient-to-r from-amber-50/70 via-[#FAF8F5] to-white border border-[#E6E1DA] p-3.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-amber-100/80 text-amber-800 flex items-center justify-center shrink-0">
                          <Target className="w-4 h-4" strokeWidth={1.5} />
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-500 block">
                            Meta: “{profile.goal.title}”
                          </span>
                          <span className="text-xs sm:text-sm font-bold text-slate-900">
                            Se pausa{" "}
                            <span className="text-amber-800 underline decoration-amber-400 decoration-2">
                              {metrics.daysGoalDelayed} días
                            </span>
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-mono font-semibold text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-[#E6E1DA]">
                        ${profile.goal.weeklyContribution}/sem
                      </span>
                    </div>
                  </motion.div>
                )}

                {/* TAB 2: Esperar a tu próximo ingreso */}
                {activeTab === "wait" && (
                  <motion.div
                    key="tab-wait"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.22 }}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3.5 rounded-2xl bg-rose-50/50 border border-rose-200/70 space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block">
                          Si pagas hoy
                        </span>
                        <p className="text-base sm:text-lg font-bold font-mono text-slate-900">
                          {metrics.remainingAfterBuyToday < 0
                            ? `−$${Math.abs(
                                metrics.remainingAfterBuyToday
                              ).toLocaleString()}`
                            : `$${metrics.remainingFreeSafe.toLocaleString()}`}
                        </p>
                        <span className="text-[11px] text-slate-500 block">
                          Energía al {metrics.freeMoneyRemainingPct}%
                        </span>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50/70 border border-emerald-300 space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                          En {profile.nextPaydayDays} días (Nómina)
                        </span>
                        <p className="text-base sm:text-lg font-bold font-mono text-emerald-950">
                          +${metrics.remainingIfWaitPayday.toLocaleString()}
                        </p>
                        <span className="text-[11px] text-emerald-800 font-semibold block">
                          Energía al {metrics.waitRemainingPct}% ⚡
                        </span>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-[#FAF8F5] border border-[#E6E1DA] p-3 flex items-center gap-2.5 text-xs text-slate-700">
                      <Calendar
                        className="w-4 h-4 text-emerald-700 shrink-0"
                        strokeWidth={1.5}
                      />
                      <span>
                        En <strong>{profile.nextPaydayDays} días</strong> cobras{" "}
                        <strong className="font-mono">
                          ${profile.nextPaydayAmount.toLocaleString()} MXN
                        </strong>{" "}
                        y compras con 0% estrés.
                      </span>
                    </div>
                  </motion.div>
                )}

                {/* TAB 3: Plan de Micro-ahorro (Interactive Slider) */}
                {activeTab === "microsave" && (
                  <motion.div
                    key="tab-microsave"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.22 }}
                    className="space-y-4"
                  >
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-[#FAF8F5] to-emerald-50/40 border border-[#E6E1DA] space-y-3.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[11px] text-slate-500 block">
                            Apartas cada semana
                          </span>
                          <span className="text-lg font-bold font-mono text-slate-900">
                            ${weeklySaveAmount.toLocaleString()} MXN
                          </span>
                        </div>

                        <div className="text-right bg-emerald-600 text-white px-3.5 py-1.5 rounded-2xl shadow-2xs">
                          <span className="text-[10px] uppercase tracking-wider block opacity-90">
                            Lo logras en
                          </span>
                          <span className="text-base font-bold font-mono">
                            {metrics.weeksNeeded}{" "}
                            {metrics.weeksNeeded === 1 ? "semana" : "semanas"}
                          </span>
                        </div>
                      </div>

                      <input
                        type="range"
                        min={100}
                        max={Math.max(1000, Math.min(3000, itemPrice))}
                        step={50}
                        value={weeklySaveAmount}
                        onChange={(e) =>
                          setWeeklySaveAmount(Number(e.target.value))
                        }
                        className="w-full h-2.5 bg-[#E2DCD3] rounded-lg appearance-none cursor-pointer accent-emerald-600"
                      />

                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                        <span>$100/sem</span>
                        <span>$300/sem</span>
                        <span>
                          ${Math.max(1000, Math.min(3000, itemPrice)).toLocaleString()}
                          /sem
                        </span>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-emerald-50/80 border border-emerald-200 p-3 flex items-center gap-2.5 text-xs text-emerald-950 font-medium">
                      <Sparkles
                        className="w-4 h-4 text-emerald-700 shrink-0"
                        strokeWidth={1.5}
                      />
                      <span>
                        Tu quincena y tu meta <strong>“{profile.goal.title}”</strong> quedan 100% intactas.
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* 4. Action Buttons at the Bottom with Micro-interactions */}
          <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={handleSaveToWishlist}
              className="h-12 px-5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 text-white hover:opacity-95 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 flex-1 cursor-pointer shadow-sm"
            >
              <BookmarkCheck className="w-4 h-4 shrink-0" strokeWidth={1.5} />
              <span>Decidí esperar (Guardar en lista de deseos)</span>
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={handleRegisterAnyway}
              className="h-12 px-4 rounded-2xl border border-[#DCD5CA] bg-white hover:bg-[#F3EFEA] text-slate-700 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4 shrink-0" strokeWidth={1.5} />
              <span>Registrar compra de todos modos</span>
            </motion.button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
