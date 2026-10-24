"use client";

import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  Sparkles,
  ScanLine,
  Upload,
  X,
  Footprints,
  Gamepad2,
  Headphones,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useFinancial } from "@/context/FinancialContext";
import { playTap, playCoin } from "@/lib/soundEffects";
import type { EvaluateApiResponse } from "@/app/api/evaluate/route";

export interface ScannedProductResult {
  name: string;
  price: number;
  thumbnailDataUrl: string;
  storeTag: string;
  apiResponse?: EvaluateApiResponse | null;
}

interface QuickSnapScannerProps {
  onScanComplete: (result: ScannedProductResult) => void;
  /**
   * When true, renders only a clean camera icon button meant to live inside the right side of the search input bar,
   * and opens a clean modal/popover when clicked.
   */
  inlineIconTrigger?: boolean;
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
  onScanComplete,
  inlineIconTrigger = false,
}: QuickSnapScannerProps) {
  const { profile } = useFinancial();

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanningPreviewUrl, setScanningPreviewUrl] = useState<string | null>(
    null
  );
  const [scanningLabel, setScanningLabel] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const executeScanWithLaser = async (params: {
    name: string;
    price: number;
    previewUrl: string;
    storeTag: string;
    imageBase64?: string | null;
    imageMimeType?: string | null;
  }) => {
    setScanningPreviewUrl(params.previewUrl);
    setScanningLabel(`${params.name} · $${params.price.toLocaleString()} MXN`);
    setIsScanning(true);

    const startTime = Date.now();
    let apiData: EvaluateApiResponse | null = null;

    try {
      const response = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemName: params.name,
          itemPrice: params.price,
          imageBase64: params.imageBase64 ?? null,
          imageMimeType: params.imageMimeType ?? null,
          profile,
        }),
      });
      if (response.ok) {
        apiData = (await response.json()) as EvaluateApiResponse;
      }
    } catch {
      // Automatic fallback
    }

    const elapsed = Date.now() - startTime;
    const remainingWait = Math.max(0, 1500 - elapsed);
    await new Promise((resolve) => setTimeout(resolve, remainingWait));

    const finalName = apiData?.detectedItemName || params.name;
    const finalPrice = apiData?.detectedItemPrice || params.price;

    setIsScanning(false);
    setIsPickerOpen(false);
    playCoin();

    onScanComplete({
      name: finalName,
      price: finalPrice,
      thumbnailDataUrl: params.previewUrl,
      storeTag: params.storeTag,
      apiResponse: apiData,
    });
  };

  const handleSelectPreset = (preset: PresetStoreCapture) => {
    void executeScanWithLaser({
      name: preset.productName,
      price: preset.price,
      previewUrl: preset.svgDataUrl,
      storeTag: preset.storeName,
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      const cleanFileName = file.name.replace(/\.[^/.]+$/, "");
      const numberInFile = cleanFileName.match(/(\d{3,5})/);
      const fallbackPrice = numberInFile ? Number(numberInFile[1]) : 2450;
      const fallbackName =
        cleanFileName.length > 2
          ? `Captura: ${cleanFileName.slice(0, 24)}`
          : "Producto en captura";

      void executeScanWithLaser({
        name: fallbackName,
        price: fallbackPrice,
        previewUrl: dataUrl || PRESET_CAPTURES[0].svgDataUrl,
        storeTag: "Captura subida · Gemini Vision",
        imageBase64: dataUrl,
        imageMimeType: file.type || "image/png",
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      {inlineIconTrigger ? (
        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            playTap();
            setIsPickerOpen(true);
          }}
          className="h-10 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 hover:text-slate-900 border border-slate-200 flex items-center gap-2 text-xs font-semibold transition-colors cursor-pointer shrink-0"
          title="Escanear producto o captura de tienda"
          aria-label="Escanear producto o captura de tienda"
        >
          <Camera className="w-4 h-4 text-slate-700" strokeWidth={1.5} />
          <span className="hidden sm:inline">Escanear</span>
        </motion.button>
      ) : (
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            playTap();
            setIsPickerOpen((prev) => !prev);
          }}
          className="w-full py-3 px-4 rounded-2xl bg-white border border-slate-200 shadow-sm hover:bg-slate-50 text-slate-800 font-semibold text-xs sm:text-sm transition-all flex items-center justify-between gap-2 cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
              <Camera className="w-4 h-4 text-slate-700" strokeWidth={1.5} />
            </div>
            <span>Escanear producto o captura de tienda</span>
          </div>
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full shrink-0">
            IA Vision
          </span>
        </motion.button>
      )}

      {/* Clean Modal / Drawer for QuickSnap Scanner */}
      <AnimatePresence>
        {isPickerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => !isScanning && setIsPickerOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-xl space-y-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                    <ScanLine
                      className="w-4 h-4 text-emerald-600"
                      strokeWidth={1.5}
                    />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 font-heading">
                      Escanear producto o captura
                    </h3>
                    <p className="text-xs text-slate-500">
                      Elige una captura de ejemplo o sube una imagen
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPickerOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </div>

              <AnimatePresence mode="wait">
                {isScanning && scanningPreviewUrl ? (
                  <motion.div
                    key="laser-scanner-active"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="relative rounded-2xl overflow-hidden border border-emerald-500 bg-slate-950 shadow-md"
                  >
                    <img
                      src={scanningPreviewUrl}
                      alt="Escaneando captura"
                      className="w-full h-44 object-cover opacity-85"
                    />

                    <motion.div
                      initial={{ top: "4%" }}
                      animate={{ top: ["6%", "88%", "6%"] }}
                      transition={{
                        duration: 1.35,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                      className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_18px_4px_rgba(16,185,129,0.85)] z-20"
                    />

                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/25 to-slate-950/50 flex flex-col justify-between p-4">
                      <div className="flex items-center justify-between">
                        <Badge className="bg-emerald-500 text-white font-bold text-[10px] px-2.5 py-0.5 border-none">
                          <Sparkles
                            className="w-3 h-3 mr-1"
                            strokeWidth={1.5}
                          />
                          LECTURA ÓPTICA IA
                        </Badge>
                        <span className="text-[11px] font-mono text-emerald-300">
                          1.5s
                        </span>
                      </div>

                      <div className="space-y-1 text-center">
                        <p className="text-sm font-bold text-white">
                          Leyendo precio e impacto en tu liquidez...
                        </p>
                        <p className="text-xs font-mono text-emerald-300">
                          {scanningLabel}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="scanner-options"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {PRESET_CAPTURES.map((preset) => {
                        const Icon = preset.icon;
                        return (
                          <motion.button
                            key={preset.id}
                            type="button"
                            whileTap={{ scale: 0.97 }}
                            onClick={() => handleSelectPreset(preset)}
                            className="rounded-2xl border border-slate-200 bg-white hover:border-emerald-500 hover:shadow-sm p-3 text-left transition-all cursor-pointer flex flex-col justify-between gap-2"
                          >
                            <div className="w-full h-20 rounded-xl overflow-hidden border border-slate-100 bg-slate-50">
                              <img
                                src={preset.svgDataUrl}
                                alt={preset.productName}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div>
                              <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                                <Icon className="w-3 h-3" strokeWidth={1.5} />
                                <span>{preset.storeName}</span>
                              </div>
                              <p className="text-xs font-bold text-slate-900 mt-0.5">
                                {preset.productName}
                              </p>
                              <p className="text-xs font-bold text-emerald-600 mt-0.5">
                                ${preset.price.toLocaleString()} MXN
                              </p>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>

                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.98 }}
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-3 px-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                      >
                        <Upload
                          className="w-4 h-4 text-slate-600"
                          strokeWidth={1.5}
                        />
                        <span>Subir captura desde mi dispositivo</span>
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
