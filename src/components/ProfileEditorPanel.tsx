"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  UserCheck,
  Wallet,
  Calendar,
  Target,
  Plus,
  Trash2,
  CheckCircle2,
  Save,
  SlidersHorizontal,
  LogOut,
  Shield,
  Coins,
  Receipt,
  Sparkles,
} from "lucide-react";
import {
  useFinancial,
  PRELOADED_SANDBOX_PROFILES,
  type LifeContextTag,
  type CommitmentDbFrequency,
} from "@/context/FinancialContext";
import { playTap, playCoin, playLevelUp } from "@/lib/soundEffects";

interface ProfileEditorPanelProps {
  onShowToast: (message: string) => void;
  onNavigateToSimulate?: () => void;
  initialTab?: ProfileTabId;
}

type ProfileTabId = "perfil" | "liquidez" | "ingresos";

const PROFILE_TABS: { id: ProfileTabId; label: string }[] = [
  { id: "perfil", label: "👤 Perfil y Estilo de Vida" },
  { id: "liquidez", label: "🛡️ Liquidez y Colchón" },
  { id: "ingresos", label: "📅 Ingresos y Pagos Fijos" },
];

const LIFESTYLE_OPTIONS: {
  tag: LifeContextTag;
  label: string;
  emoji: string;
}[] = [
  { tag: "estudio", label: "Estudio", emoji: "🎓" },
  { tag: "trabajo", label: "Trabajo", emoji: "💼" },
  { tag: "independiente", label: "Pago mi vivienda / Renta", emoji: "🏠" },
  { tag: "dependientes", label: "Mantengo a otras personas", emoji: "👨‍👩‍👧" },
  { tag: "apoyo", label: "Recibo apoyo familiar / beca", emoji: "🤝" },
];

export default function ProfileEditorPanel({
  onShowToast,
  onNavigateToSimulate, initialTab = "perfil",
}: ProfileEditorPanelProps) {
  const router = useRouter();
  const {
    profile,
    mode,
    signOut,
    loadPreloadedSandboxProfile,
    saveFullProfileSettings,
    upsertIncomeSource,
    deleteIncomeSource,
    addCommitment,
    deactivateCommitment,
    saveGoalWithSubGoals,
  } = useFinancial();

  const [activeTab, setActiveTab] = useState<ProfileTabId>(initialTab);

  const handleLogout = async () => {
    playTap();
    try {
      await signOut();
      router.replace("/auth");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // 1. User Personal Data State (NO gender or sex fields)
  const [displayName, setDisplayName] = useState(profile.name || "");
  const [nickname, setNickname] = useState(profile.nickname || "");
  const [age, setAge] = useState(
    profile.age !== undefined && profile.age !== null ? String(profile.age) : "",
  );
  const [dependentsCount, setDependentsCount] = useState(
    String(profile.dependentsCount ?? 0),
  );
  const [selectedTags, setSelectedTags] = useState<LifeContextTag[]>(
    profile.lifeContext ?? [],
  );

  // 2. Core Financial Parameters State
  const [currentBalance, setCurrentBalance] = useState(
    String(profile.currentBalance ?? 0),
  );
  const [safetyBuffer, setSafetyBuffer] = useState(
    String(profile.safetyBuffer ?? 500),
  );
  const [dailyEssentialBurn, setDailyEssentialBurn] = useState(
    String(profile.dailyEssentialBurn ?? 150),
  );
  const [isSavingCore, setIsSavingCore] = useState(false);

  // 3. Income Source Form State
  const [incName, setIncName] = useState("");
  const [incAmount, setIncAmount] = useState("");
  const [incFrequency, setIncFrequency] =
    useState<CommitmentDbFrequency>("biweekly");
  const [incNextDate, setIncNextDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [isSavingIncome, setIsSavingIncome] = useState(false);

  // 4. Fixed Commitment Quick Form State
  const [commTitle, setCommTitle] = useState("");
  const [commAmount, setCommAmount] = useState("");
  const [commCategory, setCommCategory] = useState("Vivienda");
  const [commFrequency, setCommFrequency] =
    useState<CommitmentDbFrequency>("monthly");
  const [commNextDate, setCommNextDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().slice(0, 10);
  });
  const [isSavingComm, setIsSavingComm] = useState(false);

  // 5. Primary Goal Form State
  const [goalTitle, setGoalTitle] = useState(profile.goal.title || "");
  const [goalTarget, setGoalTarget] = useState(
    String(profile.goal.targetAmount ?? 15000),
  );
  const [goalSaved, setGoalSaved] = useState(
    String(profile.goal.currentSaved ?? 0),
  );
  const [goalWeekly, setGoalWeekly] = useState(
    String(profile.goal.weeklyContribution ?? 500),
  );
  const [goalLocation, setGoalLocation] = useState<
    "incluido" | "separado" | "desconocido"
  >(profile.goal.savingsLocation || "separado");
  const [isSavingGoal, setIsSavingGoal] = useState(false);

  const toggleLifestyleTag = (tag: LifeContextTag) => {
    playTap();
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleSaveCoreProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingCore(true);
    try {
      await saveFullProfileSettings({
        displayName: displayName.trim() || "Tu Perfil",
        nickname: nickname.trim(),
        age: age.trim() ? Number(age) : null,
        dependentsCount: Number(dependentsCount) || 0,
        lifeContext: selectedTags,
        currentBalance: Number(currentBalance) || 0,
        safetyBuffer: Number(safetyBuffer) || 0,
        dailyEssentialBurn: Number(dailyEssentialBurn) || 0,
      });
      playLevelUp();
      onShowToast(
        "¡Perfil guardado correctamente!",
      );
    } catch (err) {
      onShowToast(
        err instanceof Error ? err.message : "Error al guardar el perfil",
      );
    } finally {
      setIsSavingCore(false);
    }
  };

  const handleAddIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = Number(incAmount);
    if (!incName.trim() || !Number.isFinite(amountNum) || amountNum <= 0) {
      onShowToast("Ingresa nombre y monto válido para la fuente de ingreso.");
      return;
    }
    setIsSavingIncome(true);
    try {
      await upsertIncomeSource({
        name: incName.trim(),
        amount: Number(amountNum.toFixed(2)),
        frequency: incFrequency,
        nextPaymentDate: incNextDate,
      });
      playCoin();
      setIncName("");
      setIncAmount("");
      onShowToast("¡Ingreso guardado!");
    } catch (err) {
      onShowToast(
        err instanceof Error ? err.message : "Error al guardar ingreso",
      );
    } finally {
      setIsSavingIncome(false);
    }
  };

  const handleAddCommitment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = Number(commAmount);
    if (!commTitle.trim() || !Number.isFinite(amountNum) || amountNum <= 0) {
      onShowToast("Ingresa nombre y monto válido para el compromiso fijo.");
      return;
    }
    setIsSavingComm(true);
    try {
      await addCommitment({
        title: commTitle.trim(),
        amount: Number(amountNum.toFixed(2)),
        category: commCategory,
        frequency: commFrequency,
        nextDueDate: commNextDate,
      });
      playCoin();
      setCommTitle("");
      setCommAmount("");
      onShowToast("¡Pago fijo guardado!");
    } catch (err) {
      onShowToast(
        err instanceof Error ? err.message : "Error al guardar compromiso",
      );
    } finally {
      setIsSavingComm(false);
    }
  };

  const handleSaveGoalQuick = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingGoal(true);
    try {
      await saveGoalWithSubGoals({
        id: profile.goal.id,
        title: goalTitle.trim() || "Meta principal",
        targetAmount: Number(goalTarget) || 15000,
        currentSaved: Number(goalSaved) || 0,
        weeklyContribution: Number(goalWeekly) || 0,
        savingsLocation: goalLocation,
        deadlineLabel: profile.goal.deadlineLabel,
        subGoals: profile.goal.subGoals ?? [],
      });
      playLevelUp();
      onShowToast("¡Meta principal actualizada!");
    } catch (err) {
      onShowToast(
        err instanceof Error ? err.message : "Error al actualizar la meta",
      );
    } finally {
      setIsSavingGoal(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Encabezado */}
      <div className="bg-white rounded-3xl border-2 border-b-4 border-slate-200 shadow-sm p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5 text-emerald-600" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold font-heading uppercase tracking-wider text-emerald-700 block break-words">
              {mode === "authenticated"
                ? `Cuenta sincronizada · ${profile.email}`
                : "Modo Demo Interactivo"}
            </span>
            <h2 className="text-xl font-bold font-heading text-slate-900">
              Editar Perfil
            </h2>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="h-10 px-4 rounded-xl border border-slate-300 bg-white hover:bg-rose-50 hover:border-rose-200 text-slate-800 hover:text-rose-700 text-xs font-bold font-heading flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0"
        >
          <LogOut className="w-4 h-4" />
          <span>Cerrar sesión</span>
        </button>
      </div>

      {/* Sub-pestañas */}
      <div
        role="tablist"
        className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-1.5 rounded-2xl bg-slate-100 border border-slate-200"
      >
        {PROFILE_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={activeTab === t.id}
            onClick={() => {
              playTap();
              setActiveTab(t.id);
            }}
            className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold font-heading transition-all cursor-pointer text-center ${
              activeTab === t.id
                ? "bg-white text-slate-900 shadow-2xs border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab !== "ingresos" && (
      <form
        onSubmit={handleSaveCoreProfile}
        className="bg-white rounded-3xl border-2 border-b-4 border-slate-200 shadow-sm p-5 sm:p-8 space-y-6"
      >
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSavingCore}
            className="h-11 px-5 rounded-2xl bg-[#10B981] hover:bg-emerald-600 text-white text-xs sm:text-sm font-bold font-heading border-2 border-emerald-600 border-b-4 border-b-emerald-800 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 shrink-0"
          >
            <Save className="w-4 h-4" />
            <span>{isSavingCore ? "Guardando cambios..." : "Guardar Perfil"}</span>
          </button>
        </div>

        {activeTab === "perfil" && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold font-heading text-slate-800 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            Datos Personales
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="space-y-1.5 block">
              <span className="text-xs font-bold text-slate-700 block whitespace-nowrap">
                Nombre completo
              </span>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ej. Carlos Mendoza"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </label>

            <label className="space-y-1.5 block">
              <span className="text-xs font-bold text-slate-700 block whitespace-nowrap">
                Apodo
              </span>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Ej. Charly"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </label>

            <label className="space-y-1.5 block">
              <span className="text-xs font-bold text-slate-700 block whitespace-nowrap">
                Edad (opcional)
              </span>
              <input
                type="number"
                min="12"
                max="110"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="Ej. 28"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </label>

            <label className="space-y-1.5 block">
              <span className="text-xs font-bold text-slate-700 block whitespace-nowrap">
                Dependientes económicos
              </span>
              <input
                type="number"
                min="0"
                max="20"
                value={dependentsCount}
                onChange={(e) => setDependentsCount(e.target.value)}
                placeholder="0"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </label>
          </div>

          {/* Lifestyle Context Tags */}
          <div className="space-y-2 pt-1">
            <span className="text-xs font-bold text-slate-700 block">
              Tu estilo de vida
            </span>
            <div className="flex flex-wrap gap-2">
              {LIFESTYLE_OPTIONS.map((opt) => {
                const isSelected = selectedTags.includes(opt.tag);
                return (
                  <button
                    key={opt.tag}
                    type="button"
                    onClick={() => toggleLifestyleTag(opt.tag)}
                    className={`px-3.5 py-2 rounded-2xl text-xs font-bold font-heading border-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? "bg-emerald-50 border-[#10B981] text-emerald-950 shadow-2xs"
                        : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    <span>{opt.emoji}</span>
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        )}

        {activeTab === "liquidez" && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold font-heading text-slate-800 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-emerald-600" />
            Tu Dinero y Protección
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 block">
              <span className="text-xs font-bold text-slate-700 block">
                Saldo disponible hoy
              </span>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={currentBalance}
                  onChange={(e) => setCurrentBalance(e.target.value)}
                  className="w-full h-10 pl-7 pr-3 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-900"
                />
              </div>
              <span className="text-[11px] text-slate-500 block">
                Dinero total disponible hoy en cuenta
              </span>
            </label>

            <label className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 block">
              <span className="text-xs font-bold text-slate-700 block">
                Colchón de emergencias
              </span>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={safetyBuffer}
                  onChange={(e) => setSafetyBuffer(e.target.value)}
                  className="w-full h-10 pl-7 pr-3 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-900"
                />
              </div>
              <span className="text-[11px] text-slate-500 block">
                Reserva mínima intocable para emergencias
              </span>
            </label>

            <label className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 block">
              <span className="text-xs font-bold text-slate-700 block">
                Gasto básico por día
              </span>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={dailyEssentialBurn}
                  onChange={(e) => setDailyEssentialBurn(e.target.value)}
                  className="w-full h-10 pl-7 pr-3 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-900"
                />
              </div>
              <span className="text-[11px] text-slate-500 block">
                Comida, transporte y básicos por día
              </span>
            </label>
          </div>
        </div>
        )}
      </form>
      )}

      {activeTab === "ingresos" && (
      <div className="space-y-6">
      {/* =====================================================================
          2. INCOME SOURCES & FIXED COMMITMENTS EDITOR (income_sources & commitments)
         ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fuentes de Ingreso (public.income_sources) */}
        <section className="bg-white rounded-3xl border-2 border-b-4 border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <Coins className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-base font-bold font-heading text-slate-900">
                  Mis Ingresos
                </h3>
                <p className="text-xs text-slate-500">
                  Nómina, becas o ingresos recurrentes
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {(profile.incomeSources ?? []).length > 0 ? (
              (profile.incomeSources ?? []).map((inc) => (
                <div
                  key={inc.id}
                  className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
                >
                  <div>
                    <p className="text-xs font-bold font-heading text-slate-900">
                      {inc.name}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      ${inc.amount.toLocaleString()} MXN ·{" "}
                      {inc.frequency === "weekly"
                        ? "Semanal"
                        : inc.frequency === "biweekly"
                          ? "Quincenal"
                          : inc.frequency === "monthly"
                            ? "Mensual"
                            : "Único"}{" "}
                      {inc.nextPaymentDate
                        ? `· Próximo: ${inc.nextPaymentDate}`
                        : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void deleteIncomeSource(inc.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                    title="Eliminar ingreso"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 italic">
                Aún no hay fuentes de ingreso registradas.
              </p>
            )}
          </div>

          <form
            onSubmit={handleAddIncome}
            className="pt-3 border-t border-slate-100 space-y-2.5"
          >
            <span className="text-xs font-bold text-slate-700 block">
              + Agregar fuente de ingreso
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                required
                placeholder="Ej. Nómina Quincenal"
                value={incName}
                onChange={(e) => setIncName(e.target.value)}
                className="h-9 px-3 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900"
              />
              <input
                type="number"
                min="1"
                step="0.01"
                required
                placeholder="Monto ($ MXN)"
                value={incAmount}
                onChange={(e) => setIncAmount(e.target.value)}
                className="h-9 px-3 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900"
              />
              <select
                value={incFrequency}
                onChange={(e) =>
                  setIncFrequency(e.target.value as CommitmentDbFrequency)
                }
                className="h-9 px-3 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-white"
              >
                <option value="weekly">Semanal</option>
                <option value="biweekly">Quincenal</option>
                <option value="monthly">Mensual</option>
                <option value="one_time">Único</option>
              </select>
              <input
                type="date"
                required
                value={incNextDate}
                onChange={(e) => setIncNextDate(e.target.value)}
                className="h-9 px-3 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900"
              />
            </div>
            <button
              type="submit"
              disabled={isSavingIncome}
              className="w-full h-9 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold font-heading cursor-pointer disabled:opacity-50"
            >
              {isSavingIncome ? "Guardando..." : "Guardar fuente de ingreso"}
            </button>
          </form>
        </section>

        {/* Gastos Fijos (public.commitments) */}
        <section className="bg-white rounded-3xl border-2 border-b-4 border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                <Receipt className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-bold font-heading text-slate-900">
                  Mis Pagos Fijos
                </h3>
                <p className="text-xs text-slate-500">
                  Renta, tarjetas, servicios y deudas
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {profile.commitments.length > 0 ? (
              profile.commitments.map((c) => (
                <div
                  key={c.id}
                  className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
                >
                  <div>
                    <p className="text-xs font-bold font-heading text-slate-900">
                      {c.title}{" "}
                      <span className="text-[10px] font-normal text-slate-500">
                        ({c.category})
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-500">
                      ${c.amount.toLocaleString()} MXN · Vence en {c.dueInDays}d
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void deactivateCommitment(c.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                    title="Desactivar compromiso"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 italic">
                No tienes gastos fijos activos registrados.
              </p>
            )}
          </div>

          <form
            onSubmit={handleAddCommitment}
            className="pt-3 border-t border-slate-100 space-y-2.5"
          >
            <span className="text-xs font-bold text-slate-700 block">
              + Agregar gasto fijo / compromiso
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                required
                placeholder="Ej. Renta o Internet"
                value={commTitle}
                onChange={(e) => setCommTitle(e.target.value)}
                className="h-9 px-3 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900"
              />
              <input
                type="number"
                min="1"
                step="0.01"
                required
                placeholder="Monto ($ MXN)"
                value={commAmount}
                onChange={(e) => setCommAmount(e.target.value)}
                className="h-9 px-3 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900"
              />
              <select
                value={commCategory}
                onChange={(e) => setCommCategory(e.target.value)}
                className="h-9 px-3 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-white"
              >
                <option value="Vivienda">Vivienda</option>
                <option value="Servicios">Servicios</option>
                <option value="Deuda">Deuda / Tarjeta</option>
                <option value="Transporte">Transporte</option>
                <option value="Educación">Educación</option>
                <option value="Otros">Otros</option>
              </select>
              <input
                type="date"
                required
                value={commNextDate}
                onChange={(e) => setCommNextDate(e.target.value)}
                className="h-9 px-3 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900"
              />
            </div>
            <button
              type="submit"
              disabled={isSavingComm}
              className="w-full h-9 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold font-heading cursor-pointer disabled:opacity-50"
            >
              {isSavingComm ? "Guardando..." : "Guardar gasto fijo"}
            </button>
          </form>
        </section>
      </div>

      {/* =====================================================================
          3. QUICK GOAL EDITOR (public.goals)
         ===================================================================== */}
      <form
        onSubmit={handleSaveGoalQuick}
        className="bg-white rounded-3xl border-2 border-b-4 border-slate-200 shadow-sm p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center">
              <Target className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-base font-bold font-heading text-slate-900">
                Meta de Ahorro Principal
              </h3>
              <p className="text-xs text-slate-500">
                Ahorro fijo semanal y monto acumulado actual
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSavingGoal}
            className="h-9 px-4 rounded-xl bg-[#10B981] hover:bg-emerald-600 text-white text-xs font-bold font-heading border-b-2 border-emerald-700 cursor-pointer disabled:opacity-50"
          >
            {isSavingGoal ? "Guardando..." : "Actualizar Meta"}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <label className="space-y-1 block">
            <span className="text-[11px] font-bold text-slate-600">
              Nombre de la Meta
            </span>
            <input
              type="text"
              required
              value={goalTitle}
              onChange={(e) => setGoalTitle(e.target.value)}
              className="w-full h-9 px-3 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900"
            />
          </label>

          <label className="space-y-1 block">
            <span className="text-[11px] font-bold text-slate-600">
              Objetivo ($ MXN)
            </span>
            <input
              type="number"
              min="1"
              step="0.01"
              required
              value={goalTarget}
              onChange={(e) => setGoalTarget(e.target.value)}
              className="w-full h-9 px-3 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900"
            />
          </label>

          <label className="space-y-1 block">
            <span className="text-[11px] font-bold text-slate-600">
              Ahorrado
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={goalSaved}
              onChange={(e) => setGoalSaved(e.target.value)}
              className="w-full h-9 px-3 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900"
            />
          </label>

          <label className="space-y-1 block">
            <span className="text-[11px] font-bold text-slate-600">
              Ahorro Semanal Fijo
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={goalWeekly}
              onChange={(e) => setGoalWeekly(e.target.value)}
              className="w-full h-9 px-3 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900"
            />
          </label>

          <label className="space-y-1 block">
            <span className="text-[11px] font-bold text-slate-600">
              ¿Dónde guardas tu ahorro?
            </span>
            <select
              value={goalLocation}
              onChange={(e) =>
                setGoalLocation(
                  e.target.value as "incluido" | "separado" | "desconocido",
                )
              }
              className="w-full h-9 px-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-white"
            >
              <option value="separado">Separado de mi saldo</option>
              <option value="incluido">Incluido en mi saldo</option>
              <option value="desconocido">Por definir</option>
            </select>
          </label>
        </div>
      </form>
      </div>
      )}

      {/* =====================================================================
          4. DEMO PROFILE SWITCHER & ACCOUNT SESSION ACTIONS
         ===================================================================== */}
      <div className="bg-white rounded-3xl border-2 border-b-4 border-slate-200 shadow-sm p-6 space-y-5">
        {mode === "demo" && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold font-heading text-slate-800">
              Perfiles Demo Precargados (Sandbox)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(["carlos", "mateo"] as const).map((key) => {
                const item = PRELOADED_SANDBOX_PROFILES[key];
                const isCurrent = profile.id === item.id;
                return (
                  <motion.button
                    key={key}
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      playCoin();
                      loadPreloadedSandboxProfile(key);
                      onNavigateToSimulate?.();
                      onShowToast(`Perfil cargado: ${item.name}`);
                    }}
                    className={`text-left p-4 rounded-2xl border-2 border-b-4 transition-all flex items-center justify-between cursor-pointer ${
                      isCurrent
                        ? "bg-emerald-50/50 border-[#10B981] border-b-emerald-600 shadow-2xs"
                        : "bg-white border-slate-200 border-b-slate-300 hover:border-slate-300"
                    }`}
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-bold font-heading text-slate-900">
                        {item.name}
                      </p>
                      <p className="text-xs text-slate-600">
                        Saldo: ${item.currentBalance.toLocaleString()} MXN ·{" "}
                        {item.commitments.length} compromisos fijos
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Meta: {item.goal.title} ($
                        {item.goal.targetAmount.toLocaleString()})
                      </p>
                    </div>
                    {isCurrent && (
                      <CheckCircle2
                        className="w-5 h-5 text-[#10B981] shrink-0"
                        strokeWidth={1.5}
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>

            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                playTap();
                router.push("/auth");
              }}
              className="w-full h-11 rounded-2xl border-2 border-b-4 border-slate-200 border-b-slate-300 bg-slate-50 hover:bg-slate-100 text-xs sm:text-sm font-bold font-heading text-slate-800 flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4" strokeWidth={1.5} />
              <span>Crear cuenta o personalizar perfil desde cero</span>
            </motion.button>
          </div>
        )}

        <button
          type="button"
          onClick={async () => {
            playTap();
            try {
              await signOut();
              router.replace("/auth");
            } catch (error) {
              console.error("Logout failed:", error);
            }
          }}
          className="w-full h-11 rounded-xl border border-slate-300 bg-white hover:bg-rose-50 hover:border-rose-200 text-slate-800 hover:text-rose-700 text-xs sm:text-sm font-bold font-heading flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </motion.div>
  );
}

