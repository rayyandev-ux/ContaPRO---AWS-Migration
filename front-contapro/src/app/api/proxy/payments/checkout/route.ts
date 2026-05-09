import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ");
  const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
  const contentType = req.headers.get("content-type") || "application/json";

  try {
    let bodyJson: any;
    try {
      bodyJson = await req.json();
    } catch {
      bodyJson = undefined;
    }

    const upstream = await fetch(`${BASE}/api/payments/checkout`, {
      method: "POST",
      headers: { 
        cookie: cookieHeader, 
        "content-type": "application/json" 
      },
      body: bodyJson ? JSON.stringify(bodyJson) : undefined,
    });

    const data = await upstream.json().catch(() => ({}));
    return new Response(JSON.stringify(data), { 
      status: upstream.status, 
      headers: { "content-type": "application/json" } 
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Error de proxy" }), { 
      status: 502, 
      headers: { "content-type": "application/json" } 
    });
  }
}
