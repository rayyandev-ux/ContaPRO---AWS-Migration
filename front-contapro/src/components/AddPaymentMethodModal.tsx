"use client";
import { useState, useEffect } from "react";
import { useStripe, useElements, CardElement } from "@stripe/react-stripe-js";
import { apiJson } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Loader2, CreditCard, ShieldCheck, AlertCircle } from "lucide-react";
import { toast } from "sonner";

function AddPaymentMethodForm({ onOpenChange, onSuccess }: { onOpenChange: (open: boolean) => void; onSuccess?: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!stripe) {
    return (
      <div className="p-12 text-center space-y-4">
        <Loader2 className="h-10 w-10 text-white/20 animate-spin mx-auto" />
        <p className="text-[10px] text-white/40 uppercase tracking-widest font-black">Iniciando Stripe...</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError(null);

    try {
      const res = await apiJson<{ clientSecret: string }>("/api/payments/setup-intent", { method: "POST" });
      if (!res.ok || !res.data?.clientSecret) {
        throw new Error(res.error || "Error al preparar el registro de tarjeta");
      }

      const cardElement = elements.getElement(CardElement);
      if (!cardElement) throw new Error("No se encontró el elemento de tarjeta");

      const result = await stripe.confirmCardSetup(res.data.clientSecret, {
        payment_method: {
          card: cardElement,
        },
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      toast.success("Tarjeta añadida correctamente");
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || "Error al procesar la tarjeta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-8 pt-0 space-y-6">
      <div className="space-y-4">
        <div className="p-5 rounded-2xl bg-white/5 border border-white/10 focus-within:border-white/30 transition-colors shadow-inner">
          <CardElement 
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#ffffff',
                  '::placeholder': {
                    color: 'rgba(255, 255, 255, 0.3)',
                  },
                  iconColor: '#ffffff',
                },
                invalid: {
                  color: '#ef4444',
                },
              },
            }}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium animate-in fade-in slide-in-from-top-1">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center gap-2 px-1 text-[10px] text-white/30 uppercase tracking-[0.1em] font-black">
          <ShieldCheck className="h-3 w-3" />
          <span>Encriptación de nivel bancario (AES-256)</span>
        </div>
      </div>

      <DialogFooter className="pt-2">
        <Button 
          type="submit" 
          disabled={loading || !stripe} 
          className="w-full rounded-2xl bg-white text-black hover:bg-zinc-200 h-14 text-sm font-black uppercase tracking-widest transition-all shadow-[0_20px_40px_-12px_rgba(255,255,255,0.2)] hover:scale-[1.02] active:scale-[0.98]"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : "Guardar Tarjeta"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function AddPaymentMethodModal({ open, onOpenChange, onSuccess }: { open: boolean; onOpenChange: (open: boolean) => void; onSuccess?: () => void }) {
  const [provider, setProvider] = useState<'STRIPE'>('STRIPE');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-black/80 backdrop-blur-3xl border border-white/10 text-white p-0 overflow-hidden rounded-[2rem]">
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
        
        <DialogHeader className="p-8 pb-4">
          <div className="h-12 w-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
            <CreditCard className="h-6 w-6 text-white" />
          </div>
          <DialogTitle className="text-2xl font-playfair italic">Añadir Tarjeta</DialogTitle>
          <DialogDescription className="text-white/40">
            Tus datos de pago se procesan de forma segura a través de Stripe.
          </DialogDescription>
        </DialogHeader>

        {open && <AddPaymentMethodForm onOpenChange={onOpenChange} onSuccess={onSuccess} />}
      </DialogContent>
    </Dialog>
  );
}
