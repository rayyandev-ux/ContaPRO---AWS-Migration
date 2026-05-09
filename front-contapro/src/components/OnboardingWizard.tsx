'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Check, ArrowRight, MessageSquare, Smartphone, Send, Camera, Mic, 
  Receipt, PieChart, PiggyBank, Search, Trash2, Edit3, Wallet, Tag, RefreshCw 
} from 'lucide-react';
import { apiJson } from '@/lib/api';
import Image from 'next/image';

type Props = {
  onComplete: () => void;
  userName?: string | null;
};

type IntegrationStatus = {
  whatsapp: boolean;
  telegram: boolean;
};

export default function OnboardingWizard({ onComplete, userName }: Props) {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [tutorialTab, setTutorialTab] = useState(0);
  const [integrationMethod, setIntegrationMethod] = useState<'whatsapp' | 'telegram' | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Data de integración
  const [waCode, setWaCode] = useState<string | null>(null);
  const [waLink, setWaLink] = useState<string | null>(null);
  const [tgLink, setTgLink] = useState<string | null>(null);
  
  const [isLinked, setIsLinked] = useState(false);

  // Paso 0: Bienvenida
  // Paso 1: Integración (Obligatoria)
  // Paso 2: Educación

  // Polling para verificar integración
  useEffect(() => {
    if (step !== 1) return;
    if (isLinked) return; // Ya estamos listos

    let intervalId: NodeJS.Timeout;

    const checkStatus = async () => {
      try {
        // Verificar ambos en paralelo sin caché
        const [waRes, tgRes] = await Promise.all([
          apiJson('/api/integrations/whatsapp/status', { cache: 'no-store' }),
          apiJson('/api/integrations/telegram/status', { cache: 'no-store' })
        ]);
        
        if (waRes.data?.linked || tgRes.data?.linked) {
          setIsLinked(true);
          // Opcional: Auto-avanzar después de un momento
          // setTimeout(() => setStep(2), 1500);
        }
      } catch (e) {
        console.error('Error checking status', e);
      }
    };

    // Chequear inmediatamente y luego cada 3s
    checkStatus();
    intervalId = setInterval(checkStatus, 3000);

    return () => clearInterval(intervalId);
  }, [step, isLinked]);

  // Cargar códigos al entrar al paso 1
  useEffect(() => {
    if (step === 1 && !waCode && !tgLink) {
      setLoading(true);
      Promise.all([
        apiJson('/api/integrations/whatsapp/link', { method: 'POST' }).catch(() => null),
        apiJson('/api/integrations/telegram/link', { method: 'POST' }).catch(() => null)
      ]).then(([waData, tgData]) => {
        if (waData?.ok) {
          setWaCode(waData.data?.code);
          setWaLink(waData?.data?.waMe || null);
        }
        if (tgData?.ok) {
          setTgLink(tgData?.data?.deepLink || null);
        }
        setLoading(false);
      });
    }
  }, [step, waCode, tgLink]);

  const handleFinish = async () => {
    try {
      await apiJson('/api/auth/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ tutorialSeen: true }),
      });
    } catch (e) {
      console.error('Failed to update preferences', e);
    }
    onComplete();
  };

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 50 : -50,
      opacity: 0
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 50 : -50,
      opacity: 0
    })
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header con Progreso */}
        <div className="h-2 bg-muted w-full">
          <motion.div 
            className="h-full bg-primary"
            initial={{ width: '0%' }}
            animate={{ width: step === 0 ? '33%' : step === 1 ? '66%' : '100%' }}
            transition={{ duration: 0.5 }}
          />
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-10 relative min-h-[400px]">
          <AnimatePresence mode="wait">
            
            {/* STEP 0: BIENVENIDA */}
            {step === 0 && (
              <motion.div
                key="step0"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center text-center space-y-6"
              >
                <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <span className="text-4xl">👋</span>
                </div>
                
                <h2 className="text-3xl font-bold tracking-tight">
                  ¡Bienvenido a ContaPRO{userName ? `, ${userName}` : ''}!
                </h2>
                
                <p className="text-lg text-muted-foreground max-w-md">
                  Olvídate de ingresar datos manualmente. Tu contador inteligente vive en tu chat favorito.
                  Vamos a conectarlo para empezar.
                </p>

                <div className="pt-8">
                  <button 
                    onClick={() => setStep(1)}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 px-8 py-3 rounded-full font-medium text-lg flex items-center gap-2 transition-all transform hover:scale-105"
                  >
                    Conectar mi Asistente <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 1: INTEGRACIÓN */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className="flex flex-col h-full"
              >
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold mb-2">Activa tu Llave de Acceso</h2>
                  <p className="text-muted-foreground">
                    Elige tu aplicación de mensajería preferida para continuar.
                  </p>
                </div>

                {isLinked ? (
                  <div className="flex flex-col items-center justify-center flex-1 space-y-6 py-10">
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring" }}
                      className="w-24 h-24 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center"
                    >
                      <Check className="w-12 h-12" strokeWidth={3} />
                    </motion.div>
                    <h3 className="text-2xl font-bold text-green-600 dark:text-green-400">¡Conexión Exitosa!</h3>
                    <p className="text-muted-foreground">Tu asistente está listo para recibir gastos.</p>
                    
                    <button 
                      onClick={() => setStep(2)}
                      className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90 px-8 py-3 rounded-full font-medium flex items-center gap-2 animate-pulse"
                    >
                      Continuar <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4 flex-1">
                    {/* WhatsApp Card */}
                    <div 
                      className={`relative border-2 rounded-xl p-6 cursor-pointer transition-all hover:border-primary/50 flex flex-col items-center text-center space-y-4 ${integrationMethod === 'whatsapp' ? 'border-primary bg-primary/5' : 'border-border'}`}
                      onClick={() => setIntegrationMethod('whatsapp')}
                    >
                      <div className="w-12 h-12 bg-[#25D366]/10 text-[#25D366] rounded-full flex items-center justify-center">
                        <MessageSquare className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">WhatsApp</h3>
                        <p className="text-sm text-muted-foreground">Recomendado</p>
                      </div>
                      
                      {integrationMethod === 'whatsapp' && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="w-full pt-4 border-t border-border/50"
                        >
                          {loading ? (
                            <div className="py-4 text-sm text-muted-foreground">Generando código...</div>
                          ) : (
                            <>
                              <div className="bg-background border border-border rounded-lg p-3 font-mono text-2xl font-bold tracking-widest mb-3 select-all">
                                {waCode}
                              </div>
                              <p className="text-xs text-muted-foreground mb-4">
                                Envía este código a nuestro bot
                              </p>
                              {waLink ? (
                                <a 
                                  href={waLink} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="w-full block bg-[#25D366] hover:bg-[#20bd5a] text-white py-2 rounded-md font-medium text-sm"
                                >
                                  Abrir WhatsApp
                                </a>
                              ) : (
                                <button disabled className="w-full block bg-muted text-muted-foreground py-2 rounded-md font-medium text-sm cursor-not-allowed">
                                  Preparando enlace...
                                </button>
                              )}
                            </>
                          )}
                        </motion.div>
                      )}
                    </div>

                    {/* Telegram Card */}
                    <div 
                      className={`relative border-2 rounded-xl p-6 cursor-pointer transition-all hover:border-primary/50 flex flex-col items-center text-center space-y-4 ${integrationMethod === 'telegram' ? 'border-primary bg-primary/5' : 'border-border'}`}
                      onClick={() => setIntegrationMethod('telegram')}
                    >
                      <div className="w-12 h-12 bg-[#0088cc]/10 text-[#0088cc] rounded-full flex items-center justify-center">
                        <Send className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">Telegram</h3>
                        <p className="text-sm text-muted-foreground">Rápido y Seguro</p>
                      </div>

                      {integrationMethod === 'telegram' && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="w-full pt-4 border-t border-border/50"
                        >
                          {loading ? (
                            <div className="py-4 text-sm text-muted-foreground">Cargando...</div>
                          ) : (
                            <>
                              <p className="text-xs text-muted-foreground mb-4">
                                Inicia el bot para vincular tu cuenta
                              </p>
                              <a 
                                href={tgLink || '#'} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="w-full block bg-[#0088cc] hover:bg-[#0077b5] text-white py-2 rounded-md font-medium text-sm"
                              >
                                Abrir Telegram
                              </a>
                            </>
                          )}
                        </motion.div>
                      )}
                    </div>
                  </div>
                )}
                
                {!isLinked && (
                  <div className="mt-6 text-center">
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground animate-pulse">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                      Esperando conexión...
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* STEP 2: EDUCACIÓN */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className="flex flex-col h-full"
              >
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold mb-1">Aprende a usar tu Asistente 🧠</h2>
                  <p className="text-muted-foreground text-sm">
                    Todo se maneja desde el chat. Aquí tienes los comandos clave.
                  </p>
                </div>

                {/* TABS NAVIGATION */}
                <div className="flex justify-center gap-2 mb-6 bg-muted/30 p-1 rounded-xl w-fit mx-auto">
                  {[
                    { icon: Receipt, label: 'Gastos' },
                    { icon: PieChart, label: 'Plan' },
                    { icon: Edit3, label: 'Gestión' },
                    { icon: Search, label: 'Consultas' },
                  ].map((tab, idx) => (
                    <button
                      key={idx}
                      onClick={() => setTutorialTab(idx)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        tutorialTab === idx 
                          ? 'bg-primary text-primary-foreground shadow-sm' 
                          : 'hover:bg-muted text-muted-foreground'
                      }`}
                    >
                      <tab.icon className="w-4 h-4" />
                      <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                  ))}
                </div>

                {/* CONTENT AREA */}
                <div className="flex-1 overflow-y-auto px-1">
                  <AnimatePresence mode="wait">
                    {tutorialTab === 0 && (
                      <motion.div 
                        key="tab0"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-4"
                      >
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
                          <h3 className="font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-2 mb-3">
                            <Receipt className="w-5 h-5" /> Registrar Gastos
                          </h3>
                          <ul className="space-y-3 text-sm">
                            <li className="flex items-start gap-3">
                              <span className="bg-white dark:bg-black/20 p-1.5 rounded text-xs font-mono">📝 Texto</span>
                              <span>"Almuerzo 15 soles" o "Taxi 20"</span>
                            </li>
                            <li className="flex items-start gap-3">
                              <span className="bg-white dark:bg-black/20 p-1.5 rounded text-xs font-mono">📸 Foto</span>
                              <span>Envía una foto de tu factura o voucher.</span>
                            </li>
                            <li className="flex items-start gap-3">
                              <span className="bg-white dark:bg-black/20 p-1.5 rounded text-xs font-mono">🎤 Audio</span>
                              <span>Envía una nota de voz: "Gasté 50 en cine".</span>
                            </li>
                          </ul>
                        </div>
                        <p className="text-xs text-center text-muted-foreground">
                          * El sistema detecta automáticamente la categoría.
                        </p>
                      </motion.div>
                    )}

                    {tutorialTab === 1 && (
                      <motion.div 
                        key="tab1"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-4"
                      >
                        <div className="grid gap-4">
                          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-100 dark:border-green-900/30">
                            <h3 className="font-semibold text-green-700 dark:text-green-300 flex items-center gap-2 mb-2">
                              <PieChart className="w-5 h-5" /> Presupuestos
                            </h3>
                            <p className="text-sm mb-2">Define tu límite mensual:</p>
                            <div className="bg-white dark:bg-black/20 p-2 rounded text-sm font-mono text-center">
                              "Presupuesto mensual 2000"
                            </div>
                            <div className="bg-white dark:bg-black/20 p-2 rounded text-sm font-mono text-center mt-2">
                              "Cambia mi presupuesto a 2500"
                            </div>
                          </div>

                          <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl border border-purple-100 dark:border-purple-900/30">
                            <h3 className="font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-2 mb-2">
                              <PiggyBank className="w-5 h-5" /> Ahorros
                            </h3>
                            <p className="text-sm mb-2">Registra dinero guardado:</p>
                            <div className="bg-white dark:bg-black/20 p-2 rounded text-sm font-mono text-center">
                              "Ahorré 500 para viaje"
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {tutorialTab === 2 && (
                      <motion.div 
                        key="tab2"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-4"
                      >
                        <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-xl border border-orange-100 dark:border-orange-900/30">
                          <h3 className="font-semibold text-orange-700 dark:text-orange-300 flex items-center gap-2 mb-3">
                            <Edit3 className="w-5 h-5" /> Edición y Corrección
                          </h3>
                          <ul className="space-y-3 text-sm">
                            <li className="flex flex-col gap-1">
                              <span className="font-medium">Corregir monto:</span>
                              <span className="bg-white dark:bg-black/20 p-2 rounded font-mono text-xs">"Cambia el monto a 60"</span>
                            </li>
                            <li className="flex flex-col gap-1">
                              <span className="font-medium">Eliminar error:</span>
                              <span className="bg-white dark:bg-black/20 p-2 rounded font-mono text-xs">"Elimina el último gasto"</span>
                            </li>
                            <li className="flex flex-col gap-1">
                              <span className="font-medium">Categorías Nuevas:</span>
                              <span className="bg-white dark:bg-black/20 p-2 rounded font-mono text-xs">"Gasto de 100 en [Nueva Categoria]"</span>
                              <span className="text-xs opacity-70 mt-1">Si la categoría no existe, se crea automáticamente.</span>
                            </li>
                          </ul>
                        </div>
                      </motion.div>
                    )}

                    {tutorialTab === 3 && (
                      <motion.div 
                        key="tab3"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-4"
                      >
                        <div className="bg-cyan-50 dark:bg-cyan-900/20 p-4 rounded-xl border border-cyan-100 dark:border-cyan-900/30">
                          <h3 className="font-semibold text-cyan-700 dark:text-cyan-300 flex items-center gap-2 mb-3">
                            <Search className="w-5 h-5" /> Consultas Inteligentes
                          </h3>
                          <p className="text-sm mb-3">Tu asistente responde preguntas naturales:</p>
                          <div className="space-y-2">
                            <div className="bg-white dark:bg-black/20 p-2.5 rounded text-sm font-mono">
                              "¿Cuánto gasté en comida este mes?"
                            </div>
                            <div className="bg-white dark:bg-black/20 p-2.5 rounded text-sm font-mono">
                              "¿Cuánto me queda de presupuesto?"
                            </div>
                            <div className="bg-white dark:bg-black/20 p-2.5 rounded text-sm font-mono">
                              "Dame un resumen de mis gastos"
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-muted p-4 rounded-xl text-center">
                          <p className="text-sm font-medium">
                            💡 Tip: También puedes gestionar todo desde este Dashboard.
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="pt-4 flex justify-between items-center border-t border-border mt-2">
                  <div className="text-xs text-muted-foreground">
                    Paso {tutorialTab + 1} de 4
                  </div>
                  <button 
                    onClick={() => {
                        if (tutorialTab < 3) setTutorialTab(t => t + 1);
                        else handleFinish();
                    }}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-all hover:scale-105"
                  >
                    {tutorialTab < 3 ? 'Siguiente' : 'Finalizar Tutorial'} <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
