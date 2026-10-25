"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Compass,
  Sprout,
  Sparkles,
  Trophy,
  UserCheck,
  Receipt,
  Flame,
  Zap,
  HelpCircle,
  LogOut,
} from "lucide-react";
import BottomNav, { type BottomNavTab } from "@/components/BottomNav";
import { useFinancial } from "@/context/FinancialContext";
import { playTap, playLevelUp } from "@/lib/soundEffects";

interface AppShellProps {
  activeTab: BottomNavTab;
  onSelectTab: (tab: BottomNavTab) => void;
  onOpenGuide?: () => void;
  children: React.ReactNode;
}

const NAV_ITEMS: {
  id: BottomNavTab;
  label: string;
  icon: React.ElementType;
}[] = [
  { id: "home", label: "Tu Planta", icon: Sprout },
  { id: "simulate", label: "Simular Compra", icon: Sparkles },
  { id: "expenses", label: "Plan de Gastos", icon: Receipt },
  { id: "goals", label: "Retos y Metas", icon: Trophy },
  { id: "profile", label: "Editar Perfil", icon: UserCheck },
];

export default function AppShell({
  activeTab,
  onSelectTab,
  onOpenGuide,
  children,
}: AppShellProps) {
  const router = useRouter();
  const { profile, mode, signOut } = useFinancial();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleNavClick = (tab: BottomNavTab) => {
    playTap();
    onSelectTab(tab);
  };

  const handleSignOut = async () => {
    if (isSigningOut) return;
    playTap();
    setIsSigningOut(true);
    try {
      await signOut();
      router.replace("/auth");
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setIsSigningOut(false);
    }
  };

  const initials = (profile.name || "CM")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-slate-900 flex flex-col md:flex-row font-sans">
      {/* Desktop Clean Left Sidebar (Apple / Wise Minimalist Palette + Emerald Primary) */}
      <aside className="hidden md:flex md:w-64 lg:w-72 md:flex-col md:fixed md:inset-y-0 md:left-0 border-r border-slate-200 bg-white px-5 py-6 justify-between z-30">
        <div className="space-y-8">
          {/* Logo */}
          <Link
            href="/"
            onClick={() => playTap()}
            className="flex items-center gap-3 px-2 group"
          >
            <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform shrink-0">
              <Compass className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <span className="text-lg font-bold tracking-tight text-slate-900 font-heading block leading-none">
                AntesDeGastar
              </span>
              <span className="text-xs font-medium text-slate-500 block mt-0.5">
                Claridad financiera
              </span>
            </div>
          </Link>

          {/* Navigation Links (Monochrome + Emerald only for active primary state) */}
          <nav className="space-y-1.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isSelected = activeTab === item.id;
              return (
                <motion.button
                  key={item.id}
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? "bg-[#10B981] text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" strokeWidth={1.5} />
                  <span className="font-heading tracking-wide">
                    {item.label}
                  </span>
                </motion.button>
              );
            })}
          </nav>
        </div>

        {/* Clean Sidebar Footer: Fixed Avatar + User Info + Clear Logout Button */}
        <div className="pt-5 border-t border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-slate-50 border border-slate-200/80">
            <button
              type="button"
              onClick={() => handleNavClick("profile")}
              className="flex items-center gap-3 min-w-0 text-left cursor-pointer group flex-1"
            >
              <div className="w-9 h-9 rounded-full bg-slate-900 text-white text-xs font-bold font-heading flex items-center justify-center shrink-0 shadow-2xs">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-sm font-bold text-slate-900 group-hover:text-emerald-600 transition-colors block truncate leading-tight">
                  {profile.name}
                </span>
                <span className="text-[11px] text-slate-500 block truncate">
                  {mode === "authenticated"
                    ? profile.email || "Cuenta activa"
                    : "Modo Demo · Cambiar perfil"}
                </span>
              </div>
            </button>

            {onOpenGuide && (
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={() => {
                  playTap();
                  onOpenGuide();
                }}
                className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 shadow-2xs cursor-pointer shrink-0"
                title="Guía rápida"
              >
                <HelpCircle className="w-4 h-4" strokeWidth={1.5} />
              </motion.button>
            )}
          </div>

          <motion.button
            type="button"
            disabled={isSigningOut}
            whileTap={{ scale: 0.98 }}
            onClick={() => void handleSignOut()}
            className="w-full h-10 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 text-slate-700 hover:text-rose-700 text-xs font-bold font-heading flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
          >
            <LogOut className="w-4 h-4 shrink-0" strokeWidth={1.5} />
            <span>{isSigningOut ? "Cerrando sesión..." : "Cerrar sesión"}</span>
          </motion.button>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 md:pl-64 lg:pl-72 flex flex-col min-h-screen">
        {/* Top Bar (Visible on Mobile & Desktop Top-Right for non-duplicated Streak & XP) */}
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-[#FAF8F5]/90 backdrop-blur-md">
          <div className="max-w-5xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
            {/* Mobile Brand / Desktop View Title */}
            <div className="flex items-center gap-2.5">
              <Link
                href="/"
                onClick={() => playTap()}
                className="md:hidden flex items-center gap-2 shrink-0"
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-2xs">
                  <Compass className="w-4 h-4" strokeWidth={1.5} />
                </div>
                <span className="text-base font-bold tracking-tight text-slate-900 font-heading">
                  AntesDeGastar
                </span>
              </Link>

              <span className="hidden md:inline-block text-sm font-semibold text-slate-500">
                {activeTab === "home"
                  ? "Vista de evolución · Tu Planta Financiera"
                  : activeTab === "simulate"
                  ? "Copiloto Pre-Compra · Simulador de Decisiones"
                  : activeTab === "expenses"
                  ? "Plan de Gastos · Compromisos, Imprevistos y Desglose Mensual"
                  : activeTab === "goals"
                  ? "Retos y Metas de Ahorro"
                  : "Configuración de Perfil"}
              </span>
            </div>

            {/* Top-Right Single Source of Truth for Streak & XP */}
            <div className="flex items-center gap-2.5">
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={() => playLevelUp()}
                className="h-9 px-3.5 rounded-full bg-white border border-slate-200 shadow-2xs text-slate-800 text-xs font-bold font-heading flex items-center gap-1.5 cursor-pointer hover:border-slate-300 transition-colors"
                title="Racha de buenas decisiones"
              >
                <Flame
                  className="w-4 h-4 text-amber-500 fill-amber-500"
                  strokeWidth={1.5}
                />
                <span>{profile.streakCount ?? 3} días</span>
              </motion.button>

              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={() => handleNavClick("goals")}
                className="h-9 px-3.5 rounded-full bg-white border border-slate-200 shadow-2xs text-slate-800 text-xs font-bold font-heading flex items-center gap-1.5 cursor-pointer hover:border-slate-300 transition-colors"
              >
                <Zap
                  className="w-4 h-4 text-emerald-500 fill-emerald-500"
                  strokeWidth={1.5}
                />
                <span>{profile.wisdomXp ?? 120} XP</span>
              </motion.button>

              {onOpenGuide && (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={() => {
                    playTap();
                    onOpenGuide();
                  }}
                  className="md:hidden w-9 h-9 rounded-full border border-slate-200 bg-white text-slate-600 flex items-center justify-center shadow-2xs cursor-pointer"
                  aria-label="Guía rápida"
                >
                  <HelpCircle className="w-4 h-4" strokeWidth={1.5} />
                </motion.button>
              )}
            </div>
          </div>
        </header>

        {/* Central Spacious Container with Generous Whitespace */}
        <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-28 md:py-4">
          {children}
        </main>

        {/* Mobile Bottom Navigation */}
        <div className="md:hidden">
          <BottomNav activeTab={activeTab} onSelectTab={handleNavClick} />
        </div>
      </div>
    </div>
  );
}
