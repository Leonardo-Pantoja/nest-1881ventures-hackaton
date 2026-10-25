"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  Sparkles,
  Loader2,
  Upload,
  X,
  Footprints,
  Gamepad2,
  Headphones,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { playTap } from "@/lib/soundEffects";
import { validPurchasePrice } from "@/lib/finance/money";

export interface ScannedProductResult {
  name: string;
  price: number | null;
  thumbnailDataUrl: string;
  storeTag: string;
  currency?: string | null;
  source?: "gemini" | "demo" | "text" | "manual";
}

interface QuickSnapScannerProps {
  onScanComplete: (result: ScannedProductResult) => void;
  /**
   * When true, renders only a clean camera icon button meant to live inside the right side of the search input bar,
   * and opens a clean modal/popover when clicked.
   */
  inlineIconTrigger?: boolean;
  embedded?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  accessMode?: "account" | "demo";
  demoProfileId?: string;
  textQuery?: string;
  textFormId?: string;
}

interface PresetStoreCapture {
  id: string;
  label: string;
  productName: string;
  price: number;
  storeName: string;
  icon: React.ElementType;
  svgDataUrl: string;
}

// Embedded SVG Store Screenshots for zero-latency offline/online demo
const PRESET_CAPTURES: PresetStoreCapture[] = [
  {
    id: "jordan",
    label: "👟 Tenis Jordan",
    productName: "Air Jordan 1 Mid SE",
    price: 3200,
    storeName: "SNKRS Shop MX",
    icon: Footprints,
    svgDataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200">
        <rect width="320" height="200" rx="20" fill="#F8FAFC"/>
        <rect x="16" y="14" width="110" height="22" rx="11" fill="#0F172A"/>
        <text x="71" y="29" font-family="sans-serif" font-size="10" font-weight="bold" fill="#FFFFFF" text-anchor="middle">SNKRS STORE MX</text>
        <path d="M75 118 L125 82 L152 98 L215 110 C232 112 240 124 238 136 L72 136 Z" fill="#0F172A"/>
        <path d="M72 132 L240 132 L240 145 C240 149 235 152 228 152 L80 152 C74 152 72 148 72 144 Z" fill="#FFFFFF" stroke="#0F172A" stroke-width="3"/>
        <path d="M115 95 L168 118" stroke="#10B981" stroke-width="5" stroke-linecap="round"/>
        <rect x="18" y="158" width="284" height="30" rx="8" fill="#FFFFFF"/>
        <text x="30" y="177" font-family="sans-serif" font-size="13" font-weight="bold" fill="#0F172A">Air Jordan 1 Mid SE</text>
        <text x="290" y="177" font-family="monospace" font-size="14" font-weight="bold" fill="#059669" text-anchor="end">$3,200 MXN</text>
      </svg>
    `)}`,
  },
  {
    id: "consola",
    label: "🎮 Consola Switch",
    productName: "Nintendo Switch OLED",
    price: 5400,
    storeName: "GamerStore App",
    icon: Gamepad2,
    svgDataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200">
        <rect width="320" height="200" rx="20" fill="#F8FAFC"/>
        <rect x="16" y="14" width="115" height="22" rx="11" fill="#0F172A"/>
        <text x="73" y="29" font-family="sans-serif" font-size="10" font-weight="bold" fill="#FFFFFF" text-anchor="middle">GAMER SHOP MX</text>
        <rect x="75" y="54" width="32" height="84" rx="14" fill="#10B981"/>
        <rect x="107" y="54" width="106" height="84" rx="6" fill="#0F172A"/>
        <rect x="115" y="62" width="90" height="68" rx="4" fill="#1E293B"/>
        <rect x="213" y="54" width="32" height="84" rx="14" fill="#334155"/>
        <circle cx="91" cy="76" r="5" fill="#0F172A"/>
        <circle cx="229" cy="96" r="5" fill="#FFFFFF"/>
        <rect x="18" y="154" width="284" height="32" rx="8" fill="#FFFFFF"/>
        <text x="30" y="174" font-family="sans-serif" font-size="12" font-weight="bold" fill="#0F172A">Nintendo Switch OLED</text>
        <text x="290" y="174" font-family="monospace" font-size="14" font-weight="bold" fill="#059669" text-anchor="end">$5,400 MXN</text>
      </svg>
    `)}`,
  },
  {
    id: "audifonos",
    label: "🎧 Audífonos Sony",
    productName: "Audífonos Inalámbricos Sony",
    price: 2300,
    storeName: "TechMarket Oficial",
    icon: Headphones,
    svgDataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200">
        <rect width="320" height="200" rx="20" fill="#F8FAFC"/>
        <rect x="16" y="14" width="115" height="22" rx="11" fill="#0F172A"/>
        <text x="73" y="29" font-family="sans-serif" font-size="10" font-weight="bold" fill="#FFFFFF" text-anchor="middle">TECH MARKET MX</text>
        <path d="M112 112 A 48 48 0 0 1 208 112" fill="none" stroke="#0F172A" stroke-width="10" stroke-linecap="round"/>
        <rect x="98" y="98" width="24" height="40" rx="12" fill="#10B981"/>
        <rect x="198" y="98" width="24" height="40" rx="12" fill="#10B981"/>
        <rect x="18" y="154" width="284" height="32" rx="8" fill="#FFFFFF"/>
        <text x="30" y="174" font-family="sans-serif" font-size="12" font-weight="bold" fill="#0F172A">Audífonos Sony ANC</text>
        <text x="290" y="174" font-family="monospace" font-size="14" font-weight="bold" fill="#059669" text-anchor="end">$2,300 MXN</text>
      </svg>
    `)}`,
  },
];

export default function QuickSnapScanner({
  onScanComplete, inlineIconTrigger = false, embedded = false,
  open, onOpenChange, accessMode = "account", demoProfileId, textQuery, textFormId,
}: QuickSnapScannerProps) {
  const [localOpen, setLocalOpen] = useState(false);
  const isOpen = open ?? localOpen;
  const setOpen = (value: boolean) => { setLocalOpen(value); onOpenChange?.(value); };
  const [isScanning, setIsScanning] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [draft, setDraft] = useState<ScannedProductResult | null>(null);
  const [draftPrice, setDraftPrice] = useState("");
  const [scanError, setScanError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const operation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const lastRequest = useRef<{ text: string } | { file: File } | null>(null);
  useEffect(() => () => { operation.current++; controller.current?.abort(); }, []);

  const cancel = () => {
    operation.current++;
    controller.current?.abort();
    busy.current = false;
    lastRequest.current = null;
    setCanRetry(false);
    setIsScanning(false); setDraft(null); setPreview(null); setScanError(null); setOpen(false);
  };
  const review = (result: ScannedProductResult) => {
    setDraft(result);
    setDraftPrice(result.price === null || (result.currency && result.currency !== "MXN") ? "" : String(result.price));
  };
  const recognize = async (file: File) => {
    if (busy.current) return;
    lastRequest.current = null;
    setCanRetry(false);
    const id = ++operation.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setOpen(true); setDraft(null); setPreview(null); setScanError(null); setIsScanning(false);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setScanError("El archivo no es válido. Usa una imagen JPG, PNG o WebP."); return;
    }
    if (!file.size || file.size > 8 * 1024 * 1024) {
      setScanError("La imagen debe pesar entre 1 byte y 8 MB."); return;
    }
    setIsScanning(true);
    busy.current = true;
    lastRequest.current = { file };
    setCanRetry(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
        reader.readAsDataURL(file);
      });
      if (operation.current !== id) return;
      setPreview(dataUrl);
      const form = new FormData(); form.append("image", file);
      const response = await fetch("/api/ai/recognize-product", {
        method: "POST", body: form, signal: abort.signal,
        headers: { "x-recognition-mode": accessMode, ...(demoProfileId ? { "x-demo-profile": demoProfileId } : {}) },
      });
      const result = await response.json();
      if (operation.current !== id) return;
      if (!response.ok) throw new Error(result.error || "No se pudo reconocer el producto.");
      if (result.name !== null && typeof result.name !== "string" || result.price !== null && (typeof result.price !== "number" || !Number.isFinite(result.price) || result.price < 0) || result.currency !== null && (typeof result.currency !== "string" || !/^[A-Z]{3}$/.test(result.currency))) {
        throw new Error("La respuesta del reconocimiento no es válida. Reintenta.");
      }
      if (!result.name && result.price === null) {
        throw new Error("Gemini no pudo identificar el producto. Prueba otra imagen o escríbelo en la barra de búsqueda.");
      }
      review({ name: result.name ?? "", price: result.price, currency: result.currency, source: "gemini", thumbnailDataUrl: dataUrl, storeTag: "Reconocido con Gemini" });
    } catch (error) {
      if (operation.current === id && !abort.signal.aborted) setScanError(error instanceof Error ? error.message : "No se pudo analizar la imagen.");
    } finally {
      if (operation.current === id) { busy.current = false; setIsScanning(false); }
    }
  };
  const analyzeText = async (text: string) => {
    if (busy.current) return;
    lastRequest.current = null;
    setCanRetry(false);
    setOpen(true); setScanError(null); setDraft(null); setPreview(null);
    if (!text.trim() || text.length > 500) { setScanError("Escribe un producto de entre 1 y 500 caracteres."); return; }
    const id = ++operation.current;
    controller.current?.abort();
    const abort = new AbortController(); controller.current = abort;
    busy.current = true; setIsScanning(true); lastRequest.current = { text };
    setCanRetry(true);
    try {
      const response = await fetch("/api/ai/parse-product", {
        method: "POST", signal: abort.signal,
        headers: { "Content-Type": "application/json", "x-recognition-mode": accessMode, ...(demoProfileId ? { "x-demo-profile": demoProfileId } : {}) },
        body: JSON.stringify({ text }),
      });
      const result = await response.json();
      if (operation.current !== id) return;
      if (!response.ok) throw new Error(result.error || "No se pudo interpretar el producto. Puedes reintentar.");
      if (result.name !== null && typeof result.name !== "string" || result.price !== null && (typeof result.price !== "number" || !Number.isFinite(result.price) || result.price < 0) || result.currency !== null && (typeof result.currency !== "string" || !/^[A-Z]{3}$/.test(result.currency))) throw new Error("Gemini devolvió datos inválidos. Puedes reintentar.");
      if (!result.name && result.price === null) throw new Error("Gemini no pudo identificar un producto. Prueba con otra descripción.");
      review({ name: result.name ?? "", price: result.price, currency: result.currency, source: "text", thumbnailDataUrl: "", storeTag: "Texto interpretado con Gemini" });
    } catch (error) {
      if (operation.current === id && !abort.signal.aborted) setScanError(error instanceof Error ? error.message : "No se pudo interpretar el producto.");
    } finally {
      if (operation.current === id) { busy.current = false; setIsScanning(false); }
    }
  };
  const chooseDemo = (preset: PresetStoreCapture) => {
    busy.current = false;
    operation.current++; controller.current?.abort(); setIsScanning(false); setScanError(null);
    setOpen(true);
    review({ name: preset.productName, price: preset.price, currency: "MXN", source: "demo", thumbnailDataUrl: preset.svgDataUrl, storeTag: `Demo · ${preset.storeName}` });
  };
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = "";
    if (file) void recognize(file);
  };
  const uploadZone = (
    <div onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)} onDrop={(event) => {
        event.preventDefault(); setDragging(false);
        const file = event.dataTransfer.files[0]; if (file) void recognize(file);
      }}
      className={`rounded-2xl border-2 border-b-4 p-3 transition-colors ${dragging ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-[#FAF8F5]"}`}>
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileUpload} className="hidden" aria-label="Seleccionar imagen del producto" />
      <motion.button type="button" whileTap={{ scale: 0.98 }} onClick={() => fileInputRef.current?.click()}
        className="w-full flex items-center justify-center gap-2 text-xs font-bold font-heading text-slate-700 rounded-xl py-1 focus-visible:outline-2 focus-visible:outline-emerald-500 cursor-pointer">
        <Upload className="w-4 h-4 text-emerald-600" />Subir o arrastrar imagen del producto
      </motion.button>
      <p className="text-center text-[10px] text-slate-500 mt-1">Captura de tienda o fotografía · JPG, PNG, WebP · Máx. 8 MB</p>
    </div>
  );
  const panel = (
    <div className="space-y-3" aria-busy={isScanning}>
      {scanError && <div className="space-y-2"><p role="alert" className="text-xs text-red-600">{scanError}</p>
        {canRetry && <button type="button" disabled={isScanning} onClick={() => {
          const previous = lastRequest.current;
          if (previous && "text" in previous) void analyzeText(previous.text);
          else if (previous) void recognize(previous.file);
        }} className="text-xs font-bold font-heading text-emerald-700 underline cursor-pointer">Reintentar análisis</button>}
      </div>}
      {isScanning && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} role="status" className="rounded-2xl border-2 border-b-4 border-emerald-200 bg-emerald-50 p-3 flex items-center gap-3">
        {preview && <img src={preview} alt="Imagen en proceso" className="w-14 h-14 rounded-xl object-cover" />}
        <Loader2 className="w-5 h-5 text-emerald-600 animate-spin shrink-0" />
        <p className="text-xs font-heading font-bold text-emerald-800">Gemini está analizando tu producto...</p>
      </motion.div>}
      {draft && <motion.form data-product-confirmation initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border-2 border-b-4 border-emerald-200 bg-white p-3 space-y-3" onSubmit={(event) => {
        event.preventDefault();
        const price = Number(draftPrice);
        if (!draft.name.trim() || !draftPrice.trim() || !Number.isFinite(price) || price <= 0 || !validPurchasePrice(price)) {
          setScanError("Escribe un nombre y un precio positivo en MXN, con hasta dos decimales."); return;
        }
        const confirmed = { ...draft, name: draft.name.trim(), price, currency: "MXN" };
        cancel(); onScanComplete(confirmed);
      }}>
        <div className="flex items-center gap-3">
          {draft.thumbnailDataUrl && <img src={draft.thumbnailDataUrl} alt="Producto por confirmar" className="w-16 h-16 object-contain rounded-xl border border-slate-200" />}
          <div className="text-xs space-y-1">
            <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200"><Sparkles className="w-3 h-3 mr-1" />{draft.source === "demo" ? "Demo · Datos simulados" : draft.source === "manual" ? "Datos manuales" : "Interpretado con Gemini"}</Badge>
            <p className="text-slate-500">Origen: {draft.source === "text" ? "Texto" : draft.source === "manual" ? "Entrada manual" : draft.source === "demo" ? "Demo" : "Imagen"}</p>
            <p className="text-slate-500">Moneda detectada: {draft.currency ?? "No identificada"}</p>
            <p className="text-slate-500">Precio detectado: {draft.price === null ? "No identificado" : `${draft.price.toLocaleString()} ${draft.currency ?? "(moneda sin identificar)"}`}</p>
            {draft.currency && draft.currency !== "MXN" && <p className="text-amber-700">Ingresa el precio en MXN. No convertimos monedas.</p>}
          </div>
        </div>
        {!draft.name && <p role="status" className="text-xs text-amber-700">Gemini no pudo identificar el producto. Escribe su nombre o prueba otra imagen.</p>}
        {draft.price === null && <p role="status" className="text-xs text-amber-700">No se identificó un precio; ingrésalo manualmente.</p>}
        <label className="block text-xs font-heading text-slate-700">Nombre del producto
          <input required maxLength={200} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="mt-1 w-full rounded-xl border-2 border-slate-200 p-2 focus:outline-emerald-500" />
        </label>
        <label className="block text-xs font-heading text-slate-700">Precio confirmado (MXN)
          <input required type="number" min="0.01" step="0.01" value={draftPrice} onChange={(event) => setDraftPrice(event.target.value)} className="mt-1 w-full rounded-xl border-2 border-slate-200 p-2 focus:outline-emerald-500" />
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={cancel} className="rounded-xl border-2 border-b-4 border-slate-200 px-3 py-2 text-xs font-bold font-heading cursor-pointer">Cancelar</button>
          <button type="submit" className="flex-1 rounded-xl border-2 border-b-4 border-emerald-600 border-b-emerald-800 bg-[#10B981] hover:bg-emerald-600 py-2 text-xs font-bold font-heading text-white cursor-pointer">Confirmar y evaluar</button>
        </div>
      </motion.form>}
      {!draft && <>
        {accessMode === "demo" && <div>
          <p className="text-[10px] text-slate-500 mb-2">Capturas demo · Datos simulados, sin Gemini</p>
          <div className="grid grid-cols-3 gap-2">{PRESET_CAPTURES.map(preset => <motion.button key={preset.id} type="button" whileTap={{ scale: 0.97 }} onClick={() => chooseDemo(preset)} className="rounded-2xl border-2 border-b-4 border-slate-200 bg-white p-2 text-left hover:border-emerald-400 cursor-pointer">
            <img src={preset.svgDataUrl} alt={preset.productName} className="w-full h-16 object-contain rounded-xl" />
            <p className="text-[10px] font-bold font-heading">{preset.productName}</p><p className="text-[10px] text-emerald-700">${preset.price.toLocaleString()} MXN · Demo</p>
          </motion.button>)}</div>
        </div>}
        <button type="button" onClick={cancel} className="text-xs text-slate-500 hover:text-slate-800 font-heading cursor-pointer">Cancelar</button>
      </>}
    </div>
  );
  const textActions = textQuery !== undefined && <form id={textFormId} onSubmit={event => { event.preventDefault(); void analyzeText(textQuery); }} className="flex flex-wrap items-center gap-2">
    <motion.button type="submit" disabled={isScanning || !textQuery.trim()} whileTap={{ scale: 0.98 }} className="inline-flex items-center gap-2 rounded-2xl border-2 border-b-4 border-emerald-600 border-b-emerald-800 bg-[#10B981] hover:bg-emerald-600 px-4 py-2 text-xs font-bold font-heading text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
      {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}Buscar con IA
    </motion.button>
    <button type="button" disabled={isScanning} onClick={() => { cancel(); setOpen(true); review({ name: textQuery.trim().slice(0, 200), price: null, currency: "MXN", source: "manual", thumbnailDataUrl: "", storeTag: "Entrada manual" }); }} className="text-xs font-heading text-slate-600 underline cursor-pointer">Ingresar manualmente</button>
  </form>;
  if (embedded) return <div className="space-y-3">{textActions}{uploadZone}<AnimatePresence>{isOpen && panel}</AnimatePresence></div>;
  return <>
    <motion.button type="button" whileTap={{ scale: 0.95 }} onClick={() => { playTap(); setOpen(true); }} title="Escanear producto o captura de tienda" aria-label="Escanear producto o captura de tienda"
      className={inlineIconTrigger ? "h-10 px-3 rounded-xl bg-slate-100 border border-slate-200 flex items-center gap-2 text-xs font-semibold cursor-pointer" : "w-full py-3 px-4 rounded-2xl bg-white border-2 border-b-4 border-slate-200 flex items-center gap-2 text-xs font-bold font-heading cursor-pointer"}>
      <Camera className="w-4 h-4 text-slate-700" /><span className={inlineIconTrigger ? "hidden sm:inline" : ""}>Escanear producto</span>
    </motion.button>
    <AnimatePresence>{isOpen && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onClick={cancel}>
      <motion.div initial={{ y: 12 }} animate={{ y: 0 }} onClick={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Reconocer producto" className="w-full max-w-lg max-h-[90dvh] overflow-auto rounded-3xl border-2 border-b-4 border-slate-200 bg-white p-5 space-y-3">
        <div className="flex items-center justify-between"><h3 className="text-sm font-bold font-heading">Escanear producto o captura</h3><button type="button" onClick={cancel} aria-label="Cerrar reconocimiento"><X className="w-4 h-4" /></button></div>
        {uploadZone}{panel}
      </motion.div>
    </motion.div>}</AnimatePresence>
  </>;
}
