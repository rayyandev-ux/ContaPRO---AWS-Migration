"use client";
import { BASE } from "@/lib/api";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter, usePathname } from "@/i18n/routing";
import { toast as sonnerToast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Mail, Loader2, Plus, X, ShieldCheck, Zap, Globe, AlertCircle, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Integration = {
  id: string;
  linked: boolean;
  email: string;
  lastSync?: string;
  settings: { allowedSenders: string[]; autoApprove: boolean; customName?: string };
};

type Status = { 
  ok: boolean; 
  integrations?: Integration[];
  totalActiveCount?: number;
  error?: string;
};

export default function OutlookLinkCard({ maxSlots = 1 }: { maxSlots?: number }) {
  const [status, setStatus] = useState<Status>({ ok: false, integrations: [] });
  const [loading, setLoading] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  
  const activeIntegration = status.integrations?.find(it => it.email === selectedEmail) || status.integrations?.[0];
  const [allowedSenders, setAllowedSenders] = useState<string[]>([]);
  const [autoApprove, setAutoApprove] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingNameValue, setEditingNameValue] = useState("");

  useEffect(() => {
    if (activeIntegration) {
      setAllowedSenders(activeIntegration.settings.allowedSenders);
      setAutoApprove(activeIntegration.settings.autoApprove);
      setSelectedEmail(activeIntegration.email);
      setEditingNameValue(activeIntegration.settings.customName || "");
    }
  }, [activeIntegration]);

  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    
    if (success === "outlook_connected") {
      sonnerToast.custom((t) => (
        <div className="relative overflow-hidden rounded-2xl bg-black/90 backdrop-blur-2xl border border-blue-500/20 p-4 shadow-2xl w-[350px] flex gap-4 items-start pr-10">
          <div className="bg-blue-500/20 p-2 rounded-full text-blue-400 shrink-0">
               <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
               <h3 className="font-semibold text-white text-sm">Conexión exitosa</h3>
               <p className="text-xs text-white/60 mt-1 leading-relaxed">Tu cuenta de Outlook ha sido vinculada correctamente.</p>
          </div>
          <button onClick={() => sonnerToast.dismiss(t)} className="absolute top-3 right-3 text-white/50 hover:text-white transition-colors">
              <X className="h-4 w-4" />
          </button>
          
          <motion.div 
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: 3, ease: "linear" }}
              className="absolute bottom-0 left-0 h-1 bg-blue-500"
          />
        </div>
      ), { duration: 3000 });
      
      router.replace(pathname);
      refresh();
    } else if (error === "email_limit_reached") {
      toast({ title: "Límite de correos", description: "Has alcanzado el límite de correos vinculados. Adquiere un espacio adicional para continuar.", variant: "destructive" });
      router.replace(pathname);
    }
  }, [searchParams, router, pathname]);

  const [newSender, setNewSender] = useState("");

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch(BASE + "/api/integrations/outlook/status", { credentials: "include" });
      const data = await res.json();
      setStatus(data);
      
      if (data.integrations?.length > 0) {
        const first = data.integrations[0];
        if (!selectedEmail) setSelectedEmail(first.email);
      }
    } catch {
      setStatus({ ok: false, error: "No se pudo obtener estado", integrations: [] });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function updateSettings(newSenders: string[], newAutoApprove?: boolean, newCustomName?: string) {
    if (!selectedEmail) return;
    const senders = newSenders;
    const approve = newAutoApprove !== undefined ? newAutoApprove : autoApprove;
    const customName = newCustomName !== undefined ? newCustomName : (activeIntegration?.settings.customName);

    try {
        const res = await fetch(BASE + "/api/integrations/outlook/settings", { 
            method: "PUT", 
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ allowedSenders: senders, autoApprove: approve, email: selectedEmail, customName }),
            credentials: "include" 
        });
        
        if (!res.ok) throw new Error("Error al guardar");
        
        setAllowedSenders(senders);
        if (newAutoApprove !== undefined) setAutoApprove(newAutoApprove);
        if (newCustomName !== undefined) setIsEditingName(false);

        toast({ title: "Configuración actualizada", description: "Cambios guardados correctamente." });
        refresh();
    } catch (e) {
        toast({ title: "Error", description: "No se pudo guardar la configuración", variant: "destructive" });
        refresh();
    }
  }

  function addSender() {
    if (!newSender.trim()) return;
    const val = newSender.trim().toLowerCase();
    if (allowedSenders.includes(val)) return;
    
    const updated = [...allowedSenders, val];
    updateSettings(updated);
    setNewSender("");
  }

  function removeSender(sender: string) {
    const updated = allowedSenders.filter(s => s !== sender);
    updateSettings(updated);
  }

  function toggleAutoApprove(val: boolean) {
      updateSettings(allowedSenders, val);
  }

  function handleConnect() {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://backend.contapro.lat";
    window.location.href = `${backendUrl}/api/integrations/outlook/connect`;
  }

  async function handleDisconnect() {
    if (!selectedEmail) return;
    setLoading(true);
    try {
      await fetch(BASE + "/api/integrations/outlook/disconnect", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: selectedEmail }),
        credentials: "include" 
      });
      setSelectedEmail(null);
      await refresh();
      toast({ title: "Desvinculado", description: "Tu cuenta de Outlook ha sido desconectada." });
    } catch {
      toast({ title: "Error", description: "No se pudo desconectar.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleTest() {
    if (!selectedEmail) return;
    setLoading(true);
    try {
      const res = await fetch(BASE + "/api/integrations/outlook/test", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: selectedEmail }),
        credentials: "include" 
      });
      const data = await res.json();
      if (data.ok) {
        toast({ title: "Prueba Exitosa", description: data.message || `Se encontraron ${data.count || 0} correos recientes.` });
      } else {
        toast({ title: "Error", description: data.error || "Falló la prueba", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Error de conexión", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const linkedAccounts = status.integrations || [];
  const canConnectMore = (status.totalActiveCount ?? 0) < maxSlots;

  return (
    <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/[0.03] p-1 shadow-2xl backdrop-blur-3xl transition-all hover:bg-white/[0.05]">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-transparent opacity-20 pointer-events-none" />
      
      <div className="relative p-7 sm:p-9">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 mb-10">
          <div className="flex items-start gap-5">
            <div className="relative group">
                <div className="absolute inset-0 bg-blue-500/20 rounded-3xl blur-xl transition-all group-hover:bg-blue-500/40 scale-110" />
                <div className="relative bg-white/5 backdrop-blur-xl p-4 rounded-3xl ring-1 ring-white/10 shadow-2xl flex items-center justify-center w-16 h-16 border border-white/10">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="36" height="36">
                        <path fill="#03a9f4" d="M24,4C12.95,4,4,12.95,4,24s8.95,20,20,20s20-8.95,20-20S35.05,4,24,4z M34.04,31.04 c-0.39,0.39-1.02,0.39-1.41,0L24,22.41l-8.63,8.63c-0.39,0.39-1.02,0.39-1.41,0s-0.39-1.02,0-1.41L22.59,21l-8.63-8.63 c-0.39-0.39-0.39-1.02,0-1.41s1.02-0.39,1.41,0L24,19.59l8.63-8.63c0.39-0.39,1.02-0.39,1.41,0s0.39,1.02,0,1.41L25.41,21 l8.63,8.63C34.43,30.02,34.43,30.65,34.04,31.04z"/>
                    </svg>
                </div>
            </div>
            <div>
                <div className="flex items-center gap-2">
                    <h3 className="text-2xl font-bold tracking-tight text-white/90">Outlook Connect</h3>
                    <Badge variant="outline" className="text-[10px] font-bold text-blue-400 bg-blue-500/10 border-blue-500/20 uppercase tracking-tighter h-5 px-1.5">NUEVO</Badge>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                    <p className="text-xs font-medium text-white/40 uppercase tracking-widest">Office 365 & Hotmail</p>
                </div>
            </div>
          </div>
        </div>
        
        <div className="space-y-4 mb-10">
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-white/5 border border-white/5 group hover:bg-white/10 transition-all duration-300">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                    <Zap className="h-4 w-4" />
                </div>
                <div>
                    <p className="text-sm font-medium text-white/80">Gestión de recibos inteligente</p>
                    <p className="text-xs text-white/40 mt-0.5 leading-relaxed">Sincroniza tu cuenta de Microsoft para detectar recibos y transferencias automáticamente con <span className="text-blue-400/80 font-semibold">Outlook Vision</span>.</p>
                </div>
            </div>
        </div>

        {/* Account Selector Section */}
        <div className="space-y-4 mb-10">
          <div className="flex items-center justify-between px-1">
              <h4 className="text-xs font-bold text-white/30 uppercase tracking-[0.2em]">Cuentas Vinculadas</h4>
              {linkedAccounts.length > 0 && (
                  <span className="text-[10px] font-medium text-white/20 bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                      {status.totalActiveCount ?? 0} de {maxSlots} global
                  </span>
              )}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {linkedAccounts.map((it, idx) => (
              <button
                key={it.id}
                onClick={() => setSelectedEmail(it.email)}
                className={cn(
                  "relative group flex flex-col p-4 rounded-[1.5rem] border transition-all duration-300 text-left overflow-hidden",
                  selectedEmail === it.email
                    ? "bg-white/10 border-white/20 shadow-xl"
                    : "bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/8"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                        <span className={cn(
                            "text-[10px] font-bold uppercase tracking-wider",
                            selectedEmail === it.email ? "text-blue-400" : "text-white/30"
                        )}>
                            {it.settings.customName || it.email}
                        </span>
                    </div>
                    {selectedEmail === it.email && (
                        <motion.div layoutId="active-indicator-outlook" className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                    )}
                </div>
                <span className={cn(
                    "text-xs font-medium truncate w-full",
                    selectedEmail === it.email ? "text-white" : "text-white/50"
                )}>
                    {it.email}
                </span>
                
                {selectedEmail === it.email && (
                    <div className="absolute bottom-0 left-0 h-0.5 bg-blue-500 w-full" />
                )}
              </button>
            ))}
            
            {canConnectMore && (
                <button
                    onClick={handleConnect}
                    disabled={loading}
                    className="flex flex-col items-center justify-center p-4 rounded-[1.5rem] border border-dashed border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-blue-500/30 transition-all group h-full min-h-[72px]"
                >
                    <Plus className="h-5 w-5 text-white/20 group-hover:text-blue-400 transition-colors mb-1" />
                    <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest group-hover:text-blue-400/80">Añadir Espacio</span>
                </button>
            )}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {selectedEmail && activeIntegration ? (
             <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="space-y-8 pt-8 border-t border-white/5"
             >
                {/* Actions Toolbar */}
                <div className="flex flex-wrap items-center gap-3">
                    {isEditingName ? (
                        <div className="flex items-center gap-2 bg-white/5 p-1 pl-3 rounded-full border border-white/10">
                            <input 
                                value={editingNameValue}
                                onChange={e => setEditingNameValue(e.target.value)}
                                placeholder="Nombre del correo"
                                className="bg-transparent border-none text-xs text-white focus:outline-none w-32"
                                autoFocus
                                onKeyDown={e => {
                                    if (e.key === 'Enter') updateSettings(allowedSenders, autoApprove, editingNameValue);
                                    if (e.key === 'Escape') setIsEditingName(false);
                                }}
                            />
                            <Button 
                                onClick={() => updateSettings(allowedSenders, autoApprove, editingNameValue)}
                                size="icon" 
                                className="h-7 w-7 rounded-full bg-blue-500 text-white hover:bg-blue-400"
                            >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button 
                                onClick={() => setIsEditingName(false)}
                                size="icon" 
                                variant="ghost"
                                className="h-7 w-7 rounded-full text-white/40 hover:text-white"
                            >
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    ) : (
                        <Button 
                            onClick={() => setIsEditingName(true)}
                            variant="ghost" 
                            size="sm" 
                            className="h-9 px-4 rounded-full text-white/40 hover:text-white hover:bg-white/5 gap-2 transition-all"
                        >
                            <Pencil className="h-3 w-3" />
                            Renombrar
                        </Button>
                    )}
                    <Button 
                        onClick={handleTest} 
                        disabled={loading}
                        variant="panel" 
                        size="sm" 
                        className="h-9 px-5 rounded-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/20 gap-2 shadow-lg shadow-blue-500/5"
                    >
                        {loading ? <Loader2 className="h-3 w-3 animate-spin"/> : <Zap className="h-3 w-3" />}
                        Sincronizar ahora
                    </Button>
                    <Button 
                        onClick={handleDisconnect} 
                        disabled={loading}
                        variant="ghost" 
                        size="sm" 
                        className="h-9 px-5 rounded-full text-white/30 hover:text-red-400 hover:bg-red-500/10 gap-2 transition-all"
                    >
                        <X className="h-3 w-3" />
                        Desconectar
                    </Button>
                </div>

                {/* Configuration Section */}
                <div className="space-y-6">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="p-1.5 rounded-lg bg-white/5 text-white/40">
                                <Globe className="h-3.5 w-3.5" />
                            </div>
                            <h4 className="text-sm font-semibold text-white/90">Remitentes Permitidos</h4>
                        </div>
                        
                        <div className="flex flex-wrap gap-2 min-h-[32px]">
                            {allowedSenders.map(sender => (
                                <Badge key={sender} variant="secondary" className="bg-white/5 hover:bg-white/10 text-white/60 border-white/10 pl-3 pr-2 py-1.5 gap-2 rounded-xl transition-all">
                                    <span className="text-xs font-medium">{sender}</span>
                                    <button onClick={() => removeSender(sender)} className="p-0.5 rounded-full hover:bg-red-500/20 hover:text-red-400 transition-all">
                                        <X className="h-3 w-3" />
                                    </button>
                                </Badge>
                            ))}
                        </div>

                        <div className="flex gap-2 group">
                            <div className="relative flex-1">
                                <Input 
                                    placeholder="Ej: rappi, uber, bcp..." 
                                    value={newSender}
                                    onChange={e => setNewSender(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && addSender()}
                                    className="h-11 bg-white/5 border-white/5 rounded-2xl text-sm text-white placeholder:text-white/20 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all pl-4"
                                />
                            </div>
                            <Button 
                                onClick={addSender} 
                                size="icon"
                                className="h-11 w-11 rounded-2xl bg-blue-500 text-white hover:bg-blue-400 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-blue-500/20"
                            >
                                <Plus className="h-5 w-5" />
                            </Button>
                        </div>
                        <div className="flex items-center gap-2 px-1">
                            <AlertCircle className="h-3 w-3 text-white/20" />
                            <p className="text-[10px] font-medium text-white/20 uppercase tracking-widest">Solo analizamos correos de estos remitentes</p>
                        </div>
                    </div>

                    <div className="p-6 rounded-[2rem] bg-white/[0.02] border border-white/5 space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="h-4 w-4 text-blue-400" />
                                    <Label htmlFor="auto-approve-outlook" className="text-sm font-semibold text-white/90 cursor-pointer">Auto-aprobar gastos</Label>
                                </div>
                                <p className="text-xs text-white/40 max-w-[240px] leading-relaxed">Los gastos detectados se registrarán sin pedir confirmación por WhatsApp/Telegram.</p>
                            </div>
                            <Switch 
                                id="auto-approve-outlook" 
                                checked={autoApprove} 
                                onCheckedChange={toggleAutoApprove}
                                className="data-[state=checked]:bg-blue-500"
                            />
                        </div>
                    </div>
                </div>

                {activeIntegration?.lastSync && (
                  <div className="flex items-center gap-2 px-1 opacity-40 group hover:opacity-100 transition-opacity">
                    <Loader2 className={cn("h-3 w-3", loading ? "animate-spin" : "")} />
                    <span className="text-[10px] font-bold text-white/50 uppercase tracking-[0.15em]">Sincronizado: {new Date(activeIntegration.lastSync).toLocaleString()}</span>
                  </div>
                )}
             </motion.div>
          ) : (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-10 px-6 rounded-[2.5rem] bg-white/[0.02] border border-white/5 text-center"
            >
                <div className="w-20 h-20 rounded-full bg-blue-500/5 flex items-center justify-center mb-6 border border-blue-500/10">
                    <Mail className="h-8 w-8 text-blue-500/40" />
                </div>
                <h4 className="text-lg font-semibold text-white/90 mb-2">Conecta tu Outlook</h4>
                <p className="text-sm text-white/40 max-w-xs mb-8">Administra tus finanzas directamente desde tu bandeja de Microsoft con la potencia de la IA.</p>
                <Button 
                    onClick={handleConnect} 
                    disabled={loading}
                    className="h-12 px-10 rounded-full bg-[#0078d4] text-white hover:bg-[#005a9e] font-bold shadow-xl shadow-blue-500/5 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                    Conectar Outlook
                </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
