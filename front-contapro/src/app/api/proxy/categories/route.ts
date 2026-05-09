import { cookies } from "next/headers";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ");
  const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
  const upstream = await fetch(`${BASE}/api/categories`, { headers: { cookie: cookieHeader } });
  const text = await upstream.text();
  return new Response(text, { status: upstream.status, headers: { "content-type": upstream.headers.get("content-type") || "application/json" } });
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ");
  const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
  let body: any = null;
  try { body = await req.json(); } catch {}
  const upstream = await fetch(`${BASE}/api/categories`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: cookieHeader }, body: JSON.stringify(body ?? {}) });
  const text = await upstream.text();
  return new Response(text, { status: upstream.status, headers: { 'content-type': upstream.headers.get('content-type') || 'application/json' } });
}