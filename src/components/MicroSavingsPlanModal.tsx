"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { PiggyBank, Loader2, X, MessageSquare } from "lucide-react";
import { useFinancial } from "@/context/FinancialContext";
import { wishlistPlanMath, wishlistProductKey } from "@/lib/finance/wishlistPlan";
import { validPurchasePrice, formatMXN } from "@/lib/finance/money";

interface Props {
  itemName: string;
  itemPrice: number;
  onClose: () => void;
  onSaved?: (xp: number) => void;
  onViewWishlist?: () => void;
  onConsultGemini?: () => void;
}

export default function MicroSavingsPlanModal(props: Props) {
  const { mode, profile } = useFinancial();
  return <PlanForm key={JSON.stringify([mode, profile.id, props.itemName, props.itemPrice])} {...props} />;
}

export function PlanForm({ itemName, itemPrice, onClose, onSaved, onViewWishlist, onConsultGemini }: Props) {
  const { profile, mode, addToWishlist } = useFinancial();
  const existing = (profile.wishlist ?? []).find(item => wishlistProductKey(item) === wishlistProductKey({ name: itemName, price: itemPrice }));
  const [method, setMethod] = useState<"weeks" | "contribution">(existing?.planWeeks ? "weeks" : existing?.plannedWeeklySave ? "contribution" : "weeks");
  const [weeks, setWeeks] = useState(String(existing?.planWeeks ?? 6));
  const [contribution, setContribution] = useState(existing?.plannedWeeklySave?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const mounted = useRef(true);
  const dialog = useRef<HTMLDivElement | null>(null);
  useEffect(() => { mounted.current = true; dialog.current?.focus(); return () => { mounted.current = false; }; }, []);
  const savedAmount = existing?.savedAmount ?? 0;
  let math: ReturnType<typeof wishlistPlanMath> | null = null;
  try { math = wishlistPlanMath(itemPrice, method, Number(method === "weeks" ? weeks : contribution), savedAmount); } catch { /* Keep invalid edits local until confirmation. */ }
  const weekly = math?.weeklyContribution ?? null;
  const closed = existing?.decision === "purchased" || existing?.decision === "discarded";
  const valid = weekly !== null && validPurchasePrice(weekly) && itemName.trim() && validPurchasePrice(itemPrice) && !closed;
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (lock.current || !valid || weekly === null) return;
    lock.current = true; setSaving(true); setError(null);
    try {
      const xp = await addToWishlist({ name: itemName, price: itemPrice, strategy: "microsave", plannedWeeklySave: weekly,
        ...(method === "weeks" ? { planWeeks: Number(weeks) } : {}) }, 100);
      if (!mounted.current) return;
      setSaved(true); onSaved?.(xp);
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "No se pudo guardar el plan.");
    } finally { lock.current = false; if (mounted.current) setSaving(false); }
  };
  return <div className="fixed inset-0 z-[80] bg-slate-950/40 flex items-center justify-center p-3 sm:p-6">
    <motion.div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="microsave-title" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); if (!saving) onClose(); }
        if (event.key === "Tab") {
          const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]'));
          const first = controls[0], last = controls.at(-1);
          if (!first) event.preventDefault();
          else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
      }}
      className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-3xl border-2 border-b-4 border-emerald-200 border-b-emerald-600 bg-[#FAF8F5] p-5 space-y-4 shadow-xl">
      <div className="flex items-start justify-between gap-3"><div><PiggyBank className="text-emerald-600 mb-2" /><h2 id="microsave-title" className="font-heading font-bold text-xl">Plan de Micro-ahorro</h2></div>
        <button type="button" disabled={saving} aria-label="Cerrar plan" onClick={onClose} className="p-2 rounded-xl hover:bg-white disabled:opacity-50"><X className="w-5 h-5" /></button></div>
      <div className="rounded-2xl border-2 border-slate-200 bg-white p-3"><p className="font-heading font-bold break-words">{itemName}</p><p>Objetivo: {formatMXN(itemPrice)}</p><p className="text-xs text-slate-600">Ahorrado para este producto: {formatMXN(savedAmount)}</p></div>
      {saved ? <div role="status" className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-900">Plan guardado en Wishlist. Puedes consultarlo en Retos y Metas.</div> : <form onSubmit={save} className="space-y-3">
        {existing && <p className="text-xs text-slate-600">{closed ? "Este artículo ya está cerrado. Puedes consultarlo en Retos y Metas." : "Ya existe este producto. Guardar actualizará su plan y conservará su ahorro."}</p>}
        <label className="block text-sm font-heading font-bold">Configurar por<select aria-label="Configurar plan por" value={method} disabled={saving || closed} onChange={event => setMethod(event.target.value as typeof method)} className="mt-1 w-full rounded-xl border-2 border-slate-200 bg-white p-2 font-normal"><option value="weeks">Plazo en semanas</option><option value="contribution">Aportación semanal</option></select></label>
        {method === "weeks" ? <label className="block text-sm">Plazo de ahorro (semanas)<input aria-label="Plazo de ahorro en semanas" type="number" min="1" max="520" step="1" value={weeks} disabled={saving || closed} onChange={event => setWeeks(event.target.value)} className="mt-1 w-full rounded-xl border-2 border-slate-200 bg-white p-2" /></label>
          : <label className="block text-sm">Aportación semanal objetivo (MXN)<input aria-label="Aportación semanal objetivo" type="number" min="0.01" step="0.01" value={contribution} disabled={saving || closed} onChange={event => setContribution(event.target.value)} className="mt-1 w-full rounded-xl border-2 border-slate-200 bg-white p-2" /></label>}
        {math && <div className="rounded-2xl bg-white border border-emerald-200 p-3 text-sm"><p>Pendiente: {formatMXN(math.remainingTarget)}</p><p className="font-heading font-bold">Aportación objetivo: {formatMXN(weekly ?? 0)} por semana</p><p>Tiempo aritmético estimado: {math.estimatedWeeks ?? "sin calcular"} semanas</p></div>}
        <p className="text-xs text-slate-600">Es un objetivo matemático, no una aportación sostenible validada. Guardar el plan no descuenta saldo ni utiliza ahorros de otras metas.</p>
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        <button type="submit" disabled={saving || !valid || mode !== "demo" && mode !== "authenticated"} className="w-full rounded-2xl border-2 border-b-4 border-emerald-600 border-b-emerald-800 bg-[#10B981] p-3 font-heading font-bold text-white disabled:opacity-50 inline-flex justify-center items-center gap-2">{saving && <Loader2 className="w-4 h-4 animate-spin" />}{saving ? "Guardando plan…" : "Guardar plan en Wishlist"}</button>
      </form>}
      {(saved || existing) && (onViewWishlist ? <button type="button" disabled={saving} onClick={onViewWishlist} className="block w-full text-sm font-bold text-emerald-800 underline">Ver en Retos y Metas</button> : <Link href="/app#metas" className="block text-center text-sm font-bold text-emerald-800 underline">Ver en Retos y Metas</Link>)}
      {onConsultGemini && <button type="button" disabled={saving} onClick={onConsultGemini} className="w-full inline-flex justify-center items-center gap-2 text-sm text-slate-600 underline"><MessageSquare className="w-4 h-4" />Consultar mi plan con Gemini</button>}
    </motion.div>
  </div>;
}
