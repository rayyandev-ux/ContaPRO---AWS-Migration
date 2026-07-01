"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { apiJson } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import GlassCombobox from "@/components/ui/glass-combobox";
import { WORLD_COUNTRIES, WORLD_CURRENCIES } from "@/lib/world-data";
import QRCode from "react-qr-code";

// Tipos de las respuestas
type OnboardingData = {
  country?: string;
  currency?: string;
  avatar?: string;
  painPoint?: string;
  currentMethod?: string;
  complexity?: string;
  mainGoal?: string;
  companion?: string;
};

type ChatMessage = {
  id: string;
  sender: "bot" | "user";
  type: "text" | "options" | "country-currency" | "avatar" | "cards" | "whatsapp-link" | "pro-incentive";
  text?: string;
  options?: { label: string; value: string; icon?: string }[];
  selected?: string;
};

const avatars = ["🐱", "🐕", "🐻", "🐼", "🦊", "🦁", "🦄", "🐉", "🦉", "🐧", "🐨", "🐰", "🐵", "🐯", "🐺", "🐸"];

export default function OnboardingChat({ userName }: { userName?: string }) {
  const t = useTranslations("Onboarding");
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [data, setData] = useState<OnboardingData>({});
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const hasStarted = useRef(false);

  // Auto-scroll al final
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [messages, isTyping]);

  // Helper to generate guaranteed unique IDs
  const getUniqueId = () => `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  // Iniciar el flujo
  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    const startFlow = async () => {
      setIsTyping(true);
      await new Promise((r) => setTimeout(r, 1000));
      setMessages([
        { id: getUniqueId(), sender: "bot", type: "text", text: t("welcome", { name: userName ? ` ${userName}` : "" }) },
      ]);
      await new Promise((r) => setTimeout(r, 800));
      setMessages((prev) => [
        ...prev,
        { id: getUniqueId(), sender: "bot", type: "country-currency" },
      ]);
      setIsTyping(false);
    };
    startFlow();
  }, [userName, t]);

  const addBotMessage = async (msg: ChatMessage, delay = 800) => {
    setIsTyping(true);
    await new Promise((r) => setTimeout(r, delay));
    setMessages((prev) => [...prev, msg]);
    setIsTyping(false);
  };

  const handleCountryCurrencySelect = async (country: string, currency: string) => {
    setData((prev) => ({ ...prev, country, currency }));
    setMessages((prev) => prev.filter((m) => m.type !== "country-currency"));
    setMessages((prev) => [
      ...prev,
      { id: getUniqueId(), sender: "user", type: "text", text: `Usaré ${country} y ${currency}` },
    ]);
    
    await addBotMessage({
      id: getUniqueId(),
      sender: "bot",
      type: "text",
      text: t("currencySaveMsg", { currency }),
    });
    
    await addBotMessage({
      id: getUniqueId(),
      sender: "bot",
      type: "text",
      text: t("understandMoney"),
    });

    await addBotMessage({
      id: getUniqueId(),
      sender: "bot",
      type: "options",
      text: t("painPointQuestion"),
      options: [
        { label: "No sé a dónde va mi dinero", value: "no-se", icon: "🤷" },
        { label: "No logro ahorrar", value: "no-ahorro", icon: "🐷" },
        { label: "Dinero disperso en todos lados", value: "dispersa", icon: "🏦" },
        { label: "Los gastos compartidos son un caos", value: "compartidos", icon: "👥" },
        { label: "Las deudas me abruman", value: "deudas", icon: "😰" },
        { label: "Todo lo anterior", value: "todo", icon: "🌪️" },
      ],
    });
  };

  const handleOptionSelect = async (msgId: string, option: { label: string; value: string; icon?: string }, step: number) => {
    // Remove the options message and replace with user selection
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    setMessages((prev) => [
      ...prev,
      { id: getUniqueId(), sender: "user", type: "text", text: `${option.icon || ""} ${option.label}` },
    ]);

    if (step === 1) {
      setData((prev) => ({ ...prev, painPoint: option.value }));
      await addBotMessage({ id: getUniqueId(), sender: "bot", type: "text", text: "Entendido, eso es muy común." }, 600);
      await addBotMessage({
        id: getUniqueId(),
        sender: "bot",
        type: "options",
        text: t("methodQuestion"),
        options: [
          { label: "No lo controlo", value: "nada", icon: "🙈" },
          { label: "Planillas (Excel/Sheets)", value: "excel", icon: "📊" },
          { label: "Otra app", value: "app", icon: "📱" },
          { label: "Cuaderno o papel", value: "papel", icon: "📓" },
          { label: "Todo en mi cabeza", value: "cabeza", icon: "🧠" },
        ],
      });
    } else if (step === 2) {
      setData((prev) => ({ ...prev, currentMethod: option.value }));
      await addBotMessage({ id: getUniqueId(), sender: "bot", type: "text", text: "¡Gracias por compartir!" }, 600);
      await addBotMessage({
        id: getUniqueId(),
        sender: "bot",
        type: "options",
        text: t("complexityQuestion"),
        options: [
          { label: "Múltiples monedas", value: "monedas", icon: "💱" },
          { label: "Muchos pagos recurrentes", value: "recurrentes", icon: "🔄" },
          { label: "Cuentas compartidas", value: "compartidas", icon: "🤝" },
          { label: "Inversiones", value: "inversiones", icon: "📈" },
          { label: "Pagos de deudas", value: "deudas", icon: "💳" },
          { label: "Nada especial, mantenlo simple", value: "simple", icon: "✨" },
        ],
      });
    } else if (step === 3) {
      setData((prev) => ({ ...prev, complexity: option.value }));
      await addBotMessage({ id: getUniqueId(), sender: "bot", type: "text", text: "Buena info, la tengo en cuenta." }, 600);
      await addBotMessage({
        id: getUniqueId(),
        sender: "bot",
        type: "options",
        text: t("goalQuestion"),
        options: [
          { label: "Ahorrar más", value: "ahorrar", icon: "💰" },
          { label: "Gastar menos", value: "gastar_menos", icon: "✂️" },
          { label: "Entender a dónde va el dinero", value: "entender", icon: "🔍" },
          { label: "Pagar deudas más rápido", value: "pagar_deudas", icon: "🚀" },
          { label: "Organizarme", value: "organizarme", icon: "📋" },
        ],
      });
    } else if (step === 4) {
      setData((prev) => ({ ...prev, mainGoal: option.value }));
      await addBotMessage({ id: getUniqueId(), sender: "bot", type: "text", text: "¡Gran objetivo!" }, 600);
      await addBotMessage({
        id: getUniqueId(),
        sender: "bot",
        type: "options",
        text: t("companionQuestion"),
        options: [
          { label: "Solo yo", value: "solo", icon: "👤" },
          { label: "Con mi pareja", value: "pareja", icon: "❤️" },
          { label: "Finanzas familiares", value: "familia", icon: "👨‍👩‍👧‍👦" },
          { label: "Compañeros de piso", value: "piso", icon: "🏠" },
          { label: "Mi emprendimiento", value: "negocio", icon: "💼" },
        ],
      });
    } else if (step === 5) {
      setData((prev) => ({ ...prev, companion: option.value }));
      await addBotMessage({ id: getUniqueId(), sender: "bot", type: "text", text: "¡Genial! Ahora vamos a vincular tu WhatsApp para que puedas enviarme tus gastos con un solo mensaje. 📱" }, 1000);
      await addBotMessage({
        id: getUniqueId(),
        sender: "bot",
        type: "whatsapp-link",
      }, 1500);
    }
  };

  const handleWhatsAppDone = async () => {
    // Ya sea que se vinculó o se saltó, mostramos las recomendaciones
    setMessages((prev) => prev.filter((m) => m.type !== "whatsapp-link"));
    await addBotMessage({ id: getUniqueId(), sender: "bot", type: "text", text: "Basado en lo que me contaste, estas funciones serán clave para ti 🚀" }, 800);
    await addBotMessage({
      id: getUniqueId(),
      sender: "bot",
      type: "cards",
    }, 1200);
  };

  const handleFinish = async (redirectPath: string = "/dashboard?welcome=true") => {
    setLoading(true);
    try {
      await apiJson("/api/auth/preferences", {
        method: "PATCH",
        body: JSON.stringify({ 
            preferredCurrency: data.currency || "PEN",
            onboardingData: data,
            tutorialSeen: true // Lo marcamos como visto para no repetir onboarding
        }),
      });
      router.push(redirectPath);
    } catch (error) {
      console.error("Error saving onboarding data", error);
      router.push(redirectPath); // Redirigir igual en caso de error
    } finally {
      setLoading(false);
    }
  };

  const handleBuy = async (plan: string) => {
    setLoading(true);
    try {
      // 1. Guardar preferencias
      await apiJson("/api/auth/preferences", {
        method: "PATCH",
        body: JSON.stringify({ 
            preferredCurrency: data.currency || "PEN",
            onboardingData: data,
            tutorialSeen: true
        }),
      });
      
      // 2. Obtener URL de Stripe
      const res = await apiJson<{url?: string}>("/api/payments/checkout", {
        method: "POST",
        body: JSON.stringify({ plan })
      });
      
      if (res.ok && res.data?.url) {
        window.location.href = res.data.url; // Redirige a Stripe
      } else {
        router.push(`/pricing?plan=${plan}`); // fallback
      }
    } catch (error) {
      console.error("Error en el checkout", error);
      router.push(`/pricing?plan=${plan}`); // fallback
    } finally {
      setLoading(false);
    }
  };

  const handleCardsDone = async () => {
    setMessages((prev) => prev.filter((m) => m.type !== "cards"));
    await addBotMessage({ id: getUniqueId(), sender: "bot", type: "text", text: "Antes de ir al dashboard, sácale el máximo provecho a ContaPRO 🚀" }, 500);
    await addBotMessage({
      id: getUniqueId(),
      sender: "bot",
      type: "pro-incentive",
    }, 1000);
  };

  return (
    <div className="flex flex-col h-full max-h-[100dvh] w-full mx-auto rounded-none md:rounded-[2rem] overflow-hidden bg-gradient-to-b from-white/10 to-white/5 backdrop-blur-[12px] border-x-0 md:border border-white/20 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] relative">
      {/* Header */}
      <div className="flex items-center p-4 border-b border-white/10 bg-white/5">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 mr-3">
          <Image src="/pricing-plan-icon.png" alt="ContaPRO" width={24} height={24} className="opacity-90" />
        </div>
        <div>
          <h3 className="text-white font-medium">ContaPRO</h3>
          <p className="text-xs text-zinc-400">Tu asistente financiero</p>
        </div>
      </div>

      {/* Chat Area */}
      <div 
        ref={scrollAreaRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 space-y-6 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent touch-pan-y overscroll-y-contain"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <AnimatePresence>
          {messages.map((msg, idx) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3 }}
              className={cn(
                "flex w-full",
                msg.sender === "user" ? "justify-end" : "justify-start"
              )}
            >
              {msg.type === "text" && (
                <div
                  className={cn(
                    "max-w-[80%] px-4 py-3 rounded-2xl text-sm md:text-base",
                    msg.sender === "user"
                      ? "bg-violet-600 text-white rounded-tr-sm shadow-[0_0_15px_rgba(124,58,237,0.3)]"
                      : "bg-white/10 text-white border border-white/10 rounded-tl-sm shadow-md backdrop-blur-sm"
                  )}
                >
                  {msg.text}
                </div>
              )}

              {msg.type === "country-currency" && (
                <CountryCurrencySelector onSelect={handleCountryCurrencySelect} />
              )}

              {msg.type === "options" && (
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 rounded-tl-sm w-full max-w-[90%] shadow-md backdrop-blur-sm">
                  <p className="text-white mb-4 text-sm font-medium">{msg.text}</p>
                  <div className="flex flex-wrap gap-2">
                    {msg.options?.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          const step = data.painPoint === undefined ? 1 
                                     : data.currentMethod === undefined ? 2 
                                     : data.complexity === undefined ? 3 
                                     : data.mainGoal === undefined ? 4 : 5;
                          handleOptionSelect(msg.id, opt, step);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-black/40 hover:bg-violet-600 hover:text-white text-zinc-300 border border-white/10 hover:border-violet-500/50 rounded-xl text-sm transition-all duration-200 shadow-sm"
                      >
                        {opt.icon && <span>{opt.icon}</span>}
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {msg.type === "whatsapp-link" && (
                <WhatsAppLinker onLinked={handleWhatsAppDone} onSkip={handleWhatsAppDone} />
              )}

              {msg.type === "cards" && (
                <PersonalizedRecommendations data={data} onFinish={handleCardsDone} loading={loading} />
              )}

              {msg.type === "pro-incentive" && (
                <ProIncentive 
                  onBuy={handleBuy}
                  onSkip={() => handleFinish("/dashboard?welcome=true")}
                  loading={loading}
                />
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {isTyping && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="bg-white/10 backdrop-blur-sm px-4 py-3 rounded-2xl rounded-tl-sm border border-white/10 flex gap-1 items-center">
              <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </motion.div>
        )}
        <div ref={chatEndRef} />
      </div>
    </div>
  );
}

function PersonalizedRecommendations({ data, onFinish, loading }: { data: OnboardingData, onFinish: () => void, loading: boolean }) {
  const t = useTranslations("Onboarding");
  const recommendations = [];

  // 1. Feature based on pain point
  if (data.painPoint === "no-se" || data.painPoint === "todo") {
    recommendations.push({
      title: "Análisis con IA",
      desc: "Categorización automática de tus gastos para que sepas exactamente a dónde se va cada centavo.",
      icon: "🤖",
      color: "from-blue-500/20 to-indigo-500/20",
    });
  } else if (data.painPoint === "no-ahorro") {
    recommendations.push({
      title: "Metas de Ahorro",
      desc: "Crea sobres virtuales y visualiza tu progreso hacia ese viaje o compra que tanto quieres.",
      icon: "🎯",
      color: "from-emerald-500/20 to-teal-500/20",
    });
  } else if (data.painPoint === "deudas") {
    recommendations.push({
      title: "Plan de Desendeudamiento",
      desc: "Estrategias personalizadas para priorizar y liquidar tus deudas más rápido.",
      icon: "📉",
      color: "from-red-500/20 to-orange-500/20",
    });
  }

  // 2. Feature based on companion/business
  if (data.companion === "negocio") {
    recommendations.push({
      title: "Separación de Cuentas",
      desc: "Diferencia fácilmente tus gastos personales de los de tu negocio en un solo lugar.",
      icon: "💼",
      color: "from-amber-500/20 to-yellow-500/20",
    });
  } else if (data.companion === "pareja" || data.companion === "familia") {
    recommendations.push({
      title: "Finanzas Compartidas",
      desc: "Invita a tu pareja o familia para llevar un presupuesto común sin complicaciones.",
      icon: "👨‍👩‍👧‍👦",
      color: "from-pink-500/20 to-rose-500/20",
    });
  }

  // 3. Complexity based
  if (data.complexity === "monedas") {
    recommendations.push({
      title: "Multi-moneda Inteligente",
      desc: "Conversión automática a tu moneda principal para tener una visión global de tu saldo.",
      icon: "💱",
      color: "from-violet-500/20 to-purple-500/20",
    });
  }

  // Ensure at least 2 recommendations
  if (recommendations.length < 2) {
    recommendations.push({
      title: "Presupuestos Dinámicos",
      desc: "Ajusta tus límites mes a mes según tu realidad financiera actual.",
      icon: "📈",
      color: "from-cyan-500/20 to-sky-500/20",
    });
  }

  return (
    <div className="w-full space-y-5">
      <div className="bg-white/5 p-6 rounded-[32px] border border-white/10 backdrop-blur-xl shadow-2xl relative overflow-hidden text-center">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-violet-500 to-transparent opacity-50" />
        <h3 className="text-xl font-bold text-white mb-2">{t("recommendationsTitle")}</h3>
        <p className="text-sm text-zinc-400">
          {t("recommendationsSubtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {recommendations.slice(0, 3).map((rec, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className={cn(
              "p-5 rounded-3xl border border-white/10 bg-gradient-to-br backdrop-blur-md flex items-start gap-4 group hover:scale-[1.02] transition-all duration-300",
              rec.color
            )}
          >
            <div className="w-12 h-12 rounded-2xl bg-black/30 flex items-center justify-center text-2xl shadow-inner group-hover:bg-black/50 transition-colors">
              {rec.icon}
            </div>
            <div className="flex-1">
              <h4 className="text-white font-bold text-sm mb-1">{rec.title}</h4>
              <p className="text-zinc-400 text-xs leading-relaxed">{rec.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <Button 
        onClick={onFinish} 
        disabled={loading}
        className="w-full bg-violet-600 hover:bg-violet-500 text-white h-16 rounded-[24px] text-lg font-bold shadow-[0_10px_30px_-10px_rgba(124,58,237,0.5)] hover:shadow-[0_15px_40px_-10px_rgba(124,58,237,0.6)] transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
      >
        {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
          <>
            Continuar
            <span className="text-2xl">→</span>
          </>
        )}
      </Button>
    </div>
  );
}

function CountryCurrencySelector({ onSelect }: { onSelect: (country: string, currency: string) => void }) {
  const t = useTranslations("Onboarding");
  const [country, setCountry] = useState("PE");
  const [currency, setCurrency] = useState("PEN");

  useEffect(() => {
    const detectLocale = async () => {
      try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        
        if (data.country_code) {
          setCountry(data.country_code);
          const found = WORLD_COUNTRIES.find(x => x.code === data.country_code);
          if (found && found.code !== "OTHER") {
            setCurrency(found.currency);
          }
          return;
        }
      } catch (e) {
        console.warn("IP-based geo-detection failed, falling back to local detection", e);
      }

      try {
        const lang = navigator.language || (navigator as any).userLanguage;
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        
        // Simple mapping based on common locales and timezones
        if (lang.includes("PE") || timezone.includes("Lima")) {
          setCountry("PE"); setCurrency("PEN");
        } else if (lang.includes("AR") || timezone.includes("Buenos_Aires")) {
          setCountry("AR"); setCurrency("ARS");
        } else if (lang.includes("CO") || timezone.includes("Bogota")) {
          setCountry("CO"); setCurrency("COP");
        } else if (lang.includes("MX") || timezone.includes("Mexico_City")) {
          setCountry("MX"); setCurrency("MXN");
        } else if (lang.includes("CL") || timezone.includes("Santiago")) {
          setCountry("CL"); setCurrency("CLP");
        } else if (lang.includes("ES") || timezone.includes("Madrid")) {
          setCountry("ES"); setCurrency("EUR");
        } else if (lang.includes("BR") || timezone.includes("Sao_Paulo")) {
          setCountry("BR"); setCurrency("BRL");
        }
      } catch (e) {
        console.error("Local geo-detection failed", e);
      }
    };
    detectLocale();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="bg-white/5 backdrop-blur-md p-6 rounded-[28px] border border-white/10 rounded-tl-sm w-full max-w-[95%] shadow-2xl relative overflow-hidden group">
      {/* Glow effect */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-violet-600/10 blur-[60px] rounded-full pointer-events-none group-hover:bg-violet-600/20 transition-all duration-500" />
      
      <p className="text-white mb-6 text-sm font-semibold tracking-wide flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
        {t("countryCurrencyTitle")}
      </p>
      
      <div className="space-y-5 mb-7">
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-[0.1em] text-zinc-500 font-bold ml-1">Tu país</label>
          <GlassCombobox
            value={country}
            onChange={(c) => {
              setCountry(c);
              const found = WORLD_COUNTRIES.find(x => x.code === c);
              if (found && found.code !== "OTHER") setCurrency(found.currency);
            }}
            options={WORLD_COUNTRIES.map(c => ({
              value: c.code,
              label: `${c.flag} ${c.name}`
            }))}
            className="rounded-2xl h-[52px]"
          />
        </div>
        
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-[0.1em] text-zinc-500 font-bold ml-1">Tu moneda principal</label>
          <GlassCombobox
            value={currency}
            onChange={setCurrency}
            options={WORLD_CURRENCIES.map(curr => ({
              value: curr.code,
              label: `${curr.code} - ${curr.name}`
            }))}
            className="rounded-2xl h-[52px]"
          />
        </div>
      </div>

      <Button 
        onClick={() => onSelect(country, currency)}
        className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold h-12 rounded-2xl shadow-[0_8px_20px_-6px_rgba(124,58,237,0.4)] hover:shadow-[0_12px_25px_-4px_rgba(124,58,237,0.5)] transition-all active:scale-[0.98]"
      >
        {t("confirmData")}
      </Button>
    </div>
  );
}

function WhatsAppLinker({ onLinked, onSkip }: { onLinked: () => void, onSkip: () => void }) {
  const [loading, setLoading] = useState(true);
  const [waCode, setWaCode] = useState<string | null>(null);
  const [waLink, setWaLink] = useState<string | null>(null);
  const [isLinked, setIsLinked] = useState(false);

  useEffect(() => {
    let mounted = true;
    apiJson('/api/integrations/whatsapp/link', { method: 'POST' })
      .then((res) => {
        if (mounted && res?.ok) {
          setWaCode(res.data?.code);
          setWaLink(res.data?.waMe);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (isLinked) return;
    const intervalId = setInterval(async () => {
      try {
        const res = await apiJson('/api/integrations/whatsapp/status', { cache: 'no-store' });
        if (res.data?.linked) {
          setIsLinked(true);
          clearInterval(intervalId);
          setTimeout(() => {
            onLinked();
          }, 2000);
        }
      } catch (e) {
        // silent fail for polling
      }
    }, 3000);
    return () => clearInterval(intervalId);
  }, [isLinked, onLinked]);

  if (isLinked) {
    return (
      <div className="bg-white/5 backdrop-blur-md p-6 rounded-[28px] border border-white/10 rounded-tl-sm w-full max-w-[95%] shadow-2xl flex flex-col items-center justify-center space-y-4">
        <div className="w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center">
          <span className="text-3xl">✓</span>
        </div>
        <h3 className="text-xl font-bold text-white text-center">¡Conexión Exitosa!</h3>
      </div>
    );
  }

  return (
    <div className="bg-white/5 backdrop-blur-md p-6 rounded-[28px] border border-white/10 rounded-tl-sm w-full max-w-[95%] shadow-2xl relative overflow-hidden">
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#25D366]/10 blur-[60px] rounded-full pointer-events-none" />
      
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-[#25D366]/20 text-[#25D366] rounded-full flex items-center justify-center text-xl">
          💬
        </div>
        <h3 className="text-white font-bold text-lg">Vincular WhatsApp</h3>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-10 space-y-3">
          <Loader2 className="w-8 h-8 text-[#25D366] animate-spin" />
          <p className="text-sm text-zinc-400">Generando código seguro...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center text-center space-y-5">
          <p className="text-sm text-zinc-300">
            Escanea este código QR con tu cámara o toca el botón si estás en tu móvil.
          </p>

          {waLink && (
            <div className="bg-white p-3 rounded-2xl shadow-lg">
              <QRCode value={waLink} size={160} fgColor="#000" bgColor="#fff" />
            </div>
          )}

          <div className="bg-black/30 border border-white/10 px-4 py-2 rounded-xl font-mono text-xl font-bold tracking-widest text-white">
            {waCode}
          </div>

          <div className="flex flex-col w-full gap-3 mt-2">
            {waLink && (
              <a 
                href={waLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white py-3 rounded-xl font-bold text-sm shadow-[0_8px_20px_-6px_rgba(37,211,102,0.4)] transition-all flex justify-center items-center gap-2"
              >
                Abrir WhatsApp
              </a>
            )}
            <button 
              onClick={onSkip}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Hacerlo más tarde
            </button>
          </div>
          
          <div className="flex items-center gap-2 text-xs text-zinc-500 animate-pulse mt-2">
            <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full" />
            Esperando conexión...
          </div>
        </div>
      )}
    </div>
  );
}

function ProIncentive({ onBuy, onSkip, loading }: { onBuy: (plan: string) => void, onSkip: () => void, loading: boolean }) {
  const [confirmPlan, setConfirmPlan] = useState<'MONTHLY' | 'ANNUAL' | null>(null);

  const handlePlanClick = (plan: 'MONTHLY' | 'ANNUAL') => {
    if (!loading) setConfirmPlan(plan);
  };

  return (
    <div className="bg-white/10 backdrop-blur-2xl p-7 rounded-[32px] border border-white/20 w-full max-w-[95%] shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute -top-32 -right-32 w-64 h-64 bg-amber-500/20 blur-[80px] rounded-full pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-violet-500/20 blur-[80px] rounded-full pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
      
      <AnimatePresence>
        {confirmPlan && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute inset-0 z-50 flex items-center justify-center p-5 bg-black/60 backdrop-blur-md rounded-[32px]"
          >
            <div className="bg-[#0f0f13]/90 border border-white/20 p-6 rounded-[24px] w-full max-w-sm shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col text-center backdrop-blur-xl relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-violet-500 to-fuchsia-500" />
              <div className="w-14 h-14 bg-violet-500/10 text-violet-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-violet-500/20 shadow-inner">
                <Image src="/pricing-plan-icon.png" alt="Pro" width={28} height={28} className="drop-shadow-lg" />
              </div>
              <h4 className="text-xl font-bold text-white mb-2">Confirmar Suscripción</h4>
              <p className="text-sm text-zinc-300 mb-6 leading-relaxed">
                Estás a un paso de ser PRO. Tu plan <strong className="text-white text-base">{confirmPlan === 'MONTHLY' ? 'Mensual (S/ 18)' : 'Anual (S/ 120)'}</strong> se activará de inmediato.
              </p>
              
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => onBuy(confirmPlan)}
                  disabled={loading}
                  className="w-full bg-violet-600 hover:bg-violet-500 text-white font-semibold py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(124,58,237,0.4)] hover:shadow-[0_0_30px_rgba(124,58,237,0.6)] flex justify-center items-center gap-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Activar Plan"}
                </button>
                <button
                  onClick={() => setConfirmPlan(null)}
                  disabled={loading}
                  className="w-full bg-white/5 hover:bg-white/10 text-zinc-300 font-medium py-3 rounded-xl transition-all border border-transparent hover:border-white/10"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-4 mb-6 relative z-10">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-white/5 border border-white/10 shadow-inner">
          <Image src="/pricing-plan-icon.png" alt="Pro Plan" width={32} height={32} className="drop-shadow-lg" />
        </div>
        <div>
          <h3 className="text-white font-bold text-2xl tracking-tight">Desbloquea Todo Ilimitado</h3>
          <p className="text-sm text-zinc-300">Puedes usar ContaPRO gratis, pero con límites.</p>
        </div>
      </div>

      <div className="space-y-4 mb-7 relative z-10 bg-black/20 p-5 rounded-2xl border border-white/5">
        <ul className="text-sm text-zinc-200 space-y-3">
          <li className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-xs shadow-[0_0_10px_rgba(16,185,129,0.2)]">✓</div>
            <span>Gastos y cuentas <strong className="text-white">ilimitadas</strong></span>
          </li>
          <li className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-xs shadow-[0_0_10px_rgba(16,185,129,0.2)]">✓</div>
            <span>Presupuestos y categorías <strong className="text-white">sin límites</strong></span>
          </li>
          <li className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-xs shadow-[0_0_10px_rgba(16,185,129,0.2)]">✓</div>
            <span>Lectura de facturas <strong className="text-white">avanzada con IA</strong></span>
          </li>
        </ul>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 relative z-10">
        {/* Monthly Card */}
        <div 
          onClick={() => handlePlanClick('MONTHLY')}
          className="relative group cursor-pointer bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-[24px] p-5 transition-all duration-300 backdrop-blur-md shadow-lg hover:shadow-xl"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-[24px] opacity-0 group-hover:opacity-100 transition-opacity" />
          <h4 className="text-zinc-300 font-medium mb-1 text-sm uppercase tracking-wider">PRO Mensual</h4>
          <div className="flex items-end gap-1 mb-4">
            <span className="text-3xl font-black text-white">S/ 18</span>
            <span className="text-sm text-zinc-400 mb-1">/mes</span>
          </div>
          <button 
            disabled={loading}
            className="w-full bg-white/10 group-hover:bg-white/20 text-white font-medium py-3 rounded-xl transition-colors text-sm flex justify-center items-center gap-2 border border-white/5"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Elegir Mensual"}
          </button>
        </div>

        {/* Annual Card */}
        <div 
          onClick={() => handlePlanClick('ANNUAL')}
          className="relative group cursor-pointer bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/40 hover:border-violet-400/60 rounded-[24px] p-5 transition-all duration-300 backdrop-blur-md shadow-[0_0_30px_rgba(124,58,237,0.15)] hover:shadow-[0_0_40px_rgba(124,58,237,0.25)] overflow-hidden"
        >
          <div className="absolute top-0 right-0 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl shadow-lg z-10">
            AHORRA S/ 96
          </div>
          <div className="absolute inset-0 bg-gradient-to-br from-violet-400/10 to-transparent rounded-[24px] opacity-0 group-hover:opacity-100 transition-opacity" />
          
          <h4 className="text-violet-200 font-medium mb-1 text-sm uppercase tracking-wider">PRO Anual</h4>
          <div className="flex items-end gap-1 mb-4">
            <span className="text-3xl font-black text-white">S/ 120</span>
            <span className="text-sm text-violet-300/70 mb-1">/año</span>
          </div>
          <button 
            disabled={loading}
            className="w-full bg-violet-600 hover:bg-violet-500 shadow-[0_0_20px_rgba(124,58,237,0.4)] text-white font-semibold py-3 rounded-xl transition-all duration-300 text-sm flex justify-center items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Elegir Anual"}
          </button>
        </div>
      </div>

      <div className="flex justify-center relative z-10">
        <button 
          onClick={onSkip}
          disabled={loading}
          className="text-xs font-medium text-zinc-400 hover:text-white transition-colors py-2 px-5 rounded-full hover:bg-white/10 disabled:opacity-50"
        >
          Por ahora no, usar gratis con límites
        </button>
      </div>
    </div>
  );
}
