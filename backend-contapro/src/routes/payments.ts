import type { FastifyPluginAsync } from 'fastify';
import { config } from '../config.js';
import { requireAuth } from '../utils/auth.js';
import { activateSubscription, handleAddonPurchase } from '../utils/subscription.js';
import { publishEvent } from '../services/realtime.js';

function calcExpires(plan: string): Date | null {
  const now = Date.now();
  switch (plan) {
    case 'MONTHLY': return new Date(now + 30 * 24 * 60 * 60 * 1000);
    case 'QUARTERLY': return new Date(now + 90 * 24 * 60 * 60 * 1000);
    case 'ANNUAL': return new Date(now + 365 * 24 * 60 * 60 * 1000);
    case 'LIFETIME': return null;
    default: return new Date(now + 30 * 24 * 60 * 60 * 1000);
  }
}

export const paymentsRoutes: FastifyPluginAsync = async (app) => {

  app.post('/portal', { schema: { summary: 'Billing portal (mock)' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return;
    return res.send({ url: `${config.frontendUrl}/billing` });
  });

  app.post('/checkout', {
    schema: {
      summary: 'Activate plan (mock)',
      body: {
        type: 'object',
        properties: {
          plan: { type: 'string', enum: ['MONTHLY', 'ANNUAL', 'LIFETIME', 'QUARTERLY', 'EXTRA_PROFILE', 'EXTRA_EMAIL'] },
          trial: { type: 'boolean' }
        }
      }
    }
  }, async (req, res) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return;
    const { userId } = auth;
    const body: any = req.body || {};
    const plan: string = body.plan || 'MONTHLY';
    const isTrial = String(body.trial) === 'true' || body.trial === true;

    if (!['MONTHLY', 'ANNUAL', 'LIFETIME', 'QUARTERLY', 'EXTRA_PROFILE', 'EXTRA_EMAIL'].includes(plan)) {
      return res.badRequest(`Plan inválido: ${plan}`);
    }

    const user = await app.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.unauthorized('No autenticado');

    if (isTrial && user.hasUsedTrial) {
      return res.badRequest('Ya has utilizado tu periodo de prueba anteriormente.');
    }

    if (plan === 'EXTRA_PROFILE' || plan === 'EXTRA_EMAIL') {
      await handleAddonPurchase(app, userId, plan);
      await publishEvent(userId, { type: 'subscription:updated' });
      return res.send({ url: `${config.frontendUrl}/dashboard?action=${plan.toLowerCase()}_purchased` });
    }

    const expires = isTrial ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : calcExpires(plan);
    await activateSubscription(app, userId, plan, expires, {});

    const orderId = `mock_${Date.now().toString(36)}`;
    await app.prisma.payment.create({
      data: {
        userId,
        provider: 'MOCK',
        orderId,
        period: plan,
        currency: 'USD',
        amount: 0,
        status: 'PAID',
      },
    });

    await publishEvent(userId, { type: 'subscription:updated' });
    return res.send({ url: `${config.frontendUrl}/payments/success` });
  });

  app.get('/history', { schema: { summary: 'Get payment history' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return;
    const { userId } = auth;

    const items = await app.prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, period: true, status: true, amount: true, currency: true }
    });

    return res.send({ ok: true, items });
  });

  app.get('/payment-methods', { schema: { summary: 'List payment methods (mock)' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return;
    return res.send({ ok: true, items: [] });
  });

  app.post('/payment-methods/:id/detach', { schema: { summary: 'Detach payment method (mock)' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return;
    return res.send({ ok: true });
  });

  app.post('/payment-methods/:id/default', { schema: { summary: 'Set default payment method (mock)' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return;
    return res.send({ ok: true });
  });

  app.get('/subscription', { schema: { summary: 'Get subscription details (mock)' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return;
    const { userId } = auth;

    const user = await app.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, planExpires: true }
    });

    const isActive = user?.plan === 'PREMIUM' || user?.plan === 'LIFETIME';
    return res.send({
      ok: true,
      subscription: isActive ? {
        id: 'mock_sub',
        status: 'active',
        currentPeriodEnd: user?.planExpires?.toISOString() || null,
        cancelAtPeriodEnd: false,
        interval: 'month',
        amount: 0,
        currency: 'USD',
        plan: user?.plan
      } : null,
      plan: user?.plan,
      extraSubscriptions: []
    });
  });

  app.post('/subscription/:id/cancel', { schema: { summary: 'Cancel subscription (mock)' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return;
    const { userId } = auth;

    await app.prisma.user.update({
      where: { id: userId },
      data: { plan: 'FREE', planExpires: null }
    });

    await publishEvent(userId, { type: 'subscription:updated' });
    return res.send({ ok: true });
  });

  app.post('/subscription/:id/resume', { schema: { summary: 'Resume subscription (mock)' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return;
    return res.send({ ok: true });
  });

  app.get('/invoices', { schema: { summary: 'List invoices (mock)' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return;
    return res.send({ ok: true, items: [] });
  });

  app.post('/setup-intent', { schema: { summary: 'Setup intent (mock)' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return;
    return res.send({ ok: true, clientSecret: 'mock_secret' });
  });

  app.post('/buy-extra', {
    schema: {
      summary: 'Buy extra (mock)',
      body: {
        type: 'object',
        required: ['type'],
        properties: {
          type: { type: 'string', enum: ['EXTRA_PROFILE', 'EXTRA_EMAIL', 'PLAN'] },
          plan: { type: 'string', enum: ['MONTHLY', 'ANNUAL', 'LIFETIME', 'QUARTERLY'] }
        }
      }
    }
  }, async (req, res) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return;
    const { userId } = auth;
    const { type, plan } = req.body as { type: string; plan?: string };

    const user = await app.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.unauthorized();

    if (type === 'EXTRA_PROFILE' || type === 'EXTRA_EMAIL') {
      await handleAddonPurchase(app, userId, type);
      await publishEvent(userId, { type: 'subscription:updated' });
      return res.send({ ok: true });
    }

    if (type === 'PLAN' && plan) {
      const expires = calcExpires(plan);
      await activateSubscription(app, userId, plan, expires, {});
      await publishEvent(userId, { type: 'subscription:updated' });
      return res.send({ ok: true });
    }

    return res.badRequest('Tipo no válido');
  });

};
