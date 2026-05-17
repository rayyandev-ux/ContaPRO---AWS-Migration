"use client";

import { useEffect, useState } from "react";
import { apiJson } from "@/lib/api";
import { Loader2 } from "lucide-react";
import PaymentMethodBudgetView from "./PaymentMethodBudgetView";

export default function Page() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  const now = new Date();
  const monthNum = now.getMonth() + 1;
  const yearNum = now.getFullYear();

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        let generalAmount = 0;
        let generalAlertThreshold: number | null = null;
        let currencyCode = 'PEN';
        let methods: any[] = [];
        
        const resBudget = await apiJson(`/api/proxy/budget?source=created&autocreate=1`);
        if (resBudget.ok && resBudget.data) {
          const d = resBudget.data;
          generalAmount = Number(d?.budget?.amount ?? 0);
          currencyCode = String(d?.budget?.currency ?? 'PEN');
          generalAlertThreshold = typeof d?.budget?.alertThreshold === 'number' ? Number(d.budget.alertThreshold) : null;
        }

        const resPm = await apiJson(`/api/proxy/payment-methods`);
        if (resPm.ok && resPm.data) {
          const d = resPm.data;
          methods = (d?.items || []).filter((m: any) => m.active !== false);
        }

        const pmStatuses: any[] = [];
        const settled = await Promise.allSettled(methods.map(async (m) => {
          const url = `/api/proxy/budget/payment-method?paymentMethodId=${encodeURIComponent(m.id)}&month=${monthNum}&year=${yearNum}`;
          const res = await apiJson(url);
          if (!res.ok) return { paymentMethodId: m.id, name: `${m.provider} — ${m.name}`, budget: undefined, spent: 0, remaining: 0 };
          const d: any = res.data;
          return { paymentMethodId: m.id, name: `${m.provider} — ${m.name}`, budget: d.budget, spent: d.spent, remaining: d.remaining };
        }));

        for (const s of settled) {
          if (s.status === 'fulfilled') pmStatuses.push(s.value);
        }

        setData({
          generalAmount,
          generalAlertThreshold,
          currencyCode,
          methods,
          pmStatuses
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
    <PaymentMethodBudgetView
      generalAmount={data.generalAmount}
      generalAlertThreshold={data.generalAlertThreshold}
      currencyCode={data.currencyCode}
      methods={data.methods}
      pmStatuses={data.pmStatuses}
      monthNum={monthNum}
      yearNum={yearNum}
    />
  );
}
