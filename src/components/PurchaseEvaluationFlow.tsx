"use client";

import React, { useState, useMemo, useEffect } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useFinancial } from "@/context/FinancialContext";
import type { EvaluateApiResponse } from "@/app/api/evaluate/route";

interface PurchaseEvaluationFlowProps {
  itemName: string;
  itemPrice: number;
  apiEvaluation?: EvaluateApiResponse | null;
  isLoadingApi?: boolean;
  onClose?: () => void;
  onActionCompleted?: (message: string) => void;
  isStandalonePage?: boolean;
}

export default function PurchaseEvaluationFlow({
  itemName,
  itemPrice,
  apiEvaluation = null,
  isLoadingApi = false,
  onClose,
  onActionCompleted,
  isStandalonePage = false,
}: PurchaseEvaluationFlowProps) {
  const { profile, addToWishlist, registerPurchaseAnyway } = useFinancial();

  const [activeTab, setActiveTab] = useState<"today" | "wait" | "microsave">(
    "today"
  );

  // Interactive micro-saving slider state
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

  // Core Deterministic Financial Engine (with seamless sync from /api/evaluate)
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
      apiEvaluation?.headlineLine1 ||
      (verdict === "COMPROMETE"
        ? `Pagarlo hoy rebasa tu dinero libre por $${Math.abs(
            remainingAfterBuyToday
          ).toLocaleString()} MXN y tocaría lo que ya apartaste para tus pagos fijos.`
        : verdict === "PRECAUCION"
        ? `Puedes pagarlo hoy sin tocar tus pagos fijos, pero te dejaría con solo $${remainingFreeSafe.toLocaleString()} MXN libres para imprevistos.`
        : `Cabe cómodamente en tu dinero libre de hoy y aún te deja $${remainingFreeSafe.toLocaleString()} MXN tranquilos para el resto de la semana.`);

    const headlineLine2 =
      apiEvaluation?.headlineLine2 ||
      (verdict === "COMPROMETE"
        ? `Compara abajo cómo cambia tu tranquilidad si esperas ${profile.nextPaydayDays} días a cobrar o si lo planeas por semana.`
        : `Tus compromisos próximos ($${commitmentsTotal.toLocaleString()} MXN) y tu reserva de paz siguen protegidos.`);

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
    const msg = `Guardado en tu lista de deseos: "${itemName}" ($${itemPrice.toLocaleString()} MXN)`;
    if (onActionCompleted) {
      onActionCompleted(msg);
    }
    if (onClose) {
      onClose();
    }
  };

  const handleRegisterAnyway = () => {
    registerPurchaseAnyway(itemName, itemPrice);
    const msg = `Compra registrada: −$${itemPrice.toLocaleString()} MXN (${itemName}) · Tu liquidez se actualizó`;
    if (onActionCompleted) {
      onActionCompleted(msg);
    }
    if (onClose) {
      onClose();
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <Card className="bg-[#FAF8F5] border-[#DCD5CA] shadow-xl rounded-3xl overflow-hidden py-0 gap-0">
        {/* Top Bar with Item Context & Close Button */}
        <div className="bg-white border-b border-[#E6E1DA] px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-2 -ml-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-[#FAF8F5] transition-colors cursor-pointer"
                aria-label="Volver"
              >
                <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                  Análisis paso a paso antes de gastar
                </span>
                {isLoadingApi ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                    <Loader2 className="w-3 h-3 animate-spin" strokeWidth={1.5} />
                    /api/evaluate
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-slate-400">
                    · {apiEvaluation?.source === "ai" ? "IA + Motor" : "Motor determinista"}
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-semibold text-slate-900">
                {itemName}{" "}
                <span className="font-mono text-slate-600 font-normal">
                  · ${itemPrice.toLocaleString()} MXN
                </span>
              </h2>
            </div>
          </div>

          {onClose && !isStandalonePage && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-[#FAF8F5] transition-colors cursor-pointer"
              aria-label="Cerrar panel"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          )}
        </div>

        <CardContent className="p-6 sm:p-8 space-y-7">
          {/* 1. Encabezado del Veredicto: Badge claro y empático + Explicación en 2 líneas */}
          <div
            className={`rounded-2xl border p-5 sm:p-6 transition-colors ${
              metrics.verdict === "COMPROMETE"
                ? "bg-rose-50/80 border-rose-200/90 text-rose-950"
                : metrics.verdict === "PRECAUCION"
                ? "bg-amber-50/80 border-amber-200/90 text-amber-950"
                : "bg-emerald-50/80 border-emerald-200/90 text-emerald-950"
            }`}
          >
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <Badge
                variant="outline"
                className={`px-3 py-1 text-xs font-semibold border ${
                  metrics.verdict === "COMPROMETE"
                    ? "bg-white text-rose-800 border-rose-300"
                    : metrics.verdict === "PRECAUCION"
                    ? "bg-white text-amber-800 border-amber-300"
                    : "bg-white text-emerald-800 border-emerald-300"
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

              <span className="text-xs font-mono opacity-80">
                Tu dinero libre hoy: ${metrics.safeToSpend.toLocaleString()} MXN
              </span>
            </div>

            {/* Human explanation in 2 clear lines */}
            <div className="space-y-1">
              <p className="text-base sm:text-lg font-semibold leading-snug">
                {metrics.headlineLine1}
              </p>
              <p className="text-xs sm:text-sm opacity-85 leading-relaxed">
                {metrics.headlineLine2}
              </p>
            </div>
          </div>

          {/* 2. Comparador Interactivo de 3 Caminos (Tabs animados con framer-motion) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Compara tus 3 caminos posibles
              </span>
              <span className="text-xs text-slate-400">
                Toca cada opción para simular
              </span>
            </div>

            {/* Animated Tabs Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 p-1.5 rounded-2xl bg-[#EFECE6] border border-[#E2DCD3]">
              {(
                [
                  {
                    id: "today",
                    label: "Comprar hoy",
                    icon: Wallet,
                  },
                  {
                    id: "wait",
                    label: `Esperar a tu próximo ingreso`,
                    icon: Clock,
                  },
                  {
                    id: "microsave",
                    label: "Plan de Micro-ahorro",
                    icon: PiggyBank,
                  },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const isSelected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative py-2.5 px-3 rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer z-10 ${
                      isSelected
                        ? "text-slate-900 font-semibold"
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
                          damping: 32,
                        }}
                      />
                    )}
                    <Icon className="w-4 h-4 relative z-10 shrink-0" strokeWidth={1.5} />
                    <span className="relative z-10 truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Tab Content Container */}
            <div className="rounded-2xl bg-white border border-[#E6E1DA] p-5 sm:p-6 shadow-2xs">
              <AnimatePresence mode="wait">
                {/* TAB 1: Comprar hoy */}
                {activeTab === "today" && (
                  <motion.div
                    key="tab-today"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="text-base font-semibold text-slate-900">
                          Así queda tu dinero libre para el resto de la semana
                        </h4>
                        <p className="text-xs text-slate-500">
                          De tus ${metrics.safeToSpend.toLocaleString()} MXN disponibles hoy antes de volver a cobrar:
                        </p>
                      </div>
                      <span
                        className={`text-sm font-mono font-semibold px-3 py-1 rounded-xl border ${
                          metrics.remainingAfterBuyToday < 0
                            ? "bg-rose-50 text-rose-800 border-rose-200"
                            : "bg-[#FAF8F5] text-slate-900 border-[#E6E1DA]"
                        }`}
                      >
                        {metrics.remainingAfterBuyToday < 0
                          ? `Faltan $${Math.abs(
                              metrics.remainingAfterBuyToday
                            ).toLocaleString()} MXN`
                          : `Te quedan $${metrics.remainingFreeSafe.toLocaleString()} MXN`}
                      </span>
                    </div>

                    {/* Animated Liquidity Bar */}
                    <div className="space-y-2">
                      <div className="h-4 w-full rounded-full bg-[#F3EFEA] overflow-hidden flex p-0.5 border border-[#E6E1DA]">
                        <motion.div
                          initial={{ width: "100%" }}
                          animate={{ width: `${metrics.freeMoneyRemainingPct}%` }}
                          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                          className={`h-full rounded-full ${
                            metrics.verdict === "COMPROMETE"
                              ? "bg-rose-500"
                              : metrics.verdict === "PRECAUCION"
                              ? "bg-amber-500"
                              : "bg-emerald-600"
                          }`}
                        />
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>
                          Dinero libre que conservas:{" "}
                          <strong className="text-slate-900 font-mono">
                            {metrics.freeMoneyRemainingPct}%
                          </strong>
                        </span>
                        <span>
                          Absorbido por esta compra:{" "}
                          <strong className="text-slate-900 font-mono">
                            {metrics.usedByPurchasePct}%
                          </strong>
                        </span>
                      </div>
                    </div>

                    {/* Goal Delay Callout */}
                    <div className="rounded-xl bg-[#FAF8F5] border border-[#E6E1DA] p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-white border border-[#E6E1DA] text-slate-800 flex items-center justify-center shrink-0">
                          <Target className="w-4 h-4" strokeWidth={1.5} />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">
                            Impacto en tu meta{" "}
                            <strong className="text-slate-800">
                              “{profile.goal.title}”
                            </strong>
                          </p>
                          <p className="text-sm font-semibold text-slate-900">
                            Comprar hoy retrasa tu meta{" "}
                            <span className="underline decoration-amber-500/70 decoration-2 underline-offset-2">
                              {metrics.daysGoalDelayed} días
                            </span>
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-mono text-slate-500 hidden sm:inline">
                        Ritmo: ${profile.goal.weeklyContribution}/sem
                      </span>
                    </div>
                  </motion.div>
                )}

                {/* TAB 2: Esperar a tu próximo ingreso */}
                {activeTab === "wait" && (
                  <motion.div
                    key="tab-wait"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-semibold text-slate-900">
                            Si esperas {profile.nextPaydayDays} días a tu próximo ingreso
                          </h4>
                          <Badge
                            variant="outline"
                            className="border-emerald-300 bg-emerald-50 text-emerald-900 text-[11px]"
                          >
                            Mayor tranquilidad
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Recibes ${profile.nextPaydayAmount.toLocaleString()} MXN y tus pagos de esta semana ya habrán quedado atrás.
                        </p>
                      </div>
                    </div>

                    {/* Before vs After Payday Tranquility Comparison */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E6E1DA] space-y-1">
                        <span className="text-[11px] uppercase tracking-wider text-slate-400 block">
                          Si compras hoy
                        </span>
                        <p className="text-lg font-semibold font-mono text-slate-800">
                          {metrics.remainingAfterBuyToday < 0
                            ? `−$${Math.abs(
                                metrics.remainingAfterBuyToday
                              ).toLocaleString()} MXN`
                            : `$${metrics.remainingFreeSafe.toLocaleString()} MXN libres`}
                        </p>
                        <p className="text-xs text-slate-500">
                          Margen ajustado antes de cobrar
                        </p>
                      </div>

                      <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1">
                        <span className="text-[11px] uppercase tracking-wider text-emerald-800 font-medium block">
                          En {profile.nextPaydayDays} días (Con nómina)
                        </span>
                        <p className="text-lg font-semibold font-mono text-emerald-950">
                          ${metrics.remainingIfWaitPayday.toLocaleString()} MXN libres
                        </p>
                        <p className="text-xs text-emerald-800">
                          Conservas {metrics.waitRemainingPct}% de tu liquidez tranquila
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl bg-[#FAF8F5] border border-[#E6E1DA] p-3.5 flex items-center gap-3 text-xs text-slate-700">
                      <Calendar className="w-4 h-4 text-emerald-700 shrink-0" strokeWidth={1.5} />
                      <span>
                        Además, estos{" "}
                        <strong className="text-slate-900">
                          {profile.nextPaydayDays} días de pausa
                        </strong>{" "}
                        te ayudan a confirmar si realmente lo necesitas o si fue un impulso del momento.
                      </span>
                    </div>
                  </motion.div>
                )}

                {/* TAB 3: Plan de Micro-ahorro (Interactive Slider) */}
                {activeTab === "microsave" && (
                  <motion.div
                    key="tab-microsave"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="text-base font-semibold text-slate-900">
                          Planea tu compra sin desajustar tu semana
                        </h4>
                        <p className="text-xs text-slate-500">
                          Mueve el control para elegir cuánto apartar por semana con total comodidad:
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-slate-400 block">
                          Lo compras en
                        </span>
                        <span className="text-xl font-semibold text-emerald-800 font-mono">
                          {metrics.weeksNeeded}{" "}
                          {metrics.weeksNeeded === 1 ? "semana" : "semanas"}
                        </span>
                      </div>
                    </div>

                    {/* Interactive Slider Box */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF8F5] border border-[#E6E1DA] space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-600">
                          Ahorro semanal dedicado:
                        </span>
                        <span className="text-lg font-semibold text-slate-900 font-mono bg-white px-3 py-1 rounded-xl border border-[#DCD5CA]">
                          ${weeklySaveAmount.toLocaleString()} MXN / sem
                        </span>
                      </div>

                      <input
                        type="range"
                        min={100}
                        max={Math.max(1000, Math.min(3000, itemPrice))}
                        step={50}
                        value={weeklySaveAmount}
                        onChange={(e) => setWeeklySaveAmount(Number(e.target.value))}
                        className="w-full h-2 bg-[#E2DCD3] rounded-lg appearance-none cursor-pointer accent-slate-900"
                      />

                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                        <span>$100/sem</span>
                        <span>$300/sem</span>
                        <span>
                          ${Math.max(1000, Math.min(3000, itemPrice)).toLocaleString()}/sem
                        </span>
                      </div>
                    </div>

                    <div className="rounded-xl bg-emerald-50/70 border border-emerald-200/80 p-3.5 flex items-center gap-3 text-xs text-emerald-950">
                      <Sparkles className="w-4 h-4 text-emerald-700 shrink-0" strokeWidth={1.5} />
                      <span>
                        Apartando{" "}
                        <strong className="font-mono">
                          ${weeklySaveAmount.toLocaleString()}/sem
                        </strong>
                        , reúnes los ${itemPrice.toLocaleString()} MXN en{" "}
                        <strong>{metrics.weeksNeeded} semanas</strong> sin tocar tu renta ni frenar tu meta principal{" "}
                        <strong>“{profile.goal.title}”</strong>.
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* 3. Botones de acción final al pie */}
          <div className="pt-2 border-t border-[#E6E1DA] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <Button
              type="button"
              onClick={handleSaveToWishlist}
              size="lg"
              className="h-12 px-5 rounded-2xl bg-slate-900 text-[#FAF8F5] hover:bg-slate-800 text-xs sm:text-sm font-medium gap-2 flex-1 cursor-pointer shadow-xs"
            >
              <BookmarkCheck className="w-4 h-4 shrink-0" strokeWidth={1.5} />
              <span>Decidí esperar (Guardar en lista de deseos)</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleRegisterAnyway}
              size="lg"
              className="h-12 px-5 rounded-2xl border-[#DCD5CA] bg-white hover:bg-[#F3EFEA] text-slate-700 hover:text-slate-900 text-xs sm:text-sm font-medium gap-2 cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4 shrink-0" strokeWidth={1.5} />
              <span>Registrar compra de todos modos</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
