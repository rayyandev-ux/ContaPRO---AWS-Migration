import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth } from '../utils/auth.js';
import { config } from '../config.js';
import {
  createCustomer,
  getRegisterCardUrl,
  chargeCustomer,
  createSubscription,
  cancelSubscription,
  getSubscription,
  getCustomerSubscriptions,
  deleteCard,
  getFlowPlanId,
  createPaymentLink
} from '../services/flow.js';
import { activateSubscription, handleAddonPurchase } from '../utils/subscription.js';

export const flowPaymentsRoutes = async (fastify: FastifyInstance) => {
  const prisma = fastify.prisma;

  fastify.post('/flow/register-card', async (request: any, reply) => {
    const auth = await requireAuth(fastify, request, reply);
    if (!auth) return;
    const userId = auth.userId;

    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return reply.status(404).send({ error: 'User not found' });

      let flowCustomerId = user.flowCustomerId;

      if (!flowCustomerId) {
        const customer = await createCustomer(userId, user.name || 'User', user.email);
        flowCustomerId = customer.customerId;
        await prisma.user.update({
          where: { id: userId },
          data: { flowCustomerId, paymentProvider: 'FLOW' },
        });
      }

      const redirectUrl = `${config.backendPublicUrl}/api/flow/return/register`;
      const registerResponse = await getRegisterCardUrl(flowCustomerId, redirectUrl);

      return reply.send({ url: registerResponse.url + '?token=' + registerResponse.token });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  });

  fastify.post('/flow/checkout', async (request: any, reply) => {
    const auth = await requireAuth(fastify, request, reply);
    if (!auth) return;
    const userId = auth.userId;
    const { period } = request.body;

    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return reply.status(404).send({ error: 'User not found' });

      let flowCustomerId = user.flowCustomerId;

      // 1. Si NO tiene flowCustomerId, crearlo
      if (!flowCustomerId) {
        const customer = await createCustomer(userId, user.name || 'User', user.email);
        flowCustomerId = customer.customerId;
        await prisma.user.update({
          where: { id: userId },
          data: { flowCustomerId, paymentProvider: 'FLOW' },
        });
      }

      // 2. Si NO tiene tarjeta, usar paymentLink (pago único) para permitir Yape/Plin
      if (!user.flowCardLast4) {
        let amount = 0;
        let subject = '';

        if (period === 'MONTHLY') {
          amount = 18;
          subject = 'ContaPRO Plan Mensual';
        } else if (period === 'ANNUAL') {
          amount = 120;
          subject = 'ContaPRO Plan Anual';
        } else {
          return reply.status(400).send({ error: 'Invalid period' });
        }

        const commerceOrder = `${userId.substring(0, 8)}-${Date.now()}`;
        const urlConfirmation = `${config.backendPublicUrl}/api/flow/callback/payment`;
        const urlReturn = `${config.backendPublicUrl}/api/flow/return/payment`;

        const paymentResponse = await createPaymentLink(
          amount,
          commerceOrder,
          subject,
          user.email,
          urlConfirmation,
          urlReturn
        );

        await prisma.payment.create({
          data: {
            userId,
            provider: 'FLOW',
            orderId: commerceOrder,
            flowToken: paymentResponse.token,
            period,
            currency: 'PEN',
            amount,
            status: 'PENDING',
          }
        });

        // Guardar el plan pendiente para activarlo en el callback
        await prisma.user.update({
          where: { id: userId },
          data: { flowPendingPlan: period }
        });

        return reply.send({ url: paymentResponse.url + '?token=' + paymentResponse.token });
      }

      // 3. Si tiene tarjeta guardada, suscribir automáticamente
      const planId = getFlowPlanId('PRO', period === 'ANNUAL');
      const sub = await createSubscription(planId, flowCustomerId);
      
      await activateSubscription(fastify, userId, period === 'ANNUAL' ? 'PREMIUM' : 'PREMIUM', new Date(sub.next_invoice_date), {
        flowSubscriptionId: sub.subscriptionId,
        flowSubscriptionPlanId: sub.planId,
        paymentProvider: 'FLOW'
      });

      return reply.send({ ok: true, subscriptionId: sub.subscriptionId });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  });

  fastify.post('/flow/buy-extra', async (request: any, reply) => {
    const auth = await requireAuth(fastify, request, reply);
    if (!auth) return;
    const userId = auth.userId;
    const { type, plan } = request.body; // type: EXTRA_PROFILE | EXTRA_EMAIL, plan: MONTHLY | ANNUAL

    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return reply.status(404).send({ error: 'User not found' });

      let flowCustomerId = user.flowCustomerId;
      if (!flowCustomerId) {
        const customer = await createCustomer(userId, user.name || 'User', user.email);
        flowCustomerId = customer.customerId;
        await prisma.user.update({
          where: { id: userId },
          data: { flowCustomerId, paymentProvider: 'FLOW' },
        });
      }

      // Si no tiene tarjeta, creamos enlace de pago único (Yape/Plin)
      if (!user.flowCardLast4) {
        let amount = 0;
        let subject = '';

        if (type === 'EXTRA_PROFILE') {
          amount = plan === 'ANNUAL' ? 54 : 9;
          subject = plan === 'ANNUAL' ? 'Perfil Extra Anual' : 'Perfil Extra Mensual';
        } else if (type === 'EXTRA_EMAIL') {
          amount = plan === 'ANNUAL' ? 50 : 5;
          subject = plan === 'ANNUAL' ? 'Email Extra Anual' : 'Email Extra Mensual';
        } else {
          return reply.status(400).send({ error: 'Invalid add-on type' });
        }

        const commerceOrder = `${userId.substring(0, 8)}-ADDON-${Date.now()}`;
        const urlConfirmation = `${config.backendPublicUrl}/api/flow/callback/payment`;
        const urlReturn = `${config.backendPublicUrl}/api/flow/return/payment`;

        const paymentResponse = await createPaymentLink(
          amount,
          commerceOrder,
          subject,
          user.email,
          urlConfirmation,
          urlReturn
        );

        await prisma.payment.create({
          data: {
            userId,
            provider: 'FLOW',
            orderId: commerceOrder,
            flowToken: paymentResponse.token,
            period: type, // Guardamos el tipo de addon (EXTRA_PROFILE/EXTRA_EMAIL) en period para procesarlo luego
            currency: 'PEN',
            amount,
            status: 'PENDING',
          }
        });

        return reply.send({ url: paymentResponse.url + '?token=' + paymentResponse.token });
      }

      // Si tiene tarjeta guardada, usar suscripción automática
      const planId = getFlowPlanId(type, plan === 'ANNUAL');
      const sub = await createSubscription(planId, flowCustomerId);
      
      await handleAddonPurchase(fastify, userId, type);

      return reply.send({ ok: true, subscriptionId: sub.subscriptionId });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  });

  fastify.get('/flow/subscription', async (request: any, reply) => {
    const auth = await requireAuth(fastify, request, reply);
    if (!auth) return;
    const userId = auth.userId;
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || !user.flowSubscriptionId) return reply.send(null);

      const sub = await getSubscription(user.flowSubscriptionId);
      
      // Get all subscriptions to find add-ons
      let addons: any[] = [];
      if (user.flowCustomerId) {
         try {
           const allSubs = await getCustomerSubscriptions(user.flowCustomerId);
           // filter active addons
           addons = allSubs.data?.filter((s: any) => s.status === 1 && s.subscriptionId !== user.flowSubscriptionId) || [];
         } catch(e) {
           // Ignore if endpoint fails or doesn't support list
         }
      }

      return reply.send({
        id: sub.subscriptionId,
        planId: sub.planId,
        status: sub.status === 1 ? 'active' : 'canceled',
        current_period_end: new Date(sub.next_invoice_date).getTime() / 1000,
        cancel_at_period_end: sub.cancel_at ? true : false,
        addons
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  });

  fastify.post('/flow/subscription/cancel', async (request: any, reply) => {
    const auth = await requireAuth(fastify, request, reply);
    if (!auth) return;
    const userId = auth.userId;
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || !user.flowSubscriptionId) return reply.status(404).send({ error: 'No active flow subscription' });

      await cancelSubscription(user.flowSubscriptionId, 1); // 1 = at period end
      
      return reply.send({ ok: true });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  });

  fastify.get('/flow/payment-methods', async (request: any, reply) => {
    const auth = await requireAuth(fastify, request, reply);
    if (!auth) return;
    const userId = auth.userId;
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || !user.flowCardLast4) return reply.send({ data: [] });

      return reply.send({
        data: [{
          id: 'flow-card',
          card: {
            brand: user.flowCardType?.toLowerCase() || 'tarjeta',
            last4: user.flowCardLast4
          }
        }]
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  });

  fastify.post('/flow/payment-methods/delete', async (request: any, reply) => {
    const auth = await requireAuth(fastify, request, reply);
    if (!auth) return;
    const userId = auth.userId;
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || !user.flowCustomerId) return reply.send({ ok: true });

      await deleteCard(user.flowCustomerId);

      await prisma.user.update({
        where: { id: userId },
        data: { flowCardLast4: null, flowCardType: null }
      });

      return reply.send({ ok: true });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  });

  fastify.get('/flow/history', async (request: any, reply) => {
    const auth = await requireAuth(fastify, request, reply);
    if (!auth) return;
    const userId = auth.userId;
    try {
      const payments = await prisma.payment.findMany({
        where: { userId, provider: 'FLOW' },
        orderBy: { createdAt: 'desc' }
      });
      return reply.send(payments);
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  });
};
