import { cookies } from "next/headers";
import { createSession, findUserByEmail } from "@/lib/store";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return Response.json({ ok: false, error: "Email y contraseña requeridos" }, { status: 400 });
    }
    const user = findUserByEmail(email);
    if (!user || user.password !== password) {
      return Response.json({ ok: false, error: "Credenciales inválidas" }, { status: 401 });
    }
    const token = createSession(user.id);
    const cookieStore = await cookies();
    cookieStore.set("session", token, { httpOnly: true, sameSite: "lax", path: "/" });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: "Error inesperado" }, { status: 500 });
  }
}