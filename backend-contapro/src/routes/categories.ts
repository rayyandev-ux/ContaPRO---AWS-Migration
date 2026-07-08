import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { sanitizeText, fixUtf8Mojibake } from '../utils/format.js';
import { publishEvent } from '../services/realtime.js';
import { requireAuth, extractToken } from '../utils/auth.js';


export const categoriesRoutes: FastifyPluginAsync = async (app) => {
  const CreateBody = z.object({ name: z.string().min(2) });

  app.get('/', { schema: { summary: 'List categories (global + user)' } }, async (req, res) => {
    // Auth is optional for listing categories — returns global ones if not authenticated
    const auth = await (async () => {
      const token = extractToken(req);
      if (!token) return null;
      try {
        const payload = app.jwt.verify(token) as { sub: string; profileId?: string };
        if (!payload.profileId) return null;
        return { userId: payload.sub, profileId: payload.profileId };
      } catch { return null; }
    })();
    
    const where: any = auth ? { OR: [ { userId: null }, { userId: auth.userId, profileId: auth.profileId } ] } : { userId: null };
    const cats = await app.prisma.category.findMany({ where, orderBy: { name: 'asc' } });
    const byKey = new Map<string, any>();
    for (const c of cats) {
      const nameFixed = fixUtf8Mojibake(c.name);
      const key = nameFixed.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const prev = byKey.get(key);
      if (!prev || (!prev.userId && c.userId)) {
        byKey.set(key, { ...c, name: nameFixed });
      }
    }
    const items = Array.from(byKey.values()).sort((a, b) => a.name.localeCompare(b.name));
    return res.send({ ok: true, items });
  });

  app.post('/', { schema: { summary: 'Create category (scoped to user)' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return;
    const { userId, profileId } = auth;
    const parse = CreateBody.safeParse(req.body);
    if (!parse.success) return res.badRequest('Datos inválidos');
    const nameSan = sanitizeText(parse.data.name)?.trim();
    if (!nameSan) return res.badRequest('Nombre inválido');
    const key = nameSan.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const pool = await app.prisma.category.findMany({ where: { OR: [ { userId: null }, { userId, profileId } ] } });
    const hit = pool.find(c => c.name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === key);
    if (hit) return res.conflict('Categoría ya existe');
    const map: Record<string, string> = { alimentacion: 'Alimentación', transporte: 'Transporte', servicios: 'Servicios', entretenimiento: 'Entretenimiento', educacion: 'Educación', salud: 'Salud', vivienda: 'Vivienda', tecnologia: 'Tecnología', impuestos: 'Impuestos', otros: 'Otros' };
    const v = key;
    const finalName = map[v] || nameSan;
    const cat = await app.prisma.category.create({ data: { name: finalName, userId, profileId } });
    
    publishEvent(userId, { type: 'MUTATION', entity: 'CATEGORY', action: 'CREATE' }).catch(console.error);
    
    return res.send({ ok: true, item: cat });
  });

  app.delete('/:id', { schema: { summary: 'Delete user category' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return;
    const { userId, profileId } = auth;
    const id = (req.params as any).id as string;
    if (!id) return res.badRequest('id requerido');
    const cat = await app.prisma.category.findUnique({ where: { id } });
    if (!cat) return res.notFound('No encontrado');
    if (cat.userId !== userId || cat.profileId !== profileId) return res.forbidden('No permitido');
    await app.prisma.expense.updateMany({ where: { userId, profileId, categoryId: id }, data: { categoryId: null } });
    await app.prisma.budget.deleteMany({ where: { userId, profileId, categoryId: id, target: 'CATEGORY' as any } });
    await app.prisma.category.delete({ where: { id } });
    
    publishEvent(userId, { type: 'MUTATION', entity: 'CATEGORY', action: 'DELETE' }).catch(console.error);
    
    return res.code(204).send();
  });

  app.put('/:id', { schema: { summary: 'Update user category' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return;
    const { userId, profileId } = auth;
    const id = (req.params as any).id as string;
    if (!id) return res.badRequest('id requerido');
    const parse = CreateBody.safeParse(req.body);
    if (!parse.success) return res.badRequest('Datos inválidos');
    const nameSan = sanitizeText(parse.data.name)?.trim();
    if (!nameSan) return res.badRequest('Nombre inválido');
    
    const cat = await app.prisma.category.findUnique({ where: { id } });
    if (!cat) return res.notFound('No encontrado');
    if (cat.userId !== userId || cat.profileId !== profileId) return res.forbidden('No permitido');
    
    const key = nameSan.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const pool = await app.prisma.category.findMany({ where: { OR: [ { userId: null }, { userId, profileId } ] } });
    const hit = pool.find(c => c.id !== id && c.name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === key);
    if (hit) return res.conflict('Categoría ya existe');
    
    const updated = await app.prisma.category.update({ where: { id }, data: { name: nameSan } });
    
    publishEvent(userId, { type: 'MUTATION', entity: 'CATEGORY', action: 'UPDATE' }).catch(console.error);
    
    return res.send({ ok: true, item: updated });
  });
};
