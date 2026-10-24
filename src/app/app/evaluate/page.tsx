"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Compass, ArrowLeft, CheckCircle2, Flame } from "lucide-react";
import PurchaseEvaluationFlow from "@/components/PurchaseEvaluationFlow";
import QuickSnapScanner, {
  type ScannedProductResult,
} from "@/components/QuickSnapScanner";
import BottomNav, { type BottomNavTab } from "@/components/BottomNav";
import { useFinancial } from "@/context/FinancialContext";
import type { EvaluateApiResponse } from "@/app/api/evaluate/route";

function EvaluateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    profile,
    pendingEvaluation,
    setPendingEvaluation,
    incrementStreak,
    streakCelebration,
  } = useFinancial();

  const [actionToast, setActionToast] = useState<string | null>(null);
  const [apiEvaluation, setApiEvaluation] = useState<EvaluateApiResponse | null>(
    null
  );
  const [isLoadingApi, setIsLoadingApi] = useState(false);
  const [scannedThumb, setScannedThumb] = useState<string | null>(null);
  const [scannedStore, setScannedStore] = useState<string | null>(null);

  const itemName =
    searchParams.get("name") ||
    pendingEvaluation.name ||
    "Audífonos Inalámbricos Sony";
  const itemPrice =
    Number(searchParams.get("price")) || pendingEvaluation.price || 2300;

  useEffect(() => {
    let active = true;
    const fetchEvaluation = async () => {
      setIsLoadingApi(true);
      try {
        const res = await fetch("/api/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemName,
            itemPrice,
            profile,
          }),
        });
        if (res.ok && active) {
          const data = (await res.json()) as EvaluateApiResponse;
          setApiEvaluation(data);
        }
      } catch {
        // Automatic deterministic fallback inside PurchaseEvaluationFlow
      } finally {
        if (active) setIsLoadingApi(false);
      }
    };
    void fetchEvaluation();
    return () => {
      active = false;
    };
  }, [itemName, itemPrice, profile]);

  const handleActionCompleted = (message: string) => {
    setActionToast(message);
    setTimeout(() => {
      router.push("/app");
    }, 1100);
  };

  const handleBottomNav = (tab: BottomNavTab) => {
    if (tab !== "simulate") {
      router.push("/app");
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-slate-900 flex flex-col justify-between font-sans pb-24">
      <header className="sticky top-0 z-30 border-b border-[#E6E1DA]/90 bg-[#FAF8F5]/90 backdrop-blur-md">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            href="/app"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
            <span>Inicio</span>
          </Link>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-orange-100 to-amber-100 border border-orange-300/80 px-2.5 py-1 text-xs font-bold text-orange-900">
              <Flame
                className="w-3.5 h-3.5 text-orange-600 fill-orange-500"
                strokeWidth={1.5}
              />
              <span>{profile.streakCount ?? 3}</span>
            </div>

            <Link href="/app" className="flex items-center gap-1.5">
              <div className="w-7 h-7 rounded-xl bg-slate-900 text-[#FAF8F5] flex items-center justify-center shadow-2xs">
                <Compass className="w-3.5 h-3.5" strokeWidth={1.5} />
              </div>
            </Link>
          </div>
        </div>
      </header>

      {/* Celebratory Streak Popup Banner 🔥 */}
      <AnimatePresence>
        {streakCelebration && (
          <motion.div
            key={streakCelebration.id}
            initial={{ opacity: 0, y: -24, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -18, scale: 0.92 }}
            transition={{ type: "spring", stiffness: 360, damping: 22 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 rounded-full bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 text-white px-4 py-2 shadow-lg flex items-center gap-2 text-xs font-bold whitespace-nowrap border-2 border-white"
          >
            <Flame className="w-4 h-4 fill-white text-white" strokeWidth={1.5} />
            <span>
              ¡Racha de {streakCelebration.count}! · {streakCelebration.reason}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 flex flex-col items-center justify-center px-3 sm:px-6 py-4 sm:py-8 gap-4 max-w-xl mx-auto w-full">
        <div className="w-full">
          <QuickSnapScanner
            onScanComplete={(scanned: ScannedProductResult) => {
              setPendingEvaluation({
                name: scanned.name,
                price: scanned.price,
                imageName: scanned.storeTag,
              });
              setScannedThumb(scanned.thumbnailDataUrl);
              setScannedStore(scanned.storeTag);
              if (scanned.apiResponse) {
                setApiEvaluation(scanned.apiResponse);
              }
              incrementStreak("¡Escaneaste captura con IA! +1 Racha 🔥");
            }}
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full"
        >
          <PurchaseEvaluationFlow
            itemName={itemName}
            itemPrice={itemPrice}
            thumbnailDataUrl={scannedThumb}
            storeTag={scannedStore}
            apiEvaluation={apiEvaluation}
            isLoadingApi={isLoadingApi}
            isStandalonePage
            onClose={() => router.push("/app")}
            onActionCompleted={handleActionCompleted}
          />
        </motion.div>
      </main>

      <AnimatePresence>
        {actionToast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12 }}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 rounded-2xl bg-slate-900 text-[#FAF8F5] px-4 py-2.5 shadow-lg flex items-center gap-2 text-xs font-semibold"
          >
            <CheckCircle2
              className="w-4 h-4 text-emerald-400 shrink-0"
              strokeWidth={1.5}
            />
            <span>{actionToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav activeTab="simulate" onSelectTab={handleBottomNav} />
    </div>
  );
}

export default function EvaluatePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAF8F5]" />}>
      <EvaluateContent />
    </Suspense>
  );
}
