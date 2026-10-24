"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Compass, ArrowLeft, CheckCircle2 } from "lucide-react";
import PurchaseEvaluationFlow from "@/components/PurchaseEvaluationFlow";
import { useFinancial } from "@/context/FinancialContext";
import type { EvaluateApiResponse } from "@/app/api/evaluate/route";

function EvaluateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile, pendingEvaluation } = useFinancial();

  const [actionToast, setActionToast] = useState<string | null>(null);
  const [apiEvaluation, setApiEvaluation] = useState<EvaluateApiResponse | null>(null);
  const [isLoadingApi, setIsLoadingApi] = useState(false);

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

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-slate-900 flex flex-col justify-between font-sans">
      <header className="sticky top-0 z-30 border-b border-[#E6E1DA]/90 bg-[#FAF8F5]/90 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            href="/app"
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
            <span>Volver al tablero</span>
          </Link>

          <Link href="/app" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-[#FAF8F5] flex items-center justify-center shadow-2xs">
              <Compass className="w-4 h-4" strokeWidth={1.5} />
            </div>
            <span className="text-sm font-semibold tracking-tight text-slate-900">
              AntesDeGastar
            </span>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full"
        >
          <PurchaseEvaluationFlow
            itemName={itemName}
            itemPrice={itemPrice}
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
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-2xl bg-slate-900 text-[#FAF8F5] px-5 py-3 shadow-lg flex items-center gap-2.5 text-xs sm:text-sm"
          >
            <CheckCircle2
              className="w-4 h-4 text-emerald-400 shrink-0"
              strokeWidth={1.5}
            />
            <span>{actionToast}</span>
          </motion.div>
        )}
      </AnimatePresence>
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
