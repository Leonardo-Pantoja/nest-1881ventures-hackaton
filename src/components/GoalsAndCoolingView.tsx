"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Snowflake,
  Clock,
  Target,
  Trophy,
  Plus,
  Trash2,
  CheckCircle2,
  Sparkles,
  PiggyBank,
  ShoppingBag,
  XCircle,
  Edit3,
  Layers,
  Calendar,
  ArrowRight,
  ShieldCheck,
  Coins,
} from "lucide-react";
import {
  useFinancial,
  type WishlistItem,
  type GoalSubStage,
  type FinancialGoal,
} from "@/context/FinancialContext";
import { calculateGoalImpact } from "@/lib/onboarding/goalImpact";
import { buildPurchaseReport } from "@/lib/onboarding/purchaseReport";
import {
  playTap,
  playCoin,
  playLevelUp,
  triggerConfettiBurst,
} from "@/lib/soundEffects";

interface GoalsAndCoolingViewProps {
  onShowToast: (message: string) => void;
  totalProtectedMoney: number;
  goalPct: number;
  unlockedMedals: {
    id: string;
    emoji: string;
    title: string;
    desc: string;
    unlocked: boolean;
  }[];
}

type CoolingFilterTab = "all" | "postponed" | "microsave" | "purchased" | "discarded";

export default function GoalsAndCoolingView({
  onShowToast,
  totalProtectedMoney,
  unlockedMedals,
}: GoalsAndCoolingViewProps) {
  const {
    profile,
    financialProfile,
    contributeToWishlistItem,
    contributeToGoal,
    updateWishlistDecisionStatus,
    saveGoalWithSubGoals,
    selectActiveGoal,
  } = useFinancial();

  const [activeFilter, setActiveFilter] = useState<CoolingFilterTab>("all");
  const [contributionInputs, setContributionInputs] = useState<
    Record<string, string>
  >({});
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  // Quick "Abonar ahorro" panel state
  const QUICK_AMOUNTS = [100, 250, 500, 1000];
  const [contribOpen, setContribOpen] = useState(false);
  const [contribAmount, setContribAmount] = useState("");
  const [contribDeduct, setContribDeduct] = useState(true);
  const [contribSubGoalId, setContribSubGoalId] = useState("");
  const [contribWeekly, setContribWeekly] = useState("");
  const [contribLocation, setContribLocation] = useState<
    "incluido" | "separado"
  >("separado");
  const [isContributing, setIsContributing] = useState(false);

  // Goal & Sub-Goals Editor State
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [isCreatingNewGoal, setIsCreatingNewGoal] = useState(false);
  const [goalTitle, setGoalTitle] = useState(profile.goal.title);
  const [goalTarget, setGoalTarget] = useState(
    String(profile.goal.targetAmount || 15000),
  );
  const [goalSaved, setGoalSaved] = useState(
    String(profile.goal.currentSaved || 0),
  );
  const [goalWeekly, setGoalWeekly] = useState(
    String(profile.goal.weeklyContribution || 500),
  );
  const [goalLocation, setGoalLocation] = useState<
    "incluido" | "separado" | "desconocido"
  >(profile.goal.savingsLocation || "separado");
  const [goalDeadline, setGoalDeadline] = useState(
    profile.goal.deadlineLabel || "",
  );
  const [subGoalsDraft, setSubGoalsDraft] = useState<GoalSubStage[]>(
    profile.goal.subGoals ?? [],
  );
  const [newSubTitle, setNewSubTitle] = useState("");
  const [newSubTarget, setNewSubTarget] = useState("");
  const [isSavingGoal, setIsSavingGoal] = useState(false);

  const openGoalEditor = (createNew = false, goalToEdit?: FinancialGoal) => {
    playTap();
    const g = createNew
      ? {
          id: undefined,
          title: "",
          targetAmount: 50000,
          currentSaved: 0,
          weeklyContribution: 1000,
          deadlineLabel: "",
          savingsLocation: "separado" as const,
          subGoals: [
            { id: `sub-${Date.now()}-1`, title: "Vuelos", targetAmount: 12000 },
            {
              id: `sub-${Date.now()}-2`,
              title: "Hospedaje",
              targetAmount: 18000,
            },
            {
              id: `sub-${Date.now()}-3`,
              title: "Viáticos",
              targetAmount: 20000,
            },
          ],
        }
      : goalToEdit ?? profile.goal;

    setIsCreatingNewGoal(createNew);
    setGoalTitle(g.title);
    setGoalTarget(String(g.targetAmount));
    setGoalSaved(String(g.currentSaved));
    setGoalWeekly(String(g.weeklyContribution));
    setGoalLocation(g.savingsLocation || "separado");
    setGoalDeadline(g.deadlineLabel || "");
    setSubGoalsDraft(g.subGoals ? [...g.subGoals] : []);
    setIsEditingGoal(true);
  };

  // Enrich each wishlist item with purchaseReport.ts metrics if missing
  const enrichedWishlist = useMemo(() => {
    const list = profile.wishlist ?? [];
    return list.map((item) => {
      const normalizedDecision =
        item.decision ??
        (item.strategy === "microsave" ? "microsave" : "postponed");

      let availableBefore = item.availableBefore;
      let availableAfter = item.availableAfter;
      let explanation = item.explanation;

      if (
        financialProfile &&
        item.price > 0 &&
        (availableBefore === undefined ||
          availableAfter === undefined ||
          !explanation)
      ) {
        try {
          const report = buildPurchaseReport(financialProfile, item.price);
          if (availableBefore === undefined) {
            availableBefore =
              report.purchase.safeToSpend ?? profile.currentBalance;
          }
          if (availableAfter === undefined) {
            availableAfter =
              report.purchase.remainingSafeToSpend ??
              Math.max(0, (availableBefore ?? 0) - item.price);
          }
          if (!explanation) {
            explanation = report.purchase.explanation;
          }
        } catch {
          // fallback if engine throws
        }
      }

      const fallbackHoldUntil =
        item.holdUntil ||
        (() => {
          const d = new Date(item.savedAt || Date.now());
          d.setDate(d.getDate() + (item.cooldownDays ?? 6));
          return d.toISOString().slice(0, 10);
        })();

      return {
        ...item,
        decision: normalizedDecision,
        holdUntil: fallbackHoldUntil,
        availableBefore: availableBefore ?? profile.currentBalance,
        availableAfter:
          availableAfter ??
          Math.max(0, profile.currentBalance - item.price),
        awardedXp:
          item.awardedXp ?? (item.strategy === "microsave" ? 100 : 50),
        savedAmount: item.savedAmount ?? 0,
        explanation:
          explanation ||
          (item.strategy === "microsave"
            ? `Plan de micro-ahorro fijo de $${(item.plannedWeeklySave ?? 400).toLocaleString()} MXN/semana para comprar sin descapitalizarte.`
            : `En espera activa por ${item.cooldownDays ?? 6} días para proteger tus compromisos fijos antes de decidir.`),
      };
    });
  }, [profile.wishlist, profile.currentBalance, financialProfile]);

  const filteredWishlist = useMemo(() => {
    if (activeFilter === "all") return enrichedWishlist;
    return enrichedWishlist.filter((item) => item.decision === activeFilter);
  }, [enrichedWishlist, activeFilter]);

  const discardedSavingsTotal = useMemo(() => {
    return enrichedWishlist
      .filter((item) => item.decision === "discarded")
      .reduce((acc, item) => acc + item.price, 0);
  }, [enrichedWishlist]);

  // Calculate Goal Impact using src/lib/onboarding/goalImpact.ts
  const activeGoalImpact = useMemo(() => {
    try {
      return calculateGoalImpact(
        {
          id: profile.goal.id || "goal-active",
          title: profile.goal.title || "Meta principal",
          category: "ahorro",
          targetAmount: Math.max(0, Number(profile.goal.targetAmount) || 0),
          currentSaved: Math.max(0, Number(profile.goal.currentSaved) || 0),
          weeklyContribution: Math.max(
            0,
            Number(profile.goal.weeklyContribution) || 0,
          ),
          savingsLocation: profile.goal.savingsLocation || "separado",
        },
        0,
      );
    } catch {
      const target = Math.max(0, Number(profile.goal.targetAmount) || 0);
      const saved = Math.max(0, Number(profile.goal.currentSaved) || 0);
      const rem = Math.max(0, target - saved);
      const weekly = Math.max(0, Number(profile.goal.weeklyContribution) || 0);
      return {
        goalTitle: profile.goal.title,
        savedBefore: saved,
        savedAfter: saved,
        remainingBefore: rem,
        remainingAfter: rem,
        weeksBefore: weekly > 0 ? Math.ceil(rem / weekly) : null,
        weeksAfter: weekly > 0 ? Math.ceil(rem / weekly) : null,
        delayedByWeeks: 0,
      };
    }
  }, [profile.goal]);

  // Project Sub-goals Waterfall Progress calculation
  const subGoalsWithProgress = useMemo(() => {
    const subs = profile.goal.subGoals ?? [];
    let remainingPool = Math.max(0, Number(profile.goal.currentSaved) || 0);
    const weekly = Math.max(0, Number(profile.goal.weeklyContribution) || 0);

    const computed = [];
    for (const stage of subs) {
      const target = Math.max(1, Number(stage.targetAmount) || 0);
      const allocated =
        stage.savedAmount !== undefined
          ? Math.min(target, Math.max(0, stage.savedAmount))
          : Math.min(target, remainingPool);
      if (stage.savedAmount === undefined) {
        remainingPool = Math.max(0, remainingPool - allocated);
      }
      const missing = Math.max(0, target - allocated);
      const pct = Math.min(100, Math.round((allocated / target) * 100));
      const weeksNeeded =
        missing <= 0 ? 0 : weekly > 0 ? Math.ceil(missing / weekly) : null;

      computed.push({ ...stage, allocated, missing, pct, weeksNeeded });
    }
    return computed;
  }, [profile.goal]);

  const openContribution = (subGoalId = "") => {
    playTap();
    setContribSubGoalId(subGoalId);
    setContribAmount("");
    setContribDeduct(true);
    setContribWeekly("");
    setContribLocation(
      profile.goal.savingsLocation === "incluido" ? "incluido" : "separado",
    );
    setContribOpen(true);
  };

  const runGoalContribution = async (
    amount: number,
    deduct: boolean,
    subGoalId?: string,
    options?: Parameters<typeof contributeToGoal>[4],
  ) => {
    const goalId = profile.goal.id;
    if (!goalId) {
      onShowToast("No se encontró la meta activa.");
      return;
    }
    setIsContributing(true);
    try {
      const result = await contributeToGoal(
        goalId,
        amount,
        deduct,
        subGoalId || undefined,
        options,
      );
      playCoin();
      if (result.completedGoal || result.completedSubGoal) {
        playLevelUp();
        triggerConfettiBurst();
      }
      onShowToast(
        result.completedGoal
          ? `🎉 ¡Completaste tu meta "${profile.goal.title}"! (+25 XP)`
          : result.completedSubGoal
            ? `🎉 ¡Etapa completada! Abonaste $${amount.toLocaleString()} MXN (+25 XP)`
            : `¡Abonaste $${amount.toLocaleString()} MXN a "${profile.goal.title}"! (+25 XP)`,
      );
      setContribOpen(false);
    } catch (err) {
      onShowToast(
        err instanceof Error ? err.message : "No se pudo registrar el abono.",
      );
    } finally {
      setIsContributing(false);
    }
  };

  const handleSubmitContribution = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(Number(contribAmount).toFixed(2));
    if (!Number.isFinite(amount) || amount <= 0) {
      onShowToast("Ingresa un monto de abono válido.");
      return;
    }
    const weeklyNum = Number(contribWeekly);
    const options =
      profile.goal.weeklyContribution === 0 && weeklyNum > 0
        ? { weeklyContribution: weeklyNum, savingsLocation: contribLocation }
        : undefined;
    await runGoalContribution(amount, contribDeduct, contribSubGoalId, options);
  };

  const handleContribute = async (item: WishlistItem) => {
    const rawVal =
      contributionInputs[item.id] ?? String(item.plannedWeeklySave ?? 400);
    const amount = Number(rawVal);
    if (!Number.isFinite(amount) || amount <= 0) {
      onShowToast("Ingresa un monto válido para abonar a tu micro-ahorro.");
      return;
    }
    setBusyItemId(item.id);
    try {
      await contributeToWishlistItem(item.id, amount);
      playCoin();
      setContributionInputs((prev) => ({ ...prev, [item.id]: "" }));
      onShowToast(
        `¡Abonaste $${Number(amount.toFixed(2)).toLocaleString()} MXN al plan de "${item.name}"! (+25 XP)`,
      );
    } catch (err) {
      onShowToast(
        err instanceof Error ? err.message : "Error al registrar abono",
      );
    } finally {
      setBusyItemId(null);
    }
  };

  const handleDecisionChange = async (
    item: WishlistItem,
    decisionStatus: "purchased" | "discarded",
  ) => {
    setBusyItemId(item.id);
    try {
      await updateWishlistDecisionStatus(item.id, decisionStatus);
      if (decisionStatus === "discarded") {
        playLevelUp();
        triggerConfettiBurst();
        onShowToast(
          `🎉 ¡Excelente decisión! Descartaste "${item.name}" y salvaste $${item.price.toLocaleString()} MXN (+75 XP)`,
        );
      } else {
        playCoin();
        onShowToast(
          `Compra de "${item.name}" autorizada y registrada en tus movimientos.`,
        );
      }
    } catch (err) {
      onShowToast(
        err instanceof Error ? err.message : "No se pudo actualizar la compra",
      );
    } finally {
      setBusyItemId(null);
    }
  };

  const handleAddSubGoalDraft = () => {
    const cleanTitle = newSubTitle.trim();
    const targetNum = Number(newSubTarget);
    if (!cleanTitle || !Number.isFinite(targetNum) || targetNum <= 0) {
      onShowToast("Ingresa nombre y monto válido para la sub-meta.");
      return;
    }
    playTap();
    const nextSubs = [
      ...subGoalsDraft,
      {
        id: `sub-${Date.now()}`,
        title: cleanTitle,
        targetAmount: Number(targetNum.toFixed(2)),
      },
    ];
    setSubGoalsDraft(nextSubs);
    const totalFromSubs = nextSubs.reduce((acc, s) => acc + s.targetAmount, 0);
    if (totalFromSubs > Number(goalTarget || 0)) {
      setGoalTarget(String(totalFromSubs));
    }
    setNewSubTitle("");
    setNewSubTarget("");
  };

  const handleRemoveSubGoalDraft = (id: string) => {
    playTap();
    setSubGoalsDraft((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetNum = Number(goalTarget);
    const savedNum = Number(goalSaved);
    const weeklyNum = Number(goalWeekly);

    if (!goalTitle.trim() || !Number.isFinite(targetNum) || targetNum <= 0) {
      onShowToast("Ingresa un título y monto objetivo mayor a $0.");
      return;
    }

    setIsSavingGoal(true);
    try {
      await saveGoalWithSubGoals({
        id: isCreatingNewGoal ? undefined : profile.goal.id,
        title: goalTitle.trim(),
        targetAmount: Number(targetNum.toFixed(2)),
        currentSaved: Number(Math.max(0, savedNum || 0).toFixed(2)),
        weeklyContribution: Number(Math.max(0, weeklyNum || 0).toFixed(2)),
        savingsLocation: goalLocation,
        deadlineLabel: goalDeadline.trim() || "Meta activa",
        subGoals: subGoalsDraft,
      });
      playLevelUp();
      setIsEditingGoal(false);
      onShowToast(
        isCreatingNewGoal
          ? `¡Nueva meta "${goalTitle.trim()}" creada con éxito!`
          : `¡Meta "${goalTitle.trim()}" y sus etapas actualizadas!`,
      );
    } catch (err) {
      onShowToast(
        err instanceof Error ? err.message : "Error al guardar la meta",
      );
    } finally {
      setIsSavingGoal(false);
    }
  };

  const globalPct =
    profile.goal.targetAmount > 0
      ? Math.min(
          100,
          Math.round(
            (profile.goal.currentSaved / profile.goal.targetAmount) * 100,
          ),
        )
      : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* =====================================================================
          1. HERO BANNER: DINERO PROTEGIDO & TOTAL SALVADO EN DESCARTADAS
         ===================================================================== */}
      <div className="bg-gradient-to-br from-emerald-50 via-white to-sky-50/70 rounded-3xl border-2 border-b-4 border-emerald-300 border-b-emerald-500 shadow-sm p-6 sm:p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-heading bg-white text-emerald-800 border border-emerald-200 shadow-2xs">
            <Snowflake className="w-3.5 h-3.5 text-sky-500" strokeWidth={1.5} />
            El Congelador de Compras Impulsivas 🧊
          </span>
          <h2 className="text-xl sm:text-2xl font-bold font-heading text-slate-900">
            Dinero Protegido de Compras Impulsivas
          </h2>
          <div className="flex flex-wrap items-baseline gap-4">
            <p className="text-3xl sm:text-4xl font-bold font-heading text-emerald-600 tracking-tight">
              ${totalProtectedMoney.toLocaleString()}{" "}
              <span className="text-base font-semibold text-slate-500">MXN</span>
            </p>
            {discardedSavingsTotal > 0 && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold font-heading bg-emerald-100 text-emerald-900 border border-emerald-300">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                ¡${discardedSavingsTotal.toLocaleString()} MXN salvados en compras
                descartadas!
              </span>
            )}
          </div>
        </div>

        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={() => {
            playLevelUp();
            triggerConfettiBurst();
          }}
          className="px-5 py-3 rounded-2xl bg-[#10B981] hover:bg-emerald-600 text-white text-xs sm:text-sm font-bold font-heading border-2 border-emerald-600 border-b-4 border-b-emerald-800 shadow-sm cursor-pointer shrink-0"
        >
          Celebrar logro 🎉
        </motion.button>
      </div>

      {/* =====================================================================
          2. COMPRAS EN ENFRIAMIENTO REDISEÑADAS (wishlist_items + purchase_analyses)
         ===================================================================== */}
      <section className="bg-white rounded-3xl border-2 border-b-4 border-slate-200 shadow-sm p-6 sm:p-8 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-center shrink-0">
              <Snowflake className="w-5 h-5 text-sky-600" strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold font-heading text-slate-900">
                Compras en Enfriamiento y Planes Activos
              </h3>
              <p className="text-xs sm:text-sm text-slate-500">
                Conectado a tu reporte financiero y a tus metas
                de ahorro fijo
              </p>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: "all", label: `Todas (${enrichedWishlist.length})` },
                { id: "postponed", label: "🧊 En Espera" },
                { id: "microsave", label: "🐷 Micro-ahorro" },
                { id: "discarded", label: "✅ Descartadas" },
                { id: "purchased", label: "🛍️ Compradas" },
              ] as { id: CoolingFilterTab; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  playTap();
                  setActiveFilter(tab.id);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold font-heading border transition-all cursor-pointer ${
                  activeFilter === tab.id
                    ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {filteredWishlist.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {filteredWishlist.map((item) => {
              const decision = item.decision ?? "postponed";
              const isBusy = busyItemId === item.id;

              // CARD VARIANT 1: Posponer / En Espera (strategy: 'wait' / decision: 'postponed')
              // Ice-blue / emerald tones
              if (decision === "postponed") {
                const daysLeft = item.cooldownDays ?? 6;
                const progressPct = Math.min(
                  100,
                  Math.max(15, Math.round(((14 - Math.min(14, daysLeft)) / 14) * 100)),
                );

                return (
                  <div
                    key={item.id}
                    className="rounded-3xl border-2 border-b-4 border-sky-300 border-b-emerald-500 bg-gradient-to-br from-sky-50/90 via-white to-emerald-50/70 p-5 flex flex-col justify-between gap-4 shadow-2xs"
                  >
                    <div className="space-y-3">
                      {/* Header Badges */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold font-heading bg-sky-100 text-sky-900 border border-sky-300">
                              <Snowflake className="w-3 h-3 text-sky-600" />
                              Posponer · En Espera
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold font-heading bg-emerald-100 text-emerald-800 border border-emerald-300">
                              +{item.awardedXp ?? 50} XP ganados
                            </span>
                          </div>
                          <h4 className="text-base sm:text-lg font-bold font-heading text-slate-900">
                            {item.name}
                          </h4>
                        </div>

                        <span className="text-sm sm:text-base font-bold font-heading text-sky-950 bg-white border-2 border-sky-200 px-3 py-1 rounded-2xl shrink-0 shadow-2xs">
                          ${item.price.toLocaleString()} MXN
                        </span>
                      </div>

                      {/* Unlock Date & Countdown */}
                      <div className="p-3 rounded-2xl bg-white/90 border border-sky-200/80 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold font-heading">
                          <span className="flex items-center gap-1.5 text-sky-900">
                            <Clock className="w-3.5 h-3.5 text-sky-600" />
                            {daysLeft > 0
                              ? `Faltan ${daysLeft} días para desbloqueo`
                              : "¡Listo para reevaluar hoy!"}
                          </span>
                          <span className="text-[11px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                            Desbloqueo: {item.holdUntil}
                          </span>
                        </div>
                        <div className="w-full h-2.5 rounded-full bg-sky-100 overflow-hidden p-0.5 border border-sky-200">
                          <div
                            style={{ width: `${progressPct}%` }}
                            className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-500 transition-all"
                          />
                        </div>
                      </div>

                      {/* Available Before vs After (from purchase_analyses / purchaseReport.ts) */}
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="p-2.5 rounded-2xl bg-white/80 border border-slate-200/90">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            Disponible Antes
                          </span>
                          <span className="text-sm font-bold font-heading text-slate-900">
                            ${(item.availableBefore ?? 0).toLocaleString()} MXN
                          </span>
                        </div>
                        <div className="p-2.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/90">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                            Disponible Después
                          </span>
                          <span className="text-sm font-bold font-heading text-emerald-900">
                            ${(item.availableAfter ?? 0).toLocaleString()} MXN
                          </span>
                        </div>
                      </div>

                      {/* Explanation Summary */}
                      <p className="text-xs text-slate-600 leading-relaxed bg-white/70 p-2.5 rounded-xl border border-sky-100">
                        {item.explanation}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-sky-200/60">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleDecisionChange(item, "discarded")}
                        className="flex-1 h-10 px-3 rounded-xl bg-[#10B981] hover:bg-emerald-600 text-white text-xs font-bold font-heading border-b-4 border-emerald-700 flex items-center justify-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
                      >
                        <ShieldCheck className="w-4 h-4 shrink-0" />
                        <span>Descartar y Salvar ${item.price.toLocaleString()}</span>
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleDecisionChange(item, "purchased")}
                        className="h-10 px-3 rounded-xl bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-900 border-2 border-slate-200 hover:border-amber-300 text-xs font-bold font-heading flex items-center justify-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
                      >
                        <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                        <span>Autorizar compra</span>
                      </button>
                    </div>
                  </div>
                );
              }

              // CARD VARIANT 2: Plan Micro-ahorro (strategy: 'microsave')
              // Violet / gold tones connected to saved_amount and goals.current_saved
              if (decision === "microsave") {
                const savedForItem = Math.min(
                  item.price,
                  Math.max(0, item.savedAmount ?? 0),
                );
                const missingForItem = Math.max(0, item.price - savedForItem);
                const itemPct =
                  item.price > 0
                    ? Math.min(100, Math.round((savedForItem / item.price) * 100))
                    : 0;
                const weeklySave = Math.max(1, item.plannedWeeklySave ?? 400);
                const weeksLeft =
                  missingForItem <= 0
                    ? 0
                    : Math.ceil(missingForItem / weeklySave);

                return (
                  <div
                    key={item.id}
                    className="rounded-3xl border-2 border-b-4 border-violet-300 border-b-amber-500 bg-gradient-to-br from-violet-50/90 via-white to-amber-50/70 p-5 flex flex-col justify-between gap-4 shadow-2xs"
                  >
                    <div className="space-y-3">
                      {/* Header Badges */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold font-heading bg-violet-100 text-violet-900 border border-violet-300">
                              <PiggyBank className="w-3 h-3 text-violet-700" />
                              Plan Micro-ahorro
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold font-heading bg-amber-100 text-amber-900 border border-amber-300">
                              <Coins className="w-3 h-3 text-amber-600" />$
                              {weeklySave.toLocaleString()}/sem fijo · +
                              {item.awardedXp ?? 100} XP
                            </span>
                          </div>
                          <h4 className="text-base sm:text-lg font-bold font-heading text-slate-900">
                            {item.name}
                          </h4>
                        </div>

                        <span className="text-sm sm:text-base font-bold font-heading text-violet-950 bg-white border-2 border-violet-200 px-3 py-1 rounded-2xl shrink-0 shadow-2xs">
                          ${item.price.toLocaleString()} MXN
                        </span>
                      </div>

                      {/* Exact Progress Bar of Saved vs Missing */}
                      <div className="p-3.5 rounded-2xl bg-white/95 border border-violet-200 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold font-heading">
                          <span className="text-violet-900">
                            Ahorrado en artículo:{" "}
                            <strong className="text-emerald-700">
                              ${savedForItem.toLocaleString()} MXN
                            </strong>{" "}
                            ({itemPct}%)
                          </span>
                          <span className="text-amber-800">
                            {missingForItem > 0
                              ? `Faltan $${missingForItem.toLocaleString()} MXN`
                              : "¡Meta cubierta al 100%!"}
                          </span>
                        </div>

                        <div className="w-full h-3 rounded-full bg-violet-100 overflow-hidden p-0.5 border border-violet-200">
                          <div
                            style={{ width: `${itemPct}%` }}
                            className="h-full rounded-full bg-gradient-to-r from-violet-500 via-purple-500 to-amber-400 transition-all"
                          />
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 font-semibold pt-0.5">
                          <span>
                            {weeksLeft === 0
                              ? "Listo para comprar sin afectar tu liquidez"
                              : `${weeksLeft} semana(s) restantes con ahorro fijo de $${weeklySave.toLocaleString()}/sem`}
                          </span>
                          <span className="text-violet-800 bg-violet-50 px-2 py-0.5 rounded-md border border-violet-200">
                            Meta global intacta: $
                            {profile.goal.currentSaved.toLocaleString()} MXN
                          </span>
                        </div>
                      </div>

                      {/* Contribute Input Row */}
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                            $
                          </span>
                          <input
                            type="number"
                            min="1"
                            step="0.01"
                            placeholder={`Abonar ej. ${weeklySave}`}
                            value={contributionInputs[item.id] ?? ""}
                            onChange={(e) =>
                              setContributionInputs((prev) => ({
                                ...prev,
                                [item.id]: e.target.value,
                              }))
                            }
                            className="w-full h-9 pl-6 pr-3 rounded-xl border border-violet-200 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:border-violet-500"
                          />
                        </div>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleContribute(item)}
                          className="h-9 px-3.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold font-heading border-b-2 border-violet-900 cursor-pointer shrink-0 transition-all disabled:opacity-50"
                        >
                          ➕ Abonar a este artículo
                        </button>
                      </div>
                    </div>

                    {/* Bottom Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-violet-200/60">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleDecisionChange(item, "purchased")}
                        className="flex-1 h-10 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold font-heading border-b-4 border-amber-700 flex items-center justify-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
                      >
                        <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {missingForItem <= 0
                            ? "¡Autorizar compra completada!"
                            : "Autorizar compra ahora"}
                        </span>
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleDecisionChange(item, "discarded")}
                        className="h-10 px-3 rounded-xl bg-white hover:bg-emerald-50 text-emerald-800 border-2 border-emerald-200 text-xs font-bold font-heading flex items-center justify-center gap-1 cursor-pointer transition-all disabled:opacity-50"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                        <span>Descartar</span>
                      </button>
                    </div>
                  </div>
                );
              }

              // CARD VARIANT 3: Descartado (decision: 'discarded')
              // Emerald / Green success highlighting total money saved
              if (decision === "discarded") {
                return (
                  <div
                    key={item.id}
                    className="rounded-3xl border-2 border-b-4 border-emerald-400 border-b-emerald-600 bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/80 p-5 flex flex-col justify-between gap-4 shadow-2xs"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold font-heading bg-emerald-500 text-white shadow-2xs">
                            <CheckCircle2 className="w-3 h-3" />
                            Compra Descartada · ¡Victoria Financiera!
                          </span>
                          <h4 className="text-base sm:text-lg font-bold font-heading text-slate-900 line-through decoration-emerald-500/60">
                            {item.name}
                          </h4>
                        </div>
                        <span className="text-xs font-bold font-heading text-emerald-900 bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-xl shrink-0">
                          +{item.awardedXp ?? 125} XP
                        </span>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-300 flex items-center justify-between">
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 block">
                            Dinero Total Salvado
                          </span>
                          <span className="text-xl font-bold font-heading text-emerald-700">
                            ¡Salvaste ${item.price.toLocaleString()} MXN!
                          </span>
                        </div>
                        <ShieldCheck className="w-8 h-8 text-emerald-600 shrink-0" />
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed">
                        {item.explanation ||
                          "Decidiste no realizar esta compra tras el periodo de enfriamiento. Este monto se quedó íntegro en tu liquidez."}
                      </p>
                    </div>
                  </div>
                );
              }

              // CARD VARIANT 4: Comprado (decision: 'purchased')
              // Amber tones for completed purchases
              return (
                <div
                  key={item.id}
                  className="rounded-3xl border-2 border-b-4 border-amber-300 border-b-amber-500 bg-gradient-to-br from-amber-50/90 via-white to-orange-50/70 p-5 flex flex-col justify-between gap-4 shadow-2xs"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold font-heading bg-amber-100 text-amber-900 border border-amber-300">
                          <ShoppingBag className="w-3 h-3 text-amber-700" />
                          Compra Autorizada y Completada
                        </span>
                        <h4 className="text-base sm:text-lg font-bold font-heading text-slate-900">
                          {item.name}
                        </h4>
                      </div>
                      <span className="text-sm sm:text-base font-bold font-heading text-amber-950 bg-white border-2 border-amber-200 px-3 py-1 rounded-2xl shrink-0">
                        ${item.price.toLocaleString()} MXN
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="p-2.5 rounded-2xl bg-white/80 border border-amber-200">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Disponible Antes
                        </span>
                        <span className="text-sm font-bold font-heading text-slate-800">
                          ${(item.availableBefore ?? 0).toLocaleString()} MXN
                        </span>
                      </div>
                      <div className="p-2.5 rounded-2xl bg-amber-100/60 border border-amber-300">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
                          Disponible Después
                        </span>
                        <span className="text-sm font-bold font-heading text-amber-950">
                          ${(item.availableAfter ?? 0).toLocaleString()} MXN
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      {item.explanation ||
                        "Compra registrada tras evaluación en el simulador."}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 rounded-2xl border border-dashed border-slate-300 text-center space-y-2">
            <p className="text-sm font-bold font-heading text-slate-700">
              No hay compras en esta categoría por ahora
            </p>
            <p className="text-xs text-slate-500">
              Cuando simules un producto y elijas “Esperar” o “Plan de
              Micro-ahorro”, verás aquí su tarjeta interactiva.
            </p>
          </div>
        )}
      </section>

      {/* =====================================================================
          3. METAS DESGLOSABLES CON SUB-METAS (ESTILO PROYECTO, public.goals + goalImpact.ts)
         ===================================================================== */}
      <section className="bg-white rounded-3xl border-2 border-b-4 border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5 text-emerald-600" strokeWidth={1.5} />
            </div>
            <div>
              <span className="text-xs font-bold font-heading uppercase tracking-wider text-emerald-700 block">
                Metas por Proyecto y Etapas
              </span>
              <h3 className="text-lg sm:text-xl font-bold font-heading text-slate-900">
                {profile.goal.title}
              </h3>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Goal Switcher if multiple goals exist */}
            {profile.goalsList && profile.goalsList.length > 1 && (
              <select
                value={profile.goal.id || ""}
                onChange={(e) => {
                  playTap();
                  selectActiveGoal(e.target.value);
                }}
                aria-label="Cambiar meta activa"
                className="h-10 px-3 rounded-xl border-2 border-slate-200 bg-slate-50 text-xs font-bold font-heading text-slate-800 cursor-pointer"
              >
                {profile.goalsList.map((g) => (
                  <option key={g.id || g.title} value={g.id}>
                    🎯 {g.title} (${g.targetAmount.toLocaleString()})
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={() => openGoalEditor(false)}
              className="h-10 px-3.5 rounded-xl border-2 border-slate-200 hover:border-emerald-300 bg-white hover:bg-emerald-50/50 text-xs font-bold font-heading text-slate-800 flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Editar meta y sub-metas</span>
            </button>

            <button
              type="button"
              onClick={() => openGoalEditor(true)}
              className="h-10 px-3.5 rounded-xl bg-[#10B981] hover:bg-emerald-600 text-white text-xs font-bold font-heading border-b-4 border-emerald-700 flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nueva Meta Proyecto</span>
            </button>
          </div>
        </div>

        {/* Global Goal Summary Metrics from calculateGoalImpact */}
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-white border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 block">
                Ahorrado actual
              </span>
              <span className="text-lg font-bold font-heading text-emerald-600">
                ${activeGoalImpact.savedBefore.toLocaleString()} MXN
              </span>
            </div>

            <div className="p-3 rounded-xl bg-white border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 block">
                Falta para la Meta Global
              </span>
              <span className="text-lg font-bold font-heading text-slate-900">
                ${activeGoalImpact.remainingBefore.toLocaleString()} MXN
              </span>
            </div>

            <div className="p-3 rounded-xl bg-white border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 block">
                Ahorro Semanal Fijo
              </span>
              <span className="text-lg font-bold font-heading text-indigo-600">
                ${profile.goal.weeklyContribution.toLocaleString()} / sem
              </span>
            </div>

            <div className="p-3 rounded-xl bg-white border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 block">
                Tiempo estimado
              </span>
              <span className="text-lg font-bold font-heading text-amber-600">
                {activeGoalImpact.weeksBefore === null
                  ? "Sin ahorro semanal"
                  : activeGoalImpact.weeksBefore === 0
                    ? "¡Completada!"
                    : `${activeGoalImpact.weeksBefore} semanas`}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => openContribution()}
              className="h-10 px-4 rounded-xl bg-[#10B981] hover:bg-emerald-600 text-white text-xs font-bold font-heading border-b-4 border-emerald-700 flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <span>➕ Abonar ahorro</span>
            </button>
            {profile.goal.weeklyContribution > 0 && (
              <button
                type="button"
                disabled={isContributing}
                onClick={() =>
                  void runGoalContribution(
                    profile.goal.weeklyContribution,
                    true,
                  )
                }
                className="h-10 px-4 rounded-xl bg-white hover:bg-emerald-50 text-emerald-800 border-2 border-emerald-300 text-xs font-bold font-heading flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
              >
                <span>
                  ⚡ Abonar mi cuota semanal ($
                  {profile.goal.weeklyContribution.toLocaleString()})
                </span>
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold font-heading">
              <span className="text-slate-700">
                Progreso Global de {profile.goal.title} (Ubicación:{" "}
                <span className="text-emerald-700 capitalize">
                  {profile.goal.savingsLocation || "separado"}
                </span>
                )
              </span>
              <span className="text-emerald-700">
                {globalPct}% (${profile.goal.currentSaved.toLocaleString()} / $
                {profile.goal.targetAmount.toLocaleString()} MXN)
              </span>
            </div>
            <div className="h-3.5 w-full rounded-full bg-slate-200 overflow-hidden p-0.5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${globalPct}%` }}
                className="h-full rounded-full bg-gradient-to-r from-[#10B981] to-teal-500"
              />
            </div>
          </div>
        </div>

        {/* Breakdown of Sub-Goals / Project Stages */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold font-heading text-slate-800 flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-600" />
              Etapas / Sub-metas del Proyecto
            </h4>
            <span className="text-xs text-slate-500">
              {subGoalsWithProgress.length > 0
                ? `${subGoalsWithProgress.length} etapas configuradas`
                : "Divide tu meta grande en etapas alcanzables"}
            </span>
          </div>

          {subGoalsWithProgress.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {subGoalsWithProgress.map((stage, index) => (
                <div
                  key={stage.id}
                  className={`p-4 rounded-2xl border-2 border-b-4 space-y-2.5 ${
                    stage.pct >= 100
                      ? "border-emerald-300 border-b-emerald-500 bg-emerald-50/40"
                      : stage.pct > 0
                        ? "border-sky-200 border-b-sky-400 bg-sky-50/30"
                        : "border-slate-200 border-b-slate-300 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Etapa {index + 1}
                      </span>
                      <p className="text-sm font-bold font-heading text-slate-900">
                        {stage.title}
                      </p>
                    </div>
                    <span className="text-xs font-bold font-heading px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-800">
                      ${stage.targetAmount.toLocaleString()}
                    </span>
                  </div>

                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      style={{ width: `${stage.pct}%` }}
                      className={`h-full rounded-full ${
                        stage.pct >= 100 ? "bg-emerald-500" : "bg-sky-500"
                      }`}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
                    <span>
                      Cubierto:{" "}
                      <strong className="text-emerald-700">
                        ${stage.allocated.toLocaleString()}
                      </strong>
                    </span>
                    <span>
                      {stage.missing <= 0 ? (
                        <strong className="text-emerald-700">¡Cubierta! ✓</strong>
                      ) : (
                        <>Faltan ${stage.missing.toLocaleString()}</>
                      )}
                    </span>
                  </div>

                  {stage.missing > 0 && stage.weeksNeeded !== null && (
                    <p className="text-[10px] font-medium text-slate-500">
                      ⏱️ ~{stage.weeksNeeded} sem. con tu ahorro fijo actual
                    </p>
                  )}

                  {stage.missing > 0 && (
                    <button
                      type="button"
                      onClick={() => openContribution(stage.id)}
                      className="w-full h-8 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold font-heading cursor-pointer transition-colors"
                    >
                      ➕ Abonar
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-5 rounded-2xl border border-dashed border-slate-300 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
              <div className="space-y-0.5 text-center sm:text-left">
                <p className="text-xs font-bold font-heading text-slate-700">
                  ¿Tu meta es un proyecto grande (ej. Viaje $50,000 MXN)?
                </p>
                <p className="text-xs text-slate-500">
                  Divide tu meta en sub-metas como Vuelos ($12,000), Hospedaje
                  ($18,000) y Viáticos ($20,000) para visualizar tu avance por
                  etapa.
                </p>
              </div>
              <button
                type="button"
                onClick={() => openGoalEditor(false)}
                className="px-4 py-2 rounded-xl bg-white border-2 border-slate-200 hover:border-emerald-400 text-xs font-bold font-heading text-emerald-700 shrink-0 cursor-pointer"
              >
                + Agregar Sub-metas
              </button>
            </div>
          )}
        </div>

        {/* Panel rápido: Abonar ahorro */}
        <AnimatePresence>
          {contribOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-slate-900/50 flex items-end sm:items-center justify-center p-4"
              onClick={() => !isContributing && setContribOpen(false)}
            >
              <motion.form
                initial={{ y: 24, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 24, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                onSubmit={handleSubmitContribution}
                className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-3xl border-2 border-b-4 border-slate-200 shadow-xl p-5 sm:p-6 space-y-4"
              >
                <div>
                  <h3 className="text-lg font-bold font-heading text-slate-900">
                    ➕ Abonar a {profile.goal.title}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Llevas ${profile.goal.currentSaved.toLocaleString()} de $
                    {profile.goal.targetAmount.toLocaleString()} MXN
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {QUICK_AMOUNTS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => {
                        playTap();
                        setContribAmount(String(q));
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold font-heading border-2 cursor-pointer transition-colors ${
                        Number(contribAmount) === q
                          ? "bg-emerald-50 border-[#10B981] text-emerald-900"
                          : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      +${q.toLocaleString()}
                    </button>
                  ))}
                </div>

                <label className="block space-y-1">
                  <span className="text-xs font-bold text-slate-700">
                    Otro monto ($ MXN)
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={contribAmount}
                    onChange={(e) => setContribAmount(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </label>

                <label className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={contribDeduct}
                    onChange={(e) => setContribDeduct(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-emerald-600"
                  />
                  <span className="text-xs text-slate-700">
                    <strong className="block text-slate-900">
                      Descontar de mi saldo disponible hoy
                    </strong>
                    Actívalo si apartas dinero de tu quincena actual. Desactívalo
                    si ya lo tenías guardado aparte.
                  </span>
                </label>

                {(profile.goal.subGoals ?? []).length > 0 && (
                  <label className="block space-y-1">
                    <span className="text-xs font-bold text-slate-700">
                      Etapa / Sub-meta (opcional)
                    </span>
                    <select
                      value={contribSubGoalId}
                      onChange={(e) => setContribSubGoalId(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-900"
                    >
                      <option value="">Solo a la meta global</option>
                      {(profile.goal.subGoals ?? []).map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.title} (${st.targetAmount.toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {profile.goal.weeklyContribution === 0 && (
                  <div className="p-3 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-2">
                    <span className="text-xs font-bold text-indigo-900 block">
                      Aún no tienes ahorro semanal fijo. Defínelo para calcular
                      tu tiempo estimado:
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Ahorro semanal fijo ($ MXN)"
                      value={contribWeekly}
                      onChange={(e) => setContribWeekly(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-indigo-200 bg-white text-sm font-semibold text-slate-900"
                    />
                    <select
                      value={contribLocation}
                      onChange={(e) =>
                        setContribLocation(
                          e.target.value as "incluido" | "separado",
                        )
                      }
                      className="w-full h-10 px-3 rounded-xl border border-indigo-200 bg-white text-sm font-semibold text-slate-900"
                    >
                      <option value="separado">Guardado aparte de mi saldo</option>
                      <option value="incluido">Incluido en mi saldo</option>
                    </select>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isContributing}
                    onClick={() => setContribOpen(false)}
                    className="h-11 px-4 rounded-xl border border-slate-300 bg-white text-xs font-bold font-heading text-slate-700 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isContributing}
                    className="flex-1 h-11 rounded-xl bg-[#10B981] hover:bg-emerald-600 text-white text-xs font-bold font-heading border-b-4 border-emerald-700 cursor-pointer disabled:opacity-50"
                  >
                    {isContributing ? "Abonando..." : "Confirmar abono (+25 XP)"}
                  </button>
                </div>
              </motion.form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapsible Goal & Sub-Goals Editor Form */}
        <AnimatePresence>
          {isEditingGoal && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handleSaveGoal}
              className="p-5 rounded-3xl border-2 border-emerald-300 bg-emerald-50/30 space-y-4 overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-base font-bold font-heading text-slate-900">
                  {isCreatingNewGoal
                    ? "✨ Crear Nueva Meta por Proyecto"
                    : "✏️ Editar Meta y Sub-metas"}
                </h4>
                <button
                  type="button"
                  onClick={() => setIsEditingGoal(false)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Cerrar ✕
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <label className="space-y-1 block">
                  <span className="text-xs font-bold text-slate-700">
                    Nombre de la Meta Global
                  </span>
                  <input
                    type="text"
                    required
                    value={goalTitle}
                    onChange={(e) => setGoalTitle(e.target.value)}
                    placeholder="Ej. Viaje a Japón"
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-900"
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="text-xs font-bold text-slate-700">
                    Monto Objetivo Total ($ MXN)
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={goalTarget}
                    onChange={(e) => setGoalTarget(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-900"
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="text-xs font-bold text-slate-700">
                    Ahorrado actual
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={goalSaved}
                    onChange={(e) => setGoalSaved(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-900"
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="text-xs font-bold text-slate-700">
                    Ahorro Semanal Fijo ($ MXN)
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={goalWeekly}
                    onChange={(e) => setGoalWeekly(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-900"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="space-y-1 block">
                  <span className="text-xs font-bold text-slate-700">
                    ¿Dónde guardas este ahorro?
                  </span>
                  <select
                    value={goalLocation}
                    onChange={(e) =>
                      setGoalLocation(
                        e.target.value as "incluido" | "separado" | "desconocido",
                      )
                    }
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800"
                  >
                    <option value="separado">
                      Separado de mi saldo actual (En apartado / otra cuenta)
                    </option>
                    <option value="incluido">
                      Incluido dentro de mi saldo actual (Proteger de compras)
                    </option>
                    <option value="desconocido">Por definir</option>
                  </select>
                </label>

                <label className="space-y-1 block">
                  <span className="text-xs font-bold text-slate-700">
                    Fecha o Etiqueta Objetivo
                  </span>
                  <input
                    type="text"
                    value={goalDeadline}
                    onChange={(e) => setGoalDeadline(e.target.value)}
                    placeholder="Ej. 2026-12-31 o Verano"
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-900"
                  />
                </label>
              </div>

              {/* Sub-goals Editor List */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold font-heading text-slate-800">
                    Sub-metas / Etapas del Proyecto
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Suma de etapas: $
                    {subGoalsDraft
                      .reduce((a, b) => a + b.targetAmount, 0)
                      .toLocaleString()}{" "}
                    MXN
                  </span>
                </div>

                {subGoalsDraft.length > 0 && (
                  <div className="space-y-2">
                    {subGoalsDraft.map((sub) => (
                      <div
                        key={sub.id}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold"
                      >
                        <span className="text-slate-900 font-bold">
                          {sub.title}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-emerald-700 font-bold">
                            ${sub.targetAmount.toLocaleString()} MXN
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveSubGoalDraft(sub.id)}
                            className="text-rose-500 hover:text-rose-700 cursor-pointer"
                            title="Eliminar etapa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="Nueva etapa (ej. Vuelos, Hospedaje)"
                    value={newSubTitle}
                    onChange={(e) => setNewSubTitle(e.target.value)}
                    className="flex-1 h-9 px-3 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900"
                  />
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder="Monto ($ MXN)"
                    value={newSubTarget}
                    onChange={(e) => setNewSubTarget(e.target.value)}
                    className="w-full sm:w-40 h-9 px-3 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={handleAddSubGoalDraft}
                    className="h-9 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold font-heading cursor-pointer shrink-0"
                  >
                    + Añadir etapa
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingGoal(false)}
                  className="h-10 px-4 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingGoal}
                  className="h-10 px-5 rounded-xl bg-[#10B981] hover:bg-emerald-600 text-white text-xs font-bold font-heading border-b-4 border-emerald-700 cursor-pointer disabled:opacity-50"
                >
                  {isSavingGoal
                    ? "Guardando..."
                    : "Guardar Meta y Etapas"}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </section>

      {/* =====================================================================
          4. MEDALLAS DESBLOQUEADAS
         ===================================================================== */}
      <section className="p-6 rounded-3xl border-2 border-b-4 border-slate-200 bg-white space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-base font-bold font-heading text-slate-900">
            Medallas Desbloqueadas
          </span>
          <Trophy className="w-4 h-4 text-amber-500" strokeWidth={1.5} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {unlockedMedals.map((medal) => (
            <div
              key={medal.id}
              className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3"
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
      </section>
    </motion.div>
  );
}
