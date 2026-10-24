"use client";

import React, { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  Sparkles,
  X,
  Loader2,
  Flame,
  Zap,
  Shield,
  FlaskConical,
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

  const [selectedPowerUp, setSelectedPowerUp] = useState<
    "idle" | "shield" | "potion" | "bought"
  >("idle");
  const [powerUpXpBonus, setPowerUpXpBonus] = useState<number>(50);

  // Core Deterministic Financial & HP Engine
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

    const netHpAfterPurchase = safeToSpend - itemPrice;
    const isCriticalHit = itemPrice > 0 && netHpAfterPurchase < 0;
    const missingAmount = isCriticalHit ? Math.abs(netHpAfterPurchase) : 0;

    const weeklyGoalContribution = Math.max(
      300,
      profile.goal.weeklyContribution || 500
    );
    const weeksGoalDelayed = Math.max(
      1,
      Math.ceil(itemPrice / weeklyGoalContribution)
    );

    const suggestedPotionSave = 400;

    return {
      safeToSpend,
      netHpAfterPurchase,
      isCriticalHit,
      missingAmount,
      weeksGoalDelayed,
      suggestedPotionSave,
    };
  }, [profile, itemPrice, apiEvaluation]);

  // Play initial damage/coin sound cue when item changes
  useEffect(() => {
    setSelectedPowerUp("idle");
    if (metrics.isCriticalHit) {
      playDamage();
    } else {
      playTap();
    }
  }, [itemName, itemPrice, metrics.isCriticalHit]);

  // 1. Carta Roja: "⚡ Comprar ya"
  const handleRedCardBuyNow = () => {
    playDamage();
    setSelectedPowerUp("bought");
    registerPurchaseAnyway(itemName, itemPrice);
    const msg = `⚡ Comprado: −$${itemPrice.toLocaleString()} HP (${itemName})`;
    if (onActionCompleted) {
      onActionCompleted(msg);
    }
  };

  // 2. Carta Verde: "🛡️ Escudo de Nómina"
  const handleGreenCardPayrollShield = () => {
    playCoin();
    triggerConfettiBurst();
    setPowerUpXpBonus(50);
    setSelectedPowerUp("shield");
    addToWishlist(
      {
        name: itemName,
        price: itemPrice,
      },
      50
    );
    const msg = `🛡️ ¡Escudo de Nómina! Esperas ${profile.nextPaydayDays} días y ganas +50 XP`;
    if (onActionCompleted) {
      onActionCompleted(msg);
    }
  };

  // 3. Carta Dorada: "🧪 Poción de Ahorro"
  const handleGoldCardSavingPotion = () => {
    playCoin();
    triggerConfettiBurst();
    setPowerUpXpBonus(100);
    setSelectedPowerUp("potion");
    addToWishlist(
      {
        name: itemName,
        price: itemPrice,
        plannedWeeklySave: metrics.suggestedPotionSave,
      },
      100
    );
    const msg = `🧪 ¡Poción de Ahorro! Apartas $${metrics.suggestedPotionSave}/sem y ganas +100 XP`;
    if (onActionCompleted) {
      onActionCompleted(msg);
    }
  };

  const plantSimulationState: PlantSimulationState =
    selectedPowerUp === "shield" || selectedPowerUp === "potion"
      ? "recovered"
      : metrics.isCriticalHit
      ? "danger"
      : "normal";

  return (
    <div className="w-full max-w-xl mx-auto">
      <Card className="bg-[#FAF8F5] border-2 border-b-4 border-[#DCD5CA] shadow-xl rounded-3xl overflow-hidden py-0 gap-0">
        {/* Compact Game Header */}
        <div className="bg-white border-b border-[#E6E1DA] px-4 sm:px-5 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {onClose && (
              <motion.button
                type="button"
                whileTap={{ scale: 0.94 }}
                onClick={() => {
                  playTap();
                  onClose();
                }}
                className="p-2 -ml-1 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-[#FAF8F5] transition-colors cursor-pointer shrink-0"
                aria-label="Volver"
              >
                <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
              </motion.button>
            )}
            {thumbnailDataUrl && (
              <div className="w-10 h-10 rounded-xl overflow-hidden border border-[#DCD5CA] bg-white shrink-0 shadow-2xs">
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
                  {storeTag ? `📸 ${storeTag}` : "Simulación en Vivo"}
                </span>
                {isLoadingApi && (
                  <Loader2
                    className="w-3 h-3 animate-spin text-emerald-600"
                    strokeWidth={1.5}
                  />
                )}
              </div>
              <h2 className="text-sm sm:text-base font-bold font-heading text-slate-900 truncate">
                {itemName} ·{" "}
                <span className="text-rose-600">
                  −${itemPrice.toLocaleString()} HP
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white px-2.5 py-1 text-xs font-bold font-heading">
              <Flame
                className="w-3.5 h-3.5 fill-white text-white"
                strokeWidth={1.5}
              />
              <span>{profile.streakCount ?? 3} 🔥</span>
            </div>

            {onClose && !isStandalonePage && (
              <motion.button
                type="button"
                whileTap={{ scale: 0.94 }}
                onClick={onClose}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </motion.button>
            )}
          </div>
        </div>

        <CardContent className="p-4 sm:p-5 space-y-4">
          {/* 1. Isla Flotante con Planta SVG + Barra de Vida HP */}
          <FinancialPlantWidget
            simulationState={plantSimulationState}
            compact
            allowLevelPreview={false}
            previewDamagePrice={itemPrice}
            recoveredXpBonus={powerUpXpBonus}
          />

          {/* 2. Cartel Corto de Impacto / Golpe Crítico */}
          <div
            className={`rounded-2xl border-2 border-b-4 px-4 py-3 flex items-center justify-between gap-2 ${
              selectedPowerUp === "shield" || selectedPowerUp === "potion"
                ? "bg-emerald-600 border-emerald-700 border-b-emerald-900 text-white"
                : metrics.isCriticalHit
                ? "bg-rose-600 border-rose-700 border-b-rose-900 text-white"
                : "bg-amber-100 border-amber-300 border-b-amber-500 text-amber-950"
            }`}
          >
            <div className="flex items-center gap-2">
              {selectedPowerUp === "shield" || selectedPowerUp === "potion" ? (
                <Sparkles
                  className="w-5 h-5 text-amber-300 shrink-0"
                  strokeWidth={1.5}
                />
              ) : (
                <AlertTriangle className="w-5 h-5 shrink-0" strokeWidth={1.5} />
              )}
              <span className="text-sm font-bold font-heading leading-tight">
                {selectedPowerUp === "shield"
                  ? `¡Escudo de Nómina activado! +50 XP`
                  : selectedPowerUp === "potion"
                  ? `¡Poción de Ahorro activada! +100 XP`
                  : metrics.isCriticalHit
                  ? `¡Golpe crítico a tu quincena! Te faltan $${metrics.missingAmount.toLocaleString()}`
                  : `Daño a tu barra de vida: −$${itemPrice.toLocaleString()} HP`}
              </span>
            </div>
          </div>

          {/* 3. Las 3 Cartas de Poder (Power-Ups) para resolver en 1 toque */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Carta Roja */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={handleRedCardBuyNow}
              className="p-3.5 rounded-3xl border-2 border-b-4 active:border-b-2 active:translate-y-0.5 text-left transition-all flex flex-col justify-between gap-2.5 cursor-pointer bg-gradient-to-b from-rose-50 via-white to-rose-100/80 border-rose-400 border-b-rose-600 shadow-xs"
            >
              <div className="flex items-center justify-between w-full">
                <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-bold font-heading uppercase">
                  Carta Roja
                </span>
                <Zap className="w-4 h-4 text-rose-600" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm sm:text-base font-bold font-heading text-rose-950 leading-snug">
                  ⚡ Comprar ya
                </p>
                <p className="text-xs font-bold font-heading text-rose-700 mt-0.5 leading-snug">
                  (Pierdes escudo y retrasas tu meta {metrics.weeksGoalDelayed}{" "}
                  sem)
                </p>
              </div>
            </motion.button>

            {/* Carta Verde */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={handleGreenCardPayrollShield}
              className="p-3.5 rounded-3xl border-2 border-b-4 active:border-b-2 active:translate-y-0.5 text-left transition-all flex flex-col justify-between gap-2.5 cursor-pointer bg-gradient-to-b from-emerald-50 via-white to-emerald-100/80 border-emerald-400 border-b-emerald-600 shadow-xs"
            >
              <div className="flex items-center justify-between w-full">
                <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold font-heading uppercase">
                  Carta Verde
                </span>
                <Shield
                  className="w-4 h-4 text-emerald-600"
                  strokeWidth={1.5}
                />
              </div>
              <div>
                <p className="text-sm sm:text-base font-bold font-heading text-emerald-950 leading-snug">
                  🛡️ Escudo de Nómina
                </p>
                <p className="text-xs font-bold font-heading text-emerald-800 mt-0.5 leading-snug">
                  (Espera {profile.nextPaydayDays} días y gana +50 XP)
                </p>
              </div>
            </motion.button>

            {/* Carta Dorada */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={handleGoldCardSavingPotion}
              className="p-3.5 rounded-3xl border-2 border-b-4 active:border-b-2 active:translate-y-0.5 text-left transition-all flex flex-col justify-between gap-2.5 cursor-pointer bg-gradient-to-b from-amber-50 via-white to-yellow-100/90 border-amber-400 border-b-amber-600 shadow-xs"
            >
              <div className="flex items-center justify-between w-full">
                <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold font-heading uppercase">
                  Carta Dorada
                </span>
                <FlaskConical
                  className="w-4 h-4 text-amber-600"
                  strokeWidth={1.5}
                />
              </div>
              <div>
                <p className="text-sm sm:text-base font-bold font-heading text-amber-950 leading-snug">
                  🧪 Poción de Ahorro
                </p>
                <p className="text-xs font-bold font-heading text-amber-900 mt-0.5 leading-snug">
                  (Aparta ${metrics.suggestedPotionSave}/sem y gana +100 XP)
                </p>
              </div>
            </motion.button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
