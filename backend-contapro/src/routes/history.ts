import type { FastifyPluginAsync } from 'fastify';
import { isEntitled } from '../utils/subscription.js';
import { requireAuth } from '../utils/auth.js';


export const historyRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', { schema: { summary: 'Get history' } }, async (req, res) => {
    const auth = requireAuth(app, req, res);
    if (!auth) return;
    const { userId, profileId } = auth;
    const user = await app.prisma.user.findUnique({ where: { id: userId }, select: { plan: true, planExpires: true, trialEnds: true } });
    if (!isEntitled(user)) return res.paymentRequired('Suscripción requerida');
    const docs = await app.prisma.document.findMany({ where: { userId, profileId }, select: { id: true, filename: true, uploadedAt: true, analysis: { select: { summary: true, total: true } } }, orderBy: { uploadedAt: 'desc' } });
    return res.send({ ok: true, items: docs.map((d) => ({ id: d.id, filename: d.filename, uploadedAt: d.uploadedAt, summary: d.analysis?.summary, total: d.analysis?.total })) });
  });
};