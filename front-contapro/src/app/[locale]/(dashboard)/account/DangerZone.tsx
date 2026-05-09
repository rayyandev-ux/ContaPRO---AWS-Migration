"use client";

import { useState } from "react";
import { AlertTriangle, Trash2, Loader2, RefreshCw, Wallet, PiggyBank, Tag, Settings, Repeat, Check, AlertOctagon } from "lucide-react";
import { apiJson, invalidateApiCache } from "@/lib/api";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function DangerZone() {
  const [selected, setSelected] = useState({
    transactions: false,
    accounts: false,
    budgets: false,
    categories: false,
    configurations: false,
  });
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [fetchingStats, setFetchingStats] = useState(false);

  const handleToggle = (key: keyof typeof selected) => {
    setSelected(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSelectAll = () => {
    const allSelected = Object.values(selected).every(Boolean);
    const newState = Object.keys(selected).reduce((acc, key) => {
      acc[key as keyof typeof selected] = !allSelected;
      return acc;
    }, {} as typeof selected);
    setSelected(newState);
  };

  const count = Object.values(selected).filter(Boolean).length;

  const handleInitialClick = async () => {
    if (count === 0) return;
    setFetchingStats(true);
    setStats(null); // Reset stats before fetching
    try {
        const res = await apiJson<Record<string, number>>("/api/auth/reset-data/counts");
        if (res.ok && res.data) {
            setStats(res.data);
            setShowConfirm(true);
        } else {
            console.error("Failed to fetch stats", res.error);
            const msg = res.error || "Error desconocido";
            if (msg.toLowerCase().includes("not found") || msg.toLowerCase().includes("route")) {
                alert("Error: El servidor backend no reconoce esta ruta. Por favor reinicia el backend manualmente para aplicar los cambios recientes.");
            } else {
                alert(`Error al cargar datos: ${msg}`);
            }
        }
    } catch (e) {
        console.error(e);
        alert("Error de conexión al cargar datos.");
    } finally {
        setFetchingStats(false);
    }
  };

  const handleFinalDelete = async () => {
    setLoading(true);
    try {
      const res = await apiJson("/api/auth/reset-data", {
        method: "POST",
        body: JSON.stringify(selected),
      });
      
      if (res.ok) {
        setShowConfirm(false);
        try { invalidateApiCache("/api/auth"); } catch {}
        window.location.reload();
      } else {
        alert("Error al eliminar datos: " + (res.error || "Desconocido"));
      }
    } catch (e) {
      alert("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const getLabel = (key: string) => {
    switch(key) {
        case 'transactions': return 'Transacciones';
        case 'accounts': return 'Cuentas';
        case 'budgets': return 'Presupuestos';
        case 'categories': return 'Categorías';
        case 'configurations': return 'Configuraciones';
        default: return key;
    }
  };

  return (
    <div className="mt-12 space-y-6">
        <div className="flex flex-col gap-1">
          <h3 className="text-xl font-bold text-red-500 flex items-center gap-2">
              <AlertTriangle className="h-6 w-6" /> Zona de Peligro
          </h3>
          <p className="text-sm text-white/40 font-medium ml-8">Acciones irreversibles para tu cuenta</p>
        </div>

        <div className="bg-white/10 backdrop-blur-2xl border border-red-500/20 rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-8 border-b border-white/10 flex items-center gap-5 bg-red-500/5">
                 <div className="h-12 w-12 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20 shadow-inner">
                    <RefreshCw className="h-6 w-6" />
                 </div>
                 <div>
                     <h4 className="text-lg font-bold text-white">Resetear datos de la cuenta</h4>
                     <p className="text-sm text-white/40 font-medium">Limpia selectivamente los datos de tu cuenta sin eliminarla.</p>
                 </div>
            </div>
            
            <div className="p-4">
                <div 
                    onClick={handleSelectAll}
                    className="flex items-center gap-4 p-5 hover:bg-white/5 rounded-2xl cursor-pointer transition-all duration-200 border border-transparent hover:border-white/10 mb-2"
                >
                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${Object.values(selected).every(Boolean) ? 'bg-red-500 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]' : 'border-white/20'}`}>
                        {Object.values(selected).every(Boolean) && <Check className="h-4 w-4 text-white font-bold" />}
                    </div>
                    <span className="text-sm font-bold text-white/80 tracking-wide uppercase">Seleccionar todo</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {[
                        { key: 'transactions', label: 'Transacciones', desc: 'Elimina todas tus transacciones registradas', icon: Wallet },
                        { key: 'accounts', label: 'Cuentas', desc: 'Elimina todas tus cuentas bancarias y de efectivo', icon: PiggyBank },
                        { key: 'budgets', label: 'Presupuestos', desc: 'Elimina todos tus presupuestos configurados', icon: RefreshCw },
                        { key: 'categories', label: 'Categorías personalizadas', desc: 'Elimina solo las categorías personalizadas que creaste', icon: Tag },
                        { key: 'configurations', label: 'Configuraciones', desc: 'Restablece tus preferencias y configuraciones', icon: Settings },
                    ].map((item) => (
                         <div 
                            key={item.key}
                            onClick={() => handleToggle(item.key as any)}
                            className={`flex items-center gap-4 p-5 rounded-2xl cursor-pointer transition-all duration-200 border ${selected[item.key as keyof typeof selected] ? 'bg-red-500/10 border-red-500/30' : 'bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/10'} group`}
                        >
                            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${selected[item.key as keyof typeof selected] ? 'bg-red-500 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]' : 'border-white/20 group-hover:border-white/40'}`}>
                                {selected[item.key as keyof typeof selected] && <Check className="h-4 w-4 text-white font-bold" />}
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <item.icon className={`h-4 w-4 ${selected[item.key as keyof typeof selected] ? 'text-red-400' : 'text-white/30'}`} />
                                    <span className="text-sm font-bold text-white/90">{item.label}</span>
                                </div>
                                <p className="text-xs text-white/40 font-medium mt-1">{item.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white/5 p-6 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4">
                <span className="text-xs font-bold uppercase tracking-widest text-white/30">
                    {count === 0 ? 'Ningún elemento seleccionado' : `${count} elemento${count !== 1 ? 's' : ''} seleccionado${count !== 1 ? 's' : ''}`}
                </span>
                <button
                    disabled={count === 0 || loading || fetchingStats}
                    onClick={handleInitialClick}
                    className="w-full sm:w-auto bg-red-500 hover:bg-red-600 text-white px-8 py-3 rounded-2xl text-sm font-black uppercase tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-[0_15px_30px_-5px_rgba(239,68,68,0.3)] hover:scale-[1.02] active:scale-[0.98]"
                >
                    {fetchingStats ? <Loader2 className="h-5 w-5 animate-spin" /> : <Trash2 className="h-5 w-5" />}
                    Proceder con la limpieza
                </button>
            </div>
        </div>

        <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
            <DialogContent className="sm:max-w-md w-full border-white/10 bg-zinc-950/90 backdrop-blur-3xl rounded-3xl p-0 overflow-hidden shadow-2xl">
                <div className="p-8 space-y-6">
                  <DialogHeader className="space-y-4">
                      <DialogTitle className="flex items-center gap-4 text-2xl font-bold text-white font-playfair">
                           <div className="h-12 w-12 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20">
                             <AlertTriangle className="h-6 w-6" />
                           </div>
                           ¿Confirmar eliminación?
                      </DialogTitle>
                      <DialogDescription className="text-white/50 text-base font-medium leading-relaxed">
                          Estás a punto de eliminar permanentemente los siguientes datos. Esta acción **no se puede deshacer**.
                      </DialogDescription>
                  </DialogHeader>

                  <div className="bg-red-500/5 border border-red-500/20 rounded-[2rem] p-6 shadow-inner">
                      <div className="flex items-center gap-2 text-red-400 mb-5 font-black uppercase tracking-widest text-[10px]">
                          <AlertOctagon className="h-4 w-4" />
                          Objetos a destruir:
                      </div>
                      <div className="space-y-4">
                          {Object.entries(selected).filter(([_, v]) => v).map(([key]) => (
                              <div key={key} className="flex items-center justify-between">
                                  <span className="text-sm font-bold text-white/80">{getLabel(key)}</span>
                                  <span className="px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-black border border-red-500/20">
                                      {stats ? (stats[key] ?? 0) : '-'}
                                  </span>
                              </div>
                          ))}
                      </div>
                  </div>

                  <div className="bg-white/5 rounded-2xl p-5 text-xs text-white/30 font-medium leading-relaxed border border-white/5">
                      <strong className="text-white/50">Nota:</strong> Tu cuenta permanecerá activa y podrás seguir usando la aplicación normalmente tras el reinicio.
                  </div>
                </div>

                <DialogFooter className="p-8 pt-0 flex flex-col sm:flex-row gap-3">
                    <button
                        onClick={() => setShowConfirm(false)}
                        disabled={loading}
                        className="flex-1 px-6 py-4 rounded-2xl text-sm font-bold text-white/40 hover:text-white hover:bg-white/5 transition-all border border-transparent hover:border-white/10"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleFinalDelete}
                        disabled={loading}
                        className="flex-1 bg-red-500 hover:bg-red-600 text-white px-6 py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-xl shadow-red-500/20"
                    >
                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Trash2 className="h-5 w-5" />}
                        Sí, eliminar todo
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
  );
}
