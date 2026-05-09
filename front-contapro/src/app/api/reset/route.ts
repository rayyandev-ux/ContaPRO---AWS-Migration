export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Cuerpo JSON requerido" }), { status: 400, headers: { "content-type": "application/json" } });
  }
  try {
    const upstream = await fetch(`${BASE}/api/auth/reset`, {
      method: "POST",
      headers: { "content-type": "application/json", "accept-language": req.headers.get("accept-language") || "es" },
      body: JSON.stringify(body),
    });
    const text = await upstream.text();
    return new Response(text, { status: upstream.status, headers: { "content-type": upstream.headers.get("content-type") || "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Error de proxy" }), { status: 502, headers: { "content-type": "application/json" } });
  }
}