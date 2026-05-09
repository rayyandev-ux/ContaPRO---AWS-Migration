import path from "path";
import { promises as fs } from "fs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const mode = (url.searchParams.get("mode") || "light").toLowerCase();
    const baseDefault = path.join(process.cwd(), "public", "sponsors");
    const baseDark = path.join(baseDefault, "dark");
    const base = mode === "dark" ? baseDark : baseDefault;
    let files: string[] = [];
    try {
      files = await fs.readdir(base);
    } catch {
      files = await fs.readdir(baseDefault);
    }
    const images = files.filter((f) => /\.(png|jpe?g|svg|webp)$/i.test(f));
    let mapping: Record<string, string> = {};
    try {
      const raw = await fs.readFile(path.join(base, "sponsors.json"), "utf-8");
      const parsed = JSON.parse(raw);
      mapping = typeof parsed === "object" && parsed ? (parsed as Record<string, string>) : {};
    } catch {}
    if (!mapping || Object.keys(mapping).length === 0) {
      try {
        const rawDef = await fs.readFile(path.join(baseDefault, "sponsors.json"), "utf-8");
        const parsedDef = JSON.parse(rawDef);
        mapping = typeof parsedDef === "object" && parsedDef ? (parsedDef as Record<string, string>) : {};
      } catch {}
    }
    const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, "");
    const mappingNormalized: Record<string, string> = {};
    for (const k of Object.keys(mapping)) {
      mappingNormalized[normalize(k)] = mapping[k];
      const baseName = k.replace(/\.[^.]+$/, "");
      mappingNormalized[normalize(baseName)] = mapping[k];
    }
    const items = images.map((f) => ({
      name: f.replace(/\.[^.]+$/, ""),
      src: mode === "dark" ? `/sponsors/dark/${f}` : `/sponsors/${f}`,
      href:
        mapping[f] ||
        mapping[f.replace(/\.[^.]+$/, "")] ||
        mappingNormalized[normalize(f)] ||
        mappingNormalized[normalize(f.replace(/\.[^.]+$/, ""))] ||
        "#",
    }));
    return Response.json(items);
  } catch (e) {
    return Response.json([], { status: 200 });
  }
}