"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter, Link } from "@/i18n/routing";
import Image from "next/image";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, ArrowRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiJson, invalidateApiCache } from "@/lib/api";
import FaultyTerminalBackground from "@/components/FaultyTerminal";

const TERMINAL_GRID_MUL: [number, number] = [2, 2];

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#050505] text-white">Cargando...</div>}>
      <SuccessContent />
    </Suspense>
  );
}

function SuccessContent() {
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get('session_id');
  
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [user, setUser] = useState<{ plan?: string; planExpires?: string | null } | null>(null);
  const [countdown, setCountdown] = useState(9);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 3500); // 3.5 seconds total splash time
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    let attempts = 0;

    const checkStatus = async () => {
      invalidateApiCache("/api/auth/me");
      const res = await apiJson<{ ok: boolean; user: { plan?: string; planExpires?: string | null } }>("/api/auth/me");
      if (res.ok && res.data?.user) {
        setUser(res.data.user);
        if (['PREMIUM', 'LIFETIME', 'ANNUAL', 'MONTHLY'].includes(res.data.user.plan || '')) {
          setVerified(true);
          setLoading(false);
          clearInterval(interval);
        }
      }
      attempts++;
      if (attempts > 10) { // Stop polling after 20s
        setLoading(false);
        clearInterval(interval);
      }
    };

    if (sessionId) {
      checkStatus();
      interval = setInterval(checkStatus, 2000);
    } else {
      setLoading(false);
    }

    return () => clearInterval(interval);
  }, [sessionId]);

  // Countdown effect
  useEffect(() => {
    if (loading) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [loading]);

  // Redirect when countdown reaches 0
  useEffect(() => {
    if (countdown === 0) {
      router.push('/dashboard');
    }
  }, [countdown, router]);

  const fmtDate = (iso?: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("es-PE");
  };

  return (
    <div className="relative min-h-svh w-full overflow-hidden flex flex-col items-center justify-center text-white bg-[#050505]">
      {/* Background Ambience */}
      <div className="absolute inset-0 w-full h-full pointer-events-none z-0 opacity-40">
        <FaultyTerminalBackground 
          tint="#4c1d95" 
          gridMul={TERMINAL_GRID_MUL}
          brightness={0.6}
          scanlineIntensity={0.2}
          flickerAmount={0}
          glitchAmount={0.5}
        />
      </div>

      {/* Floating 3D Images */}
      <motion.div
        className="absolute top-[10%] right-[10%] w-32 h-32 md:w-48 md:h-48 cursor-pointer z-0"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 0.8, scale: 1 }}
        whileHover={{ scale: 1.1, rotate: -10 }}
        transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
      >
        <motion.div
          className="w-full h-full"
          animate={{ 
            y: [0, -15, 0], 
            rotate: [0, 5, 0] 
          }}
          transition={{ 
            duration: 5, 
            repeat: Infinity, 
            ease: "easeInOut" 
          }}
        >
          <Image 
            src="/GRAFICO 3D.png" 
            alt="Graph 3D" 
            width={200} 
            height={200} 
            className="object-contain"
          />
        </motion.div>
      </motion.div>

      <motion.div
        className="absolute bottom-[10%] left-[5%] w-28 h-28 md:w-40 md:h-40 cursor-pointer z-0"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 0.8, scale: 1 }}
        whileHover={{ scale: 1.1, rotate: 10 }}
        transition={{ duration: 0.8, ease: "easeOut", delay: 0.4 }}
      >
        <motion.div
          className="w-full h-full"
          animate={{ 
            y: [0, 15, 0], 
            rotate: [0, -5, 0] 
          }}
          transition={{ 
            duration: 6, 
            repeat: Infinity, 
            ease: "easeInOut",
            delay: 1
          }}
        >
          <Image 
            src="/CHAT 3D.png" 
            alt="Chat 3D" 
            width={180} 
            height={180} 
            className="object-contain"
          />
        </motion.div>
      </motion.div>

      <div className="fixed top-6 left-6 z-10">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white transition-colors">
          <ChevronLeft className="h-4 w-4" />
          Home
        </Link>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-lg px-6"
      >
        <div className="flex flex-col items-center text-center">
          {/* Icono de éxito */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{
              type: "spring",
              stiffness: 260,
              damping: 20,
              delay: 0.2
            }}
            className="w-24 h-24 mx-auto mb-6 relative"
          >
            <div className="absolute inset-0 bg-green-500/20 rounded-full blur-xl animate-pulse" />
            <div className="relative w-full h-full bg-black/50 rounded-full border border-green-500/30 flex items-center justify-center p-4 shadow-lg shadow-green-900/20">
              <img 
                src="/pricing-plan-icon.png" 
                alt="Success" 
                className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(34,197,94,0.5)]"
              />
            </div>
          </motion.div>

          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            ¡Compra confirmada!
          </h1>
          <p className="text-zinc-400 text-lg mb-8 max-w-md">
            Gracias por tu compra. Tu suscripción ha sido activada y se te enviará un comprobante a tu email en unos instantes.
          </p>

          <div className="w-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-xl mb-8">
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-white/10 pb-3">
                <span className="text-zinc-400">Plan</span>
                <span className="font-semibold text-white uppercase tracking-wider bg-white/10 px-2 py-1 rounded text-sm">
                  {user?.plan || '...'}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-white/10 pb-3">
                <span className="text-zinc-400">Vencimiento</span>
                <span className="font-mono text-zinc-200">{fmtDate(user?.planExpires)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Estado</span>
                <span className={`flex items-center gap-2 ${loading ? "text-yellow-500" : verified ? "text-green-500" : "text-orange-400"}`}>
                  {loading ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="text-sm">Verificando...</span>
                    </>
                  ) : verified ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" />
                      <span className="text-sm">Activo</span>
                    </>
                  ) : (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="text-sm">Procesando pago...</span>
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4 w-full">
            <Button 
              asChild 
              className="w-full h-12 rounded-full bg-white text-black hover:bg-zinc-200 font-medium text-base transition-all"
            >
              <Link href="/dashboard">
                <span className="inline-flex items-center gap-2">
                  Ir al Dashboard
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            </Button>
            
            {!loading && (
              <p className="text-sm text-zinc-500 animate-pulse">
                Redirigiendo en {countdown}s...
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
