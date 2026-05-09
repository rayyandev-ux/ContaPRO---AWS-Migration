'use client';
import React, { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function EditCategoryBudgetButton({
  categoryId,
  currentAmount,
  currentThreshold,
  currency,
  generalAmount,
  totalAssigned,
  month,
  year,
}: {
  categoryId: string;
  currentAmount: number;
  currentThreshold?: number | null;
  currency: string;
  generalAmount: number;
  totalAssigned: number;
  month: number;
  year: number;
}) {
  const t = useTranslations('Dashboard');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [amount, setAmount] = useState<string>(String(currentAmount ?? ''));
  const initialIsPercent = typeof currentThreshold === 'number' && currentThreshold > 0 && currentThreshold <= 1;
  const [thresholdType, setThresholdType] = useState<'amount' | 'percent'>(initialIsPercent ? 'percent' : 'amount');
  const [threshold, setThreshold] = useState<string>(
    typeof currentThreshold === 'number'
      ? (initialIsPercent ? String((currentThreshold || 0) * 100) : String(currentThreshold))
      : ''
  );
  const maxAllowed = useMemo(() => Math.max(0, generalAmount - Math.max(0, totalAssigned - (currentAmount || 0))), [generalAmount, totalAssigned, currentAmount]);
  const canSubmit = useMemo(() => {
    const a = amount.trim();
    const t = threshold.trim();
    if (a === '' || t === '') return false;
    const an = Number(a);
    const tn = Number(t);
    if (Number.isNaN(an) || an <= 0) return false;
    if (Number.isNaN(tn)) return false; // 0 permitido
    if (an > maxAllowed) return false;
    return true;
  }, [amount, threshold, maxAllowed]);

  const onSave = useCallback(async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      let thr = Number(threshold);
      if (thresholdType === 'percent' && !Number.isNaN(thr)) thr = thr / 100;
      const payload = {
        categoryId,
        month,
        year,
        amount: Number(amount),
        alertThreshold: thr,
        currency,
      };
      const res = await fetch('/api/proxy/budget/category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let msg = `Error ${res.status}`;
        try { const j = await res.json(); msg = String(j?.error || j?.message || msg); } catch {}
        alert(msg);
      } else {
        setOpen(false);
        try {
          const bc = new BroadcastChannel('contapro:mutated');
          bc.postMessage({ type: 'budget-category:updated', categoryId });
          bc.close();
        } catch {}
        router.refresh();
      }
    } catch {}
    finally {
      setSaving(false);
    }
  }, [amount, threshold, canSubmit, saving, categoryId, currency, router]);

  return (
    <div className="absolute right-10 top-2 z-10">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="btn-icon text-white hover:bg-zinc-800"
        title={t('editBudget')}
        aria-label={t('editBudget')}
      >
        <Pencil />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-50 bg-black/30" onClick={() => setOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-full sm:max-w-xl md:max-w-2xl rounded-xl border bg-card p-4 sm:p-6 shadow-lg max-h-[80vh] overflow-y-auto">
              <div className="mb-3 text-sm font-medium">{t('editCategoryBudget')}</div>
              <div className="mb-2 text-xs">{t('max')}: {new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(maxAllowed)}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">{t('amount')}</label>
                  <input type="number" step="0.01" min={0} max={maxAllowed} className="w-full border rounded-md p-2" value={amount} onChange={e => setAmount(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">{t('threshold')}</label>
                  <div className="flex items-center gap-2">
                    <div className="inline-flex items-center rounded-md ring-1 ring-border overflow-hidden">
                      <button type="button" className={`px-2 py-1 text-xs ${thresholdType === 'amount' ? 'bg-primary/20 text-primary font-medium' : 'text-muted-foreground'}`} onClick={() => setThresholdType('amount')}>{t('amountCurrency')}</button>
                      <div className="w-px h-5 bg-border"></div>
                      <button type="button" className={`px-2 py-1 text-xs ${thresholdType === 'percent' ? 'bg-primary/20 text-primary font-medium' : 'text-muted-foreground'}`} onClick={() => setThresholdType('percent')}>{t('percentage')}</button>
                    </div>
                    <div className="relative flex-1">
                      <input type="number" step="0.01" className="w-full border rounded-md p-2" value={threshold} onChange={e => setThreshold(e.target.value)} placeholder={thresholdType === 'percent' ? '20' : '100.00'} />
                      {thresholdType === 'percent' && <span className="absolute right-2 top-2 text-xs text-muted-foreground">%</span>}
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button type="button" className="btn-panel" onClick={() => setOpen(false)}>{t('cancel')}</button>
                <button type="button" className="btn-panel" disabled={!canSubmit || saving} onClick={onSave}>{t('save')}</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
