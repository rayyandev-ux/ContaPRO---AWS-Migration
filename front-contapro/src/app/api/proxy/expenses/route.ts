import { cookies } from "next/headers";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ");
  const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
  const url = new URL(req.url);
  const qs = url.search;
  try {
    const upstream = await fetch(`${BASE}/api/expenses${qs}`, {
      headers: { cookie: cookieHeader },
    });
    const text = await upstream.text();
    return new Response(text, { status: upstream.status, headers: { "content-type": upstream.headers.get("content-type") || "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Error de proxy" }), { status: 502, headers: { "content-type": "application/json" } });
  }
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ");
  const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
  const contentType = req.headers.get("content-type") || "application/octet-stream";
  try {
    const ct = contentType.toLowerCase();
    let upstream: Response;
    if (ct.startsWith('application/json')) {
      let bodyJson: unknown;
      try { bodyJson = await req.json(); } catch { bodyJson = undefined; }
      upstream = await fetch(`${BASE}/api/expenses`, {
        method: "POST",
        headers: { cookie: cookieHeader, "content-type": "application/json" },
        body: bodyJson ? JSON.stringify(bodyJson) : undefined,
      });
    } else {
      upstream = await fetch(`${BASE}/api/expenses`, {
        method: "POST",
        headers: { cookie: cookieHeader, "content-type": contentType },
        body: await req.arrayBuffer(),
      });
    }
    const text = await upstream.text();
    return new Response(text, { status: upstream.status, headers: { "content-type": upstream.headers.get("content-type") || "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Error de proxy" }), { status: 502, headers: { "content-type": "application/json" } });
  }
}
