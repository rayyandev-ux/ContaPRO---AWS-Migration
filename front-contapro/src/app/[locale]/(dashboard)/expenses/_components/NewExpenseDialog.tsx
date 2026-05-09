"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { apiJson, apiMultipart } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, UploadCloud, FileText, Image as ImageIcon } from "lucide-react";
import { Link } from "@/i18n/routing";
import GlassDatePicker from "@/components/ui/glass-date-picker";
import GlassCombobox from "@/components/ui/glass-combobox";

type Category = { id: string; name: string; userId?: string | null };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export default function NewExpenseDialog({ open, onOpenChange, onSuccess }: Props) {
  const t = useTranslations('NewExpense');
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [form, setForm] = useState({
    type: "INFORMAL",
    issuedAt: new Date().toISOString().slice(0, 10),
    provider: "",
    description: "",
    amount: "",
    currency: "PEN",
    categoryId: "",
    emitterIdNumber: "",
    paymentMethodId: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      // Reset form on open
      setForm(prev => ({
        ...prev,
        type: "INFORMAL",
        issuedAt: new Date().toISOString().slice(0, 10),
        provider: "",
        description: "",
        amount: "",
        categoryId: "",
        emitterIdNumber: "",
        paymentMethodId: "",
      }));
      setFile(null);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    (async () => {
      const res = await apiJson(`/api/proxy/categories`);
      if (res.ok) setCategories(((res.data as any)?.items || []).map((c: any) => ({ id: c.id, name: c.name, userId: c.userId ?? null })));
      
      const me = await apiJson(`/api/auth/me`);
      const pref = (me.ok && (me.data as any)?.user?.preferredCurrency) || null;
      if (pref && (pref === 'PEN' || pref === 'USD' || pref === 'EUR')) {
        setForm(f => ({ ...f, currency: pref }));
      }
      
      const pm = await apiJson(`/api/proxy/payment-methods`);
      if (pm.ok) setPaymentMethods(((pm.data as any)?.items || []));
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const amt = (() => {
      const raw = String(form.amount || '').replace(',', '.');
      const n = parseFloat(raw);
      return isFinite(n) ? n : NaN;
    })();
    
    if (!isFinite(amt) || amt <= 0) {
      setSaving(false);
      setError(t('invalidAmount'));
      return;
    }

    let res: { ok: boolean; data?: any; error?: string };
    if (!file) {
      const body = {
        type: form.type,
        issuedAt: form.issuedAt,
        provider: form.provider,
        description: form.description || undefined,
        amount: amt,
        currency: form.currency,
        categoryId: form.categoryId || undefined,
        emitterIdNumber: form.emitterIdNumber || undefined,
        paymentMethodId: form.paymentMethodId || undefined,
      };
      res = await apiJson(`/api/proxy/expenses`, { method: "POST", body: JSON.stringify(body) });
    } else {
      const fd = new FormData();
      fd.append("type", form.type);
      fd.append("issuedAt", form.issuedAt);
      fd.append("provider", form.provider);
      if (form.description) fd.append("description", form.description);
      fd.append("amount", String(amt));
      fd.append("currency", form.currency);
      if (form.categoryId) fd.append("categoryId", form.categoryId);
      if (form.emitterIdNumber) fd.append("emitterIdNumber", form.emitterIdNumber);
      if (form.paymentMethodId) fd.append("paymentMethodId", form.paymentMethodId);
      fd.append("file", file);
      res = await apiMultipart(`/api/proxy/expenses`, fd);
    }
    setSaving(false);
    
    if (!res.ok) {
      setError(res.error || t('saveError'));
      return;
    }
    
    if (onSuccess) onSuccess();
    onOpenChange(false);
  }

  const isBoleta = form.type === "BOLETA";
  const isFactura = form.type === "FACTURA";
  const idMaxLen = isBoleta ? 8 : isFactura ? 11 : 0;

  // Custom Form Row to match design
  const FormRow = ({ label, children }: { label: string, children: React.ReactNode }) => (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
      <label className="sm:w-[25%] text-sm font-medium text-white/70 sm:text-right shrink-0">
        {label}
      </label>
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[calc(100%-2rem)] p-0 border border-white/20 bg-[#121212]/80 backdrop-blur-3xl overflow-hidden flex flex-col md:flex-row h-[90vh] md:h-auto md:max-h-[800px] rounded-[2rem] sm:rounded-[2rem] shadow-2xl">
        
        {/* Left Column - Dropzone */}
        <div className="w-full md:w-[35%] bg-black/40 p-5 sm:p-6 md:p-8 flex flex-col border-b md:border-b-0 md:border-r border-white/5 relative shrink-0">
          <div className="text-center mb-6">
            <h3 className="text-sm font-medium text-white/70">Comprobante (opcional)</h3>
          </div>
          <div 
            className={`flex-1 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-6 text-center transition-colors cursor-pointer relative overflow-hidden ${
              dragActive 
                ? 'border-purple-500 bg-purple-500/10' 
                : file 
                  ? 'border-white/20 bg-white/10' 
                  : 'border-white/10 hover:border-white/20 hover:bg-white/5'
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => { 
              e.preventDefault(); 
              setDragActive(false); 
              if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]); 
            }}
          >
            <input 
              type="file" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])} 
              accept="image/*,application/pdf"
            />
            
            {file ? (
              <div className="flex flex-col items-center gap-3">
                {file.type.startsWith('image/') ? (
                   <ImageIcon className="h-12 w-12 text-emerald-400" />
                ) : (
                   <FileText className="h-12 w-12 text-emerald-400" />
                )}
                <div className="space-y-1">
                  <p className="text-sm text-white font-medium break-all line-clamp-2 px-2">{file.name}</p>
                  <p className="text-xs text-white/50">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <button 
                  type="button" 
                  className="mt-2 text-xs font-medium text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-1.5 rounded-lg transition-colors" 
                  onClick={(e) => { e.stopPropagation(); setFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                >
                  Cambiar archivo
                </button>
              </div>
            ) : (
              <>
                <div className="h-16 w-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                  <UploadCloud className="h-8 w-8 text-white/40" />
                </div>
                <p className="text-sm text-white font-medium mb-1">Haz clic para subir</p>
                <p className="text-xs text-white/50">o arrastra un archivo aquí</p>
                <p className="text-[10px] text-white/30 mt-4 uppercase tracking-wider">PNG, JPG o PDF</p>
              </>
            )}
          </div>
        </div>
        
        {/* Right Column - Form */}
        <div className="w-full md:w-[65%] flex flex-col p-5 sm:p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1 bg-black/60">
          <DialogHeader className="mb-6 text-left shrink-0">
            <DialogTitle className="text-2xl font-semibold text-white">Nueva Transacción</DialogTitle>
            <DialogDescription className="text-white/50">Agrega una nueva transacción a tu cuenta</DialogDescription>
          </DialogHeader>

          <form onSubmit={submit} className="space-y-4 sm:space-y-5 flex-1 flex flex-col">
            <FormRow label="Fecha">
              <GlassDatePicker 
                value={form.issuedAt} 
                onChange={v => setForm(f => ({ ...f, issuedAt: v }))} 
              />
            </FormRow>

            <FormRow label={t('provider')}>
              <input 
                type="text"
                placeholder={t('providerPlaceholder')} 
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-white/30 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 outline-none transition-all h-[42px]"
                value={form.provider} 
                onChange={e => setForm(f => ({ ...f, provider: e.target.value }))} 
              />
            </FormRow>

            <FormRow label={t('description')}>
              <input 
                type="text"
                placeholder="Descripción de la transacción"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-white/30 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 outline-none transition-all h-[42px]"
                value={form.description} 
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} 
              />
            </FormRow>

            <FormRow label="Monto">
              <div className="flex rounded-xl border border-white/10 bg-white/5 focus-within:border-purple-500/50 focus-within:ring-1 focus-within:ring-purple-500/50 transition-all overflow-hidden h-[42px]">
                <input 
                  type="number" 
                  step="0.01" 
                  placeholder="0.00"
                  className="flex-1 bg-transparent px-4 py-2 text-sm text-white outline-none"
                  value={form.amount} 
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} 
                />
                <div className="w-px bg-white/10" />
                <GlassCombobox
                  value={form.currency}
                  onChange={v => setForm(f => ({ ...f, currency: v }))}
                  className="bg-transparent text-white text-sm px-3 py-2 outline-none border-none shadow-none focus:ring-0 min-w-[90px] h-full rounded-r-xl rounded-l-none border-l border-white/10"
                  options={[
                    { value: "PEN", label: "PEN" },
                    { value: "USD", label: "USD" },
                    { value: "EUR", label: "EUR" }
                  ]}
                />
              </div>
            </FormRow>

            <FormRow label={t('category')}>
              <div className="flex gap-2">
                <GlassCombobox
                  value={form.categoryId}
                  onChange={v => setForm(f => ({ ...f, categoryId: v }))}
                  placeholder="Seleccionar categoría"
                  className="flex-1"
                  groups={[
                    {
                      label: t('yourCategories'),
                      options: categories.filter(c => c.userId).map(c => ({ value: c.id, label: c.name }))
                    },
                    {
                      label: t('defaultCategories'),
                      options: categories.filter(c => !c.userId).map(c => ({ value: c.id, label: c.name }))
                    }
                  ]}
                />
                <Link href="/categories" className="flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 hover:bg-white/10 transition-colors text-white/70 hover:text-white" title={t('manage')} onClick={() => onOpenChange(false)}>
                  +
                </Link>
              </div>
            </FormRow>

            <FormRow label="Tipo">
              <GlassCombobox
                  value={form.type}
                  onChange={v => setForm(f => ({ ...f, type: v }))}
                  options={[
                    { value: "INFORMAL", label: t('informal') + " (Gasto común)" },
                    { value: "FACTURA", label: t('invoice') },
                    { value: "BOLETA", label: t('receipt') }
                  ]}
              />
            </FormRow>

            {(isBoleta || isFactura) && (
              <FormRow label={isBoleta ? t('dni') : t('ruc')}>
                <input
                  type="text"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-white/30 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 outline-none transition-all h-[42px]"
                  value={form.emitterIdNumber}
                  onChange={e => {
                    const digits = idMaxLen > 0 ? e.target.value.replace(/\D+/g, "").slice(0, idMaxLen) : e.target.value;
                    setForm(f => ({ ...f, emitterIdNumber: digits }));
                  }}
                  maxLength={idMaxLen || undefined}
                  placeholder={isBoleta ? t('dni') : t('ruc')}
                  inputMode="numeric"
                />
              </FormRow>
            )}

            <FormRow label="Cuenta">
              <GlassCombobox
                  value={form.paymentMethodId}
                  onChange={v => setForm(f => ({ ...f, paymentMethodId: v }))}
                  placeholder="Sin cuenta (Automático)"
                  options={[
                    { value: "", label: "Sin cuenta (Automático)" },
                    ...paymentMethods.map((m: any) => ({
                      value: m.id,
                      label: `${m.provider} — ${m.name}${m.cardLast4 ? ` (${String(m.cardLast4).slice(-4)})` : ''}`
                    }))
                  ]}
              />
            </FormRow>

            {error && (
              <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
                {error}
              </div>
            )}

            <div className="mt-6 pt-6 flex justify-end shrink-0 border-t border-white/5">
              <Button 
                type="submit" 
                disabled={saving || !form.provider.trim() || !isFinite(parseFloat(String(form.amount).replace(',', '.'))) || parseFloat(String(form.amount).replace(',', '.')) <= 0} 
                className="w-full sm:w-auto h-11 px-8 rounded-xl bg-[#8b5cf6] hover:bg-[#7c3aed] text-white font-medium shadow-lg shadow-purple-500/20 transition-all hover:scale-105 disabled:hover:scale-100"
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Transacción
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
