"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Compass,
  Sprout,
  Sparkles,
  Trophy,
  UserCheck,
  Flame,
  Zap,
  HelpCircle,
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
  highlight?: boolean;
}[] = [
  { id: "home", label: "Tu Planta", icon: Sprout },
  { id: "simulate", label: "Simular Compra", icon: Sparkles, highlight: true },
  { id: "goals", label: "Retos y Metas", icon: Trophy },
  { id: "profile", label: "Cambiar Perfil", icon: UserCheck },
];

export default function AppShell({
  activeTab,
  onSelectTab,
  onOpenGuide,
  children,
}: AppShellProps) {
  const { profile } = useFinancial();

  const handleNavClick = (tab: BottomNavTab) => {
    playTap();
    onSelectTab(tab);
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-slate-900 flex flex-col md:flex-row font-sans">
      {/* Desktop Clean Left Sidebar (Duolingo / Finch style) */}
      <aside className="hidden md:flex md:w-64 lg:w-72 md:flex-col md:fixed md:inset-y-0 md:left-0 border-r border-[#E6E1DA] bg-white/90 backdrop-blur-md px-5 py-6 justify-between z-30">
        <div className="space-y-7">
          {/* Logo */}
          <Link
            href="/"
            onClick={() => playTap()}
            className="flex items-center gap-3 px-2 group"
          >
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              <Compass className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-slate-900 font-heading block leading-none">
                AntesDeGastar
              </span>
              <span className="text-[11px] font-semibold text-emerald-700">
                Tu bosque financiero
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="space-y-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isSelected = activeTab === item.id;
              return (
                <motion.button
                  key={item.id}
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all cursor-pointer ${
                    item.highlight
                      ? "bg-gradient-to-r from-emerald-600 via-teal-500 to-amber-500 text-white shadow-sm"
                      : isSelected
                      ? "bg-emerald-50 text-emerald-900 border-2 border-emerald-300"
                      : "text-slate-600 hover:bg-[#FAF8F5] hover:text-slate-900 border-2 border-transparent"
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" strokeWidth={1.5} />
                  <span className="font-heading tracking-wide">{item.label}</span>
                </motion.button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Stats Pill inside Desktop Sidebar */}
        <div className="space-y-3 pt-6 border-t border-[#E6E1DA]">
          {/* Streak & XP Pills */}
          <div className="grid grid-cols-2 gap-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => playLevelUp()}
              className="p-3 rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 flex items-center gap-2 cursor-pointer"
              title="¡Toca para celebrar tu racha!"
            >
              <Flame
                className="w-5 h-5 text-orange-500 fill-orange-500 shrink-0"
                strokeWidth={1.5}
              />
              <div className="text-left">
                <span className="text-sm font-bold font-heading text-orange-950 block leading-none">
                  {profile.streakCount ?? 3}
                </span>
                <span className="text-[10px] font-semibold text-orange-700">
                  Racha 🔥
                </span>
              </div>
            </motion.button>

            <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-center gap-2">
              <Zap
                className="w-5 h-5 text-emerald-600 fill-emerald-500 shrink-0"
                strokeWidth={1.5}
              />
              <div className="text-left">
                <span className="text-sm font-bold font-heading text-emerald-950 block leading-none">
                  {profile.wisdomXp ?? 120}
                </span>
                <span className="text-[10px] font-semibold text-emerald-700">
                  Puntos XP
                </span>
              </div>
            </div>
          </div>

          {/* Active User & Help Button */}
          <div className="flex items-center justify-between gap-2 px-1 pt-1">
            <button
              type="button"
              onClick={() => handleNavClick("profile")}
              className="flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-slate-900 truncate cursor-pointer"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="truncate">{profile.name}</span>
            </button>

            {onOpenGuide && (
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={() => {
                  playTap();
                  onOpenGuide();
                }}
                className="p-2 rounded-xl border border-[#E6E1DA] bg-[#FAF8F5] text-slate-600 hover:text-slate-900 cursor-pointer"
                title="Guía rápida"
              >
                <HelpCircle className="w-4 h-4" strokeWidth={1.5} />
              </motion.button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 md:pl-64 lg:pl-72 flex flex-col min-h-screen">
        {/* Mobile Top Gamified Bar */}
        <header className="md:hidden sticky top-0 z-30 border-b border-[#E6E1DA]/90 bg-[#FAF8F5]/95 backdrop-blur-md">
          <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between gap-2">
            <Link
              href="/"
              onClick={() => playTap()}
              className="flex items-center gap-2 shrink-0"
            >
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-2xs">
                <Compass className="w-4 h-4" strokeWidth={1.5} />
              </div>
              <span className="text-base font-bold tracking-tight text-slate-900 font-heading">
                AntesDeGastar
              </span>
            </Link>

            <div className="flex items-center gap-2">
              {/* Streak Pill */}
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={() => playLevelUp()}
                className="h-8 px-3 rounded-full bg-gradient-to-r from-orange-100 to-amber-100 border border-orange-300 text-orange-950 text-xs font-bold font-heading flex items-center gap-1 cursor-pointer"
              >
                <Flame
                  className="w-3.5 h-3.5 text-orange-600 fill-orange-500"
                  strokeWidth={1.5}
                />
                <span>{profile.streakCount ?? 3}</span>
              </motion.button>

              {/* XP Pill */}
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={() => handleNavClick("goals")}
                className="h-8 px-2.5 rounded-full bg-emerald-100/80 border border-emerald-300 text-emerald-950 text-xs font-bold font-heading flex items-center gap-1 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-emerald-700" strokeWidth={1.5} />
                <span>{profile.wisdomXp ?? 120}</span>
              </motion.button>

              {onOpenGuide && (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={() => {
                    playTap();
                    onOpenGuide();
                  }}
                  className="w-8 h-8 rounded-full border border-[#E6E1DA] bg-white text-slate-600 flex items-center justify-center cursor-pointer"
                  aria-label="Guía rápida"
                >
                  <HelpCircle className="w-4 h-4" strokeWidth={1.5} />
                </motion.button>
              )}
            </div>
          </div>
        </header>

        {/* Central Spacious Container without Visual Noise */}
        <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-32 md:py-8">
          {children}
        </main>

        {/* Mobile Floating Game-Style Bottom Navigation */}
        <div className="md:hidden">
          <BottomNav activeTab={activeTab} onSelectTab={handleNavClick} />
        </div>
      </div>
    </div>
  );
}

