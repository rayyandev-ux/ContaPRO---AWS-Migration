"use client";

import { useEffect, useState } from "react";
import GmailLinkCard from "@/components/GmailLinkCard";
import OutlookLinkCard from "@/components/OutlookLinkCard";
import BuyExtraEmailButton from "./BuyExtraEmailButton";
import { apiJson } from "@/lib/api";
import { 
  Mail, 
  Sparkles, 
  LayoutGrid, 
  Info, 
  Loader2,
  Plus,
  Zap,
  ShieldCheck,
  CheckCircle2
} from "lucide-react";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import { motion, AnimatePresence } from "framer-motion";
import { UpgradePromptDialog } from "../../_components/UpgradePromptDialog";

export default function EmailsIntegrationPage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [status, setStatus] = useState<any>(null);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [meRes, statusRes] = await Promise.all([
        apiJson("/api/auth/me", { cache: "no-store" }),
        apiJson("/api/proxy/integrations/emails/status"),
      ]);

      if (meRes.ok) setUser(meRes.data.user);
      if (statusRes.ok) setStatus(statusRes.data);
    } catch (err) {
      console.error("Error al cargar datos de correos", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Escuchar eventos de mutación para recarga instantánea (Realtime)
    if (typeof window !== 'undefined') {
      const bc = new BroadcastChannel('contapro:mutated');
      const handleMessage = (e: MessageEvent) => {
        if (e.data === 'realtime_mutation' || e.data === 'updated' || e.data === 'deleted') {
          fetchData();
        }
      };
      bc.addEventListener('message', handleMessage);
      return () => {
        bc.removeEventListener('message', handleMessage);
        bc.close();
      };
    }
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-8">
        <Loader2 className="h-12 w-12 text-white/20 animate-spin" />
        <p className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-black">Sincronizando Integraciones...</p>
      </div>
    );
  }

  const extraSlots = user?.extraEmailSlots || 0;
  const totalSlots = 1 + extraSlots;
  const usedSlots = status?.count || 0;

  const isPremium = user?.plan === 'PREMIUM' && user?.planExpires && new Date(user.planExpires) > new Date();
  const isLifetime = user?.plan === 'LIFETIME';
  const hasTrial = user?.trialEnds && new Date(user.trialEnds) > new Date();
  const hasFullAccess = isPremium || isLifetime || hasTrial;

  return (
    <section className="space-y-6 max-w-[1600px] w-full mx-auto px-6 md:px-8 xl:px-12 py-6 md:py-8 lg:py-10">
      <RealtimeRefresh />
      <UpgradePromptDialog open={showUpgradePrompt} onOpenChange={setShowUpgradePrompt} />
      
      <div className="bg-white/10 backdrop-blur-2xl shadow-2xl border border-white/20 rounded-2xl overflow-hidden mt-6">
        <div className="px-8 pt-8 pb-6 border-b border-white/10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-5xl md:text-6xl font-playfair font-bold tracking-tight text-white mb-2 italic">Correos</h1>
              <p className="text-white/40 text-lg font-medium">Automatiza tus gastos vinculando tus bandejas de entrada.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <BuyExtraEmailButton />
            </div>
          </div>
        </div>

        <div className="relative px-8 py-10">
          {!hasFullAccess && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/40 backdrop-blur-md rounded-b-2xl">
              <div className="p-8 text-center space-y-4 max-w-md">
                <div className="mx-auto h-16 w-16 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                  <Mail className="h-8 w-8 text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold text-white font-playfair">Integración Premium</h2>
                <p className="text-white/60 text-sm">Necesitas un plan activo para poder vincular tus correos y automatizar la lectura de facturas.</p>
                <button 
                  onClick={() => setShowUpgradePrompt(true)}
                  className="mt-4 px-6 py-3 bg-white text-black font-bold rounded-full text-xs uppercase tracking-widest hover:bg-white/90 transition-colors"
                >
                  Ver Planes
                </button>
              </div>
            </div>
          )}

          <div className={`grid grid-cols-1 lg:grid-cols-12 gap-10 ${!hasFullAccess ? 'opacity-30 pointer-events-none select-none' : ''}`}>
            {/* Columna Izquierda: Integraciones */}
            <div className="lg:col-span-8 space-y-10">
              <section className="space-y-6">
                <div className="flex items-center gap-3 px-2">
                  <LayoutGrid className="h-5 w-5 text-white/40" />
                  <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/60">Proveedores Soportados</h2>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <GmailLinkCard maxSlots={totalSlots} />
                  <OutlookLinkCard maxSlots={totalSlots} />
                </div>
              </section>

              {/* Info Adicional */}
              <section className="space-y-4">
                <div className="flex items-center gap-3 px-2">
                  <ShieldCheck className="h-5 w-5 text-white/40" />
                  <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/60">Seguridad y Protocolo</h2>
                </div>
                
                <div className="p-8 rounded-[2.5rem] bg-white/[0.03] border border-white/10 backdrop-blur-3xl overflow-hidden group transition-all duration-700 hover:bg-white/[0.05]">
                  <div className="flex flex-col md:flex-row gap-8 items-center">
                    <div className="h-20 w-20 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shrink-0">
                      <Zap className="h-10 w-10 text-emerald-400" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-white font-bold text-lg">Análisis Inteligente AES-256</p>
                      <p className="text-white/40 text-sm leading-relaxed">
                        Tus datos están protegidos con encriptación de grado militar. Solo leemos los correos que tú autorices mediante los remitentes permitidos para extraer exclusivamente información financiera.
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* Columna Derecha: Estado y Guía */}
            <div className="lg:col-span-4 space-y-10">
              {/* Card de Capacidad */}
              <section className="space-y-4">
                <div className="flex items-center gap-3 px-2">
                  <Sparkles className="h-5 w-5 text-white/40" />
                  <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/60">Capacidad</h2>
                </div>

                <div className="p-8 rounded-[2.5rem] bg-white/[0.03] border border-white/10 backdrop-blur-3xl shadow-2xl">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-white/60 uppercase tracking-widest">Espacios en Uso</p>
                      <span className="text-2xl font-black text-white">{usedSlots}<span className="text-sm text-white/20 font-medium">/{totalSlots}</span></span>
                    </div>
                    
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(usedSlots / totalSlots) * 100}%` }}
                        className="h-full bg-gradient-to-r from-emerald-500 to-blue-500"
                      />
                    </div>

                    <div className="grid grid-cols-5 gap-1.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div 
                          key={i} 
                          className={`h-1.5 rounded-full transition-all duration-500 ${
                            i < totalSlots 
                              ? (i < usedSlots ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-white/10') 
                              : 'bg-white/5'
                          }`} 
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              {/* Guía de Uso */}
              <section className="space-y-4">
                <div className="flex items-center gap-3 px-2">
                  <Info className="h-5 w-5 text-white/40" />
                  <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/60">Información</h2>
                </div>

                <div className="p-8 rounded-[2.5rem] bg-white/[0.03] border border-white/10 backdrop-blur-3xl space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="h-6 w-6 rounded-full bg-white/5 flex items-center justify-center shrink-0 border border-white/10 mt-1">
                        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                      </div>
                      <p className="text-xs text-white/60 leading-relaxed">
                        Sincronización automática cada 5 minutos.
                      </p>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="h-6 w-6 rounded-full bg-white/5 flex items-center justify-center shrink-0 border border-white/10 mt-1">
                        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                      </div>
                      <p className="text-xs text-white/60 leading-relaxed">
                        Detección de Yape, Plin, Bancos y Servicios Digitales.
                      </p>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="h-6 w-6 rounded-full bg-white/5 flex items-center justify-center shrink-0 border border-white/10 mt-1">
                        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                      </div>
                      <p className="text-xs text-white/60 leading-relaxed">
                        Categorización inteligente mediante IA.
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-8 text-center">
        <p className="text-[10px] font-bold text-white/10 uppercase tracking-[0.3em]">ContaPRO Security Protocol • AES-256 Encryption</p>
      </div>
    </section>
  );
}
