import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../utils/auth.js';

export const promoRoutes: FastifyPluginAsync = async (app) => {
  const RedeemBody = z.object({ code: z.string().min(3).max(64) });
  app.post('/redeem', { schema: { summary: 'Canjear código promocional' } }, async (req, res) => {
    const auth = requireAuth(app, req, res);
    if (!auth) return;
    const { userId } = auth;
    const parse = RedeemBody.safeParse(req.body);
    if (!parse.success) return res.badRequest('Código inválido');
    const raw = parse.data.code.trim(); // Case sensitive match for now, or normalize? Usually coupons are uppercase.
    // Let's assume input might be mixed, but DB stores as is. Let's try exact match first.
    
    // Check Marketing Coupons (Multi-use)
    const coupon = await app.prisma.coupon.findUnique({ where: { code: raw } });
    if (coupon) {
        if (!coupon.active) return res.badRequest('Cupón inactivo');
        if (coupon.expiresAt && coupon.expiresAt < new Date()) return res.badRequest('Cupón expirado');
        if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) return res.badRequest('Cupón agotado');
        
        // Check if user already redeemed
        const existing = await app.prisma.couponRedemption.findUnique({
            where: { userId_couponId: { userId, couponId: coupon.id } }
        });
        if (existing) return res.badRequest('Ya has canjeado este cupón');

        // Apply
        const user = await app.prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.unauthorized('Usuario no encontrado');

        const now = new Date();
        const days = coupon.days;
        let updateData: any = {};
        
        // Logic: extend existing premium or start new
        if ((user.plan || 'FREE') === 'PREMIUM') {
            const base = user.planExpires && user.planExpires > now ? user.planExpires : now;
            const expires = new Date(base);
            expires.setDate(expires.getDate() + days);
            updateData = { plan: 'PREMIUM', planExpires: expires, trialEnds: null };
        } else {
            // If FREE, upgrade to PREMIUM (trial-like but PLAN=PREMIUM)
            // Or should it be TRIAL? User said "unlock premium plan". Let's set as PREMIUM.
            const expires = new Date();
            expires.setDate(expires.getDate() + days);
            updateData = { plan: 'PREMIUM', planExpires: expires, trialEnds: null };
        }

        await app.prisma.$transaction([
            app.prisma.user.update({ where: { id: userId }, data: updateData }),
            app.prisma.coupon.update({ where: { id: coupon.id }, data: { usedCount: { increment: 1 } } }),
            app.prisma.couponRedemption.create({ data: { userId, couponId: coupon.id } })
        ]);

        return { ok: true, message: `Cupón canjeado: ${days} días de Premium agregados` };
    }

    // Fallback to old PromoCode (Single use) logic if needed, or remove it.
    // For now, I'll keep the old logic for backward compatibility if any codes exist.
    const promo = await app.prisma.promoCode.findUnique({ where: { code: raw } });
    if (!promo) return res.notFound('Código no válido');
    if (promo.deletedAt) return res.badRequest('Código eliminado');
    if (promo.redeemedById) return res.badRequest('Código ya canjeado');

    const user = await app.prisma.user.findUnique({ where: { id: userId }, select: { plan: true, planExpires: true, trialEnds: true } });
    if (!user) return res.unauthorized('No autenticado');
    const now = new Date();
    const days = promo.days;

    let updateData: any = {};
    if ((user.plan || 'FREE') === 'PREMIUM') {
      const base = user.planExpires && user.planExpires > now ? user.planExpires : now;
      const expires = new Date(base);
      expires.setDate(expires.getDate() + days);
      updateData = { plan: 'PREMIUM', planExpires: expires, trialEnds: null };
    } else {
      const base = user.trialEnds && user.trialEnds > now ? user.trialEnds : now;
      const trial = new Date(base);
      trial.setDate(trial.getDate() + days);
      updateData = { trialEnds: trial };
    }

    const applied = await app.prisma.$transaction(async (tx) => {
      const txAny: any = tx;
      // Using updateMany to ensure concurrency safety (check redeemedById is null)
      const ok = await txAny.promoCode.updateMany({ where: { id: promo.id, redeemedById: null, deletedAt: null }, data: { redeemedById: userId, redeemedAt: new Date() } });
      if (!ok.count) return false;
      await tx.user.update({ where: { id: userId }, data: updateData });
      return true;
    });
    if (!applied) return res.badRequest('No se pudo canjear (ya usado)');
    
    return { ok: true, message: 'Código canjeado correctamente' };
  });
};
