"use client";
import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/routing";
import { apiJson, apiMultipart, invalidateApiCache } from "@/lib/api";
import { revalidateBudget } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { ImageIcon, FileText, UploadCloud, X, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

export default function Page() {
  const router = useRouter();
  const t = useTranslations('Upload');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (file && file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
  }, [file]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!file) {
      setError(t('errorSelectFile'));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(t('errorTooLarge'));
      return;
    }
    setLoading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { ok, data, error } = await apiMultipart("/api/upload", fd);
      if (!ok) {
        let errMsg = error || t('errorUpload');
        // Sanitizar errores técnicos
        if (errMsg.toLowerCase().includes('python') || errMsg.toLowerCase().includes('traceback') || errMsg.toLowerCase().includes('exception')) {
          errMsg = t('errorUpload');
        }
        setError(errMsg);
      } else {
        const payload: any = data || {};
        const expenseId: string | undefined = payload?.expenseId;

        // Mostrar mensaje amigable de éxito en lugar de detalles técnicos
        setResult(t('success'));

        if (expenseId) {
          // Invalidate cache and revalidate budget before navigating
          try {
             const bc = new BroadcastChannel('contapro:mutated');
             bc.postMessage('created');
             bc.close();
          } catch {}
          try { invalidateApiCache('/api'); } catch {}
          await revalidateBudget();
          router.refresh();
          // Redirigir automáticamente al detalle del gasto creado
          window.location.href = `/expenses/${expenseId}`;
        }
      }
    } catch (err) {
      setError("Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-zinc-800/50">
           <h2 className="text-lg font-playfair font-medium text-white">{t('title')}</h2>
           <p className="text-sm text-zinc-400 mt-1">{t('subtitle')}</p>
        </div>
        <div className="p-6">
           <form className="space-y-6" onSubmit={onSubmit}>
              {/* Tipos permitidos */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                 <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800/50 px-2 py-1 text-zinc-300 ring-1 ring-zinc-700/50">
                    <ImageIcon className="h-3 w-3" /> JPG/PNG
                 </span>
                 <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800/50 px-2 py-1 text-zinc-300 ring-1 ring-zinc-700/50">
                    <FileText className="h-3 w-3" /> PDF
                 </span>
                 <span className="text-zinc-500">{t('maxSize')}</span>
              </div>

              {/* Dropzone */}
              <div
                 onDrop={onDrop}
                 onDragOver={onDragOver}
                 onDragLeave={onDragLeave}
                 className={`relative rounded-xl border-2 border-dashed p-8 transition-all duration-200 ${
                    dragActive 
                    ? "border-zinc-500 bg-zinc-800/50" 
                    : "border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-900/50"
                 }`}
              >
                 <div className="flex flex-col items-center justify-center text-center">
                    <div className="h-12 w-12 rounded-xl bg-zinc-800 flex items-center justify-center mb-4">
                       <UploadCloud className="h-6 w-6 text-zinc-400" />
                    </div>
                    <p className="text-sm text-zinc-300 mb-1">
                       {t('dropzoneText')}
                       <label className="mx-1 cursor-pointer font-medium text-white hover:underline">
                          <input
                             type="file"
                             className="sr-only"
                             accept="image/*,application/pdf"
                             onChange={(e) => setFile(e.target.files?.[0] || null)}
                          />
                          {t('selectFile')}
                       </label>
                    </p>
                    <p className="text-xs text-zinc-500">{t('accepts')}</p>
                 </div>
              </div>

              {/* Resumen archivo */}
              {file && (
                 <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                             {file.type.startsWith("image/") ? (
                                <ImageIcon className="h-5 w-5 text-zinc-400" />
                             ) : (
                                <FileText className="h-5 w-5 text-zinc-400" />
                             )}
                          </div>
                          <div>
                             <p className="text-sm font-medium text-white">{file.name}</p>
                             <p className="text-xs text-zinc-500">
                                {file.type || t('unknownType')} · {formatFileSize(file.size)}
                             </p>
                          </div>
                       </div>
                       <button
                          type="button"
                          onClick={() => setFile(null)}
                          className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors">
                          <X className="h-4 w-4" />
                       </button>
                    </div>
                    {previewUrl && (
                       <div className="mt-4 overflow-hidden rounded-lg border border-zinc-800 bg-black/20">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={previewUrl} alt="Vista previa" className="max-h-64 w-full object-contain p-2" />
                       </div>
                    )}
                 </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3">
                 <Button type="submit" disabled={loading} className="bg-white text-black hover:bg-zinc-200" size="sm">
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {loading ? t('uploading') : t('uploadAndAnalyze')}
                 </Button>
                 {error && (
                    <p className="text-sm text-red-400">{error}</p>
                 )}
                 {result && (
                    <p className="text-sm text-green-400">{result}</p>
                 )}
              </div>
           </form>
        </div>
    </div>
  );
}
