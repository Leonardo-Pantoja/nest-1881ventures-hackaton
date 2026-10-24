"use client";

import React, { useState, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Compass,
  ChevronDown,
  HelpCircle,
  Sparkles,
  Camera,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Clock,
  PiggyBank,
  Wallet,
  Target,
  SlidersHorizontal,
  UserCheck,
  X,
  Send,
  Calendar,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  useFinancial,
  PRELOADED_SANDBOX_PROFILES,
} from "@/context/FinancialContext";

const QUICK_PURCHASE_EXAMPLES = [
  { label: "Audífonos de $2,300", name: "Audífonos Inalámbricos Sony", price: 2300 },
  { label: "Tenis de $1,800", name: "Tenis Deportivos", price: 1800 },
  { label: "Videojuego de $1,200", name: "Videojuego Edición Estándar", price: 1200 },
  { label: "Cena con amigos de $550", name: "Cena con amigos", price: 550 },
];

export default function AppDashboardPage() {
  const router = useRouter();
  const { profile, updateProfile, loadPreloadedSandboxProfile } = useFinancial();

  // Progressive disclosure states
  const [showWhyBreakdown, setShowWhyBreakdown] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showTourModal, setShowTourModal] = useState(false);

  // Pre-purchase Copilot states
  const [queryText, setQueryText] = useState("Audífonos de $2,300");
  const [parsedItemName, setParsedItemName] = useState("Audífonos Inalámbricos Sony");
  const [parsedItemPrice, setParsedItemPrice] = useState<number>(2300);
  const [uploadedImageName, setUploadedImageName] = useState<string | null>(null);
  const [showEvaluationView, setShowEvaluationView] = useState(false);
  const [activeScenarioTab, setActiveScenarioTab] = useState<"now" | "wait" | "save">("now");

  // Quick expense bottom bar & toast feedback
  const [isQuickExpenseOpen, setIsQuickExpenseOpen] = useState(false);
  const [quickExpenseInput, setQuickExpenseInput] = useState("");
  const [toastFeedback, setToastFeedback] = useState<{
    id: number;
    amount: number;
    label: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Deterministic Financial Calculation
  const financialMetrics = useMemo(() => {
    const commitmentsTotal = profile.commitments
      .filter((c) => c.dueInDays <= profile.nextPaydayDays)
      .reduce((acc, c) => acc + c.amount, 0);

    const essentialLivingCost = profile.dailyEssentialBurn * profile.nextPaydayDays;

    const safeToSpend = Math.max(
      0,
      profile.currentBalance -
        commitmentsTotal -
        essentialLivingCost -
        profile.safetyBuffer
    );

    const difference = safeToSpend - parsedItemPrice;

    let status: "VIABLE" | "PRECAUCION" | "COMPROMETE" = "VIABLE";
    if (difference < 0) {
      status = "COMPROMETE";
    } else if (difference < profile.safetyBuffer * 0.5) {
      status = "PRECAUCION";
    }

    const weeksDelayed = Number(
      (parsedItemPrice / Math.max(1, profile.goal.weeklyContribution)).toFixed(1)
    );
    const suggestedWeeklySave = Math.max(
      250,
      Math.round(profile.goal.weeklyContribution * 0.75)
    );
    const weeksToSave = Math.max(1, Math.ceil(parsedItemPrice / suggestedWeeklySave));

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
  }, [profile, parsedItemPrice]);

  // Parse free-form text like "Audífonos de $2,300" or "Cafetera 1450"
  const handleQueryInputChange = (value: string) => {
    setQueryText(value);

    const normalized = value.replace(/,/g, "");
    const priceMatch = normalized.match(/(\d+(?:\.\d+)?)/);
    if (priceMatch) {
      const price = Math.max(0, Math.round(parseFloat(priceMatch[1])));
      setParsedItemPrice(price);
      const cleanedName = value
        .replace(/\$?\s*\d[\d,.]*/g, "")
        .replace(/\bde\b|\bpor\b|\bmxn\b|\bpesos\b/gi, "")
        .trim();
      setParsedItemName(cleanedName || "Artículo consultado");
    } else {
      setParsedItemName(value.trim() || "Artículo consultado");
    }
  };

  const handleSelectExample = (example: (typeof QUICK_PURCHASE_EXAMPLES)[number]) => {
    setQueryText(example.label);
    setParsedItemName(example.name);
    setParsedItemPrice(example.price);
    setUploadedImageName(null);
    setShowEvaluationView(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedImageName(file.name);
    setQueryText(`Captura: ${file.name.replace(/\.[^/.]+$/, "")} ($1,950)`);
    setParsedItemName("Producto detectado en imagen");
    setParsedItemPrice(1950);
    setShowEvaluationView(true);
  };

  const handleAnalyzeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryText.trim() && parsedItemPrice <= 0) return;
    setShowEvaluationView(true);
  };

  const handleQuickExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickExpenseInput.trim()) return;

    const normalized = quickExpenseInput.replace(/,/g, "");
    const match = normalized.match(/(\d+(?:\.\d+)?)/);
    if (!match) return;

    const amount = Math.round(parseFloat(match[1]));
    if (amount <= 0) return;

    updateProfile({
      currentBalance: Math.max(0, profile.currentBalance - amount),
    });

    const feedbackObj = {
      id: Date.now(),
      amount,
      label: quickExpenseInput.trim(),
    };
    setToastFeedback(feedbackObj);
    setQuickExpenseInput("");
    setIsQuickExpenseOpen(false);

    setTimeout(() => {
      setToastFeedback((current) =>
        current?.id === feedbackObj.id ? null : current
      );
    }, 4000);
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-slate-900 flex flex-col justify-between font-sans pb-24">
      {/* Clean Header with Navigation, Discreet Profile Selector & Quick Tour Button */}
      <header className="sticky top-0 z-30 border-b border-[#E6E1DA]/90 bg-[#FAF8F5]/90 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-[#FAF8F5] flex items-center justify-center shadow-2xs group-hover:bg-slate-800 transition-colors">
              <Compass className="w-4 h-4" strokeWidth={1.5} />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight text-slate-900 leading-none">
                AntesDeGastar
              </span>
              <span className="text-[11px] text-slate-500 mt-0.5 hidden sm:inline">
                Copiloto Pre-Compra
              </span>
            </div>
          </Link>

          {/* Right Controls: Profile Selector + Quick Guide */}
          <div className="flex items-center gap-2.5 relative">
            {/* Discreet Profile Indicator & Switcher */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowProfileMenu((prev) => !prev)}
                className="h-9 px-3 rounded-xl border border-[#E6E1DA] bg-white hover:border-slate-300 text-xs font-medium text-slate-800 flex items-center gap-2 shadow-2xs transition-all cursor-pointer"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                <span className="truncate max-w-[140px] sm:max-w-[200px]">
                  {profile.name}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                    showProfileMenu ? "rotate-180" : ""
                  }`}
                  strokeWidth={1.5}
                />
              </button>

              <AnimatePresence>
                {showProfileMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.98 }}
                    transition={{ duration: 0.18 }}
                    className="absolute right-0 mt-2 w-72 rounded-2xl border border-[#E6E1DA] bg-white shadow-lg p-3 z-40 space-y-2.5"
                  >
                    <div className="px-2 py-1 border-b border-[#F3EFEA]">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                        Perfil activo
                      </p>
                      <p className="text-xs font-semibold text-slate-900 mt-0.5">
                        {profile.name}
                      </p>
                      <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                        {profile.roleTag}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <p className="px-2 text-[11px] text-slate-400 font-medium">
                        Cambiar perfil demo (Plaid Sandbox):
                      </p>
                      {(["carlos", "mateo"] as const).map((key) => {
                        const item = PRELOADED_SANDBOX_PROFILES[key];
                        const isCurrent = profile.id === item.id;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => {
                              loadPreloadedSandboxProfile(key);
                              setShowProfileMenu(false);
                            }}
                            className={`w-full text-left px-2.5 py-2 rounded-xl text-xs transition-colors flex items-center justify-between cursor-pointer ${
                              isCurrent
                                ? "bg-[#FAF8F5] font-semibold text-slate-900 border border-[#E6E1DA]"
                                : "text-slate-600 hover:bg-[#FAF8F5] hover:text-slate-900"
                            }`}
                          >
                            <div>
                              <span className="block">{item.name}</span>
                              <span className="text-[10px] text-slate-400">
                                Saldo ${item.currentBalance.toLocaleString()} ·{" "}
                                {item.commitments.length} pagos próximos
                              </span>
                            </div>
                            {isCurrent && (
                              <UserCheck
                                className="w-3.5 h-3.5 text-emerald-700 shrink-0"
                                strokeWidth={1.5}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <div className="pt-2 border-t border-[#F3EFEA]">
                      <button
                        type="button"
                        onClick={() => {
                          setShowProfileMenu(false);
                          router.push("/onboarding");
                        }}
                        className="w-full px-2.5 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-[#FAF8F5] hover:text-slate-900 flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" strokeWidth={1.5} />
                        <span>Editar mi contexto (Onboarding)</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Quick Tour / Help Button */}
            <button
              type="button"
              onClick={() => setShowTourModal(true)}
              className="h-9 px-3 rounded-xl border border-[#E6E1DA] bg-white hover:bg-[#F3EFEA]/70 text-xs font-medium text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Guía rápida de uso"
            >
              <HelpCircle className="w-4 h-4 text-slate-600" strokeWidth={1.5} />
              <span className="hidden sm:inline">Guía rápida</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content with Progressive Disclosure */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 pt-8 sm:pt-12 space-y-8">
        {/* 1. Tarjeta Hero de Liquidez (Single Protagonist Number + Progressive Breakdown) */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <Card className="bg-white border-[#E2DCD3] shadow-xs rounded-3xl py-7 sm:py-8 px-2 sm:px-4">
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-emerald-300/80 bg-emerald-50/80 text-emerald-900 text-xs font-medium px-2.5 py-0.5"
                  >
                    Liquidez real disponible
                  </Badge>
                  <span className="text-xs text-slate-500">
                    · Próximo ingreso en {profile.nextPaydayDays} días
                  </span>
                </div>

                <span className="text-xs text-slate-400 font-medium">
                  Meta activa: {profile.goal.title}
                </span>
              </div>

              <div className="pt-1">
                <p className="text-sm sm:text-base text-slate-600 font-medium">
                  Hoy puedes gastar con tranquilidad:
                </p>
                <div className="mt-1 flex items-baseline gap-2.5 flex-wrap">
                  <motion.span
                    key={financialMetrics.safeToSpend}
                    initial={{ opacity: 0.6, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-4xl sm:text-5xl font-semibold tracking-tight text-slate-900 font-mono"
                  >
                    ${financialMetrics.safeToSpend.toLocaleString()}
                  </motion.span>
                  <span className="text-base font-medium text-slate-500">
                    MXN
                  </span>
                </div>
              </div>

              {/* Progressive Disclosure Toggle: "¿Por qué este monto?" */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowWhyBreakdown((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-[#FAF8F5] hover:bg-[#F3EFEA] border border-[#E6E1DA] px-3.5 py-2 rounded-xl transition-colors cursor-pointer"
                >
                  <span>¿Por qué este monto?</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      showWhyBreakdown ? "rotate-180" : ""
                    }`}
                    strokeWidth={1.5}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {showWhyBreakdown && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 pt-4 border-t border-[#EFECE6] space-y-3">
                        <p className="text-xs text-slate-600 leading-relaxed">
                          Para que no gastes dinero que ya tiene dueño esta semana, restamos de tu saldo actual lo que necesitas para llegar tranquilo a tu próximo pago:
                        </p>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E6E1DA]">
                            <span className="text-[11px] text-slate-500 block">
                              Saldo actual
                            </span>
                            <span className="text-sm font-semibold text-slate-900 font-mono">
                              ${profile.currentBalance.toLocaleString()}
                            </span>
                          </div>

                          <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E6E1DA]">
                            <span className="text-[11px] text-slate-500 block">
                              Pagos próximos
                            </span>
                            <span className="text-sm font-semibold text-rose-700 font-mono">
                              −${financialMetrics.commitmentsTotal.toLocaleString()}
                            </span>
                          </div>

                          <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E6E1DA]">
                            <span className="text-[11px] text-slate-500 block">
                              Básicos ({profile.nextPaydayDays} días)
                            </span>
                            <span className="text-sm font-semibold text-amber-800 font-mono">
                              −${financialMetrics.essentialLivingCost.toLocaleString()}
                            </span>
                          </div>

                          <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E6E1DA]">
                            <span className="text-[11px] text-slate-500 block">
                              Reserva de paz
                            </span>
                            <span className="text-sm font-semibold text-slate-700 font-mono">
                              −${profile.safetyBuffer.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {profile.commitments.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-500">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.5} />
                            <span>Incluye:</span>
                            {profile.commitments.map((c) => (
                              <span
                                key={c.id}
                                className="bg-white border border-[#E6E1DA] px-2 py-0.5 rounded-md text-slate-700"
                              >
                                {c.title} (${c.amount.toLocaleString()})
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* 2. El Copiloto Pre-Compra (Centro de la pantalla) */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08 }}
          className="space-y-4"
        >
          <Card className="bg-white border-[#E2DCD3] shadow-xs rounded-3xl py-6 px-2 sm:px-4">
            <CardContent className="space-y-5">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-medium text-emerald-800">
                  <Sparkles className="w-4 h-4" strokeWidth={1.5} />
                  <span>Copiloto Pre-Compra</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">
                  ¿Qué estás pensando comprar hoy?
                </h2>
                <p className="text-xs sm:text-sm text-slate-600">
                  Escribe el artículo y su precio, elige un ejemplo rápido o sube una captura de pantalla.
                </p>
              </div>

              <form onSubmit={handleAnalyzeSubmit} className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={queryText}
                      onChange={(e) => handleQueryInputChange(e.target.value)}
                      placeholder='Ej. "Audífonos de $2,300" o "Tenis de $1,800"'
                      className="w-full h-12 pl-4 pr-12 rounded-2xl border border-[#DCD5CA] bg-[#FAF8F5]/80 text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-900 focus:outline-none transition-all"
                    />
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      title="Subir imagen o captura del producto"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-[#EFECE6] transition-colors cursor-pointer"
                    >
                      <Camera className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="h-12 px-6 rounded-2xl bg-slate-900 text-[#FAF8F5] hover:bg-slate-800 text-sm font-medium gap-2 shrink-0 cursor-pointer shadow-xs"
                  >
                    <span>Analizar compra</span>
                    <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                  </Button>
                </div>

                {uploadedImageName && (
                  <div className="inline-flex items-center gap-2 text-xs bg-[#FAF8F5] border border-[#E6E1DA] px-3 py-1 rounded-lg text-slate-700">
                    <Camera className="w-3.5 h-3.5 text-emerald-700" strokeWidth={1.5} />
                    <span>Imagen cargada: {uploadedImageName}</span>
                    <button
                      type="button"
                      onClick={() => setUploadedImageName(null)}
                      className="text-slate-400 hover:text-slate-700"
                    >
                      <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </button>
                  </div>
                )}
              </form>

              {/* Quick Example Pills */}
              <div className="space-y-2 pt-1">
                <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block">
                  Ejemplos rápidos para probar:
                </span>
                <div className="flex flex-wrap gap-2">
                  {QUICK_PURCHASE_EXAMPLES.map((example) => {
                    const isActive =
                      parsedItemPrice === example.price &&
                      parsedItemName === example.name &&
                      showEvaluationView;
                    return (
                      <motion.button
                        key={example.label}
                        type="button"
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleSelectExample(example)}
                        className={`text-xs px-3.5 py-2 rounded-xl border transition-all cursor-pointer ${
                          isActive
                            ? "bg-slate-900 text-[#FAF8F5] border-slate-900 font-medium"
                            : "bg-[#FAF8F5] hover:bg-[#F3EFEA] text-slate-700 border-[#E6E1DA]"
                        }`}
                      >
                        {example.label}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* 3. Vista Detallada de Evaluación (Progressive Disclosure: Opens only on "Analizar compra") */}
        <AnimatePresence>
          {showEvaluationView && (
            <motion.section
              key="detailed-evaluation"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-5"
            >
              <Card className="bg-white border-[#DCD5CA] shadow-sm rounded-3xl py-6 px-2 sm:px-4">
                <CardContent className="space-y-6">
                  {/* Top Bar of Evaluation */}
                  <div className="flex items-center justify-between border-b border-[#F3EFEA] pb-4">
                    <div>
                      <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                        Evaluación pre-compra
                      </span>
                      <h3 className="text-lg font-semibold text-slate-900 mt-0.5">
                        {parsedItemName} ·{" "}
                        <span className="font-mono">
                          ${parsedItemPrice.toLocaleString()} MXN
                        </span>
                      </h3>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowEvaluationView(false)}
                      className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-[#FAF8F5] transition-colors cursor-pointer"
                      aria-label="Cerrar evaluación"
                    >
                      <X className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                  </div>

                  {/* Verdict Banner */}
                  <div
                    className={`p-4 sm:p-5 rounded-2xl border flex items-start gap-3.5 ${
                      financialMetrics.status === "COMPROMETE"
                        ? "bg-rose-50/70 border-rose-200 text-rose-950"
                        : financialMetrics.status === "PRECAUCION"
                        ? "bg-amber-50/80 border-amber-200 text-amber-950"
                        : "bg-emerald-50/80 border-emerald-200 text-emerald-950"
                    }`}
                  >
                    {financialMetrics.status === "COMPROMETE" ? (
                      <ShieldAlert
                        className="w-6 h-6 text-rose-700 shrink-0 mt-0.5"
                        strokeWidth={1.5}
                      />
                    ) : financialMetrics.status === "PRECAUCION" ? (
                      <AlertTriangle
                        className="w-6 h-6 text-amber-700 shrink-0 mt-0.5"
                        strokeWidth={1.5}
                      />
                    ) : (
                      <CheckCircle2
                        className="w-6 h-6 text-emerald-700 shrink-0 mt-0.5"
                        strokeWidth={1.5}
                      />
                    )}

                    <div className="space-y-1">
                      <span className="text-xs font-semibold uppercase tracking-wider">
                        {financialMetrics.status === "COMPROMETE"
                          ? "Hoy compromete tu liquidez"
                          : financialMetrics.status === "PRECAUCION"
                          ? "Viable, pero ajusta tu margen"
                          : "Compra viable con tranquilidad"}
                      </span>

                      <p className="text-base sm:text-lg font-semibold leading-snug">
                        {financialMetrics.status === "COMPROMETE"
                          ? `Te faltarían $${Math.abs(
                              financialMetrics.difference
                            ).toLocaleString()} MXN de liquidez libre para no tocar tus pagos próximos.`
                          : `Si lo compras hoy, aún conservas $${financialMetrics.difference.toLocaleString()} MXN libres hasta tu próximo ingreso.`}
                      </p>

                      <p className="text-xs sm:text-sm opacity-85 leading-relaxed">
                        {financialMetrics.status === "COMPROMETE"
                          ? `Tu disponible real hoy es de $${financialMetrics.safeToSpend.toLocaleString()} MXN tras proteger tus compromisos de los próximos ${profile.nextPaydayDays} días.`
                          : `Tus pagos fijos ($${financialMetrics.commitmentsTotal.toLocaleString()} MXN) y tu reserva de tranquilidad quedan protegidos.`}
                      </p>
                    </div>
                  </div>

                  {/* Goal Impact Pill */}
                  <div className="rounded-2xl bg-[#FAF8F5] border border-[#E6E1DA] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white border border-[#E6E1DA] text-slate-800 flex items-center justify-center shrink-0">
                        <Target className="w-4 h-4" strokeWidth={1.5} />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500">
                          Impacto en tu meta: “{profile.goal.title}”
                        </p>
                        <p className="text-sm font-semibold text-slate-900">
                          Equivale a {financialMetrics.weeksDelayed} semanas de tu ritmo de ahorro
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-mono text-slate-600 bg-white border border-[#E6E1DA] px-3 py-1.5 rounded-xl shrink-0">
                      Meta: ${profile.goal.targetAmount.toLocaleString()} MXN
                    </span>
                  </div>

                  {/* 3 Scenarios Comparison (Cuándo y cómo comprar) */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Alternativas para decidir sin estrés:
                    </p>

                    <div className="grid grid-cols-3 gap-2 p-1 rounded-2xl bg-[#FAF8F5] border border-[#E6E1DA]">
                      <button
                        type="button"
                        onClick={() => setActiveScenarioTab("now")}
                        className={`py-2 px-3 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          activeScenarioTab === "now"
                            ? "bg-white text-slate-900 shadow-2xs border border-[#E6E1DA]"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        <Wallet className="w-3.5 h-3.5" strokeWidth={1.5} />
                        <span>Comprar hoy</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveScenarioTab("wait")}
                        className={`py-2 px-3 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          activeScenarioTab === "wait"
                            ? "bg-slate-900 text-[#FAF8F5] shadow-2xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
                        <span>En {profile.nextPaydayDays} días</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveScenarioTab("save")}
                        className={`py-2 px-3 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          activeScenarioTab === "save"
                            ? "bg-slate-900 text-[#FAF8F5] shadow-2xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        <PiggyBank className="w-3.5 h-3.5" strokeWidth={1.5} />
                        <span>Micro-ahorro</span>
                      </button>
                    </div>

                    <div className="rounded-2xl border border-[#E6E1DA] bg-[#FAF8F5]/70 p-4 text-sm text-slate-700 leading-relaxed">
                      {activeScenarioTab === "now" && (
                        <p>
                          {financialMetrics.status === "COMPROMETE"
                            ? `Pagar $${parsedItemPrice.toLocaleString()} MXN hoy tomaría dinero destinado a tus compromisos próximos ($${financialMetrics.commitmentsTotal.toLocaleString()} MXN) o a tus gastos básicos de la semana.`
                            : `Tu liquidez libre pasaría de $${financialMetrics.safeToSpend.toLocaleString()} a $${financialMetrics.difference.toLocaleString()} MXN durante los próximos ${profile.nextPaydayDays} días.`}
                        </p>
                      )}

                      {activeScenarioTab === "wait" && (
                        <p>
                          Si esperas{" "}
                          <strong className="text-slate-900">
                            {profile.nextPaydayDays} días
                          </strong>{" "}
                          a tu próximo ingreso (${profile.nextPaydayAmount.toLocaleString()} MXN), ya habrás cubierto tus pagos actuales y podrás comprarlo manteniendo intacta tu reserva de seguridad.
                        </p>
                      )}

                      {activeScenarioTab === "save" && (
                        <p>
                          Apartando{" "}
                          <strong className="text-slate-900">
                            ${financialMetrics.suggestedWeeklySave} MXN por semana
                          </strong>
                          , reúnes los ${parsedItemPrice.toLocaleString()} MXN en{" "}
                          <strong className="text-slate-900">
                            {financialMetrics.weeksToSave} semanas
                          </strong>{" "}
                          sin frenar tu meta “{profile.goal.title}” ni desajustar tu quincena.
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {/* Toast Visual Feedback for Quick Expense */}
      <AnimatePresence>
        {toastFeedback && (
          <motion.div
            key={toastFeedback.id}
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 rounded-2xl bg-slate-900 text-[#FAF8F5] px-4 py-3 shadow-lg border border-slate-800 flex items-center gap-3 text-xs sm:text-sm"
          >
            <CheckCircle2
              className="w-4 h-4 text-emerald-400 shrink-0"
              strokeWidth={1.5}
            />
            <span>
              Gasto registrado:{" "}
              <strong className="font-mono">
                −${toastFeedback.amount.toLocaleString()} MXN
              </strong>{" "}
              ({toastFeedback.label}) · Liquidez actualizada
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Discreet Floating Bottom Bar: "Registrar un gasto rápido por texto" */}
      <div className="fixed bottom-4 inset-x-0 z-30 px-4 pointer-events-none">
        <div className="max-w-xl mx-auto flex justify-center pointer-events-auto">
          <AnimatePresence mode="wait">
            {!isQuickExpenseOpen ? (
              <motion.button
                key="collapsed-pill"
                type="button"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                whileHover={{ y: -1.5 }}
                onClick={() => setIsQuickExpenseOpen(true)}
                className="h-11 px-5 rounded-full bg-white/95 backdrop-blur-md border border-[#DCD5CA] shadow-md text-xs sm:text-sm font-medium text-slate-800 hover:border-slate-400 flex items-center gap-2.5 transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-emerald-700" strokeWidth={1.5} />
                <span>Registrar un gasto rápido por texto</span>
                <span className="text-slate-400 hidden sm:inline">
                  (ej. “Gasté 150 en comida”)
                </span>
              </motion.button>
            ) : (
              <motion.form
                key="expanded-bar"
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.98 }}
                onSubmit={handleQuickExpenseSubmit}
                className="w-full rounded-2xl bg-white border border-slate-300 shadow-lg p-2 flex items-center gap-2"
              >
                <input
                  type="text"
                  autoFocus
                  value={quickExpenseInput}
                  onChange={(e) => setQuickExpenseInput(e.target.value)}
                  placeholder='Escribe natural: "Gasté 150 en comida" o "Uber 95"'
                  className="flex-1 h-9 px-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 bg-transparent focus:outline-none"
                />
                <Button
                  type="submit"
                  size="sm"
                  className="h-9 px-4 rounded-xl bg-slate-900 text-[#FAF8F5] hover:bg-slate-800 text-xs font-medium gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>Restar</span>
                </Button>
                <button
                  type="button"
                  onClick={() => setIsQuickExpenseOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-[#FAF8F5] transition-colors cursor-pointer"
                  aria-label="Cerrar registro rápido"
                >
                  <X className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Onboarding Tour / Quick Guide Modal */}
      <AnimatePresence>
        {showTourModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setShowTourModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-3xl bg-[#FAF8F5] border border-[#E6E1DA] shadow-xl p-6 space-y-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Badge
                    variant="outline"
                    className="border-[#DCD5CA] bg-white text-slate-700 text-[11px] mb-2"
                  >
                    Guía rápida · 30 segundos
                  </Badge>
                  <h3 className="text-lg font-semibold text-slate-900">
                    Cómo usar tu Copiloto Pre-Compra
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTourModal(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </div>

              <div className="space-y-3 text-xs sm:text-sm text-slate-700">
                <div className="p-3.5 rounded-2xl bg-white border border-[#E6E1DA] space-y-1">
                  <p className="font-semibold text-slate-900">
                    1. Tu número protagonista
                  </p>
                  <p className="text-slate-600 text-xs leading-relaxed">
                    El monto superior ya descuenta tus pagos fijos próximos y tu reserva vital. Haz clic en <strong>“¿Por qué este monto?”</strong> cuando quieras ver la resta completa.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-[#E6E1DA] space-y-1">
                  <p className="font-semibold text-slate-900">
                    2. Consulta antes de pagar
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Escribe cualquier antojo o compra planeada y presiona <strong>“Analizar compra”</strong> para comparar si conviene pagar hoy, esperar a tu nómina o usar micro-ahorro.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-[#E6E1DA] space-y-1">
                  <p className="font-semibold text-slate-900">
                    3. Registro rápido por texto
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Usa la barra inferior para anotar gastos cotidianos como <em>“Gasté 150 en comida”</em> y mantener tu liquidez al día en un segundo.
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  type="button"
                  onClick={() => setShowTourModal(false)}
                  className="h-10 px-5 rounded-xl bg-slate-900 text-[#FAF8F5] hover:bg-slate-800 text-xs font-medium cursor-pointer"
                >
                  Entendido
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

