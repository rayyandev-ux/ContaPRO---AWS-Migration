"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, Wallet, Landmark, CreditCard, Banknote } from "lucide-react";
import { useTranslations, useLocale } from 'next-intl';
import dynamic from 'next/dynamic';
import { useRouter, usePathname } from "@/i18n/routing";
import GlassCombobox from "@/components/ui/glass-combobox";

import SankeySkeleton from '@/components/dashboard/SankeySkeleton';
import GlassDateRangePicker from "@/components/ui/glass-date-range-picker";

const DashboardCharts = dynamic(() => import('./DashboardCharts'), {
  ssr: false,
  loading: () => <SankeySkeleton />
});

type CategoryItem = { category: string; total: number };
type MonthItem = { month: number; total: number };
type MonthBudgetItem = { month: number; budget: number; spent: number; income: number; remaining: number; currency: string };
type DailyTrendItem = { day: number; spent: number; accumulated: number };
type GoalItem = { id: string; name: string; targetAmount: number; currentAmount: number; currency: string; isCompleted: boolean };
type PaymentMethodItem = { id: string; name: string; provider: string; type: string; currency: string; active: boolean };

type Props = {
  byCategory: CategoryItem[];
  byCategoryIncome: CategoryItem[];
  byMonth: MonthItem[];
  byMonthBudget: MonthBudgetItem[];
  trend: DailyTrendItem[];
  last3: Array<{ id: string; provider?: string; description?: string; amount: number; currency?: string; createdAt: string; amountNative?: number | null }>;
  currency: string;
  totalMonth?: number;
  goals?: GoalItem[];
  paymentMethods?: PaymentMethodItem[];
  startDate: Date;
  endDate: Date;
};

export default function ChartPanel({ 
  byCategory, 
  byCategoryIncome, 
  byMonth, 
  byMonthBudget, 
  trend, 
  last3, 
  currency, 
  totalMonth = 0, 
  goals = [], 
  paymentMethods = [],
  startDate,
  endDate
}: Props) {
  const t = useTranslations('Dashboard');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [catView, setCatView] = useState<'expenses' | 'income'>('expenses');
  const [balanceView, setBalanceView] = useState<'balance' | 'income' | 'expenses'>('balance');

  const handleDateChange = (range: { start: Date; end: Date }) => {
    const startStr = range.start.toISOString().split('T')[0];
    const endStr = range.end.toISOString().split('T')[0];
    router.push(`${pathname}?start=${startStr}&end=${endStr}`, { scroll: false });
  };
  
  const fmt = useMemo(() => new Intl.NumberFormat(locale === 'es' ? "es-PE" : locale === 'en' ? "en-US" : "pt-BR", { style: "currency", currency }), [currency, locale]);
  const monthNames = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(2000, i, 1);
      const m = d.toLocaleString(locale, { month: 'short' });
      return m.charAt(0).toUpperCase() + m.slice(1);
    });
  }, [locale]);

  const chartData = useMemo(() => {
    const dataToUse = catView === 'expenses' ? byCategory : byCategoryIncome;
    const colors = catView === 'expenses' 
      ? ["#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9"]
      : ["#10b981", "#22c55e", "#84cc16", "#a3e635", "#d9f99d", "#059669", "#047857", "#064e3b", "#34d399", "#6ee7b7"];

    return dataToUse.map((c, i) => ({
      name: c.category,
      value: c.total,
      color: colors[i % colors.length]
    })).sort((a, b) => b.value - a.value);
  }, [byCategory, byCategoryIncome, catView]);

  const balanceChartData = useMemo(() => {
    return byMonthBudget.map(m => ({
      name: monthNames[m.month - 1],
      value: balanceView === 'balance' ? (m.income - m.spent) : balanceView === 'income' ? m.income : m.spent,
      income: m.income,
      expenses: m.spent,
      balance: m.income - m.spent
    }));
  }, [byMonthBudget, monthNames, balanceView]);

  const filteredData = useMemo(() => {
    return byMonthBudget.filter(m => {
      const year = startDate.getFullYear();
      const mDate = new Date(year, m.month - 1, 1);
      const startLimit = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      const endLimit = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
      return mDate >= startLimit && mDate <= endLimit;
    });
  }, [byMonthBudget, startDate, endDate]);

  const displayTotal = useMemo(() => filteredData.reduce((acc, m) => acc + (Number(m.spent) || 0), 0), [filteredData]);
  const displayIncome = useMemo(() => filteredData.reduce((acc, m) => acc + (Number(m.income) || 0), 0), [filteredData]);
  const displayBalance = displayIncome - displayTotal;
  
  const displayValue = balanceView === 'balance' ? displayBalance : (balanceView === 'income' ? displayIncome : displayTotal);
  
  let displaySign = "";
  let displayColor = "text-white";

  if (balanceView === 'balance') {
    if (displayValue > 0.001) {
      displaySign = "+";
      displayColor = "text-green-400";
    } else if (displayValue < -0.001) {
      displaySign = "-";
      displayColor = "text-red-400";
    }
  } else if (balanceView === 'income') {
    if (displayValue > 0.001) {
      displaySign = "+";
      displayColor = "text-green-400";
    }
  } else if (balanceView === 'expenses') {
    if (displayValue > 0.001) {
      displaySign = "-";
      displayColor = "text-red-400";
    }
  }

  const streakInfo = useMemo(() => {
    let currentStreak = 0;
    let maxStreak = 0;
    let transactionsDays = 0;
    trend.forEach(t => {
      if (t.spent > 0) {
        currentStreak++;
        transactionsDays++;
        if (currentStreak > maxStreak) maxStreak = currentStreak;
      } else {
        currentStreak = 0;
      }
    });
    return { transactionsDays, maxStreak };
  }, [trend]);

  function getIcon(type: string, provider: string) {
    const p = (provider || '').toLowerCase();
    if (p.includes('yape') || p.includes('plin') || p.includes('tunki') || p.includes('wallet') || type === 'WALLET') return <Wallet className="h-4 w-4" />;
    if (type === 'EFECTIVO' || p.includes('efectivo')) return <Banknote className="h-4 w-4" />;
    if (type === 'TARJETA' || p.includes('tarjeta')) return <CreditCard className="h-4 w-4" />;
    return <Landmark className="h-4 w-4" />;
  }

  return (
    <div className="flex flex-col gap-6 text-white">
      <div className="flex justify-end items-center mb-2">
        <div className="flex items-center gap-3">
          <span className="hidden md:inline text-xs font-bold uppercase tracking-widest text-white/30">Filtrar por periodo:</span>
          <GlassDateRangePicker value={{ start: startDate, end: endDate }} onApply={handleDateChange} locale={locale} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
        <div id="chart-balance" className="lg:col-span-9 bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md shadow-xl flex flex-col min-h-[400px]">
          <div className="flex justify-between items-start mb-2">
            <div className="flex flex-col gap-1">
              <GlassCombobox
                value={balanceView}
                onChange={(v: any) => setBalanceView(v)}
                options={[
                  { value: "balance", label: "Balance" },
                  { value: "income", label: "Ingresos" },
                  { value: "expenses", label: "Gastos" },
                ]}
                className="w-[140px] h-9 rounded-xl"
                hideSearch
              />
            </div>
            <button 
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-colors text-white/50 group relative"
            >
              <span className="text-xs">¥</span>
              <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-black/90 border border-white/10 rounded-xl text-xs text-white/80 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-2xl pointer-events-none text-left">
                Los montos del gráfico están unificados en tu moneda principal: {currency}
              </div>
            </button>
          </div>
          <div className="mt-4">
            <div className="flex flex-col">
              <div className="flex items-baseline gap-2">
                <span className={`text-5xl font-bold tracking-tight ${displayColor}`}>
                  {displaySign}{Math.abs(displayValue).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-xl font-medium text-white/40 uppercase">{currency}</span>
              </div>
              <p className="text-sm text-white/30 mt-1">Total del periodo seleccionado</p>
            </div>
          </div>
          <div className="flex-1 mt-6">
            <DashboardCharts view="balance" subView={balanceView} data={balanceChartData} currency={currency} locale={locale} />
          </div>
        </div>

        <div id="chart-streak" className="lg:col-span-3 bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md shadow-xl flex flex-col justify-between min-h-[400px]">
          <div>
            <h3 className="text-base font-medium text-white/90 mb-4">Racha Activa</h3>
            <p className="text-sm text-white/60 mb-6">
              En los últimos 30 días tienes <span className="text-white font-medium">{streakInfo.transactionsDays} transacciones</span> y una racha máxima de <span className="text-emerald-400 font-medium">{streakInfo.maxStreak} días</span>.
            </p>
          </div>
          <div className="flex-1 flex flex-col justify-end">
            <div className="flex gap-1 h-16 items-end w-full">
              {Array.from({ length: 30 }).map((_, i) => {
                const d = trend[i];
                const isActive = d && d.spent > 0;
                return (
                  <div key={i} className={`flex-1 rounded-sm ${isActive ? 'bg-emerald-500/80 h-full' : 'bg-white/5 h-1/2'}`} title={d ? `Día ${d.day}: ${d.spent}` : ''} />
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-white/30 mt-4">
              <span>Hace 30 días</span>
              <span>Hoy</span>
            </div>
          </div>
        </div>

        <div id="chart-categories" className="lg:col-span-12 bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md shadow-xl flex flex-col min-h-[350px]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-base font-medium text-white/90">Distribución por categoría</h3>
            <button className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-colors text-white/50 group relative">
              <span className="text-xs">¥</span>
              <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-black/90 border border-white/10 rounded-xl text-xs text-white/80 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-2xl pointer-events-none text-left">
                Los montos del gráfico están unificados en tu moneda principal: {currency}
              </div>
            </button>
          </div>
          <div className="flex gap-2 mb-2">
            <button onClick={() => setCatView('expenses')} className={`text-xs px-3 py-1.5 rounded-md font-medium transition-all ${catView === 'expenses' ? 'bg-white/10 text-white shadow-lg' : 'bg-transparent text-white/40 hover:bg-white/5'}`}>Gastos</button>
            <button onClick={() => setCatView('income')} className={`text-xs px-3 py-1.5 rounded-md font-medium transition-all ${catView === 'income' ? 'bg-white/10 text-white shadow-lg' : 'bg-transparent text-white/40 hover:bg-white/5'}`}>Ingresos</button>
          </div>
          <div className="flex-1 mt-2">
            <DashboardCharts view="donut" data={chartData} currency={currency} locale={locale} totalMonth={catView === 'expenses' ? displayTotal : displayIncome} />
          </div>
        </div>

        <div className="lg:col-span-4 bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md shadow-xl flex flex-col min-h-[350px]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-base font-medium text-white/90">Últimas transacciones</h3>
            <a href="/transactions" className="hover:bg-white/10 p-1.5 rounded-full transition-colors"><ArrowUpRight className="w-5 h-5 text-white/40 hover:text-white transition-colors" /></a>
          </div>
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
            {last3.length === 0 ? (
              <p className="text-sm text-white/40 text-center py-4">{t('noRecentExpenses')}</p>
            ) : (
              last3.map((e) => (
                <div key={e.id} className="flex items-center justify-between group">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-white/90">{e.provider || e.description || t('defaultExpenseDescription')}</span>
                    <span className="text-xs text-white/40 flex items-center gap-1">
                      <span className="w-3 h-3 bg-white/10 rounded flex items-center justify-center text-[8px]">🧾</span>
                      {new Date(e.createdAt).toLocaleDateString(locale === 'es' ? 'es-PE' : locale === 'en' ? 'en-US' : 'pt-BR', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-semibold text-red-400">
                      -{new Intl.NumberFormat(locale === 'es' ? "es-PE" : locale === 'en' ? "en-US" : "pt-BR", { style: "currency", currency: e.currency || currency }).format(e.amount)}
                    </span>
                    {e.currency !== currency && e.amountNative ? (
                      <span className="text-[10px] text-white/40">
                        ≈ {fmt.format(e.amountNative)}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-4 bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md shadow-xl flex flex-col min-h-[350px]">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-base font-medium text-white/90">Metas</h3>
            <div className="flex items-center gap-2">
              <button className="w-6 h-6 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-colors text-white/50 group relative">
                <span className="text-[10px]">¥</span>
                <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-black/90 border border-white/10 rounded-xl text-xs text-white/80 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-2xl pointer-events-none text-left">
                  Los montos están unificados en tu moneda principal: {currency}
                </div>
              </button>
              <div className="bg-emerald-500/20 text-emerald-400 text-xs px-2 py-1 rounded-md font-medium flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> {goals.filter(g => g.isCompleted).length} de {goals.length} al día
              </div>
            </div>
          </div>
          {goals.length > 0 ? (
            <div className="flex-1 flex flex-col justify-center">
              {goals.slice(0, 1).map(goal => {
                const progress = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100)) || 0;
                const gfmt = new Intl.NumberFormat(locale === 'es' ? "es-PE" : "en-US", { style: "currency", currency: goal.currency || currency });
                return (
                  <div key={goal.id} className="flex flex-col h-full">
                    <h4 className="text-sm font-medium text-white/80 mb-4">{goal.name}</h4>
                    <div className="flex justify-between text-xs text-white/40 mb-2"><span>0%</span><span>100%</span></div>
                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-4"><div className="h-full bg-emerald-400 rounded-full" style={{ width: `${progress}%` }}></div></div>
                    <div className="flex justify-between items-end mt-auto">
                      <div><p className="text-xs text-white/40 mb-1">Ahorrado</p><p className="text-base font-bold text-white/90">{gfmt.format(goal.currentAmount)}</p></div>
                      <div className="text-right"><p className="text-xs text-white/40 mb-1">Objetivo</p><p className="text-base font-bold text-white/90">{gfmt.format(goal.targetAmount)}</p></div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-center items-center text-center">
              <p className="text-sm text-white/40 mb-2">No hay metas creadas</p>
              <p className="text-xs text-white/30">Crea una meta de ahorro para visualizar tu progreso aquí.</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-4 bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md shadow-xl flex flex-col min-h-[350px]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-base font-medium text-white/90">Cuentas</h3>
            <button className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-colors text-white/50 group relative">
              <span className="text-xs">¥</span>
              <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-black/90 border border-white/10 rounded-xl text-xs text-white/80 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-2xl pointer-events-none text-left">
                Los montos están unificados en tu moneda principal: {currency}
              </div>
            </button>
          </div>
          <div className="flex gap-2 mb-6">
            <button className="bg-white/10 text-white text-xs px-3 py-1.5 rounded-md font-medium">Métodos</button>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
            {paymentMethods.length > 0 ? (
              paymentMethods.filter(pm => pm.active).map(acc => (
                <div key={acc.id} className="flex justify-between items-center group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm">{getIcon(acc.type, acc.provider)}</div>
                    <div className="flex flex-col"><span className="text-sm font-medium text-white/90">{acc.name}</span><span className="text-[10px] text-white/40">{acc.provider}</span></div>
                  </div>
                  <span className="text-xs font-semibold text-white/50">{acc.currency}</span>
                </div>
              ))
            ) : (
              <div className="text-center py-4"><p className="text-sm text-white/40">No hay cuentas registradas</p></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
