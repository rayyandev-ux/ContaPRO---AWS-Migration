"use client";
import { BASE, setFallbackToken } from "@/lib/api";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter, Link } from "@/i18n/routing";
import Image from "next/image";
import { motion } from "framer-motion";
import Beams from "@/components/Beams";
import Squares from "@/components/Squares";
import { ChevronLeft, ArrowRight, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { confirmResetPassword } from 'aws-amplify/auth';

function ResetForm() {
  const router = useRouter();
  const LANDING_URL = `https://${process.env.NEXT_PUBLIC_LANDING_HOST || "contapro.lat"}`;
  const params = useSearchParams();
  const presetEmail = params?.get("email") || "";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setEmailError(null);
    setCodeError(null);
    setPasswordError(null);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));
    const code = String(form.get("code"));
    const password = String(form.get("password"));
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let valid = true;
    if (!emailRe.test(email)) { setEmailError("Ingresa un correo válido"); valid = false; }
    if (!code || code.length !== 6) { setCodeError("Código de 6 dígitos"); valid = false; }
    if (!password || password.length < 6) { setPasswordError("Usa al menos 6 caracteres"); valid = false; }
    if (!valid) { setLoading(false); return; }
    try {
      if (process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID) {
        try {
          await confirmResetPassword({
            username: email,
            confirmationCode: code,
            newPassword: password
          });
          // Si Cognito funcionó, hacemos login y redirigimos
          router.push("/login");
          return;
        } catch (_) {
          // Cognito reset failed — fallback to backend reset
        }
      }

      const res = await fetch(BASE + "/api/auth/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, code, password }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d?.ok !== true) {
        setError(d?.error || "No se pudo restablecer la contraseña");
      } else {
        if (d?.token) setFallbackToken(d.token);
        router.push("/dashboard");
      }
    } catch (_) {
      setError("Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="hero-dark relative min-h-svh w-full overflow-hidden">
      {/* Floating 3D Images */}
      <motion.div
        className="absolute top-[15%] left-[5%] w-24 h-24 md:w-32 md:h-32 cursor-pointer z-0"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 0.8, scale: 1 }}
        whileHover={{ scale: 1.2, rotate: 15 }}
        transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
      >
        <motion.div
          className="w-full h-full"
          animate={{ 
            y: [0, -20, 0], 
            rotate: [0, 10, 0] 
          }}
          transition={{ 
            duration: 6, 
            repeat: Infinity, 
            ease: "easeInOut" 
          }}
        >
          <Image 
            src="/espiral.png" 
            alt="Spiral 3D" 
            width={150} 
            height={150} 
            className="object-contain"
          />
        </motion.div>
      </motion.div>

      <motion.div
        className="absolute bottom-[5%] md:bottom-[10%] right-[5%] w-28 h-28 md:w-40 md:h-40 cursor-pointer z-0"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 0.8, scale: 1 }}
        whileHover={{ scale: 1.2, rotate: -15 }}
        transition={{ duration: 0.8, ease: "easeOut", delay: 0.4 }}
      >
        <motion.div
          className="w-full h-full"
          animate={{ 
            y: [0, 20, 0], 
            rotate: [0, -15, 0] 
          }}
          transition={{ 
            duration: 7, 
            repeat: Infinity, 
            ease: "easeInOut",
            delay: 1
          }}
        >
          <Image 
            src="/anillo.png" 
            alt="Ring 3D" 
            width={180} 
            height={180} 
            className="object-contain"
          />
        </motion.div>
      </motion.div>
      <section className="mx-auto max-w-xl w-full px-6 pt-40 pb-32 grid place-items-center">
        <div className="fixed top-6 left-6 z-10">
          <Link href={LANDING_URL} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-4 w-4" />
            Home
          </Link>
        </div>
        <div className="absolute inset-0 -z-10 w-full h-full">
          <Squares 
            direction="diagonal"
            speed={0.1}
            squareSize={40}
            borderColor="#333" 
            hoverFillColor="#222"
          />
        </div>
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full">
          <div className="flex w-full flex-col items-center text-center gap-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ duration: 0.5 }}
              className="mx-auto flex items-center justify-center cursor-pointer"
            >
              <Image src="/pricing-plan-icon.png" alt="ContaPRO" width={120} height={120} className="object-contain drop-shadow-[0_0_25px_rgba(255,255,255,0.6)]" />
            </motion.div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Restablecer contraseña</h1>
            <p className="text-sm text-muted-foreground">Introduce el código recibido y tu nueva contraseña.</p>
            <div className="w-full max-w-[720px] mx-auto">
              <form className="space-y-4" onSubmit={onSubmit} aria-busy={loading}>
                <div className="space-y-2">
                  <Label htmlFor="email">Correo</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={presetEmail}
                    aria-invalid={!!emailError}
                    onChange={() => setEmailError(null)}
                    placeholder="tu@correo.com"
                    className={`input-hero rounded-full h-12 px-4 ${emailError ? "ring-2 ring-destructive" : ""} focus-visible:border-input focus-visible:ring-input/60 focus-visible:ring-2 focus-visible:outline-none`}
                  />
                  {emailError && <p className="text-xs text-destructive">{emailError}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">Código</Label>
                  <Input
                    id="code"
                    name="code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    title="Ingresa 6 dígitos"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    placeholder="000000"
                    aria-invalid={!!codeError}
                    onChange={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/\D/g, ""); setCodeError(null); }}
                    className={`input-hero rounded-full h-12 px-4 ${codeError ? "ring-2 ring-destructive" : ""} focus-visible:border-input focus-visible:ring-input/60 focus-visible:ring-2 focus-visible:outline-none`}
                  />
                  {codeError && <p className="text-xs text-destructive">{codeError}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Nueva contraseña</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      aria-invalid={!!passwordError}
                      onChange={() => setPasswordError(null)}
                      className={`input-hero rounded-full h-12 pr-10 px-4 ${passwordError ? "ring-2 ring-destructive" : ""} focus-visible:border-input focus-visible:ring-input/60 focus-visible:ring-2 focus-visible:outline-none`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {passwordError && <p className="text-xs text-destructive">{passwordError}</p>}
                </div>
                <Button asChild variant="panel" className="w-full h-12">
                  <motion.button type="submit" disabled={loading} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    {loading ? (
                      <span className="inline-flex items-center gap-2">Guardando... <ArrowRight className="h-4 w-4" /></span>
                    ) : (
                      <span className="inline-flex items-center gap-2">Restablecer <ArrowRight className="h-4 w-4" /></span>
                    )}
                  </motion.button>
                </Button>
                {error && (<p className="text-sm text-destructive" aria-live="polite">{error}</p>)}
              </form>
              <p className="w-full text-center text-xs text-muted-foreground mt-2">¿Ya tienes cuenta? <Link href="/login" className="underline hover:text-foreground">Accede aquí</Link></p>
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Cargando…</div>}>
      <ResetForm />
    </Suspense>
  );
}
