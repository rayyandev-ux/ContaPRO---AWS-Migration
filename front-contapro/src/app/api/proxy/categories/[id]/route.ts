import { cookies } from "next/headers";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ");
  const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
  const { id } = await ctx.params;
  if (!id) return new Response(JSON.stringify({ error: 'id requerido' }), { status: 400, headers: { 'content-type': 'application/json' } });
  const upstream = await fetch(`${BASE}/api/categories/${id}`, { method: 'DELETE', headers: { cookie: cookieHeader } });
  if (upstream.status === 204) return new Response(null, { status: 204 });
  const text = await upstream.text();
  return new Response(text, { status: upstream.status, headers: { 'content-type': upstream.headers.get('content-type') || 'application/json' } });
}