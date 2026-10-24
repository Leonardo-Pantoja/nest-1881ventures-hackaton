"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Wallet,
  SearchCheck,
  SlidersHorizontal,
  ArrowRight,
  ArrowLeft,
  X,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface QuickGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GUIDE_SLIDES = [
  {
    step: "01",
    badge: "Tu número protagonista",
    title: "Conoce tu liquidez real, no solo tu saldo bancario",
    description:
      "El monto principal en pantalla ya descuenta tus pagos fijos próximos, tus gastos básicos de la semana y tu reserva de tranquilidad.",
    tip: "Haz clic en “¿Por qué este monto?” cuando quieras desplegar la resta paso a paso.",
    icon: Wallet,
  },
  {
    step: "02",
    badge: "Copiloto Pre-Compra",
    title: "Consulta cualquier artículo antes de pasar la tarjeta",
    description:
      "Escribe qué piensas comprar (ej. “Audífonos de $2,300”), toca un ejemplo rápido o sube una captura de pantalla y presiona “Analizar compra”.",
    tip: "Recibirás un veredicto empático al instante sin tecnicismos financieros.",
    icon: SearchCheck,
  },
  {
    step: "03",
    badge: "3 caminos claros",
    title: "Compara cuándo y cómo comprar sin afectar tus metas",
    description:
      "Simula en vivo qué pasa si compras hoy, si esperas a tu próxima nómina o si usas el slider de micro-ahorro semanal.",
    tip: "También puedes registrar gastos rápidos abajo como “Gasté 150 en comida”.",
    icon: SlidersHorizontal,
  },
];

export default function QuickGuideModal({
  isOpen,
  onClose,
}: QuickGuideModalProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const handleClose = () => {
    setCurrentSlide(0);
    onClose();
  };

  const handleNext = () => {
    if (currentSlide < GUIDE_SLIDES.length - 1) {
      setCurrentSlide((prev) => prev + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide((prev) => prev - 1);
    }
  };

  const slide = GUIDE_SLIDES[currentSlide];
  const SlideIcon = slide.icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="quick-guide-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-[#FAF8F5] border border-[#DCD5CA] shadow-xl overflow-hidden"
          >
            {/* Top Header */}
            <div className="bg-white border-b border-[#E6E1DA] px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles
                  className="w-4 h-4 text-emerald-700"
                  strokeWidth={1.5}
                />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Bienvenida · Guía rápida ({currentSlide + 1}/{GUIDE_SLIDES.length})
                </span>
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-[#FAF8F5] transition-colors cursor-pointer"
                aria-label="Cerrar guía rápida"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            {/* Slide Body */}
            <div className="p-6 sm:p-7 space-y-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={slide.step}
                  initial={{ opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -18 }}
                  transition={{ duration: 0.24 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-2xl bg-slate-900 text-[#FAF8F5] flex items-center justify-center shadow-xs">
                      <SlideIcon className="w-6 h-6" strokeWidth={1.5} />
                    </div>
                    <Badge
                      variant="outline"
                      className="border-[#DCD5CA] bg-white text-slate-700 text-xs font-medium px-3 py-1"
                    >
                      {slide.badge}
                    </Badge>
                  </div>

                  <div className="space-y-2 pt-1">
                    <h3 className="text-xl font-semibold tracking-tight text-slate-900 leading-snug">
                      {slide.title}
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {slide.description}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white border border-[#E6E1DA] p-3.5 flex items-start gap-2.5 text-xs text-slate-700">
                    <CheckCircle2
                      className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5"
                      strokeWidth={1.5}
                    />
                    <span>{slide.tip}</span>
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Progress Dots & Navigation Buttons */}
              <div className="pt-2 border-t border-[#E6E1DA] flex items-center justify-between gap-3">
                {/* Dots */}
                <div className="flex items-center gap-1.5">
                  {GUIDE_SLIDES.map((s, idx) => (
                    <button
                      key={s.step}
                      type="button"
                      onClick={() => setCurrentSlide(idx)}
                      aria-label={`Ir al slide ${idx + 1}`}
                      className={`h-2 rounded-full transition-all cursor-pointer ${
                        idx === currentSlide
                          ? "w-6 bg-slate-900"
                          : "w-2 bg-[#D5CEC2] hover:bg-slate-400"
                      }`}
                    />
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  {currentSlide > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handlePrev}
                      className="h-9 px-3 rounded-xl border-[#DCD5CA] bg-white text-slate-700 text-xs cursor-pointer gap-1"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
                      Anterior
                    </Button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleClose}
                      className="text-xs font-medium text-slate-500 hover:text-slate-800 px-2 py-1 cursor-pointer"
                    >
                      Omitir
                    </button>
                  )}

                  <Button
                    type="button"
                    size="sm"
                    onClick={handleNext}
                    className="h-9 px-4 rounded-xl bg-slate-900 text-[#FAF8F5] hover:bg-slate-800 text-xs font-medium gap-1.5 cursor-pointer"
                  >
                    <span>
                      {currentSlide === GUIDE_SLIDES.length - 1
                        ? "Empezar a evaluar"
                        : "Siguiente"}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

