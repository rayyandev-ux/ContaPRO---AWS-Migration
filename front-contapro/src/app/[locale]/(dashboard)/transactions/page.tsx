"use client";
import { useEffect, useMemo, useState } from "react";
import { Link, useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { apiJson, invalidateApiCache } from "@/lib/api";
import { revalidateBudget } from "@/app/actions";
import { Search, Plus, Receipt, DollarSign, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import GlassDateRangePicker from "@/components/ui/glass-date-range-picker";
import GlassCombobox from "@/components/ui/glass-combobox";
import { motion, AnimatePresence } from "framer-motion";
import { useRealtime } from "@/hooks/useRealtime";
import { useTranslations } from "next-intl";
import NewExpenseDialog from "./_components/NewExpenseDialog";
import TransactionCard from "./_components/TransactionCard";
import QuickEditModals from "./_components/QuickEditModals";
import SavedViewsMenu from "./_components/SavedViewsMenu";

type Category = { id: string; name: string; userId?: string | null };
type PaymentMethod = { id: string; provider: string; name: string };
type Transaction = {
  id: string;
  transactionType: "EXPENSE" | "INCOME";
  type?: string;
  issuedAt: string;
  createdAt: string;
  provider?: string;
  description?: string;
  amount: number;
  currency: string;
  categoryName?: string | null;
  category?: Category | null;
  paymentMethod?: PaymentMethod | null;
  source?: string;
};

export default function Page() {
  const router = useRouter();
  const t = useTranslations('Expenses'); // Reusing some keys, though it's "Transactions" now
  const [items, setItems] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<{ start?: string; end?: string; category?: string; search?: string; type?: string }>({});
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20;

  // Summary state
  const [summary, setSummary] = useState<{ totalExpenses: number; totalIncomes: number; balance: number; topCategory: { name: string; amount: number } | null; currency?: string }>({
    totalExpenses: 0,
    totalIncomes: 0,
    balance: 0,
    topCategory: null,
    currency: 'PEN'
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isNewExpenseOpen, setIsNewExpenseOpen] = useState(false);

  // Quick Edit State
  const [editModal, setEditModal] = useState<{ isOpen: boolean; type: "category" | "paymentMethod" | null; transaction: Transaction | null }>({
    isOpen: false,
    type: null,
    transaction: null
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  // Load auxiliary data
  useEffect(() => {
    async function loadAux() {
      const [catRes, pmRes] = await Promise.all([
        apiJson("/api/proxy/categories"),
        apiJson("/api/payment-methods")
      ]);
      if (catRes.ok) setCategories(catRes.data.items || []);
      if (pmRes.ok) setPaymentMethods(pmRes.data.items || []);
    }
    loadAux();
  }, []);

  const handleQuickSave = async (id: string, newValue: string) => {
    const tx = items.find(i => i.id === id);
    if (!tx) return;
    const isCategory = editModal.type === "category";
    const endpoint = tx.transactionType === "EXPENSE" ? `/api/expenses/${id}` : `/api/income/${id}`;
    
    let payload: any = {};
    if (isCategory) {
      if (tx.transactionType === "EXPENSE") {
        payload = { categoryId: newValue };
      } else {
        const catName = categories.find(c => c.id === newValue)?.name || newValue;
        payload = { category: catName, categoryId: newValue };
      }
    } else {
      payload = { paymentMethodId: newValue };
    }

    const res = await apiJson(endpoint, { method: "PATCH", body: JSON.stringify(payload) });
    if (res.ok) {
      loadData();
      try { new BroadcastChannel("contapro:mutated").postMessage("updated"); } catch {}
      try { invalidateApiCache('/api'); } catch {}
      revalidateBudget();
    }
  };

  const formatAmount = (amount: number, currency?: string) => {
    const targetCurrency = currency || summary.currency || "PEN";
    try {
      return new Intl.NumberFormat("es-PE", { style: "currency", currency: targetCurrency }).format(amount);
    } catch {
      return `${amount.toFixed(2)} ${targetCurrency}`;
    }
  };

  async function loadData() {
    setLoading(true);
    const qs = new URLSearchParams();
    qs.set("page", String(page));
    qs.set("limit", String(limit));
    qs.set("dateField", "createdAt"); // Use createdAt so we always see recently added transactions even if issuedAt is older
    if (filters.start) qs.set("start", filters.start);
    if (filters.end) qs.set("end", filters.end);
    if (filters.category) qs.set("category", filters.category);
    if (filters.search) qs.set("search", filters.search);
    if (filters.type) qs.set("type", filters.type);

    const [txRes, sumRes] = await Promise.all([
      apiJson(`/api/transactions?${qs.toString()}`),
      apiJson(`/api/transactions/summary?${qs.toString()}`)
    ]);

    if (!txRes.ok) {
      setError(txRes.error || 'Error al cargar transacciones');
    } else {
      setItems((txRes.data as any)?.items || []);
      setTotalPages((txRes.data as any)?.meta?.totalPages || 1);
    }

    if (sumRes.ok) {
      setSummary((sumRes.data as any)?.summary || { totalExpenses: 0, totalIncomes: 0, balance: 0, topCategory: null });
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filters]);

  useRealtime(loadData);

  const allCurrentIds = useMemo(() => items.map(i => i.id), [items]);
  const isAllSelected = useMemo(() => allCurrentIds.length > 0 && allCurrentIds.every(id => selected.has(id)), [allCurrentIds, selected]);
  const selectedCount = useMemo(() => allCurrentIds.filter(id => selected.has(id)).length, [allCurrentIds, selected]);
  
  const toggleSelectAll = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (isAllSelected) allCurrentIds.forEach(id => next.delete(id));
      else allCurrentIds.forEach(id => next.add(id));
      return next;
    });
  };
  
  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const onBulkDelete = async () => {
    const ids = allCurrentIds.filter(id => selected.has(id));
    if (!ids.length) return;
    const yes = confirm(`¿Estás seguro de eliminar ${ids.length} transacciones seleccionadas?`);
    if (!yes) return;
    
    // As expenses and incomes have different endpoints, we use the specific ones or create a bulk in transactions.
    // For simplicity, we'll iterate or ideally add a bulk endpoint. Since we only have /api/expenses/bulk-delete, 
    // we'll use a Promise.all to delete them individually if we don't know the type, but let's assume we can call delete on each.
    for (const id of ids) {
      const tx = items.find(i => i.id === id);
      if (tx) {
        const endpoint = tx.transactionType === 'EXPENSE' ? `/api/expenses/${id}` : `/api/income/${id}`;
        await apiJson(endpoint, { method: "DELETE" });
      }
    }
    
    setSelected(new Set());
    try { new BroadcastChannel("contapro:mutated").postMessage("deleted"); } catch {}
    try { invalidateApiCache('/api'); } catch {}
    await revalidateBudget();
    router.refresh();
    loadData();
  };

  const handleDateChange = (range: { start?: Date | string; end?: Date | string }) => {
    setFilters((prev: any) => ({
      ...prev,
      start: range.start instanceof Date ? range.start.toISOString() : range.start,
      end: range.end instanceof Date ? range.end.toISOString() : range.end
    }));
    setPage(1);
  };

  return (
    <section className="space-y-6 max-w-[1600px] w-full mx-auto p-4 md:p-8 xl:p-12 text-white">
      <RealtimeRefresh />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl md:text-5xl font-playfair font-bold text-white tracking-tight">Transacciones</h1>
          <p className="text-sm md:text-base text-white/50 mt-1">Gestiona todos tus ingresos y gastos en un solo lugar</p>
        </div>
        <div className="flex items-center gap-3">
          <div id="saved-views-trigger">
            <SavedViewsMenu currentFilters={filters} onApplyView={setFilters} />
          </div>
          <GlassDateRangePicker value={filters.start && filters.end ? { start: new Date(filters.start), end: new Date(filters.end) } : undefined} onApply={handleDateChange} locale="es" />
          <button 
            id="new-transaction-btn"
            onClick={() => setIsNewExpenseOpen(true)}
            className="inline-flex items-center justify-center h-[42px] px-6 rounded-xl bg-purple-500 hover:bg-purple-600 text-white font-medium shadow-lg transition-all hover:-translate-y-0.5"
          >
            <Plus className="mr-2 h-4 w-4" /> Nueva
          </button>
        </div>
      </div>

      {/* --- STATS CARDS --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="flex flex-col justify-center border border-white/10 rounded-2xl p-5 relative overflow-hidden bg-white/5 backdrop-blur-md shadow-xl">
          <div className="text-xs text-white/60 font-medium uppercase tracking-widest mb-1">Balance Total</div>
          <div className={`text-2xl font-bold tracking-tight ${summary.balance >= 0 ? 'text-white' : 'text-red-400'}`}>
            {summary.balance < 0 ? '-' : ''}{formatAmount(Math.abs(summary.balance), summary.currency)}
          </div>
          <DollarSign className="absolute top-4 right-4 w-10 h-10 text-white/5" />
        </div>

        <div className="flex flex-col justify-center border border-white/10 rounded-2xl p-5 relative overflow-hidden bg-white/5 backdrop-blur-md shadow-xl">
          <div className="text-xs text-white/60 font-medium uppercase tracking-widest mb-1">Ingresos</div>
          <div className="text-2xl font-bold tracking-tight text-emerald-400">
            +{formatAmount(summary.totalIncomes, summary.currency)}
          </div>
          <ArrowDownRight className="absolute top-4 right-4 w-10 h-10 text-emerald-400/10" />
        </div>

        <div className="flex flex-col justify-center border border-white/10 rounded-2xl p-5 relative overflow-hidden bg-white/5 backdrop-blur-md shadow-xl">
          <div className="text-xs text-white/60 font-medium uppercase tracking-widest mb-1">Gastos</div>
          <div className="text-2xl font-bold tracking-tight text-rose-400">
            -{formatAmount(summary.totalExpenses, summary.currency)}
          </div>
          <ArrowUpRight className="absolute top-4 right-4 w-10 h-10 text-rose-400/10" />
        </div>

        <div className="flex flex-col justify-center border border-white/10 rounded-2xl p-5 relative overflow-hidden bg-white/5 backdrop-blur-md shadow-xl">
          <div className="text-xs text-white/60 font-medium uppercase tracking-widest mb-1">Top Categoría</div>
          <div className="text-xl font-bold tracking-tight text-white truncate">
            {summary.topCategory ? summary.topCategory.name : '—'}
          </div>
          {summary.topCategory && (
            <div className="text-sm text-white/50">{formatAmount(summary.topCategory.amount, summary.currency)}</div>
          )}
          <TrendingUp className="absolute top-4 right-4 w-10 h-10 text-white/5" />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Pills Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">
          {[{ label: "Todas", value: undefined }, { label: "Solo Gastos", value: "EXPENSE" }, { label: "Solo Ingresos", value: "INCOME" }].map(t => (
            <button
              key={t.label}
              onClick={() => { setFilters(f => ({ ...f, type: t.value })); setPage(1); }}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all ${
                filters.type === t.value 
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-[0_0_15px_-3px_rgba(168,85,247,0.2)]" 
                  : "bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search and Category Filter */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <input 
              id="transaction-search"
              className="w-full h-10 rounded-full border border-white/10 bg-white/5 backdrop-blur-md pl-9 pr-4 text-sm text-white placeholder:text-white/40 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 focus:outline-none transition-all shadow-inner"
              placeholder="Buscar transacciones..."
              value={filters.search || ""} 
              onChange={e => { setFilters(f => ({ ...f, search: e.target.value || undefined })); setPage(1); }} 
            />
          </div>
          
          <div className="w-48 hidden sm:block" id="category-filter">
            <GlassCombobox
              options={[
                { label: "Todas las categorías", value: "" },
                ...categories.map(c => ({ label: c.name, value: c.name }))
              ]}
              value={filters.category || ""}
              onChange={(val) => {
                setFilters(f => ({ ...f, category: val === "" ? undefined : val }));
                setPage(1);
              }}
              placeholder="Filtrar por categoría"
            />
          </div>
        </div>
      </div>

        <div className="p-0">
          <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="text-sm font-medium text-white">Listado de Movimientos</h3>
            <div className="hidden md:flex items-center gap-3">
               <label className="inline-flex items-center gap-2 text-xs text-white/60">
                  <input 
                    type="checkbox" 
                    className="h-4 w-4 rounded border-white/10 bg-white/10 text-white focus:ring-0 focus:ring-offset-0" 
                    checked={isAllSelected} 
                    onChange={toggleSelectAll} 
                  />
                  Seleccionar Todo
                </label>
                <span className="text-xs text-white/50">{selectedCount} seleccionados</span>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={onBulkDelete} 
                  disabled={selectedCount === 0}
                  className="h-8 border-white/10 bg-white/5 backdrop-blur-md text-white hover:bg-white/10 hover:text-white"
                >
                  Eliminar ({selectedCount})
                </Button>
            </div>
          </div>
          <div className="p-4 sm:p-6">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="h-32 rounded-2xl bg-white/5 animate-pulse border border-white/5" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="py-24 flex flex-col items-center justify-center gap-4 opacity-70 bg-white/5 border border-white/10 rounded-2xl">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                  <Receipt className="w-8 h-8 text-white/40" />
                </div>
                <div className="space-y-1 text-center">
                  <p className="text-white font-medium">No hay transacciones</p>
                  <p className="text-sm text-white/50">No se encontraron movimientos en este periodo</p>
                </div>
              </div>
            ) : (
              <motion.div 
                id="transactions-list"
                className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
                initial="hidden"
                animate="visible"
                variants={{
                  visible: { transition: { staggerChildren: 0.05 } }
                }}
              >
                <AnimatePresence mode="popLayout">
                  {items.map((it) => (
                    <TransactionCard 
                      key={it.id} 
                      tx={it} 
                      isSelected={selected.has(it.id)} 
                      onToggleSelect={() => toggleSelect(it.id)} 
                      onEditCategory={(tx) => setEditModal({ isOpen: true, type: "category", transaction: tx })}
                      onEditAccount={(tx) => setEditModal({ isOpen: true, type: "paymentMethod", transaction: tx })}
                      userPreferredCurrency={summary.currency}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </div>

          {/* Pagination */}
          <div className="p-4 flex items-center justify-between border-t border-white/10">
            <span className="text-xs text-white/50">Página {page} de {totalPages || 1}</span>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-8 border-white/10 bg-white/5 text-white hover:bg-white/10"
              >
                Anterior
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || totalPages === 0}
                className="h-8 border-white/10 bg-white/5 text-white hover:bg-white/10"
              >
                Siguiente
              </Button>
            </div>
          </div>
        </div>

      <NewExpenseDialog 
        open={isNewExpenseOpen} 
        onOpenChange={setIsNewExpenseOpen} 
        onSuccess={() => {
          loadData();
        }}
      />

      <QuickEditModals 
        isOpen={editModal.isOpen}
        type={editModal.type}
        transaction={editModal.transaction}
        options={editModal.type === "category" ? categories as any : paymentMethods}
        onClose={() => setEditModal({ isOpen: false, type: null, transaction: null })}
        onSave={handleQuickSave}
      />
    </section>
  );
}
