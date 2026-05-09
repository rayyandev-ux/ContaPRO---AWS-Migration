import { cookies } from "next/headers";

export async function PUT(req: Request) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ");
  const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
  
  const body = await req.json().catch(() => ({}));

  const res = await fetch(`${BASE}/api/integrations/google/settings`, {
    method: "PUT",
    headers: { 
        "Content-Type": "application/json",
        cookie: cookieHeader 
    },
    body: JSON.stringify(body)
  });

  const data = await res.json().catch(() => ({}));
  return new Response(JSON.stringify(data), { status: res.status, headers: { "Content-Type": "application/json" } });
}
