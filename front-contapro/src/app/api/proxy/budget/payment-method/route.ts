import { cookies } from "next/headers";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildCookieHeader(cs: Awaited<ReturnType<typeof cookies>>) {
  return cs.getAll().map(c => `${c.name}=${c.value}`).join("; ");
}

export async function GET(req: Request) {
  const cs = await cookies();
  const cookieHeader = buildCookieHeader(cs);
  const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
  const url = new URL(req.url);
  const params = url.searchParams.toString();
  const upstream = await fetch(`${BASE}/api/budget/payment-method${params ? `?${params}` : ''}`, { headers: { cookie: cookieHeader } });
  const text = await upstream.text();
  return new Response(text, { status: upstream.status, headers: { "content-type": upstream.headers.get("content-type") || "application/json" } });
}

export async function POST(req: Request) {
  const cs = await cookies();
  const cookieHeader = buildCookieHeader(cs);
  const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
  const body = await req.text();
  const upstream = await fetch(`${BASE}/api/budget/payment-method`, { method: 'POST', headers: { cookie: cookieHeader, 'content-type': 'application/json' }, body });
  const text = await upstream.text();
  return new Response(text, { status: upstream.status, headers: { "content-type": upstream.headers.get("content-type") || "application/json" } });
}

export async function DELETE(req: Request) {
  const cs = await cookies();
  const cookieHeader = buildCookieHeader(cs);
  const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
  const url = new URL(req.url);
  const params = url.searchParams.toString();
  const upstream = await fetch(`${BASE}/api/budget/payment-method${params ? `?${params}` : ''}`, { method: 'DELETE', headers: { cookie: cookieHeader } });
  const text = await upstream.text();
  return new Response(text, { status: upstream.status, headers: { "content-type": upstream.headers.get("content-type") || "application/json" } });
}
