import { cookies } from "next/headers";
import { Link } from "@/i18n/routing";
import { MessageSquare, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ChartPanel from "../_components/ChartPanel";
import { ExportButton } from "../_components/ExportButton";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import ExpenseModalHandler from "../_components/ExpenseModalHandler";
import { getTranslations } from 'next-intl/server';

export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[]>> }) {
  const t = await getTranslations('Dashboard');
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ");
  const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";

  const sp = searchParams ? await searchParams : undefined;
  
  // Parallel data fetching
  let start: Date;
  let end: Date;

  if (sp?.start && sp?.end) {
    start = new Date(String(sp.start));
    end = new Date(String(sp.end));
  } else {
    const now = new Date();
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }

  const monthNum = start.getMonth() + 1;
  const yearNum = start.getFullYear();
  
  const qs = new URLSearchParams({ start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }).toString();

  const [resMe, resHistory, resCat, resCatInc, resMon, resBudgetMonth, resBudget, resTrend, resExpenses, resGoals, resPaymentMethods] = await Promise.all([
    fetch(`${BASE}/api/auth/me`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
      next: { tags: ['auth-me'] },
    }).catch(() => null),
    fetch(`${BASE}/api/history`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
      next: { tags: ['dashboard-history'] },
    }).catch(() => null),
    fetch(`${BASE}/api/stats/expenses/by-category?source=created&month=${monthNum}&year=${yearNum}`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
      next: { tags: ['dashboard-stats-category'] },
    }).catch(() => null),
    fetch(`${BASE}/api/stats/income/by-category?month=${monthNum}&year=${yearNum}`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
      next: { tags: ['dashboard-stats-income-category'] },
    }).catch(() => null),
    fetch(`${BASE}/api/stats/expenses/by-month?source=created&year=${yearNum}`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
      next: { tags: ['dashboard-stats-month'] },
    }).catch(() => null),
    fetch(`${BASE}/api/stats/budget/by-month?source=created&year=${yearNum}`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
      next: { tags: ['dashboard-budget-month'] },
    }).catch(() => null),
    fetch(`${BASE}/api/budget?source=created&month=${monthNum}&year=${yearNum}`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
      next: { tags: ['budget-current'] },
    }).catch(() => null),
    fetch(`${BASE}/api/stats/expenses/daily-trend?month=${monthNum}&year=${yearNum}`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
      next: { tags: ['dashboard-trend'] },
    }).catch(() => null),
    fetch(`${BASE}/api/expenses?${qs}`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
      next: { tags: ['dashboard-expenses-current'] },
    }).catch(() => null),
    fetch(`${BASE}/api/savings/goals`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
      next: { tags: ['savings-goals'] },
    }).catch(() => null),
    fetch(`${BASE}/api/payment-methods`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
      next: { tags: ['payment-methods'] },
    }).catch(() => null),
  ]);

  // Process results
  let me: { plan?: string; trialEnds?: string | null; planExpires?: string | null; preferredCurrency?: string; dateFormat?: 'DMY' | 'MDY' } | null = null;
  if (resMe?.ok) {
    const data = await resMe.json();
    me = data?.user || null;
  }
  const currency = me?.preferredCurrency || 'PEN';

  let items: Array<{ id: string; filename: string; uploadedAt: string; summary?: string; total?: number }> = [];
  if (resHistory?.ok) {
    const data = await resHistory.json();
    items = data.items || [];
  }

  let byCategory: Array<{ category: string; total: number }> = [];
  if (resCat?.ok) {
    const data = await resCat.json();
    byCategory = data.items || [];
  }

  let byCategoryIncome: Array<{ category: string; total: number }> = [];
  if (resCatInc?.ok) {
    const data = await resCatInc.json();
    byCategoryIncome = data.items || [];
  }

  let byMonth: Array<{ month: number; total: number }> = [];
  if (resMon?.ok) {
    const data = await resMon.json();
    byMonth = data.items || [];
  }

  let byMonthBudget: Array<{ month: number; budget: number; spent: number; income: number; remaining: number; currency: string }> = [];
  if (resBudgetMonth?.ok) {
    const data = await resBudgetMonth.json();
    byMonthBudget = data.items || [];
  }

  let totalMonth = 0;
  if (resBudget?.ok) {
    const data = await resBudget.json();
    totalMonth = (data?.spent ?? 0) as number;
  }

  let trendData: Array<{ day: number; spent: number; accumulated: number }> = [];
  if (resTrend?.ok) {
    const data = await resTrend.json();
    trendData = data.items || [];
  }

  let last3: Array<{ id: string; provider?: string; description?: string; amount: number; currency?: string; createdAt: string; amountNative?: number | null }> = [];
  
  if (resExpenses?.ok) {
    const data = await resExpenses.json();
    const expItems = (data.items || []) as Array<{ id: string; type: string; createdAt: string; provider?: string; description?: string; amount: number; currency?: string; amountNative?: number | null }>;
    
    const sorted = expItems.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    last3 = sorted.slice(0, 3).map((x) => ({ 
      id: String(x.id), 
      provider: x.provider, 
      description: x.description, 
      amount: Number(x.amount || 0), 
      currency: x.currency, 
      createdAt: x.createdAt,
      amountNative: x.amountNative
    }));
  }

  let goals: any[] = [];
  if (resGoals?.ok) {
    const data = await resGoals.json();
    goals = data.goals || [];
  }

  let paymentMethods: any[] = [];
  if (resPaymentMethods?.ok) {
    const data = await resPaymentMethods.json();
    paymentMethods = data.items || [];
  }

  const formatCurrency = (n: number) => new Intl.NumberFormat('es-PE', { style: 'currency', currency }).format(n);
  const fmt = (n: number) => new Intl.NumberFormat('es-PE', { style: 'currency', currency }).format(n);
  const maxCat = byCategory.length > 0 ? Math.max(...byCategory.map(c => c.total)) : 0;
  const maxMonth = byMonth.length > 0 ? Math.max(...byMonth.map(m => m.total)) : 0;
  const monthNames = ["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"];
  const dayOfMonth = new Date().getDate();

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
  const daysUntil = (iso?: string | null) => {
    if (!iso) return null;
    const target = new Date(iso).getTime();
    const now = Date.now();
    const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <section className="space-y-6 max-w-[1600px] w-full mx-auto px-6 md:px-8 xl:px-12 py-6 md:py-8 lg:py-10">
      <RealtimeRefresh />
      <ExpenseModalHandler />
      
      <div className="bg-white/10 backdrop-blur-2xl shadow-2xl border border-white/20 rounded-2xl overflow-hidden mt-6">
        <div className="px-8 pt-8 pb-6 border-b border-white/10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-5xl md:text-6xl font-playfair font-bold tracking-tight text-white mb-2">{t('summary')}</h1>
              <p className="text-white/60 mt-1 text-lg xl:text-xl font-medium">{t('day')} {dayOfMonth}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div id="dashboard-export-btn">
                <ExportButton />
              </div>
              <Link href="/chat" id="dashboard-chat-btn">
                <button className="inline-flex items-center justify-center gap-2 whitespace-nowrap px-6 py-2.5 rounded-full bg-white text-black font-medium hover:bg-white/90 transition-colors text-sm w-full sm:w-auto shadow-md">
                  <MessageSquare className="h-4 w-4" /> {t('askIA') || 'Hablar con IA'}
                </button>
              </Link>
            </div>
          </div>
        </div>

        <div className="px-8 py-8">
          <ChartPanel
            byCategory={byCategory}
            byCategoryIncome={byCategoryIncome}
            byMonth={byMonth}
            byMonthBudget={byMonthBudget}
            trend={trendData}
            last3={last3}
            currency={currency}
            totalMonth={totalMonth}
            goals={goals}
            paymentMethods={paymentMethods}
            startDate={start}
            endDate={end}
          />
        </div>
      </div>
    </section>
  );
}