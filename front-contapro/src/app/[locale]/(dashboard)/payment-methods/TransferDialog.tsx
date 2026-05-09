"use client";
import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import GlassCombobox from "@/components/ui/glass-combobox";
import { ArrowRightLeft } from "lucide-react";

type Method = {
  id: string;
  name: string;
  currency: string;
  balance: number;
};

type Props = {
  method: Method;
  allMethods: Method[];
  onTransfer: (formData: FormData) => Promise<void>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function TransferDialog({ method, allMethods, onTransfer, open, onOpenChange }: Props) {
  const availableTargets = allMethods.filter((m) => m.id !== method.id);

  const handleSubmit = async (formData: FormData) => {
    formData.set("sourceId", method.id);
    await onTransfer(formData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-full border-white/20 bg-white/10 backdrop-blur-2xl rounded-[32px] shadow-2xl p-6 sm:p-8">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mb-4">
            <ArrowRightLeft className="w-6 h-6 text-blue-400" />
          </div>
          <DialogTitle className="text-xl font-semibold text-white text-center">Transferir Dinero</DialogTitle>
          <DialogDescription className="text-white/50 text-sm text-center">
            Mover saldo desde {method.name} ({method.currency}) a otra cuenta
          </DialogDescription>
        </DialogHeader>

        {availableTargets.length === 0 ? (
          <div className="text-center py-6 text-white/50">
            No tienes otras cuentas disponibles para transferir.
          </div>
        ) : (
          <form action={handleSubmit} className="space-y-6 mt-2">
            <div className="space-y-2.5">
              <label className="text-[11px] uppercase font-bold tracking-[0.1em] text-white/40">
                Cuenta Destino
              </label>
              <GlassCombobox
                name="targetAccountId"
                options={availableTargets.map(m => ({ value: m.id, label: `${m.name} (${m.currency})` }))}
                className="rounded-2xl h-[46px]"
              />
            </div>

            <div className="space-y-2.5">
              <label className="text-[11px] uppercase font-bold tracking-[0.1em] text-white/40">
                Monto a Transferir
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 font-mono">
                  {method.currency}
                </span>
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  max={method.balance}
                  min="0.01"
                  required
                  placeholder="0.00"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 pl-14 pr-4 py-3 h-[46px] text-sm text-white focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30 placeholder:text-white/30 backdrop-blur transition-all"
                />
              </div>
              <p className="text-[10px] text-white/40 text-right">Disponible: {method.balance.toLocaleString()} {method.currency}</p>
            </div>

            <div className="space-y-2.5">
              <label className="text-[11px] uppercase font-bold tracking-[0.1em] text-white/40">
                Descripción (Opcional)
              </label>
              <input
                name="description"
                placeholder="Ej. Transferencia para ahorros"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30 placeholder:text-white/30 backdrop-blur transition-all"
              />
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
                className="flex-1 flex items-center justify-center px-6 py-2.5 rounded-full bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-white font-medium backdrop-blur transition-all text-sm active:scale-95"
              >
                Confirmar Transferencia
              </button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
