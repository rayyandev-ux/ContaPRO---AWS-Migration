"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import GlassCombobox from "@/components/ui/glass-combobox";
import { Loader2, Layers, Wallet, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/routing";

type Transaction = any;

type Props = {
  isOpen: boolean;
  type: "category" | "paymentMethod" | null;
  transaction: Transaction | null;
  options: any[]; // Could be categories or payment methods
  onClose: () => void;
  onSave: (id: string, newValue: string) => Promise<void>;
};

export default function QuickEditModals({ isOpen, type, transaction, options, onClose, onSave }: Props) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  // Determine the current value ID to pre-select in combobox
  let currentValue = "";
  if (type === "category") {
    if (transaction?.transactionType === "EXPENSE") {
      currentValue = transaction?.category?.id || "";
    } else {
      currentValue = options.find(o => o.name === transaction?.categoryName)?.id || transaction?.categoryName || "";
    }
  } else if (type === "paymentMethod") {
    currentValue = transaction?.paymentMethod?.id || "";
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transaction || !value) return;
    setSaving(true);
    await onSave(transaction.id, value);
    setSaving(false);
    onClose();
  };

  if (!transaction || !type) return null;

  const isCategory = type === "category";
  const title = isCategory ? "Actualizar Categoría" : "Cambiar Cuenta";
  const desc = isCategory ? "Selecciona la nueva categoría para esta transacción." : "Selecciona el nuevo método de pago o cuenta.";
  const Icon = isCategory ? Layers : Wallet;

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm w-[90vw] border-white/20 bg-[#1c1c1e]/90 backdrop-blur-2xl rounded-[32px] shadow-2xl p-6 sm:p-8">
        <DialogHeader>
          <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${isCategory ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
            <Icon className="w-6 h-6" />
          </div>
          <DialogTitle className="text-xl font-semibold text-white text-center">{title}</DialogTitle>
          <DialogDescription className="text-white/50 text-sm text-center">
            {desc}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-6 mt-4">
          <div className="space-y-2.5">
            <label className="text-[11px] uppercase font-bold tracking-[0.1em] text-white/40">
              {isCategory ? "Categoría" : "Cuenta"}
            </label>
            <GlassCombobox
              value={value || currentValue || ""}
              onChange={(val) => setValue(val)}
              options={isCategory ? undefined : options.map(o => ({ value: o.id, label: `${o.provider} — ${o.name}${o.cardLast4 ? ` (${String(o.cardLast4).slice(-4)})` : ''}` }))}
              groups={isCategory ? [
                {
                  label: "Tus categorías",
                  options: options.filter(c => c.userId).map(c => ({ value: c.id, label: c.name }))
                },
                {
                  label: "Categorías del Sistema",
                  options: options.filter(c => !c.userId).map(c => ({ value: c.id, label: c.name }))
                }
              ] : undefined}
              className="w-full h-[46px] rounded-2xl"
              placeholder={`Seleccionar ${isCategory ? 'categoría' : 'cuenta'}...`}
              searchPlaceholder={isCategory ? 'Buscar categoría... (ej: "casa")' : 'Buscar cuenta...'}
              topAction={
                isCategory ? (
                  <Link
                    href="/categories"
                    onClick={onClose}
                    className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-[15px] font-semibold text-[#D4FF00] transition-colors hover:bg-white/5"
                  >
                    <Plus className="h-5 w-5" />
                    Crear nueva categoría
                  </Link>
                ) : undefined
              }
            />
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
              className="flex-1 h-11 rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border-white/10 transition-all"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving || !value || value === currentValue}
              className={`flex-1 h-11 rounded-full font-medium text-white transition-all border ${
                isCategory 
                  ? 'bg-purple-500/20 hover:bg-purple-500/30 border-purple-500/30' 
                  : 'bg-blue-500/20 hover:bg-blue-500/30 border-blue-500/30'
              }`}
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : "Guardar Cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}