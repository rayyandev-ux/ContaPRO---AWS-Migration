import { cookies } from "next/headers";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import { revalidatePath } from "next/cache";
import { redirect } from "@/i18n/routing";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
 

import BudgetView from "./BudgetView";

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
  let spent = 0;
  let remaining = 0;
  let alertThreshold = 0;
  let error: string | null = null;
  let currencyCode = 'PEN';
  let budgetName: string | undefined = undefined;
  let categories: any[] = [];
  let unallocatedBudget = 0;
  
  const sp = searchParams ? await searchParams : undefined;
  const srcParam = String(sp?.source || 'created').toLowerCase();
  const source = srcParam === 'created' ? 'created' : 'issued';
  try {
    const res = await fetch(`${origin}/api/proxy/budget?source=${source}&autocreate=1`, { headers: { cookie: cookieHeader }, cache: 'no-store', next: { tags: ['budget-current'] } });
    if (!res.ok) throw new Error(`Error ${res.status}`);
    const d = await res.json();
    amount = Number(d?.budget?.amount ?? 0);
    spent = Number(d?.spent ?? 0);
    remaining = Number(d?.remaining ?? (amount - spent));
    alertThreshold = Number(d?.budget?.alertThreshold ?? 0);
    currencyCode = String(d?.budget?.currency ?? 'PEN');
    budgetName = d?.budget?.name || undefined;
    categories = (d?.categories ?? []).map((c: any) => ({
      ...c,
      budget: c.amount ?? c.budget ?? 0,
      name: c.categoryName ?? c.name ?? 'Sin Nombre',
      expenseCount: c.expenseCount ?? 0
    }));
    unallocatedBudget = Number(d?.unallocatedBudget ?? 0);
  } catch (e) {
    error = e instanceof Error ? e.message : "Error al cargar";
  }

  let byMonthBudget: Array<{ month: number; budget: number; spent: number; remaining: number; currency: string }> = [];
  try {
    const res = await fetch(`${BASE}/api/stats/budget/by-month?source=${source}`, { headers: { cookie: cookieHeader }, cache: 'no-store', next: { tags: ['budget-month'] } });
    if (res.ok) {
      const data = await res.json();
      byMonthBudget = (data?.items ?? []);
    }
  } catch {}

  let allCategories: any[] = [];
  try {
    const res = await fetch(`${BASE}/api/categories`, { headers: { cookie: cookieHeader }, cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      allCategories = data?.items ?? [];
    }
  } catch {}

  let paymentMethods: any[] = [];
  try {
    const res = await fetch(`${origin}/api/proxy/payment-methods`, { headers: { cookie: cookieHeader }, cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      paymentMethods = data?.items ?? [];
    }
  } catch {}

  const formatCurrency = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(n);

  async function saveBudgetAmount(formData: FormData) {
    "use server";
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ");
    const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
    
    const amount = Number(formData.get("amount") || 0);
    const month = Number(formData.get("month")) || (new Date().getMonth() + 1);
    const year = Number(formData.get("year")) || new Date().getFullYear();

    const currency = String(formData.get("currency") || "");
    const name = String(formData.get("name") || "");
    const payload: { month: number; year: number; amount: number; currency?: string; name?: string } = { month, year, amount };
    if (currency) payload.currency = currency;
    if (name) payload.name = name;

    try {
      const res = await fetch(`${BASE}/api/budget`, { method: "POST", headers: { "Content-Type": "application/json", cookie: cookieHeader }, body: JSON.stringify(payload) });
      if (!res.ok) {
        const txt = await res.text();
        console.error("SaveBudget Error:", txt);
        throw new Error(txt || `Error ${res.status}`);
      }
    } catch (e) {
      console.error("SaveBudget Exception:", e);
      throw e;
    }
    revalidatePath('/budget');
  }

  async function saveCategoryBudgetAmount(formData: FormData) {
    "use server";
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ");
    const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
    
    const amount = Number(formData.get("amount") || 0);
    const month = Number(formData.get("month")) || (new Date().getMonth() + 1);
    const year = Number(formData.get("year")) || new Date().getFullYear();
    const categoryId = String(formData.get("categoryId") || "");

    const payload = { month, year, amount, categoryId, target: "CATEGORY" };

    try {
      const res = await fetch(`${BASE}/api/budget`, { method: "POST", headers: { "Content-Type": "application/json", cookie: cookieHeader }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error("Error saving category budget");
    } catch (e) {
      console.error(e);
      throw e;
    }
    revalidatePath('/budget');
  }

  async function saveAlertThreshold(formData: FormData) {
    "use server";
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ");
    const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
    
    const threshold = Number(formData.get("threshold") || 0);
    const month = Number(formData.get("month")) || (new Date().getMonth() + 1);
    const year = Number(formData.get("year")) || new Date().getFullYear();
    const payload: { month: number; year: number; alertThreshold: number } = { month, year, alertThreshold: threshold };
    await fetch(`${BASE}/api/budget`, { method: "POST", headers: { "Content-Type": "application/json", cookie: cookieHeader }, body: JSON.stringify(payload) });
    revalidatePath("/budget");
  }

  async function deleteCategoryBudget(formData: FormData) {
    "use server";
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ");
    const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
    
    const month = Number(formData.get("month")) || (new Date().getMonth() + 1);
    const year = Number(formData.get("year")) || new Date().getFullYear();
    const categoryId = String(formData.get("categoryId") || "");

    try {
      const res = await fetch(`${BASE}/api/budget?target=CATEGORY&categoryId=${categoryId}&month=${month}&year=${year}`, { 
        method: "DELETE", 
        headers: { cookie: cookieHeader } 
      });
      if (!res.ok) throw new Error("Error deleting category budget");
    } catch (e) {
      console.error(e);
      throw e;
    }
    revalidatePath('/budget');
  }

  return (
    <section className="space-y-6 max-w-[1600px] w-full mx-auto px-6 md:px-8 xl:px-12 py-6 md:py-8 lg:py-10">
      <RealtimeRefresh />
      
      {error && <p className="text-red-600 mb-4">{error}</p>}
      
      {!error && (
        <BudgetView
          monthLabel={monthLabel}
          amount={amount}
          spent={spent}
          remaining={remaining}
          alertThreshold={alertThreshold}
          currencyCode={currencyCode}
          byMonthBudget={byMonthBudget}
          onSaveBudget={saveBudgetAmount}
          onSaveThreshold={saveAlertThreshold}
          budgetName={budgetName}
          categories={categories as any}
          allCategories={allCategories}
          unallocatedBudget={unallocatedBudget}
          onSaveCategoryBudget={saveCategoryBudgetAmount}
          onDeleteCategoryBudget={deleteCategoryBudget}
          source={source as "created" | "issued"}
          paymentMethods={paymentMethods as any}
        />
      )}

      
    </section>
  );
}
