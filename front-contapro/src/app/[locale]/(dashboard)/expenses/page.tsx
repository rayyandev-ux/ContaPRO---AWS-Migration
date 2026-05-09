"use client";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@/i18n/routing";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { apiJson, invalidateApiCache } from "@/lib/api";
import { revalidateBudget } from "@/app/actions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye, Image as ImageIcon, Trash2, Filter, Calendar, Search, FileText, ChevronUp, ChevronDown, Plus, Receipt, X, PieChart as PieChartIcon, DollarSign, TrendingUp } from "lucide-react";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import GlassDatePicker from "@/components/ui/glass-date-picker";
import GlassCombobox from "@/components/ui/glass-combobox";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useTranslations } from "next-intl";
import NewExpenseDialog from "./_components/NewExpenseDialog";

type Category = { id: string; name: string };
type PaymentMethod = { id: string; provider: string; name: string };
type Expense = {
  id: string;
  type: "FACTURA" | "BOLETA" | "INFORMAL" | "YAPE" | "PLIN" | "TUNKI" | "LEMONPAY" | "BCP" | "INTERBANK" | "SCOTIABANK" | "BBVA";
  issuedAt: string;
  createdAt: string;
  provider: string;
  description?: string;
  amount: number;
  currency: string;
  category?: Category | null;
  document?: { id: string; filename: string; mimeType?: string } | null;
  paymentMethod?: { provider: string; name: string } | null;
};

export default function Page() {
  const router = useRouter();
  const t = useTranslations('Expenses');
  const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
  const [items, setItems] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filters, setFilters] = useState<{ type?: string; provider?: string; categoryId?: string; start?: string; end?: string }>({});
  const currencyFormatter = useMemo(() =>
    new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", minimumFractionDigits: 2 }), []);
  const nowRef = useMemo(() => new Date(), []);
  const [currency, setCurrency] = useState('PEN');
  const [totalMonthAmount, setTotalMonthAmount] = useState(0);
  const [highestExpense, setHighestExpense] = useState(0);
  const [highestExpenseItem, setHighestExpenseItem] = useState<Expense | null>(null);
  
  const [filtersOpen, setFiltersOpen] = useState(false);
  
  const [selected, setSelected] = useState<Set<string>>(new Set());
  
  // Modal State
  const [selectedStat, setSelectedStat] = useState<'total' | 'highest' | 'transactions' | null>(null);
  const [isNewExpenseOpen, setIsNewExpenseOpen] = useState(false);

  // Derived Stats Data
  const categoriesData = useMemo(() => {
    const acc: Record<string, number> = {};
    items.forEach(it => {
      const name = it.category?.name || 'Sin Categoría';
      acc[name] = (acc[name] || 0) + it.amount;
    });
    return Object.entries(acc)
      .map(([name, value], i) => ({ 
        name, 
        value, 
        color: ["#8b5cf6", "#a855f7", "#c084fc", "#d8b4fe", "#e9d5ff", "#f3e8ff", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe"][i % 10] 
      }))
      .sort((a, b) => b.value - a.value);
  }, [items]);

  const typeData = useMemo(() => {
    return {
      FACTURA: items.filter(i => i.type === 'FACTURA').length,
      BOLETA: items.filter(i => i.type === 'BOLETA').length,
      INFORMAL: items.filter(i => i.type === 'INFORMAL').length,
    };
  }, [items]);

  const topProviders = useMemo(() => {
    const acc: Record<string, number> = {};
    items.forEach(it => {
      if(it.provider) acc[it.provider] = (acc[it.provider] || 0) + 1;
    });
    return Object.entries(acc).sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [items]);

  const formatAmount = (amount: number, txCurrency?: string) => {
    try {
      const targetCurrency = txCurrency || currency || "PEN";
      return new Intl.NumberFormat("es-PE", { style: "currency", currency: targetCurrency }).format(amount);
    } catch {
      return `${amount.toFixed(2)} ${txCurrency || currency || "PEN"}`;
    }
  };

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams();
    if (filters.type) qs.set("type", filters.type);
    if (filters.provider) qs.set("provider", filters.provider);
    if (filters.categoryId) qs.set("categoryId", filters.categoryId);
    if (filters.start) {
      // Para start, asegurarnos de que empiece a las 00:00:00 local (aunque YYYY-MM-DD ya se suele interpretar así, mejor asegurar)
      const [y, m, d] = filters.start.split('-').map(Number);
      const startD = new Date(y, m - 1, d, 0, 0, 0, 0);
      qs.set("start", startD.toISOString());
    }
    if (filters.end) {
      // Para end, queremos que incluya todo el día (23:59:59.999)
      const [y, m, d] = filters.end.split('-').map(Number);
      const endD = new Date(y, m - 1, d, 23, 59, 59, 999);
      qs.set("end", endD.toISOString());
    }
    const { ok, data, error } = await apiJson(`/api/expenses?${qs.toString()}`);
    if (!ok) {
      setError(error || t('loadError'));
    } else {
      const arr = ((data as any)?.items || []).slice().sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setItems(arr as Expense[]);
      
      // Calculate Stats
      if (arr.length > 0) {
        const total = arr.reduce((sum: number, exp: any) => sum + ((exp.amountNative ?? exp.amount) || 0), 0);
        setTotalMonthAmount(total);
        
        let maxExp = arr[0];
        for (const exp of arr) {
          if (((exp.amountNative ?? exp.amount) || 0) > ((maxExp.amountNative ?? maxExp.amount) || 0)) {
            maxExp = exp;
          }
        }
        setHighestExpense((maxExp.amountNative ?? maxExp.amount) || 0);
        setHighestExpenseItem(maxExp as Expense);
      } else {
        setTotalMonthAmount(0);
        setHighestExpense(0);
        setHighestExpenseItem(null);
      }
    }

    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      const cats = await apiJson(`/api/categories`);
      if (cats.ok) setCategories((cats.data as any)?.items || []);
      const me = await apiJson(`/api/auth/me`);
      if (me.ok && (me.data as any)?.user?.preferredCurrency) {
        setCurrency((me.data as any).user.preferredCurrency);
      }
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const typeBadge = (type: Expense["type"]) => {
    if (type === "FACTURA") return "bg-white/5 text-white ring-1 ring-white/10";
    if (type === "BOLETA") return "bg-white/5 text-white ring-1 ring-white/10";
    return "bg-white/5 text-white ring-1 ring-white/10";
  };

  const paymentBadge = (provider?: string) => {
    const p = String(provider || '').toUpperCase();
    if (['YAPE', 'PLIN', 'TUNKI', 'LEMONPAY', 'BCP', 'INTERBANK', 'SCOTIABANK', 'BBVA', 'EFECTIVO'].includes(p)) {
      return 'bg-white/5 text-white ring-1 ring-white/10';
    }
    return 'bg-white/5 text-white ring-1 ring-white/10';
  };

  const currentItems = useMemo(() => {
    // Si hay filtros de fecha, mostrar lo que devuelve el backend (ya filtrado)
    if (filters.start || filters.end) {
      return items;
    }
    const m = nowRef.getMonth();
    const y = nowRef.getFullYear();
    return items.filter(it => {
      const d = new Date(it.createdAt);
      return d.getMonth() === m && d.getFullYear() === y;
    });
  }, [items, nowRef, filters.start, filters.end]);

  const pastItems = useMemo(() => {
    const m = nowRef.getMonth();
    const y = nowRef.getFullYear();
    return items.filter(it => {
      const d = new Date(it.createdAt);
      return !(d.getMonth() === m && d.getFullYear() === y);
    });
  }, [items, nowRef]);

  const prevMonths = useMemo(() => {
    const currentY = nowRef.getFullYear();
    const currentM = nowRef.getMonth() + 1;
    const unique = new Set<string>();
    for (const it of items) {
      const d = new Date(it.createdAt);
      const mm = d.getMonth() + 1;
      const yy = d.getFullYear();
      if (yy < currentY || (yy === currentY && mm < currentM)) {
        unique.add(`${yy}-${mm}`);
      }
    }
    return Array.from(unique).map(s => {
      const [y, m] = s.split('-').map(Number);
      return { year: y, month: m };
    }).sort((a, b) => {
       if (a.year !== b.year) return b.year - a.year;
       return b.month - a.month;
    });
  }, [items, nowRef]);

  const [openPrev, setOpenPrev] = useState(false);
  const [prevMonth, setPrevMonth] = useState<string | null>(null);
  const [prevLoading, setPrevLoading] = useState(false);
  const [prevError, setPrevError] = useState<string | null>(null);
  const [prevList, setPrevList] = useState<Expense[]>([]);

  const allCurrentIds = useMemo(() => currentItems.map(i => i.id), [currentItems]);
  const isAllSelected = useMemo(() => allCurrentIds.length > 0 && allCurrentIds.every(id => selected.has(id)), [allCurrentIds, selected]);
  const selectedCount = useMemo(() => allCurrentIds.filter(id => selected.has(id)).length, [allCurrentIds, selected]);
  const toggleSelectAll = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (isAllSelected) {
        allCurrentIds.forEach(id => next.delete(id));
      } else {
        allCurrentIds.forEach(id => next.add(id));
      }
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
  useEffect(() => {
    setSelected(prev => {
      const set = new Set<string>(currentItems.map(i => i.id));
      const next = new Set<string>();
      prev.forEach(id => { if (set.has(id)) next.add(id); });
      return next;
    });
  }, [currentItems]);

  const onDelete = async (id: string) => {
    const yes = confirm(t('deleteConfirm'));
    if (!yes) return;
    const res = await apiJson(`/api/expenses/${id}`, { method: "DELETE" });
    if (res.ok) {
      setItems(prev => prev.filter(x => x.id !== id));
      setSelected(prev => { const next = new Set(prev); next.delete(id); return next; });
      // Notificar cambios para refrescar presupuestos
      try { new BroadcastChannel("contapro:mutated").postMessage("deleted"); } catch {}
      // Refrescar explícitamente el router para actualizar Server Components (como budget)
      try { invalidateApiCache('/api'); } catch {}
      await revalidateBudget();
      router.refresh();
    }
    else alert(res.error || t('deleteError'));
  };

  const onBulkDelete = async () => {
    const ids = allCurrentIds.filter(id => selected.has(id));
    if (!ids.length) return;
    const yes = confirm(t('bulkDeleteConfirm', {count: ids.length}));
    if (!yes) return;
    const res = await apiJson(`/api/expenses/bulk-delete`, { method: "POST", body: JSON.stringify({ ids }) });
    if (!res.ok) {
      alert(res.error || t('bulkDeleteError'));
      return;
    }
    setItems(prev => prev.filter(x => !ids.includes(x.id)));
    setSelected(new Set());
    try { new BroadcastChannel("contapro:mutated").postMessage("deleted"); } catch {}
    try { invalidateApiCache('/api'); } catch {}
    await revalidateBudget();
    router.refresh();
  };

  return (
    <section className="space-y-6 max-w-[1600px] w-full mx-auto p-4 md:p-8 xl:p-12 text-white">
      <RealtimeRefresh />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl md:text-5xl font-playfair font-bold text-white tracking-tight">{t('title')}</h1>
          <p className="text-sm md:text-base text-white/50 mt-1">{t('expensesSubtitle')}</p>
        </div>
        <button 
          onClick={() => setIsNewExpenseOpen(true)}
          className="inline-flex items-center justify-center h-11 px-6 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 hover:bg-white/10 text-white font-medium shadow-lg transition-all hover:-translate-y-0.5"
        >
          <Plus className="mr-2 h-4 w-4 text-purple-400" /> {t('newExpense')}
        </button>
      </div>

      {/* --- STATS CARDS --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div 
          onClick={() => setSelectedStat('total')}
          className="flex flex-col justify-center border border-white/10 rounded-2xl p-5 relative overflow-hidden bg-white/5 group hover:border-white/20 transition-all hover:bg-white/10 backdrop-blur-md shadow-xl cursor-pointer"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-300">
            <DollarSign className="w-12 h-12 text-emerald-400" />
          </div>
          <div className="text-xs text-white/60 font-medium uppercase tracking-widest">{t('totalMonth')}</div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-white">
            {formatAmount(totalMonthAmount, currency)}
          </div>
        </div>

        <div 
          onClick={() => setSelectedStat('highest')}
          className="flex flex-col justify-center border border-white/10 rounded-2xl p-5 relative overflow-hidden bg-white/5 group hover:border-white/20 transition-all hover:bg-white/10 backdrop-blur-md shadow-xl cursor-pointer"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-300">
            <TrendingUp className="w-12 h-12 text-rose-400" />
          </div>
          <div className="text-xs text-white/60 font-medium uppercase tracking-widest">{t('highestExpense')}</div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-white">
            {formatAmount(highestExpense, currency)}
          </div>
        </div>

        <div 
          onClick={() => setSelectedStat('transactions')}
          className="flex flex-col justify-center border border-white/10 rounded-2xl p-5 relative overflow-hidden bg-white/5 group hover:border-white/20 transition-all hover:bg-white/10 backdrop-blur-md shadow-xl cursor-pointer"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-300">
            <Receipt className="w-12 h-12 text-purple-400" />
          </div>
          <div className="text-xs text-white/60 font-medium uppercase tracking-widest">{t('totalTransactions')}</div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-white">
            {items.length} {t('transactions')}
          </div>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-[2rem] overflow-hidden backdrop-blur-xl shadow-2xl">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between cursor-pointer group" onClick={() => setFiltersOpen(!filtersOpen)}>
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-purple-400" />
              <h2 className="text-base font-semibold text-white group-hover:text-purple-300 transition-colors">{t('filters')}</h2>
            </div>
            <div className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
              {filtersOpen ? <ChevronUp className="h-4 w-4 text-white/70" /> : <ChevronDown className="h-4 w-4 text-white/70" />}
            </div>
          </div>
        </div>
        <AnimatePresence>
          {filtersOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-y-4 gap-x-5">
                  <div className="space-y-1.5 lg:col-span-2">
                    <label className="block text-xs font-medium text-white/50 uppercase tracking-wider">{t('type')}</label>
                    <GlassCombobox
                        value={filters.type || ""}
                        onChange={v => setFilters(f => ({ ...f, type: v || undefined }))}
                        className="h-11 border-white/10"
                        options={[
                          { value: "", label: t('all') },
                          { value: "FACTURA", label: t('invoice') },
                          { value: "BOLETA", label: t('receipt') },
                          { value: "INFORMAL", label: t('informal') }
                        ]}
                    />
                  </div>
                  <div className="space-y-1.5 lg:col-span-4">
                    <label className="block text-xs font-medium text-white/50 uppercase tracking-wider">{t('provider')}</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
                      <input 
                        className="w-full h-11 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md pl-9 pr-3 text-sm text-white placeholder:text-white/40 focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/50 transition-all hover:bg-white/10"
                        placeholder={t('searchProvider')}
                        value={filters.provider || ""} 
                        onChange={e => setFilters(f => ({ ...f, provider: e.target.value || undefined }))} 
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5 lg:col-span-3">
                    <label className="block text-xs font-medium text-white/50 uppercase tracking-wider">{t('from')}</label>
                    <GlassDatePicker 
                      value={filters.start || ""} 
                      onChange={v => setFilters(f => ({ ...f, start: v || undefined }))} 
                      placeholder={t('from')}
                    />
                  </div>
                  <div className="space-y-1.5 lg:col-span-3">
                    <label className="block text-xs font-medium text-white/50 uppercase tracking-wider">{t('to')}</label>
                    <GlassDatePicker 
                      value={filters.end || ""} 
                      onChange={v => setFilters(f => ({ ...f, end: v || undefined }))} 
                      placeholder={t('to')}
                    />
                  </div>
                </div>
              </div>
              <div className="p-4 bg-white/5 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                <Button variant="outline" className="w-full sm:w-auto h-11 px-6 rounded-xl border-white/20 bg-white/5 hover:bg-white/10 text-white transition-all shadow-sm" onClick={() => { setFilters({}); setFiltersOpen(false); }}>{t('clearFilters')}</Button>
                <div className="text-xs font-medium text-white/50 tracking-wider">
                  {t('resultsFound', { count: currentItems.length })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

        <div className="p-0">
          <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="text-sm font-medium text-white">{(filters.start || filters.end) ? t('title') : t('currentMonthExpenses')}</h3>
            <div className="hidden md:flex items-center gap-3">
               <label className="inline-flex items-center gap-2 text-xs text-white/60">
                  <input 
                    type="checkbox" 
                    role="checkbox" 
                    className="h-4 w-4 rounded border-white/10 bg-white/10 text-white focus:ring-0 focus:ring-offset-0" 
                    checked={isAllSelected} 
                    onChange={toggleSelectAll} 
                  />
                  {t('selectAll')}
                </label>
                <span className="text-xs text-white/50">{t('selected', {count: selectedCount})}</span>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={onBulkDelete} 
                  disabled={selectedCount === 0}
                  className="h-8 border-white/10 bg-white/5 backdrop-blur-md text-white hover:bg-white/10 hover:text-white"
                >
                  {t('delete')}
                </Button>
            </div>
          </div>
          <div className="overflow-x-auto hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-white/5 border-b border-white/10 transition-colors">
                  <TableHead className="w-[40px] px-4">
                    <input 
                      type="checkbox" 
                      role="checkbox" 
                      className="h-4 w-4 rounded border-white/10 bg-white/5 text-white focus:ring-0 focus:ring-offset-0 cursor-pointer" 
                      checked={isAllSelected} 
                      onChange={toggleSelectAll} 
                    />
                  </TableHead>
                  <TableHead className="text-xs font-medium text-white/50 uppercase tracking-wider h-10">{t('realDate')}</TableHead>
                  <TableHead className="text-xs font-medium text-white/50 uppercase tracking-wider h-10">{t('registryDate')}</TableHead>
                  <TableHead className="text-xs font-medium text-white/50 uppercase tracking-wider h-10">{t('type')}</TableHead>
                  <TableHead className="text-xs font-medium text-white/50 uppercase tracking-wider h-10">{t('paymentMethod')}</TableHead>
                  <TableHead className="text-xs font-medium text-white/50 uppercase tracking-wider h-10">{t('provider')}</TableHead>
                  <TableHead className="text-xs font-medium text-white/50 uppercase tracking-wider h-10">{t('category')}</TableHead>
                  <TableHead className="text-xs font-medium text-white/50 uppercase tracking-wider h-10 text-right">{t('amount')}</TableHead>
                  <TableHead className="text-xs font-medium text-white/50 uppercase tracking-wider h-10 text-right">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow className="hover:bg-transparent border-b border-white/10">
                    <TableCell colSpan={9} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="w-8 h-8 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
                        <span className="text-sm text-white/50">{t('loading')}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {error && (
                  <TableRow className="hover:bg-transparent border-b border-white/10">
                    <TableCell colSpan={9} className="h-24 text-center text-red-400">{error}</TableCell>
                  </TableRow>
                )}
                {!loading && !error && currentItems.length === 0 && (
                  <TableRow className="hover:bg-transparent border-b border-white/10">
                    <TableCell colSpan={9} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center gap-4 opacity-70">
                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                          <Receipt className="w-8 h-8 text-white/40" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-white font-medium">{t('noExpenses')}</p>
                          <p className="text-sm text-white/50">Comienza agregando tu primer gasto del mes</p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {currentItems.map((it, idx) => (
                  <motion.tr 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    key={it.id} 
                    className="border-b border-white/10 hover:bg-white/5 transition-colors group"
                  >
                    <TableCell className="w-[40px] px-4">
                      <input 
                        type="checkbox" 
                        role="checkbox" 
                        className="h-4 w-4 rounded border-white/10 bg-white/5 text-white focus:ring-0 focus:ring-offset-0 cursor-pointer" 
                        checked={selected.has(it.id)} 
                        onChange={() => toggleSelect(it.id)} 
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-white text-xs">{new Date(it.issuedAt).toLocaleDateString('es-PE')}</TableCell>
                    <TableCell className="whitespace-nowrap text-white/50 text-xs">{new Date(it.createdAt).toLocaleDateString('es-PE')}</TableCell>
                    <TableCell>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide ${typeBadge(it.type)}`}>
                        {(it.type === 'FACTURA' || it.type === 'BOLETA') ? it.type : 'INFORMAL'}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {it.paymentMethod ? (
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide ${paymentBadge(it.paymentMethod.provider)}`}>
                          {it.paymentMethod.name}{it.paymentMethod.provider ? ` — ${it.paymentMethod.provider}` : ''}
                        </span>
                      ) : <span className="text-white/50 text-xs">—</span>}
                    </TableCell>
                    <TableCell className="text-white text-sm font-medium">{it.provider}</TableCell>
                    <TableCell>
                      {it.category?.name ? (
                        <span className="inline-flex rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white border border-white/10">
                          {it.category.name}
                        </span>
                      ) : (
                        <span className="text-white/50 text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-white font-medium tabular-nums">{formatAmount(it.amount, it.currency)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0 duration-300">
                        <Link href={`/expenses/${it.id}`} className="inline-flex items-center justify-center h-7 w-7 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                          <Eye className="h-4 w-4" />
                        </Link>
                        {it.document && (
                          it.document.mimeType?.startsWith("image/") ? (
                            <a
                              href={`/api/proxy/documents/${it.document.id}/preview`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center justify-center h-7 w-7 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                            >
                              <ImageIcon className="h-4 w-4" />
                            </a>
                          ) : it.document.mimeType?.startsWith("application/pdf") ? (
                            <a
                              href={`/api/proxy/documents/${it.document.id}/preview`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center justify-center h-7 w-7 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                            >
                              <FileText className="h-4 w-4" />
                            </a>
                          ) : null
                        )}
                        <button
                          className="inline-flex items-center justify-center h-7 w-7 rounded-md text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          onClick={() => onDelete(it.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="md:hidden space-y-3 p-4">
            {currentItems.length > 0 && (
              <div className="flex items-center justify-between mb-4">
                <label className="inline-flex items-center gap-2 text-xs text-white/60">
                  <input 
                    type="checkbox" 
                    role="checkbox" 
                    className="h-4 w-4 rounded border-white/10 bg-white/10 text-white" 
                    checked={isAllSelected} 
                    onChange={toggleSelectAll} 
                  />
                  {t('selectAll')}
                </label>
                <Button size="sm" variant="outline" onClick={onBulkDelete} disabled={selectedCount === 0} className="h-7 text-xs border-white/10 bg-white/5 backdrop-blur-md text-white hover:text-white">{t('delete')} ({selectedCount})</Button>
              </div>
            )}
            
            {loading && <div className="text-sm text-center text-white/50">{t('loading')}</div>}
            {error && <div className="text-sm text-center text-red-400">{error}</div>}
            {!loading && !error && currentItems.length === 0 && <div className="text-sm text-center text-white/50">{t('noExpenses')}</div>}
            
            {currentItems.map((it, idx) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                key={it.id} 
                className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      role="checkbox" 
                      className="h-4 w-4 rounded border-white/10 bg-white/10 text-white" 
                      checked={selected.has(it.id)} 
                      onChange={() => toggleSelect(it.id)} 
                    />
                    <div>
                       <div className="text-sm font-medium text-white">{it.provider || t('providerUnknown')}</div>
                       <div className="text-xs text-white/50">{new Date(it.issuedAt).toLocaleDateString('es-PE')}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-white">{formatAmount(it.amount, it.currency)}</div>
                  </div>
                </div>
                
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${typeBadge(it.type)}`}>
                    {(it.type === 'FACTURA' || it.type === 'BOLETA') ? it.type : 'INFORMAL'}
                  </span>
                  {it.category?.name && (
                    <span className="inline-flex rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white border border-white/10">
                      {it.category.name}
                    </span>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-end gap-2 border-t border-white/10 pt-3">
                   <Link href={`/expenses/${it.id}`} className="text-xs text-white/60 hover:text-white">{t('viewDetail')}</Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

      {prevMonths.length > 0 && (
        <div className="mt-6 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/10 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors" onClick={() => setOpenPrev(v => !v)}>
            <h3 className="text-sm font-medium text-white">{t('previousMonthsExpenses')}</h3>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-white/60 hover:text-white hover:bg-white/10">
              {openPrev ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
          <AnimatePresence initial={false}>
          {openPrev && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
            <div className="p-4">
              <h2 className="text-3xl font-playfair font-bold tracking-tight text-white mb-4">{t('currentMonthExpenses')}</h2>
              <div className="text-xs text-white/50 mb-2">{t('selectMonth')}</div>
              <div className="flex flex-wrap gap-2 mb-4">
                {prevMonths.map(({ year, month }) => {
                  const key = `${year}-${month}`;
                  return (
                  <Button
                    key={`prev-exp-${key}`}
                    variant="outline"
                    size="sm"
                    className={`h-8 border-white/10 bg-white/5 backdrop-blur-md text-white hover:bg-white/10 hover:text-white ${prevMonth === key ? "ring-1 ring-white/20 border-white/20" : ""}`}
                    onClick={async () => {
                      setPrevMonth(key);
                      setPrevLoading(true);
                      setPrevError(null);
                      setPrevList([]);
                      const start = new Date(year, month - 1, 1).toISOString();
                      const end = new Date(year, month, 0, 23, 59, 59, 999).toISOString();
                      const qs = new URLSearchParams({ start, end }).toString();
                      const res = await apiJson<{ items: Expense[] }>(`/api/expenses?${qs}`);
                      if (!res.ok) {
                        setPrevError(res.error || t('loadError'));
                        setPrevLoading(false);
                        return;
                      }
                      const arr = (res.data?.items || []).slice().sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                      setPrevList(arr as Expense[]);
                      setPrevLoading(false);
                    }}
                  >
                    {month.toString().padStart(2, '0')}/{year}
                  </Button>
                  );
                })}
              </div>
              {prevMonth != null && (
                <div className="space-y-2">
                  {prevLoading && (<div className="text-sm text-white/50">{t('loading')}</div>)}
                  {prevError && (<div className="text-sm text-red-400">{prevError}</div>)}
                  {!prevLoading && !prevError && prevList.length === 0 && (<div className="text-sm text-white/50">{t('noData')}</div>)}
                  {!prevLoading && !prevError && prevList.length > 0 && (
                    <div className="overflow-x-auto hidden md:block">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-b border-white/10 hover:bg-transparent">
                            <TableHead className="w-12 h-10"></TableHead>
                            <TableHead className="text-xs font-medium text-white/50 uppercase tracking-wider h-10">{t('realDate')}</TableHead>
                            <TableHead className="text-xs font-medium text-white/50 uppercase tracking-wider h-10">{t('registryDate')}</TableHead>
                            <TableHead className="text-xs font-medium text-white/50 uppercase tracking-wider h-10">{t('type')}</TableHead>
                            <TableHead className="text-xs font-medium text-white/50 uppercase tracking-wider h-10">{t('paymentMethod')}</TableHead>
                            <TableHead className="text-xs font-medium text-white/50 uppercase tracking-wider h-10">{t('provider')}</TableHead>
                            <TableHead className="text-xs font-medium text-white/50 uppercase tracking-wider h-10">{t('category')}</TableHead>
                            <TableHead className="text-xs font-medium text-white/50 uppercase tracking-wider h-10 text-right">{t('amount')}</TableHead>
                            <TableHead className="text-xs font-medium text-white/50 uppercase tracking-wider h-10 text-right">{t('actions')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {prevList.map(it => (
                            <TableRow key={it.id} className="border-b border-white/10 hover:bg-white/5 transition-colors group">
                              <TableCell className="w-[40px] px-4"></TableCell>
                              <TableCell className="whitespace-nowrap text-white text-xs">{new Date(it.issuedAt).toLocaleDateString('es-PE')}</TableCell>
                              <TableCell className="whitespace-nowrap text-white/50 text-xs">{new Date(it.createdAt).toLocaleDateString('es-PE')}</TableCell>
                              <TableCell>
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide ${typeBadge(it.type)}`}>
                          {(it.type === 'FACTURA' || it.type === 'BOLETA') ? it.type : 'INFORMAL'}
                        </span>
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                {it.paymentMethod ? (
                                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide ${paymentBadge(it.paymentMethod.provider)}`}>
                                    {it.paymentMethod.name}{it.paymentMethod.provider ? ` — ${it.paymentMethod.provider}` : ''}
                                  </span>
                                ) : <span className="text-white/50 text-xs">—</span>}
                              </TableCell>
                              <TableCell className="text-white text-sm font-medium">{it.provider}</TableCell>
                              <TableCell>
                                {it.category?.name ? (
                                  <span className="inline-flex rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white border border-white/10">
                                    {it.category.name}
                                  </span>
                                ) : (
                                  <span className="text-white/50 text-xs">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right text-white font-medium tabular-nums">{formatAmount(it.amount, it.currency)}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Link href={`/expenses/${it.id}`} className="inline-flex items-center justify-center h-7 w-7 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                                    <Eye className="h-4 w-4" />
                                  </Link>
                                  {it.document && (
                                    it.document.mimeType?.startsWith("image/") ? (
                                      <a href={`/api/proxy/documents/${it.document.id}/preview`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center h-7 w-7 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                                        <ImageIcon className="h-4 w-4" />
                                      </a>
                                    ) : it.document.mimeType?.startsWith("application/pdf") ? (
                                      <a href={`/api/proxy/documents/${it.document.id}/preview`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center h-7 w-7 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                                        <FileText className="h-4 w-4" />
                                      </a>
                                    ) : null
                                  )}
                                  <button className="inline-flex items-center justify-center h-7 w-7 rounded-md text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-colors" onClick={() => onDelete(it.id)}>
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  {!prevLoading && !prevError && prevList.length > 0 && (
                    <div className="md:hidden space-y-3">
                      {prevList.map(it => (
                        <div key={it.id} className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-4">
                          <div className="flex items-start justify-between">
                            <div>
                               <div className="text-sm font-medium text-white">{it.provider || t('providerUnknown')}</div>
                               <div className="text-xs text-white/50">{new Date(it.issuedAt).toLocaleDateString('es-PE')}</div>
                            </div>
                            <div className="text-right">
                               <div className="text-sm font-semibold text-white">{formatAmount(it.amount, it.currency)}</div>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${typeBadge(it.type)}`}>{it.type}</span>
                            {it.category?.name && (
                              <span className="inline-flex rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white border border-white/10">{it.category.name}</span>
                            )}
                          </div>
                          
                          <div className="mt-3 flex items-center justify-end gap-2 border-t border-white/10 pt-3">
                             <Link href={`/expenses/${it.id}`} className="text-xs text-white/60 hover:text-white">{t('viewDetail')}</Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      )}

      <Dialog open={selectedStat !== null} onOpenChange={(open) => !open && setSelectedStat(null)}>
        <DialogContent className="sm:max-w-md w-full border-white/20">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold flex items-center gap-2">
              {selectedStat === 'total' && <DollarSign className="w-5 h-5 text-emerald-400" />}
              {selectedStat === 'highest' && <TrendingUp className="w-5 h-5 text-rose-400" />}
              {selectedStat === 'transactions' && <Receipt className="w-5 h-5 text-purple-400" />}
              {selectedStat === 'total' ? t('totalMonth') : 
               selectedStat === 'highest' ? t('highestExpense') : 
               t('totalTransactions')}
            </DialogTitle>
          </DialogHeader>

          {/* Modal Content - Total Month */}
          {selectedStat === 'total' && (
            <div className="space-y-6 py-4">
              <div className="text-center">
                <p className="text-sm text-white/60 mb-1">Total Gastado</p>
                <p className="text-4xl font-bold">{formatAmount(totalMonthAmount, currency)}</p>
              </div>
              
              {categoriesData.length > 0 && (
                <div className="h-48 w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoriesData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {categoriesData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: any) => formatAmount(Number(value) || 0, currency)}
                        contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                        itemStyle={{ color: '#fff' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <PieChartIcon className="w-8 h-8 text-white/20" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Modal Content - Highest Expense */}
          {selectedStat === 'highest' && highestExpenseItem && (
            <div className="space-y-6 py-4">
              <div className="flex justify-center">
                <div className="bg-rose-500/20 text-rose-400 p-4 rounded-full border border-rose-500/20">
                  <TrendingUp className="w-10 h-10" />
                </div>
              </div>
              <div className="text-center space-y-1">
                <p className="text-4xl font-bold text-white">{formatAmount(highestExpenseItem.amount, highestExpenseItem.currency)}</p>
                <p className="text-lg font-medium text-white/80">{highestExpenseItem.provider || 'Proveedor Desconocido'}</p>
              </div>
              
              <div className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/50">Fecha:</span>
                  <span className="text-white">{new Date(highestExpenseItem.issuedAt).toLocaleDateString('es-PE')}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/50">Categoría:</span>
                  <span className="text-white">{highestExpenseItem.category?.name || '—'}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/50">Método de Pago:</span>
                  <span className="text-white">{highestExpenseItem.paymentMethod?.name || '—'}</span>
                </div>
              </div>
              
              <Link href={`/expenses/${highestExpenseItem.id}`} className="w-full inline-flex items-center justify-center h-11 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors">
                Ver Detalles Completos
              </Link>
            </div>
          )}
          {selectedStat === 'highest' && !highestExpenseItem && (
            <div className="py-8 text-center text-white/50">No hay gastos registrados este mes.</div>
          )}

          {/* Modal Content - Transactions */}
          {selectedStat === 'transactions' && (
            <div className="space-y-6 py-4">
              <div className="text-center">
                <p className="text-sm text-white/60 mb-1">Total de Transacciones</p>
                <p className="text-4xl font-bold">{items.length}</p>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 text-center">
                  <p className="text-xs text-white/50 mb-1">Facturas</p>
                  <p className="text-xl font-bold">{typeData.FACTURA}</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 text-center">
                  <p className="text-xs text-white/50 mb-1">Boletas</p>
                  <p className="text-xl font-bold">{typeData.BOLETA}</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 text-center">
                  <p className="text-xs text-white/50 mb-1">Informal</p>
                  <p className="text-xl font-bold">{typeData.INFORMAL}</p>
                </div>
              </div>

              {topProviders.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-white/80">Lugares Frecuentes</h4>
                  <div className="space-y-2">
                    {topProviders.map(([provider, count]) => (
                      <div key={provider} className="flex justify-between items-center bg-white/5 rounded-xl p-3 border border-white/5">
                        <span className="text-sm text-white truncate pr-4">{provider}</span>
                        <span className="text-xs font-medium text-white/50 bg-white/10 px-2 py-1 rounded-full whitespace-nowrap">{count} veces</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <NewExpenseDialog 
        open={isNewExpenseOpen} 
        onOpenChange={setIsNewExpenseOpen} 
        onSuccess={() => {
          load();
        }}
      />
    </section>
  );
}
