"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Compass,
  ArrowRight,
  SlidersHorizontal,
  SearchCheck,
  CalendarCheck2,
  Sparkles,
  Sprout,
  Flame,
  Zap,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { playTap, playCoin, playLevelUp } from "@/lib/soundEffects";
import { useFinancial } from "@/context/FinancialContext";

const QUICK_STEPS = [
  {
    number: "01",
    emoji: "🪙",
    badge: "30 seg",
    title: "Elige tu nivel con 1 toque",
    tag: "🪙 $1,500 · 💰 $3,000 · 💎 $5,000+",
    icon: SlidersHorizontal,
    cardStyle:
      "border-emerald-300 border-b-emerald-600 bg-gradient-to-b from-white to-emerald-50/70",
  },
  {
    number: "02",
    emoji: "📸",
    badge: "IA Láser",
    title: "Escanea o simula tu compra",
    tag: "Tenis, audífonos o capturas",
    icon: SearchCheck,
    cardStyle:
      "border-amber-300 border-b-amber-500 bg-gradient-to-b from-white to-amber-50/70",
  },
  {
    number: "03",
    emoji: "🌳",
    badge: "+50 XP",
    title: "Haz crecer tu Planta Financiera",
    tag: "5 niveles de evolución y rachas 🔥",
    icon: CalendarCheck2,
    cardStyle:
      "border-teal-300 border-b-teal-600 bg-gradient-to-b from-white to-teal-50/70",
  },
];

const PLANT_LEVELS_STRIP = [
  { lvl: 1, label: "1. Supervivencia 🌱" },
  { lvl: 2, label: "2. Estabilidad 🌿" },
  { lvl: 3, label: "3. Seguridad 🪴" },
  { lvl: 4, label: "4. Libertad 🌳" },
  { lvl: 5, label: "5. Abundancia ✨" },
];

export default function LandingPage() {
  const router = useRouter();
  const { loadPreloadedSandboxProfile, startFreshOnboarding } = useFinancial();

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-slate-900 flex flex-col justify-between font-sans overflow-x-hidden">
      {/* Minimalist Gamified Navbar */}
      <header className="sticky top-0 z-30 border-b border-[#E6E1DA]/80 bg-[#FAF8F5]/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            onClick={() => playTap()}
            className="flex items-center gap-2.5 group"
          >
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-[#FAF8F5] flex items-center justify-center shadow-xs">
              <Compass className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <span className="text-lg font-bold font-heading tracking-tight text-slate-900">
              AntesDeGastar
            </span>
          </Link>

          <div className="flex items-center gap-2.5">
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                playTap();
                router.push("/auth");
              }}
              className="h-10 px-4 rounded-2xl border-2 border-b-4 border-[#DCD5CA] bg-white text-slate-900 font-bold font-heading text-xs sm:text-sm cursor-pointer active:border-b-2 active:translate-y-0.5"
            >
              Entrar
            </motion.button>
          </div>
        </div>
      </header>

      {/* Main Zero-Noise Hero Stage */}
      <main className="flex-1 flex flex-col justify-center py-8 sm:py-12 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto w-full text-center space-y-6">
          {/* Interactive Animated Plant Hero Badge */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-2"
          >
            <motion.button
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={() => playLevelUp()}
              className="relative w-28 h-28 rounded-3xl bg-gradient-to-b from-emerald-50 via-white to-amber-50/60 border-2 border-b-4 border-emerald-300 shadow-sm flex items-center justify-center cursor-pointer group"
              title="¡Toca para celebrar!"
            >
              <svg
                viewBox="0 0 120 110"
                className="w-24 h-24 overflow-visible"
                aria-label="Árbol financiero"
              >
                <ellipse cx="60" cy="98" rx="30" ry="5" fill="#E2DCD3" />
                <path
                  d="M40 72 L80 72 L74 96 C73 98 71 99 68 99 L52 99 C49 99 47 98 46 96 Z"
                  fill="#D97757"
                />
                <rect
                  x="36"
                  y="66"
                  width="48"
                  height="7"
                  rx="3.5"
                  fill="#C86849"
                />
                <motion.g
                  animate={{ rotate: [-2, 2, -2], y: [0, -2, 0] }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <path
                    d="M56 67 L58 36 L62 36 L64 67 Z"
                    fill="#78350F"
                  />
                  <circle cx="46" cy="38" r="14" fill="#059669" />
                  <circle cx="74" cy="38" r="14" fill="#10B981" />
                  <circle cx="60" cy="26" r="17" fill="#34D399" />
                  <circle cx="52" cy="24" r="3.5" fill="#FBBF24" />
                  <circle cx="68" cy="28" r="3.5" fill="#FBBF24" />
                  <circle cx="60" cy="16" r="4" fill="#FDE047" />
                </motion.g>
              </svg>
              <span className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-orange-500 text-white text-[10px] font-bold font-heading border-2 border-white shadow-2xs flex items-center gap-0.5">
                <Flame className="w-3 h-3 fill-white" strokeWidth={1.5} />
                +XP
              </span>
            </motion.button>

            <Badge
              variant="outline"
              className="border-emerald-300 bg-emerald-50 text-emerald-900 px-3 py-1 text-xs font-bold font-heading"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-700" strokeWidth={1.5} />
              Tu Copiloto Pre-Compra Gamificado
            </Badge>
          </motion.div>

          {/* Short Punchy Title */}
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="text-3xl sm:text-5xl font-bold font-heading tracking-tight text-slate-900 leading-[1.08] text-balance"
          >
            Decide tus compras antes de gastar 🌱
          </motion.h1>

          {/* 5 Evolution Levels Visual Strip */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-wrap items-center justify-center gap-1.5"
          >
            {PLANT_LEVELS_STRIP.map((item) => (
              <button
                key={item.lvl}
                type="button"
                onClick={() => playTap()}
                className="px-3 py-1 rounded-xl bg-white border-2 border-b-4 border-[#E6E1DA] text-xs font-bold font-heading text-slate-700 active:border-b-2 active:translate-y-0.5 cursor-pointer"
              >
                {item.label}
              </button>
            ))}
          </motion.div>

          {/* Two Giant 3D Tactile Action Cards (Zero Friction) */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14 }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-w-xl mx-auto pt-2"
          >
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                playTap();
                router.push("/auth");
              }}
              className="p-4 rounded-3xl bg-emerald-600 hover:bg-emerald-500 text-white border-2 border-emerald-700 border-b-4 border-b-emerald-800 active:border-b-2 active:translate-y-0.5 shadow-md flex items-center justify-between gap-3 text-left cursor-pointer"
            >
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-100 block">
                  Nuevo Usuario · 4 Toques
                </span>
                <p className="text-lg font-bold font-heading leading-tight mt-0.5">
                  Crear mi Planta 🌱
                </p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                <ArrowRight className="w-5 h-5 text-white" strokeWidth={1.5} />
              </div>
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                playCoin();
                loadPreloadedSandboxProfile("carlos");
                router.push("/app");
              }}
              className="p-4 rounded-3xl bg-slate-900 hover:bg-slate-800 text-white border-2 border-slate-950 border-b-4 border-b-black active:border-b-2 active:translate-y-0.5 shadow-md flex items-center justify-between gap-3 text-left cursor-pointer"
            >
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 block">
                  Demo 1-Clic · Plaid Sandbox
                </span>
                <p className="text-lg font-bold font-heading leading-tight mt-0.5">
                  Probar Simulador ⚡
                </p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 text-amber-300" strokeWidth={1.5} />
              </div>
            </motion.button>
          </motion.div>

          {/* 3 Tactile Visual Cue Cards (Zero Paragraphs) */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-4 text-left"
          >
            {QUICK_STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.number}
                  onClick={() => playTap()}
                  className={`p-4 rounded-3xl border-2 border-b-4 transition-all cursor-pointer flex flex-col justify-between gap-3 ${step.cardStyle}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">{step.emoji}</span>
                    <span className="text-xs font-bold font-heading px-2.5 py-0.5 rounded-full bg-white/90 border border-slate-200 text-slate-800">
                      {step.badge}
                    </span>
                  </div>
                  <div>
                    <p className="text-base font-bold font-heading text-slate-900 leading-snug">
                      {step.title}
                    </p>
                    <p className="text-xs font-bold font-heading text-slate-600 mt-0.5">
                      {step.tag}
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-[11px] font-bold font-heading text-slate-500">
                    <span>Paso {step.number}</span>
                    <Icon className="w-4 h-4 text-slate-700" strokeWidth={1.5} />
                  </div>
                </div>
              );
            })}
          </motion.div>
        </div>
      </main>

      {/* Compact Footer */}
      <footer className="border-t border-[#E6E1DA] bg-[#FAF8F5] py-4">
        <div className="max-w-5xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2 text-xs font-bold font-heading text-slate-500">
          <div className="flex items-center gap-2">
            < Sprout className="w-4 h-4 text-emerald-700" strokeWidth={1.5} />
            <span>AntesDeGastar · Claridad antes de pagar</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
