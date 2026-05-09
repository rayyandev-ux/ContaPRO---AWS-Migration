import { cookies } from "next/headers";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, ctx: { params: Promise<{ documentId: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  const { documentId } = await ctx.params;
  const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
  if (!documentId) {
    return new Response(JSON.stringify({ error: "Parámetro documentId requerido" }), { status: 400, headers: { "content-type": "application/json" } });
  }
  let body: any;
  try { body = await req.json(); } catch { body = null; }
  if (!body || typeof body !== 'object') {
    return new Response(JSON.stringify({ error: "Cuerpo JSON requerido" }), { status: 400, headers: { "content-type": "application/json" } });
  }
  try {
    const upstream = await fetch(`${BASE}/api/analysis/${documentId}/items`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...(token ? { cookie: `session=${token}` } : {}) },
      body: JSON.stringify(body),
    });
    const text = await upstream.text();
    return new Response(text, { status: upstream.status, headers: { 'content-type': upstream.headers.get('content-type') || 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Error de proxy' }), { status: 502, headers: { 'content-type': 'application/json' } });
  }
}

