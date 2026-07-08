"use client";
import { useState } from "react";
import { useRouter, Link } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { apiJson, setFallbackToken } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Eye, EyeOff, ChevronLeft, CheckCircle2, Sparkles, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Aurora from "@/components/Aurora";
import { useTranslations, useLocale } from "next-intl";
import { cn } from "@/lib/utils";
import { signUp } from 'aws-amplify/auth';

export default function RegisterContent() {
  const t = useTranslations('Auth');
  const tHeader = useTranslations('SiteHeader');
  const tRegister = useTranslations('Register');
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get('plan');
  
  // Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [showPromo, setShowPromo] = useState(false);
  const [promoStatus, setPromoStatus] = useState<{type: 'success' | 'error', msg: string} | null>(null);
  
  // UI State
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  
  // Validation Errors
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const validateStep1 = () => {
    if (!name.trim()) {
      setNameError(t('errors.requiredName'));
      return false;
    }
    setNameError(null);
    return true;
  };

  const validateStep2 = () => {
    if (!emailRe.test(email)) {
      setEmailError(t('errors.invalidEmail'));
      return false;
    }
    setEmailError(null);
    return true;
  };

  const validateStep3 = () => {
    let valid = true;
    if (!password || password.length < 8) {
      setPasswordError(t('errors.passwordLength'));
      valid = false;
    } else {
      setPasswordError(null);
    }
    
    if (password !== confirm) {
      setConfirmError(t('passwordsDoNotMatch'));
      valid = false;
    } else {
      setConfirmError(null);
    }
    return valid;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) setStep(2);
    if (step === 2 && validateStep2()) setStep(3);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleRegister = async () => {
    if (!validateStep3()) return;

    setLoading(true);
    setError(null);
    try {
      if (process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID) {
        try {
          await signUp({
            username: email,
            password,
            options: {
              userAttributes: {
                email,
                name,
              }
            }
          });
        } catch (_) {
          // Cognito signup failed — fallback to backend-only registration
        }
      }

      const { ok, error: apiError } = await apiJson("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, name, language: "es" }),
      });

      if (!ok) {
        setError(apiError || t('createAccountError'));
        setLoading(false);
      } else {
        // Success! Move to Verification Step
        setLoading(false);
        setStep(4);
      }
    } catch (err) {
      setError(t('errors.unexpected'));
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!code || code.length !== 6) {
        setCodeError(tRegister('step4.invalidCodeLength'));
        return;
    }
    setCodeError(null);
    setLoading(true);
    setError(null);

    try {
        if (process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID) {
            const { confirmSignUp, signIn } = await import('aws-amplify/auth');
            try {
                await confirmSignUp({ username: email, confirmationCode: code });
            } catch (authErr: unknown) {
                const err = authErr as { name?: string; message?: string };
                const isAlreadyConfirmed = err?.name === 'NotAuthorizedException'
                    || err?.message?.includes('CONFIRMED');
                if (!isAlreadyConfirmed) {
                    setError(err?.message || tRegister('step4.invalidCode'));
                    setLoading(false);
                    return;
                }
            }
            try {
                const { signOut } = await import('aws-amplify/auth');
                try { await signOut(); } catch (_) { /* clear previous session */ }
                await signIn({ username: email, password });
            } catch (_) {
                // signIn failed — backend verify will provide fallback token
            }
        }

        const { ok, error: apiError, data } = await apiJson("/api/auth/verify", {
            method: "POST",
            body: JSON.stringify({ email, code }),
        });

        if (!ok) {
            setError(apiError || tRegister('step4.invalidCode'));
            setLoading(false);
        } else {
            if (data?.token) setFallbackToken(data.token);
            setLoading(false);
            setStep(5);
            setTimeout(() => {
                router.push('/onboarding');
            }, 2000);
        }
    } catch (err) {
        setError(t('errors.unexpected'));
        setLoading(false);
    }
  };

  const handleFinish = async (intent?: 'trial' | 'free') => {
    if (intent === 'free' || intent === 'trial') {
        setLoading(true);
        try {
            const r = await apiJson<{ url?: string; redirectUrl?: string }>("/api/payments/checkout", {
                method: 'POST',
                body: JSON.stringify({ plan: 'MONTHLY', ...(intent === 'free' ? { trial: true } : {}) })
            });
            const targetUrl = r.data?.url || r.data?.redirectUrl;
            if (r.ok && targetUrl) {
                window.location.href = targetUrl;
            } else {
                router.push('/dashboard?welcome=true');
            }
        } catch (_) {
            router.push('/dashboard?welcome=true');
        } finally {
            setLoading(false);
        }
    } else {
        router.push('/dashboard');
    }
  };

  const handleRedeem = async () => {
    if (!promoCode.trim()) return;
    setLoading(true);
    setPromoStatus(null);
    try {
        const res = await apiJson("/api/promo/redeem", {
            method: "POST",
            body: JSON.stringify({ code: promoCode })
        });
        if (res.ok) {
            setPromoStatus({ type: 'success', msg: res.data?.message || tRegister('step5.promoSuccess') });
            setTimeout(() => {
                router.push('/dashboard');
            }, 1500);
        } else {
             setPromoStatus({ type: 'error', msg: res.error || tRegister('step5.promoInvalid') });
             setLoading(false);
        }
    } catch (e) {
        setPromoStatus({ type: 'error', msg: tRegister('step5.connectionError') });
        setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (step < 3) handleNext();
      else if (step === 3) handleRegister();
      else if (step === 4) handleVerify();
    }
  };

  // Animation Variants
  const variants = {
    enter: (direction: number) => ({ x: direction > 0 ? 50 : -50, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (direction: number) => ({ x: direction < 0 ? 50 : -50, opacity: 0 }),
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
        className={cn("w-full", step === 4 ? "max-w-2xl" : "max-w-md")}
      >
        <div className={cn(
          "relative overflow-hidden rounded-[2rem] border transition-all duration-500",
          "backdrop-blur-[12px] shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]",
          "bg-gradient-to-b from-white/10 to-white/5 border-white/20"
        )}>
          {/* Liquid Glass Highlights */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-50" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-30" />

          {/* Progress Bar (Only for steps 1-3) */}
          {step < 5 && (
            <div className="absolute top-0 left-0 w-full h-1 bg-white/5">
              <motion.div 
                className="h-full bg-gradient-to-r from-white via-zinc-300 to-zinc-500"
                initial={{ width: "0%" }}
                animate={{ width: `${(step / 4) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          )}

          <div className="p-8 md:p-10 min-h-[400px] flex flex-col justify-center">
            
            {step < 4 && (
              <div className="mb-8 text-center">
                 <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/10 mb-4 border border-white/10"
                 >
                    <Image src="/pricing-plan-icon.png" alt="Logo" width={24} height={24} className="opacity-80" />
                 </motion.div>
              </div>
            )}

            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="space-y-2 text-center">
                    <h1 className="text-3xl font-bold tracking-tight text-white">{tRegister('step1.title')}</h1>
                    <p className="text-zinc-400 text-lg">{tRegister('step1.subtitle')}</p>
                  </div>
                  <div className="space-y-4">
                    <Input
                      autoFocus
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (nameError) setNameError(null);
                      }}
                      onKeyDown={handleKeyDown}
                      placeholder={t('namePlaceholder')}
                      className={`input-hero text-lg h-14 px-6 rounded-2xl bg-black/20 border-white/10 text-white placeholder:text-zinc-600 ${nameError ? "ring-2 ring-destructive" : ""} focus-visible:border-white/30`}
                    />
                    {nameError && <p className="text-sm text-destructive text-center">{nameError}</p>}
                    <Button onClick={handleNext} className="w-full h-12 rounded-xl text-lg bg-white text-black hover:bg-zinc-200">
                      {tRegister('step1.continue')} <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-zinc-500">{t('hasAccount')} <Link href="/login" className="underline hover:text-white transition-colors">{t('login')}</Link></p>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="space-y-2 text-center">
                    <h1 className="text-2xl font-bold tracking-tight text-white">{tRegister('step2.title', {name: name.split(' ')[0]})}</h1>
                    <p className="text-zinc-400 text-lg">{tRegister('step2.subtitle')}</p>
                  </div>
                  <div className="space-y-4">
                    <Input
                      autoFocus
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (emailError) setEmailError(null);
                      }}
                      onKeyDown={handleKeyDown}
                      placeholder={tRegister('step2.emailPlaceholder')}
                      className={`input-hero text-lg h-14 px-6 rounded-2xl bg-black/20 border-white/10 text-white placeholder:text-zinc-600 ${emailError ? "ring-2 ring-destructive" : ""} focus-visible:border-white/30`}
                    />
                    {emailError && <p className="text-sm text-destructive text-center">{emailError}</p>}
                    <div className="flex gap-3">
                      <Button variant="outline" onClick={handleBack} className="h-12 w-14 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-white">
                        <ChevronLeft className="w-6 h-6" />
                      </Button>
                      <Button onClick={handleNext} className="flex-1 h-12 rounded-xl text-lg bg-white text-black hover:bg-zinc-200">
                        {tRegister('step2.next')} <ArrowRight className="ml-2 w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="space-y-2 text-center">
                    <h1 className="text-2xl font-bold tracking-tight text-white">{tRegister('step3.title')}</h1>
                    <p className="text-zinc-400">{tRegister('step3.subtitle')}</p>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                        <div className="relative">
                            <Input
                            autoFocus
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                if (passwordError) setPasswordError(null);
                            }}
                            onKeyDown={handleKeyDown}
                            placeholder={t('password')}
                            className={`input-hero h-12 px-4 rounded-xl bg-black/20 border-white/10 text-white placeholder:text-zinc-600 ${passwordError ? "ring-2 ring-destructive" : ""} focus-visible:border-white/30`}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                        {passwordError && <p className="text-xs text-destructive">{passwordError}</p>}
                    </div>

                    <div className="space-y-2">
                        <Input
                        type={showPassword ? "text" : "password"}
                        value={confirm}
                        onChange={(e) => {
                            setConfirm(e.target.value);
                            if (confirmError) setConfirmError(null);
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder={t('confirmPassword')}
                        className={`input-hero h-12 px-4 rounded-xl bg-black/20 border-white/10 text-white placeholder:text-zinc-600 ${confirmError ? "ring-2 ring-destructive" : ""} focus-visible:border-white/30`}
                        />
                         {confirmError && <p className="text-xs text-destructive">{confirmError}</p>}
                    </div>

                    {error && <p className="text-sm text-destructive text-center bg-destructive/10 p-2 rounded-lg border border-destructive/20">{error}</p>}

                    <div className="flex gap-3">
                      <Button variant="outline" onClick={handleBack} className="h-12 w-14 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-white">
                        <ChevronLeft className="w-6 h-6" />
                      </Button>
                      <Button onClick={handleRegister} disabled={loading} className="flex-1 h-12 rounded-xl text-lg bg-white text-black hover:bg-zinc-200 border-none transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                        {loading ? tRegister('step3.creating') : t('createAccount')}
                        {!loading && <CheckCircle2 className="ml-2 w-5 h-5" />}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6 py-4"
                >
                  <div className="space-y-2">
                    <h2 className="text-3xl font-bold text-white">
                      {tRegister('step4.title')}
                    </h2>
                    <p className="text-zinc-400 text-lg">
                      {tRegister.rich('step4.subtitle', {
                        email: email,
                        highlight: (chunks) => <span className="text-white font-medium">{chunks}</span>
                      })}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="code" className="text-zinc-400">{tRegister('step4.codeLabel')}</Label>
                      <Input
                        id="code"
                        value={code}
                        onChange={(e) => {
                           // Allow only numbers and limit to 6 chars
                           const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
                           setCode(val);
                           if (val.length === 6) setCodeError(null);
                        }}
                        onKeyDown={handleKeyDown}
                        className={`h-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-white/20 focus:ring-white/20 text-center text-2xl tracking-[0.5em] font-mono ${codeError ? 'border-red-500/50 focus:border-red-500/50' : ''}`}
                        placeholder="000000"
                        autoFocus
                      />
                      {codeError && (
                        <p className="text-red-400 text-sm flex items-center gap-1">
                          <span className="inline-block w-4 h-4 rounded-full border-2 border-current mr-1 align-middle" /> {codeError}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-3 pt-4">
                      <Button onClick={handleVerify} disabled={loading || code.length !== 6} className="flex-1 h-12 rounded-xl text-lg bg-white text-black hover:bg-zinc-200 border-none transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                        {loading ? tRegister('step4.verifying') : tRegister('step4.verifyBtn')}
                        {!loading && <CheckCircle2 className="ml-2 w-5 h-5" />}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 5 && (
                  <motion.div
                     key="step5"
                     initial={{ opacity: 0, scale: 0.9 }}
                     animate={{ opacity: 1, scale: 1 }}
                     className="text-center space-y-8 py-4"
                   >
                     <div className="flex justify-center">
                         <div className="relative w-24 h-24">
                             <motion.div 
                                 animate={{ rotate: 360 }}
                                 transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                                 className="absolute inset-0 rounded-full border-t-2 border-r-2 border-violet-500/50"
                             />
                             <div className="absolute inset-2 rounded-full bg-white/5 backdrop-blur-sm flex items-center justify-center border border-white/10">
                                 <Sparkles className="w-10 h-10 text-white fill-white/50" />
                             </div>
                         </div>
                     </div>

                     <div className="space-y-2">
                         <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400">
                             ¡Cuenta creada con éxito!
                         </h2>
                         <p className="text-zinc-400 text-lg max-w-md mx-auto">
                             Redirigiendo a tu configuración inicial...
                         </p>
                     </div>
                     <div className="flex justify-center pt-8">
                        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
                     </div>
                  </motion.div>
              )}
            </AnimatePresence>
            
          </div>
        </div>
      </motion.div>
    </div>
  );
}