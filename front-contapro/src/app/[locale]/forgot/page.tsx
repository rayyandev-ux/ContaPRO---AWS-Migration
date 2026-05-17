"use client";
import { BASE } from "@/lib/api";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import Image from "next/image";
import { useState } from "react";
import { Mail, Loader2, CheckCircle2, ArrowRight, ChevronLeft } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import Aurora from "@/components/Aurora";
import { cn } from "@/lib/utils";
import { resetPassword } from 'aws-amplify/auth';

export default function ForgotPasswordPage() {
  const t = useTranslations('Forgot');
  const tAuth = useTranslations('Auth');
  const tHeader = useTranslations('SiteHeader');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setSent(false);
    setEmailError(null);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(email)) {
      setEmailError(tAuth('errors.invalidEmail'));
      setLoading(false);
      return;
    }
    try {
      if (process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID) {
        try {
          await resetPassword({ username: email });
        } catch (authError) {
          console.warn("Cognito forgot password error", authError);
        }
      }

      const res = await fetch(BASE + "/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      await res.json();
      setSent(true);
    } catch (err) {
      setSent(true);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="hero-dark relative min-h-svh w-full overflow-hidden flex items-center justify-center p-4">
      <div className="fixed top-6 left-6 z-20">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-4 w-4" />
          {tHeader('home')}
        </Link>
      </div>
      <div className="absolute inset-0 -z-10 w-full h-full">
        <Aurora 
          colorStops={["#5a0a70","#eaeaeb"]} 
          amplitude={0.2} 
          blend={0.7} 
        />
      </div>
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        transition={{ duration: 0.5, ease: "easeOut" }} 
        className="w-full max-w-lg"
      >
        <div className={cn(
          "relative overflow-hidden rounded-[2rem] border transition-all duration-500",
          "backdrop-blur-[12px] shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]",
          "bg-gradient-to-b from-white/10 to-white/5 border-white/20"
        )}>
          {/* Liquid Glass Highlights */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-50" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-30" />

          <div className="p-8 md:p-10">
            <div className="flex flex-col items-center text-center gap-6">
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ duration: 0.5 }}
                className="flex items-center justify-center cursor-pointer"
              >
                <Image src="/pricing-plan-icon.png" alt="ContaPRO" width={100} height={100} className="object-contain drop-shadow-[0_0_25px_rgba(255,255,255,0.6)]" />
              </motion.div>
              
              <div className="space-y-2">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-white/80">{t('title')}</h1>
                <p className="text-sm text-zinc-400">{t('subtitle')}</p>
              </div>

              <div className="w-full space-y-4">
                <form className="space-y-4 text-left" onSubmit={handleSubmit} aria-busy={loading}>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-zinc-300">{tAuth('email')}</Label>
                    <div className="relative">
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        placeholder="tu@correo.com"
                        aria-invalid={!!emailError}
                        onChange={() => setEmailError(null)}
                        className={`input-hero rounded-xl h-11 pl-10 pr-4 bg-black/20 border-white/10 text-white placeholder:text-zinc-600 ${emailError ? "ring-2 ring-destructive" : ""} focus-visible:border-white/30 focus-visible:ring-white/20`}
                      />
                      <Mail className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    </div>
                    {emailError && <p className="text-xs text-destructive">{emailError}</p>}
                  </div>

                  <Button asChild variant="panel" className="w-full h-12 mt-2 bg-gradient-to-r from-zinc-800 to-zinc-950 hover:from-zinc-700 hover:to-zinc-900 text-white border border-white/10 shadow-lg shadow-black/40">
                    <motion.button type="submit" disabled={loading} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      {loading ? (
                        <span className="inline-flex items-center gap-2">
                           <Loader2 className="h-4 w-4 animate-spin" /> 
                           {t('sending')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2 font-medium">{t('submit')} <ArrowRight className="h-4 w-4" /></span>
                      )}
                    </motion.button>
                  </Button>
                  
                  {sent && (
                    <div role="status" aria-live="polite" className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-3 text-emerald-500 text-sm">
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                      <span>{t('successMessage')}</span>
                    </div>
                  )}
                  
                  <div className="mt-4 text-center text-xs text-zinc-500">
                    {t('rememberedPassword')} {" "}
                    <Link href="/login" className="font-medium text-zinc-300 hover:text-white transition-colors underline">
                      {t('loginLink')}
                    </Link>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
