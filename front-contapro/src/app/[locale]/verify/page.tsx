"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter, Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { apiJson } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { motion } from "framer-motion";
import Aurora from "@/components/Aurora";
import { cn } from "@/lib/utils";

function VerifyForm() {
  const t = useTranslations('Verify');
  const tAuth = useTranslations('Auth');
  const tHeader = useTranslations('SiteHeader');
  const router = useRouter();
  const qp = useSearchParams();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    const e = qp.get("email") || "";
    setEmail(e);
  }, [qp]);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    const clean = code.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(tAuth('errors.invalidEmail'));
      setLoading(false);
      return;
    }
    if (!/^\d{6}$/.test(clean)) {
      setError(t('errors.invalidCodeFormat'));
      setLoading(false);
      return;
    }

    try {
      const { ok, error } = await apiJson("/api/auth/verify", {
        method: "POST",
        body: JSON.stringify({ email, code: clean }),
      });
      if (!ok) {
        setError(error || t('errors.invalidCode'));
      } else {
        router.push("/pricing");
      }
    } catch (e) {
      setError(t('errors.invalidCode'));
    }
    setLoading(false);
  };

  const resend = async () => {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const { ok, error } = await apiJson("/api/auth/resend", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      if (!ok) {
        setError(error || t('errors.resendFailed'));
      } else {
        setInfo(t('info.resendSuccess'));
      }
    } catch (e) {
      setError(t('errors.resendFailed'));
    }
    setLoading(false);
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
                <form className="space-y-4 text-left" onSubmit={onSubmit} aria-busy={loading}>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-zinc-300">{tAuth('email')}</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      placeholder="tu@correo.com"
                      className="input-hero rounded-xl h-11 px-4 bg-black/20 border-white/10 text-white placeholder:text-zinc-600 focus-visible:border-white/30 focus-visible:ring-white/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="code" className="text-zinc-300">{t('codeLabel')}</Label>
                    <Input
                      id="code"
                      name="code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      title={t('codeTitle')}
                      pattern="[0-9]{6}"
                      maxLength={6}
                      placeholder="123456"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                      className="input-hero rounded-xl h-11 px-4 bg-black/20 border-white/10 text-white placeholder:text-zinc-600 focus-visible:border-white/30 focus-visible:ring-white/20"
                    />
                  </div>
                  <Button asChild variant="panel" className="w-full h-12 mt-2 bg-gradient-to-r from-zinc-800 to-zinc-950 hover:from-zinc-700 hover:to-zinc-900 text-white border border-white/10 shadow-lg shadow-black/40">
                    <motion.button type="submit" disabled={loading} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      {loading ? (
                        <span className="inline-flex items-center gap-2">
                           <span className="h-4 w-4 border-2 border-zinc-400 border-t-white rounded-full animate-spin" />
                           {t('verifying')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2 font-medium">{t('verify')} <ArrowRight className="h-4 w-4" /></span>
                      )}
                    </motion.button>
                  </Button>
                  
                  {error && (
                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center">
                      {error}
                    </div>
                  )}
                  {info && (
                     <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-sm text-center">
                       {info}
                     </div>
                  )}
                </form>
                
                <div className="w-full flex items-center justify-between mt-4">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={resend} 
                    disabled={loading}
                    className="text-zinc-400 hover:text-white hover:bg-white/5"
                  >
                    {t('resendCode')}
                  </Button>
                  <p className="text-xs text-zinc-500">{t('spamNotice')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function Page() {
  const t = useTranslations('Verify');
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">{t('loading')}</div>}>
      <VerifyForm />
    </Suspense>
  );
}
