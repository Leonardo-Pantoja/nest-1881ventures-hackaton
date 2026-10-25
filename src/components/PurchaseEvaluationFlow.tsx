"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
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
  MessageSquare,
  Send,
  Camera,
  TrendingUp,
  Target,
  Bot,
  User,
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
import type { EvaluateApiResponse, ChatTurnMessage } from "@/app/api/evaluate/route";

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

const FOLLOW_UP_SUGGESTIONS = [
  "¿Qué pasa si espero a mi próxima quincena?",
  "¿Cómo queda mi saldo en las próximas 6 semanas?",
  "¿Y si busco una alternativa a mitad de precio?",
  "¿Cómo funcionaría un plan de micro-ahorro?",
];

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
  const { profile, mode, addToWishlist } = useFinancial();

  const [selectedDecision, setSelectedDecision] = useState<
    "idle" | "wait" | "microsave" | "bought"
  >("idle");
  const [decisionXpBonus, setDecisionXpBonus] = useState<number>(50);

  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const actionLock = useRef(false);

  // Conversational Chat State (/api/evaluate + Gemini)
  const [chatMessages, setChatMessages] = useState<ChatTurnMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [chatImageBase64, setChatImageBase64] = useState<string | null>(null);
  const [chatImageMime, setChatImageMime] = useState<string | null>(null);
  const [latestEvaluationOverride, setLatestEvaluationOverride] =
    useState<EvaluateApiResponse | null>(null);
  const chatImageInputRef = useRef<HTMLInputElement | null>(null);

  const activeEvaluation = latestEvaluationOverride ?? apiEvaluation;

  // Reset override if parent props change
  useEffect(() => {
    setLatestEvaluationOverride(null);
  }, [itemName, itemPrice, apiEvaluation]);

  // Core Deterministic Financial Engine (purchaseDecision, purchaseReport, goalImpact, weeklyProjection)
  const metrics = useMemo(() => {
    const evaluationIncomplete =
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
  }, [activeEvaluation, apiEvaluationError, isLoadingApi]);

  const handleDecisionBuyToday = () => {
    if (!metrics.evaluationIncomplete && !saving && itemPrice > 0) setConfirming(true);
  };
  const saveAlternative = async (strategy: "wait" | "microsave") => {
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
          plannedWeeklySave:
            strategy === "microsave"
              ? Math.max(100, Math.ceil(itemPrice / 4))
              : undefined,
        },
        strategy === "wait" ? 50 : 100,
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
    void saveAlternative("microsave");
  };

  // Conversational Chat Handler -> calls /api/evaluate with text or image + follow-up question
  const handleSendChatMessage = async (customPrompt?: string) => {
    const questionText = (customPrompt ?? chatInput).trim();
    if ((!questionText && !chatImageBase64) || isSendingChat) return;

    playTap();
    const userDisplayMessage =
      questionText || "📸 Evaluar captura de producto subida";
    const nextHistory: ChatTurnMessage[] = [
      ...chatMessages,
      { role: "user", content: userDisplayMessage },
    ];
    setChatMessages(nextHistory);
    if (!customPrompt) setChatInput("");
    setIsSendingChat(true);

    // Check if the user typed a new product + price in the chat (e.g., "Tenis $1800")
    let targetName = itemName;
    let targetPrice = itemPrice;
    const priceMatch = questionText.replace(/,/g, "").match(/\$\s*(\d+(?:\.\d+)?)/);
    if (priceMatch && questionText.length < 45 && !questionText.includes("?")) {
      const detectedPrice = Math.round(Number(priceMatch[1]));
      const cleaned = questionText
        .replace(/\$\s*\d[\d,.]*/g, "")
        .replace(/\bevalua\b|\bevalúa\b|\bcomprar\b|\bpor\b|\bde\b|\bmxn\b/gi, "")
        .trim();
      if (detectedPrice > 0 && cleaned.length >= 2) {
        targetName = cleaned;
        targetPrice = detectedPrice;
        onUpdateEvaluatedItem?.(targetName, targetPrice);
      }
    }

    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemName: targetName || "Producto consultado",
          itemPrice: targetPrice > 0 ? targetPrice : 500,
          mode: mode === "demo" ? "demo" : "account",
          demoProfileId:
            mode === "demo"
              ? profile.id === "mateo"
                ? "mateo"
                : "carlos"
              : undefined,
          imageBase64: chatImageBase64,
          imageMimeType: chatImageMime,
          chatMessages: nextHistory,
          userQuestion: userDisplayMessage,
        }),
      });

      const data = (await res.json()) as EvaluateApiResponse & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "No se pudo consultar al copiloto.");
      }

      if (
        data.detectedItemName &&
        data.detectedItemPrice > 0 &&
        (data.detectedItemName !== itemName || data.detectedItemPrice !== itemPrice)
      ) {
        onUpdateEvaluatedItem?.(
          data.detectedItemName,
          data.detectedItemPrice,
          chatImageBase64 || thumbnailDataUrl,
          storeTag || "Escaneado con Gemini",
        );
      }

      setLatestEvaluationOverride(data);
      const replyText =
        data.chatReply ||
        data.aiExplanation ||
        `${data.headlineLine1} ${data.headlineLine2}`;

      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: replyText },
      ]);
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            err instanceof Error
              ? err.message
              : "No pude procesar esa consulta en este momento.",
        },
      ]);
    } finally {
      setIsSendingChat(false);
      setChatImageBase64(null);
      setChatImageMime(null);
    }
  };

  const handleChatImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setChatImageBase64(reader.result);
        setChatImageMime(file.type || "image/png");
      }
    };
    reader.readAsDataURL(file);
  };

  const plantSimulationState: PlantSimulationState =
    selectedDecision === "wait" || selectedDecision === "microsave"
      ? "recovered"
      : metrics.isDeficit
      ? "danger"
      : "normal";

  const initialCopilotDiagnosis = useMemo(() => {
    if (!activeEvaluation) return null;
    if (activeEvaluation.aiExplanation) return activeEvaluation.aiExplanation;
    const decisionExp =
      metrics.purchaseDecision?.explanation || activeEvaluation.headlineLine2;
    return `${activeEvaluation.headlineLine1} ${decisionExp}`;
  }, [activeEvaluation, metrics.purchaseDecision]);

  return (
    <div className="w-full max-w-4xl mx-auto">
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
                    : `$${profile.goal.currentSaved.toLocaleString()} / $${profile.goal.targetAmount.toLocaleString()} MXN`}
                </p>
                <p className="text-[11px] text-emerald-800 leading-snug">
                  {metrics.goalImpact?.delayedByWeeks === 0
                    ? `Intacto (0 semanas de retraso en "${metrics.goalImpact.goalTitle}")`
                    : `Protegido · no se retira dinero de "${profile.goal.title}"`}
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

          {/* 3. Conversational Gemini Copilot Window (/api/evaluate) */}
          <div className="rounded-3xl border-2 border-b-4 border-slate-200 bg-[#FAF8F5] p-4 sm:p-5 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-2xs">
                  <MessageSquare className="w-4 h-4" strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="text-sm font-bold font-heading text-slate-900">
                    Chat Conversacional con tu Copiloto (Gemini + Motor)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Evalúa por texto o imagen y compara escenarios antes de decidir
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold font-heading uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200">
                Ahorro fijo protegido
              </span>
            </div>

            {/* Messages Thread */}
            <div className="max-h-60 overflow-y-auto space-y-2.5 pr-1">
              {initialCopilotDiagnosis && (
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" strokeWidth={1.5} />
                  </div>
                  <div className="rounded-2xl rounded-tl-xs bg-white border border-slate-200 px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 shadow-2xs leading-relaxed">
                    <p className="font-semibold text-emerald-800 text-[11px] mb-0.5">
                      Diagnóstico del Motor + Gemini
                    </p>
                    <p>{initialCopilotDiagnosis}</p>
                  </div>
                </div>
              )}

              {chatMessages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex items-start gap-2.5 ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-4 h-4" strokeWidth={1.5} />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed shadow-2xs ${
                      msg.role === "user"
                        ? "rounded-tr-xs bg-slate-900 text-white"
                        : "rounded-tl-xs bg-white border border-slate-200 text-slate-800"
                    }`}
                  >
                    {msg.content}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-7 h-7 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-4 h-4" strokeWidth={1.5} />
                    </div>
                  )}
                </div>
              ))}

              {isSendingChat && (
                <div className="flex items-center gap-2 text-xs text-slate-500 pl-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                  <span>Analizando escenario con el motor financiero...</span>
                </div>
              )}
            </div>

            {/* Quick Follow-Up Scenario Chips */}
            <div className="flex flex-wrap gap-1.5">
              {FOLLOW_UP_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  disabled={isSendingChat}
                  onClick={() => void handleSendChatMessage(suggestion)}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 hover:border-emerald-300 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>

            {/* Attached Image Preview in Chat */}
            {chatImageBase64 && (
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                <div className="flex items-center gap-2">
                  <img
                    src={chatImageBase64}
                    alt="Adjunto"
                    className="w-8 h-8 rounded-lg object-cover border border-emerald-300"
                  />
                  <span className="font-semibold">
                    Imagen lista para evaluar con Gemini Vision
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setChatImageBase64(null);
                    setChatImageMime(null);
                  }}
                  className="p-1 text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Chat Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSendChatMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                ref={chatImageInputRef}
                type="file"
                accept="image/*"
                onChange={handleChatImageSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => chatImageInputRef.current?.click()}
                className="h-10 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 flex items-center gap-1.5 text-xs font-semibold shrink-0 cursor-pointer"
                title="Subir imagen o captura para evaluar"
              >
                <Camera className="w-4 h-4 text-emerald-600" strokeWidth={1.5} />
                <span className="hidden sm:inline">Imagen</span>
              </button>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Pregunta sobre alternativas, plazos o escribe otro precio..."
                className="flex-1 h-10 px-3.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#10B981] focus:outline-none"
              />
              <button
                type="submit"
                disabled={isSendingChat || (!chatInput.trim() && !chatImageBase64)}
                className="h-10 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-bold font-heading flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
              >
                <span>Enviar</span>
                <Send className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </form>
          </div>

          {/* 4. The 3 Collectible 3D Path Cards with 56x56 Animated Medallions */}
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
                      : activeEvaluation?.status === "precaucion"
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
                      : activeEvaluation?.status === "precaucion"
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