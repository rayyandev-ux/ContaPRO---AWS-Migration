import { cookies } from "next/headers";
import { endSession } from "@/lib/store";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  endSession(token);
  cookieStore.delete("session");
  return new Response(null, { status: 204 });
}