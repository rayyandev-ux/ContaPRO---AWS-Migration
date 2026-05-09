"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useScroll } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Loader2 } from "lucide-react";
import Image from "next/image";
import { PricingSparkles } from "@/components/PricingSparkles";
import { cn } from "@/lib/utils";
import { apiJson } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useTranslations } from 'next-intl';
import { Reveal } from "@/components/Reveal";
import { useMediaQuery } from '@/hooks/use-media-query';

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
  isDesktop?: boolean;
}

const PricingCard = ({ name, price, desc, features, isHero = false, delay = 0, buttonText, onBuy, isLoading, priceDisplay, headerContent, isDesktop = true }: PlanProps) => {
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
          ? "z-20 md:lg:scale-105 md:xl:scale-110 lg:shadow-2xl" 
          : "z-10 md:lg:scale-95 md:lg:opacity-80 lg:hover:opacity-100 lg:hover:scale-100 transition-all duration-300"
      )}
    >
      <motion.div
        animate={isDesktop ? { y: [0, -10, 0] } : undefined}
        transition={isDesktop ? {
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
          delay: delay * 2, 
        } : undefined}
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

        <div className="p-6 md:p-8 lg:p-6 xl:p-10 flex flex-col h-full relative z-10">
          
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

          <div className="text-center mb-6 md:mb-10">
             <div className="flex items-start justify-center gap-1">
                {priceDisplay}
             </div>
             {isHero && (
                <span className="inline-block mt-2 text-xs font-medium text-zinc-400 bg-zinc-400/10 px-2 py-0.5 rounded-full border border-zinc-400/20">
                   {t('savePercent')}
                </span>
             )}
          </div>

          <ul className="space-y-3 md:space-y-4 mb-8 md:mb-10 flex-1">
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

// --- Main Component ---

export function PricingSection() {
  const t = useTranslations('PricingSection');
  const containerRef = useRef<HTMLElement>(null);

  const { isAuthenticated: loggedIn, user } = useAuth();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [loading, setLoading] = useState<string | null>(null);
  const [exchangeRate, setExchangeRate] = useState(1);
  const [localCurrency, setLocalCurrency] = useState<string>('PEN');

  useEffect(() => {
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
        // Silently fail for IP detection errors (likely ad-blocker or network issue)
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

    detectCurrency();
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
    
    // Forzamos SOLES (PEN)
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

  const handleBuy = async (plan: 'MONTHLY' | 'ANNUAL' | 'LIFETIME' | 'QUARTERLY' | 'FREE') => {
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
                    alert(res.error || "No se pudo activar la prueba.");
                    setLoading(null);
                }
            } catch (e) {
                alert("Error de conexión");
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
    const r = await apiJson<{ url?: string; redirectUrl?: string; orderId?: string }>("/api/payments/checkout", { 
      method: 'POST', 
      body: JSON.stringify({ plan }) 
    });
    
    if (!r.ok && (r.error?.includes('No autenticado') || r.error?.includes('Token inválido'))) {
       window.location.href = '/register';
       return;
    }

    const targetUrl = r.data?.url || r.data?.redirectUrl;

    if (r.ok && targetUrl) {
      window.location.href = targetUrl;
    } else {
      setLoading(null);
      alert(t('paymentError'));
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
    <section 
      id="pricing" 
      className="relative pt-[150px] pb-[100px] md:pt-[200px] md:pb-[150px] overflow-hidden -mt-[100px] md:-mt-[150px] z-40" 
      ref={containerRef}
      style={{ 
        borderTopLeftRadius: '40% 80px', 
        borderTopRightRadius: '40% 80px',
        borderBottomLeftRadius: '40% 80px', 
        borderBottomRightRadius: '40% 80px',
        borderTop: '1px solid rgba(139, 92, 246, 0.6)',
        borderBottom: '1px solid rgba(139, 92, 246, 0.6)',
        boxShadow: '0 -15px 40px -10px rgba(139, 92, 246, 0.5), 0 15px 40px -10px rgba(139, 92, 246, 0.5), 0 0 20px -5px rgba(139, 92, 246, 0.3)'
      }}
    >
      <div className="absolute inset-0 z-0 bg-black pointer-events-none" />

      <div className="relative z-10 container mx-auto px-4 md:px-6">
        <div className="text-center max-w-3xl mx-auto mb-12 md:mb-20 space-y-4">
          <Reveal>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
              {t('plansDesignedForYou')}
            </h2>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="text-lg text-zinc-400">
              {t('powerYourFinances')}
            </p>
          </Reveal>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-6xl mx-auto items-start">
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
                    onBuy={() => handleBuy(plan.id as any)}
                    isLoading={loading === plan.id}
                    delay={i * 0.1}
                    isDesktop={isDesktop}
                />
            );
          })}
        </div>
      </div>
    </section>
  );
}
