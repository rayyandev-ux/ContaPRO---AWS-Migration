"use client";

import { useEffect, useState, Suspense } from "react";
import { Link } from "@/i18n/routing";
import { MessageSquare, TrendingUp, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ChartPanel from "../_components/ChartPanel";
import { ExportButton } from "../_components/ExportButton";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import ExpenseModalHandler from "../_components/ExpenseModalHandler";
import { useTranslations } from 'next-intl';
import { useSearchParams } from "next/navigation";
import { apiJson } from "@/lib/api";

function DashboardContent() {
  const t = useTranslations('Dashboard');
  const searchParams = useSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  // Parallel data fetching parameters
  let start: Date;
  let end: Date;

  const spStart = searchParams.get('start');
  const spEnd = searchParams.get('end');

  if (spStart && spEnd) {
    start = new Date(spStart);
    end = new Date(spEnd);
  } else {
    const now = new Date();
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }

  const monthNum = start.getMonth() + 1;
  const yearNum = start.getFullYear();
  const qs = new URLSearchParams({ start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }).toString();

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [resMe, resHistory, resCat, resCatInc, resMon, resBudgetMonth, resBudget, resTrend, resExpenses, resGoals, resPaymentMethods] = await Promise.all([
          apiJson(`/api/auth/me`),
          apiJson(`/api/proxy/history`),
          apiJson(`/api/proxy/stats/expenses/by-category?source=created&month=${monthNum}&year=${yearNum}`),
          apiJson(`/api/proxy/stats/income/by-category?month=${monthNum}&year=${yearNum}`),
          apiJson(`/api/proxy/stats/expenses/by-month?source=created&year=${yearNum}`),
          apiJson(`/api/proxy/stats/budget/by-month?source=created&year=${yearNum}`),
          apiJson(`/api/proxy/budget?source=created&month=${monthNum}&year=${yearNum}`),
          apiJson(`/api/proxy/stats/expenses/daily-trend?month=${monthNum}&year=${yearNum}`),
          apiJson(`/api/proxy/expenses?${qs}`),
          apiJson(`/api/proxy/savings/goals`),
          apiJson(`/api/proxy/payment-methods`),
        ]);

        let me = resMe.ok ? resMe.data?.user || null : null;
        const currency = me?.preferredCurrency || 'PEN';

        let items = resHistory.ok ? resHistory.data?.items || [] : [];
        let byCategory = resCat.ok ? resCat.data?.items || [] : [];
        let byCategoryIncome = resCatInc.ok ? resCatInc.data?.items || [] : [];
        let byMonth = resMon.ok ? resMon.data?.items || [] : [];
        let byMonthBudget = resBudgetMonth.ok ? resBudgetMonth.data?.items || [] : [];
        let totalMonth = resBudget.ok ? (resBudget.data?.spent ?? 0) : 0;
        let trendData = resTrend.ok ? resTrend.data?.items || [] : [];
        
        let last3 = [];
        if (resExpenses.ok) {
          const expItems = resExpenses.data?.items || [];
          const sorted = expItems.slice().sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          last3 = sorted.slice(0, 3).map((x: any) => ({ 
            id: String(x.id), 
            provider: x.provider, 
            description: x.description, 
            amount: Number(x.amount || 0), 
            currency: x.currency, 
            createdAt: x.createdAt,
            amountNative: x.amountNative
          }));
        }

        let goals = resGoals.ok ? resGoals.data?.goals || [] : [];
        let paymentMethods = resPaymentMethods.ok ? resPaymentMethods.data?.items || [] : [];

        setData({
          me, currency, items, byCategory, byCategoryIncome, byMonth, byMonthBudget,
          totalMonth, trendData, last3, goals, paymentMethods
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [monthNum, yearNum, qs]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-white/50" />
      </div>
    );
  }

  const dayOfMonth = new Date().getDate();

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
            byCategory={data.byCategory}
            byCategoryIncome={data.byCategoryIncome}
            byMonth={data.byMonth}
            byMonthBudget={data.byMonthBudget}
            trend={data.trendData}
            last3={data.last3}
            currency={data.currency}
            totalMonth={data.totalMonth}
            goals={data.goals}
            paymentMethods={data.paymentMethods}
            startDate={start}
            endDate={end}
          />
        </div>
      </div>
    </section>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-white/50" /></div>}>
      <DashboardContent />
    </Suspense>
  );
}