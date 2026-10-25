"use client";

import React, { useState, useMemo } from "react";
import {
  Wallet,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Clock,
  PiggyBank,
  ArrowRight,
  Send,
  Camera,
  TrendingDown,
  ShieldAlert,
  UserCheck,
  Calendar,
  Target,
  PlusCircle,
} from "lucide-react";

interface Commitment {
  id: string;
  title: string;
  amount: number;
  dueInDays: number;
  category: string;
}

interface Profile {
  id: string;
  name: string;
  roleTag: string;
  currentBalance: number;
  nextPaydayDays: number;
  nextPaydayAmount: number;
  safetyBuffer: number;
  dailyEssentialBurn: number;
  commitments: Commitment[];
  goal: {
    title: string;
    targetAmount: number;
    currentSaved: number;
    weeklyContribution: number;
    deadlineLabel: string;
  };
}

const INITIAL_PROFILES: Record<string, Profile> = {
  mateo: {
    id: "mateo",
    name: "Mateo (21 años)",
    roleTag: "Estudiante · Becario · Sin dependientes",
    currentBalance: 5000,
    nextPaydayDays: 6,
    nextPaydayAmount: 3500,
    safetyBuffer: 400,
    dailyEssentialBurn: 120,
    commitments: [
      { id: "c1", title: "Plan Celular", amount: 399, dueInDays: 3, category: "Servicios" },
    ],
    goal: {
      title: "Laptop para Ingeniería",
      targetAmount: 15000,
      currentSaved: 10500,
      weeklyContribution: 500,
      deadlineLabel: "Diciembre",
    },
  },
  carlos: {
    id: "carlos",
    name: "Carlos (32 años)",
    roleTag: "Trabajador · 2 Dependientes · Renta",
    currentBalance: 5000,
    nextPaydayDays: 6,
    nextPaydayAmount: 9500,
    safetyBuffer: 800,
    dailyEssentialBurn: 250,
    commitments: [
      { id: "c2", title: "Renta (Complemento)", amount: 2100, dueInDays: 2, category: "Vivienda" },
      { id: "c3", title: "Tarjeta de Crédito", amount: 500, dueInDays: 4, category: "Deuda" },
    ],
    goal: {
      title: "Fondo de Emergencia Familiar",
      targetAmount: 20000,
      currentSaved: 8000,
      weeklyContribution: 600,
      deadlineLabel: "Diciembre",
    },
  },
};

export default function PrePurchaseCopilot() {
  const [profiles, setProfiles] = useState<Record<string, Profile>>(INITIAL_PROFILES);
  const [activeProfileKey, setActiveProfileKey] = useState<"carlos" | "mateo">("carlos");
  const [itemName, setItemName] = useState<string>("Audífonos Inalámbricos Sony");
  const [itemPrice, setItemPrice] = useState<number>(2300);
  const [activeScenarioTab, setActiveScenarioTab] = useState<"now" | "wait" | "save">("now");
  const [quickExpenseText, setQuickExpenseText] = useState<string>("");
  const [recentQuickExpenses, setRecentQuickExpenses] = useState<{ label: string; amount: number }[]>([]);

  const profile = profiles[activeProfileKey];

  // Motor financiero determinista en tiempo real
  const evaluation = useMemo(() => {
    const commitmentsTotal = profile.commitments
      .filter((c) => c.dueInDays <= profile.nextPaydayDays)
      .reduce((acc, c) => acc + c.amount, 0);

    const essentialLivingCost = profile.dailyEssentialBurn * profile.nextPaydayDays;

    const safeToSpend = Math.max(
      0,
      profile.currentBalance - commitmentsTotal - essentialLivingCost - profile.safetyBuffer
    );

    const difference = safeToSpend - itemPrice;

    let status: "VIABLE" | "RIESGO_MODERADO" | "COMPROMETE_LIQUIDEZ" = "VIABLE";
    if (difference < 0) {
      status = "COMPROMETE_LIQUIDEZ";
    } else if (difference < profile.safetyBuffer * 0.5) {
      status = "RIESGO_MODERADO";
    }

    const weeksDelayed = Number((itemPrice / Math.max(1, profile.goal.weeklyContribution)).toFixed(1));
    const suggestedWeeklySave = 400;
    const weeksToSave = Math.ceil(itemPrice / suggestedWeeklySave);

    return {
      commitmentsTotal,
      essentialLivingCost,
      safeToSpend,
      difference,
      status,
      weeksDelayed,
      suggestedWeeklySave,
      weeksToSave,
    };
  }, [profile, itemPrice]);

  // Registro rápido de gastos por lenguaje natural ("Gasté 180 en comida")
  const handleQuickExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickExpenseText.trim()) return;

    const match = quickExpenseText.match(/(\d+(?:\.\d+)?)/);
    if (match) {
      const amount = parseFloat(match[1]);
      setProfiles((prev) => ({
        ...prev,
        [activeProfileKey]: {
          ...prev[activeProfileKey],
          currentBalance: Math.max(0, prev[activeProfileKey].currentBalance - amount),
        },
      }));
      setRecentQuickExpenses((prev) => [{ label: quickExpenseText, amount }, ...prev.slice(0, 2)]);
      setQuickExpenseText("");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16">
      {/* Top Navbar + Conmutador de Perfiles para Jueces */}
      <header className="border-b border-slate-800 bg-slate-900/70 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Sparkles className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight text-white">
                AntesDeGastar <span className="text-xs font-normal text-emerald-400 ml-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">Copiloto Pre-Compra</span>
              </h1>
              <p className="text-xs text-slate-400">
                Simulador determinista de liquidez y costo de oportunidad
              </p>
            </div>
          </div>

          {/* Selector de Perfil en Vivo (Modo Demo Jurado) */}
          <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 px-2.5 flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-emerald-400" strokeWidth={1.5} />
              Contexto Demo:
            </span>
            <button
              onClick={() => setActiveProfileKey("carlos")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeProfileKey === "carlos"
                  ? "bg-emerald-500 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Perfil B: Carlos ($5k · Con hijos/Renta)
            </button>
            <button
              onClick={() => setActiveProfileKey("mateo")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeProfileKey === "mateo"
                  ? "bg-emerald-500 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Perfil A: Mateo ($5k · Estudiante)
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* COLUMNA IZQUIERDA: Consulta de Compra + Contexto Financiero (5 cols) */}
        <section className="lg:col-span-5 space-y-6">
          {/* Card 1: Evaluador "¿Me conviene comprarlo?" */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4" strokeWidth={1.5} />
                1. ¿Me conviene comprarlo hoy?
              </h2>
              <span className="text-xs text-slate-400">Análisis instantáneo</span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">
                  ¿Qué estás a punto de comprar?
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="Ej. Audífonos Sony, Tenis, Cena..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    title="Escanear captura o etiqueta con Gemini Vision"
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-emerald-400 p-1 rounded-lg bg-slate-900 border border-slate-800"
                  >
                    <Camera className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5">
                  Precio del artículo ($ MXN)
                </label>
                <input
                  type="number"
                  value={itemPrice}
                  onChange={(e) => setItemPrice(Math.max(0, Number(e.target.value)))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-lg font-semibold text-emerald-400 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Botones rápidos de prueba para el Pitch */}
              <div>
                <span className="block text-[11px] text-slate-400 mb-2">
                  Ejemplos rápidos para simulación:
                </span>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "🎧 Audífonos $2,300", name: "Audífonos Inalámbricos Sony", price: 2300 },
                    { label: "🎮 Videojuego $1,200", name: "Videojuego Edición Estándar", price: 1200 },
                    { label: "👟 Tenis $1,800", name: "Tenis Deportivos", price: 1800 },
                    { label: "☕ Café y Cena $450", name: "Salida con amigos", price: 450 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setItemName(preset.name);
                        setItemPrice(preset.price);
                      }}
                      className="text-xs bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 transition"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Perfil Activo y Registro Rápido por Chat */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs text-slate-400">Perfil Financiero Activo</span>
                <h3 className="text-base font-semibold text-white">{profile.name}</h3>
                <p className="text-xs text-emerald-400 mt-0.5">{profile.roleTag}</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400">Saldo en Cuenta</span>
                <p className="text-lg font-bold text-white">
                  ${profile.currentBalance.toLocaleString()} <span className="text-xs font-normal text-slate-400">MXN</span>
                </p>
              </div>
            </div>

            {/* Obligaciones próximas detectadas antes de quincena */}
            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" strokeWidth={1.5} />
                  Compromisos antes de tu nómina (en {profile.nextPaydayDays} días):
                </span>
                <span className="font-medium text-amber-400">
                  -${evaluation.commitmentsTotal.toLocaleString()} MXN
                </span>
              </div>
              <div className="space-y-1.5">
                {profile.commitments.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between text-xs bg-slate-950/80 border border-slate-800/80 px-3 py-2 rounded-lg"
                  >
                    <span className="text-slate-300">{item.title}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">vence en {item.dueInDays}d</span>
                      <span className="font-semibold text-slate-200">${item.amount.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actualizar gasto por lenguaje natural (Solución al Problema B del Juez) */}
            <form onSubmit={handleQuickExpense} className="pt-2 border-t border-slate-800">
              <label className="block text-xs text-slate-400 mb-1.5">
                Actualización rápida sin formularios (Lenguaje Natural):
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={quickExpenseText}
                  onChange={(e) => setQuickExpenseText(e.target.value)}
                  placeholder='Ej. "Gasté 180 pesos en comida"'
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-xl text-xs font-medium flex items-center gap-1 transition"
                >
                  <PlusCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
                  Restar
                </button>
              </div>
              {recentQuickExpenses.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {recentQuickExpenses.map((exp, idx) => (
                    <span
                      key={idx}
                      className="text-[11px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-md"
                    >
                      ✓ -{exp.amount} MXN ({exp.label})
                    </span>
                  ))}
                </div>
              )}
            </form>
          </div>
        </section>

        {/* COLUMNA DERECHA: Veredicto + Cascada de Liquidez + Simulador de Futuro (7 cols) */}
        <section className="lg:col-span-7 space-y-6">
          {/* Card 3: Veredicto y Cascada Financiera Determinista */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
            {/* Banner de Estado */}
            <div
              className={`p-4 rounded-xl border flex items-start gap-3.5 mb-6 ${
                evaluation.status === "COMPROMETE_LIQUIDEZ"
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-200"
                  : evaluation.status === "RIESGO_MODERADO"
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-200"
                  : "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
              }`}
            >
              {evaluation.status === "COMPROMETE_LIQUIDEZ" ? (
                <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" strokeWidth={1.5} />
              ) : evaluation.status === "RIESGO_MODERADO" ? (
                <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" strokeWidth={1.5} />
              ) : (
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" strokeWidth={1.5} />
              )}

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-950/60">
                    {evaluation.status === "COMPROMETE_LIQUIDEZ"
                      ? "Compromete tu liquidez"
                      : evaluation.status === "RIESGO_MODERADO"
                      ? "Viable con precaución"
                      : "Compra viable hoy"}
                  </span>
                  <span className="text-xs opacity-80">
                    · Basado en compromisos hasta tu próxima nómina ({profile.nextPaydayDays} días)
                  </span>
                </div>

                <h3 className="text-lg font-bold text-white">
                  {evaluation.status === "COMPROMETE_LIQUIDEZ"
                    ? `Comprar "${itemName}" hoy supera tu dinero libre por $${Math.abs(
                        evaluation.difference
                      ).toLocaleString()} MXN`
                    : `Puedes comprar "${itemName}" y aún te quedan $${evaluation.difference.toLocaleString()} MXN libres`}
                </h3>

                <p className="text-xs leading-relaxed opacity-90">
                  {evaluation.status === "COMPROMETE_LIQUIDEZ"
                    ? `Aunque tienes $${profile.currentBalance.toLocaleString()} MXN en tu cuenta, debes cubrir $${evaluation.commitmentsTotal.toLocaleString()} de pagos fijos y $${evaluation.essentialLivingCost.toLocaleString()} de gastos esenciales antes de cobrar.`
                    : `Después de apartar tus pagos próximos ($${evaluation.commitmentsTotal.toLocaleString()}), tus gastos básicos de ${profile.nextPaydayDays} días y tu reserva de seguridad, tu liquidez soporta el gasto sin endeudarte.`}
                </p>
              </div>
            </div>

            {/* Desglose Matemático Paso a Paso (De "Cuánto tienes" a "Cuánto puedes gastar") */}
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Desglose Real: De tu saldo bancario a tu dinero libre hoy
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center mb-6">
              <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                <span className="text-[11px] text-slate-400 block">Saldo hoy</span>
                <span className="text-base font-bold text-white">
                  ${profile.currentBalance.toLocaleString()}
                </span>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                <span className="text-[11px] text-slate-400 block">Pagos fijos</span>
                <span className="text-base font-semibold text-rose-400">
                  -${evaluation.commitmentsTotal.toLocaleString()}
                </span>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                <span className="text-[11px] text-slate-400 block">
                  Gasto vital ({profile.nextPaydayDays}d)
                </span>
                <span className="text-base font-semibold text-amber-400">
                  -${evaluation.essentialLivingCost.toLocaleString()}
                </span>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                <span className="text-[11px] text-slate-400 block">Colchón seg.</span>
                <span className="text-base font-semibold text-slate-300">
                  -${profile.safetyBuffer.toLocaleString()}
                </span>
              </div>

              <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-xl">
                <span className="text-[11px] text-emerald-300 block font-medium">
                  Disponible Real
                </span>
                <span className="text-base font-bold text-emerald-400">
                  ${evaluation.safeToSpend.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Impacto en Meta Conectada (Costo de Oportunidad) */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
                  <Target className="w-4 h-4" strokeWidth={1.5} />
                  Costo de Oportunidad en tu Meta: &quot;{profile.goal.title}&quot;
                </div>
                <p className="text-xs text-slate-400">
                  Progreso actual: ${profile.goal.currentSaved.toLocaleString()} de $
                  {profile.goal.targetAmount.toLocaleString()} MXN (Aportas $
                  {profile.goal.weeklyContribution}/sem)
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs bg-amber-500/10 border border-amber-500/30 text-amber-300 px-3 py-1.5 rounded-lg font-medium inline-block">
                  Comprar hoy retrasa tu meta {evaluation.weeksDelayed} semanas
                </span>
              </div>
            </div>
          </div>

          {/* Card 4: Simulador del Futuro (Comprar hoy vs Esperar vs Ahorrar) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-400">
                  2. Simulador de Decisiones y Alternativas
                </h3>
                <p className="text-xs text-slate-400">
                  Compara qué pasa con tu dinero según cuándo y cómo decidas comprarlo
                </p>
              </div>
            </div>

            {/* Selector de Escenarios */}
            <div className="grid grid-cols-3 gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 mb-5">
              <button
                onClick={() => setActiveScenarioTab("now")}
                className={`py-2 px-3 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 ${
                  activeScenarioTab === "now"
                    ? "bg-slate-800 text-white border border-slate-700"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Wallet className="w-3.5 h-3.5" strokeWidth={1.5} />
                A. Comprar Hoy
              </button>
              <button
                onClick={() => setActiveScenarioTab("wait")}
                className={`py-2 px-3 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 ${
                  activeScenarioTab === "wait"
                    ? "bg-emerald-500 text-slate-950 font-semibold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
                B. Esperar Nómina ({profile.nextPaydayDays}d)
              </button>
              <button
                onClick={() => setActiveScenarioTab("save")}
                className={`py-2 px-3 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 ${
                  activeScenarioTab === "save"
                    ? "bg-emerald-500 text-slate-950 font-semibold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <PiggyBank className="w-3.5 h-3.5" strokeWidth={1.5} />
                C. Plan Micro-Ahorro
              </button>
            </div>

            {/* Contenido Dinámico del Escenario Seleccionado */}
            {activeScenarioTab === "now" && (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-3">
                <h4 className="text-base font-semibold text-white">
                  Escenario A: Pagar ${itemPrice.toLocaleString()} MXN de contado hoy
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {evaluation.status === "COMPROMETE_LIQUIDEZ"
                    ? `Tomarías $${Math.abs(
                        evaluation.difference
                      ).toLocaleString()} MXN que ya están etiquetados para tus pagos obligatorios de esta semana o tu reserva de emergencia.`
                    : `Tu presupuesto libre baja de $${evaluation.safeToSpend.toLocaleString()} a $${evaluation.difference.toLocaleString()} MXN hasta que vuelvas a cobrar en ${profile.nextPaydayDays} días.`}
                </p>
              </div>
            )}

            {activeScenarioTab === "wait" && (
              <div className="bg-slate-950 border border-emerald-500/30 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-semibold text-emerald-400">
                    Escenario B: Esperar {profile.nextPaydayDays} días a tu siguiente nómina
                  </h4>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                    Protege tu liquidez
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  En {profile.nextPaydayDays} días recibes tu ingreso de $
                  {profile.nextPaydayAmount.toLocaleString()} MXN y habrás liquidado tus compromisos
                  actuales (${evaluation.commitmentsTotal.toLocaleString()} MXN). Realizar la compra
                  entonces mantiene intacto tu fondo de seguridad de ${profile.safetyBuffer} MXN.
                </p>
              </div>
            )}

            {activeScenarioTab === "save" && (
              <div className="bg-slate-950 border border-emerald-500/30 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-semibold text-emerald-400">
                    Escenario C: Apartar ${evaluation.suggestedWeeklySave} MXN por semana
                  </h4>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                    Meta en {evaluation.weeksToSave} semanas
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Si destinas ${evaluation.suggestedWeeklySave} MXN semanales sin tocar el dinero de
                  tus pagos fijos ni frenar tu meta principal (&quot;{profile.goal.title}&quot;), completas los $
                  {itemPrice.toLocaleString()} MXN en {evaluation.weeksToSave} semanas con cero estrés
                  financiero.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}