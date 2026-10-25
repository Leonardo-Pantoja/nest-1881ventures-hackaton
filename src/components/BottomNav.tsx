"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Sprout,
  Sparkles,
  Trophy,
  UserCheck,
  Receipt,
} from "lucide-react";
import { playTap } from "@/lib/soundEffects";

export type BottomNavTab = "home" | "simulate" | "expenses" | "goals" | "profile";

interface BottomNavProps {
  activeTab: BottomNavTab;
  onSelectTab: (tab: BottomNavTab) => void;
}

export default function BottomNav({
  activeTab,
  onSelectTab,
}: BottomNavProps) {
  const handleSelect = (tab: BottomNavTab) => {
    playTap();
    onSelectTab(tab);
  };

  return (
    <div className="fixed bottom-3 inset-x-0 z-40 px-3 pointer-events-none">
      <nav
        aria-label="Navegación principal móvil"
        className="max-w-md mx-auto bg-white/95 backdrop-blur-xl border-2 border-[#E6E1DA] rounded-3xl shadow-[0_8px_30px_rgba(15,23,42,0.12)] px-2 py-1.5 pointer-events-auto"
      >
        <div className="grid grid-cols-5 items-center gap-0.5">
          {/* 1. Tu Planta / Inicio */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={() => handleSelect("home")}
            className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-2xl transition-colors cursor-pointer ${
              activeTab === "home"
                ? "text-emerald-700 font-bold"
                : "text-slate-500 hover:text-slate-900 font-medium"
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition-colors ${
                activeTab === "home" ? "bg-emerald-100/90" : "bg-transparent"
              }`}
            >
              <Sprout className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <span className="text-[10px] font-heading leading-none">
              Tu Planta
            </span>
          </motion.button>

          {/* 2. Plan de Gastos */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={() => handleSelect("expenses")}
            className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-2xl transition-colors cursor-pointer ${
              activeTab === "expenses"
                ? "text-emerald-700 font-bold"
                : "text-slate-500 hover:text-slate-900 font-medium"
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition-colors ${
                activeTab === "expenses" ? "bg-emerald-100/90" : "bg-transparent"
              }`}
            >
              <Receipt className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <span className="text-[10px] font-heading leading-none">
              Gastos
            </span>
          </motion.button>

          {/* 3. Simular Compra */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            whileHover={{ y: -1 }}
            onClick={() => handleSelect("simulate")}
            className="flex flex-col items-center justify-center -mt-4 cursor-pointer group"
          >
            <div
              className={`w-11 h-11 rounded-2xl bg-[#10B981] text-white shadow-sm flex items-center justify-center border-2 border-white transition-transform ${
                activeTab === "simulate"
                  ? "ring-2 ring-emerald-500/30 scale-105"
                  : ""
              }`}
            >
              <Sparkles className="w-5 h-5 text-white" strokeWidth={1.5} />
            </div>
            <span
              className={`text-[10px] font-heading leading-none mt-1 font-bold ${
                activeTab === "simulate" ? "text-emerald-700" : "text-slate-700"
              }`}
            >
              Simular
            </span>
          </motion.button>

          {/* 4. Retos y Metas */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={() => handleSelect("goals")}
            className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-2xl transition-colors cursor-pointer ${
              activeTab === "goals"
                ? "text-amber-700 font-bold"
                : "text-slate-500 hover:text-slate-900 font-medium"
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition-colors ${
                activeTab === "goals" ? "bg-amber-100/90" : "bg-transparent"
              }`}
            >
              <Trophy className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <span className="text-[10px] font-heading leading-none">
              Retos
            </span>
          </motion.button>

          {/* 5. Cambiar Perfil */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={() => handleSelect("profile")}
            className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-2xl transition-colors cursor-pointer ${
              activeTab === "profile"
                ? "text-slate-900 font-bold"
                : "text-slate-500 hover:text-slate-900 font-medium"
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition-colors ${
                activeTab === "profile" ? "bg-slate-200/70" : "bg-transparent"
              }`}
            >
              <UserCheck className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <span className="text-[10px] font-heading leading-none">
              Perfil
            </span>
          </motion.button>
        </div>
      </nav>
    </div>
  );
}
