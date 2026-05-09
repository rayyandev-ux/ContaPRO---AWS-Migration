"use client";
import { useEffect, useMemo, useState } from "react";
import { apiJson } from "@/lib/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, FileImage, FileText, FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

type Item = { id: string; filename: string; uploadedAt: string; summary?: string };

export default function Page() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    (async () => {
      try {
        const { ok, data, error } = await apiJson("/api/history");
        if (!ok) {
          setError(error || "Error al cargar historial");
        } else {
          setItems((data as any)?.items || []);
        }
      } catch (err) {
        setError("Error inesperado");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Reiniciar a la primera página cada vez que cambian los datos
  useEffect(() => {
    setPage(1);
  }, [items.length]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(items.length / pageSize)), [items.length]);
  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, items.length);
  const pageItems = items.slice(startIndex, startIndex + pageSize);

  const getVisiblePages = (current: number, total: number) => {
    const pages: (number | string)[] = [];
    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
      return pages;
    }
    pages.push(1);
    let start = Math.max(2, current - 1);
    let end = Math.min(total - 1, current + 1);
    if (start > 2) pages.push("…");
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < total - 1) pages.push("…");
    pages.push(total);
    return pages;
  };

  const getExt = (filename: string | undefined) =>
    (filename?.split(".").pop() || "DOC").toUpperCase();

  const badgeClasses = (ext: string) => {
    switch (ext) {
      case "PDF":
        return "bg-zinc-500/10 text-zinc-300 ring-1 ring-zinc-500/20";
      case "PNG":
        return "bg-zinc-500/10 text-zinc-300 ring-1 ring-zinc-500/20";
      case "JPG":
      case "JPEG":
        return "bg-zinc-500/10 text-zinc-300 ring-1 ring-zinc-500/20";
      case "GIF":
        return "bg-zinc-500/10 text-zinc-300 ring-1 ring-zinc-500/20";
      default:
        return "bg-muted text-foreground ring-1 ring-border";
    }
  };

  return (
    <section className="space-y-6 max-w-[1600px] w-full mx-auto px-6 md:px-8 xl:px-12 py-6 md:py-8 lg:py-10">
      <div className="mb-6">
        <h1 className="text-4xl md:text-5xl font-playfair font-bold text-white tracking-tight">Historial</h1>
        <p className="text-base text-muted-foreground mt-1">Documentos subidos y analizados.</p>
      </div>

      <Card className="panel-bg">
        <CardHeader>
          <CardTitle className="font-playfair">Registros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Archivo</TableHead>
                  <TableHead>Resumen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={3}>Cargando...</TableCell>
                  </TableRow>
                )}
                {error && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-destructive">{error}</TableCell>
                  </TableRow>
                )}
                {!loading && !error && items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3}>Sin registros</TableCell>
                  </TableRow>
                )}
                {pageItems.map((it) => {
                  const ext = getExt(it.filename);
                  const Icon = ext === "PDF" ? FileText : ext ? FileImage : FileQuestion;
                  return (
                    <TableRow key={it.id} className="hover:bg-muted/50">
                      <TableCell className="whitespace-nowrap">{new Date(it.uploadedAt).toLocaleString()}</TableCell>
                      <TableCell className="max-w-[320px]">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs ring-1 ${badgeClasses(ext)}`}>
                            <Icon className="h-3.5 w-3.5" /> {ext}
                          </span>
                          <span className="truncate" title={it.filename}>{it.filename}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[420px] truncate" title={it.summary}>{it.summary}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Paginación */}
          {!loading && !error && items.length > 0 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Mostrando <span className="font-medium">{startIndex + 1}</span>–<span className="font-medium">{endIndex}</span> de <span className="font-medium">{items.length}</span>
              </p>
              <nav className="flex items-center gap-1">
                <Button size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="gap-1 px-2">
                  <ChevronLeft className="h-4 w-4" /> Prev
                </Button>
                {getVisiblePages(page, totalPages).map((p, idx) =>
                  typeof p === "number" ? (
                    <Button key={idx} size="sm" onClick={() => setPage(p)} className="px-3">
                      {p}
                    </Button>
                  ) : (
                    <span key={idx} className="px-2 text-sm text-muted-foreground">{p}</span>
                  )
                )}
                <Button size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="gap-1 px-2">
                  Siguiente <ChevronRight className="h-4 w-4" />
                </Button>
              </nav>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}