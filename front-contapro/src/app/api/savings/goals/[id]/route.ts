import { cookies } from "next/headers";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ");
  const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
  
  const upstream = await fetch(`${BASE}/api/savings/goals/${id}`, { headers: { cookie: cookieHeader } });
  const text = await upstream.text();
  return new Response(text, { status: upstream.status, headers: { "content-type": upstream.headers.get("content-type") || "application/json" } });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ");
  const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
  
  const upstream = await fetch(`${BASE}/api/savings/goals/${id}`, { 
    method: "DELETE",
    headers: { cookie: cookieHeader } 
  });
  
  const status = upstream.status;
  const text = await upstream.text();
  return new Response(text, { status, headers: { "content-type": upstream.headers.get("content-type") || "application/json" } });
}
