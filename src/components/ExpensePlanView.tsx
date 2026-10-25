"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Receipt,
  Calendar,
  AlertTriangle,
  Sparkles,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  PieChart,
  TrendingUp,
  ShieldCheck,
  ArrowUpRight,
  Clock,
  PowerOff,
  Loader2,
} from "lucide-react";
import {
  useFinancial,
  type CommitmentDbFrequency,
  type Commitment,
} from "@/context/FinancialContext";
import { calculateSafeToSpend } from "@/lib/onboarding/financialEngine";
import { projectSixWeeks } from "@/lib/onboarding/weeklyProjection";
import type {
  OnboardingProfile,
  CommitmentFrequency as EngineCommitmentFrequency,
} from "@/lib/onboarding/financialTypes";
import { playTap, playCoin } from "@/lib/soundEffects";

interface ExpensePlanViewProps {
  onShowToast?: (message: string) => void;
}

const EXPENSE_CATEGORIES = [
  "Vivienda",
  "Servicios",
  "Alimentación",
  "Transporte",
  "Deuda",
  "Educación",
  "Salud",
  "Suscripciones",
  "Imprevistos",
  "Otros",
];

const FREQUENCY_OPTIONS: {
  value: CommitmentDbFrequency;
  label: string;
  monthlyMultiplier: number;
}[] = [
  { value: "one_time", label: "Único", monthlyMultiplier: 1 },
  { value: "weekly", label: "Semanal", monthlyMultiplier: 4.33 },
  { value: "biweekly", label: "Quincenal", monthlyMultiplier: 2 },
  { value: "monthly", label: "Mensual", monthlyMultiplier: 1 },
];

const PLAN_VIEW_TABS: {
  id: "fijos" | "imprevistos" | "planeados";
  label: string;
}[] = [
  { id: "fijos", label: "📅 Gastos Fijos" },
  { id: "imprevistos", label: "⚠️ Imprevistos" },
  { id: "planeados", label: "✨ Planeados" },
];

const FREQUENCY_BADGE_LABELS: Record<CommitmentDbFrequency, string> = {
  one_time: "Único",
  weekly: "Semanal",
  biweekly: "Quincenal",
  monthly: "Mensual",
};

function toEngineFrequency(
  freq: CommitmentDbFrequency,
): EngineCommitmentFrequency {
  switch (freq) {
    case "one_time":
      return "unico";
    case "weekly":
      return "semanal";
    case "biweekly":
      return "quincenal";
    case "monthly":
    default:
      return "mensual";
  }
}

function defaultNextDueDate(daysFromNow = 5): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

export default function ExpensePlanView({ onShowToast }: ExpensePlanViewProps) {
  const {
    profile,
    financialProfile,
    addCommitment,
    updateCommitmentItem,
    deactivateCommitment,
    addExpenseTransaction,
    addPlannedExpense,
    removePlannedExpense,
  } = useFinancial();

  // Quick Top Form State (Unified Expense / Commitment / Planned Creator)
  const [formKind, setFormKind] = useState<
    "commitment" | "unforeseen" | "planned"
  >("commitment");
  const [viewTab, setViewTab] = useState<"fijos" | "imprevistos" | "planeados">(
    "fijos",
  );
  const [title, setTitle] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [category, setCategory] = useState("Vivienda");
  const [frequency, setFrequency] = useState<CommitmentDbFrequency>("monthly");
  const [nextDueDate, setNextDueDate] = useState<string>(() =>
    defaultNextDueDate(5),
  );
  const [plannedDueInDays, setPlannedDueInDays] = useState<string>("5");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Inline Edit State for Block A Commitments
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState("Servicios");
  const [editFrequency, setEditFrequency] =
    useState<CommitmentDbFrequency>("monthly");
  const [editNextDueDate, setEditNextDueDate] = useState("");
  const [busyCommitmentId, setBusyCommitmentId] = useState<string | null>(null);

  // Build fallback OnboardingProfile if financialProfile is null
  const activeEngineProfile: OnboardingProfile = useMemo(() => {
    if (financialProfile) return financialProfile;
    return {
      id: profile.id,
      name: profile.name,
      lifeContext: (profile.lifeContext || []).filter(
        (
          t,
        ): t is "estudio" | "trabajo" | "independiente" | "dependientes" =>
          ["estudio", "trabajo", "independiente", "dependientes"].includes(t),
      ),
      currentBalance: profile.currentBalance,
      payFrequency: profile.payFrequency,
      nextPaydayAmount: profile.nextPaydayAmount,
      nextPaydayDays: profile.nextPaydayDays,
      dailyEssentialBurn: profile.dailyEssentialBurn,
      safetyBuffer: profile.safetyBuffer,
      commitments: profile.commitments
        .filter((c) => c.category.toLowerCase() !== "deuda")
        .map((c) => ({
          id: c.id,
          title: c.title,
          amount: Number(Number(c.amount).toFixed(2)),
          dueInDays: c.dueInDays,
          category: c.category,
          frequency: toEngineFrequency(c.frequency ?? "monthly"),
          kind: "esencial",
          isConfirmed: true,
        })),
      debts: profile.commitments
        .filter((c) => c.category.toLowerCase() === "deuda")
        .map((c) => ({
          id: c.id,
          title: c.title,
          totalBalance: null,
          nextPayment: Number(Number(c.amount).toFixed(2)),
          dueInDays: c.dueInDays,
          frequency: toEngineFrequency(c.frequency ?? "monthly"),
        })),
      primaryGoal: {
        id: "primary-goal",
        title: profile.goal.title,
        category: "emergencia",
        targetAmount: profile.goal.targetAmount,
        currentSaved: profile.goal.currentSaved,
        weeklyContribution: profile.goal.weeklyContribution,
        savingsLocation: "separado",
      },
      isOnboarded: true,
    };
  }, [financialProfile, profile]);

  // Engine calculations for Block B (Unforeseen impact) & Block C (Planned simulation)
  const engineMetrics = useMemo(() => {
    const baseSafe = calculateSafeToSpend(activeEngineProfile);
    const baseProjection = projectSixWeeks(activeEngineProfile);

    // Block B: Unforeseen expenses (public.transactions type === 'expense')
    const expenseTransactions = (profile.transactions ?? []).filter(
      (tx) => tx.type === "expense",
    );
    const totalUnforeseen = Number(
      expenseTransactions
        .reduce((acc, tx) => acc + Number(tx.amount), 0)
        .toFixed(2),
    );

    // What Safe-to-Spend would have been before unforeseen expenses reduced currentBalance
    const profileBeforeUnforeseen: OnboardingProfile = {
      ...activeEngineProfile,
      currentBalance:
        activeEngineProfile.currentBalance !== null
          ? Number(
              (activeEngineProfile.currentBalance + totalUnforeseen).toFixed(2),
            )
          : null,
    };
    const safeBeforeUnforeseen = calculateSafeToSpend(profileBeforeUnforeseen);

    // Block C: Planned Expenses Simulation (using financialEngine.ts and weeklyProjection.ts)
    const plannedItems = profile.plannedExpenses ?? [];
    const totalPlanned = Number(
      plannedItems.reduce((acc, item) => acc + Number(item.amount), 0).toFixed(2),
    );

    const profileWithPlanned: OnboardingProfile = {
      ...activeEngineProfile,
      commitments: [
        ...activeEngineProfile.commitments,
        ...plannedItems.map((item) => ({
          id: item.id,
          title: item.title,
          amount: Number(Number(item.amount).toFixed(2)),
          dueInDays: item.dueInDays,
          category: item.category,
          frequency: toEngineFrequency(item.frequency),
          kind: "otro" as const,
          isConfirmed: true,
        })),
      ],
    };

    const safeWithPlanned = calculateSafeToSpend(profileWithPlanned);
    const projectionWithPlanned = projectSixWeeks(profileWithPlanned);

    return {
      baseSafe,
      baseProjection,
      expenseTransactions,
      totalUnforeseen,
      safeBeforeUnforeseen,
      plannedItems,
      totalPlanned,
      safeWithPlanned,
      projectionWithPlanned,
    };
  }, [activeEngineProfile, profile.transactions, profile.plannedExpenses]);

  // Monthly Breakdown by Category vs Income Sources (Panel de Desglose de Gastos Mensuales)
  const monthlyBreakdown = useMemo(() => {
    const categoryTotals = new Map<
      string,
      { commitmentsTotal: number; transactionsTotal: number; total: number }
    >();

    for (const c of profile.commitments) {
      if (c.isActive === false) continue;
      const freq = c.frequency ?? "monthly";
      const mult =
        FREQUENCY_OPTIONS.find((f) => f.value === freq)?.monthlyMultiplier ?? 1;
      const monthlyAmount = Number((Number(c.amount) * mult).toFixed(2));
      const prev = categoryTotals.get(c.category) ?? {
        commitmentsTotal: 0,
        transactionsTotal: 0,
        total: 0,
      };
      categoryTotals.set(c.category, {
        commitmentsTotal: Number(
          (prev.commitmentsTotal + monthlyAmount).toFixed(2),
        ),
        transactionsTotal: prev.transactionsTotal,
        total: Number((prev.total + monthlyAmount).toFixed(2)),
      });
    }

    for (const tx of engineMetrics.expenseTransactions) {
      const amount = Number(Number(tx.amount).toFixed(2));
      const cat = tx.category || "Imprevistos";
      const prev = categoryTotals.get(cat) ?? {
        commitmentsTotal: 0,
        transactionsTotal: 0,
        total: 0,
      };
      categoryTotals.set(cat, {
        commitmentsTotal: prev.commitmentsTotal,
        transactionsTotal: Number((prev.transactionsTotal + amount).toFixed(2)),
        total: Number((prev.total + amount).toFixed(2)),
      });
    }

    const rows = Array.from(categoryTotals.entries())
      .map(([cat, values]) => ({
        category: cat,
        ...values,
      }))
      .sort((a, b) => b.total - a.total);

    const totalMonthlyExpenses = Number(
      rows.reduce((sum, r) => sum + r.total, 0).toFixed(2),
    );

    const sources =
      profile.incomeSources && profile.incomeSources.length > 0
        ? profile.incomeSources
        : [
            {
              id: "default-income",
              name:
                profile.payFrequency === "semanal"
                  ? "Ingreso Semanal"
                  : profile.payFrequency === "mensual"
                    ? "Ingreso Mensual"
                    : "Nómina Quincenal",
              amount: Number(Number(profile.nextPaydayAmount || 0).toFixed(2)),
              frequency: (profile.payFrequency === "semanal"
                ? "weekly"
                : profile.payFrequency === "mensual"
                  ? "monthly"
                  : "biweekly") as CommitmentDbFrequency,
            },
          ];

    const totalMonthlyIncome = Number(
      sources
        .reduce((sum, src) => {
          const mult =
            FREQUENCY_OPTIONS.find((f) => f.value === src.frequency)
              ?.monthlyMultiplier ?? 2;
          return sum + Number(src.amount) * mult;
        }, 0)
        .toFixed(2),
    );

    const expenseToIncomePct =
      totalMonthlyIncome > 0
        ? Math.min(
            100,
            Math.round((totalMonthlyExpenses / totalMonthlyIncome) * 100),
          )
        : 0;

    return {
      rows,
      totalMonthlyExpenses,
      sources,
      totalMonthlyIncome,
      expenseToIncomePct,
    };
  }, [
    profile.commitments,
    profile.incomeSources,
    profile.payFrequency,
    profile.nextPaydayAmount,
    engineMetrics.expenseTransactions,
  ]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanTitle = title.trim();
    const parsedAmount = Number(Number(amountInput).toFixed(2));
    if (!cleanTitle || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFormError(
        "Ingresa un concepto y un monto válido mayor a $0.00 (redondeado a 2 decimales).",
      );
      return;
    }

    setIsSubmitting(true);
    try {
      if (formKind === "commitment") {
        await addCommitment({
          title: cleanTitle,
          amount: parsedAmount,
          category,
          frequency,
          nextDueDate: nextDueDate || defaultNextDueDate(5),
        });
        playCoin();
        onShowToast?.(
          `Compromiso fijo guardado: ${cleanTitle} ($${parsedAmount.toFixed(2)} MXN)`,
        );
      } else if (formKind === "unforeseen") {
        await addExpenseTransaction({
          title: cleanTitle,
          amount: parsedAmount,
          category: category || "Imprevistos",
        });
        playTap();
        onShowToast?.(
          `Gasto imprevisto registrado en transacciones: −$${parsedAmount.toFixed(2)} MXN`,
        );
      } else {
        const dueDays = Math.max(0, Math.round(Number(plannedDueInDays) || 0));
        addPlannedExpense({
          title: cleanTitle,
          amount: parsedAmount,
          category,
          dueInDays: dueDays,
          frequency,
        });
        playTap();
        onShowToast?.(
          `Gasto planeado agregado a la simulación: ${cleanTitle} ($${parsedAmount.toFixed(2)} MXN)`,
        );
      }

      setTitle("");
      setAmountInput("");
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "No se pudo guardar el registro.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditingCommitment = (item: Commitment) => {
    playTap();
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditAmount(Number(item.amount).toFixed(2));
    setEditCategory(item.category);
    setEditFrequency(item.frequency ?? "monthly");
    setEditNextDueDate(
      item.nextDueDate ?? defaultNextDueDate(item.dueInDays || 3),
    );
  };

  const handleSaveEditCommitment = async (id: string) => {
    const rounded = Number(Number(editAmount).toFixed(2));
    if (!editTitle.trim() || !Number.isFinite(rounded) || rounded <= 0) return;
    setBusyCommitmentId(id);
    try {
      await updateCommitmentItem(id, {
        title: editTitle.trim(),
        amount: rounded,
        category: editCategory,
        frequency: editFrequency,
        nextDueDate: editNextDueDate,
      });
      setEditingId(null);
      onShowToast?.("Compromiso actualizado correctamente.");
    } catch (err) {
      onShowToast?.(
        err instanceof Error
          ? err.message
          : "No se pudo actualizar el compromiso.",
      );
    } finally {
      setBusyCommitmentId(null);
    }
  };

  const handleDeactivateCommitment = async (id: string, itemTitle: string) => {
    setBusyCommitmentId(id);
    try {
      await deactivateCommitment(id);
      onShowToast?.(`Compromiso desactivado: ${itemTitle}`);
    } catch (err) {
      onShowToast?.(
        err instanceof Error
          ? err.message
          : "No se pudo desactivar el compromiso.",
      );
    } finally {
      setBusyCommitmentId(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* =====================================================================
          1. FORMULARIO LIMPIO DE REGISTRO DE GASTOS Y COMPROMISOS
         ===================================================================== */}
      <section className="bg-white rounded-3xl border-2 border-b-4 border-slate-200 shadow-sm p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
              <Receipt
                className="w-5 h-5 text-emerald-600"
                strokeWidth={1.5}
              />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold font-heading text-slate-900">
                Plan de Gastos y Registro Rápido
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Registra compromisos fijos, gastos imprevistos o simula gastos
                planeados
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-heading bg-emerald-50 text-emerald-800 border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Ahorro fijo: ${(profile.goal?.currentSaved ?? 0).toLocaleString()} MXN</span>
          </span>
        </div>

        {/* Selector de Tipo de Gasto */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-1 rounded-2xl bg-slate-100 border border-slate-200">
          <button
            type="button"
            onClick={() => {
              playTap();
              setFormKind("commitment");
            }}
            className={`py-2 px-3 rounded-xl text-xs font-bold font-heading transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              formKind === "commitment"
                ? "bg-white text-slate-900 shadow-2xs border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-emerald-600" />
            <span>Gasto Fijo</span>
          </button>

          <button
            type="button"
            onClick={() => {
              playTap();
              setFormKind("unforeseen");
              setCategory("Imprevistos");
            }}
            className={`py-2 px-3 rounded-xl text-xs font-bold font-heading transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              formKind === "unforeseen"
                ? "bg-white text-slate-900 shadow-2xs border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Gasto Imprevisto</span>
          </button>

          <button
            type="button"
            onClick={() => {
              playTap();
              setFormKind("planned");
              setFrequency("one_time");
            }}
            className={`py-2 px-3 rounded-xl text-xs font-bold font-heading transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              formKind === "planned"
                ? "bg-white text-slate-900 shadow-2xs border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>Gasto Planeado</span>
          </button>
        </div>

        <form onSubmit={handleCreateSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-bold font-heading text-slate-600 mb-1">
                Concepto o nombre del gasto
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  formKind === "commitment"
                    ? "Ej. Internet Fibra, Gimnasio..."
                    : formKind === "unforeseen"
                      ? "Ej. Reparación, consulta médica..."
                      : "Ej. Regalo de cumpleaños, cena..."
                }
                className="w-full h-10 px-3.5 rounded-xl border border-slate-200 bg-slate-50/70 text-xs sm:text-sm text-slate-900 focus:bg-white focus:border-[#10B981] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold font-heading text-slate-600 mb-1">
                Monto (MXN)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="0.00"
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50/70 text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:border-[#10B981] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold font-heading text-slate-600 mb-1">
                Categoría
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-10 px-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-xs sm:text-sm text-slate-900 focus:bg-white focus:border-[#10B981] focus:outline-none"
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {formKind !== "unforeseen" && (
              <div>
                <label className="block text-[11px] font-bold font-heading text-slate-600 mb-1">
                  Frecuencia
                </label>
                <select
                  value={frequency}
                  onChange={(e) =>
                    setFrequency(e.target.value as CommitmentDbFrequency)
                  }
                  className="w-full h-10 px-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-xs sm:text-sm text-slate-900 focus:bg-white focus:border-[#10B981] focus:outline-none"
                >
                  {FREQUENCY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {formKind === "commitment" && (
              <div>
                <label className="block text-[11px] font-bold font-heading text-slate-600 mb-1">
                  Próximo pago
                </label>
                <input
                  type="date"
                  required
                  value={nextDueDate}
                  onChange={(e) => setNextDueDate(e.target.value)}
                  className="w-full h-10 px-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-xs text-slate-900 focus:bg-white focus:border-[#10B981] focus:outline-none"
                />
              </div>
            )}

            {formKind === "planned" && (
              <div>
                <label className="block text-[11px] font-bold font-heading text-slate-600 mb-1">
                  ¿En cuántos días?
                </label>
                <input
                  type="number"
                  min="0"
                  max="42"
                  required
                  value={plannedDueInDays}
                  onChange={(e) => setPlannedDueInDays(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50/70 text-xs sm:text-sm text-slate-900 focus:bg-white focus:border-[#10B981] focus:outline-none"
                />
              </div>
            )}

            {formKind === "unforeseen" && (
              <div className="flex items-end">
                <div className="w-full h-10 px-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2 text-[11px] font-semibold text-amber-900">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>
                    Se descuenta de tu saldo disponible hoy
                  </span>
                </div>
              </div>
            )}
          </div>

          {formError && (
            <p
              role="alert"
              className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2"
            >
              {formError}
            </p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-10 px-5 rounded-xl bg-[#10B981] hover:bg-emerald-600 text-white text-xs font-bold font-heading border-2 border-emerald-600 border-b-4 border-b-emerald-800 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" strokeWidth={2} />
              )}
              <span>
                {formKind === "commitment"
                  ? "Guardar compromiso fijo"
                  : formKind === "unforeseen"
                    ? "Registrar gasto imprevisto"
                    : "Agregar gasto planeado al simulador"}
              </span>
            </button>
          </div>
        </form>
      </section>

      {/* =====================================================================
          2. LOS 3 BLOQUES INTERACTIVOS DEL PLAN DE GASTOS
         ===================================================================== */}
      <div className="space-y-5">
        <div
          role="tablist"
          className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-1.5 rounded-2xl bg-slate-100 border border-slate-200"
        >
          {PLAN_VIEW_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={viewTab === t.id}
              onClick={() => {
                playTap();
                setViewTab(t.id);
              }}
              className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold font-heading transition-all cursor-pointer text-center ${
                viewTab === t.id
                  ? "bg-white text-slate-900 shadow-2xs border border-slate-200/80"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {/* BLOQUE A: Gastos en Curso / Fijos (public.commitments) */}
        <section className={`bg-white rounded-3xl border-2 border-b-4 border-slate-200 shadow-sm p-5 flex flex-col justify-between gap-4 ${viewTab === "fijos" ? "" : "hidden"}`}>
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                  <Calendar
                    className="w-4 h-4 text-emerald-600"
                    strokeWidth={1.5}
                  />
                </div>
                <div>
                  <h2 className="text-base font-bold font-heading text-slate-900">
                    Gastos en Curso / Fijos
                  </h2>
                </div>
              </div>
              <span className="text-xs font-bold font-heading px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
                {profile.commitments.length} activos
              </span>
            </div>

            {profile.commitments.length > 0 ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {profile.commitments.map((item) => {
                  const isEditing = editingId === item.id;
                  const isBusy = busyCommitmentId === item.id;
                  const freqKey = item.frequency ?? "monthly";

                  if (isEditing) {
                    return (
                      <div
                        key={item.id}
                        className="p-3 rounded-2xl border-2 border-emerald-400 bg-emerald-50/30 space-y-2.5"
                      >
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full h-8 px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            step="0.01"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            className="w-full h-8 px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
                          />
                          <select
                            value={editFrequency}
                            onChange={(e) =>
                              setEditFrequency(
                                e.target.value as CommitmentDbFrequency,
                              )
                            }
                            className="w-full h-8 px-2 rounded-lg border border-slate-300 bg-white text-xs"
                          >
                            {FREQUENCY_OPTIONS.map((f) => (
                              <option key={f.value} value={f.value}>
                                {f.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value)}
                            className="w-full h-8 px-2 rounded-lg border border-slate-300 bg-white text-xs"
                          >
                            {EXPENSE_CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                          <input
                            type="date"
                            value={editNextDueDate}
                            onChange={(e) => setEditNextDueDate(e.target.value)}
                            className="w-full h-8 px-2 rounded-lg border border-slate-300 bg-white text-xs"
                          />
                        </div>
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-600 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleSaveEditCommitment(item.id)}
                            className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Guardar</span>
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-white transition-colors space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">
                              {item.category}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800">
                              {FREQUENCY_BADGE_LABELS[freqKey]}
                            </span>
                          </div>
                          <p className="text-sm font-bold font-heading text-slate-900 mt-1">
                            {item.title}
                          </p>
                        </div>

                        <span className="text-sm font-bold font-heading text-slate-900 shrink-0">
                          ${Number(item.amount).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/70">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          Próximo pago:{" "}
                          <strong className="text-slate-700">
                            {item.nextDueDate
                              ? `${item.nextDueDate} (${item.dueInDays}d)`
                              : `en ${item.dueInDays} días`}
                          </strong>
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => startEditingCommitment(item)}
                            className="p-1 rounded-lg hover:bg-slate-200/70 text-slate-600 cursor-pointer"
                            title="Editar compromiso"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              void handleDeactivateCommitment(item.id, item.title)
                            }
                            className="p-1 rounded-lg hover:bg-rose-100 text-slate-500 hover:text-rose-700 cursor-pointer"
                            title="Desactivar compromiso"
                          >
                            <PowerOff className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-5 rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
                No tienes compromisos fijos activos. Agrégalos arriba para que el
                reservemos ese dinero antes de tu próximo ingreso.
              </div>
            )}
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
            <span className="font-semibold text-slate-600">
              Reservado hasta próximo ingreso:
            </span>
            <span className="font-bold font-heading text-slate-900">
              $
              {(
                (engineMetrics.baseSafe.pendingCommitments ?? 0) +
                (engineMetrics.baseSafe.pendingDebtPayments ?? 0)
              ).toLocaleString("es-MX", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              MXN
            </span>
          </div>
        </section>

        {/* BLOQUE B: Gastos Imprevistos / Fuera de Control (public.transactions tipo expense) */}
        <section className={`bg-white rounded-3xl border-2 border-b-4 border-slate-200 shadow-sm p-5 flex flex-col justify-between gap-4 ${viewTab === "imprevistos" ? "" : "hidden"}`}>
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                  <AlertTriangle
                    className="w-4 h-4 text-amber-600"
                    strokeWidth={1.5}
                  />
                </div>
                <div>
                  <h2 className="text-base font-bold font-heading text-slate-900">
                    Gastos Imprevistos / Fuera de Control
                  </h2>
                </div>
              </div>
              <span className="text-xs font-bold font-heading px-2.5 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200">
                −${engineMetrics.totalUnforeseen.toLocaleString()} MXN
              </span>
            </div>

            {/* Visual Indicator of Liquidity Reduction from financialEngine.ts */}
            <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold font-heading text-amber-950">
                <span>Reducción de tu dinero libre</span>
                <span>
                  −$
                  {Math.max(
                    0,
                    (engineMetrics.safeBeforeUnforeseen.safeToSpend ?? 0) -
                      (engineMetrics.baseSafe.safeToSpend ?? 0),
                  ).toLocaleString()}{" "}
                  MXN
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-amber-200/70 overflow-hidden flex">
                <div
                  style={{
                    width: `${
                      (engineMetrics.safeBeforeUnforeseen.safeToSpend ?? 0) > 0
                        ? Math.max(
                            10,
                            Math.round(
                              ((engineMetrics.baseSafe.safeToSpend ?? 0) /
                                (engineMetrics.safeBeforeUnforeseen.safeToSpend ??
                                  1)) *
                                100,
                            ),
                          )
                        : 100
                    }%`,
                  }}
                  className="h-full bg-[#10B981] transition-all"
                />
                <div className="flex-1 h-full bg-amber-500" />
              </div>
              <div className="flex justify-between text-[11px] text-amber-900">
                <span>
                  Antes: $
                  {(
                    engineMetrics.safeBeforeUnforeseen.safeToSpend ?? 0
                  ).toLocaleString()}{" "}
                  MXN
                </span>
                <span className="font-bold">
                  Hoy: ${(engineMetrics.baseSafe.safeToSpend ?? 0).toLocaleString()}{" "}
                  MXN
                </span>
              </div>
            </div>

            {engineMetrics.expenseTransactions.length > 0 ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {engineMetrics.expenseTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-3 rounded-2xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-bold uppercase text-amber-700 block">
                        {tx.category} ·{" "}
                        {new Date(tx.occurredAt).toLocaleDateString("es-MX", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </span>
                      <p className="text-xs sm:text-sm font-bold font-heading text-slate-900 break-words">
                        {tx.title}
                      </p>
                    </div>
                    <span className="text-xs sm:text-sm font-bold font-heading text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-xl shrink-0">
                      −$
                      {Number(tx.amount).toLocaleString("es-MX", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-5 rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
                Sin gastos imprevistos registrados en este periodo. ¡Tu margen
                libre sigue intacto!
              </div>
            )}
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
            <span>Impacto en tu ahorro fijo de meta:</span>
            <span className="font-bold text-emerald-700">
              $0.00 MXN (100% protegido)
            </span>
          </div>
        </section>

        {/* BLOQUE C: Gastos Planeados (Simulación en el Plan con weeklyProjection.ts + financialEngine.ts) */}
        <section className={`bg-white rounded-3xl border-2 border-b-4 border-slate-200 shadow-sm p-5 flex flex-col justify-between gap-4 ${viewTab === "planeados" ? "" : "hidden"}`}>
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0">
                  <TrendingUp
                    className="w-4 h-4 text-indigo-600"
                    strokeWidth={1.5}
                  />
                </div>
                <div>
                  <h2 className="text-base font-bold font-heading text-slate-900">
                    Gastos Planeados
                  </h2>
                </div>
              </div>
              <span className="text-xs font-bold font-heading px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-900 border border-indigo-200">
                ${engineMetrics.totalPlanned.toLocaleString()} MXN
              </span>
            </div>

            {/* Visual Simulation Indicator from financialEngine.ts & weeklyProjection.ts */}
            <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold font-heading text-indigo-950">
                <span>Margen libre si mantienes este plan:</span>
                <span
                  className={
                    (engineMetrics.safeWithPlanned.shortfall ?? 0) > 0
                      ? "text-rose-700"
                      : "text-emerald-700"
                  }
                >
                  $
                  {(
                    engineMetrics.safeWithPlanned.safeToSpend ?? 0
                  ).toLocaleString()}{" "}
                  MXN
                </span>
              </div>

              {(engineMetrics.safeWithPlanned.shortfall ?? 0) > 0 && (
                <p className="text-[11px] font-semibold text-rose-700">
                  ⚠️ Tus gastos planeados exceden tu liquidez libre de esta
                  quincena por $
                  {(
                    engineMetrics.safeWithPlanned.shortfall ?? 0
                  ).toLocaleString()}{" "}
                  MXN.
                </p>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-indigo-200/60 text-[11px] text-indigo-950">
                <div>
                  <span className="text-slate-500 block">
                    Saldo en la semana 6:
                  </span>
                  <strong className="text-slate-900">
                    {engineMetrics.projectionWithPlanned.status === "calculado"
                      ? `$${engineMetrics.projectionWithPlanned.weeks[5]?.endBalance.toLocaleString()} MXN`
                      : "Por confirmar"}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">
                    Ahorro fijo en "{profile.goal.title}":
                  </span>
                  <strong className="text-emerald-700">
                    ${profile.goal.currentSaved.toLocaleString()} (Intacto)
                  </strong>
                </div>
              </div>
            </div>

            {engineMetrics.plannedItems.length > 0 ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {engineMetrics.plannedItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-2xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-bold uppercase text-indigo-700 block">
                        {item.category} · en {item.dueInDays}d (
                        {FREQUENCY_BADGE_LABELS[item.frequency]})
                      </span>
                      <p className="text-xs sm:text-sm font-bold font-heading text-slate-900 break-words">
                        {item.title}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs font-bold font-heading text-indigo-900 bg-indigo-50 border border-indigo-200 px-2 py-1 rounded-xl">
                        $
                        {Number(item.amount).toLocaleString("es-MX", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          playTap();
                          try {
                            await addCommitment({
                              title: item.title,
                              amount: item.amount,
                              category: item.category,
                              frequency: item.frequency,
                              nextDueDate: defaultNextDueDate(item.dueInDays),
                            });
                            removePlannedExpense(item.id);
                            onShowToast?.(
                              `Convertido en compromiso activo: ${item.title}`,
                            );
                          } catch (err) {
                            onShowToast?.(
                              err instanceof Error
                                ? err.message
                                : "No se pudo convertir el gasto planeado.",
                            );
                          }
                        }}
                        className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 cursor-pointer"
                        title="Confirmar y pasar a Pagos Fijos"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          playTap();
                          removePlannedExpense(item.id);
                        }}
                        className="p-1.5 rounded-lg hover:bg-rose-100 text-slate-400 hover:text-rose-700 cursor-pointer"
                        title="Quitar de la simulación"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-5 rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
                Agrega gastos futuros arriba eligiendo “Gasto Planeado” para
                simular su impacto en tus próximas 6 semanas sin afectar tu
                saldo real.
              </div>
            )}
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
            <span>Punto mínimo en 6 semanas con este plan:</span>
            <span className="font-bold font-heading text-slate-900">
              {engineMetrics.projectionWithPlanned.lowestBalance !== null
                ? `$${engineMetrics.projectionWithPlanned.lowestBalance.toLocaleString()} MXN`
                : "—"}
            </span>
          </div>
        </section>
      </div>

      {/* =====================================================================
          3. PANEL DE "DESGLOSE DE GASTOS MENSUALES" POR CATEGORÍA VS INGRESOS
         ===================================================================== */}
      <section className="bg-white rounded-3xl border-2 border-b-4 border-slate-200 shadow-sm p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center shrink-0">
              <PieChart className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-lg font-bold font-heading text-slate-900">
                Desglose de Gastos Mensuales vs. Fuentes de Ingreso
              </h2>
              <p className="text-xs text-slate-500">
                Tus pagos fijos y gastos imprevistos del mes frente a tus ingresos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[11px] text-slate-500 block">
                Total Gastos Mensuales
              </span>
              <span className="text-base sm:text-lg font-bold font-heading text-slate-900">
                $
                {monthlyBreakdown.totalMonthlyExpenses.toLocaleString("es-MX", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                MXN
              </span>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div className="text-right">
              <span className="text-[11px] text-slate-500 block">
                Ingreso Mensual Estimado
              </span>
              <span className="text-base sm:text-lg font-bold font-heading text-emerald-700">
                $
                {monthlyBreakdown.totalMonthlyIncome.toLocaleString("es-MX", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                MXN
              </span>
            </div>
          </div>
        </div>

        {/* Global Income vs Expense Comparison Bar */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold font-heading">
            <span className="text-slate-700">
              Proporción de ingresos comprometidos este mes:
            </span>
            <span
              className={
                monthlyBreakdown.expenseToIncomePct > 80
                  ? "text-amber-700"
                  : "text-emerald-700"
              }
            >
              {monthlyBreakdown.expenseToIncomePct}% de tus fuentes de ingreso
            </span>
          </div>
          <div className="w-full h-3 rounded-full bg-slate-200 overflow-hidden p-0.5">
            <div
              style={{ width: `${monthlyBreakdown.expenseToIncomePct}%` }}
              className={`h-full rounded-full transition-all duration-500 ${
                monthlyBreakdown.expenseToIncomePct > 85
                  ? "bg-amber-500"
                  : "bg-[#10B981]"
              }`}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-700">
                Mis ingresos:
              </span>
              {monthlyBreakdown.sources.map((src) => (
                <span
                  key={src.id}
                  className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-800 font-medium"
                >
                  {src.name}: ${Number(src.amount).toLocaleString()} (
                  {FREQUENCY_BADGE_LABELS[src.frequency]})
                </span>
              ))}
            </div>
            <span className="font-semibold text-emerald-800">
              Margen mensual libre est.: $
              {Math.max(
                0,
                Number(
                  (
                    monthlyBreakdown.totalMonthlyIncome -
                    monthlyBreakdown.totalMonthlyExpenses
                  ).toFixed(2),
                ),
              ).toLocaleString("es-MX", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              MXN
            </span>
          </div>
        </div>

        {/* Category Progress Bars */}
        {monthlyBreakdown.rows.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {monthlyBreakdown.rows.map((row) => {
              const pctOfExpenses =
                monthlyBreakdown.totalMonthlyExpenses > 0
                  ? Math.round(
                      (row.total / monthlyBreakdown.totalMonthlyExpenses) * 100,
                    )
                  : 0;
              const pctOfIncome =
                monthlyBreakdown.totalMonthlyIncome > 0
                  ? Math.min(
                      100,
                      Math.round(
                        (row.total / monthlyBreakdown.totalMonthlyIncome) * 100,
                      ),
                    )
                  : 0;

              return (
                <div
                  key={row.category}
                  className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-sm font-bold font-heading text-slate-900">
                        {row.category}
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        Fijos: ${row.commitmentsTotal.toLocaleString()} ·
                        Imprevistos: ${row.transactionsTotal.toLocaleString()}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold font-heading text-slate-900 block">
                        $
                        {row.total.toLocaleString("es-MX", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        MXN
                      </span>
                      <span className="text-[10px] font-bold text-emerald-700">
                        {pctOfExpenses}% del gasto · {pctOfIncome}% de tu ingreso
                      </span>
                    </div>
                  </div>

                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      style={{ width: `${Math.max(4, pctOfExpenses)}%` }}
                      className="h-full rounded-full bg-[#10B981] transition-all duration-500"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
            Registra compromisos o gastos arriba para visualizar tu desglose
            mensual por categoría.
          </div>
        )}
      </section>
    </motion.div>
  );
}

