import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import PaymentMethodsClient from "./PaymentMethodsClient";

export default async function Page() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ");
  const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";

  let items: Array<{ id: string; name: string; provider: string; type: string; cardLast4?: string | null; currency: string; active: boolean; balance: number; isFavorite: boolean; accountNumber?: string | null }> = [];
  let defaultPaymentMethodId: string | null = null;
  try {
    const res = await fetch(`${BASE}/api/payment-methods`, { headers: { cookie: cookieHeader }, cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      items = (data?.items || []).map((m: any) => ({
        id: m.id,
        name: m.name,
        provider: m.provider,
        type: m.type,
        cardLast4: m.cardLast4,
        currency: m.currency,
        active: m.active,
        balance: m.balance ?? 0,
        isFavorite: m.isFavorite ?? false,
        accountNumber: m.accountNumber
      }));
      defaultPaymentMethodId = data?.defaultPaymentMethodId ?? null;
    }
  } catch {}

  async function createMethod(formData: FormData) {
    "use server";
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ");
    const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
    const payload = {
      name: String(formData.get('name') || ''),
      provider: String(formData.get('provider') || ''),
      type: String(formData.get('type') || ''),
      cardLast4: String(formData.get('cardLast4') || ''),
      accountNumber: String(formData.get('accountNumber') || ''),
      currency: String(formData.get('currency') || ''),
      balance: Number(formData.get('balance') || 0),
      isFavorite: formData.get('isFavorite') === 'true',
      createInitialTransaction: formData.get('createInitialTransaction') === 'true',
    } as any;
    if (!payload.name || !payload.type) return;
    if (!payload.provider) payload.provider = payload.type;
    if (!payload.currency) payload.currency = 'PEN';
    if (payload.cardLast4 && payload.cardLast4.trim() === '') delete payload.cardLast4;
    if (payload.accountNumber && payload.accountNumber.trim() === '') delete payload.accountNumber;
    try {
      await fetch(`${BASE}/api/payment-methods`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: cookieHeader }, body: JSON.stringify(payload) });
    } catch {}
    revalidatePath('/payment-methods');
  }

  async function setDefault(formData: FormData) {
    "use server";
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ");
    const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
    const id = String(formData.get('id') || '');
    if (!id) return;
    try {
      await fetch(`${BASE}/api/payment-methods/${id}/default`, { method: 'POST', headers: { cookie: cookieHeader } });
    } catch {}
    revalidatePath('/payment-methods');
  }

  async function deactivate(formData: FormData) {
    "use server";
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ");
    const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
    const id = String(formData.get('id') || '');
    const deleteTransactions = formData.get('deleteTransactions') === 'true';
    if (!id) return;
    try {
      await fetch(`${BASE}/api/payment-methods/${id}?deleteTransactions=${deleteTransactions}`, { method: 'DELETE', headers: { cookie: cookieHeader } });
    } catch {}
    revalidatePath('/payment-methods');
  }

  async function updateMethod(formData: FormData) {
    "use server";
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ");
    const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
    const id = String(formData.get('id') || '');
    const name = String(formData.get('name') || '');
    const provider = String(formData.get('provider') || '');
    const type = String(formData.get('type') || '');
    const cardLast4 = String(formData.get('cardLast4') || '');
    const accountNumber = String(formData.get('accountNumber') || '');
    const currency = String(formData.get('currency') || '');
    const balance = formData.get('balance');
    const isFavorite = formData.get('isFavorite') === 'true';
    
    if (!id) return;
    const payload: any = {};
    if (name) payload.name = name;
    if (provider) payload.provider = provider;
    if (type) payload.type = type;
    if (currency) payload.currency = currency;
    if (cardLast4) payload.cardLast4 = cardLast4;
    if (accountNumber) payload.accountNumber = accountNumber;
    if (balance !== null) payload.balance = Number(balance);
    payload.isFavorite = isFavorite;

    try {
      const res = await fetch(`${BASE}/api/payment-methods/${id}`, { 
        method: 'PATCH', 
        headers: { 'content-type': 'application/json', cookie: cookieHeader }, 
        body: JSON.stringify(payload) 
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('Error updating payment method:', res.status, errorData);
      }
    } catch (err) {
      console.error('Network error updating payment method:', err);
    }
    revalidatePath('/payment-methods');
  }

  async function transferMethod(formData: FormData) {
    "use server";
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ");
    const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
    const sourceId = String(formData.get('sourceId') || '');
    const targetAccountId = String(formData.get('targetAccountId') || '');
    const amount = Number(formData.get('amount') || 0);
    const description = String(formData.get('description') || '');

    if (!sourceId || !targetAccountId || amount <= 0) return;
    try {
      await fetch(`${BASE}/api/payment-methods/${sourceId}/transfer`, { 
        method: 'POST', 
        headers: { 'content-type': 'application/json', cookie: cookieHeader }, 
        body: JSON.stringify({ targetAccountId, amount, description }) 
      });
    } catch {}
    revalidatePath('/payment-methods');
  }

  async function rebalanceMethod(formData: FormData) {
    "use server";
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ");
    const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
    const id = String(formData.get('id') || '');
    const realBalance = Number(formData.get('realBalance') || 0);

    if (!id) return;
    try {
      await fetch(`${BASE}/api/payment-methods/${id}/rebalance`, { 
        method: 'POST', 
        headers: { 'content-type': 'application/json', cookie: cookieHeader }, 
        body: JSON.stringify({ realBalance }) 
      });
    } catch {}
    revalidatePath('/payment-methods');
  }

  return (
    <PaymentMethodsClient
      items={items}
      defaultPaymentMethodId={defaultPaymentMethodId}
      createMethod={createMethod}
      setDefault={setDefault}
      deactivate={deactivate}
      updateMethod={updateMethod}
      transferMethod={transferMethod}
      rebalanceMethod={rebalanceMethod}
    />
  );
}
