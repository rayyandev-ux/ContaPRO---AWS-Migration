"use client";
import { BASE } from "@/lib/api";

import { useState, useEffect, useRef } from "react";
import { Bell, Check, X, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";

type PendingExpense = {
  id: string;
  amount: number;
  currency: string;
  description: string | null;
  merchant: string | null;
  source: string;
  date: string;
  createdAt: string;
};

export default function NotificationsMenu() {
  const [items, setItems] = useState<PendingExpense[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  async function fetchPending() {
    try {
      const res = await fetch(BASE + "/api/expenses/pending");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  }

  // Polling every 30 seconds
  useEffect(() => {
    fetchPending();
    const interval = setInterval(fetchPending, 30000);
    return () => clearInterval(interval);
  }, []);

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  async function handleAction(id: string, action: "approve" | "reject") {
    setProcessingId(id);
    try {
      const res = await fetch(`${BASE}/api/expenses/pending/${id}/${action}`, {
        method: "POST",
      });
      
      if (!res.ok) throw new Error("Error en la operación");

      toast.success(action === "approve" ? "Gasto aprobado" : "Gasto rechazado");
      
      // Remove item locally for instant feedback
      setItems((prev) => prev.filter((i) => i.id !== id));
      
      // Trigger global refresh if needed
      // const bc = new BroadcastChannel('contapro:mutated');
      // bc.postMessage('refresh');
      // bc.close();
    } catch (error) {
      toast.error("No se pudo procesar la solicitud");
    } finally {
      setProcessingId(null);
    }
  }

  const hasItems = items.length > 0;

  return (
    <div className="relative" ref={menuRef}>
      <button
        className="relative flex items-center justify-center gap-2 px-4 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-all shadow-lg"
        onClick={() => setOpen(!open)}
      >
        <Bell className={`h-5 w-5 ${hasItems ? "text-white" : "text-white/70"}`} />
        {hasItems && (
          <span className="flex items-center justify-center bg-blue-500 text-white text-[10px] font-bold h-5 min-w-[20px] px-1.5 rounded-full">
            {items.length}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute right-0 top-full mt-2 w-[80vw] sm:w-[380px] z-50 bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl ring-1 ring-white/10 rounded-3xl overflow-hidden origin-top-right text-white"
          >
            <div className="p-4 border-b border-white/10 bg-white/5">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm text-white">Notificaciones</h4>
                <span className="text-xs text-white/70 bg-white/10 px-2 py-0.5 rounded-full border border-white/10">
                  {items.length} pendientes
                </span>
              </div>
            </div>

            <div className="max-h-[400px] overflow-y-auto p-2 space-y-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              {items.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="bg-white/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Bell className="h-5 w-5 text-white/50" />
                  </div>
                  <p className="text-sm text-white/80 font-medium">Todo al día</p>
                  <p className="text-xs text-white/50 mt-1">No tienes gastos pendientes de revisión.</p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {items.map((item) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
                      className="bg-white/5 border border-white/10 rounded-2xl p-3 hover:bg-white/10 transition-colors group"
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                              {item.source}
                            </span>
                            <span className="text-[10px] text-white/50">
                              {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: es })}
                            </span>
                          </div>
                          
                          <p className="text-sm font-medium text-white truncate">
                            {item.description || item.merchant || "Gasto sin descripción"}
                          </p>
                          
                          <div className="mt-1 flex items-baseline gap-1">
                            <span className="text-sm font-semibold text-white">
                              {item.currency} {item.amount.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 mt-3 pt-3 border-t border-white/10">
                        <Button
                          size="sm"
                          variant="default"
                          className="flex-1 h-8 bg-white text-black hover:bg-white/90 font-medium text-xs gap-1.5 rounded-xl"
                          onClick={() => handleAction(item.id, "approve")}
                          disabled={processingId === item.id}
                        >
                          {processingId === item.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Check className="h-3 w-3" />
                          )}
                          Aprobar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-8 border-white/20 bg-white/5 hover:bg-white/10 text-white text-xs gap-1.5 rounded-xl"
                          onClick={() => handleAction(item.id, "reject")}
                          disabled={processingId === item.id}
                        >
                          <X className="h-3 w-3" />
                          Rechazar
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
