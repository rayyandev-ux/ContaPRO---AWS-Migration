import { cookies } from "next/headers";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tags, DollarSign, Globe, AlertTriangle, Info } from "lucide-react";
import ConfirmDeleteButton from "../../_components/ConfirmDeleteButton";
import EditCategoryBudgetButton from "../../_components/EditCategoryBudgetButton";
import CategoryBudgetGuard from "../../_components/CategoryBudgetGuard";

import CategoryBudgetView from "./CategoryBudgetView";

export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[]>> }) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ");
  const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
  const origin = (process.env.NEXT_PUBLIC_APP_ORIGIN || process.env.APP_ORIGIN || 'http://localhost:3000');

  const now = new Date();
  const monthNum = now.getMonth() + 1;
  const yearNum = now.getFullYear();
  const monthLabel = `${yearNum}-${String(monthNum).padStart(2, '0')}`;

  let amount = 0;
  let currencyCode = 'PEN';
  let generalAlertThreshold: number | null = null;
  let categories: Array<{ id: string; name: string }> = [];
  let catTotal = 0;
  let formErrorMsg: string | null = null;
  const sp = searchParams ? await searchParams : undefined;
  if (typeof sp?.error === 'string') formErrorMsg = sp.error as string;

  try {
    const res = await fetch(`${origin}/api/proxy/budget?source=created&autocreate=1`, { headers: { cookie: cookieHeader }, cache: 'no-store' });
    if (res.ok) {
      const d = await res.json();
      amount = Number(d?.budget?.amount ?? 0);
      currencyCode = String(d?.budget?.currency ?? 'PEN');
      generalAlertThreshold = typeof d?.budget?.alertThreshold === 'number' ? Number(d.budget.alertThreshold) : null;
    }
  } catch {}

  try {
    const resCats = await fetch(`${origin}/api/proxy/categories`, { headers: { cookie: cookieHeader }, cache: 'no-store' });
    if (resCats.ok) {
      const data = await resCats.json();
      const items = (data?.items ?? []) as Array<{ id: string; name: string }>;
      categories = items;
    }
  } catch {}

  try {
    const resTotal = await fetch(`${BASE}/api/budget/category/total?month=${monthNum}&year=${yearNum}`, { headers: { cookie: cookieHeader }, cache: 'no-store' });
    if (resTotal.ok) {
      const dTot = await resTotal.json();
      catTotal = Number(dTot?.total ?? 0);
    }
  } catch {}

  type CatBudgetResp = { ok: boolean; budget?: { amount: number; currency: string; alertThreshold?: number | null }; spent: number; remaining: number };
  const catStatuses: Array<{ categoryId: string; name: string; budget?: CatBudgetResp["budget"]; spent: number; remaining: number }> = [];
  try {
    const settled = await Promise.allSettled(categories.map(async (c) => {
      const url = `${BASE}/api/budget/category?categoryId=${encodeURIComponent(c.id)}&month=${monthNum}&year=${yearNum}`;
      const res = await fetch(url, { headers: { cookie: cookieHeader }, cache: 'no-store' });
      if (!res.ok) return { categoryId: c.id, name: c.name, budget: undefined, spent: 0, remaining: 0 };
      const d: CatBudgetResp = await res.json();
      return { categoryId: c.id, name: c.name, budget: d.budget, spent: d.spent, remaining: d.remaining };
    }));
    for (const s of settled) {
      if (s.status === 'fulfilled') catStatuses.push(s.value);
      else catStatuses.push({ categoryId: '', name: '', budget: undefined, spent: 0, remaining: 0 });
    }
  } catch {}

  const configuredIds = new Set(catStatuses.filter(s => s.budget).map(s => s.categoryId));
  const categoriesForForm = categories.filter(c => !configuredIds.has(c.id));
  const canAddMore = (amount - catTotal) > 0 && categoriesForForm.length > 0;
  const generalThrIsPct = !!generalAlertThreshold && generalAlertThreshold > 0 && generalAlertThreshold <= 1;

  async function saveCategoryBudget(formData: FormData) {
    "use server";
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ");
    const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
    const categoryId = String(formData.get("categoryId") || "");
    const amountStr = String(formData.get("catAmount") ?? "");
    const thresholdStr = String(formData.get("catThreshold") ?? "");
    const thresholdType = String(formData.get("catThresholdType") || "amount");
    const currency = String(formData.get("catCurrency") || "");
    const amount = amountStr.trim() !== "" ? Number(amountStr) : NaN;
    let threshold = thresholdStr.trim() !== "" ? Number(thresholdStr) : NaN;
    if (thresholdType === 'percent' && !Number.isNaN(threshold)) threshold = threshold / 100;
    const now = new Date();
    const payload: { categoryId: string; month: number; year: number; amount?: number; currency?: string; alertThreshold?: number } = {
      categoryId,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
    };
    if (!categoryId) return;
    if (Number.isNaN(amount) || amount <= 0 || Number.isNaN(threshold)) {
      return redirect(`/budget/category?error=${encodeURIComponent('Monto y umbral son requeridos')}`);
    }
    try {
      const resGen = await fetch(`${BASE}/api/budget?source=created&month=${payload.month}&year=${payload.year}`, { headers: { cookie: cookieHeader } });
      if (!resGen.ok) return redirect(`/budget/category?error=Configura primero el presupuesto mensual general`);
      const dGen = await resGen.json();
      const generalAmt = Number(dGen?.budget?.amount ?? 0);
      if (amount > generalAmt) return redirect(`/budget/category?error=El monto de la categoría excede el presupuesto general`);
      const resTotal = await fetch(`${BASE}/api/budget/category/total?month=${payload.month}&year=${payload.year}`, { headers: { cookie: cookieHeader } });
      const dTotal = resTotal.ok ? await resTotal.json() : { total: 0 };
      const resCat = await fetch(`${BASE}/api/budget/category?categoryId=${encodeURIComponent(categoryId)}&month=${payload.month}&year=${payload.year}`, { headers: { cookie: cookieHeader } });
      const dCat: Partial<CatBudgetResp> = resCat.ok ? await resCat.json() : {};
      const currentAmt = Number(dCat?.budget?.amount ?? 0);
      const sumOther = Number(dTotal?.total ?? 0) - currentAmt;
      const newSum = sumOther + amount;
      if (newSum > generalAmt) return redirect(`/budget/category?error=La suma de presupuestos por categoría excede el presupuesto general`);
      payload.amount = amount;
    } catch {}
    if (currency) payload.currency = currency;
    payload.alertThreshold = threshold;
    try {
      const res = await fetch(`${BASE}/api/budget/category`, { method: "POST", headers: { "Content-Type": "application/json", cookie: cookieHeader }, body: JSON.stringify(payload) });
      if (!res.ok) {
        const errJson: { error?: string; message?: string } = await res.json().catch(() => ({} as { error?: string; message?: string }));
        const msg = String((errJson && (errJson.error || errJson.message)) || `Error ${res.status}`);
        return redirect(`/budget/category?error=${encodeURIComponent(msg)}`);
      }
    } catch {
      return redirect(`/budget/category?error=${encodeURIComponent('Error de red al guardar categoría')}`);
    }
    revalidatePath('/budget/category');
    return redirect('/budget/category');
  }

  async function deleteCategoryBudget(formData: FormData) {
    "use server";
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ");
    const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
    const categoryId = String(formData.get("categoryId") || "");
    if (!categoryId) return;
    
    const month = Number(formData.get("month")) || (new Date().getMonth() + 1);
    const year = Number(formData.get("year")) || new Date().getFullYear();

    const qs = new URLSearchParams({ categoryId, month: String(month), year: String(year) }).toString();
    try { await fetch(`${BASE}/api/budget/category?${qs}`, { method: 'DELETE', headers: { cookie: cookieHeader } }); } catch {}
    revalidatePath('/budget/category');
  }

  return (
    <CategoryBudgetView
      monthLabel={monthLabel}
      amount={amount}
      catTotal={catTotal}
      categories={categories}
      catStatuses={catStatuses}
      currencyCode={currencyCode}
      monthStr={String(monthNum)}
      yearStr={String(yearNum)}
      onSave={saveCategoryBudget}
      onDelete={deleteCategoryBudget}
    />
  );
}
