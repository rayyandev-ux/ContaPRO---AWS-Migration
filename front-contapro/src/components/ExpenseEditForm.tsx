"use client";
import { useEffect, useState } from "react";
import { apiJson, invalidateApiCache } from "@/lib/api";
import GlassDatePicker from "@/components/ui/glass-date-picker";
import GlassCombobox from "@/components/ui/glass-combobox";

type Category = { id: string; name: string; userId?: string | null };
type Expense = {
  id: string;
  type: "FACTURA" | "BOLETA" | "INFORMAL" | "YAPE" | "PLIN" | "TUNKI" | "LEMONPAY" | "BCP" | "INTERBANK" | "SCOTIABANK" | "BBVA";
  issuedAt: string;
  provider: string;
  description?: string | null;
  amount: number;
  currency: string;
  category?: Category | null;
};

export default function ExpenseEditForm({ item }: { item: Expense }) {
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState({
    type: item.type,
    issuedAt: item.issuedAt?.slice(0, 10),
    provider: item.provider || "",
    description: item.description || "",
    amount: String(item.amount ?? ""),
    currency: item.currency || "PEN",
    categoryId: item.category?.id || "",
    editReason: "",
  });

  const [newCatName, setNewCatName] = useState("");
  const [creatingCat, setCreatingCat] = useState(false);
  const [showCatManager, setShowCatManager] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await apiJson(`/api/categories`);
      if (res.ok) setCategories(((res.data as any)?.items || []).map((c: any) => ({ id: c.id, name: c.name, userId: c.userId ?? null })));
    })();
  }, []);

  async function createCategory() {
    if (!newCatName.trim()) return;
    setCreatingCat(true);
    const res = await apiJson(`/api/categories`, { method: "POST", body: JSON.stringify({ name: newCatName.trim() }) });
    setCreatingCat(false);
    if (!res.ok) {
      setError(res.error || "No se pudo crear la categoría");
      return;
    }
    const cat = (res.data as any)?.item as Category;
    setCategories(prev => [...prev, { id: cat.id, name: cat.name, userId: (cat as any)?.userId ?? null }].sort((a, b) => a.name.localeCompare(b.name)));
    setForm(f => ({ ...f, categoryId: cat.id }));
    setNewCatName("");
  }

  async function deleteCategory(id: string) {
    const cat = categories.find(c => c.id === id);
    if (!cat || cat.userId == null) return;
    const ok = confirm("¿Eliminar esta categoría? Se quitará de tus gastos.");
    if (!ok) return;
    const res = await apiJson(`/api/categories/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      setError(res.error || 'No se pudo eliminar la categoría');
      return;
    }
    setCategories(prev => prev.filter(c => c.id !== id));
    setForm(f => ({ ...f, categoryId: f.categoryId === id ? '' : f.categoryId }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    const payload: any = {
      type: form.type,
      issuedAt: form.issuedAt,
      provider: form.provider,
      description: form.description || null,
      amount: Number(form.amount),
      currency: form.currency,
      categoryId: form.categoryId ? form.categoryId : null,
      editReason: form.editReason ? form.editReason : null,
    };
    const res = await apiJson(`/api/expenses/${item.id}`, { method: "PUT", body: JSON.stringify(payload) });
    setSaving(false);
    if (!res.ok) {
      setError(res.error || "No se pudo guardar");
      return;
    }
    setSuccess("Gasto actualizado");
    setOpen(false);
    try { invalidateApiCache('/api'); } catch {}
  }

  return (
    <div className="space-y-3">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="btn-panel">Editar gasto</button>
      ) : (
        <form className="space-y-4" onSubmit={submit}>
          <div className="flex justify-between">
            <span className="text-sm font-medium">Editar gasto</span>
            <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted/50">Cerrar</button>
          </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm">Tipo de documento</label>
          <GlassCombobox
            value={(form.type === 'FACTURA' || form.type === 'BOLETA') ? form.type : 'INFORMAL'}
            onChange={v => setForm(f => ({ ...f, type: v as any }))}
            options={[
              { value: "FACTURA", label: "Factura" },
              { value: "BOLETA", label: "Boleta" },
              { value: "INFORMAL", label: "Informal" }
            ]}
          />
        </div>
        <div>
          <label className="block text-sm">Fecha</label>
          <GlassDatePicker value={form.issuedAt} onChange={v => setForm(f => ({ ...f, issuedAt: v }))} />
        </div>
        <div>
          <label className="block text-sm">Moneda</label>
          <GlassCombobox
            value={form.currency}
            onChange={v => setForm(f => ({ ...f, currency: v }))}
            options={[
              { value: "PEN", label: "PEN" },
              { value: "USD", label: "USD" },
              { value: "EUR", label: "EUR" }
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-sm">Proveedor</label>
          <input className="border border-border rounded-md p-2 w-full bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm">Monto</label>
          <input type="number" step="0.01" className="border border-border rounded-md p-2 w-full bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm">Categoría</label>
          <div className="flex gap-2">
            <div className="flex-1">
              <GlassCombobox
                value={form.categoryId}
                onChange={v => setForm(f => ({ ...f, categoryId: v }))}
                placeholder="—"
                groups={[
                  {
                    label: "Tus categorías",
                    options: categories.filter(c => c.userId).map(c => ({ value: c.id, label: c.name }))
                  },
                  {
                    label: "Predeterminadas",
                    options: categories.filter(c => !c.userId).map(c => ({ value: c.id, label: c.name }))
                  }
                ]}
              />
            </div>
            <button type="button" className="rounded-md border border-border px-3 py-2 whitespace-nowrap hover:bg-muted/50" onClick={() => setShowCatManager(s => !s)}>Administrar</button>
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm">Crear categoría</label>
          <div className="flex gap-2">
            <input className="border border-border rounded-md p-2 w-full bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Nueva categoría" value={newCatName} onChange={e => setNewCatName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); createCategory(); } }} />
            <button type="button" disabled={creatingCat || !newCatName.trim()} onClick={createCategory} className="rounded-md border border-border px-4 py-2 hover:bg-muted/50 disabled:opacity-60">{creatingCat ? 'Creando...' : 'Crear'}</button>
          </div>
          {showCatManager && (
            <div className="mt-3 rounded-md border border-border p-3">
              <div className="text-sm mb-2">Tus categorías</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {categories.filter(c => c.userId).map(c => (
                  <div key={c.id} className="flex items-center justify-between rounded-md border px-2 py-1 text-xs">
                    <span className="truncate">{c.name}</span>
                    <button type="button" className="rounded-md border px-2 py-0.5 hover:bg-red-50 text-red-600" onClick={() => deleteCategory(c.id)}>Eliminar</button>
                  </div>
                ))}
                {categories.filter(c => c.userId).length === 0 && (
                  <div className="text-xs text-muted-foreground">Aún no has creado categorías propias</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm">Descripción</label>
        <input className="border border-border rounded-md p-2 w-full bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
      </div>

      <div>
        <label className="block text-sm">Motivo de la edición (opcional)</label>
        <input className="border border-border rounded-md p-2 w-full bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Explica brevemente el cambio" value={form.editReason} onChange={e => setForm(f => ({ ...f, editReason: e.target.value }))} />
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {success && <p className="text-green-700 text-sm">{success}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={saving || !form.provider.trim() || !(Number(form.amount) > 0)} className="btn-important">Guardar cambios</button>
      </div>
        </form>
      )}
    </div>
  );
}
