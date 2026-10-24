"use client";

import React, { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Sparkles,
  X,
  Loader2,
  ShoppingBag,
  Clock,
  CalendarCheck,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import FinancialPlantWidget, {
  type PlantSimulationState,
} from "@/components/FinancialPlantWidget";
import { useFinancial } from "@/context/FinancialContext";
import {
  playTap,
  playCoin,
  playDamage,
  triggerConfettiBurst,
} from "@/lib/soundEffects";
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
  const { profile, addToWishlist, registerPurchaseAnyway } = useFinancial();

  const [selectedDecision, setSelectedDecision] = useState<
    "idle" | "wait" | "microsave" | "bought"
  >("idle");
  const [decisionXpBonus, setDecisionXpBonus] = useState<number>(50);

  // Core Deterministic Financial Engine
  const metrics = useMemo(() => {
    const commitmentsTotal = profile.commitments
      .filter((c) => c.dueInDays <= profile.nextPaydayDays)
      .reduce((acc, c) => acc + c.amount, 0);

    const essentialLivingCost =
      profile.dailyEssentialBurn * profile.nextPaydayDays;

    const fixedAndRentTotal = commitmentsTotal + essentialLivingCost;

    const safeToSpend =
      apiEvaluation?.safeToSpend ??
      Math.max(
        0,
        profile.currentBalance - fixedAndRentTotal - profile.safetyBuffer
      );

    const netAfterPurchase = safeToSpend - itemPrice;
    const isDeficit = itemPrice > 0 && netAfterPurchase < 0;
    const missingLiquidity = isDeficit ? Math.abs(netAfterPurchase) : 0;

    const weeklyGoalContribution = Math.max(
      300,
      profile.goal.weeklyContribution || 500
    );
    const weeksGoalDelayed = Math.max(
      1,
      Math.ceil(itemPrice / weeklyGoalContribution)
    );

    const suggestedWeeklySave = 400;
    const microSaveWeeks = Math.max(
      1,
      Math.ceil(itemPrice / suggestedWeeklySave)
    );

    return {
      safeToSpend,
      netAfterPurchase,
      isDeficit,
      missingLiquidity,
      weeksGoalDelayed,
      suggestedWeeklySave,
      microSaveWeeks,
    };
  }, [profile, itemPrice, apiEvaluation]);

  useEffect(() => {
    setSelectedDecision("idle");
    if (metrics.isDeficit) {
      playDamage();
    } else {
      playTap();
    }
  }, [itemName, itemPrice, metrics.isDeficit]);

  // Decision 1: "Comprar hoy"
  const handleDecisionBuyToday = () => {
    playDamage();
    setSelectedDecision("bought");
    registerPurchaseAnyway(itemName, itemPrice);
    const msg = `Compra registrada: −$${itemPrice.toLocaleString()} MXN (${itemName})`;
    if (onActionCompleted) {
      onActionCompleted(msg);
    }
  };

  // Decision 2: "Esperar a tu nómina" (+50 XP)
  const handleDecisionWaitPayroll = () => {
    playCoin();
    triggerConfettiBurst();
    setDecisionXpBonus(50);
    setSelectedDecision("wait");
    addToWishlist(
      {
        name: itemName,
        price: itemPrice,
      },
      50
    );
    const msg = `Decisión recomendada: Esperar ${profile.nextPaydayDays} días a tu nómina · +50 XP`;
    if (onActionCompleted) {
      onActionCompleted(msg);
    }
  };

  // Decision 3: "Plan de Micro-ahorro" (+100 XP)
  const handleDecisionMicroSave = () => {
    playCoin();
    triggerConfettiBurst();
    setDecisionXpBonus(100);
    setSelectedDecision("microsave");
    addToWishlist(
      {
        name: itemName,
        price: itemPrice,
        plannedWeeklySave: metrics.suggestedWeeklySave,
      },
      100
    );
    const msg = `Plan de Micro-ahorro activado ($${metrics.suggestedWeeklySave}/sem) · +100 XP`;
    if (onActionCompleted) {
      onActionCompleted(msg);
    }
  };

  const plantSimulationState: PlantSimulationState =
    selectedDecision === "wait" || selectedDecision === "microsave"
      ? "recovered"
      : metrics.isDeficit
      ? "danger"
      : "normal";

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Card className="bg-white border border-slate-200 shadow-sm rounded-3xl overflow-hidden py-0 gap-0">
        {/* Clean Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {onClose && (
              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  playTap();
                  onClose();
                }}
                className="p-2 -ml-1 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
                aria-label="Volver"
              >
                <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
              </motion.button>
            )}
            {thumbnailDataUrl && (
              <div className="w-11 h-11 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 shrink-0">
                <img
                  src={thumbnailDataUrl}
                  alt={itemName}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="truncate">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-emerald-700">
                  {storeTag ? `Captura: ${storeTag}` : "Evaluación de compra"}
                </span>
                {isLoadingApi && (
                  <Loader2
                    className="w-3.5 h-3.5 animate-spin text-emerald-600"
                    strokeWidth={1.5}
                  />
                )}
              </div>
              <h2 className="text-base sm:text-lg font-bold font-heading text-slate-900 truncate">
                {itemName} ·{" "}
                <span className="text-emerald-700">
                  ${itemPrice.toLocaleString()} MXN
                </span>
              </h2>
            </div>
          </div>

          {onClose && !isStandalonePage && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-50 cursor-pointer"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </motion.button>
          )}
        </div>

        <CardContent className="p-6 sm:p-8 space-y-8">
          {/* 1. Financial Plant + 3-Segment Liquidity Breakdown */}
          <FinancialPlantWidget
            simulationState={plantSimulationState}
            compact
            allowLevelPreview={false}
            previewDamagePrice={itemPrice}
            recoveredXpBonus={decisionXpBonus}
          />

          {/* 2. The 3 Clean & Spacious Decision Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Tarjeta 1: Comprar hoy */}
            <div
              className={`rounded-3xl bg-white border p-6 shadow-sm flex flex-col justify-between gap-5 ${
                selectedDecision === "bought"
                  ? "border-amber-400 ring-2 ring-amber-400/20"
                  : "border-slate-200"
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                    {metrics.isDeficit
                      ? `Te faltan $${metrics.missingLiquidity.toLocaleString()} de liquidez libre`
                      : `Reduce tu margen a $${Math.max(
                          0,
                          metrics.netAfterPurchase
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
                  {metrics.isDeficit
                    ? `Tomaría $${metrics.missingLiquidity.toLocaleString()} MXN del dinero apartado para tu renta/pagos fijos y retrasaría tu meta "${profile.goal.title}" ${metrics.weeksGoalDelayed} semanas.`
                    : `Cubres el gasto con tu dinero libre hoy, pero retrasas tu meta "${profile.goal.title}" aproximadamente ${metrics.weeksGoalDelayed} semanas.`}
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
            </div>

            {/* Tarjeta 2 (Destacada con borde esmeralda suave): Esperar a tu nómina */}
            <div
              className={`rounded-3xl bg-white border-2 p-6 shadow-sm flex flex-col justify-between gap-5 ${
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
                  {profile.nextPaydayAmount.toLocaleString()} MXN y lo compras
                  con tranquilidad sin tocar el dinero de tus pagos fijos.
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
            </div>

            {/* Tarjeta 3: Plan de Micro-ahorro */}
            <div
              className={`rounded-3xl bg-white border p-6 shadow-sm flex flex-col justify-between gap-5 ${
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
                    ${metrics.suggestedWeeklySave}/semana
                  </strong>{" "}
                  y cómpralo en{" "}
                  <strong className="text-slate-900">
                    {metrics.microSaveWeeks} semanas
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
                Activar plan de ${metrics.suggestedWeeklySave}/sem
              </motion.button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
