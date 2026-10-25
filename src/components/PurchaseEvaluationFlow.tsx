"use client";

import React, { useState, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Sparkles,
  X,
  Loader2,
  Clock,
  ArrowRight,
  Zap,
  Shield,
  PiggyBank,
  TrendingUp,
  Target,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import FinancialPlantWidget, {
  type PlantSimulationState,
} from "@/components/FinancialPlantWidget";
import { useFinancial } from "@/context/FinancialContext";
import {
  playTap,
  playCoin,
  triggerConfettiBurst,
} from "@/lib/soundEffects";
import PurchaseConfirmationModal from "./PurchaseConfirmationModal";
import type { EvaluateApiResponse } from "@/lib/finance/evaluation";
import FinancialChat from "./FinancialChat";
import FinancialDataStatus from "./FinancialDataStatus";

interface PurchaseEvaluationFlowProps {
  itemName: string;
  itemPrice: number;
  thumbnailDataUrl?: string | null;
  storeTag?: string | null;
  apiEvaluation?: EvaluateApiResponse | null;
  apiEvaluationError?: boolean;
  apiErrorMessage?: string | null;
  isLoadingApi?: boolean;
  onClose?: () => void;
  onActionCompleted?: (message: string) => void;
  isStandalonePage?: boolean;
  onUpdateEvaluatedItem?: (name: string, price: number, thumb?: string | null, tag?: string | null) => void;
}

export default function PurchaseEvaluationFlow({
  itemName,
  itemPrice,
  thumbnailDataUrl = null,
  storeTag = null,
  apiEvaluation = null,
  apiEvaluationError = false,
  apiErrorMessage = null,
  isLoadingApi = false,
  onClose,
  onActionCompleted,
  isStandalonePage = false,
  onUpdateEvaluatedItem,
}: PurchaseEvaluationFlowProps) {
  const { profile, addToWishlist } = useFinancial();

  const [selectedDecision, setSelectedDecision] = useState<
    "idle" | "wait" | "microsave" | "bought"
  >("idle");
  const [decisionXpBonus, setDecisionXpBonus] = useState<number>(50);

  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const actionLock = useRef(false);

  const [chatSuggestion, setChatSuggestion] = useState<{ text: string; id: number } | undefined>();
  const activeEvaluation = apiEvaluation;

  // Core Deterministic Financial Engine (purchaseDecision, purchaseReport, goalImpact, weeklyProjection)
  const metrics = useMemo(() => {
    const evaluationIncomplete =
      itemPrice <= 0 ||
      isLoadingApi ||
      apiEvaluationError ||
      !activeEvaluation ||
      activeEvaluation?.status === "datos_incompletos" ||
      activeEvaluation?.status === "error_procesamiento" ||
      activeEvaluation.safeToSpend === null ||
      activeEvaluation.remainingAfterBuyToday === null;
    const safeToSpend =
      evaluationIncomplete ? 0 : (activeEvaluation?.safeToSpend ?? 0);
    const netAfterPurchase =
      evaluationIncomplete
        ? 0
        : (activeEvaluation?.remainingAfterBuyToday ?? 0);
    const isDeficit =
      !evaluationIncomplete &&
      activeEvaluation?.status === "excede_el_margen";
    const missingLiquidity =
      isDeficit ? (activeEvaluation?.exceedsBy ?? 0) : 0;

    const purchaseDecision = activeEvaluation?.purchaseDecision ?? null;
    const purchaseReport = activeEvaluation?.purchaseReport ?? null;
    const goalImpact =
      activeEvaluation?.goalImpact ?? purchaseReport?.goalImpact ?? null;
    const projectionBefore =
      activeEvaluation?.projection ?? purchaseReport?.projectionBefore ?? null;
    const projectionAfter =
      activeEvaluation?.projectionAfter ??
      purchaseReport?.projectionAfter ??
      null;
    const projectedBalanceDifference =
      activeEvaluation?.projectedBalanceDifference ??
      purchaseReport?.projectedBalanceDifference ??
      null;

    return {
      safeToSpend,
      evaluationIncomplete,
      netAfterPurchase,
      isDeficit,
      missingLiquidity,
      purchaseDecision,
      purchaseReport,
      goalImpact,
      projectionBefore,
      projectionAfter,
      projectedBalanceDifference,
    };
  }, [activeEvaluation, apiEvaluationError, isLoadingApi, itemPrice]);

  const handleDecisionBuyToday = () => {
    if (!metrics.evaluationIncomplete && !saving && itemPrice > 0) setConfirming(true);
  };
  const saveAlternative = async (strategy: "wait") => {
    if (actionLock.current || itemPrice <= 0 || !itemName.trim()) return;
    actionLock.current = true;
    setSaving(true);
    setActionError(null);
    try {
      const xp = await addToWishlist(
        {
          name: itemName,
          price: itemPrice,
          cooldownDays: profile.nextPaydayDays,
          strategy,
        },
        50,
      );
      setDecisionXpBonus(xp);
      setSelectedDecision(strategy);
      playCoin();
      triggerConfettiBurst();
      onActionCompleted?.("Guardado en Retos y Metas. No se descontó dinero de tu saldo.");
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "No se pudo guardar la decisión.",
      );
    } finally {
      actionLock.current = false;
      setSaving(false);
    }
  };
  const handleDecisionWaitPayroll = () => {
    void saveAlternative("wait");
  };
  const handleDecisionMicroSave = () => {
    if (itemPrice <= 0) return;
    setChatSuggestion({ text: `¿Cuánto tendría que ahorrar para comprar ${itemName} de $${itemPrice} MXN?`, id: Date.now() });
  };

  const plantSimulationState: PlantSimulationState =
    selectedDecision === "wait" || selectedDecision === "microsave"
      ? "recovered"
      : metrics.isDeficit
      ? "danger"
      : "normal";

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {confirming && (
        <PurchaseConfirmationModal
          itemName={itemName}
          itemPrice={itemPrice}
          evaluation={activeEvaluation}
          onCancel={() => setConfirming(false)}
          onSuccess={() => {
            setConfirming(false);
            setSelectedDecision("bought");
            onActionCompleted?.("Compra registrada correctamente.");
          }}
        />
      )}
      {actionError && (
        <p role="alert" className="text-rose-700 p-3">
          {actionError}
        </p>
      )}
      <Card className="bg-white border-2 border-b-4 border-slate-200 shadow-sm rounded-3xl overflow-hidden py-0 gap-0">
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
                  {itemPrice > 0
                    ? `$${itemPrice.toLocaleString()} MXN`
                    : "precio por confirmar"}
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

        <CardContent className="p-6 sm:p-8 space-y-6">
          {/* 1. Financial Plant + 3-Segment Liquidity Breakdown */}
          <FinancialPlantWidget
            simulationState={plantSimulationState}
            compact
            allowLevelPreview={false}
            previewDamagePrice={itemPrice}
            recoveredXpBonus={decisionXpBonus}
            financialEvaluation={activeEvaluation}
          />

          <FinancialDataStatus evaluation={activeEvaluation} loading={isLoadingApi} error={apiErrorMessage} />

          {/* 2. Reporte Integrado del Motor (purchaseReport, goalImpact & weeklyProjection) */}
          {!metrics.evaluationIncomplete && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* PurchaseDecision Pill */}
              <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold font-heading text-slate-700">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" strokeWidth={1.5} />
                  <span>Diagnóstico de Margen</span>
                </div>
                <p className="text-sm font-bold font-heading text-slate-900">
                  {activeEvaluation?.badgeLabel}
                </p>
                <p className="text-[11px] text-slate-600 leading-snug">
                  {metrics.purchaseDecision?.explanation || activeEvaluation?.headlineLine2}
                </p>
              </div>

              {/* GoalImpact Pill (Fixed Savings Protected) */}
              <div className="p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/40 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold font-heading text-emerald-800">
                  <Target className="w-3.5 h-3.5 text-emerald-600" strokeWidth={1.5} />
                  <span>Ahorro Fijo en Meta</span>
                </div>
                <p className="text-sm font-bold font-heading text-slate-900">
                  {metrics.goalImpact
                    ? `$${metrics.goalImpact.savedAfter.toLocaleString()} / $${(
                        metrics.goalImpact.savedAfter +
                        metrics.goalImpact.remainingAfter
                      ).toLocaleString()} MXN`
                    : `$${(profile.goal?.currentSaved ?? 0).toLocaleString()} / $${(
                        profile.goal?.targetAmount ?? 0
                      ).toLocaleString()} MXN`}
                </p>
                <p className="text-[11px] text-emerald-800 leading-snug">
                  {metrics.goalImpact?.delayedByWeeks === 0
                    ? `No se retiran ahorros de "${metrics.goalImpact.goalTitle}"`
                    : `Protegido · no se retira dinero de "${
                        profile.goal?.title ?? "tu meta"
                      }"`}
                </p>
              </div>

              {/* WeeklyProjection (6 Weeks) Pill */}
              <div className="p-3.5 rounded-2xl border border-indigo-200 bg-indigo-50/40 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold font-heading text-indigo-900">
                  <TrendingUp className="w-3.5 h-3.5 text-indigo-600" strokeWidth={1.5} />
                  <span>Proyección a 6 Semanas</span>
                </div>
                <p className="text-sm font-bold font-heading text-slate-900">
                  {metrics.projectionAfter && metrics.projectionBefore
                    ? `Sem. 6: $${metrics.projectionAfter.weeks[5]?.endBalance.toLocaleString()} MXN`
                    : metrics.projectionBefore
                      ? `Sem. 6 (sin compra): $${metrics.projectionBefore.weeks[5]?.endBalance.toLocaleString()} MXN`
                      : "Proyección pendiente"}
                </p>
                <p className="text-[11px] text-indigo-900 leading-snug">
                  {metrics.projectedBalanceDifference !== null
                    ? `Impacto neto: ${
                        metrics.projectedBalanceDifference >= 0 ? "+" : ""
                      }$${metrics.projectedBalanceDifference.toLocaleString()} MXN · Mínimo: $${(
                        metrics.projectionAfter?.lowestBalance ??
                        metrics.projectionBefore?.lowestBalance ??
                        0
                      ).toLocaleString()}`
                    : metrics.purchaseReport?.status === "saldo_insuficiente"
                      ? "Supera tu saldo total actual"
                      : "Simulación determinista a 42 días"}
                </p>
              </div>
            </div>
          )}

        </CardContent>
      </Card>

      {/* Shared conversation preserves the current full-width layout. */}
      <div className="w-full rounded-3xl border-2 border-b-4 border-slate-200 bg-[#FAF8F5] p-4 sm:p-5 space-y-3.5">
        <h3 className="text-sm font-bold font-heading text-slate-900">Chat con tu Copiloto Financiero</h3>
        <FinancialChat product={itemPrice > 0 ? { name: itemName, price: itemPrice } : null} suggestion={chatSuggestion}
          onClearProduct={name => onUpdateEvaluatedItem?.(name ?? "", 0, null, null)}
          onProduct={(product, image) => { setSelectedDecision("idle"); onUpdateEvaluatedItem?.(product.name, product.price, image?.thumbnailDataUrl, image?.storeTag); }} />
      </div>

      {/* Bloque 3: Las 3 tarjetas de decisión, fuera de cualquier contenedor estrecho */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
            {/* Carta 1: Comprar hoy */}
            <motion.div
              onClick={handleDecisionBuyToday}
              className={`rounded-3xl bg-white border-2 border-b-4 p-6 shadow-sm flex flex-col justify-between gap-5 min-w-0 transition-all hover:-translate-y-1 active:translate-y-0.5 cursor-pointer ${
                selectedDecision === "bought"
                  ? "border-amber-400 border-b-amber-600 ring-2 ring-amber-400/20"
                  : "border-slate-200 border-b-slate-300 hover:border-amber-300"
              }`}
            >
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <motion.div
                    animate={{ y: [0, -4, 0] }}
                    transition={{
                      duration: 2.8,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 border-2 border-amber-300 flex items-center justify-center shrink-0 shadow-xs"
                  >
                    <Zap
                      className="w-7 h-7 text-amber-600 fill-amber-400"
                      strokeWidth={1.5}
                    />
                  </motion.div>

                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold font-heading bg-amber-50 text-amber-900 border border-amber-200 text-left max-w-full">
                    {metrics.evaluationIncomplete
                      ? itemPrice <= 0
                        ? "Precio por confirmar"
                        : "Datos incompletos"
                      : metrics.isDeficit
                      ? `Te faltan $${metrics.missingLiquidity.toLocaleString()} libres`
                      : activeEvaluation?.status === "precaucion"
                      ? activeEvaluation.badgeLabel
                      : `Margen: $${Math.max(
                          0,
                          metrics.netAfterPurchase
                        ).toLocaleString()}`}
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold font-heading text-slate-900">
                    Comprar hoy
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed mt-1">
                    {metrics.evaluationIncomplete
                      ? apiErrorMessage ||
                        (itemPrice <= 0
                          ? "Confirma un precio mayor que cero antes de solicitar una evaluación."
                          : "No podemos recomendar comprar hoy hasta verificar tus datos financieros.")
                      : metrics.isDeficit
                      ? `La compra supera tu margen por $${metrics.missingLiquidity.toLocaleString()} MXN. Esta simulación no retira dinero de tus reservas ni de tu meta.`
                      : activeEvaluation?.status === "precaucion"
                      ? activeEvaluation.headlineLine1
                      : `Cubres el gasto con tu dinero libre hoy; esta simulación no retira dinero de tu meta "${profile.goal.title}".`}
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-1.5">
                  <div className="flex flex-col gap-1 text-left text-[11px] font-bold font-heading text-amber-900">
                    <span>Impacto en tu quincena</span>
                    <span>
                      {metrics.evaluationIncomplete
                        ? "Evaluación pendiente"
                        : metrics.isDeficit
                        ? "Supera el margen disponible"
                        : "Meta principal intacta"}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-amber-200/70 overflow-hidden">
                    <div className="h-full w-full bg-amber-500 rounded-full" />
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={metrics.evaluationIncomplete}
                className="w-full py-3 px-4 h-auto whitespace-normal text-center leading-snug rounded-xl border-2 border-b-4 border-slate-200 border-b-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold font-heading transition-colors cursor-pointer"
              >
                {metrics.evaluationIncomplete
                  ? "Verifica tus datos financieros"
                  : "Registrar compra hoy"}
              </button>
            </motion.div>

            {/* Carta 2 (Destacada Esmeralda): Guardar para reevaluar */}
            <motion.div
              onClick={handleDecisionWaitPayroll}
              aria-disabled={saving || itemPrice <= 0}
              className={`rounded-3xl bg-white border-2 border-b-4 p-6 shadow-sm flex flex-col justify-between gap-5 min-w-0 transition-all hover:-translate-y-1 active:translate-y-0.5 cursor-pointer ${
                selectedDecision === "wait"
                  ? "border-[#10B981] border-b-emerald-700 ring-4 ring-emerald-500/15"
                  : "border-emerald-400 border-b-emerald-600"
              }`}
            >
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <motion.div
                    animate={{ y: [0, -5, 0] }}
                    transition={{
                      duration: 2.5,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 border-2 border-emerald-400 flex items-center justify-center shrink-0 shadow-xs"
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
                    Alternativa · +50 XP
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold font-heading text-slate-900">
                    Guardar y reevaluar después
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed mt-1">
                    Esperar no garantiza que la compra sea viable. Guarda el
                    artículo y vuelve a evaluarlo cuando el próximo ingreso
                    esté confirmado, considerando también las obligaciones de
                    ese periodo.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 space-y-1.5">
                  <div className="flex flex-col gap-1 text-left text-[11px] font-bold font-heading text-emerald-900">
                    <span>Sin retiro de ahorros</span>
                    <span>Solo guardar</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-emerald-200/70 overflow-hidden">
                    <div className="h-full w-full bg-[#10B981] rounded-full" />
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={itemPrice <= 0}
                className="w-full py-3 px-4 h-auto whitespace-normal text-center leading-snug rounded-xl bg-[#10B981] hover:bg-emerald-600 border-2 border-emerald-600 border-b-4 border-b-emerald-800 text-white text-xs font-bold font-heading shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Clock className="w-4 h-4" strokeWidth={1.5} />
                <span>Guardar para reevaluar (+50 XP)</span>
                <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </motion.div>

            {/* Carta 3: Plan de Micro-ahorro */}
            <motion.div
              onClick={handleDecisionMicroSave}
              aria-disabled={itemPrice <= 0}
              className={`rounded-3xl bg-white border-2 border-b-4 p-6 shadow-sm flex flex-col justify-between gap-5 min-w-0 transition-all hover:-translate-y-1 active:translate-y-0.5 cursor-pointer ${
                selectedDecision === "microsave"
                  ? "border-indigo-400 border-b-indigo-600 ring-2 ring-indigo-400/20"
                  : "border-slate-200 border-b-slate-300 hover:border-indigo-300"
              }`}
            >
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <motion.div
                    animate={{ y: [0, -4, 0] }}
                    transition={{
                      duration: 2.7,
                      delay: 0.2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 border-2 border-indigo-300 flex items-center justify-center shrink-0 shadow-xs"
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
                    Define cuánto puedes apartar cada semana y guarda un plan
                    de micro-ahorro sin descontarlo de tu saldo ni de tu meta.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 space-y-1.5">
                  <div className="flex flex-col gap-1 text-left text-[11px] font-bold font-heading text-indigo-900">
                    <span>Tu ritmo, tu decisión</span>
                    <span>Sin monto sugerido</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-indigo-200/70 overflow-hidden">
                    <div className="h-full w-0 bg-indigo-500 rounded-full" />
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={itemPrice <= 0}
                className="w-full py-3 px-4 h-auto whitespace-normal text-center leading-snug rounded-xl border-2 border-b-4 border-indigo-200 border-b-indigo-300 bg-indigo-50/60 hover:bg-indigo-100/80 text-indigo-950 text-xs font-bold font-heading transition-colors cursor-pointer"
              >
                Calcular plan de ahorro
              </button>
            </motion.div>
          </div>
    </div>
  );
}
