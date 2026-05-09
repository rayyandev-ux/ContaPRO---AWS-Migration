import { cookies } from "next/headers";
import { addHistory, getUserIdByToken } from "@/lib/store";

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  const userId = getUserIdByToken(token);
  if (!userId) {
    return Response.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }

  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return Response.json({ ok: false, error: "Content-Type inválido" }, { status: 400 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return Response.json({ ok: false, error: "Archivo requerido" }, { status: 400 });
  }

  const filename = file.name;
  const summary = `Análisis simulado para ${filename}: total estimado $${(Math.random() * 100).toFixed(2)}`;
  addHistory({
    id: crypto.randomUUID(),
    userId,
    filename,
    uploadedAt: new Date().toISOString(),
    summary,
  });

  return Response.json({ ok: true, summary });
}