"use client";

import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  Sparkles,
  ScanLine,
  Upload,
  CheckCircle2,
  X,
  Footprints,
  Gamepad2,
  Headphones,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useFinancial } from "@/context/FinancialContext";
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
}

interface PresetStoreCapture {
  id: string;
  label: string;
  productName: string;
  price: number;
  storeName: string;
  badgeColor: string;
  icon: React.ElementType;
  svgDataUrl: string;
}

// Embedded SVG Store Screenshots for zero-latency offline/online demo
const PRESET_CAPTURES: PresetStoreCapture[] = [
  {
    id: "jordan",
    label: "👟 Tenis Jordan en tienda online",
    productName: "Air Jordan 1 Mid SE",
    price: 3200,
    storeName: "SNKRS Shop MX",
    badgeColor: "from-rose-500/15 to-orange-500/10 border-rose-300/80 text-rose-950",
    icon: Footprints,
    svgDataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200">
        <defs>
          <linearGradient id="bg1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#FFF1F2"/>
            <stop offset="100%" stop-color="#FFE4E6"/>
          </linearGradient>
        </defs>
        <rect width="320" height="200" rx="20" fill="url(#bg1)"/>
        <rect x="16" y="14" width="110" height="22" rx="11" fill="#0F172A"/>
        <text x="71" y="29" font-family="sans-serif" font-size="10" font-weight="bold" fill="#FFFFFF" text-anchor="middle">SNKRS STORE MX</text>
        <!-- Stylized Sneaker Illustration -->
        <path d="M75 118 L125 82 L152 98 L215 110 C232 112 240 124 238 136 L72 136 Z" fill="#E11D48"/>
        <path d="M72 132 L240 132 L240 145 C240 149 235 152 228 152 L80 152 C74 152 72 148 72 144 Z" fill="#FFFFFF" stroke="#0F172A" stroke-width="3"/>
        <path d="M115 95 L168 118" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round"/>
        <rect x="18" y="158" width="284" height="30" rx="8" fill="#FFFFFF"/>
        <text x="30" y="177" font-family="sans-serif" font-size="13" font-weight="bold" fill="#0F172A">Air Jordan 1 Mid SE</text>
        <text x="290" y="177" font-family="monospace" font-size="14" font-weight="bold" fill="#E11D48" text-anchor="end">$3,200 MXN</text>
      </svg>
    `)}`,
  },
  {
    id: "consola",
    label: "🎮 Consola / Juego Edición Especial",
    productName: "Nintendo Switch OLED + Juego",
    price: 5400,
    storeName: "GamerStore App",
    badgeColor: "from-indigo-500/15 to-sky-500/10 border-indigo-300/80 text-indigo-950",
    icon: Gamepad2,
    svgDataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200">
        <defs>
          <linearGradient id="bg2" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#EEF2FF"/>
            <stop offset="100%" stop-color="#E0E7FF"/>
          </linearGradient>
        </defs>
        <rect width="320" height="200" rx="20" fill="url(#bg2)"/>
        <rect x="16" y="14" width="115" height="22" rx="11" fill="#312E81"/>
        <text x="73" y="29" font-family="sans-serif" font-size="10" font-weight="bold" fill="#FFFFFF" text-anchor="middle">GAMER SHOP MX</text>
        <!-- Handheld Console -->
        <rect x="75" y="54" width="32" height="84" rx="14" fill="#38BDF8"/>
        <rect x="107" y="54" width="106" height="84" rx="6" fill="#0F172A"/>
        <rect x="115" y="62" width="90" height="68" rx="4" fill="#1E293B"/>
        <rect x="213" y="54" width="32" height="84" rx="14" fill="#F43F5E"/>
        <circle cx="91" cy="76" r="5" fill="#0F172A"/>
        <circle cx="229" cy="96" r="5" fill="#0F172A"/>
        <rect x="18" y="154" width="284" height="32" rx="8" fill="#FFFFFF"/>
        <text x="30" y="174" font-family="sans-serif" font-size="12" font-weight="bold" fill="#0F172A">Switch OLED + Juego</text>
        <text x="290" y="174" font-family="monospace" font-size="14" font-weight="bold" fill="#4F46E5" text-anchor="end">$5,400 MXN</text>
      </svg>
    `)}`,
  },
  {
    id: "audifonos",
    label: "🎧 Audífonos Sony Noise Cancelling",
    productName: "Audífonos Inalámbricos Sony",
    price: 2300,
    storeName: "TechMarket Oficial",
    badgeColor: "from-emerald-500/15 to-teal-500/10 border-emerald-300/80 text-emerald-950",
    icon: Headphones,
    svgDataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200">
        <defs>
          <linearGradient id="bg3" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#ECFDF5"/>
            <stop offset="100%" stop-color="#CCFBF1"/>
          </linearGradient>
        </defs>
        <rect width="320" height="200" rx="20" fill="url(#bg3)"/>
        <rect x="16" y="14" width="115" height="22" rx="11" fill="#065F46"/>
        <text x="73" y="29" font-family="sans-serif" font-size="10" font-weight="bold" fill="#FFFFFF" text-anchor="middle">TECH MARKET MX</text>
        <!-- Headphones Illustration -->
        <path d="M112 112 A 48 48 0 0 1 208 112" fill="none" stroke="#0F172A" stroke-width="10" stroke-linecap="round"/>
        <rect x="98" y="98" width="24" height="40" rx="12" fill="#047857"/>
        <rect x="198" y="98" width="24" height="40" rx="12" fill="#047857"/>
        <rect x="18" y="154" width="284" height="32" rx="8" fill="#FFFFFF"/>
        <text x="30" y="174" font-family="sans-serif" font-size="12" font-weight="bold" fill="#0F172A">Audífonos Sony ANC</text>
        <text x="290" y="174" font-family="monospace" font-size="14" font-weight="bold" fill="#059669" text-anchor="end">$2,300 MXN</text>
      </svg>
    `)}`,
  },
];

export default function QuickSnapScanner({
  onScanComplete,
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
      // Instant fallback handled below
    }

    // Ensure the 1.5s laser scan animation plays smoothly for the user
    const elapsed = Date.now() - startTime;
    const remainingWait = Math.max(0, 1500 - elapsed);
    await new Promise((resolve) => setTimeout(resolve, remainingWait));

    const finalName = apiData?.detectedItemName || params.name;
    const finalPrice = apiData?.detectedItemPrice || params.price;

    setIsScanning(false);
    setIsPickerOpen(false);

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
      // Infer smart fallback price/name from filename if no Gemini API key is set
      const cleanFileName = file.name.replace(/\.[^/.]+$/, "");
      const numberInFile = cleanFileName.match(/(\d{3,5})/);
      const fallbackPrice = numberInFile ? Number(numberInFile[1]) : 2450;
      const fallbackName =
        cleanFileName.length > 2
          ? `Captura: ${cleanFileName.slice(0, 24)}`
          : "Producto en captura de tienda";

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
    <div className="space-y-3">
      {/* Eye-catching Trigger Button */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.96 }}
        onClick={() => setIsPickerOpen((prev) => !prev)}
        className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-500 to-amber-500 text-white font-bold text-xs sm:text-sm shadow-sm hover:opacity-95 transition-all flex items-center justify-between gap-2 cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
            <Camera className="w-4 h-4 text-white" strokeWidth={1.5} />
          </div>
          <span className="text-left">
            📸 Escanear producto o captura de tienda
          </span>
        </div>
        <span className="text-[11px] font-semibold bg-white/20 px-2.5 py-1 rounded-full shrink-0">
          IA Vision
        </span>
      </motion.button>

      {/* Expandable Drawer with Upload & 3 Preloaded Store Captures */}
      <AnimatePresence>
        {isPickerOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28 }}
            className="overflow-hidden"
          >
            <div className="rounded-3xl border border-[#DCD5CA] bg-[#FAF8F5] p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ScanLine
                    className="w-4 h-4 text-emerald-700"
                    strokeWidth={1.5}
                  />
                  <span className="text-xs font-bold text-slate-900">
                    QuickSnap Scanner · Elige o sube una captura
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPickerOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </div>

              {/* Laser Scanning Animation Overlay (1.5 seconds) */}
              <AnimatePresence mode="wait">
                {isScanning && scanningPreviewUrl ? (
                  <motion.div
                    key="laser-scanner-active"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="relative rounded-2xl overflow-hidden border-2 border-emerald-500 bg-slate-950 shadow-lg"
                  >
                    {/* Preview Image Being Scanned */}
                    <img
                      src={scanningPreviewUrl}
                      alt="Escaneando captura"
                      className="w-full h-44 object-cover opacity-85"
                    />

                    {/* Animated Youthful Laser Line */}
                    <motion.div
                      initial={{ top: "4%" }}
                      animate={{ top: ["6%", "88%", "6%"] }}
                      transition={{
                        duration: 1.35,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                      className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_18px_4px_rgba(52,211,153,0.85)] z-20"
                    />

                    {/* Scanning Grid Overlay & HUD */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/25 to-slate-950/50 flex flex-col justify-between p-3.5">
                      <div className="flex items-center justify-between">
                        <Badge className="bg-emerald-500 text-slate-950 font-bold text-[10px] px-2.5 py-0.5 border-none">
                          <Sparkles className="w-3 h-3 mr-1" strokeWidth={1.5} />
                          GEMINI VISION SCAN
                        </Badge>
                        <span className="text-[11px] font-mono text-emerald-300">
                          1.5s
                        </span>
                      </div>

                      <div className="space-y-1 text-center">
                        <p className="text-xs sm:text-sm font-bold text-white tracking-tight">
                          Leyendo precio e impacto en tu planta...
                        </p>
                        <p className="text-[11px] font-mono text-emerald-300">
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
                    className="space-y-3"
                  >
                    {/* 3 Preloaded Store Captures */}
                    <span className="text-[11px] font-semibold text-slate-500 block">
                      Capturas de tienda precargadas para prueba instantánea:
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {PRESET_CAPTURES.map((preset) => {
                        const Icon = preset.icon;
                        return (
                          <motion.button
                            key={preset.id}
                            type="button"
                            whileTap={{ scale: 0.96 }}
                            onClick={() => handleSelectPreset(preset)}
                            className={`rounded-2xl border p-2.5 text-left transition-all cursor-pointer bg-gradient-to-br ${preset.badgeColor} hover:shadow-xs flex flex-col justify-between gap-2`}
                          >
                            <div className="w-full h-20 rounded-xl overflow-hidden border border-white/80 bg-white">
                              <img
                                src={preset.svgDataUrl}
                                alt={preset.productName}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div>
                              <div className="flex items-center gap-1 text-[10px] font-bold opacity-75">
                                <Icon className="w-3 h-3" strokeWidth={1.5} />
                                <span>{preset.storeName}</span>
                              </div>
                              <p className="text-xs font-bold text-slate-900 truncate mt-0.5">
                                {preset.productName}
                              </p>
                              <p className="text-xs font-mono font-bold text-emerald-800">
                                ${preset.price.toLocaleString()} MXN
                              </p>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>

                    {/* Upload from Mobile Camera / Computer */}
                    <div className="pt-1">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.96 }}
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-2.5 px-4 rounded-xl border border-dashed border-slate-400 bg-white hover:bg-[#F3EFEA]/60 text-xs font-semibold text-slate-700 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                      >
                        <Upload className="w-3.5 h-3.5 text-slate-600" strokeWidth={1.5} />
                        <span>Subir foto o captura desde mi celular / computadora</span>
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

