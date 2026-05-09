"use client";

import { useRef, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { motion, useScroll, useTransform } from "framer-motion";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Loader2 } from "lucide-react";
import Image from "next/image";
import { PricingSparkles } from "@/components/PricingSparkles";
import { cn } from "@/lib/utils";
import FaultyTerminalBackground from "@/components/FaultyTerminal";
import { apiJson } from "@/lib/api";
import { toast } from "sonner";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Reveal } from "@/components/Reveal";
import { Card, CardContent } from "@/components/ui/card";

import { useTranslations } from "next-intl";

const TERMINAL_GRID_MUL: [number, number] = [2, 2];

// --- 3D Logo Sphere ---

const LogoSphere = () => (
  <div className="relative w-20 h-20 mx-auto mb-6 group">
    <div className="relative w-full h-full flex items-center justify-center">
       <div className="relative w-full h-full opacity-100 transition-transform duration-500 group-hover:scale-110">
          <Image 
              src="/pricing-plan-icon.png" 
              alt="ContaPRO" 
              fill 
              className="object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.6)]"
            />
       </div>
    </div>
  </div>
);

// --- Pricing Card ---

interface PlanProps {
  name: string;
  price: number;
  desc: string;
  features: string[];
  isHero?: boolean;
  delay?: number;
  buttonText: string;
  onBuy: () => void;
  isLoading: boolean;
  priceDisplay: React.ReactNode;
  headerContent?: React.ReactNode;
}

const PricingCard = ({ name, price, desc, features, isHero = false, delay = 0, buttonText, onBuy, isLoading, priceDisplay, headerContent }: PlanProps) => {
  // Use translations for PricingSection
  const t = useTranslations('PricingSection');
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.8, delay, ease: "easeOut" }}
      className={cn(
        "relative flex flex-col h-full",
        isHero 
          ? "z-20 lg:scale-105 xl:scale-110 lg:shadow-2xl" 
          : "z-10 lg:scale-95 lg:opacity-80 lg:hover:opacity-100 lg:hover:scale-100 transition-all duration-300"
      )}
    >
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
          delay: delay * 2, 
        }}
        className={cn(
          "relative h-full overflow-hidden rounded-[2rem] border transition-all duration-500",
          "backdrop-blur-[12px] shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]", // Base glass effect
          isHero 
            ? "bg-gradient-to-b from-white/10 to-white/5 border-white/20 shadow-[0_0_50px_-12px_rgba(139,92,246,0.3)]" 
            : "bg-gradient-to-b from-white/5 to-white/0 border-white/10 hover:bg-white/10 hover:border-white/20"
        )}
      >
         {/* Liquid Glass Highlight */}
         <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-50" />
         <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-30" />
         
         {/* Hero Badge */}
         {isHero && (
            <div className="absolute -top-[1px] left-1/2 -translate-x-1/2 z-20">
               <div className="relative px-6 py-1.5 rounded-b-xl bg-white/10 backdrop-blur-md border border-white/20 shadow-lg">
                 <span className="text-xs font-bold text-white tracking-widest uppercase flex items-center gap-1">
                   <Sparkles className="w-3 h-3 text-violet-300 fill-violet-300" />
                   {t('bestValue')}
                 </span>
               </div>
            </div>
         )}

         {/* Internal Glow for Hero */}
         {isHero && (
             <div className="absolute inset-0 bg-gradient-to-b from-violet-500/10 to-transparent pointer-events-none" />
         )}

        <div className="p-8 md:p-8 lg:p-6 xl:p-10 flex flex-col h-full relative z-10">
          
          {headerContent}
          {!headerContent && <LogoSphere />}

          <div className="text-center mb-8">
            <h3 className={cn(
                "text-xl font-semibold tracking-wide mb-2",
                isHero ? "text-transparent bg-clip-text bg-gradient-to-r from-white to-violet-200" : "text-zinc-300"
            )}>
              {name}
            </h3>
            <p className="text-sm text-zinc-500 font-light">{desc}</p>
          </div>

          <div className="text-center mb-10">
             <div className="flex items-start justify-center gap-1">
                {priceDisplay}
             </div>
             {isHero && (
                <span className="inline-block mt-2 text-xs font-medium text-zinc-400 bg-zinc-400/10 px-2 py-0.5 rounded-full border border-zinc-400/20">
                   {t('savePercent')}
                </span>
             )}
          </div>

          <ul className="space-y-4 mb-10 flex-1">
            {features.map((feature, i) => (
              <li key={i} className="flex items-start text-sm text-zinc-300/80 group/item">
                <div className={cn(
                    "mt-0.5 mr-3 flex-shrink-0 rounded-full p-0.5",
                    isHero ? "bg-violet-500/20 text-violet-400 shadow-[0_0_8px_rgba(139,92,246,0.4)]" : "bg-zinc-800 text-zinc-400"
                )}>
                   <Check className="w-3.5 h-3.5" strokeWidth={3} />
                </div>
                <span className="group-hover/item:text-white transition-colors duration-300">{feature}</span>
              </li>
            ))}
          </ul>

          <Button 
            className={cn(
                "w-full h-14 rounded-full text-base font-medium tracking-wide transition-all duration-300 overflow-visible group relative",
                "bg-gradient-to-b from-white/30 to-white/10 backdrop-blur-xl border border-white/20 text-white shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:bg-white/20 hover:shadow-[0_0_35px_rgba(255,255,255,0.5)]"
            )}
            onClick={onBuy}
            disabled={isLoading}
          >
             <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-md" />
             <div className="absolute inset-0 overflow-hidden rounded-full">
                <PricingSparkles color="text-white" />
             </div>
             {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
             <span className="relative z-10">{buttonText}</span>
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default function PricingContent() {
  const searchParams = useSearchParams();
  const t = useTranslations('PricingPage');
  const tSection = useTranslations('PricingSection');
  const tPlans = useTranslations('PricingSection.plans');
  const containerRef = useRef<HTMLElement>(null);

  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [exchangeRate, setExchangeRate] = useState(1);
  const [localCurrency, setLocalCurrency] = useState<string>('PEN'); // Default a SOLES
  
  // Coupon state
  const [couponCode, setCouponCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'FLOW' | 'STRIPE'>('STRIPE');

  useEffect(() => {
    (async () => {
      try {
        const me = await apiJson("/api/auth/me");
        if (me.ok && me.data) {
             setLoggedIn(true);
             setUser(me.data);
             if (me.data.paymentProvider === 'STRIPE') {
               setSelectedProvider('STRIPE');
             } else {
               setSelectedProvider('STRIPE'); // Temporarily force STRIPE due to Flow outage
             }
        } else {
             setLoggedIn(false);
             setUser(null);
        }
      } catch (e) {
        setLoggedIn(false);
        setUser(null);
      }
    })();

    // Detectar país y moneda
    const detectCurrency = async () => {
      try {
        // Intentar detectar por IP primero
        const r = await fetch('https://ipapi.co/currency/');
        const currency = r.ok ? await r.text() : null;
        
        if (currency && currency.length === 3 && currency !== 'USD') {
          const rateRes = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
          const rateData = await rateRes.json();
          if (rateData.rates && rateData.rates[currency]) {
            setLocalCurrency(currency);
            setExchangeRate(rateData.rates[currency]);
            return;
          }
        }
      } catch (e) {
        // Silently fail for IP detection errors
      }

      // Fallback: Timezone para casos comunes si falla IP o es bloqueado
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz === 'America/Lima') {
        setLocalCurrency('PEN');
        fetch('https://api.exchangerate-api.com/v4/latest/USD')
          .then(r => r.json())
          .then(d => {
            if (d.rates && d.rates.PEN) setExchangeRate(d.rates.PEN);
          })
          .catch(() => {});
      } else if (tz === 'Europe/Madrid') {
        setLocalCurrency('EUR');
        fetch('https://api.exchangerate-api.com/v4/latest/USD')
          .then(r => r.json())
          .then(d => {
            if (d.rates && d.rates.EUR) setExchangeRate(d.rates.EUR);
          })
          .catch(() => {});
      }
    };

    // Desactivamos la detección de moneda para forzar SOLES según requerimiento
    // detectCurrency();
  }, []);

  const formatPrice = (price: number) => {
    if (price === 0) {
      return (
        <span className={cn(
          "text-5xl font-bold tracking-tight drop-shadow-xl",
          "text-white"
        )}>
          Gratis
        </span>
      );
    }
    
    // El precio ya está en SOLES (PEN) según requerimiento
    const formatted = new Intl.NumberFormat('es-PE', { 
      style: 'currency', 
      currency: 'PEN',
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);

    return (
      <span className={cn(
        "text-5xl font-bold tracking-tight drop-shadow-xl",
        "text-white"
      )}>
        {formatted}
      </span>
    );
  };

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'MONTHLY' | 'ANNUAL' | 'LIFETIME' | 'QUARTERLY' | 'FREE' | null>(null);
  const [buyTermsAccepted, setBuyTermsAccepted] = useState(false);

  const getPlanDetails = (plan: 'MONTHLY' | 'ANNUAL' | 'LIFETIME' | 'QUARTERLY' | 'FREE' | null) => {
    switch (plan) {
      case 'MONTHLY': return { name: 'Mensual', price: '18.00', interval: 'mes' };
      case 'ANNUAL': return { name: 'Anual', price: '120.00', interval: 'año' };
      default: return { name: '', price: '0', interval: '' };
    }
  };

  const isPremium = user?.plan === "PREMIUM" || user?.plan === "BUSINESS" || user?.plan === "LIFETIME";

  const handleBuyClick = (plan: 'MONTHLY' | 'ANNUAL' | 'LIFETIME' | 'QUARTERLY' | 'FREE') => {
    if (loggedIn === false) {
      window.location.href = '/register';
      return;
    }

    if (isPremium && plan !== 'FREE') {
      toast.error("Ya tienes una suscripción activa.");
      return;
    }
    
    if (plan === 'FREE') {
      handleBuy(plan);
      return;
    }
    
    setSelectedPlan(plan);
    setConfirmModalOpen(true);
  };

  useEffect(() => {
    if (loggedIn === true) {
      const plan = searchParams.get('plan');
      if (plan === 'MONTHLY' || plan === 'ANNUAL') {
        // Automatically open the buy dialog if valid plan in URL
        handleBuyClick(plan);
        
        // Clean URL to prevent re-triggering
        const url = new URL(window.location.href);
        url.searchParams.delete('plan');
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, [loggedIn, searchParams]);

  const handleBuy = async (plan: 'MONTHLY' | 'ANNUAL' | 'LIFETIME' | 'QUARTERLY' | 'FREE') => {
    if (loggedIn === null) return; // Wait for auth check

    if (plan === 'FREE') {
        if (loggedIn) {
            // Check if user has active plan or trial
            const hasActivePlan = user?.plan === 'LIFETIME' || 
                                 (user?.plan === 'PREMIUM' && user?.planExpires && new Date(user.planExpires) > new Date());
            const hasTrial = user?.trialEnds && new Date(user.trialEnds) > new Date();
            
            if (hasActivePlan || hasTrial) {
                window.location.href = '/dashboard';
                return;
            }

            setLoading('FREE');
            try {
                const res = await apiJson("/api/auth/activate-free-trial", { method: "POST" });
                if (res.ok) {
                    window.location.href = '/dashboard?welcome=trial_activated';
                } else {
                    toast.error(res.error || "No se pudo activar la prueba.");
                    setLoading(null);
                }
            } catch (e) {
                toast.error("Error de conexión");
                setLoading(null);
            }
        } else {
            window.location.href = '/register?plan=free';
        }
        return;
    }

    if (loggedIn === false) {
      window.location.href = '/register';
      return;
    }

    setLoading(plan);

    // Bifurcación por proveedor
    const providerToUse = selectedProvider;

    if (providerToUse === 'FLOW') {
      try {
        const res = await apiJson<{ url?: string; subscriptionId?: string }>("/api/payments/flow/checkout", {
          method: "POST",
          body: JSON.stringify({ period: plan }),
        });

        if (res.ok) {
          if (res.data?.url) {
            window.location.href = res.data.url;
            return;
          }
          if (res.data?.subscriptionId) {
            window.location.href = '/billing?action=plan_updated';
            return;
          }
        } else {
          setLoading(null);
          toast.error(res.error || tSection('paymentError'));
        }
      } catch (e) {
        setLoading(null);
        toast.error(tSection('paymentError'));
      }
      return;
    }

    // Intentar compra in-app si tiene tarjeta (STRIPE)
    try {
      const res = await apiJson<{ url?: string; subscriptionId?: string; paymentIntentId?: string }>("/api/payments/buy-extra", { // Usamos buy-extra como genérico o creamos uno para planes
        method: "POST",
        body: JSON.stringify({ plan, type: 'PLAN' }), // Necesitaremos actualizar el backend para manejar PLAN
      });

      if (res.ok) {
        if (res.data?.url) {
          window.location.href = res.data.url;
          return;
        }
        window.location.href = '/billing?action=plan_updated';
        return;
      }
    } catch (e) {}

    // Fallback a Checkout tradicional si no tiene tarjeta o falla in-app
    const r = await apiJson<{ url?: string; redirectUrl?: string; orderId?: string }>("/api/payments/checkout", { 
      method: 'POST', 
      body: JSON.stringify({ plan }) 
    });
    
    if (!r.ok && (r.error === 'No autenticado' || r.error === 'Token inválido')) {
       window.location.href = '/register';
       return;
    }

    const targetUrl = r.data?.url || r.data?.redirectUrl;

    if (r.ok && targetUrl) {
      window.location.href = targetUrl;
    } else {
      setLoading(null);
      toast.error(tSection('paymentError'));
    }
  };

  const handleRedeem = async () => {
    if (!loggedIn) {
        window.location.href = '/register';
        return;
    }
    if (!couponCode) return;
    setRedeeming(true);
    const res = await apiJson<{ message: string }>("/api/promo/redeem", {
        method: "POST",
        body: JSON.stringify({ code: couponCode })
    });
    setRedeeming(false);
    if (res.ok) {
        toast.success(res.data?.message || t('coupon.success'));
        window.location.reload();
    } else {
        toast.error("Error: " + (res.error || t('coupon.invalid')));
    }
  };

  const PLANS = [
    {
      id: 'FREE',
      name: "FREE",
      price: 0,
      desc: "Para empezar a controlar tu dinero",
      features: [
        "Uso ilimitado de ContaPRO web",
        "5 mensajes al mes vía WhatsApp/Telegram",
        "Sin vinculación de correos",
        "Soporte Básico"
      ],
      buttonText: "Crear cuenta gratis",
    },
    {
        id: 'MONTHLY', 
        name: "PRO Mensual",
        price: 18,
        desc: "Potencia máxima con IA sin límites",
        features: [
            "Todo lo del plan FREE",
            "Consultas ilimitadas por WhatsApp/Telegram",
            "1 correo vinculado incluido",
            "Correos adicionales por S/ 5.00 al mes",
            "Soporte Prioritario"
        ],
        isHero: false,
        buttonText: "Elegir Mensual",
    },
    {
        id: 'ANNUAL', 
        name: "PRO Anual",
        price: 120,
        desc: "La mejor opción para todo el año",
        features: [
            "Todo lo incluido en el plan Mensual.",
            "Descuento exclusivo.",
            "Ahorras más de 5 meses de suscripción al instante.",
            "Un año entero de tranquilidad, sin renovación mensual.",
            "Acompañamiento a largo plazo para asegurar que cumplas tus metas."
        ],
        isHero: true,
        buttonText: "Elegir Anual",
        headerContent: (
            <div className="flex flex-col items-center justify-center mb-6">
                 <LogoSphere />
                 <motion.span 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-[10px] font-bold text-emerald-400 mt-2 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20"
                 >
                    Ahorra S/ 96 al año
                 </motion.span>
            </div>
        )
    }
  ];

  return (
    <div className="relative min-h-screen bg-black text-white selection:bg-violet-500/30 overflow-hidden">
      <div 
        className="relative z-20 bg-black pb-48 md:pb-64 overflow-hidden"
        style={{ 
          borderBottomLeftRadius: '50% 200px', 
          borderBottomRightRadius: '50% 200px',
          borderBottom: '1px solid rgba(139, 92, 246, 0.6)',
          boxShadow: '0 15px 40px -10px rgba(139, 92, 246, 0.5), 0 0 20px -5px rgba(139, 92, 246, 0.3)'
        }}
      >
         <FaultyTerminalBackground 
          className="absolute inset-0 z-0 opacity-40 pointer-events-none" 
          gridMul={TERMINAL_GRID_MUL}
        />

        <SiteHeader />

        <main className="relative z-10 pt-32 px-4 md:px-6">
          <div className="max-w-7xl mx-auto space-y-20">
            
            {/* Header */}
            <div className="text-center space-y-4">
                <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
                    {t('title')}
                </h1>
                <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
                    {t('subtitle')}
                </p>

                {isPremium && (
                  <div className="mt-8 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl max-w-sm mx-auto backdrop-blur-sm">
                    <p className="text-emerald-400 font-medium">¡Ya eres miembro Premium!</p>
                    <p className="text-sm text-zinc-400 mt-1">Si deseas gestionar tu plan o adquirir recursos extras, visita el panel de facturación.</p>
                    <button onClick={() => window.location.href = '/billing'} className="mt-3 w-full bg-emerald-500 hover:bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium transition-colors">
                      Ir a Facturación
                    </button>
                  </div>
                )}

                {!isPremium && (
                  <div className="flex flex-col items-center justify-center mt-8 p-4 bg-white/5 rounded-2xl border border-white/10 max-w-sm mx-auto backdrop-blur-sm">
                    <p className="text-sm text-zinc-300 mb-3 font-medium">¿Dónde estás ubicado?</p>
                    <div className="flex flex-col gap-2 bg-black/50 p-1 rounded-xl border border-white/10 w-full">
                      <button
                        onClick={() => setSelectedProvider('FLOW')}
                        disabled={true}
                        className={cn(
                          "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 w-full opacity-50 cursor-not-allowed",
                          selectedProvider === 'FLOW' ? "bg-violet-500/20 text-violet-300 border border-violet-500/30" : "text-zinc-400"
                        )}
                      >
                         (Yape, Plin, Tarjeta) - Temporalmente no disponible
                      </button>
                      <button
                        onClick={() => setSelectedProvider('STRIPE')}
                        className={cn(
                          "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 w-full",
                          selectedProvider === 'STRIPE' ? "bg-violet-500/20 text-violet-300 border border-violet-500/30" : "text-zinc-400 hover:text-zinc-200"
                        )}
                      >
                        🌍 Otro país (Stripe)
                      </button>
                    </div>
                    {selectedProvider === 'FLOW' && (
                       <p className="text-xs text-amber-400/80 mt-3 text-center px-2">
                         Nota: Los pagos con Yape, Plin o PagoEfectivo no son recurrentes. Deberás renovar manualmente cada mes/año.
                       </p>
                    )}
                  </div>
                )}
            </div>

            {/* Pricing Grid - Updated for better alignment */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto items-start">
                {PLANS.map((plan, i) => {
                    let btnText = plan.buttonText;
                    
                    if (loggedIn && user) {
                         const hasActivePlan = user.plan === 'LIFETIME' || 
                                              (user.plan === 'PREMIUM' && user.planExpires && new Date(user.planExpires) > new Date());
                         const hasTrial = user.trialEnds && new Date(user.trialEnds) > new Date();
                         
                         if (plan.id === 'FREE') {
                             if (hasActivePlan || hasTrial) {
                                 btnText = "Ir al Dashboard";
                             } else {
                                 btnText = "Activar Prueba Gratis";
                             }
                         }
                    }

                    return (
                        <PricingCard 
                            key={plan.id}
                            {...plan}
                            buttonText={btnText}
                            priceDisplay={formatPrice(plan.price)}
                            onBuy={() => handleBuyClick(plan.id as any)}
                            isLoading={loading === plan.id || loggedIn === null}
                            delay={0}
                        />
                    );
                })}
            </div>

            {/* Coupon Section */}
            <div className="max-w-md mx-auto mt-20 p-8 rounded-2xl bg-zinc-900/50 border border-white/10 backdrop-blur-md">
                <h3 className="text-lg font-semibold text-center mb-4">{t('coupon.title')}</h3>
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        placeholder={t('coupon.placeholder')}
                        className="flex-1 bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-violet-500 transition-colors"
                    />
                    <Button 
                        onClick={handleRedeem}
                        disabled={redeeming || !couponCode}
                        className="bg-white text-black hover:bg-zinc-200"
                    >
                        {redeeming ? <Loader2 className="w-4 h-4 animate-spin" /> : t('coupon.redeem')}
                    </Button>
                </div>
            </div>

        </div>
        </main>
      </div>

      <div className="relative z-10 -mt-[100px] md:-mt-[150px]">
        <SiteFooter className="pt-[150px] md:pt-[200px]" />
      </div>

      {selectedPlan && (
        <ConfirmDialog 
          open={confirmModalOpen}
          onOpenChange={(open) => {
            if (!open) {
              setConfirmModalOpen(false);
              setBuyTermsAccepted(false);
            }
          }}
          title={`Confirmar Compra: Plan ${getPlanDetails(selectedPlan).name}`}
          description={
            <div className="space-y-4 text-left">
              <p className="text-sm text-white/60">
                Se realizará un cargo a tu método de pago registrado o serás redirigido a Stripe para completar el pago de <strong className="text-white">S/ {getPlanDetails(selectedPlan).price}</strong>.
              </p>
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/40">Frecuencia de cobro:</span>
                  <span className="text-white font-bold capitalize">{getPlanDetails(selectedPlan).interval}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/40">Total a pagar:</span>
                  <span className="text-white font-bold">S/ {getPlanDetails(selectedPlan).price}</span>
                </div>
              </div>
              <p className="text-[10px] text-white/40 italic leading-relaxed">
                * Si usas tarjeta, el cobro se realizará de forma automática en los siguientes periodos. Podrás gestionar tu plan o cancelarlo en cualquier momento desde la sección de facturación.
              </p>
              
              {(!user || !user.paymentProvider) && selectedProvider === 'FLOW' && (
                 <p className="text-[10px] text-amber-400/80 italic leading-relaxed mt-2 border border-amber-500/20 bg-amber-500/10 p-2 rounded-lg">
                   <strong>Aviso Flow:</strong> Serás redirigido a Flow. Si eliges Yape, Plin o PagoEfectivo, el acceso será por 1 {getPlanDetails(selectedPlan).interval} sin renovación automática. Si deseas renovación automática, debes elegir Tarjeta de Crédito/Débito.
                 </p>
              )}

              <label className="flex items-start gap-3 mt-4 cursor-pointer group">
                <div className="mt-0.5">
                  <input 
                    type="checkbox" 
                    className="hidden" 
                    checked={buyTermsAccepted}
                    onChange={(e) => setBuyTermsAccepted(e.target.checked)}
                  />
                  <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${buyTermsAccepted ? 'bg-white border-white text-black' : 'border-white/20 bg-white/5 group-hover:border-white/40'}`}>
                    {buyTermsAccepted && <Check className="w-3 h-3" />}
                  </div>
                </div>
                <span className="text-xs text-white/60 group-hover:text-white/80 transition-colors">
                  Acepto los términos y autorizo el cargo automático.
                </span>
              </label>
            </div>
          }
          confirmText={`Proceder al pago`}
          cancelText="Cancelar"
          onConfirm={() => {
            setConfirmModalOpen(false);
            handleBuy(selectedPlan);
          }}
          loading={loading === selectedPlan}
          disabled={!buyTermsAccepted}
        />
      )}
    </div>
  );
}
