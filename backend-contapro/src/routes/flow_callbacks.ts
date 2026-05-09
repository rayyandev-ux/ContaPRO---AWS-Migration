import { FastifyInstance } from 'fastify';
import {
  getRegisterStatus,
  createSubscription,
  getPaymentStatus,
  getSubscription,
} from '../services/flow.js';
import { publishEvent } from '../services/realtime.js';
import { config } from '../config.js';
import { getFlowPlanId } from '../services/flow.js';
import { activateSubscription, handleAddonPurchase } from '../utils/subscription.js';

export const flowCallbackRoutes = async (fastify: FastifyInstance) => {
  const prisma = fastify.prisma;

  // Callback de registro de tarjeta
  fastify.post('/callback/register', async (request, reply) => {
    // Respuesta rápida a Flow
    reply.status(200).send('OK');

    const body = request.body as any;
    if (!body || !body.token) return;

    const { token } = body;

    try {
      const statusData = await getRegisterStatus(token);
      request.log.info({ msg: 'Flow register callback received', status: statusData.status, customerId: statusData.customerId });
      
      // En la API de Flow, status 1 es "Aprobada" (aprobada/registrada)
      if (String(statusData.status) === '1') { 
        const user = await prisma.user.findFirst({
          where: { flowCustomerId: statusData.customerId },
        });

        if (user) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              flowCardType: statusData.creditCardType,
              flowCardLast4: statusData.last4CardDigits,
            },
          });

          // Si había un plan pendiente por suscribir
          if (user.flowPendingPlan) {
            const isAnnual = user.flowPendingPlan === 'ANNUAL';
            const planId = getFlowPlanId('PRO', isAnnual);
            
            // Flow doesn't have trial in standard createSubscription without explicit param, 
            // but we can assume it charges immediately or starts trial.
            // Let's create the subscription
            const sub = await createSubscription(planId, user.flowCustomerId!);
            
            await activateSubscription(fastify, user.id, isAnnual ? 'PREMIUM' : 'PREMIUM', new Date(sub.next_invoice_date), {
              paymentProvider: 'FLOW',
              flowSubscriptionId: sub.subscriptionId,
              flowSubscriptionPlanId: sub.planId,
            });

            await prisma.user.update({
              where: { id: user.id },
              data: { flowPendingPlan: null },
            });
          }

          await publishEvent(user.id, { type: 'MUTATION', entity: 'USER', action: 'UPDATE' });
        }
      }
    } catch (error) {
      request.log.error(error);
    }
  });

  // Callback de pagos recurrentes (Suscripciones)
  fastify.post('/callback/plan', async (request, reply) => {
    // Respuesta rápida a Flow
    reply.status(200).send('OK');

    const body = request.body as any;
    if (!body || !body.token) return;
    
    const { token } = body;

    try {
      const paymentStatus = await getPaymentStatus(token);
      request.log.info({ msg: 'Flow subscription callback received', status: paymentStatus.status, commerceOrder: paymentStatus.commerceOrder });
      
      if (String(paymentStatus.status) === '2') { // 2 = Pagado en la API de Flow
        const existingPayment = await prisma.payment.findUnique({
          where: { orderId: paymentStatus.commerceOrder }
        });
        
        if (existingPayment) {
           await prisma.payment.update({
             where: { id: existingPayment.id },
             data: { status: 'PAID', flowOrder: paymentStatus.flowOrder }
           });
           
           // Update user planExpires
           const user = await prisma.user.findUnique({ where: { id: existingPayment.userId }});
           if (user && user.flowSubscriptionId) {
             const sub = await getSubscription(user.flowSubscriptionId);
             await prisma.user.update({
               where: { id: user.id },
               data: { planExpires: new Date(sub.next_invoice_date) }
             });
             await publishEvent(user.id, { type: 'MUTATION', entity: 'USER', action: 'UPDATE' });
           }
        } else {
           // Es un pago automático de Flow (Renovación). El commerceOrder suele ser {subscriptionId}-{numeroDeCobro}
           const parts = paymentStatus.commerceOrder.split('-');
           if (parts.length >= 2) {
             const subscriptionId = parts.slice(0, parts.length - 1).join('-');
             
             const user = await prisma.user.findFirst({ where: { flowSubscriptionId: subscriptionId }});
             if (user) {
               await prisma.payment.create({
                 data: {
                   userId: user.id,
                   provider: 'FLOW',
                   orderId: paymentStatus.commerceOrder,
                   flowToken: token,
                   flowOrder: paymentStatus.flowOrder,
                   period: 'RENEWAL',
                   currency: 'PEN',
                   amount: paymentStatus.amount,
                   status: 'PAID'
                 }
               });

               const sub = await getSubscription(subscriptionId);
               await prisma.user.update({
                 where: { id: user.id },
                 data: { planExpires: new Date(sub.next_invoice_date) }
               });
               await publishEvent(user.id, { type: 'MUTATION', entity: 'USER', action: 'UPDATE' });
             }
           }
        }
      }
    } catch (error) {
      request.log.error(error);
    }
  });

  // Callback de pagos únicos (Yape, Plin, Tarjeta sin guardar)
  fastify.post('/callback/payment', async (request, reply) => {
    // Flow requiere que respondamos rápido (menos de 15s) con un HTTP 200 OK.
    // Responderemos inmediatamente y procesaremos en segundo plano.
    reply.status(200).send('OK');

    const body = request.body as any;
    if (!body || !body.token) return;

    const { token } = body;

    try {
      const paymentStatus = await getPaymentStatus(token);
      request.log.info({ msg: 'Flow payment callback received', status: paymentStatus.status, commerceOrder: paymentStatus.commerceOrder });
      
      if (paymentStatus.status === 2) { // 2 = Pagado en la API de Flow
        const payment = await prisma.payment.findUnique({
          where: { orderId: paymentStatus.commerceOrder }
        });
        
        if (payment && payment.status !== 'PAID') {
           await prisma.payment.update({
             where: { id: payment.id },
             data: { status: 'PAID', flowOrder: paymentStatus.flowOrder }
           });
           
           const user = await prisma.user.findUnique({ where: { id: payment.userId }});
           
           if (user) {
             // Si el pago es de un add-on (EXTRA_PROFILE o EXTRA_EMAIL)
             if (payment.period === 'EXTRA_PROFILE' || payment.period === 'EXTRA_EMAIL') {
               await handleAddonPurchase(fastify, user.id, payment.period);
               await publishEvent(user.id, { type: 'MUTATION', entity: 'USER', action: 'UPDATE' });
             } 
             // Si es la compra del plan principal
             else if (payment.period === 'MONTHLY' || payment.period === 'ANNUAL') {
                const isAnnual = payment.period === 'ANNUAL';
                
                // Aquí no hay suscripción recurrente en Flow, activamos manualmente el plan
                const expirationDate = new Date();
                if (isAnnual) {
                  expirationDate.setFullYear(expirationDate.getFullYear() + 1);
                } else {
                  expirationDate.setMonth(expirationDate.getMonth() + 1);
                }

                await activateSubscription(fastify, user.id, 'PREMIUM', expirationDate, {
                  paymentProvider: 'FLOW',
                  flowPendingPlan: null
                });

                await publishEvent(user.id, { type: 'MUTATION', entity: 'USER', action: 'UPDATE' });
             }
            }
         }
      }
    } catch (error) {
      request.log.error(error);
    }
  });

  // URL de retorno visual
  fastify.all('/return/register', async (request, reply) => {
    const body = request.body as any;
    const query = request.query as any;
    const token = body?.token || query?.token;
    
    if (token) {
      try {
        const statusData = await getRegisterStatus(token);
        if (String(statusData.status) === '1') {
          return reply.redirect(`${config.frontendUrl}/es/flow/return?token=${token}&type=register&success=true`);
        } else {
          return reply.redirect(`${config.frontendUrl}/es/flow/return?token=${token}&type=register&success=false`);
        }
      } catch (e) {
        request.log.error(e);
      }
    }
    
    // Redirigir al frontend para que procese el resultado
    return reply.redirect(`${config.frontendUrl}/es/flow/return?token=${token || ''}&type=register&success=false`);
  });

  // URL de retorno visual para pagos únicos (Yape/Plin)
  fastify.all('/return/payment', async (request, reply) => {
    const body = request.body as any;
    const query = request.query as any;
    const token = body?.token || query?.token;
    
    if (token) {
      try {
        const statusData = await getPaymentStatus(token);
        if (statusData.status === 2) {
          return reply.redirect(`${config.frontendUrl}/es/flow/return?token=${token}&type=payment&success=true`);
        } else if (statusData.status === 1) {
          return reply.redirect(`${config.frontendUrl}/es/flow/return?token=${token}&type=payment&success=pending`);
        } else {
          return reply.redirect(`${config.frontendUrl}/es/flow/return?token=${token}&type=payment&success=false`);
        }
      } catch (e) {
        request.log.error(e);
      }
    }
    
    // Redirigir al frontend para que procese el resultado
    return reply.redirect(`${config.frontendUrl}/es/flow/return?token=${token || ''}&type=payment&success=false`);
  });
};
