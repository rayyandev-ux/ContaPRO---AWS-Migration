"use client";
import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";
import { apiJson } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { 
  Crown, CreditCard, Loader2, Plus, 
  Wallet, History, LayoutGrid, Mail, X, RefreshCw,
  AlertCircle, Check
} from "lucide-react";
import { toast } from "sonner";
import { StripeProvider } from "@/components/StripeProvider";
import { AddPaymentMethodModal } from "@/components/AddPaymentMethodModal";
import { PaymentMethodItem, InvoiceRow } from "@/components/BillingComponents";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { motion, AnimatePresence } from "framer-motion";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import { UpgradePromptDialog } from "../_components/UpgradePromptDialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function Page() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  
  // States for data
  const [user, setUser] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [extraSubscriptions, setExtraSubscriptions] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  
  // UI States
  const [isAddCardOpen, setIsAddCardOpen] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [loadingCancelId, setLoadingCancelId] = useState<string | null>(null);

  // Buy Resource Modal State
  const [buyResourceModal, setBuyResourceModal] = useState<{ isOpen: boolean, type: 'EXTRA_PROFILE' | 'EXTRA_EMAIL' | null }>({ isOpen: false, type: null });
  const [buyTermsAccepted, setBuyTermsAccepted] = useState(false);
  const [selectedProviderForExtra, setSelectedProviderForExtra] = useState<'FLOW' | 'STRIPE'>('STRIPE');

  // Confirmation States
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    const action = searchParams.get('action');
    const flowStatus = searchParams.get('flow');

    if (action === 'plan_updated') {
      toast.success("Compra confirmada", {
        description: "Se te enviará un comprobante a tu email en unos instantes."
      });
      router.replace('/billing');
    } else if (action === 'buy_email' && user) {
      openBuyModal('EXTRA_EMAIL');
      router.replace('/billing');
    } else if (action === 'buy_profile' && user) {
      openBuyModal('EXTRA_PROFILE');
      router.replace('/billing');
    }

    if (flowStatus === 'card-success') {
      toast.success("Tarjeta registrada exitosamente");
      router.replace('/billing');
    } else if (flowStatus === 'payment-success') {
      toast.success("Pago confirmado");
      router.replace('/billing');
    } else if (flowStatus === 'payment-pending') {
      toast.info("Pago pendiente", {
        description: "Tu pago está siendo procesado o está a la espera de confirmación. Te notificaremos cuando se complete."
      });
      router.replace('/billing');
    } else if (flowStatus === 'card-error') {
      toast.error("Error registrando tarjeta o fue cancelada");
      router.replace('/billing');
    } else if (flowStatus === 'error') {
      toast.error("El pago no fue procesado o fue cancelado");
      router.replace('/billing');
    }
  }, [searchParams, router]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const meRes = await apiJson("/api/auth/me", { cache: "no-store" });
      let provider = 'STRIPE';
      if (meRes.ok) {
        setUser(meRes.data.user);
        provider = meRes.data.user.paymentProvider || 'STRIPE';
      }

      const prefix = provider === 'FLOW' ? '/api/payments/flow' : '/api/payments';

      const [subRes, methodsRes, invoicesRes] = await Promise.all([
        apiJson(`${prefix}/subscription`, { cache: "no-store" }),
        apiJson(`${prefix}/payment-methods`, { cache: "no-store" }),
        apiJson(provider === 'FLOW' ? `${prefix}/history` : `${prefix}/invoices`, { cache: "no-store" }),
      ]);

      if (subRes.ok && subRes.data) {
        setSubscription(provider === 'FLOW' ? subRes.data : subRes.data.subscription);
        setExtraSubscriptions(provider === 'FLOW' ? (subRes.data.addons || []) : (subRes.data.extraSubscriptions || []));
      } else {
        setSubscription(null);
        setExtraSubscriptions([]);
      }
      
      if (methodsRes.ok) setPaymentMethods(provider === 'FLOW' ? methodsRes.data.data : methodsRes.data.items);
      
      if (invoicesRes.ok) {
        if (provider === 'FLOW') {
          // Mapear historial de Flow para que coincida con lo que espera InvoiceRow
          const mappedInvoices = invoicesRes.data.map((inv: any) => ({
            id: inv.id,
            number: inv.orderId,
            created: new Date(inv.createdAt).getTime() / 1000,
            status: inv.status.toLowerCase(),
            amount_paid: inv.amount * 100, // Stripe expects cents
            currency: inv.currency,
            hosted_invoice_url: '#' // Flow doesn't provide a direct invoice url here
          }));
          setInvoices(mappedInvoices);
        } else {
          setInvoices(invoicesRes.data.items);
        }
      }
    } catch (err) {
      setError("Error al cargar datos de facturación");
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
        // Recargar si es una mutación local o un evento de facturación/suscripción vía SSE
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

  const handleSetDefault = async (id: string) => {
    if (user?.paymentProvider === 'FLOW') return; // Not supported on flow
    setLoadingAction(id);
    const res = await apiJson(`/api/payments/payment-methods/${id}/default`, { method: "POST" });
    if (res.ok) {
      toast.success("Método predeterminado actualizado");
      fetchData();
    } else {
      toast.error(res.error || "Error al actualizar");
    }
    setLoadingAction(null);
  };

  const handleDeleteMethod = async (id: string) => {
    setConfirmDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    setLoadingAction(id);
    
    const prefix = user?.paymentProvider === 'FLOW' ? '/api/payments/flow' : '/api/payments';
    const res = await apiJson(user?.paymentProvider === 'FLOW' ? `${prefix}/payment-methods/delete` : `${prefix}/payment-methods/${id}/detach`, { method: "POST" });
    
    if (res.ok) {
      toast.success("Tarjeta eliminada");
      fetchData();
    } else {
      toast.error(res.error || "Error al eliminar");
    }
    setLoadingAction(null);
  };

  const handleCancelSub = async () => {
    setIsCancelConfirmOpen(true);
  };

  const confirmCancel = async () => {
    setIsCancelConfirmOpen(false);
    setLoadingAction("cancel");

    const prefix = user?.paymentProvider === 'FLOW' ? '/api/payments/flow' : '/api/payments';
    let url = user?.paymentProvider === 'FLOW' ? `${prefix}/subscription/cancel` : `${prefix}/subscription/${subscription?.id}/cancel`;

    const res = await apiJson(url, { method: "POST" });
    if (res.ok) {
      toast.success("Suscripción cancelada correctamente");
      fetchData();
    } else {
      toast.error(res.error || "Error al cancelar");
    }
    setLoadingAction(null);
  };

  const handleResumeSub = async () => {
    if (paymentMethods.length === 0) {
      toast.error("Debes añadir una tarjeta para reactivar tu suscripción");
      setIsAddCardOpen(true);
      return;
    }
    setLoadingAction("resume");

    const prefix = user?.paymentProvider === 'FLOW' ? '/api/payments/flow' : '/api/payments';
    let url = user?.paymentProvider === 'FLOW' ? `${prefix}/subscription/resume` : `${prefix}/subscription/${subscription?.id}/resume`;

    const res = await apiJson(url, { method: "POST" });
    if (res.ok) {
      toast.success("Suscripción reactivada correctamente");
      fetchData();
    } else {
      toast.error(res.error || "Error al reactivar");
    }
    setLoadingAction(null);
  };

  const handleCancelExtraSub = async (subId: string) => {
    setLoadingCancelId(subId);
    try {
      const res = await apiJson(`/api/payments/subscription/${subId}/cancel`, { method: 'POST' });
      if (res.ok) {
        toast.success('Suscripción cancelada correctamente (se mantendrá hasta fin de ciclo)');
        await fetchData();
      } else {
        toast.error(res.error || 'Error al cancelar');
      }
    } catch (e) {
      toast.error('Error de red al cancelar');
    } finally {
      setLoadingCancelId(null);
    }
  };

  const handleResumeExtraSub = async (subId: string) => {
    setLoadingCancelId(subId);
    try {
      const res = await apiJson(`/api/payments/subscription/${subId}/resume`, { method: 'POST' });
      if (res.ok) {
        toast.success('Suscripción reactivada correctamente');
        await fetchData();
      } else {
        toast.error(res.error || 'Error al reactivar');
      }
    } catch (e) {
      toast.error('Error de red al reactivar');
    } finally {
      setLoadingCancelId(null);
    }
  };

  const openBuyModal = (type: 'EXTRA_PROFILE' | 'EXTRA_EMAIL') => {
    const isPremium = user?.plan === 'PREMIUM' && user?.planExpires && new Date(user.planExpires) > new Date();
    const isLifetime = user?.plan === 'LIFETIME';
    const hasTrial = user?.trialEnds && new Date(user.trialEnds) > new Date();
    const hasFullAccess = isPremium || isLifetime || hasTrial;

    if (!hasFullAccess) {
      setShowUpgradePrompt(true);
      return;
    }

    setSelectedProviderForExtra('STRIPE');
    setBuyResourceModal({ isOpen: true, type });
    setBuyTermsAccepted(false);
  };

  const handleBuyResource = async () => {
    const { type } = buyResourceModal;
    if (!type) return;
    
    setLoadingAction(type);
    try {
      const prefix = selectedProviderForExtra === 'FLOW' ? '/api/payments/flow' : '/api/payments';
      const res = await apiJson(`${prefix}/buy-extra`, {
        method: "POST",
        body: JSON.stringify({ type, plan: isAnnual ? 'ANNUAL' : 'MONTHLY' }),
      });
      
      if (res.ok) {
        if (res.data?.url) {
          window.location.href = res.data.url;
          return;
        }
        toast.success("Compra confirmada", {
          description: "Se te enviará un comprobante a tu email en unos instantes."
        });
        setBuyResourceModal({ isOpen: false, type: null });
        fetchData();
      } else {
        toast.error(res.error || "Error al procesar la compra");
      }
    } catch (e) {
      toast.error("Error de conexión");
    } finally {
      setLoadingAction(null);
    }
  };

  const isAnnual = subscription?.interval === 'year' || user?.plan === 'ANNUAL';
  const profilePrice = isAnnual ? '53.90' : '8.90';
  const emailPrice = isAnnual ? '49.90' : '5.00';
  const resourceInterval = isAnnual ? 'año' : 'mes';

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-8">
        <Loader2 className="h-12 w-12 text-white/20 animate-spin" />
        <p className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-black">Sincronizando Facturación...</p>
      </div>
    );
  }

  return (
    <StripeProvider>
      <section className="space-y-6 max-w-[1600px] w-full mx-auto px-6 md:px-8 xl:px-12 py-6 md:py-8 lg:py-10">
        <RealtimeRefresh />
        <UpgradePromptDialog open={showUpgradePrompt} onOpenChange={setShowUpgradePrompt} />
        
        <div className="bg-white/10 backdrop-blur-2xl shadow-2xl border border-white/20 rounded-2xl overflow-hidden mt-6">
          <div className="px-8 pt-8 pb-6 border-b border-white/10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-5xl md:text-6xl font-playfair font-bold tracking-tight text-white mb-2 italic">Facturación</h1>
                <p className="text-white/40 text-lg font-medium">Controla tus planes, métodos de pago e historial.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                {(!user?.paymentProvider || user?.paymentProvider === 'STRIPE') && (
                  <Button 
                    onClick={() => setIsAddCardOpen(true)}
                    className="rounded-full bg-white text-black font-medium hover:bg-white/90 transition-colors text-sm px-6 h-11 shadow-md"
                  >
                    <Plus className="h-4 w-4 mr-2" /> Añadir Tarjeta
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="px-8 py-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              {/* Columna Izquierda: Suscripción y Wallet */}
              <div className="lg:col-span-7 space-y-10">
                {/* Card de Suscripción Actual */}
                <section className="space-y-4">
                  <div className="flex items-center gap-3 px-2">
                    <Crown className="h-5 w-5 text-white/40" />
                    <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/60">Tu Plan Actual</h2>
                  </div>

                  <div className="relative p-10 rounded-[2.5rem] bg-white/[0.03] border border-white/10 backdrop-blur-3xl overflow-hidden shadow-2xl group transition-all duration-700 hover:bg-white/[0.05]">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <h3 className="text-4xl font-bold font-playfair text-white italic">
                            {user?.plan === 'FREE' ? 'Plan Free' : user?.plan === 'LIFETIME' ? 'Plan Vitalicio' : 'Plan Pro'}
                          </h3>
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-white/40 font-medium uppercase tracking-widest">
                              {subscription?.status === 'active' ? 'Activo y en buen estado' : 
                               subscription?.status === 'trialing' ? 'Periodo de prueba activo' :
                               user?.plan === 'FREE' ? 'Limitado a funciones básicas' : 'Estado de suscripción'}
                            </p>
                            {paymentMethods.length === 0 && user?.plan !== 'FREE' && user?.plan !== 'LIFETIME' && (
                              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[9px] font-black uppercase tracking-wider animate-pulse">
                                <AlertCircle className="h-3 w-3" />
                                Requiere Tarjeta
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {subscription && (
                          <div className="flex flex-col md:flex-row md:items-center gap-6">
                            <div className="space-y-1">
                              <Label className="text-[10px] text-white/20 uppercase tracking-[0.15em] font-black">
                                Próximo Pago
                              </Label>
                              <p className="text-sm font-bold text-white/80">
                                {subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                              </p>
                            </div>
                            <div className="hidden md:block h-8 w-px bg-white/10" />
                            <div className="space-y-1">
                              <Label className="text-[10px] text-white/20 uppercase tracking-[0.15em] font-black">Monto</Label>
                              <p className="text-sm font-bold text-white/80">
                                {subscription.amount.toLocaleString('es-PE', { style: 'currency', currency: subscription.currency })}
                                <span className="text-[10px] text-white/30 ml-1">/{subscription.interval === 'month' ? 'mes' : 'año'}</span>
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-3 shrink-0">
                        {user?.plan === 'FREE' ? (
                          <Button 
                            onClick={() => router.push('/pricing')}
                            className="rounded-2xl bg-white text-black hover:bg-zinc-200 h-14 px-10 text-xs font-black uppercase tracking-widest transition-all shadow-[0_20px_40px_-12px_rgba(255,255,255,0.2)] hover:scale-[1.02]"
                          >
                            Mejorar Plan
                          </Button>
                        ) : user?.plan !== 'LIFETIME' && subscription && (
                          <>
                            {subscription.interval === 'month' && !subscription.cancelAtPeriodEnd && (
                              <Button 
                                onClick={() => router.push('/pricing')}
                                className="rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 text-white hover:from-emerald-400 hover:to-emerald-300 border-none h-12 px-8 text-[10px] font-black uppercase tracking-widest transition-all shadow-[0_10px_20px_-10px_rgba(16,185,129,0.5)] hover:shadow-[0_15px_25px_-10px_rgba(16,185,129,0.6)] hover:scale-[1.02]"
                              >
                                Mejorar a Anual
                              </Button>
                            )}
                            {subscription.cancelAtPeriodEnd ? (
                              <Button 
                                onClick={handleResumeSub}
                                disabled={loadingAction === 'resume'}
                                className="rounded-2xl h-14 px-10 text-xs font-black uppercase tracking-widest transition-all bg-white/10 text-white hover:bg-white/20 border border-white/20"
                              >
                                {loadingAction === 'resume' ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                                Reactivar
                              </Button>
                            ) : (
                              <Button 
                                onClick={handleCancelSub}
                                disabled={loadingAction === 'cancel'}
                                variant="ghost" 
                                className="rounded-2xl bg-red-500/5 text-red-400 hover:bg-red-500/10 border border-red-500/10 h-14 px-10 text-xs font-black uppercase tracking-widest transition-all"
                              >
                                {loadingAction === 'cancel' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <X className="h-4 w-4 mr-2" />}
                                Cancelar
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/[0.02] blur-[80px] rounded-full -mr-32 -mt-32 pointer-events-none group-hover:bg-white/[0.04] transition-all duration-700" />
                  </div>
                </section>

                {/* Sección Wallet */}
                <section className="space-y-6">
                  <div className="flex items-center gap-3 px-2">
                    <Wallet className="h-5 w-5 text-white/40" />
                    <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/60">Mis Tarjetas</h2>
                  </div>

                  <div className="space-y-4">
                    <AnimatePresence mode="popLayout">
                      {paymentMethods.length > 0 ? (
                        paymentMethods.map((m) => (
                          <motion.div 
                            key={m.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                          >
                            <PaymentMethodItem 
                              method={m} 
                              onSetDefault={handleSetDefault} 
                              onDelete={handleDeleteMethod} 
                              loadingAction={loadingAction}
                            />
                          </motion.div>
                        ))
                      ) : (
                        <div className="p-12 rounded-[2rem] bg-white/[0.02] border border-white/5 border-dashed flex flex-col items-center justify-center text-center space-y-6">
                          <div className="h-16 w-16 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                            <CreditCard className="h-8 w-8 text-white/10" />
                          </div>
                          <div className="space-y-2">
                            <p className="text-sm font-bold text-white/40">Aún no hay métodos de pago</p>
                            <p className="text-[10px] text-white/20 font-medium uppercase tracking-widest leading-relaxed">
                              Añade una tarjeta de crédito o débito<br />para gestionar tus planes y recursos.
                            </p>
                          </div>
                          {(!user?.paymentProvider || user?.paymentProvider === 'STRIPE') && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => setIsAddCardOpen(true)}
                              className="rounded-full bg-white/5 hover:bg-white text-white/60 hover:text-black border border-white/10 transition-all font-bold text-[10px] uppercase tracking-widest px-8 h-10 mt-4"
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Añadir Primera Tarjeta
                            </Button>
                          )}
                        </div>
                      )}
                    </AnimatePresence>
                  </div>
                </section>
              </div>

              {/* Columna Derecha: Capacidad e Historial */}
              <div className="lg:col-span-5 space-y-10">
                {/* Card de Capacidad/Slots */}
                <section className="space-y-4">
                  <div className="flex items-center gap-3 px-2">
                    <LayoutGrid className="h-5 w-5 text-white/40" />
                    <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/60">Recursos Extra</h2>
                  </div>

                  <Accordion type="single" collapsible className="w-full space-y-4">
                    <AccordionItem value="profiles" className="border-none p-0">
                      <div className="p-6 rounded-[2rem] bg-white/[0.03] border border-white/10 backdrop-blur-2xl flex flex-col gap-4 group hover:bg-white/[0.05] transition-all">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                              <LayoutGrid className="h-5 w-5 text-white/40" />
                            </div>
                            <div className="space-y-0.5">
                              <p className="text-xs font-bold text-white uppercase tracking-wider">Perfiles Extras</p>
                              <p className="text-[10px] text-white/30 font-medium">
                                {user?.extraProfileSlots || 0} slots totales
                                {extraSubscriptions.filter(s => s.plan === 'EXTRA_PROFILE' && !s.cancelAtPeriodEnd).length > 0 && 
                                  ` (${extraSubscriptions.filter(s => s.plan === 'EXTRA_PROFILE' && !s.cancelAtPeriodEnd).length} activos)`
                                }
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="ghost" 
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); openBuyModal('EXTRA_PROFILE'); }}
                              disabled={loadingAction === 'EXTRA_PROFILE'}
                              className="rounded-full h-8 px-4 text-[10px] font-black uppercase tracking-widest bg-white/5 hover:bg-white/10 text-white/40 hover:text-white border border-white/10 transition-all"
                            >
                              {loadingAction === 'EXTRA_PROFILE' ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Plus className="h-3 w-3 mr-1.5" />}
                              S/ {profilePrice}
                            </Button>
                            {extraSubscriptions.filter(s => s.plan === 'EXTRA_PROFILE').length > 0 && (
                              <AccordionTrigger className="hover:no-underline py-0 px-2 text-white/40 hover:text-white transition-colors" />
                            )}
                          </div>
                        </div>

                        {/* Lista de subscripciones de Perfiles */}
                        <AccordionContent className="pt-2 pb-0 border-t border-white/5 mt-2">
                          <div className="flex flex-col gap-2 pt-2">
                            {extraSubscriptions.filter(s => s.plan === 'EXTRA_PROFILE').map((sub, i) => (
                              <div key={sub.id} className="flex items-center justify-between bg-black/20 p-3 rounded-xl border border-white/5">
                                <div className="space-y-1 text-left">
                                  <p className="text-[10px] font-bold text-white/80">
                                    Perfil #{i + 1} <span className="text-white/40">({sub.interval === 'year' ? 'Anual' : 'Mensual'})</span>
                                  </p>
                                  <p className="text-[9px] text-white/40 uppercase tracking-widest">
                                    {sub.cancelAtPeriodEnd ? 'Expira: ' : 'Renueva: '} 
                                    <span className="text-white/60 ml-1">{sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}</span>
                                  </p>
                                </div>
                                {sub.cancelAtPeriodEnd ? (
                                  <Button 
                                    variant="ghost" 
                                    onClick={() => handleResumeExtraSub(sub.id)}
                                    disabled={loadingCancelId === sub.id}
                                    className="h-6 px-3 text-[9px] font-black text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all uppercase tracking-widest"
                                  >
                                    {loadingCancelId === sub.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Reactivar'}
                                  </Button>
                                ) : (
                                  <Button 
                                    variant="ghost" 
                                    onClick={() => handleCancelExtraSub(sub.id)}
                                    disabled={loadingCancelId === sub.id}
                                    className="h-6 px-3 text-[9px] font-black text-red-400/60 hover:text-red-400 bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 rounded-lg transition-all uppercase tracking-widest"
                                  >
                                    {loadingCancelId === sub.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Cancelar'}
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </div>
                    </AccordionItem>

                    <AccordionItem value="emails" className="border-none p-0">
                      <div className="p-6 rounded-[2rem] bg-white/[0.03] border border-white/10 backdrop-blur-2xl flex flex-col gap-4 group hover:bg-white/[0.05] transition-all">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                              <Mail className="h-5 w-5 text-white/40" />
                            </div>
                            <div className="space-y-0.5">
                              <p className="text-xs font-bold text-white uppercase tracking-wider">Emails Extras</p>
                              <p className="text-[10px] text-white/30 font-medium">
                                {user?.extraEmailSlots || 0} slots totales
                                {extraSubscriptions.filter(s => s.plan === 'EXTRA_EMAIL' && !s.cancelAtPeriodEnd).length > 0 && 
                                  ` (${extraSubscriptions.filter(s => s.plan === 'EXTRA_EMAIL' && !s.cancelAtPeriodEnd).length} activos)`
                                }
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="ghost" 
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); openBuyModal('EXTRA_EMAIL'); }}
                              disabled={loadingAction === 'EXTRA_EMAIL'}
                              className="rounded-full h-8 px-4 text-[10px] font-black uppercase tracking-widest bg-white/5 hover:bg-white/10 text-white/40 hover:text-white border border-white/10 transition-all"
                            >
                              {loadingAction === 'EXTRA_EMAIL' ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Plus className="h-3 w-3 mr-1.5" />}
                              S/ {emailPrice}
                            </Button>
                            {extraSubscriptions.filter(s => s.plan === 'EXTRA_EMAIL').length > 0 && (
                              <AccordionTrigger className="hover:no-underline py-0 px-2 text-white/40 hover:text-white transition-colors" />
                            )}
                          </div>
                        </div>

                        {/* Lista de subscripciones de Emails */}
                        <AccordionContent className="pt-2 pb-0 border-t border-white/5 mt-2">
                          <div className="flex flex-col gap-2 pt-2">
                            {extraSubscriptions.filter(s => s.plan === 'EXTRA_EMAIL').map((sub, i) => (
                              <div key={sub.id} className="flex items-center justify-between bg-black/20 p-3 rounded-xl border border-white/5">
                                <div className="space-y-1 text-left">
                                  <p className="text-[10px] font-bold text-white/80">
                                    Email #{i + 1} <span className="text-white/40">({sub.interval === 'year' ? 'Anual' : 'Mensual'})</span>
                                  </p>
                                  <p className="text-[9px] text-white/40 uppercase tracking-widest">
                                    {sub.cancelAtPeriodEnd ? 'Expira: ' : 'Renueva: '} 
                                    <span className="text-white/60 ml-1">{sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}</span>
                                  </p>
                                </div>
                                {sub.cancelAtPeriodEnd ? (
                                  <Button 
                                    variant="ghost" 
                                    onClick={() => handleResumeExtraSub(sub.id)}
                                    disabled={loadingCancelId === sub.id}
                                    className="h-6 px-3 text-[9px] font-black text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all uppercase tracking-widest"
                                  >
                                    {loadingCancelId === sub.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Reactivar'}
                                  </Button>
                                ) : (
                                  <Button 
                                    variant="ghost" 
                                    onClick={() => handleCancelExtraSub(sub.id)}
                                    disabled={loadingCancelId === sub.id}
                                    className="h-6 px-3 text-[9px] font-black text-red-400/60 hover:text-red-400 bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 rounded-lg transition-all uppercase tracking-widest"
                                  >
                                    {loadingCancelId === sub.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Cancelar'}
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </div>
                    </AccordionItem>
                  </Accordion>
                </section>

                {/* Historial de Facturas */}
                <section className="space-y-4">
                  <div className="flex items-center gap-3 px-2">
                    <History className="h-5 w-5 text-white/40" />
                    <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/60">Historial</h2>
                  </div>

                  <div className="rounded-[2.5rem] bg-white/[0.02] border border-white/10 backdrop-blur-3xl overflow-hidden shadow-2xl">
                    {invoices.length > 0 ? (
                      <div className="divide-y divide-white/5">
                        {invoices.map((inv) => (
                          <InvoiceRow key={inv.id} invoice={inv} />
                        ))}
                      </div>
                    ) : (
                      <div className="p-16 text-center space-y-4">
                        <div className="h-14 w-14 rounded-full bg-white/5 flex items-center justify-center mx-auto border border-white/10">
                          <History className="h-6 w-6 text-white/10" />
                        </div>
                        <p className="text-[10px] text-white/20 font-black uppercase tracking-[0.2em]">No hay facturas registradas</p>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>

        <AddPaymentMethodModal 
          open={isAddCardOpen} 
          onOpenChange={setIsAddCardOpen} 
          onSuccess={fetchData} 
        />

        <ConfirmDialog 
          open={!!confirmDeleteId}
          onOpenChange={(open) => !open && setConfirmDeleteId(null)}
          title="¿Eliminar Tarjeta?"
          description="Esta acción desvinculará la tarjeta de tu cuenta. No podrás usarla para futuros pagos hasta que la añadas de nuevo."
          confirmText="Eliminar"
          cancelText="Mantener"
          variant="danger"
          onConfirm={confirmDelete}
          loading={loadingAction === confirmDeleteId}
        />

        <ConfirmDialog 
          open={isCancelConfirmOpen}
          onOpenChange={setIsCancelConfirmOpen}
          title="¿Cancelar Suscripción?"
          description="Seguro que quieres cancelar la suscripción? Mantendrás el acceso a todas las funciones PRO hasta el final del periodo de facturación actual."
          confirmText="Confirmar Cancelación"
          cancelText="Volver"
          variant="danger"
          onConfirm={confirmCancel}
          loading={loadingAction === 'cancel'}
        />

        {/* Modal de Compra de Recursos Extra */}
        <ConfirmDialog 
          open={buyResourceModal.isOpen}
          onOpenChange={(open) => {
            if (!open) {
              setBuyResourceModal({ isOpen: false, type: null });
              setBuyTermsAccepted(false);
            }
          }}
          title={`Confirmar Compra de ${buyResourceModal.type === 'EXTRA_PROFILE' ? 'Perfil' : 'Email'} Extra`}
          description={
            <div className="w-full space-y-4 text-left">
                <p className="text-sm text-white/60">
                  Elige tu método de pago y autoriza la compra de <strong className="text-white">S/ {buyResourceModal.type === 'EXTRA_PROFILE' ? profilePrice : emailPrice}</strong>.
                </p>

              <div className="flex flex-col gap-2 p-2 rounded-xl bg-white/5 border border-white/10">
                <button
                  onClick={() => setSelectedProviderForExtra('FLOW')}
                  disabled={true}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 w-full opacity-50 cursor-not-allowed ${
                    selectedProviderForExtra === 'FLOW' ? "bg-violet-500/20 text-violet-300 border border-violet-500/30" : "text-zinc-400"
                  }`}
                >
                  🇵🇪 Flow (Yape, Plin, Tarjeta) - Temporalmente no disponible
                </button>
                <button
                  onClick={() => setSelectedProviderForExtra('STRIPE')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 w-full ${
                    selectedProviderForExtra === 'STRIPE' ? "bg-violet-500/20 text-violet-300 border border-violet-500/30" : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  🌍 Stripe (Internacional)
                </button>
              </div>

              {selectedProviderForExtra === 'FLOW' && (
                 <p className="text-[10px] text-amber-400/80 italic leading-relaxed px-2">
                   Nota: Si usas Yape, Plin o PagoEfectivo en Flow, el acceso solo será por 1 {resourceInterval} y tendrás que renovar manualmente.
                 </p>
              )}

              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2 mt-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/40">Frecuencia de cobro:</span>
                  <span className="text-white font-bold capitalize">{resourceInterval}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/40">Total a pagar ahora:</span>
                  <span className="text-white font-bold">S/ {buyResourceModal.type === 'EXTRA_PROFILE' ? profilePrice : emailPrice}</span>
                </div>
              </div>
              <p className="text-[10px] text-white/40 italic leading-relaxed">
                  * El cobro se realizará de forma recurrente ({resourceInterval}) si usas tarjeta. Podrás cancelar esta suscripción individual en cualquier momento.
                </p>
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
                  Acepto los términos y autorizo la compra.
                </span>
              </label>

              {selectedProviderForExtra === 'STRIPE' && paymentMethods.length === 0 && (
                 <p className="text-xs text-red-400 font-medium mt-2">Debes añadir una tarjeta primero para usar Stripe.</p>
              )}
            </div>
          }
          confirmText={`Pagar S/ ${buyResourceModal.type === 'EXTRA_PROFILE' ? profilePrice : emailPrice}`}
          cancelText="Cancelar"
          onConfirm={handleBuyResource}
          loading={loadingAction === buyResourceModal.type}
          disabled={!buyTermsAccepted || (selectedProviderForExtra === 'STRIPE' && paymentMethods.length === 0)}
        />
      </section>
    </StripeProvider>
  );
}
