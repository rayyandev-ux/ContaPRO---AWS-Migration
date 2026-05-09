import { cookies } from "next/headers";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ");
  const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
  const qs = new URL(req.url).search;
  const upstream = await fetch(`${BASE}/api/budget/category/total${qs}`, { headers: { cookie: cookieHeader } });
  const text = await upstream.text();
  return new Response(text, { status: upstream.status, headers: { "content-type": upstream.headers.get("content-type") || "application/json" } });
}