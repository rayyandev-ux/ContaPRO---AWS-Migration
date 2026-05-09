'use client';
import React, { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { invalidateApiCache } from '@/lib/api';
import { revalidateBudget } from '@/app/actions';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export default function ConfirmDeleteButton({ categoryId }: { categoryId: string }) {
  const t = useTranslations('Dashboard');
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const handleDelete = async () => {
    setIsConfirmOpen(false);
    try {
      setLoading(true);
      const now = new Date();
      const qs = new URLSearchParams({ categoryId, month: String(now.getMonth() + 1), year: String(now.getFullYear()) }).toString();
      const res = await fetch(`/api/proxy/budget/category?${qs}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        let msg = `Error ${res.status}`;
        try { const j = await res.json(); msg = String(j?.error || j?.message || msg); } catch {}
        // Podríamos usar un toast aquí en lugar de alert
      }
      try {
        const bc = new BroadcastChannel('contapro:mutated');
        bc.postMessage({ type: 'budget-category:deleted', categoryId });
        bc.close();
      } catch {}
      try { invalidateApiCache('/api'); } catch {}
      await revalidateBudget();
    } catch {}
    finally {
      setLoading(false);
      router.refresh();
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsConfirmOpen(true)}
        className="btn-icon text-white bg-white/5 hover:bg-white/10 border border-white/10 backdrop-blur rounded-md p-2 absolute right-2 top-2 z-10 disabled:opacity-60 transition-colors"
        title={t('deleteBudget')}
        aria-label={t('deleteBudget')}
        disabled={loading}
      >
        <X />
      </button>

      <ConfirmDialog 
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        title={t('deleteBudget')}
        description={t('deleteBudgetConfirm')}
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={handleDelete}
        loading={loading}
      />
    </>
  );
}
