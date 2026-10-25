"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Bot, Loader2, Send, RotateCcw, Calculator } from "lucide-react";
import Link from "next/link";
import { useFinancial } from "@/context/FinancialContext";
import QuickSnapScanner, { type ScannedProductResult } from "./QuickSnapScanner";
import type { ChatRequest, ChatResponse, ProductContext } from "@/lib/ai/schemas";
import { formatMXN as mxn, validPurchasePrice } from "@/lib/finance/money";

type Message = { role: "user" | "assistant"; content: string; result?: ChatResponse };
interface Props {
  product?: ProductContext | null;
  selectionRevision?: number;
  suggestion?: { text: string; id: number };
  onClearProduct?: (pendingName?: string) => void;
  onOpenFinancialProfile?: () => void;
  onProduct?: (product: ProductContext, image?: ScannedProductResult) => void;
}
const suggestions = ["¿Cuánto puedo gastar hoy?", "¿Qué debería priorizar este mes?", "¿Cuánto tendría que ahorrar para comprarlo en cuatro semanas?"];

/** Remounting immediately clears sensitive state on account, financial-data or external-product changes. */
export default function FinancialChat(props: Props) {
  const { mode, profile, financialVersion } = useFinancial();
  return <ChatSession key={JSON.stringify([mode, profile.id, financialVersion, props.selectionRevision])} {...props} />;
}

export function ChatSession({ product: initialProduct = null, onProduct, suggestion, onClearProduct, onOpenFinancialProfile }: Props) {
  const { mode, profile } = useFinancial();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(suggestion?.text ?? "");
  const [lastSuggestion, setLastSuggestion] = useState(suggestion);
  if (suggestion !== lastSuggestion) { setLastSuggestion(suggestion); setInput(suggestion?.text ?? ""); }
  const [conversationToken, setConversationToken] = useState<string | undefined>();
  const [product, setProduct] = useState(initialProduct);
  const [pendingProductName, setPendingProductName] = useState<string | undefined>();
  const [manualName, setManualName] = useState("");
  const [manualPrice, setManualPrice] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(false);
  const lock = useRef(false);
  const epoch = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const lastRequest = useRef<Omit<ChatRequest, "requestId"> | null>(null);
  const tail = useRef<HTMLDivElement | null>(null);
  useEffect(() => () => { epoch.current++; controller.current?.abort(); lock.current = false; }, []);
  useEffect(() => { tail.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" }); }, [messages, sending, error]);

  const cancelPending = () => {
    epoch.current++; controller.current?.abort(); lock.current = false;
    setSending(false); setError(null); setRetry(false); lastRequest.current = null;
  };
  const send = async (options: { text?: string; confirmed?: ScannedProductResult; retry?: boolean; deterministicOnly?: boolean } = {}) => {
    if (lock.current) return;
    const text = (options.text ?? input).trim();
    const requestedProduct = options.confirmed?.price != null ? { name: options.confirmed.name, price: options.confirmed.price } : product;
    const previous = lastRequest.current;
    if (options.retry && !previous || !options.retry && !text) return;
    const request: Omit<ChatRequest, "requestId"> = options.retry && previous ? { ...previous, deterministicOnly: options.deterministicOnly ?? false } : {
      message: text, history: messages.filter(m => m.role === "user").slice(-10).map(m => ({ role: "user", content: m.content })),
      conversationToken, product: requestedProduct, pendingProductName: options.confirmed ? undefined : pendingProductName, mode: mode === "demo" ? "demo" : "account", demoProfileId: mode === "demo" && (profile.id === "mateo" || profile.id === "carlos") ? profile.id : undefined,
      deterministicOnly: options.deterministicOnly ?? false,
    };
    lock.current = true; const id = ++epoch.current;
    controller.current?.abort(); const abort = new AbortController(); controller.current = abort;
    lastRequest.current = request; setSending(true); setError(null); setRetry(false);
    if (!options.retry) { setMessages(prev => [...prev, { role: "user", content: text }]); setInput(""); }
    try {
      const response = await fetch("/api/ai/chat", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...request, requestId: crypto.randomUUID() }), signal: AbortSignal.any([abort.signal, AbortSignal.timeout(58_000)]) });
      const result: ChatResponse & { error?: string } = await response.json();
      if (epoch.current !== id) return;
      if (!response.ok) throw Error(result.error || "No se pudo consultar al copiloto.");
      if (typeof result.reply !== "string" || !Array.isArray(result.cards)) throw Error("La respuesta del copiloto no es válida.");
      setMessages(prev => [...prev, { role: "assistant", content: result.reply, result }]);
      setRetry(Boolean(result.warning));
      setConversationToken(result.conversationToken);
      if (result.clearProductContext) {
        setProduct(null); setPendingProductName(result.pendingProductName);
        onClearProduct?.(result.pendingProductName);
      } else if (result.product) {
        setPendingProductName(undefined);
        setProduct(result.product);
        onProduct?.(result.product, options.confirmed);
      }
    } catch (cause) {
      if (epoch.current === id && !abort.signal.aborted) { setError(cause instanceof Error ? cause.message : "No se pudo completar la consulta."); setRetry(true); }
    } finally {
      if (epoch.current === id) { lock.current = false; setSending(false); }
    }
  };
  const confirmation = (image: ScannedProductResult) => {
    if (image.price === null) return;
    setProduct({ name: image.name, price: image.price });
    void send({ text: `¿Puedo comprar ${image.name} por $${image.price} MXN?`, confirmed: image });
  };
  const resetConversation = () => {
    cancelPending(); setMessages([]); setInput(""); setConversationToken(undefined);
    setProduct(null); setPendingProductName(undefined); setManualName(""); setManualPrice(""); onClearProduct?.();
  };
  return <div className="space-y-3" aria-label="Copiloto financiero conversacional">
    <div className="flex justify-end"><button type="button" onClick={resetConversation} className="text-[11px] text-slate-500 underline">Nueva conversación</button></div>
    <p className="text-xs text-slate-500">Pregunta por compras, ahorros o prioridades. Las simulaciones no modifican tu cuenta.{mode === "demo" ? " Demo: usa el perfil inicial del servidor, con datos simulados." : ""}</p>
    {pendingProductName && <p className="text-xs text-amber-800">Producto por confirmar: <strong>{pendingProductName}</strong>. Falta su precio en MXN.</p>}
    {product && <p className="rounded-xl bg-emerald-50 border border-emerald-200 p-2 text-xs text-emerald-900">Producto en contexto: <strong>{product.name}</strong> · {mxn(product.price)}</p>}
    <div role="log" aria-live="polite" aria-relevant="additions" className="max-h-[34rem] overflow-y-auto space-y-3 pr-1">
      {messages.length === 0 && <div className="flex gap-2 text-sm text-slate-600 rounded-2xl bg-[#FAF8F5] p-3"><Bot className="h-5 w-5 text-emerald-600 shrink-0" />Cuéntame qué quieres comprar o qué necesitas organizar. Revisaremos tus datos registrados.</div>}
      {messages.map((message, i) => <motion.div key={i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
        <div className={`max-w-[95%] sm:max-w-[90%] rounded-2xl p-3 text-sm leading-relaxed ${message.role === "user" ? "bg-slate-900 text-white rounded-tr-sm" : "bg-[#FAF8F5] border border-slate-200 text-slate-800 rounded-tl-sm"}`}>
          {message.role === "assistant" && <p className="text-[11px] text-emerald-700 font-bold font-heading mb-2">{message.result?.source === "gemini" ? "Gemini · respuesta con cifras del motor" : "Motor financiero · respaldo sin conversación de IA"}</p>}
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
          {message.result?.cards.length ? <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">{message.result.cards.map((card, n) => <div key={n} className="rounded-xl bg-white border border-slate-200 p-2"><dt className="text-[11px] text-slate-500">{card.label}</dt><dd className="font-bold font-heading">{card.unit === "MXN" ? mxn(card.value) : `${card.value} ${card.unit}`}</dd></div>)}</dl> : null}
          {message.result?.warning && <p role="alert" className="text-xs text-amber-800 mt-2">{message.result.warning}</p>}
          {message.result?.actions?.map(action => onOpenFinancialProfile
            ? <button key={action.type} type="button" onClick={onOpenFinancialProfile} className="block mt-2 text-xs font-bold text-emerald-800 underline">{action.label}</button>
            : <Link key={action.type} href="/app#ingresos" className="block mt-2 text-xs font-bold text-emerald-800 underline">{action.label}</Link>)}
          {message.result?.product && <Link href={`/app/evaluate?name=${encodeURIComponent(message.result.product.name)}&price=${message.result.product.price}`} className="inline-block text-xs font-bold text-emerald-800 underline mt-3">Ver evaluación completa</Link>}
        </div>
      </motion.div>)}
      {sending && <p role="status" className="flex items-center gap-2 text-xs text-emerald-700"><Loader2 className="h-4 w-4 animate-spin" />Revisando tu consulta y los cálculos financieros…</p>}
      <div ref={tail} />
    </div>
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    {retry && <div className="flex flex-wrap gap-3">
      <button type="button" disabled={sending} onClick={() => void send({ retry: true })} className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 underline"><RotateCcw className="w-3 h-3" />Reintentar con Gemini</button>
      <button type="button" disabled={sending} onClick={() => void send({ retry: true, deterministicOnly: true })} className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 underline"><Calculator className="w-3 h-3" />Consultar cifras sin IA</button>
    </div>}
    <div className="flex flex-wrap gap-1.5">{suggestions.map(text => <button key={text} type="button" disabled={sending} onClick={() => setInput(text)} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 hover:border-emerald-400 disabled:opacity-50">{text}</button>)}</div>
    <form onSubmit={e => { e.preventDefault(); void send(); }} className="flex items-end gap-2">
      <textarea aria-label="Pregunta a tu copiloto financiero" maxLength={1500} rows={2} value={input} onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }}
        placeholder="Quiero un monitor de $3,000. ¿Me alcanza?" className="w-full min-w-0 resize-y rounded-2xl border-2 border-slate-200 bg-slate-50 p-3 text-sm focus:border-[#10B981] focus:outline-none" />
      <button type="submit" disabled={sending || !input.trim() || mode === "loading"} className="inline-flex h-12 shrink-0 items-center gap-1.5 rounded-2xl border-2 border-b-4 border-emerald-600 border-b-emerald-800 bg-[#10B981] px-3 text-xs font-bold font-heading text-white disabled:opacity-50"><Send className="h-4 w-4" />Enviar</button>
    </form>
    <QuickSnapScanner attachmentOnly requireImageConfirmation accessMode={mode === "demo" ? "demo" : "account"} demoProfileId={mode === "demo" ? profile.id : undefined} onAttachmentStart={cancelPending} onScanComplete={confirmation} />
    <details className="rounded-xl border border-slate-200 p-2 text-xs text-slate-600">
      <summary className="cursor-pointer font-heading">Evaluar un precio sin IA</summary>
      <form className="flex flex-wrap gap-2 mt-2" onSubmit={event => {
        event.preventDefault();
        const price = Number(manualPrice);
        if (!manualName.trim() || !validPurchasePrice(price)) { setError("Confirma un nombre y un precio positivo en MXN con hasta dos decimales."); return; }
        void send({ text: `Evaluar ${manualName.trim()} por $${price} MXN sin IA`, deterministicOnly: true,
          confirmed: { name: manualName.trim(), price, source: "manual", thumbnailDataUrl: "", storeTag: "Precio confirmado manualmente" } });
      }}>
        <input aria-label="Producto para evaluación sin IA" required maxLength={200} value={manualName} onChange={e => setManualName(e.target.value)} placeholder="Producto" className="min-w-0 flex-1 rounded-lg border border-slate-200 p-2" />
        <input aria-label="Precio en MXN para evaluación sin IA" required type="number" min="0.01" step="0.01" value={manualPrice} onChange={e => setManualPrice(e.target.value)} placeholder="Precio MXN" className="w-28 rounded-lg border border-slate-200 p-2" />
        <button type="submit" disabled={sending} className="rounded-lg bg-slate-900 px-3 py-2 font-bold text-white disabled:opacity-50">Enviar sin IA</button>
      </form>
    </details>
    <button type="button" disabled={sending} onClick={() => void send({ text: "Consultar evaluación determinista del producto o margen registrado", deterministicOnly: true })} className="text-xs text-slate-500 underline">Ver cifras sin IA</button>
  </div>;
}
