import { cookies } from "next/headers";
// Removed tag revalidation to avoid TS signature mismatch

export async function POST() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ");
  const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
  const res = await fetch(`${BASE}/api/integrations/whatsapp/unlink`, { method: "POST", headers: { cookie: cookieHeader } });
  const data = await res.json().catch(() => ({}));
  // Cache invalidation by tag removed; rely on path-level revalidation where needed
  return new Response(JSON.stringify(data), { status: res.status, headers: { "Content-Type": "application/json" } });
}