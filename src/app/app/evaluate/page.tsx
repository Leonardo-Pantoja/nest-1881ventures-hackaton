"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Flame } from "lucide-react";
import AppShell from "@/components/AppShell";
import PurchaseEvaluationFlow from "@/components/PurchaseEvaluationFlow";
import QuickSnapScanner, {
  type ScannedProductResult,
} from "@/components/QuickSnapScanner";
import { type BottomNavTab } from "@/components/BottomNav";
import { useFinancial } from "@/context/FinancialContext";
import { playTap } from "@/lib/soundEffects";
import { useFinancialEvaluation } from "@/hooks/useFinancialEvaluation";

function EvaluateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    pendingEvaluation,
    setPendingEvaluation,
    streakCelebration,
  } = useFinancial();

  const [actionToast, setActionToast] = useState<string | null>(null);

  const [scannedThumb, setScannedThumb] = useState<string | null>(null);
  const [scannedStore, setScannedStore] = useState<string | null>(null);

  const [confirmedScan, setConfirmedScan] = useState<ScannedProductResult | null>(null);

  const itemName =
    confirmedScan?.name ||
    searchParams.get("name") ||
    pendingEvaluation.name ||
    "Audífonos Inalámbricos Sony";
  const itemPrice =
    confirmedScan?.price || Number(searchParams.get("price")) || pendingEvaluation.price || 0;
  const evaluation = useFinancialEvaluation(itemName, itemPrice);
  const apiEvaluation = evaluation.response;
  const apiEvaluationError = evaluation.error !== null;
  const apiErrorMessage = evaluation.error;
  const isLoadingApi = evaluation.loading;

  const handleActionCompleted = (message: string) => {
    setActionToast(message);
    setTimeout(() => {
      router.push("/app");
    }, 1100);
  };

  const handleBottomNav = (tab: BottomNavTab) => {
    playTap();
    if (tab !== "simulate") {
      router.push("/app");
    }
  };

  return (
    <AppShell activeTab="simulate" onSelectTab={handleBottomNav}>
      {/* Celebratory Streak Popup Banner 🔥 */}
      <AnimatePresence>
        {streakCelebration && (
          <motion.div
            key={streakCelebration.id}
            initial={{ opacity: 0, y: -24, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -18, scale: 0.92 }}
            transition={{ type: "spring", stiffness: 360, damping: 22 }}
            className="fixed top-16 md:top-6 left-1/2 -translate-x-1/2 z-50 rounded-full bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 text-white px-4 py-2 shadow-lg flex items-center gap-2 text-xs font-bold font-heading whitespace-nowrap border-2 border-white"
          >
            <Flame className="w-4 h-4 fill-white text-white" strokeWidth={1.5} />
            <span>
              ¡Racha de {streakCelebration.count}! · {streakCelebration.reason}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4 max-w-xl mx-auto w-full">
        <QuickSnapScanner
          onScanComplete={(scanned: ScannedProductResult) => {
            playTap();
            setConfirmedScan(scanned);
            setPendingEvaluation({
              name: scanned.name,
              price: scanned.price ?? 0,
              imageName: scanned.storeTag,
            });
            setScannedThumb(scanned.thumbnailDataUrl);
            setScannedStore(scanned.storeTag);

          }}
        />

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full"
        >
          <PurchaseEvaluationFlow
            key={evaluation.key}
            itemName={itemName}
            itemPrice={itemPrice}
            thumbnailDataUrl={scannedThumb}
            storeTag={scannedStore}
            apiEvaluation={apiEvaluation}
            apiEvaluationError={apiEvaluationError}
            apiErrorMessage={apiErrorMessage}
            isLoadingApi={isLoadingApi}
            isStandalonePage
            onClose={() => router.push("/app")}
            onActionCompleted={handleActionCompleted}
            onUpdateEvaluatedItem={(nextName, nextPrice, nextThumb, nextTag) => {
              setPendingEvaluation({
                name: nextName,
                price: nextPrice,
                imageName: nextTag ?? scannedStore,
              });
              if (nextThumb !== undefined) setScannedThumb(nextThumb);
              if (nextTag !== undefined) setScannedStore(nextTag);
            }}
          />
        </motion.div>
      </div>

      <AnimatePresence>
        {actionToast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12 }}
            className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-50 rounded-2xl bg-slate-900 text-[#FAF8F5] px-4 py-2.5 shadow-lg flex items-center gap-2 text-xs font-bold font-heading"
          >
            <CheckCircle2
              className="w-4 h-4 text-emerald-400 shrink-0"
              strokeWidth={1.5}
            />
            <span>{actionToast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}

export default function EvaluatePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAF8F5]" />}>
      <EvaluateContent />
    </Suspense>
  );
}
