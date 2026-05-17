"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import BudgetView from "./BudgetView";
import { apiJson } from "@/lib/api";
import { Loader2 } from "lucide-react";

function BudgetPageContent() {
  const searchParams = useSearchParams();
  const sourceParam = searchParams.get("source")?.toLowerCase() || "created";
  const source = sourceParam === "created" ? "created" : "issued";

  const now = new Date();
  const monthNum = now.getMonth() + 1;
  const yearNum = now.getFullYear();
  const monthLabel = `${yearNum}-${String(monthNum).padStart(2, '0')}`;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [data, setData] = useState({
    amount: 0,
    spent: 0,
    remaining: 0,
    alertThreshold: 0,
    currencyCode: "PEN",
    budgetName: undefined as string | undefined,
    categories: [] as any[],
    unallocatedBudget: 0,
    byMonthBudget: [] as any[],
    allCategories: [] as any[],
    paymentMethods: [] as any[]
  });

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [budgetRes, byMonthRes, categoriesRes, pmRes] = await Promise.all([
          apiJson(`/api/proxy/budget?source=${source}&autocreate=1`),
          apiJson(`/api/proxy/stats/budget/by-month?source=${source}`),
          apiJson(`/api/categories`),
          apiJson(`/api/proxy/payment-methods`)
        ]);

        if (!budgetRes.ok) throw new Error(budgetRes.error || "Error al cargar presupuesto");

        const d = budgetRes.data;
        const amount = Number(d?.budget?.amount ?? 0);
        const spent = Number(d?.spent ?? 0);
        
        setData({
          amount,
          spent,
          remaining: Number(d?.remaining ?? (amount - spent)),
          alertThreshold: Number(d?.budget?.alertThreshold ?? 0),
          currencyCode: String(d?.budget?.currency ?? "PEN"),
          budgetName: d?.budget?.name || undefined,
          categories: (d?.categories ?? []).map((c: any) => ({
            ...c,
            budget: c.amount ?? c.budget ?? 0,
            name: c.categoryName ?? c.name ?? "Sin Nombre",
            expenseCount: c.expenseCount ?? 0
          })),
          unallocatedBudget: Number(d?.unallocatedBudget ?? 0),
          byMonthBudget: byMonthRes.ok ? (byMonthRes.data?.items ?? []) : [],
          allCategories: categoriesRes.ok ? (categoriesRes.data?.items ?? []) : [],
          paymentMethods: pmRes.ok ? (pmRes.data?.items ?? []) : []
        });

      } catch (e) {
        setError(e instanceof Error ? e.message : "Error desconocido");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [source]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-white/50" />
      </div>
    );
  }

  return (
    <>
      <RealtimeRefresh />
      {error && <p className="text-red-600 mb-4">{error}</p>}
      
      {!error && (
        <BudgetView
          monthLabel={monthLabel}
          amount={data.amount}
          spent={data.spent}
          remaining={data.remaining}
          alertThreshold={data.alertThreshold}
          currencyCode={data.currencyCode}
          byMonthBudget={data.byMonthBudget}
          budgetName={data.budgetName}
          categories={data.categories}
          allCategories={data.allCategories}
          unallocatedBudget={data.unallocatedBudget}
          source={source}
          paymentMethods={data.paymentMethods}
        />
      )}
    </>
  );
}

export default function Page() {
  return (
    <section className="space-y-6 max-w-[1600px] w-full mx-auto px-6 md:px-8 xl:px-12 py-6 md:py-8 lg:py-10">
      <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-white/50" /></div>}>
        <BudgetPageContent />
      </Suspense>
    </section>
  );
}
