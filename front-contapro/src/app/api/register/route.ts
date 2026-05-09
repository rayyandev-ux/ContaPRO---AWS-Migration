import { cookies } from "next/headers";
import { addUser, findUserByEmail, createSession } from "@/lib/store";

export async function POST(req: Request) {
  try {
    const { email, password, name } = await req.json();
    if (!email || !password) {
      return Response.json({ ok: false, error: "Email y contraseña requeridos" }, { status: 400 });
    }
    const existing = findUserByEmail(email);
    if (existing) {
      return Response.json({ ok: false, error: "El usuario ya existe" }, { status: 409 });
    }
    const user = { id: crypto.randomUUID(), email, password, name };
    addUser(user);
    const token = createSession(user.id);
    const cookieStore = await cookies();
    cookieStore.set("session", token, { httpOnly: true, sameSite: "lax", path: "/" });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: "Error inesperado" }, { status: 500 });
  }
}