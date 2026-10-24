"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Compass,
  ArrowRight,
  Clock,
  SlidersHorizontal,
  SearchCheck,
  CalendarCheck2,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.55,
      delay,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  }),
};

const steps = [
  {
    number: "01",
    badge: "60 segundos",
    title: "Conecta o estima tu contexto en 60 segundos",
    description:
      "Sin formularios eternos ni hojas de cálculo. Indica tu saldo actual, cuándo vuelves a cobrar y tus pagos fijos próximos para conocer tu liquidez real.",
    detail: "Saldo disponible − compromisos fijos − reserva vital",
    icon: SlidersHorizontal,
  },
  {
    number: "02",
    badge: "Antes de pagar",
    title: "Consulta cualquier compra antes de pagar",
    description:
      "Escribe lo que quieres comprar o su precio en un segundo. Evaluamos al instante si el gasto es viable hoy o si compromete el dinero de tu semana.",
    detail: "Veredicto claro en tiempo real, sin tecnicismos",
    icon: SearchCheck,
  },
  {
    number: "03",
    badge: "Plan claro",
    title: "Descubre cuándo y cómo comprar sin afectar tus metas",
    description:
      "Si hoy no es el mejor momento, te mostramos alternativas reales: esperar a tu próxima nómina o apartar un micro-ahorro semanal sin estrés.",
    detail: "Compara escenarios antes de pasar la tarjeta",
    icon: CalendarCheck2,
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#FAF8F5] text-slate-900 flex flex-col font-sans">
      {/* Minimalist Navbar */}
      <header className="sticky top-0 z-30 border-b border-[#E6E1DA]/80 bg-[#FAF8F5]/85 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2.5 group focus:outline-none"
          >
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-[#FAF8F5] flex items-center justify-center shadow-xs group-hover:bg-slate-800 transition-colors">
              <Compass className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-semibold tracking-tight text-slate-900 leading-none">
                AntesDeGastar
              </span>
              <span className="text-[11px] text-slate-500 tracking-tight mt-0.5">
                claridad financiera pre-compra
              </span>
            </div>
          </Link>

          <nav className="flex items-center gap-5 sm:gap-7">
            <a
              href="#como-funciona"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Cómo funciona
            </a>
            <Button
              nativeButton={false}
              render={<Link href="/auth" />}
              variant="outline"
              className="h-9 px-4 rounded-xl border-slate-300/90 bg-white/80 text-slate-900 hover:bg-slate-900 hover:text-[#FAF8F5] transition-colors text-sm font-medium shadow-2xs"
            >
              Iniciar sesión
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Clean Editorial Hero Section */}
        <section className="relative overflow-hidden pt-16 pb-20 sm:pt-24 sm:pb-28">
          {/* Subtle Warm Editorial Background Accents */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 flex justify-center overflow-hidden"
          >
            <div className="h-[420px] w-[820px] rounded-full bg-gradient-to-b from-[#EDE6DA]/70 via-[#F3EFEA]/40 to-transparent blur-3xl" />
          </div>

          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
            <motion.div
              initial="hidden"
              animate="visible"
              custom={0}
              variants={fadeUp}
              className="inline-flex items-center gap-2 rounded-full border border-[#E2DCD3] bg-white/80 px-3.5 py-1.5 text-xs font-medium text-slate-700 shadow-2xs mb-8"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-700" strokeWidth={1.5} />
              <span>Copiloto de liquidez y decisiones cotidianas</span>
            </motion.div>

            <motion.h1
              initial="hidden"
              animate="visible"
              custom={0.08}
              variants={fadeUp}
              className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-slate-900 leading-[1.08] text-balance"
            >
              Toma mejores decisiones con tu dinero antes de gastar, no después
            </motion.h1>

            <motion.p
              initial="hidden"
              animate="visible"
              custom={0.16}
              variants={fadeUp}
              className="mt-6 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed text-balance font-normal"
            >
              Los bancos te avisan cuando el dinero ya salió. Nosotros traducimos tu saldo en
              liquidez real para que sepas al instante si una compra cabe hoy en tu vida o cómo
              planearla en paz.
            </motion.p>

            <motion.div
              initial="hidden"
              animate="visible"
              custom={0.24}
              variants={fadeUp}
              className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3.5"
            >
              <Button
                nativeButton={false}
                render={<Link href="/auth" />}
                size="lg"
                className="h-12 px-7 rounded-xl bg-slate-900 text-[#FAF8F5] hover:bg-slate-800 text-base font-medium shadow-sm transition-all gap-2.5 w-full sm:w-auto"
              >
                Evaluar mi primera compra
                <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
              </Button>
              <a
                href="#como-funciona"
                className="inline-flex items-center justify-center h-12 px-6 rounded-xl text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-[#EFECE6]/70 transition-colors w-full sm:w-auto"
              >
                Ver cómo funciona en 3 pasos
              </a>
            </motion.div>

            {/* Editorial Preview Pill / Micro Decision Strip */}
            <motion.div
              initial="hidden"
              animate="visible"
              custom={0.34}
              variants={fadeUp}
              className="mt-14 max-w-2xl mx-auto rounded-2xl border border-[#E4DEC6]/90 bg-white/90 p-4 sm:p-5 shadow-xs text-left"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-5 h-5" strokeWidth={1.5} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                        Ejemplo de consulta
                      </span>
                      <span className="text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full">
                        Compra viable hoy
                      </span>
                    </div>
                    <p className="text-sm sm:text-base font-medium text-slate-900 mt-1">
                      “¿Me conviene comprar unos audífonos de $2,300 MXN hoy?”
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Apartando tu renta y gastos de los próximos 6 días, aún conservas $1,400 MXN de margen libre.
                    </p>
                  </div>
                </div>
                <div className="sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 border-[#EFECE6] shrink-0">
                  <span className="text-[11px] uppercase tracking-wider text-slate-400 block">
                    Disponible real
                  </span>
                  <span className="text-lg font-semibold text-slate-900 font-mono">
                    $3,700 MXN
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Visual Section of 3 Clean Cards Explaining the Flow */}
        <section
          id="como-funciona"
          className="py-16 sm:py-24 border-t border-[#E6E1DA]/80 bg-[#F6F3EE]/60"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5 }}
              className="max-w-2xl mb-12 sm:mb-16"
            >
              <Badge
                variant="outline"
                className="mb-3 border-[#DCD5CA] bg-[#FAF8F5] text-slate-700 px-3 py-1 text-xs font-medium"
              >
                Cómo funciona
              </Badge>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight text-slate-900 text-balance">
                Un flujo pensado para personas reales, no para contadores
              </h2>
              <p className="mt-3 text-base text-slate-600 leading-relaxed">
                Tres pasos simples para transformar la incertidumbre de cada compra en una decisión
                informada y tranquila.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {steps.map((step, index) => {
                const IconComponent = step.icon;
                return (
                  <motion.div
                    key={step.number}
                    initial={{ opacity: 0, y: 22 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{
                      duration: 0.5,
                      delay: index * 0.1,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  >
                    <Card className="h-full bg-white border-[#E6E1DA] hover:border-slate-300 transition-all duration-300 shadow-2xs hover:shadow-md flex flex-col justify-between">
                      <div>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between mb-4">
                            <div className="w-11 h-11 rounded-xl bg-[#FAF8F5] border border-[#E6E1DA] text-slate-900 flex items-center justify-center">
                              <IconComponent className="w-5 h-5" strokeWidth={1.5} />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-slate-600 bg-[#F3EFEA] px-2.5 py-1 rounded-full">
                                {step.badge}
                              </span>
                              <span className="text-sm font-mono font-semibold text-slate-400">
                                {step.number}
                              </span>
                            </div>
                          </div>
                          <CardTitle className="text-xl font-semibold text-slate-900 leading-snug">
                            {step.title}
                          </CardTitle>
                        </CardHeader>

                        <CardContent className="pt-2">
                          <CardDescription className="text-slate-600 text-sm sm:text-base leading-relaxed">
                            {step.description}
                          </CardDescription>
                        </CardContent>
                      </div>

                      <CardContent className="pt-4 mt-2">
                        <div className="rounded-xl bg-[#FAF8F5] border border-[#ECE7DF] px-3.5 py-2.5 flex items-center gap-2 text-xs font-medium text-slate-700">
                          <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" strokeWidth={1.5} />
                          <span>{step.detail}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>

            {/* Bottom Subtle Callout */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mt-14 rounded-2xl border border-[#E6E1DA] bg-white p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-2xs"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" strokeWidth={1.5} />
                  <span>Sin conectar credenciales bancarias sensibles</span>
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-slate-900">
                  ¿Tienes una compra en mente ahora mismo?
                </h3>
                <p className="text-sm text-slate-600">
                  Ponla a prueba en menos de un minuto y descubre tu verdadero margen disponible.
                </p>
              </div>
              <Button
                nativeButton={false}
                render={<Link href="/auth" />}
                size="lg"
                className="h-11 px-6 rounded-xl bg-slate-900 text-[#FAF8F5] hover:bg-slate-800 text-sm font-medium shrink-0 gap-2"
              >
                Evaluar mi primera compra
                <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
              </Button>
            </motion.div>
          </div>
        </section>
      </main>

      {/* Minimal Editorial Footer */}
      <footer className="border-t border-[#E6E1DA] bg-[#FAF8F5] py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-slate-700" strokeWidth={1.5} />
            <span className="font-medium text-slate-800">AntesDeGastar</span>
            <span>· Copiloto financiero pre-compra</span>
          </div>
          <p>Diseñado para dar claridad antes de pagar, no culpa después.</p>
        </div>
      </footer>
    </div>
  );
}
