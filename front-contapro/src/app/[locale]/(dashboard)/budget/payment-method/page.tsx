import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CreditCard, DollarSign, Globe, AlertTriangle, X } from "lucide-react";

import PaymentMethodBudgetView from "./PaymentMethodBudgetView";

export default async function Page() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ");
  const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";

  const now = new Date();
  const monthNum = now.getMonth() + 1;
  const yearNum = now.getFullYear();
  const monthLabel = `${yearNum}-${String(monthNum).padStart(2, '0')}`;

  let generalAmount = 0;
  let generalAlertThreshold: number | null = null;
  let currencyCode = 'PEN';
  let methods: Array<{ id: string; name: string; provider: string; cardLast4?: string | null; currency: string; active: boolean }> = [];
  try {
    const resBudget = await fetch(`${BASE}/api/budget?source=created&autocreate=1`, { headers: { cookie: cookieHeader }, cache: 'no-store' });
    if (resBudget.ok) {
      const d = await resBudget.json();
      generalAmount = Number(d?.budget?.amount ?? 0);
      currencyCode = String(d?.budget?.currency ?? 'PEN');
      generalAlertThreshold = typeof d?.budget?.alertThreshold === 'number' ? Number(d.budget.alertThreshold) : null;
    }
  } catch {}
  try {
    const resPm = await fetch(`${BASE}/api/payment-methods`, { headers: { cookie: cookieHeader }, cache: 'no-store' });
    if (resPm.ok) {
      const d = await resPm.json();
      methods = (d?.items || []).filter((m: any) => m.active !== false);
    }
  } catch {}

  type PMBudgetResp = { ok: boolean; budget?: { amount: number; currency: string; alertThreshold?: number | null }; spent: number; remaining: number };
  const pmStatuses: Array<{ paymentMethodId: string; name: string; budget?: PMBudgetResp["budget"]; spent: number; remaining: number }> = [];
  try {
    const settled = await Promise.allSettled(methods.map(async (m) => {
      const url = `${BASE}/api/budget/payment-method?paymentMethodId=${encodeURIComponent(m.id)}&month=${monthNum}&year=${yearNum}`;
      const res = await fetch(url, { headers: { cookie: cookieHeader }, cache: 'no-store' });
      if (!res.ok) return { paymentMethodId: m.id, name: `${m.provider} — ${m.name}`, budget: undefined, spent: 0, remaining: 0 };
      const d: PMBudgetResp = await res.json();
      return { paymentMethodId: m.id, name: `${m.provider} — ${m.name}`, budget: d.budget, spent: d.spent, remaining: d.remaining };
    }));
    for (const s of settled) {
      if (s.status === 'fulfilled') pmStatuses.push(s.value);
      else pmStatuses.push({ paymentMethodId: '', name: '', budget: undefined, spent: 0, remaining: 0 });
    }
  } catch {}

  const configuredIds = new Set(pmStatuses.filter(s => s.budget).map(s => s.paymentMethodId));
  const methodsForForm = methods.filter(m => !configuredIds.has(m.id));
  const totalAssigned = pmStatuses.reduce((acc, s) => acc + (s.budget?.amount ?? 0), 0);
  const canAddMore = (generalAmount - totalAssigned) > 0 && methodsForForm.length > 0;
  const generalThrIsPct = !!generalAlertThreshold && generalAlertThreshold > 0 && generalAlertThreshold <= 1;

  async function savePMBudget(formData: FormData) {
    "use server";
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ");
    const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
    const paymentMethodId = String(formData.get("paymentMethodId") || "");
    const amountStr = String(formData.get("pmAmount") ?? "");
    const thresholdStr = String(formData.get("pmThreshold") ?? "");
    const thresholdType = String(formData.get("pmThresholdType") || "amount");
    const currency = String(formData.get("pmCurrency") || "");
    const amount = amountStr.trim() !== "" ? Number(amountStr) : NaN;
    let threshold = thresholdStr.trim() !== "" ? Number(thresholdStr) : NaN;
    if (thresholdType === 'percent' && !Number.isNaN(threshold)) threshold = threshold / 100;
    const now = new Date();
    const payload: { paymentMethodId: string; month: number; year: number; amount?: number; currency?: string; alertThreshold?: number } = {
      paymentMethodId,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
    };
    if (!paymentMethodId) return redirect(`/budget/payment-method?error=${encodeURIComponent('Selecciona método')}`);
    if (Number.isNaN(amount) || amount <= 0 || Number.isNaN(threshold)) {
      return redirect(`/budget/payment-method?error=${encodeURIComponent('Monto y umbral son requeridos')}`);
    }
    payload.amount = amount;
    if (currency) payload.currency = currency;
    payload.alertThreshold = threshold;
    try {
      const res = await fetch(`${BASE}/api/budget/payment-method`, { method: "POST", headers: { "Content-Type": "application/json", cookie: cookieHeader }, body: JSON.stringify(payload) });
      if (!res.ok) {
        const errJson: { error?: string; message?: string } = await res.json().catch(() => ({} as { error?: string; message?: string }));
        const msg = String((errJson && (errJson.error || errJson.message)) || `Error ${res.status}`);
        return redirect(`/budget/payment-method?error=${encodeURIComponent(msg)}`);
      }
    } catch {
      return redirect(`/budget/payment-method?error=${encodeURIComponent('Error guardando presupuesto de método')}`);
    }
    revalidatePath('/budget/payment-method');
    return redirect('/budget/payment-method');
  }

  async function deletePMBudget(formData: FormData) {
    "use server";
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ");
    const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
    const paymentMethodId = String(formData.get("paymentMethodId") || "");
    if (!paymentMethodId) return;

    const month = Number(formData.get("month")) || (new Date().getMonth() + 1);
    const year = Number(formData.get("year")) || new Date().getFullYear();

    const qs = new URLSearchParams({ paymentMethodId, month: String(month), year: String(year) }).toString();
    try { await fetch(`${BASE}/api/budget/payment-method?${qs}`, { method: 'DELETE', headers: { cookie: cookieHeader } }); } catch {}
    revalidatePath('/budget/payment-method');
  }

  return (
    <PaymentMethodBudgetView
      monthLabel={monthLabel}
      generalAmount={generalAmount}
      totalAssigned={totalAssigned}
      methods={methods}
      pmStatuses={pmStatuses}
      currencyCode={currencyCode}
      monthStr={String(monthNum)}
      yearStr={String(yearNum)}
      onSave={savePMBudget}
      onDelete={deletePMBudget}
    />
  );
}
