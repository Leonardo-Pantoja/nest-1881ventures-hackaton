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
import type { EvaluateApiResponse } from "@/app/api/evaluate/route";

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

  // Core Deterministic Financial Engine
  const metrics = useMemo(() => {
    const evaluationIncomplete =
      isLoadingApi ||
      apiEvaluationError ||
      !apiEvaluation ||
      apiEvaluation?.status === "datos_incompletos" ||
      apiEvaluation?.status === "error_procesamiento" ||
      apiEvaluation.safeToSpend === null || apiEvaluation.remainingAfterBuyToday === null;
    const safeToSpend =
      evaluationIncomplete ? 0 : (apiEvaluation?.safeToSpend ?? 0);
    const netAfterPurchase =
      evaluationIncomplete
        ? 0
        : (apiEvaluation?.remainingAfterBuyToday ?? 0);
    const isDeficit =
      !evaluationIncomplete &&
      apiEvaluation?.status === "excede_el_margen";
    const missingLiquidity =
      isDeficit ? (apiEvaluation?.exceedsBy ?? 0) : 0;

    return {
      safeToSpend,
      evaluationIncomplete,
      netAfterPurchase,
      isDeficit,
      missingLiquidity,
    };
  }, [apiEvaluation, apiEvaluationError, isLoadingApi]);

  const handleDecisionBuyToday = () => {
    if (!metrics.evaluationIncomplete && !saving && itemPrice > 0) setConfirming(true);
  };
  const saveAlternative = async (strategy: "wait" | "microsave") => {
    if (actionLock.current || itemPrice <= 0 || !itemName.trim()) return;
    actionLock.current = true;
    setSaving(true);
    setActionError(null);
    try {
      const xp = await addToWishlist({ name: itemName, price: itemPrice, cooldownDays: profile.nextPaydayDays, strategy }, strategy === "wait" ? 50 : 100);
      setDecisionXpBonus(xp);
      setSelectedDecision(strategy);
      playCoin(); triggerConfettiBurst();
      onActionCompleted?.("Guardado en Retos y Metas. No se descontó dinero de tu saldo.");
    } catch (error) { setActionError(error instanceof Error ? error.message : "No se pudo guardar la decisión."); }
    finally { actionLock.current = false; setSaving(false); }
  };
  const handleDecisionWaitPayroll = () => { void saveAlternative("wait"); };
  const handleDecisionMicroSave = () => { void saveAlternative("microsave"); };

  const plantSimulationState: PlantSimulationState =
    selectedDecision === "wait" || selectedDecision === "microsave"
      ? "recovered"
      : metrics.isDeficit
      ? "danger"
      : "normal";

  return (
    <div className="w-full max-w-4xl mx-auto">
      {confirming && <PurchaseConfirmationModal itemName={itemName} itemPrice={itemPrice} evaluation={apiEvaluation} onCancel={() => setConfirming(false)} onSuccess={() => { setConfirming(false); setSelectedDecision("bought"); onActionCompleted?.("Compra registrada correctamente."); }} />}
      {actionError && <p role="alert" className="text-rose-700 p-3">{actionError}</p>}
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

        <CardContent className="p-6 sm:p-8 space-y-8">
          {/* 1. Financial Plant + 3-Segment Liquidity Breakdown */}
          <FinancialPlantWidget
            simulationState={plantSimulationState}
            compact
            allowLevelPreview={false}
            previewDamagePrice={itemPrice}
            recoveredXpBonus={decisionXpBonus}
            financialEvaluation={apiEvaluation}
          />

          {/* 2. The 3 Collectible 3D Path Cards with 56x56 Animated Medallions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Carta 1: Comprar hoy */}
            <motion.div
              onClick={handleDecisionBuyToday}
              className={`rounded-3xl bg-white border-2 border-b-4 p-6 shadow-sm flex flex-col justify-between gap-5 transition-all hover:-translate-y-1 active:translate-y-0.5 cursor-pointer ${
                selectedDecision === "bought"
                  ? "border-amber-400 border-b-amber-600 ring-2 ring-amber-400/20"
                  : "border-slate-200 border-b-slate-300 hover:border-amber-300"
              }`}
            >
              <div className="space-y-4">
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
                    {metrics.evaluationIncomplete
                      ? itemPrice <= 0
                        ? "Precio por confirmar"
                        : "Datos incompletos"
                      : metrics.isDeficit
                      ? `Te faltan $${metrics.missingLiquidity.toLocaleString()} libres`
                      : apiEvaluation?.status === "precaucion"
                      ? "Viable con precaución"
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
                      : apiEvaluation?.status === "precaucion"
                      ? `La compra cabe en el margen calculado, pero dejaría menos de la mitad del colchón de seguridad. Esta simulación no retira dinero de tu meta.`
                      : `Cubres el gasto con tu dinero libre hoy; esta simulación no retira dinero de tu meta "${profile.goal.title}".`}
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-1.5">
                  <div className="flex justify-between text-[11px] font-bold font-heading text-amber-900">
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
                className="w-full h-11 rounded-xl border-2 border-b-4 border-slate-200 border-b-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold font-heading transition-colors cursor-pointer"
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
              className={`rounded-3xl bg-white border-2 border-b-4 p-6 shadow-sm flex flex-col justify-between gap-5 transition-all hover:-translate-y-1 active:translate-y-0.5 cursor-pointer ${
                selectedDecision === "wait"
                  ? "border-[#10B981] border-b-emerald-700 ring-4 ring-emerald-500/15"
                  : "border-emerald-400 border-b-emerald-600"
              }`}
            >
              <div className="space-y-4">
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
                  <div className="flex justify-between text-[11px] font-bold font-heading text-emerald-900">
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
                className="w-full h-11 rounded-xl bg-[#10B981] hover:bg-emerald-600 border-2 border-emerald-600 border-b-4 border-b-emerald-800 text-white text-xs font-bold font-heading shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
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
              className={`rounded-3xl bg-white border-2 border-b-4 p-6 shadow-sm flex flex-col justify-between gap-5 transition-all hover:-translate-y-1 active:translate-y-0.5 cursor-pointer ${
                selectedDecision === "microsave"
                  ? "border-indigo-400 border-b-indigo-600 ring-2 ring-indigo-400/20"
                  : "border-slate-200 border-b-slate-300 hover:border-indigo-300"
              }`}
            >
              <div className="space-y-4">
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
                    Define cuánto puedes apartar cada semana y guarda un plan
                    de micro-ahorro sin descontarlo de tu saldo ni de tu meta.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 space-y-1.5">
                  <div className="flex justify-between text-[11px] font-bold font-heading text-indigo-900">
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
                className="w-full h-11 rounded-xl border-2 border-b-4 border-indigo-200 border-b-indigo-300 bg-indigo-50/60 hover:bg-indigo-100/80 text-indigo-950 text-xs font-bold font-heading transition-colors cursor-pointer"
              >
                Crear plan de micro-ahorro (+100 XP)
              </button>
            </motion.div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
