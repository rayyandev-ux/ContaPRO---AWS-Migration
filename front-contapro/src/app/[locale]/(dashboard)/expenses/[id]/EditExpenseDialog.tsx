"use client";
import { useState, useEffect, useMemo, type ReactNode } from "react";
import { useRouter } from "@/i18n/routing";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import GlassCombobox from "@/components/ui/glass-combobox";
import GlassDatePicker from "@/components/ui/glass-date-picker";
import { apiJson, invalidateApiCache } from "@/lib/api";
import { revalidateBudget } from "@/app/actions";

type Category = { id: string; name: string };
type PaymentMethod = { id: string; name: string };
type ExpenseItem = {
  id: string;
  type: string;
  issuedAt: string;
  provider: string;
  description?: string | null;
  amount: number;
  currency: string;
  category?: Category | null;
  paymentMethod?: PaymentMethod | null;
  emitterIdNumber?: string | null;
  editReason?: string | null;
};

type Props = {
  item: ExpenseItem;
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export default function EditExpenseDialog({ item, children, open: externalOpen, onOpenChange: setExternalOpen }: Props) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = (val: boolean) => {
    if (setExternalOpen) setExternalOpen(val);
    else setInternalOpen(val);
  };

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  const [form, setForm] = useState({
    type: item.type,
    issuedAt: (item.issuedAt || "").slice(0, 10),
    provider: item.provider || "",
    description: item.description || "",
    amount: String(item.amount ?? ""),
    currency: item.currency || "PEN",
    categoryId: item.category?.id || "",
    paymentMethodId: item.paymentMethod?.id || "",
    editReason: item.editReason || "",
    emitterIdNumber: item.emitterIdNumber || "",
  });

  // Fetch combo data on open
  useEffect(() => {
    if (open && categories.length === 0) {
      (async () => {
        const [resCat, resPm] = await Promise.all([
          apiJson(`/api/categories`),
          apiJson(`/api/payment-methods`)
        ]);
        if (resCat.ok) setCategories(((resCat.data as any)?.items || []).map((c: any) => ({ id: c.id, name: c.name })));
        if (resPm.ok) setPaymentMethods(((resPm.data as any)?.items || []).map((pm: any) => ({ id: pm.id, name: pm.name })));
      })();
    }
  }, [open, categories.length]);

  // Reset form when reopened
  useEffect(() => {
    if (open) {
      setForm({
        type: item.type,
        issuedAt: (item.issuedAt || "").slice(0, 10),
        provider: item.provider || "",
        description: item.description || "",
        amount: String(item.amount ?? ""),
        currency: item.currency || "PEN",
        categoryId: item.category?.id || "",
        paymentMethodId: item.paymentMethod?.id || "",
        editReason: item.editReason || "",
        emitterIdNumber: item.emitterIdNumber || "",
      });
      setError(null);
    }
  }, [open, item]);

  const canSubmit = useMemo(() => {
    const amt = Number(form.amount);
    return !saving && form.provider.trim().length > 0 && !Number.isNaN(amt) && amt > 0;
  }, [saving, form.amount, form.provider]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    
    const payload = {
      type: form.type,
      issuedAt: form.issuedAt,
      provider: form.provider,
      description: form.description || null,
      amount: Number(form.amount),
      currency: form.currency,
      categoryId: form.categoryId || null,
      paymentMethodId: form.paymentMethodId || null,
      editReason: form.editReason || null,
      emitterIdNumber: form.emitterIdNumber || null,
    };

    const res = await apiJson(`/api/expenses/${item.id}`, { method: "PUT", body: JSON.stringify(payload) });
    setSaving(false);
    
    if (!res.ok) {
      setError(res.error || "Error al actualizar gasto.");
      return;
    }

    try {
      const bc = new BroadcastChannel('contapro:mutated');
      bc.postMessage('updated');
      bc.close();
    } catch {}
    try { invalidateApiCache('/api'); } catch {}
    
    await revalidateBudget();
    
    // Forzar actualización inmediata del router para refrescar Server Components
    router.refresh();
    
    // Pequeño retraso para asegurar que el refresh se inicie antes de cerrar el modal
    setTimeout(() => {
      setOpen(false);
    }, 100);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      
      {/* GLASSSMORPHISM PREMIUM STYLE EXACT TO EditMethodDialog */}
      <DialogContent className="sm:max-w-2xl w-full border-white/20 bg-white/10 backdrop-blur-2xl rounded-[32px] shadow-2xl p-6 sm:p-8 overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-white">Editar Gasto</DialogTitle>
          <DialogDescription className="text-white/50 text-sm">
            Actualiza los datos de este gasto. Los cambios afectarán automáticamente a tus reportes.
          </DialogDescription>
        </DialogHeader>

        {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-6 mt-2">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Amount / Monto */}
            <div className="space-y-2.5">
              <label className="text-[11px] uppercase font-bold tracking-[0.1em] text-white/40">Monto</label>
              <div className="flex gap-2 h-[46px]">
                <input 
                  type="number" step="0.01" required
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/30 placeholder:text-white/30 backdrop-blur transition-all"
                  value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                />
                <div className="w-28">
                  <GlassCombobox
                    options={[{ value: "PEN", label: "PEN" }, { value: "USD", label: "USD" }, { value: "EUR", label: "EUR" }]}
                    value={form.currency}
                    onChange={v => setForm(f => ({ ...f, currency: v }))}
                    className="h-full rounded-2xl"
                  />
                </div>
              </div>
            </div>

            {/* Provider */}
            <div className="space-y-2.5">
              <label className="text-[11px] uppercase font-bold tracking-[0.1em] text-white/40">Proveedor</label>
              <input
                required
                className="w-full flex h-[46px] rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/30 placeholder:text-white/30 backdrop-blur transition-all"
                value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
              />
            </div>

            {/* Date */}
            <div className="space-y-2.5">
              <label className="text-[11px] uppercase font-bold tracking-[0.1em] text-white/40">Fecha de emisión</label>
              <GlassDatePicker
                 value={form.issuedAt}
                 onChange={v => setForm(f => ({ ...f, issuedAt: v }))}
              />
            </div>

            {/* Document Type */}
            <div className="space-y-2.5">
              <label className="text-[11px] uppercase font-bold tracking-[0.1em] text-white/40">Tipo de Documento</label>
              <GlassCombobox
                options={[
                  { value: "FACTURA", label: "Factura" },
                  { value: "BOLETA", label: "Boleta" },
                  { value: "INFORMAL", label: "Informal" }
                ]}
                value={(['FACTURA', 'BOLETA'].includes(form.type)) ? form.type : 'INFORMAL'}
                onChange={v => setForm(f => ({ ...f, type: v as any }))}
                className="h-[46px] rounded-2xl"
              />
            </div>

            {/* Category */}
            <div className="space-y-2.5">
              <label className="text-[11px] uppercase font-bold tracking-[0.1em] text-white/40">Categoría</label>
              <GlassCombobox
                options={categories.map(c => ({ value: c.id, label: c.name }))}
                value={form.categoryId}
                onChange={v => setForm(f => ({ ...f, categoryId: v }))}
                placeholder="Seleccionar..."
                className="h-[46px] rounded-2xl"
              />
            </div>

            {/* Payment Method */}
            <div className="space-y-2.5">
              <label className="text-[11px] uppercase font-bold tracking-[0.1em] text-white/40">Método de Pago</label>
              <GlassCombobox
                options={paymentMethods.map(m => ({ value: m.id, label: m.name }))}
                value={form.paymentMethodId}
                onChange={v => setForm(f => ({ ...f, paymentMethodId: v }))}
                placeholder="Seleccionar..."
                className="h-[46px] rounded-2xl"
              />
            </div>

            <div className="space-y-2.5">
              <label className="text-[11px] uppercase font-bold tracking-[0.1em] text-white/40">ID Emisor / RUC</label>
              <input
                className="w-full flex h-[46px] rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/30 placeholder:text-white/30 backdrop-blur transition-all"
                value={form.emitterIdNumber} onChange={e => setForm(f => ({ ...f, emitterIdNumber: e.target.value }))}
                placeholder="104XXXX / DNI"
              />
            </div>
            
            <div className="space-y-2.5">
              <label className="text-[11px] uppercase font-bold tracking-[0.1em] text-white/40">Motivo de Edición</label>
              <input
                className="w-full flex h-[46px] rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/30 placeholder:text-white/30 backdrop-blur transition-all"
                value={form.editReason} onChange={e => setForm(f => ({ ...f, editReason: e.target.value }))}
                placeholder="Ej. Corrección manual"
              />
            </div>
            
          </div>

          <div className="space-y-2.5">
            <label className="text-[11px] uppercase font-bold tracking-[0.1em] text-white/40">Descripción</label>
            <input
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/30 placeholder:text-white/30 backdrop-blur transition-all"
              value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Detalles adicionales..."
            />
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={saving}
              className="flex-1 flex items-center justify-center px-6 py-2.5 rounded-full bg-white/5 text-white/70 font-medium hover:bg-white/10 hover:text-white backdrop-blur border border-white/10 transition-all text-sm active:scale-95 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!canSubmit || saving}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium backdrop-blur transition-all text-sm active:scale-95 shadow-[0_0_20px_-4px_rgba(255,255,255,0.05)] disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar Cambios"}
            </button>
          </DialogFooter>

        </form>
      </DialogContent>
    </Dialog>
  );
}
