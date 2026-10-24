"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Compass,
  GraduationCap,
  Briefcase,
  Home,
  Users,
  Wallet,
  Sparkles,
  Calendar,
  CreditCard,
  Zap,
  ShoppingBag,
  Plus,
  Trash2,
  Target,
  Laptop,
  Plane,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  useFinancial,
  type LifeContextTag,
  type PayFrequency,
  type Commitment,
  getRealisticEstimateForContext,
  buildRoleTagFromContext,
} from "@/context/FinancialContext";

const TOTAL_STEPS = 4;

const LIFE_OPTIONS: {
  id: LifeContextTag;
  title: string;
  description: string;
  icon: React.ElementType;
}[] = [
  {
    id: "estudio",
    title: "Estudio",
    description: "Universidad, posgrado o formación continua",
    icon: GraduationCap,
  },
  {
    id: "trabajo",
    title: "Trabajo",
    description: "Recibo ingresos por empleo, beca o actividad profesional",
    icon: Briefcase,
  },
  {
    id: "independiente",
    title: "Vivo por mi cuenta",
    description: "Cubro renta, hipoteca o gastos de mi hogar",
    icon: Home,
  },
  {
    id: "dependientes",
    title: "Mantengo a otras personas",
    description: "Familia, hijos o personas que dependen de mi ingreso",
    icon: Users,
  },
];

const QUICK_COMMITMENT_CHIPS: {
  id: string;
  title: string;
  amount: number;
  dueInDays: number;
  category: string;
  icon: React.ElementType;
}[] = [
  {
    id: "chip-renta",
    title: "Renta / Vivienda",
    amount: 2500,
    dueInDays: 3,
    category: "Vivienda",
    icon: Home,
  },
  {
    id: "chip-tarjeta",
    title: "Pago de Tarjeta",
    amount: 850,
    dueInDays: 4,
    category: "Deuda",
    icon: CreditCard,
  },
  {
    id: "chip-servicios",
    title: "Luz / Internet / Celular",
    amount: 499,
    dueInDays: 2,
    category: "Servicios",
    icon: Zap,
  },
  {
    id: "chip-super",
    title: "Súper de la semana",
    amount: 900,
    dueInDays: 5,
    category: "Esenciales",
    icon: ShoppingBag,
  },
];

const GOAL_PRESETS = [
  { title: "Fondo de emergencia", amount: 15000, icon: ShieldCheck },
  { title: "Laptop", amount: 18000, icon: Laptop },
  { title: "Viaje", amount: 12000, icon: Plane },
];

const stepVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 28 : -28,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: {
      duration: 0.38,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 28 : -28,
    opacity: 0,
    transition: {
      duration: 0.25,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  }),
};

export default function OnboardingPage() {
  const router = useRouter();
  const { completeOnboarding } = useFinancial();

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [isCalculating, setIsCalculating] = useState(false);

  // Paso 1: Contexto de vida
  const [selectedContext, setSelectedContext] = useState<LifeContextTag[]>([
    "trabajo",
  ]);

  // Paso 2: Ingresos y liquidez actual
  const [currentBalance, setCurrentBalance] = useState<string>("5000");
  const [payFrequency, setPayFrequency] = useState<PayFrequency>("quincenal");
  const [nextPaydayDays, setNextPaydayDays] = useState<number>(6);
  const [nextPaydayAmount, setNextPaydayAmount] = useState<string>("7500");
  const [usedEstimateBadge, setUsedEstimateBadge] = useState(false);

  // Paso 3: Compromisos próximos (7 días)
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [customCommitmentTitle, setCustomCommitmentTitle] = useState("");
  const [customCommitmentAmount, setCustomCommitmentAmount] = useState("");

  // Paso 4: Meta principal
  const [goalTitle, setGoalTitle] = useState("Fondo de emergencia");
  const [goalTargetAmount, setGoalTargetAmount] = useState<string>("15000");

  const progressPercentage = (step / TOTAL_STEPS) * 100;

  const toggleLifeContext = (tag: LifeContextTag) => {
    setSelectedContext((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    );
  };

  const handleApplyRealisticEstimate = () => {
    const estimate = getRealisticEstimateForContext(selectedContext);
    setCurrentBalance(String(estimate.currentBalance));
    setPayFrequency(estimate.payFrequency);
    setNextPaydayDays(estimate.nextPaydayDays);
    setNextPaydayAmount(String(estimate.nextPaydayAmount));
    setUsedEstimateBadge(true);
  };

  const toggleCommitmentChip = (chip: (typeof QUICK_COMMITMENT_CHIPS)[number]) => {
    setCommitments((prev) => {
      const exists = prev.some((c) => c.id === chip.id);
      if (exists) {
        return prev.filter((c) => c.id !== chip.id);
      }
      return [
        ...prev,
        {
          id: chip.id,
          title: chip.title,
          amount: chip.amount,
          dueInDays: chip.dueInDays,
          category: chip.category,
        },
      ];
    });
  };

  const handleAddCustomCommitment = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = Number(customCommitmentAmount);
    if (!customCommitmentTitle.trim() || !amountNum || amountNum <= 0) return;

    setCommitments((prev) => [
      ...prev,
      {
        id: `custom-${Date.now()}`,
        title: customCommitmentTitle.trim(),
        amount: amountNum,
        dueInDays: 4,
        category: "Otro",
      },
    ]);
    setCustomCommitmentTitle("");
    setCustomCommitmentAmount("");
  };

  const handleRemoveCommitment = (id: string) => {
    setCommitments((prev) => prev.filter((c) => c.id !== id));
  };

  const goNext = () => {
    if (step < TOTAL_STEPS) {
      setDirection(1);
      setStep((s) => s + 1);
    } else {
      handleFinishOnboarding();
    }
  };

  const goBack = () => {
    if (step > 1) {
      setDirection(-1);
      setStep((s) => s - 1);
    }
  };

  const handleFinishOnboarding = () => {
    setIsCalculating(true);

    completeOnboarding({
      lifeContext: selectedContext.length > 0 ? selectedContext : ["trabajo"],
      currentBalance: Math.max(0, Number(currentBalance) || 0),
      payFrequency,
      nextPaydayDays: Math.max(1, nextPaydayDays),
      nextPaydayAmount: Math.max(0, Number(nextPaydayAmount) || 0),
      commitments,
      goalTitle: goalTitle.trim() || "Fondo de emergencia",
      goalTargetAmount: Math.max(500, Number(goalTargetAmount) || 10000),
    });

    setTimeout(() => {
      router.push("/app");
    }, 1750);
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-slate-900 flex flex-col justify-between font-sans relative overflow-hidden">
      {/* Top Navbar + Animated Progress Bar */}
      <header className="sticky top-0 z-30 bg-[#FAF8F5]/90 backdrop-blur-md border-b border-[#E6E1DA]/80">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-[#FAF8F5] flex items-center justify-center shadow-2xs">
              <Compass className="w-4 h-4" strokeWidth={1.5} />
            </div>
            <span className="text-sm font-semibold tracking-tight text-slate-900">
              AntesDeGastar
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-500">
              Paso <strong className="text-slate-900">{step}</strong> de{" "}
              {TOTAL_STEPS}
            </span>
            <Badge
              variant="outline"
              className="border-[#DCD5CA] bg-white text-slate-700 text-[11px] font-medium hidden sm:inline-flex"
            >
              ~60 segundos
            </Badge>
          </div>
        </div>

        {/* Framer Motion Top Progress Bar */}
        <div className="w-full h-1 bg-[#EAE5DC] overflow-hidden">
          <motion.div
            className="h-full bg-slate-900"
            initial={{ width: "25%" }}
            animate={{ width: `${progressPercentage}%` }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </header>

      {/* Main Wizard Area */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-10">
        <div className="w-full max-w-xl">
          <AnimatePresence mode="wait" custom={direction}>
            {isCalculating ? (
              <motion.div
                key="calculating-screen"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="text-center py-12 px-6 rounded-3xl border border-[#E6E1DA] bg-white shadow-sm space-y-6"
              >
                <div className="w-14 h-14 rounded-2xl bg-slate-900 text-[#FAF8F5] flex items-center justify-center mx-auto shadow-xs">
                  <Loader2 className="w-7 h-7 animate-spin" strokeWidth={1.5} />
                </div>

                <div className="space-y-2">
                  <Badge
                    variant="outline"
                    className="border-emerald-300 bg-emerald-50 text-emerald-900 text-xs font-medium px-3 py-0.5"
                  >
                    Motor financiero listo
                  </Badge>
                  <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
                    Calculando tu liquidez real...
                  </h2>
                  <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                    Separando tus compromisos de los próximos días y protegiendo tu meta{" "}
                    <span className="font-medium text-slate-900">
                      “{goalTitle || "Fondo de emergencia"}”
                    </span>{" "}
                    para mostrarte cuánto puedes gastar con tranquilidad.
                  </p>
                </div>

                <div className="max-w-xs mx-auto space-y-2 pt-2 text-left text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <CheckCircle2
                      className="w-4 h-4 text-emerald-700 shrink-0"
                      strokeWidth={1.5}
                    />
                    <span>Contexto: {buildRoleTagFromContext(selectedContext)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2
                      className="w-4 h-4 text-emerald-700 shrink-0"
                      strokeWidth={1.5}
                    />
                    <span>
                      Saldo base: ${Number(currentBalance || 0).toLocaleString()} MXN
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2
                      className="w-4 h-4 text-emerald-700 shrink-0"
                      strokeWidth={1.5}
                    />
                    <span>
                      Compromisos próximos: {commitments.length} registrados
                    </span>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={`step-${step}`}
                custom={direction}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="space-y-6"
              >
                {/* PASO 1: Contexto de vida */}
                {step === 1 && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                        1 · Tu contexto actual
                      </span>
                      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
                        ¿Cómo describirías tu momento de vida hoy?
                      </h1>
                      <p className="text-sm text-slate-600">
                        Selecciona todas las opciones que apliquen. Esto nos ayuda a calibrar tu colchón de seguridad sin pedir datos sensibles.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {LIFE_OPTIONS.map((option) => {
                        const Icon = option.icon;
                        const isSelected = selectedContext.includes(option.id);
                        return (
                          <motion.button
                            key={option.id}
                            type="button"
                            whileHover={{ y: -2 }}
                            whileTap={{ scale: 0.99 }}
                            onClick={() => toggleLifeContext(option.id)}
                            className={`text-left p-4 rounded-2xl border transition-all flex flex-col justify-between gap-4 cursor-pointer ${
                              isSelected
                                ? "bg-slate-900 text-[#FAF8F5] border-slate-900 shadow-sm"
                                : "bg-white text-slate-900 border-[#E6E1DA] hover:border-slate-400"
                            }`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <div
                                className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                                  isSelected
                                    ? "bg-white/10 border-white/20 text-[#FAF8F5]"
                                    : "bg-[#FAF8F5] border-[#E6E1DA] text-slate-900"
                                }`}
                              >
                                <Icon className="w-5 h-5" strokeWidth={1.5} />
                              </div>
                              <div
                                className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                                  isSelected
                                    ? "bg-emerald-400 border-emerald-400 text-slate-950"
                                    : "border-slate-300"
                                }`}
                              >
                                {isSelected && (
                                  <Check className="w-3.5 h-3.5" strokeWidth={2} />
                                )}
                              </div>
                            </div>

                            <div>
                              <p
                                className={`text-base font-semibold ${
                                  isSelected ? "text-white" : "text-slate-900"
                                }`}
                              >
                                {option.title}
                              </p>
                              <p
                                className={`text-xs mt-1 leading-relaxed ${
                                  isSelected ? "text-slate-300" : "text-slate-500"
                                }`}
                              >
                                {option.description}
                              </p>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between pt-4">
                      <Link
                        href="/auth"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
                        Volver a acceso
                      </Link>

                      <Button
                        type="button"
                        onClick={goNext}
                        disabled={selectedContext.length === 0}
                        size="lg"
                        className="h-11 px-6 rounded-xl bg-slate-900 text-[#FAF8F5] hover:bg-slate-800 text-sm font-medium gap-2 cursor-pointer"
                      >
                        Continuar
                        <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                      </Button>
                    </div>
                  </div>
                )}

                {/* PASO 2: Ingresos y liquidez actual */}
                {step === 2 && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                        2 · Ingresos y liquidez actual
                      </span>
                      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
                        ¿Cuánto tienes disponible hoy y cada cuándo recibes ingresos?
                      </h1>
                      <p className="text-sm text-slate-600">
                        No necesitas el centavo exacto; un aproximado basta para calcular tu margen real hasta tu próximo cobro.
                      </p>
                    </div>

                    {/* Botón destacado: No estoy seguro, usar un estimado */}
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.005 }}
                      whileTap={{ scale: 0.995 }}
                      onClick={handleApplyRealisticEstimate}
                      className="w-full text-left rounded-2xl border border-emerald-300/90 bg-emerald-50/70 hover:bg-emerald-50 p-4 transition-all flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-white border border-emerald-200 text-emerald-800 flex items-center justify-center shrink-0">
                          <Sparkles className="w-4 h-4" strokeWidth={1.5} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            No estoy seguro, usar un estimado
                          </p>
                          <p className="text-xs text-slate-600">
                            Autocompletar valores realistas según:{" "}
                            <span className="font-medium text-slate-800">
                              {buildRoleTagFromContext(selectedContext)}
                            </span>
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-medium text-emerald-800 bg-white px-2.5 py-1 rounded-lg border border-emerald-200 shrink-0">
                        Autocompletar
                      </span>
                    </motion.button>

                    <Card className="bg-white border-[#E6E1DA] shadow-2xs py-5">
                      <CardContent className="px-5 space-y-5">
                        {usedEstimateBadge && (
                          <div className="rounded-lg bg-[#FAF8F5] border border-[#E6E1DA] px-3 py-2 text-xs text-slate-700 flex items-center justify-between">
                            <span>
                              ✓ Estimado aplicado según tu perfil. Puedes ajustarlo libremente.
                            </span>
                          </div>
                        )}

                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1.5">
                            Saldo disponible hoy ($ MXN)
                          </label>
                          <div className="relative">
                            <Wallet
                              className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
                              strokeWidth={1.5}
                            />
                            <input
                              type="number"
                              min={0}
                              value={currentBalance}
                              onChange={(e) => setCurrentBalance(e.target.value)}
                              placeholder="Ej. 5000"
                              className="w-full h-11 pl-10 pr-14 rounded-xl border border-[#E6E1DA] bg-[#FAF8F5]/70 text-base font-semibold text-slate-900 focus:bg-white focus:border-slate-900 focus:outline-none"
                            />
                            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">
                              MXN
                            </span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1.5">
                            ¿Cada cuándo recibes ingresos?
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            {(
                              [
                                { id: "semanal", label: "Semanal", defaultDays: 5 },
                                { id: "quincenal", label: "Quincenal", defaultDays: 6 },
                                { id: "mensual", label: "Mensual", defaultDays: 12 },
                              ] as const
                            ).map((freq) => (
                              <button
                                key={freq.id}
                                type="button"
                                onClick={() => {
                                  setPayFrequency(freq.id);
                                  setNextPaydayDays(freq.defaultDays);
                                }}
                                className={`py-2.5 px-3 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                                  payFrequency === freq.id
                                    ? "bg-slate-900 text-[#FAF8F5] border-slate-900"
                                    : "bg-[#FAF8F5] text-slate-700 border-[#E6E1DA] hover:border-slate-400"
                                }`}
                              >
                                {freq.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1.5">
                              Días para tu próximo pago
                            </label>
                            <div className="relative">
                              <Calendar
                                className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
                                strokeWidth={1.5}
                              />
                              <input
                                type="number"
                                min={1}
                                max={31}
                                value={nextPaydayDays}
                                onChange={(e) =>
                                  setNextPaydayDays(Math.max(1, Number(e.target.value)))
                                }
                                className="w-full h-10 pl-10 pr-12 rounded-xl border border-[#E6E1DA] bg-[#FAF8F5]/70 text-sm font-medium text-slate-900 focus:bg-white focus:border-slate-900 focus:outline-none"
                              />
                              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                                días
                              </span>
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1.5">
                              Monto aproximado de tu próximo ingreso
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={nextPaydayAmount}
                              onChange={(e) => setNextPaydayAmount(e.target.value)}
                              placeholder="Ej. 7500"
                              className="w-full h-10 px-3.5 rounded-xl border border-[#E6E1DA] bg-[#FAF8F5]/70 text-sm font-medium text-slate-900 focus:bg-white focus:border-slate-900 focus:outline-none"
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="flex items-center justify-between pt-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={goBack}
                        className="h-11 px-4 rounded-xl text-slate-600 hover:text-slate-900 gap-1.5 cursor-pointer"
                      >
                        <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
                        Atrás
                      </Button>

                      <Button
                        type="button"
                        onClick={goNext}
                        size="lg"
                        className="h-11 px-6 rounded-xl bg-slate-900 text-[#FAF8F5] hover:bg-slate-800 text-sm font-medium gap-2 cursor-pointer"
                      >
                        Continuar
                        <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                      </Button>
                    </div>
                  </div>
                )}

                {/* PASO 3: Compromisos próximos */}
                {step === 3 && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                        3 · Compromisos en puerta
                      </span>
                      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
                        ¿Tienes algún pago fuerte en los próximos 7 días?
                      </h1>
                      <p className="text-sm text-slate-600">
                        Toca un chip rápido para apartar ese dinero de tu saldo disponible en un clic, o salta este paso si ya tienes todo cubierto.
                      </p>
                    </div>

                    {/* Chips rápidos para agregar en un clic */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {QUICK_COMMITMENT_CHIPS.map((chip) => {
                        const Icon = chip.icon;
                        const active = commitments.some((c) => c.id === chip.id);
                        return (
                          <motion.button
                            key={chip.id}
                            type="button"
                            whileHover={{ y: -1.5 }}
                            whileTap={{ scale: 0.99 }}
                            onClick={() => toggleCommitmentChip(chip)}
                            className={`p-3.5 rounded-xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
                              active
                                ? "bg-slate-900 text-[#FAF8F5] border-slate-900 shadow-2xs"
                                : "bg-white text-slate-900 border-[#E6E1DA] hover:border-slate-400"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                                  active
                                    ? "bg-white/10 border-white/20 text-white"
                                    : "bg-[#FAF8F5] border-[#E6E1DA] text-slate-700"
                                }`}
                              >
                                <Icon className="w-4 h-4" strokeWidth={1.5} />
                              </div>
                              <div>
                                <p className="text-xs font-semibold">
                                  {chip.title}
                                </p>
                                <p
                                  className={`text-[11px] font-mono ${
                                    active ? "text-emerald-300" : "text-slate-500"
                                  }`}
                                >
                                  ${chip.amount.toLocaleString()} MXN · en {chip.dueInDays}d
                                </p>
                              </div>
                            </div>
                            <span
                              className={`text-xs font-medium px-2 py-0.5 rounded-md ${
                                active
                                  ? "bg-white/15 text-white"
                                  : "bg-[#FAF8F5] text-slate-600"
                              }`}
                            >
                              {active ? "Agregado ✓" : "+ Agregar"}
                            </span>
                          </motion.button>
                        );
                      })}
                    </div>

                    {/* Agregar compromiso personalizado */}
                    <Card className="bg-white border-[#E6E1DA] shadow-2xs py-4">
                      <CardContent className="px-4 space-y-3">
                        <form
                          onSubmit={handleAddCustomCommitment}
                          className="flex flex-col sm:flex-row gap-2"
                        >
                          <input
                            type="text"
                            value={customCommitmentTitle}
                            onChange={(e) => setCustomCommitmentTitle(e.target.value)}
                            placeholder="Otro pago (ej. Dentista, Gasolina...)"
                            className="flex-1 h-9 px-3 rounded-lg border border-[#E6E1DA] bg-[#FAF8F5]/70 text-xs text-slate-900 focus:bg-white focus:border-slate-900 focus:outline-none"
                          />
                          <div className="flex gap-2">
                            <input
                              type="number"
                              min={1}
                              value={customCommitmentAmount}
                              onChange={(e) => setCustomCommitmentAmount(e.target.value)}
                              placeholder="$ Monto"
                              className="w-28 h-9 px-3 rounded-lg border border-[#E6E1DA] bg-[#FAF8F5]/70 text-xs text-slate-900 focus:bg-white focus:border-slate-900 focus:outline-none"
                            />
                            <Button
                              type="submit"
                              variant="outline"
                              size="sm"
                              className="h-9 px-3 rounded-lg border-[#E6E1DA] text-xs cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                              Añadir
                            </Button>
                          </div>
                        </form>

                        {commitments.length > 0 && (
                          <div className="pt-2 border-t border-[#F3EFEA] space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] text-slate-500">
                              <span>Pagos apartados para esta semana:</span>
                              <span className="font-mono font-semibold text-slate-900">
                                Total: $
                                {commitments
                                  .reduce((sum, item) => sum + item.amount, 0)
                                  .toLocaleString()}{" "}
                                MXN
                              </span>
                            </div>
                            {commitments.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between text-xs bg-[#FAF8F5] px-3 py-1.5 rounded-lg border border-[#ECE7DF]"
                              >
                                <span className="font-medium text-slate-800">
                                  {item.title}
                                </span>
                                <div className="flex items-center gap-2.5">
                                  <span className="font-mono text-slate-700">
                                    ${item.amount.toLocaleString()}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveCommitment(item.id)}
                                    className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                    aria-label="Eliminar compromiso"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <div className="flex items-center justify-between pt-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={goBack}
                        className="h-11 px-4 rounded-xl text-slate-600 hover:text-slate-900 gap-1.5 cursor-pointer"
                      >
                        <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
                        Atrás
                      </Button>

                      <div className="flex items-center gap-2">
                        {commitments.length === 0 && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={goNext}
                            className="h-11 px-4 rounded-xl border-[#E6E1DA] bg-white text-slate-600 hover:text-slate-900 text-xs font-medium cursor-pointer"
                          >
                            Saltar paso
                          </Button>
                        )}
                        <Button
                          type="button"
                          onClick={goNext}
                          size="lg"
                          className="h-11 px-6 rounded-xl bg-slate-900 text-[#FAF8F5] hover:bg-slate-800 text-sm font-medium gap-2 cursor-pointer"
                        >
                          Continuar
                          <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* PASO 4: Tu meta principal */}
                {step === 4 && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                        4 · Tu meta principal
                      </span>
                      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
                        ¿Para qué estás ahorrando hoy?
                      </h1>
                      <p className="text-sm text-slate-600">
                        Conectamos cada compra que consultes con esta meta para mostrarte si te acerca o te retrasa antes de pagar.
                      </p>
                    </div>

                    {/* Presets de metas */}
                    <div className="grid grid-cols-3 gap-2.5">
                      {GOAL_PRESETS.map((preset) => {
                        const Icon = preset.icon;
                        const isSelected = goalTitle === preset.title;
                        return (
                          <motion.button
                            key={preset.title}
                            type="button"
                            whileHover={{ y: -1.5 }}
                            whileTap={{ scale: 0.99 }}
                            onClick={() => {
                              setGoalTitle(preset.title);
                              setGoalTargetAmount(String(preset.amount));
                            }}
                            className={`p-3.5 rounded-xl border text-left transition-all flex flex-col gap-2 cursor-pointer ${
                              isSelected
                                ? "bg-slate-900 text-[#FAF8F5] border-slate-900 shadow-2xs"
                                : "bg-white text-slate-900 border-[#E6E1DA] hover:border-slate-400"
                            }`}
                          >
                            <Icon
                              className={`w-4 h-4 ${
                                isSelected ? "text-emerald-300" : "text-slate-700"
                              }`}
                              strokeWidth={1.5}
                            />
                            <div>
                              <p className="text-xs font-semibold leading-tight">
                                {preset.title}
                              </p>
                              <p
                                className={`text-[11px] font-mono mt-0.5 ${
                                  isSelected ? "text-slate-300" : "text-slate-500"
                                }`}
                              >
                                ${preset.amount.toLocaleString()}
                              </p>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>

                    <Card className="bg-white border-[#E6E1DA] shadow-2xs py-5">
                      <CardContent className="px-5 space-y-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1.5">
                            Nombre de tu meta
                          </label>
                          <div className="relative">
                            <Target
                              className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
                              strokeWidth={1.5}
                            />
                            <input
                              type="text"
                              value={goalTitle}
                              onChange={(e) => setGoalTitle(e.target.value)}
                              placeholder="Ej. Laptop, Viaje, Fondo de emergencia..."
                              className="w-full h-11 pl-10 pr-4 rounded-xl border border-[#E6E1DA] bg-[#FAF8F5]/70 text-sm font-medium text-slate-900 focus:bg-white focus:border-slate-900 focus:outline-none"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1.5">
                            Monto objetivo ($ MXN)
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              min={500}
                              value={goalTargetAmount}
                              onChange={(e) => setGoalTargetAmount(e.target.value)}
                              placeholder="15000"
                              className="w-full h-11 px-4 pr-14 rounded-xl border border-[#E6E1DA] bg-[#FAF8F5]/70 text-base font-semibold text-slate-900 focus:bg-white focus:border-slate-900 focus:outline-none"
                            />
                            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">
                              MXN
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="flex items-center justify-between pt-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={goBack}
                        className="h-11 px-4 rounded-xl text-slate-600 hover:text-slate-900 gap-1.5 cursor-pointer"
                      >
                        <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
                        Atrás
                      </Button>

                      <Button
                        type="button"
                        onClick={handleFinishOnboarding}
                        size="lg"
                        className="h-11 px-7 rounded-xl bg-slate-900 text-[#FAF8F5] hover:bg-slate-800 text-sm font-medium gap-2 shadow-sm cursor-pointer"
                      >
                        Calcular mi liquidez real
                        <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                      </Button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="py-5 text-center text-xs text-slate-400">
        Tus respuestas se guardan en tu sesión para personalizar el simulador pre-compra.
      </footer>
    </div>
  );
}

