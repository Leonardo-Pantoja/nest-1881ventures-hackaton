"use client";

import { useEffect, useState } from "react";
import { useFinancial } from "@/context/FinancialContext";
import { buildDeterministicEvaluation, type EvaluateApiResponse } from "@/lib/finance/evaluation";

export function evaluationKey(version: string, name: string, price: number | null): string {
  return JSON.stringify([version, name, price]);
}

export function useFinancialEvaluation(name: string, price: number | null) {
  const { mode, financialProfile, financialVersion } = useFinancial();
  const key = evaluationKey(financialVersion, name, price);
  const [result, setResult] = useState<{ key: string; response: EvaluateApiResponse | null; error: string | null } | null>(null);
  const enabled = (mode === "authenticated" || mode === "demo") && (price === null || (price > 0 && !!name.trim()));
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let active = true;
    void (async () => {
      try {
        let response: EvaluateApiResponse;
        if (mode === "demo") {
          if (!financialProfile) throw new Error("No se pudo interpretar el perfil demo.");
          response = buildDeterministicEvaluation(name, price, financialProfile);
        } else {
          const res = await fetch("/api/evaluate", { method: "POST", cache: "no-store", signal: controller.signal,
            headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemName: name, itemPrice: price, summary: price === null, mode: "account" }) });
          const body = await res.json();
          if (!res.ok) throw new Error(body.error ?? "No se pudo evaluar el perfil financiero.");
          if (body.source !== "deterministic" || !Array.isArray(body.missingInformation) || !body.consideredExpenses) throw new Error("Respuesta financiera inválida.");
          response = body;
        }
        if (active) setResult({ key, response, error: null });
      } catch (error) {
        if (active) setResult({ key, response: null, error: error instanceof Error ? error.message : "No se pudo evaluar la compra." });
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [enabled, key, mode, name, price, financialProfile]);
  // A changed version hides old results immediately, before the next effect runs.
  const current = enabled && result?.key === key ? result : null;
  return { key, response: current?.response ?? null, error: current?.error ?? null, loading: enabled && current === null };
}
