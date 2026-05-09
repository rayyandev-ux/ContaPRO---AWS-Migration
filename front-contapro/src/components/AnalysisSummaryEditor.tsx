"use client";
import { useState } from "react";

type Props = {
  documentId: string;
  initialSummary: string;
};

export default function AnalysisSummaryEditor({ documentId, initialSummary }: Props) {
  const [editing, setEditing] = useState(false);
  const [summary, setSummary] = useState(initialSummary || "");
  const [status, setStatus] = useState<"idle" | "saving" | "error" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setStatus("saving");
    setError(null);
    try {
      const res = await fetch(`/api/proxy/analysis/${documentId}/summary`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ summary }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "No se pudo guardar");
      }
      setStatus("saved");
      setEditing(false);
      setTimeout(() => setStatus("idle"), 1500);
    } catch (e: any) {
      setStatus("error");
      setError(e?.message || "Error al guardar");
    }
  }

  if (!editing) {
    return (
      <div className="flex items-start justify-between">
        <div className="text-sm">
          {summary || "—"}
          {status === "saved" ? <span className="ml-2 text-xs text-white">Guardado</span> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <textarea
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        rows={4}
        className="w-full rounded-md border border-zinc-800 bg-zinc-900/50 p-2 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-700"
        placeholder="Escribe el resumen..."
      />
      <div className="flex items-center gap-2">
        <button
          className="rounded-md bg-zinc-100 px-3 py-1 text-sm text-zinc-900 hover:bg-white disabled:opacity-60 transition-colors font-medium"
          disabled={status === "saving"}
          onClick={save}
        >
          {status === "saving" ? "Guardando…" : "Guardar"}
        </button>
        <button className="rounded-md border border-zinc-800 px-3 py-1 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors" onClick={() => { setEditing(false); setError(null); }}>
          Cancelar
        </button>
        {error ? <span className="text-xs text-zinc-400">{error}</span> : null}
      </div>
    </div>
  );
}
