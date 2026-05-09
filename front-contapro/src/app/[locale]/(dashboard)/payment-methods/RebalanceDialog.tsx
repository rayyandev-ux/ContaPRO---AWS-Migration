"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RefreshCcw } from "lucide-react";

type Method = {
  id: string;
  name: string;
  currency: string;
  balance: number;
};

type Props = {
  method: Method;
  onRebalance: (formData: FormData) => Promise<void>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function RebalanceDialog({ method, onRebalance, open, onOpenChange }: Props) {
  const [realBalance, setRealBalance] = useState(method.balance);
  const difference = realBalance - method.balance;

  const handleSubmit = async (formData: FormData) => {
    formData.set("id", method.id);
    formData.set("realBalance", String(realBalance));
    await onRebalance(formData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-full border-white/20 bg-white/10 backdrop-blur-2xl rounded-[32px] shadow-2xl p-6 sm:p-8">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
            <RefreshCcw className="w-6 h-6 text-emerald-400" />
          </div>
          <DialogTitle className="text-xl font-semibold text-white text-center">Rebalancear Cuenta</DialogTitle>
          <DialogDescription className="text-white/50 text-sm text-center">
            Ajusta el saldo de {method.name} ({method.currency}) para que coincida con la realidad.
          </DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className="space-y-6 mt-2">
          <div className="bg-white/5 rounded-xl p-4 border border-white/10 flex justify-between items-center">
            <span className="text-white/50 text-sm">Saldo actual en sistema</span>
            <span className="text-white font-mono">{method.balance.toLocaleString()} {method.currency}</span>
          </div>

          <div className="space-y-2.5">
            <label className="text-[11px] uppercase font-bold tracking-[0.1em] text-white/40">
              Saldo Real (Físico/Banco)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 font-mono">
                {method.currency}
              </span>
              <input
                type="number"
                step="0.01"
                required
                value={realBalance}
                onChange={(e) => setRealBalance(Number(e.target.value))}
                className="w-full rounded-2xl border border-white/10 bg-white/5 pl-14 pr-4 py-3 h-[46px] text-sm text-white focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 placeholder:text-white/30 backdrop-blur transition-all"
              />
            </div>
            
            {difference !== 0 && (
              <p className={`text-[10px] text-right mt-1 ${difference > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                Ajuste: {difference > 0 ? '+' : ''}{difference.toLocaleString()} {method.currency}
              </p>
            )}
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex-1 flex items-center justify-center px-6 py-2.5 rounded-full bg-white/5 text-white/70 font-medium hover:bg-white/10 hover:text-white backdrop-blur border border-white/10 transition-all text-sm active:scale-95"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={difference === 0}
              className="flex-1 flex items-center justify-center px-6 py-2.5 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-white font-medium backdrop-blur transition-all text-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Ajustar Saldo
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
