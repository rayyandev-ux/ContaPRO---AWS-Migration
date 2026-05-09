import { cookies } from "next/headers";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ");
  const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
  
  let body: unknown;
  try { body = await req.json(); } catch { body = undefined; }
  
  const upstream = await fetch(`${BASE}/api/savings/goals/${id}/transactions`, { 
    method: "POST", 
    headers: { cookie: cookieHeader, "content-type": "application/json" }, 
    body: body ? JSON.stringify(body) : undefined 
  });
  
  const status = upstream.status;
  const text = await upstream.text();
  return new Response(text, { status, headers: { "content-type": upstream.headers.get("content-type") || "application/json" } });
}
