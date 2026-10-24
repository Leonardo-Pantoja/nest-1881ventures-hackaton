"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
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
  SlidersHorizontal,
  UserCheck,
  X,
  Send,
  Calendar,
  BookmarkCheck,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import PurchaseEvaluationFlow from "@/components/PurchaseEvaluationFlow";
import QuickGuideModal from "@/components/QuickGuideModal";
import FinancialPlantWidget from "@/components/FinancialPlantWidget";
import {
  useFinancial,
  PRELOADED_SANDBOX_PROFILES,
} from "@/context/FinancialContext";
import type { EvaluateApiResponse } from "@/app/api/evaluate/route";

const QUICK_PURCHASE_EXAMPLES = [
  { label: "Audífonos de $2,300", name: "Audífonos Inalámbricos Sony", price: 2300 },
  { label: "Tenis de $1,800", name: "Tenis Deportivos", price: 1800 },
  { label: "Videojuego de $1,200", name: "Videojuego Edición Estándar", price: 1200 },
  { label: "Cena con amigos de $550", name: "Cena con amigos", price: 550 },
];

const FIRST_VISIT_GUIDE_KEY = "antesdegastar_seen_quick_guide_v1";

export default function AppDashboardPage() {
  const router = useRouter();
  const {
    profile,
    updateProfile,
    loadPreloadedSandboxProfile,
    setPendingEvaluation,
  } = useFinancial();

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

  // /api/evaluate state
  const [apiEvaluation, setApiEvaluation] = useState<EvaluateApiResponse | null>(null);
  const [isEvaluatingApi, setIsEvaluatingApi] = useState(false);

  // Quick expense bottom bar & toast feedback
  const [isQuickExpenseOpen, setIsQuickExpenseOpen] = useState(false);
  const [quickExpenseInput, setQuickExpenseInput] = useState("");
  const [toastFeedback, setToastFeedback] = useState<{
    id: number;
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-open the 3-slide welcome guide the first time the user enters /app
  useEffect(() => {
    try {
      const hasSeen = localStorage.getItem(FIRST_VISIT_GUIDE_KEY);
      if (!hasSeen) {
        setShowTourModal(true);
        localStorage.setItem(FIRST_VISIT_GUIDE_KEY, "true");
      }
    } catch {
      // Ignore storage access errors
    }
  }, []);

  const triggerToast = (message: string) => {
    const id = Date.now();
    setToastFeedback({ id, message });
    setTimeout(() => {
      setToastFeedback((current) => (current?.id === id ? null : current));
    }, 4200);
  };

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

    return {
      commitmentsTotal,
      essentialLivingCost,
      safeToSpend,
    };
  }, [profile]);

  // Call /api/evaluate with automatic local fallback if offline or error
  const runEvaluation = async (name: string, price: number, imageName?: string | null) => {
    setPendingEvaluation({
      name,
      price,
      imageName: imageName ?? null,
    });
    setShowEvaluationView(true);
    setIsEvaluatingApi(true);

    try {
      const response = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemName: name,
          itemPrice: price,
          profile,
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as EvaluateApiResponse;
        setApiEvaluation(data);
      } else {
        setApiEvaluation(null);
      }
    } catch {
      // Local deterministic fallback inside PurchaseEvaluationFlow handles offline seamlessly
      setApiEvaluation(null);
    } finally {
      setIsEvaluatingApi(false);
    }
  };

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
    void runEvaluation(example.name, example.price, null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedImageName(file.name);
    setQueryText(`Captura: ${file.name.replace(/\.[^/.]+$/, "")} ($1,950)`);
    setParsedItemName("Producto detectado en imagen");
    setParsedItemPrice(1950);
    void runEvaluation("Producto detectado en imagen", 1950, file.name);
  };

  const handleAnalyzeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryText.trim() && parsedItemPrice <= 0) return;
    void runEvaluation(parsedItemName, parsedItemPrice, uploadedImageName);
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

    triggerToast(
      `Gasto registrado: −$${amount.toLocaleString()} MXN (${quickExpenseInput.trim()}) · Liquidez actualizada`
    );
    setQuickExpenseInput("");
    setIsQuickExpenseOpen(false);
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
        {/* Protagonist Gamified Financial Plant Widget */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <FinancialPlantWidget
            simulationState={
              financialMetrics.safeToSpend < parsedItemPrice && showEvaluationView
                ? "danger"
                : "normal"
            }
          />
        </motion.section>

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
                    disabled={isEvaluatingApi}
                    size="lg"
                    className="h-12 px-6 rounded-2xl bg-slate-900 text-[#FAF8F5] hover:bg-slate-800 text-sm font-medium gap-2 shrink-0 cursor-pointer shadow-xs"
                  >
                    {isEvaluatingApi ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
                        <span>Evaluando...</span>
                      </>
                    ) : (
                      <>
                        <span>Analizar compra</span>
                        <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                      </>
                    )}
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

          {/* Saved Wishlist Pill (only if user has saved items) */}
          {profile.wishlist && profile.wishlist.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-[#E6E1DA] bg-white px-4 py-3 flex items-center justify-between gap-3 shadow-2xs"
            >
              <div className="flex items-center gap-2.5 text-xs text-slate-700">
                <BookmarkCheck className="w-4 h-4 text-emerald-700 shrink-0" strokeWidth={1.5} />
                <span>
                  En tu lista de deseos:{" "}
                  {profile.wishlist.map((w) => `${w.name} ($${w.price.toLocaleString()})`).join(" · ")}
                </span>
              </div>
              <span className="text-[11px] font-medium text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full shrink-0">
                Liquidez protegida
              </span>
            </motion.div>
          )}
        </motion.section>
      </main>

      {/* 3. Fullscreen Animated Panel inside /app for Interactive Purchase Evaluation */}
      <AnimatePresence>
        {showEvaluationView && (
          <motion.div
            key="evaluation-fullscreen-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs overflow-y-auto flex items-start sm:items-center justify-center p-3 sm:p-6"
            onClick={() => setShowEvaluationView(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl my-auto"
            >
              <PurchaseEvaluationFlow
                itemName={parsedItemName}
                itemPrice={parsedItemPrice}
                apiEvaluation={apiEvaluation}
                isLoadingApi={isEvaluatingApi}
                onClose={() => setShowEvaluationView(false)}
                onActionCompleted={(msg) => triggerToast(msg)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Visual Feedback */}
      <AnimatePresence>
        {toastFeedback && (
          <motion.div
            key={toastFeedback.id}
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 rounded-2xl bg-slate-900 text-[#FAF8F5] px-4 py-3 shadow-lg border border-slate-800 flex items-center gap-3 text-xs sm:text-sm max-w-md w-[92%] sm:w-auto"
          >
            <CheckCircle2
              className="w-4 h-4 text-emerald-400 shrink-0"
              strokeWidth={1.5}
            />
            <span>{toastFeedback.message}</span>
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

      {/* 3-Slide Interactive Quick Guide Modal (Auto-opens on first visit to /app) */}
      <QuickGuideModal
        isOpen={showTourModal}
        onClose={() => setShowTourModal(false)}
      />
    </div>
  );
}
