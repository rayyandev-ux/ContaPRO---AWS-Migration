"use client";

import { useEffect, useState, Suspense } from "react";
import { apiJson } from "@/lib/api";
import { Loader2 } from "lucide-react";
import CategoryBudgetView from "./CategoryBudgetView";
import { useSearchParams } from "next/navigation";

function CategoryBudgetPageContent() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const searchParams = useSearchParams();
  const formErrorMsg = searchParams.get("error");

  const now = new Date();
  const monthNum = now.getMonth() + 1;
  const yearNum = now.getFullYear();

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        let amount = 0;
        let currencyCode = 'PEN';
        let generalAlertThreshold: number | null = null;
        let categories: any[] = [];
        let catTotal = 0;

        const resBudget = await apiJson(`/api/proxy/budget?source=created&autocreate=1`);
        if (resBudget.ok && resBudget.data) {
          const d = resBudget.data;
          amount = Number(d?.budget?.amount ?? 0);
          currencyCode = String(d?.budget?.currency ?? 'PEN');
          generalAlertThreshold = typeof d?.budget?.alertThreshold === 'number' ? Number(d.budget.alertThreshold) : null;
        }

        const resCats = await apiJson(`/api/proxy/categories`);
        if (resCats.ok && resCats.data) {
          categories = (resCats.data?.items ?? []);
        }

        const resTotal = await apiJson(`/api/proxy/budget/category/total?month=${monthNum}&year=${yearNum}`);
        if (resTotal.ok && resTotal.data) {
          catTotal = Number(resTotal.data?.total ?? 0);
        }

        const catStatuses: any[] = [];
        const settled = await Promise.allSettled(categories.map(async (c) => {
          const url = `/api/proxy/budget/category?categoryId=${encodeURIComponent(c.id)}&month=${monthNum}&year=${yearNum}`;
          const res = await apiJson(url);
          if (!res.ok) return { categoryId: c.id, name: c.name, budget: undefined, spent: 0, remaining: 0 };
          const d: any = res.data;
          return { categoryId: c.id, name: c.name, budget: d.budget, spent: d.spent, remaining: d.remaining };
        }));

        for (const s of settled) {
          if (s.status === 'fulfilled') catStatuses.push(s.value);
        }

        setData({
          amount,
          currencyCode,
          generalAlertThreshold,
          categories,
          catTotal,
          catStatuses
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [monthNum, yearNum]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-white/50" />
      </div>
    );
  }

  return (
    <CategoryBudgetView
      amount={data.amount}
      currencyCode={data.currencyCode}
      generalAlertThreshold={data.generalAlertThreshold}
      categories={data.categories}
      catTotal={data.catTotal}
      catStatuses={data.catStatuses}
      formErrorMsg={formErrorMsg}
      monthNum={monthNum}
      yearNum={yearNum}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-white/50" /></div>}>
      <CategoryBudgetPageContent />
    </Suspense>
  );
}
