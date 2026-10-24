"use client";

import React from "react";
import { motion } from "framer-motion";
import { Zap, ShieldAlert, CheckCircle2, AlertTriangle } from "lucide-react";

interface QuincenaEnergyGaugeProps {
  safeToSpend: number;
  previewPrice: number;
  nextPaydayDays: number;
}

export default function QuincenaEnergyGauge({
  safeToSpend,
  previewPrice,
  nextPaydayDays,
}: QuincenaEnergyGaugeProps) {
  const remainingAfterBuy = safeToSpend - previewPrice;
  const energyPct =
    safeToSpend > 0
      ? Math.max(0, Math.min(100, Math.round((remainingAfterBuy / safeToSpend) * 100)))
      : 0;

  const isDeficit = remainingAfterBuy < 0;
  const isCaution = !isDeficit && energyPct < 35;

  // Needle angle from -90deg (0% energy) to +90deg (100% energy)
  const needleAngle = -90 + (energyPct / 100) * 180;

  return (
    <div
      className={`rounded-3xl border p-4 sm:p-5 transition-colors ${
        isDeficit
          ? "bg-gradient-to-br from-rose-50/90 via-white to-orange-50/50 border-rose-200"
          : isCaution
          ? "bg-gradient-to-br from-amber-50/80 via-white to-yellow-50/40 border-amber-200"
          : "bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/40 border-emerald-200/80"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              isDeficit
                ? "bg-rose-100 text-rose-700"
                : isCaution
                ? "bg-amber-100 text-amber-700"
                : "bg-emerald-100 text-emerald-700"
            }`}
          >
            <Zap className="w-4 h-4" strokeWidth={1.5} />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800 block leading-none">
              Energía de tu Quincena
            </span>
            <span className="text-[11px] text-slate-500">
              {previewPrice > 0
                ? `Simulando gasto de $${previewPrice.toLocaleString()} MXN`
                : `${nextPaydayDays} días para recargar nómina`}
            </span>
          </div>
        </div>

        {/* Status Pill */}
        <div
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
            isDeficit
              ? "bg-rose-100 text-rose-800"
              : isCaution
              ? "bg-amber-100 text-amber-900"
              : "bg-emerald-100 text-emerald-900"
          }`}
        >
          {isDeficit ? (
            <ShieldAlert className="w-3.5 h-3.5" strokeWidth={1.5} />
          ) : isCaution ? (
            <AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.5} />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.5} />
          )}
          <span className="font-mono">{energyPct}%</span>
        </div>
      </div>

      {/* Visual Speedometer + Spring Thermometer Bar */}
      <div className="mt-4 grid grid-cols-12 items-center gap-3">
        {/* Compact SVG Speedometer Dial */}
        <div className="col-span-4 sm:col-span-3 flex flex-col items-center justify-center">
          <svg viewBox="0 0 120 70" className="w-24 h-14 overflow-visible">
            {/* Background Arc */}
            <path
              d="M 14 58 A 46 46 0 0 1 106 58"
              fill="none"
              stroke="#E6E1DA"
              strokeWidth="10"
              strokeLinecap="round"
            />
            {/* Colored Zones Arc */}
            <path
              d="M 14 58 A 46 46 0 0 1 106 58"
              fill="none"
              stroke={
                isDeficit ? "#F43F5E" : isCaution ? "#F59E0B" : "#10B981"
              }
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray="145"
              strokeDashoffset={145 - (145 * energyPct) / 100}
              className="transition-all duration-300"
            />
            {/* Spring Animated Needle */}
            <motion.g
              style={{ originX: "60px", originY: "58px" }}
              animate={{ rotate: needleAngle }}
              transition={{
                type: "spring",
                stiffness: 220,
                damping: 16,
              }}
            >
              <line
                x1="60"
                y1="58"
                x2="60"
                y2="20"
                stroke="#0F172A"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              <circle cx="60" cy="58" r="5" fill="#0F172A" />
            </motion.g>
          </svg>
        </div>

        {/* Spring Thermometer & Instant Numbers */}
        <div className="col-span-8 sm:col-span-9 space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-medium text-slate-600">
              {isDeficit ? "Déficit proyectado:" : "Te quedan libres:"}
            </span>
            <motion.span
              key={remainingAfterBuy}
              initial={{ scale: 0.92 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 320, damping: 18 }}
              className={`text-lg sm:text-xl font-bold font-mono ${
                isDeficit
                  ? "text-rose-700"
                  : isCaution
                  ? "text-amber-800"
                  : "text-emerald-800"
              }`}
            >
              {isDeficit
                ? `−$${Math.abs(remainingAfterBuy).toLocaleString()} MXN`
                : `$${remainingAfterBuy.toLocaleString()} MXN`}
            </motion.span>
          </div>

          {/* Thermometer Bar with Spring Physics */}
          <div className="h-3.5 w-full rounded-full bg-white border border-[#E6E1DA] p-0.5 overflow-hidden shadow-2xs">
            <motion.div
              animate={{ width: `${Math.max(6, energyPct)}%` }}
              transition={{
                type: "spring",
                stiffness: 200,
                damping: 18,
              }}
              className={`h-full rounded-full ${
                isDeficit
                  ? "bg-gradient-to-r from-rose-500 to-orange-500"
                  : isCaution
                  ? "bg-gradient-to-r from-amber-500 to-yellow-400"
                  : "bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400"
              }`}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
            <span>0% (Riesgo)</span>
            <span>Libre hoy: ${safeToSpend.toLocaleString()}</span>
            <span>100% (Paz)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

