"use client";

import { useEffect, useState, Suspense } from "react";
import { Link } from "@/i18n/routing";
import { notFound, useSearchParams } from "next/navigation";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import ImagePreview from "@/components/ImagePreview";
import AnalysisSummaryEditor from "@/components/AnalysisSummaryEditor";
import AnalysisItemsEditor from "@/components/AnalysisItemsEditor";
import DetailEditable from "./DetailEditable";
import { Loader2 } from "lucide-react";
import { apiJson } from "@/lib/api";

function ExpenseDetailContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      try {
        const [resExpense, resMe] = await Promise.all([
          apiJson(`/api/proxy/expenses/${id}`),
          apiJson(`/api/auth/me`)
        ]);

        if (!resExpense.ok) {
          setError({ status: resExpense.error, statusText: "Not Found" });
        } else {
          setData({
            expense: resExpense.data?.item,
            me: resMe.ok ? resMe.data?.user : null
          });
        }
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  if (!id) return notFound();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-white/50" />
      </div>
    );
  }

  if (error || !data?.expense) {
    return (
      <section>
        <h1 className="text-2xl font-semibold mb-4">Gasto no encontrado</h1>
        <p className="text-sm text-white/60 mb-4">Error: {error?.status} {error?.statusText}</p>
        <Link href="/expenses" className="text-sm text-white/50 hover:text-white underline transition-colors">Volver a gastos</Link>
      </section>
    );
  }

  const it = data.expense;
  const me = data.me;
  const isCurrentMonth = (() => { const d = new Date(it.createdAt); const n = new Date(); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear(); })();

  const fmtDate = (iso?: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const datePart = (me?.dateFormat || 'DMY') === 'MDY' ? `${mm}/${dd}/${yyyy}` : `${dd}/${mm}/${yyyy}`;
    return `${datePart} ${hh}:${min}`;
  };
  const document = it?.document as { id: string; filename: string; mimeType?: string; analysis?: any } | null;
  const analysis = document?.analysis || null;
  const details = analysis?.details || null;
  const xml = details?.xml as string | undefined;

  return (
    <>
      <RealtimeRefresh />
      <DetailEditable item={{
        id: it.id,
        type: it.type,
        issuedAt: it.issuedAt,
        createdAt: it.createdAt,
        provider: it.provider,
        description: it.description,
        amount: it.amount,
        currency: it.currency,
        category: it.category || null,
        emitterIdNumber: it.emitterIdNumber || null,
        paymentMethod: it.paymentMethod || null,
        editReason: it.editReason || null,
      }} isCurrentMonth={isCurrentMonth} />

      {document ? (
        <div className="mt-6 mb-4 bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="text-xs font-medium text-white/50 uppercase tracking-wider mb-1.5">Documento</div>
              <div className="text-sm text-white font-medium">{document.filename}</div>
            </div>
            <div className="flex gap-2">
              {document.mimeType?.startsWith("image/") && (
                <a
                  href={`/api/proxy/documents/${document.id}/preview`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                >Ver foto</a>
              )}
              <a
                href={`/api/proxy/documents/${document.id}/download`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-lg bg-white/10 text-white text-sm px-3 py-2 hover:bg-white/20 border border-white/10 backdrop-blur-md transition-colors font-medium"
              >Descargar</a>
              
            </div>
          </div>
          <div className="mb-6">
            <div className="text-xs font-medium text-white/50 uppercase tracking-wider mb-1.5">Resumen IA</div>
            {document ? (
              <AnalysisSummaryEditor documentId={document.id} initialSummary={analysis?.summary || ""} />
            ) : (
              <div className="text-sm text-white/60">—</div>
            )}
          </div>
          {document.mimeType?.startsWith("image/") && (
            <div className="mb-6">
              <div className="text-xs font-medium text-white/50 uppercase tracking-wider mb-1.5">Previsualización</div>
              <div className="mt-2 overflow-hidden rounded-lg border border-white/10 bg-white/5 backdrop-blur-md">
                <ImagePreview
                  src={`/api/proxy/documents/${document.id}/preview`}
                  alt={document.filename}
                />
              </div>
            </div>
          )}
          <AnalysisItemsEditor documentId={document.id} initialItems={(details && Array.isArray(details.items) ? details.items : [])} />
        </div>
      ) : (
        <div className="mt-6 mb-6 bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-8 text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
            <span className="text-xl">📄</span>
          </div>
          <h3 className="text-white/90 font-medium mb-1">Sin documento asociado</h3>
          <p className="text-white/50 text-sm">Este gasto fue registrado manualmente sin comprobante.</p>
        </div>
      )}
    </>
  );
}

export default function ExpenseDetail() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-white/50" /></div>}>
      <ExpenseDetailContent />
    </Suspense>
  );
}
