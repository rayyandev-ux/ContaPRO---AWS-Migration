import { cookies } from "next/headers";
import { getHistoryByUser, getUserIdByToken } from "@/lib/store";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  const userId = getUserIdByToken(token);
  if (!userId) {
    return Response.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }
  const items = getHistoryByUser(userId);
  return Response.json({ ok: true, items });
}