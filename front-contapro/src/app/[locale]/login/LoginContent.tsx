"use client";
import { useState } from "react";
import { useRouter } from "@/i18n/routing";
import { Link } from "@/i18n/routing";
import Image from "next/image";
import { apiJson, setFallbackToken, BASE } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Eye, EyeOff, ChevronLeft } from "lucide-react";
import { motion } from "framer-motion";
import Aurora from "@/components/Aurora";
import { useTranslations } from 'next-intl';
import { cn } from "@/lib/utils";
import { signIn } from 'aws-amplify/auth';


export default function LoginContent() {
  const t = useTranslations('Auth');
  const tHeader = useTranslations('SiteHeader');
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setEmailError(null);
    setPasswordError(null);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let valid = true;
    if (!emailRe.test(email)) {
      setEmailError(t('validEmail'));
      valid = false;
    }
    if (!password || password.length < 6) {
      setPasswordError(t('passwordLength'));
      valid = false;
    }
    if (!valid) {
      setLoading(false);
      return;
    }
    try {
      // 1. Intentar iniciar sesión con AWS Cognito (Amplify)
      if (process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID) {
        try {
          const { signOut } = await import('aws-amplify/auth');
          try { await signOut(); } catch (_) { /* clear previous session */ }
          const { isSignedIn } = await signIn({
            username: email,
            password,
          });
          if (isSignedIn) {
            router.push('/dashboard');
            return;
          }
        } catch (_) {
          // Cognito signIn failed — fallback to backend login
        }
      }

      // 2. Fallback a nuestro propio backend (Legacy / Migración on-the-fly)
      const { ok, error, data } = await apiJson("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password, remember: !!form.get("remember") }),
      });
      if (!ok) {
        setError(error || t('loginError'));
      } else {
        if (data?.token) setFallbackToken(data.token);
        try { window.postMessage({ t: 'contapro:mutated' }, window.location.origin); } catch (_) { /* notify other frames */ }
        router.push('/dashboard');
      }
    } catch (err) {
      setError(t('unexpectedError'));
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
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-white/80">{t('loginTitle')}</h1>
                <p className="text-sm text-zinc-400">{t('noAccount')} <Link href="/register" className="underline hover:text-white transition-colors">{t('createAccount')}</Link></p>
              </div>

              <div className="w-full space-y-4">
                <a href={`${BASE}/api/auth/google`} className="block">
                  <Button variant="panel" className="w-full h-11 bg-white/5 hover:bg-white/10 border-white/10 hover:border-white/20 transition-all">
                    <span className="inline-flex items-center gap-2">
                      <span className="size-5 rounded-full bg-white/10 inline-flex items-center justify-center text-xs font-bold">G</span>
                      {t('continueWithGoogle')}
                    </span>
                  </Button>
                </a>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-white/10" /></div>
                  <div className="relative flex justify-center text-xs"><span className="bg-transparent px-2 text-zinc-500">{t('or')}</span></div>
                </div>

                <form className="space-y-4 text-left" onSubmit={onSubmit} aria-busy={loading}>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-zinc-300">{t('email')}</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="tu@correo.com"
                      aria-invalid={!!emailError}
                      onChange={() => setEmailError(null)}
                      className={`input-hero rounded-xl h-11 px-4 bg-black/20 border-white/10 text-white placeholder:text-zinc-600 ${emailError ? "ring-2 ring-destructive" : ""} focus-visible:border-white/30 focus-visible:ring-white/20`}
                    />
                    {emailError && <p className="text-xs text-destructive">{emailError}</p>}
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-zinc-300">{t('password')}</Label>
                      <Link href="/forgot" className="text-xs text-zinc-400 hover:text-white transition-colors">{t('forgotPassword')}</Link>
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        aria-invalid={!!passwordError}
                        onChange={() => setPasswordError(null)}
                        className={`input-hero rounded-xl h-11 pr-10 px-4 bg-black/20 border-white/10 text-white placeholder:text-zinc-600 ${passwordError ? "ring-2 ring-destructive" : ""} focus-visible:border-white/30 focus-visible:ring-white/20`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-zinc-500 hover:text-white transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {passwordError && <p className="text-xs text-destructive">{passwordError}</p>}
                    
                    <div className="flex items-center justify-between pt-1">
                      <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer group">
                        <input type="checkbox" name="remember" className="h-4 w-4 rounded border-zinc-700 bg-black/20 checkbox-gray group-hover:border-zinc-500 transition-colors" />
                        <span className="group-hover:text-zinc-300 transition-colors">{t('rememberMe')}</span>
                      </label>
                    </div>
                  </div>

                  <Button asChild variant="panel" className="w-full h-12 mt-2 bg-gradient-to-r from-zinc-800 to-zinc-950 hover:from-zinc-700 hover:to-zinc-900 text-white border border-white/10 shadow-lg shadow-black/40">
                    <motion.button type="submit" disabled={loading} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      {loading ? (
                        <span className="flex items-center gap-2">
                           <span className="h-4 w-4 border-2 border-zinc-400 border-t-white rounded-full animate-spin" />
                           {t('loggingIn')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2 font-medium">{t('login')} <ArrowRight className="h-4 w-4" /></span>
                      )}
                    </motion.button>
                  </Button>
                  
                  {error && (
                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center">
                      {error}
                    </div>
                  )}
                </form>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}