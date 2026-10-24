"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Sprout,
  Sparkles,
  Trophy,
  UserCheck,
} from "lucide-react";

export type BottomNavTab = "home" | "simulate" | "goals" | "profile";

interface BottomNavProps {
  activeTab: BottomNavTab;
  onSelectTab: (tab: BottomNavTab) => void;
}

export default function BottomNav({
  activeTab,
  onSelectTab,
}: BottomNavProps) {
  return (
    <nav
      aria-label="Navegación principal móvil"
      className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-lg border-t border-[#E6E1DA] shadow-[0_-4px_20px_rgba(15,23,42,0.06)] px-2 pb-safe"
    >
      <div className="max-w-lg mx-auto h-16 grid grid-cols-4 items-center gap-1 px-1">
        {/* 1. Tu Planta / Inicio */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={() => onSelectTab("home")}
          className={`flex flex-col items-center justify-center gap-1 py-1.5 rounded-2xl transition-colors cursor-pointer ${
            activeTab === "home"
              ? "text-emerald-700 font-semibold"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <div
            className={`p-1.5 rounded-xl transition-colors ${
              activeTab === "home" ? "bg-emerald-100/80" : "bg-transparent"
            }`}
          >
            <Sprout className="w-5 h-5" strokeWidth={1.5} />
          </div>
          <span className="text-[11px] leading-none tracking-tight">
            Tu Planta
          </span>
        </motion.button>

        {/* 2. Simular Compra (Highlighted Central Vibrant Gradient Button) */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          whileHover={{ y: -2 }}
          onClick={() => onSelectTab("simulate")}
          className="flex flex-col items-center justify-center -mt-4 cursor-pointer group"
        >
          <div
            className={`w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-amber-400 text-white shadow-md flex items-center justify-center border-2 border-white transition-transform ${
              activeTab === "simulate" ? "ring-2 ring-emerald-500/40 scale-105" : ""
            }`}
          >
            <Sparkles className="w-5 h-5 text-white" strokeWidth={1.5} />
          </div>
          <span
            className={`text-[11px] leading-none tracking-tight mt-1 font-semibold ${
              activeTab === "simulate" ? "text-emerald-800" : "text-slate-800"
            }`}
          >
            Simular Compra
          </span>
        </motion.button>

        {/* 3. Retos y Metas */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={() => onSelectTab("goals")}
          className={`flex flex-col items-center justify-center gap-1 py-1.5 rounded-2xl transition-colors cursor-pointer ${
            activeTab === "goals"
              ? "text-amber-700 font-semibold"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <div
            className={`p-1.5 rounded-xl transition-colors ${
              activeTab === "goals" ? "bg-amber-100/80" : "bg-transparent"
            }`}
          >
            <Trophy className="w-5 h-5" strokeWidth={1.5} />
          </div>
          <span className="text-[11px] leading-none tracking-tight">
            Retos y Metas
          </span>
        </motion.button>

        {/* 4. Cambiar Perfil */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={() => onSelectTab("profile")}
          className={`flex flex-col items-center justify-center gap-1 py-1.5 rounded-2xl transition-colors cursor-pointer ${
            activeTab === "profile"
              ? "text-slate-900 font-semibold"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <div
            className={`p-1.5 rounded-xl transition-colors ${
              activeTab === "profile" ? "bg-slate-200/70" : "bg-transparent"
            }`}
          >
            <UserCheck className="w-5 h-5" strokeWidth={1.5} />
          </div>
          <span className="text-[11px] leading-none tracking-tight">
            Cambiar Perfil
          </span>
        </motion.button>
      </div>
    </nav>
  );
}

