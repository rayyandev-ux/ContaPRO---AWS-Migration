'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

export default function CategoryBudgetGuard({ month, year, generalAmount, totalAssigned, currency }: { month: number; year: number; generalAmount: number; totalAssigned: number; currency: string }) {
  const t = useTranslations('Dashboard');
  const [maxAllowed, setMaxAllowed] = useState<number>(Math.max(0, generalAmount - totalAssigned));

  useEffect(() => {
    const sel = document.querySelector('select[name="categoryId"]') as HTMLSelectElement | null;
    const input = document.querySelector('input[name="catAmount"]') as HTMLInputElement | null;
    const compute = async (categoryId: string | null) => {
      let currentAmt = 0;
      if (categoryId) {
        try {
          const qs = new URLSearchParams({ categoryId, month: String(month), year: String(year) }).toString();
          const res = await fetch(`/api/proxy/budget/category?${qs}`, { cache: 'no-store' });
          if (res.ok) {
            const d = await res.json();
            currentAmt = Number(d?.budget?.amount ?? 0);
          }
        } catch {}
      }
      const sumOther = Math.max(0, totalAssigned - currentAmt);
      const max = Math.max(0, generalAmount - sumOther);
      setMaxAllowed(max);
      if (input) {
        input.max = String(max);
        const val = Number(input.value);
        if (!Number.isNaN(val) && val > max) input.value = String(max);
      }
    };
    compute(sel?.value || null);
    const onChange = () => compute(sel?.value || null);
    sel?.addEventListener('change', onChange);
    return () => sel?.removeEventListener('change', onChange);
  }, [generalAmount, totalAssigned, month, year]);

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
  return (
    <div className="mt-2 text-xs text-white bg-white/5 border border-white/10 backdrop-blur rounded-md p-2 inline-block">
      {t('maxAllowed')}: {fmt(maxAllowed)}
    </div>
  );
}