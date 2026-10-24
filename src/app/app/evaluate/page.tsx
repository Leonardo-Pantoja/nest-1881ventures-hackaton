"use client";

import React, { useState, useEffect, Suspense } from "react";
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
import type { EvaluateApiResponse } from "@/app/api/evaluate/route";

interface EvaluationState {
  key: string;
  response: EvaluateApiResponse | null;
  error: string | null;
}

function isEvaluationResponse(value: unknown): value is EvaluateApiResponse {
  if (typeof value !== "object" || value === null) return false;
  const response = value as Partial<EvaluateApiResponse>;
  return (
    (response.status === "dentro_del_margen" ||
      response.status === "excede_el_margen" ||
      response.status === "precaucion" ||
      response.status === "datos_incompletos" ||
      response.status === "error_procesamiento") &&
    typeof response.detectedItemName === "string" &&
    typeof response.detectedItemPrice === "number" &&
    Number.isFinite(response.detectedItemPrice) &&
    response.source === "deterministic"
  );
}

function EvaluateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    profile,
    mode,
    pendingEvaluation,
    setPendingEvaluation,
    incrementStreak,
    streakCelebration,
  } = useFinancial();

  const [actionToast, setActionToast] = useState<string | null>(null);
  const [evaluationState, setEvaluationState] =
    useState<EvaluationState | null>(null);
  const [scannedThumb, setScannedThumb] = useState<string | null>(null);
  const [scannedStore, setScannedStore] = useState<string | null>(null);

  const itemName =
    searchParams.get("name") ||
    pendingEvaluation.name ||
    "Audífonos Inalámbricos Sony";
  const itemPrice =
    Number(searchParams.get("price")) || pendingEvaluation.price || 0;
  const evaluationKey = JSON.stringify([
    mode,
    profile.id,
    itemName,
    itemPrice,
  ]);
  const currentEvaluation =
    evaluationState?.key === evaluationKey ? evaluationState : null;
  const apiEvaluation = currentEvaluation?.response ?? null;
  const apiEvaluationError =
    currentEvaluation !== null && currentEvaluation.error !== null;
  const apiErrorMessage = currentEvaluation?.error ?? null;
  const isLoadingApi =
    itemPrice > 0 &&
    (mode === "demo" || mode === "authenticated") &&
    currentEvaluation === null;

  useEffect(() => {
    if (
      itemPrice <= 0 ||
      !itemName.trim() ||
      (mode !== "demo" && mode !== "authenticated")
    ) {
      return;
    }

    let active = true;
    const fetchEvaluation = async () => {
      try {
        const res = await fetch("/api/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemName,
            itemPrice,
            mode: mode === "demo" ? "demo" : "account",
            demoProfileId: mode === "demo" ? profile.id : undefined,
          }),
        });
        const body: unknown = await res.json();
        if (!res.ok) {
          const message =
            typeof body === "object" &&
            body !== null &&
            "error" in body &&
            typeof body.error === "string"
              ? body.error
              : "No se pudo validar la sesión o los datos financieros.";
          throw new Error(message);
        }
        if (!isEvaluationResponse(body)) {
          throw new Error("El servicio devolvió una evaluación no válida.");
        }
        if (active) {
          setEvaluationState({
            key: evaluationKey,
            response: body,
            error: null,
          });
        }
      } catch (error) {
        if (active) {
          setEvaluationState({
            key: evaluationKey,
            response: null,
            error:
              error instanceof Error
                ? error.message
                : "No se pudo conectar con el servicio financiero.",
          });
        }
      }
    };
    void fetchEvaluation();
    return () => {
      active = false;
    };
  }, [evaluationKey, itemName, itemPrice, profile.id, mode]);

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
            setPendingEvaluation({
              name: scanned.name,
              price: scanned.price ?? 0,
              imageName: scanned.storeTag,
            });
            setScannedThumb(scanned.thumbnailDataUrl);
            setScannedStore(scanned.storeTag);
            incrementStreak("¡Escaneaste un producto! +1 Racha 🔥");
            if (scanned.price === null) {
              setActionToast(
                "La lectura de imágenes con Gemini está pendiente para Fase 2. Confirma manualmente el precio en el simulador antes de evaluar.",
              );
            }
          }}
        />

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
            apiEvaluationError={apiEvaluationError}
            apiErrorMessage={apiErrorMessage}
            isLoadingApi={isLoadingApi}
            isStandalonePage
            onClose={() => router.push("/app")}
            onActionCompleted={handleActionCompleted}
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
