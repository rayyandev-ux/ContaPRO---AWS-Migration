import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ");
  const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";     
  
  const { signal } = req;

  try {
    const upstream = await fetch(`${BASE}/api/stream`, {
      headers: { 
        cookie: cookieHeader,
        "Accept": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      },
      signal,
    });
    
    if (!upstream.ok || !upstream.body) {
      return new Response(JSON.stringify({ error: "Upstream connection failed" }), { 
        status: upstream.status || 502, 
        headers: { "content-type": "application/json" } 
      });
    }

    // Devolver el stream directo para SSE
    return new Response(upstream.body, { 
      status: upstream.status, 
      headers: { 
        "Content-Type": "text/event-stream", 
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no"
      } 
    });
  } catch (e: any) {
    if (e.name === 'AbortError') {
      return new Response(null, { status: 499 });
    }
    console.error("[SSE Proxy Error]:", e);
    return new Response(JSON.stringify({ error: e?.message || "Error de proxy SSE" }), { status: 502, headers: { "content-type": "application/json" } });
  }
}
