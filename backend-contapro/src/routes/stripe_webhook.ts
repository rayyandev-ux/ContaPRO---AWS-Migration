import type { FastifyPluginAsync } from 'fastify';
import Stripe from 'stripe';
import { config } from '../config.js';
import { stripe } from '../services/stripe.js';
import { TikTokService } from '../services/tiktok.js';
import { sendPurchaseReceiptEmail } from '../services/email.js';

export const stripeWebhookRoutes: FastifyPluginAsync = async (app) => {
  app.post('/webhook', { config: { rawBody: true } }, async (req, res) => {
    const sig = req.headers['stripe-signature'] as string;
    const rawBody = (req as any).rawBody;

    if (!rawBody || !sig) {
       app.log.warn('Webhook missing signature or body');
       return res.badRequest('Missing signature or body');
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        sig,
        config.stripeWebhookSecret
      );
      app.log.info({ type: event.type, id: event.id }, 'Stripe Webhook Event Received');
    } catch (err: any) {
      app.log.warn(`Webhook signature verification failed: ${err.message}`);
      return res.code(400).send(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.metadata?.orderId) {
          await app.prisma.payment.updateMany({
            where: { stripeSessionId: session.id },
            data: { 
              status: 'PAID', 
              stripePaymentIntentId: session.payment_intent as string 
            },
          });
          
          const userId = session.metadata.userId;
          const plan = session.metadata.plan as 'MONTHLY' | 'ANNUAL' | 'LIFETIME' | 'QUARTERLY' | 'EXTRA_PROFILE' | 'EXTRA_EMAIL';
          
          if (userId && plan) {
             let expires: Date | null = null;

             if (plan === 'EXTRA_PROFILE' && session.mode === 'payment') {
                  app.log.info({ userId, plan, mode: session.mode }, 'Processing EXTRA_PROFILE purchase (Lifetime/OneTime)');
                  await app.prisma.user.update({
                      where: { id: userId },
                      data: { extraProfileSlots: { increment: 1 } }
                  });
                  app.log.info({ userId }, 'Incremented extraProfileSlots (Lifetime/OneTime)');
                  
                  // Notificar al frontend
                  try {
                      const { publishEvent } = await import('../services/realtime.js');
                      await publishEvent(userId, { type: 'subscription:updated' });
                  } catch (e) {
                      app.log.error(e, 'Error publishing realtime event');
                  }
              } else if (plan === 'EXTRA_EMAIL' || (plan === 'EXTRA_PROFILE' && session.mode === 'subscription')) {
                 app.log.info({ userId, plan, mode: session.mode }, 'Processing Resource Subscription purchase - copying metadata');
                 if (session.subscription) {
                    await stripe.subscriptions.update(session.subscription as string, {
                        metadata: { userId, plan }
                    });
                    app.log.info({ userId, plan, subscriptionId: session.subscription }, 'Copied resource metadata to new subscription from checkout session');
                 }
             } else {
                const isTrial = session.metadata?.trial === 'true';

                // 1. If session.subscription exists, retrieve the subscription
                if (session.subscription) {
                    try {
                        const sub = await stripe.subscriptions.retrieve(session.subscription as string) as any;
                        if (sub.status === 'trialing' && sub.trial_end) {
                            expires = new Date(sub.trial_end * 1000);
                        } else {
                            const currentPeriodEndTimestamp = sub.current_period_end || sub.items?.data?.[0]?.current_period_end;
                            if (currentPeriodEndTimestamp) {
                                expires = new Date(currentPeriodEndTimestamp * 1000);
                            }
                        }
                    } catch (error) {
                        app.log.error(error, 'Error retrieving subscription in webhook');
                    }
                }

                // 3. Fallback logic
                if (!expires) {
                    if (isTrial) {
                        expires = new Date();
                        expires.setDate(expires.getDate() + 7);
                    } else if (plan === 'MONTHLY') {
                      expires = new Date();
                      expires.setMonth(expires.getMonth() + 1);
                    } else if (plan === 'QUARTERLY') {
                      expires = new Date();
                      expires.setMonth(expires.getMonth() + 3);
                    } else if (plan === 'ANNUAL') {
                      expires = new Date();
                      expires.setFullYear(expires.getFullYear() + 1);
                    } else if (plan === 'LIFETIME') {
                      expires = null;
                    }
                }

                if (expires && isNaN(expires.getTime())) {
                    app.log.error({ expires }, 'Invalid expiration date calculated in webhook');
                    expires = new Date();
                    if (isTrial) {
                        expires.setDate(expires.getDate() + 7);
                    } else {
                        expires.setMonth(expires.getMonth() + 1);
                    }
                }

                await app.prisma.user.update({
                  where: { id: userId },
                  data: {
                    plan: plan === 'LIFETIME' ? 'LIFETIME' : 'PREMIUM',
                    planExpires: expires,
                    stripeSubscriptionId: session.subscription as string,
                    hasUsedTrial: true,
                    paymentProvider: 'STRIPE',
                  }
                });

                // Copiar metadatos a la suscripción para que invoice.payment_succeeded pueda leerlos
                if (session.subscription) {
                    await stripe.subscriptions.update(session.subscription as string, {
                        metadata: { userId, plan }
                    });
                    app.log.info({ userId, plan, subscriptionId: session.subscription }, 'Copied metadata to new subscription from checkout session');
                }
             }

             // --- Common Logic for all purchase types ---
             const user = await app.prisma.user.findUnique({ where: { id: userId } });
             if (user) {
                 // 1. TikTok Event
                 TikTokService.sendEvent({
                     eventName: 'Purchase',
                     user: {
                         email: user.email,
                         phone: user.phoneNumber || user.whatsappPhone || undefined,
                     },
                     properties: {
                         value: (session.amount_total || 0) / 100,
                         currency: (session.currency || 'usd').toUpperCase(),
                         content_type: 'product',
                         content_name: plan
                     }
                 });

                 // 2. Purchase Confirmation Email
                 try {
                    await sendPurchaseReceiptEmail(app, user.email, {
                        orderId: session.metadata.orderId,
                        period: plan,
                        amount: (session.amount_total || 0) / 100,
                        currency: (session.currency || 'usd').toUpperCase(),
                        expires: expires || undefined
                    });
                 } catch (emailErr) {
                    app.log.error(emailErr, 'Error sending purchase receipt email');
                 }
             }
          }
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as any;
        const plan = sub.metadata?.plan;
        const customerId = sub.customer as string;

        const user = await app.prisma.user.findFirst({ where: { stripeCustomerId: customerId } });
        if (user) {
            if (plan === 'EXTRA_PROFILE') {
                  const updatedUser = await app.prisma.user.update({
                      where: { id: user.id },
                      data: { extraProfileSlots: { decrement: 1 } }
                  });
                  if (updatedUser.extraProfileSlots < 0) {
                      await app.prisma.user.update({ where: { id: user.id }, data: { extraProfileSlots: 0 } });
                  }
                  app.log.info({ userId: user.id }, 'Decremented extraProfileSlots via subscription deleted');
              } else if (plan === 'EXTRA_EMAIL') {
                  const updatedUser = await app.prisma.user.update({
                      where: { id: user.id },
                      data: { extraEmailSlots: { decrement: 1 } }
                  });
                  if (updatedUser.extraEmailSlots < 0) {
                      await app.prisma.user.update({ where: { id: user.id }, data: { extraEmailSlots: 0 } });
                  }
                  app.log.info({ userId: user.id }, 'Decremented extraEmailSlots via subscription deleted');
                 
                 // Desvincular correos que excedan el nuevo límite
                 const allowedEmails = 1 + Math.max(0, updatedUser.extraEmailSlots || 0);
                 const activeIntegrations = await app.prisma.emailIntegration.findMany({
                     where: { userId: user.id, isActive: true },
                     orderBy: { createdAt: 'asc' }
                 });
                 
                 if (activeIntegrations.length > allowedEmails) {
                     const toDeactivate = activeIntegrations.slice(allowedEmails);
                     await app.prisma.emailIntegration.updateMany({
                         where: { id: { in: toDeactivate.map(i => i.id) } },
                         data: { isActive: false }
                     });
                     app.log.info({ userId: user.id, deactivatedCount: toDeactivate.length }, 'Deactivated email integrations due to slot decrement');
                 }
             } else if (sub.id === user.stripeSubscriptionId) {
                // Main subscription ended
                await app.prisma.user.update({
                    where: { id: user.id },
                    data: {
                        plan: 'FREE',
                        stripeSubscriptionId: null
                    }
                });
                app.log.info({ userId: user.id }, 'Main subscription deleted, fallback to FREE');
            }

            try {
                const { publishEvent } = await import('../services/realtime.js');
                await publishEvent(user.id, { type: 'subscription:deleted' });
            } catch (e) {
                app.log.error(e, 'Error publishing realtime event');
            }
        }
        break;
      }
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as any;
        const subscriptionId = (invoice.subscription as string) || (invoice.subscription_details?.subscription as string) || (invoice.parent?.subscription_details?.subscription as string);
        const customerId = invoice.customer as string;

        if (subscriptionId || customerId) {
          // Intentar buscar por suscripción, si no por cliente (más fiable para nuevas suscripciones)
          const user = await app.prisma.user.findFirst({ 
            where: { 
                OR: [
                    { stripeSubscriptionId: subscriptionId },
                    { stripeCustomerId: customerId }
                ]
            } 
          });

          if (user) {
             try {
                let sub: any = null;
                let newExpires: Date | null = null;
                let planFromMeta: string | null = null;

                if (subscriptionId) {
                    sub = await stripe.subscriptions.retrieve(subscriptionId);
                    const currentPeriodEndTimestamp = sub.current_period_end || sub.items?.data?.[0]?.current_period_end;
                    newExpires = currentPeriodEndTimestamp ? new Date(currentPeriodEndTimestamp * 1000) : null;
                    planFromMeta = sub.metadata.plan;
                    app.log.info({ userId: user.id, subscriptionId, planFromMeta, metadata: sub.metadata, billingReason: invoice.billing_reason }, 'Processing invoice.payment_succeeded details');
                }
                
                // 1. Actualizar plan si no es vitalicio y la suscripción es la principal
                const isMainSubscription = subscriptionId && (!user.stripeSubscriptionId || user.stripeSubscriptionId === subscriptionId);

                if (user.plan !== 'LIFETIME' && isMainSubscription && planFromMeta && !['EXTRA_PROFILE', 'EXTRA_EMAIL'].includes(planFromMeta)) {
                    await app.prisma.user.update({
                      where: { id: user.id },
                      data: { 
                        planExpires: newExpires, 
                        plan: 'PREMIUM',
                        stripeSubscriptionId: subscriptionId, // Asegurar que guardamos el ID
                        paymentProvider: 'STRIPE'
                      }
                    });
                }

                // 2. Incrementar slots si es una suscripción de recurso nueva o ciclo inicial
                const isResourceSubscription = ['EXTRA_PROFILE', 'EXTRA_EMAIL'].includes(planFromMeta as string);
                const isNewSubscription = invoice.billing_reason === 'subscription_create' || invoice.billing_reason === 'manual' || (invoice.billing_reason === 'subscription_update' && invoice.total > 0);

                if (isResourceSubscription && (isNewSubscription || invoice.billing_reason === 'subscription_cycle')) {
                    if (invoice.billing_reason === 'subscription_create' || invoice.billing_reason === 'manual' || invoice.billing_reason === 'subscription_update') {
                        if (planFromMeta === 'EXTRA_PROFILE') {
                            await app.prisma.user.update({
                                where: { id: user.id },
                                data: { extraProfileSlots: { increment: 1 } }
                            });
                            app.log.info({ userId: user.id }, 'Incremented extraProfileSlots via invoice');
                        } else if (planFromMeta === 'EXTRA_EMAIL') {
                            await app.prisma.user.update({
                                where: { id: user.id },
                                data: { extraEmailSlots: { increment: 1 } }
                            });
                            app.log.info({ userId: user.id }, 'Incremented extraEmailSlots via invoice');
                        }
                        
                        try {
                            const { publishEvent } = await import('../services/realtime.js');
                            await publishEvent(user.id, { type: 'subscription:updated' });
                        } catch (e) {
                            app.log.error(e, 'Error publishing realtime event');
                        }
                    }
                }

                // 3. Enviar correo de confirmación (Recibo)
                // Enviamos para creación, ciclo normal o si es un pago manual de factura abierta
                const validReasons = ['subscription_create', 'subscription_cycle', 'manual', 'subscription_update'];
                if (validReasons.includes(invoice.billing_reason) && invoice.total > 0) {
                    await sendPurchaseReceiptEmail(app, user.email, {
                        orderId: invoice.number || invoice.id,
                        period: planFromMeta || (subscriptionId === user.stripeSubscriptionId ? user.plan : 'RECURSO'),
                        amount: invoice.total / 100,
                        currency: invoice.currency.toUpperCase(),
                        expires: newExpires || undefined
                    });
                }
             } catch (err) {
                app.log.error(err, 'Error handling invoice.payment_succeeded');
             }
          }
        }
        break;
      }
    }

    res.send({ received: true });
  });
};
