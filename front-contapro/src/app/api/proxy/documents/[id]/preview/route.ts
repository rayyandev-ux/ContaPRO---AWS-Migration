import { cookies } from "next/headers";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";

  const { id } = await ctx.params;
  if (!id) {
    return new Response(JSON.stringify({ error: "Parámetro id requerido" }), { status: 400 });
  }

  try {
    const upstream = await fetch(`${BASE}/api/documents/${id}/preview`, {
      headers: token ? { cookie: `session=${token}` } : undefined,
    });

    const buf = await upstream.arrayBuffer();
    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    const disposition = upstream.headers.get("content-disposition") || "inline";

    return new Response(buf, {
      status: upstream.status,
      headers: {
        "content-type": contentType,
        "content-disposition": disposition,
      },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Error de proxy" }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }
}