import { cookies } from "next/headers";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ");
  const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
  const url = new URL(req.url);
  const qs = url.search;
  const upstream = await fetch(`${BASE}/api/savings/goals${qs}`, { headers: { cookie: cookieHeader } });
  const text = await upstream.text();
  return new Response(text, { status: upstream.status, headers: { "content-type": upstream.headers.get("content-type") || "application/json" } });
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ");
  const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
  let body: unknown;
  try { body = await req.json(); } catch { body = undefined; }
  const upstream = await fetch(`${BASE}/api/savings/goals`, { 
    method: "POST", 
    headers: { cookie: cookieHeader, "content-type": "application/json" }, 
    body: body ? JSON.stringify(body) : undefined 
  });
  const status = upstream.status;
  const text = await upstream.text();
  return new Response(text, { status, headers: { "content-type": upstream.headers.get("content-type") || "application/json" } });
}
