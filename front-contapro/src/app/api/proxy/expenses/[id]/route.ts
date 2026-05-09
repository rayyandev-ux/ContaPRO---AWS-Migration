export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
  const { id } = await ctx.params;
  if (!id) {
    return new Response(JSON.stringify({ error: "Parámetro id requerido" }), { status: 400, headers: { "content-type": "application/json" } });
  }
  try {
    const upstream = await fetch(`${BASE}/api/expenses/${id}`, { headers: { cookie: _req.headers.get("cookie") || "" } });
    const body = await upstream.text();
    return new Response(body, { status: upstream.status, headers: { "content-type": upstream.headers.get("content-type") || "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Error de proxy" }), { status: 502, headers: { "content-type": "application/json" } });
  }
}
