import { cookies } from "next/headers";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ");
  const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
  const upstream = await fetch(`${BASE}/api/payment-methods`, { headers: { cookie: cookieHeader } });
  const text = await upstream.text();
  return new Response(text, { status: upstream.status, headers: { "content-type": upstream.headers.get("content-type") || "application/json" } });
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ");
  const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
  const body = await req.text();
  const upstream = await fetch(`${BASE}/api/payment-methods`, { method: 'POST', headers: { cookie: cookieHeader, 'content-type': 'application/json' }, body });
  const text = await upstream.text();
  return new Response(text, { status: upstream.status, headers: { "content-type": upstream.headers.get("content-type") || "application/json" } });
}

export async function PATCH(req: Request) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ");
  const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return new Response(JSON.stringify({ ok: false, error: 'id requerido' }), { status: 400 });
  const body = await req.text();
  const upstream = await fetch(`${BASE}/api/payment-methods/${id}`, { method: 'PATCH', headers: { cookie: cookieHeader, 'content-type': 'application/json' }, body });
  const text = await upstream.text();
  return new Response(text, { status: upstream.status, headers: { "content-type": upstream.headers.get("content-type") || "application/json" } });
}

export async function DELETE(req: Request) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ");
  const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return new Response(JSON.stringify({ ok: false, error: 'id requerido' }), { status: 400 });
  const upstream = await fetch(`${BASE}/api/payment-methods/${id}`, { method: 'DELETE', headers: { cookie: cookieHeader } });
  const text = await upstream.text();
  return new Response(text, { status: upstream.status, headers: { "content-type": upstream.headers.get("content-type") || "application/json" } });
}
