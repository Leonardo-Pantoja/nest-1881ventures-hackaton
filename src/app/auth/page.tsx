"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Compass,
  Mail,
  Lock,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Database,
  UserPlus,
  ShieldCheck,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
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
import { useFinancial } from "@/context/FinancialContext";
import { createClient } from "@/lib/supabase/client";

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      delay,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  }),
};

export default function AuthPage() {
  const router = useRouter();
  const { loadPreloadedSandboxProfile, startFreshOnboarding, refreshProfile } =
    useFinancial();

  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password.trim()) return;

    setIsSubmitting(true);
    setStatusMessage(null);

    const supabase = createClient();
    // Leave demo mode before authenticating with a real account.
    sessionStorage.removeItem("antesdegastar_demo_profile_v2");

    try {
      if (authMode === "signup") {
        // Create a new Supabase Auth user
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
        });

        if (error) throw error;

        // Email confirmation may be required
        if (!data.session) {
          setStatusMessage(
            "Revisa tu correo para confirmar tu cuenta antes de iniciar sesión.",
          );
          return;
        }

        startFreshOnboarding(cleanEmail);
        router.replace("/onboarding");
        return;
      }

      // Sign in with an existing account
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (signInError) throw signInError;

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("No se pudo verificar la sesión.");
      }

      // Check whether onboarding is completed
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("onboarding_completed_at")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (profile?.onboarding_completed_at) {
        await refreshProfile();
        router.replace("/app");
      } else {
        startFreshOnboarding(cleanEmail);
        router.replace("/onboarding");
      }

      router.refresh();
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Ocurrió un error al autenticar.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartFromScratch = () => {
    startFreshOnboarding(email.trim() || undefined, true);
    router.push("/onboarding?demo=1");
  };

  const handleLoadPreloadedProfile = () => {
    loadPreloadedSandboxProfile("carlos");
    router.push("/app");
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-slate-900 flex flex-col justify-between font-sans relative overflow-hidden">
      {/* Subtle Editorial Warm Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 flex justify-center overflow-hidden"
      >
        <div className="h-[380px] w-[760px] rounded-full bg-gradient-to-b from-[#EDE6DA]/70 via-[#F3EFEA]/40 to-transparent blur-3xl" />
      </div>

      {/* Top Minimal Header */}
      <header className="w-full max-w-5xl mx-auto px-4 sm:px-6 pt-6 pb-2 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors group"
        >
          <ArrowLeft
            className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-0.5"
            strokeWidth={1.5}
          />
          <span>Volver al inicio</span>
        </Link>

        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-xl bg-slate-900 text-[#FAF8F5] flex items-center justify-center shadow-2xs group-hover:bg-slate-800 transition-colors">
            <Compass className="w-4 h-4" strokeWidth={1.5} />
          </div>
          <span className="text-sm font-semibold tracking-tight text-slate-900">
            AntesDeGastar
          </span>
        </Link>
      </header>

      {/* Main Centered Auth Content */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-8">
        <div className="w-full max-w-md space-y-6">
          {/* Title & Editorial Subtitle */}
          <motion.div
            initial="hidden"
            animate="visible"
            custom={0}
            variants={fadeUp}
            className="text-center space-y-2"
          >
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
              {authMode === "signin"
                ? "Bienvenido de nuevo"
                : "Crea tu cuenta en segundos"}
            </h1>
            <p className="text-sm text-slate-600">
              Solo lo esencial para evaluar tus compras con claridad. Sin
              formularios invasivos.
            </p>
          </motion.div>

          {/* Highlighted Card: Inicio Rápido para Demo (Plaid Sandbox) */}
          <motion.div
            initial="hidden"
            animate="visible"
            custom={0.08}
            variants={fadeUp}
          >
            <Card className="bg-white border-[#DFD8CE] shadow-sm relative overflow-hidden py-5 gap-4">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-slate-900 via-emerald-700 to-slate-900" />

              <CardHeader className="px-5 pb-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <Badge
                    variant="outline"
                    className="border-emerald-300/80 bg-emerald-50/90 text-emerald-900 text-[11px] font-medium px-2.5 py-0.5"
                  >
                    <Sparkles
                      className="w-3 h-3 text-emerald-700"
                      strokeWidth={1.5}
                    />
                    Plaid Sandbox Ready
                  </Badge>
                  <span className="text-[11px] font-mono text-slate-400">
                    1-click acceso
                  </span>
                </div>
                <CardTitle className="text-base font-semibold text-slate-900">
                  Inicio Rápido para Demo (Plaid Sandbox)
                </CardTitle>
                <CardDescription className="text-xs text-slate-600">
                  Elige cómo quieres recorrer la experiencia sin configurar
                  credenciales reales:
                </CardDescription>
              </CardHeader>

              <CardContent className="px-5 space-y-2.5">
                {/* Option 1: Onboarding from scratch */}
                <motion.button
                  type="button"
                  whileHover={{ y: -1.5, scale: 1.005 }}
                  whileTap={{ scale: 0.995 }}
                  onClick={handleStartFromScratch}
                  className="w-full text-left rounded-xl border border-[#E6E1DA] bg-[#FAF8F5] hover:bg-[#F3EFEA]/80 hover:border-slate-400/80 p-3.5 transition-all group flex items-start justify-between gap-3 cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-white border border-[#E6E1DA] text-slate-800 flex items-center justify-center shrink-0 mt-0.5 group-hover:border-slate-400 transition-colors">
                      <UserPlus className="w-4 h-4" strokeWidth={1.5} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 group-hover:text-slate-950">
                        Comenzar Onboarding desde cero (Nuevo Usuario)
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                        Configura o estima tu contexto financiero en 60 segundos
                        paso a paso.
                      </p>
                    </div>
                  </div>
                  <ArrowRight
                    className="w-4 h-4 text-slate-400 group-hover:text-slate-900 group-hover:translate-x-0.5 transition-all shrink-0 mt-1"
                    strokeWidth={1.5}
                  />
                </motion.button>

                {/* Option 2: Preloaded profile with simulated bank data -> /app */}
                <motion.button
                  type="button"
                  whileHover={{ y: -1.5, scale: 1.005 }}
                  whileTap={{ scale: 0.995 }}
                  onClick={handleLoadPreloadedProfile}
                  className="w-full text-left rounded-xl border border-slate-900 bg-slate-900 text-[#FAF8F5] hover:bg-slate-800 p-3.5 transition-all group flex items-start justify-between gap-3 shadow-xs cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-white/10 border border-white/15 text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                      <Database className="w-4 h-4" strokeWidth={1.5} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        Cargar perfil precargado con datos bancarios simulados
                      </p>
                      <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                        Salta directo a{" "}
                        <span className="font-mono text-emerald-300">/app</span>{" "}
                        con saldo, nómina y compromisos vía Plaid Sandbox.
                      </p>
                    </div>
                  </div>
                  <ArrowRight
                    className="w-4 h-4 text-slate-300 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0 mt-1"
                    strokeWidth={1.5}
                  />
                </motion.button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Divider */}
          <motion.div
            initial="hidden"
            animate="visible"
            custom={0.16}
            variants={fadeUp}
            className="relative flex items-center py-1"
          >
            <div className="flex-grow border-t border-[#E6E1DA]" />
            <span className="shrink-0 px-3 text-xs uppercase tracking-wider text-slate-400 font-medium">
              o ingresa con tu correo
            </span>
            <div className="flex-grow border-t border-[#E6E1DA]" />
          </motion.div>

          {/* Email & Password Card (Prepared for Supabase Auth) */}
          <motion.div
            initial="hidden"
            animate="visible"
            custom={0.22}
            variants={fadeUp}
          >
            <Card className="bg-white border-[#E6E1DA] shadow-2xs py-6 gap-5">
              <CardContent className="px-6">
                {/* Mode Switcher */}
                <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#FAF8F5] border border-[#E6E1DA] mb-5">
                  <button
                    type="button"
                    onClick={() => setAuthMode("signin")}
                    className={`py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                      authMode === "signin"
                        ? "bg-white text-slate-900 shadow-2xs border border-[#E6E1DA]/80"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    Iniciar sesión
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode("signup")}
                    className={`py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                      authMode === "signup"
                        ? "bg-white text-slate-900 shadow-2xs border border-[#E6E1DA]/80"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    Crear cuenta
                  </button>
                </div>

                <form onSubmit={handleEmailAuth} className="space-y-4">
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-xs font-medium text-slate-700 mb-1.5"
                    >
                      Correo electrónico
                    </label>
                    <div className="relative group">
                      <Mail
                        className="w-4 h-4 text-slate-400 group-focus-within:text-slate-800 transition-colors absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                        strokeWidth={1.5}
                      />
                      <input
                        id="email"
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="tu@correo.com"
                        className="w-full h-10 pl-10 pr-3.5 rounded-xl border border-[#E6E1DA] bg-[#FAF8F5]/60 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-900 focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label
                        htmlFor="password"
                        className="block text-xs font-medium text-slate-700"
                      >
                        Contraseña
                      </label>
                      {authMode === "signin" && (
                        <span className="text-[11px] text-slate-500">
                          Supabase Auth
                        </span>
                      )}
                    </div>
                    <div className="relative group">
                      <Lock
                        className="w-4 h-4 text-slate-400 group-focus-within:text-slate-800 transition-colors absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                        strokeWidth={1.5}
                      />
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={6}
                        autoComplete={
                          authMode === "signin"
                            ? "current-password"
                            : "new-password"
                        }
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full h-10 pl-10 pr-10 rounded-xl border border-[#E6E1DA] bg-[#FAF8F5]/60 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-900 focus:outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors p-0.5 cursor-pointer"
                        aria-label="Mostrar u ocultar contraseña"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" strokeWidth={1.5} />
                        ) : (
                          <Eye className="w-4 h-4" strokeWidth={1.5} />
                        )}
                      </button>
                    </div>
                  </div>

                  {statusMessage && (
                    <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-800 flex items-center gap-2">
                      <CheckCircle2
                        className="w-4 h-4 shrink-0"
                        strokeWidth={1.5}
                      />
                      <span>{statusMessage}</span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-10 rounded-xl bg-slate-900 text-[#FAF8F5] hover:bg-slate-800 text-sm font-medium transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2
                          className="w-4 h-4 animate-spin"
                          strokeWidth={1.5}
                        />
                        <span>Conectando con Supabase Auth...</span>
                      </>
                    ) : (
                      <>
                        <span>
                          {authMode === "signin"
                            ? "Continuar con correo"
                            : "Crear cuenta y configurar"}
                        </span>
                        <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                      </>
                    )}
                  </Button>
                </form>

                <div className="mt-4 pt-3 border-t border-[#F3EFEA] flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
                  <ShieldCheck
                    className="w-3.5 h-3.5 text-emerald-700"
                    strokeWidth={1.5}
                  />
                  <span>
                    Sin campos de género, edad ni datos personales innecesarios.
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>

      {/* Footer Note */}
      <footer className="py-5 text-center text-xs text-slate-400">
        Protegido con sesiones cifradas · Preparado para Supabase Auth &amp;
        Plaid Sandbox
      </footer>
    </div>
  );
}
