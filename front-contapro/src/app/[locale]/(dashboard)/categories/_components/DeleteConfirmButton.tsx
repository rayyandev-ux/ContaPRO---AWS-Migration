"use client";

import { useState } from "react";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

export function DeleteConfirmButton({ onDelete, isDeleting }: { onDelete: () => void, isDeleting?: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const t = useTranslations('Categories');

  if (confirming) {
    return (
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-3xl bg-black/80 p-4 text-center backdrop-blur-md animate-in fade-in zoom-in-95">
        <AlertTriangle className="mb-2 h-6 w-6 text-red-400" />
        <p className="mb-4 text-sm text-white">{t('confirmDelete') || "¿Estás seguro?"}</p>
        <div className="flex gap-2">
          <button
            onClick={() => setConfirming(false)}
            disabled={isDeleting}
            className="rounded-xl bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 disabled:opacity-50"
          >
            {t('cancel') || "Cancelar"}
          </button>
          <button
            onClick={() => {
              onDelete();
              setConfirming(false);
            }}
            disabled={isDeleting}
            className="flex items-center gap-1 rounded-xl bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/30 disabled:opacity-50"
          >
            {isDeleting && <Loader2 className="h-3 w-3 animate-spin" />}
            {t('delete') || "Eliminar"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      title={t('delete') || "Eliminar"}
      className="absolute right-3 top-3 z-0 rounded-full bg-black/20 p-2 text-white/40 opacity-0 backdrop-blur-md transition-all hover:bg-red-500/20 hover:text-red-400 group-hover:opacity-100 focus:opacity-100"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
