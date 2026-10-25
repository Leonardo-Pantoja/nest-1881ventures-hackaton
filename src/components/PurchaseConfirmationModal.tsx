"use client";

import { useRef, useState } from "react";
import { useFinancial } from "@/context/FinancialContext";
import type { EvaluateApiResponse } from "@/lib/finance/evaluation";
import { pendingPurchaseOperation, PurchaseConfirmation } from "@/lib/finance/purchaseConfirmation";

export default function PurchaseConfirmationModal({ itemName, itemPrice, evaluation, onCancel, onSuccess }: {
  itemName: string; itemPrice: number; evaluation: EvaluateApiResponse | null;
  onCancel: () => void; onSuccess: () => void;
}) {
  const { registerPurchaseAnyway, financialVersion, profile, mode } = useFinancial();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initial] = useState(() => ({ itemName, itemPrice, evaluation, financialVersion }));
  const controller = useRef<PurchaseConfirmation | null>(null);
  const intent = useRef<ReturnType<typeof pendingPurchaseOperation> | null>(null);
  const submitLock = useRef(false);
  const stale = initial.financialVersion !== financialVersion || itemName !== initial.itemName || itemPrice !== initial.itemPrice;
  const complete = evaluation && evaluation.status !== "datos_incompletos" && evaluation.status !== "error_procesamiento" && evaluation.safeToSpend !== null;
  const confirm = async () => {
    if (submitLock.current || saving || stale || !complete) return;
    submitLock.current = true;
    if (!controller.current) {
      let storage: Storage | undefined;
      try { storage = typeof window === "undefined" ? undefined : window.sessionStorage; } catch { /* Use in-memory idempotency if browser storage is disabled. */ }
      intent.current = pendingPurchaseOperation(mode + ":" + profile.id, initial.itemName, initial.itemPrice, storage);
      controller.current = new PurchaseConfirmation(id => registerPurchaseAnyway(initial.itemName, initial.itemPrice, id, initial.evaluation?.financialRevision), intent.current.id);
    }
    setSaving(true);
    setError(null);
    try { await controller.current.confirm(); intent.current?.complete(); onSuccess(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo registrar la compra."); }
    finally { submitLock.current = false; setSaving(false); }
  };
  return <div className="fixed inset-0 z-50 bg-slate-900/50 grid place-items-center p-4" onKeyDown={event => { if (event.key === "Escape" && !saving) onCancel(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="purchase-confirm-title" aria-busy={saving} className="w-full max-w-md rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-xl space-y-4">
      <h2 id="purchase-confirm-title" className="text-xl font-bold text-slate-900">Confirmar compra</h2>
      <p className="text-slate-700">¿Ya realizaste esta compra? Confirmarla registrará un gasto real.</p>
      <p className="font-semibold">{initial.itemName} · ${initial.itemPrice.toLocaleString()} MXN</p>
      <p>Se descontarán <strong>${initial.itemPrice.toLocaleString()} MXN</strong> de tu saldo. Tus ahorros de metas no se retiran.</p>
      {(error || stale || !complete) && <p role="alert" className="text-sm text-rose-700">{error ?? (stale ? "Tus datos cambiaron. Cancela y revisa la nueva evaluación antes de confirmar." : "Espera una evaluación financiera completa.")}</p>}
      <div className="flex gap-3">
        <button autoFocus type="button" disabled={saving} onClick={onCancel} className="flex-1 rounded-xl border border-slate-300 p-3 disabled:opacity-50">Cancelar</button>
        <button type="button" disabled={saving || stale || !complete} onClick={() => void confirm()} className="flex-1 rounded-xl bg-emerald-600 text-white p-3 disabled:opacity-50">{saving ? "Guardando..." : "Confirmar compra"}</button>
      </div>
    </section>
  </div>;
}
