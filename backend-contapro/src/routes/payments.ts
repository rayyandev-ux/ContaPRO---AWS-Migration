import type { FastifyPluginAsync } from 'fastify';
import Stripe from 'stripe';
import { config } from '../config.js';
import { stripe, getStripePriceId, getExtraProfilePriceId, getExtraEmailPriceId } from '../services/stripe.js';
import { requireAuth } from '../utils/auth.js';
import { v4 as uuidv4 } from 'uuid';
import { TikTokService } from '../services/tiktok.js';
import { publishEvent } from '../services/realtime.js';
import { sendPurchaseReceiptEmail } from '../services/email.js';

export const paymentsRoutes: FastifyPluginAsync = async (app) => {
  app.post('/portal', { schema: { summary: 'Create Stripe customer portal session' } }, async (req, res) => {
    const auth = requireAuth(app, req, res);
    if (!auth) return;
    const { userId } = auth;

    const user = await app.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.badRequest('Usuario no encontrado');
    }
    
    // Si el usuario no tiene Stripe Customer, crearlo ahora para que pueda gestionar futuros pagos
    if (!user.stripeCustomerId) {
      try {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.name || undefined,
          metadata: { userId: user.id },
        });
        await app.prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customer.id } });
        user.stripeCustomerId = customer.id;
      } catch (e) {
        app.log.error(e, 'Error creating stripe customer for portal');
        return res.internalServerError('Error preparando cuenta de facturación');
      }
    }

    try {
      let session;
      try {
        session = await stripe.billingPortal.sessions.create({
          customer: user.stripeCustomerId!,
          return_url: `${config.frontendUrl}/billing`,
        });
      } catch (e: any) {
        if (e?.code === 'resource_missing' && e?.param === 'customer') {
            app.log.warn({ userId, invalidCustomerId: user.stripeCustomerId }, 'Invalid Stripe Customer ID found in portal, recreating...');
            const customer = await stripe.customers.create({
              email: user.email,
              name: user.name || undefined,
              metadata: { userId: user.id },
            });
            await app.prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customer.id } });
            session = await stripe.billingPortal.sessions.create({
              customer: customer.id,
              return_url: `${config.frontendUrl}/billing`,
            });
        } else {
            throw e;
        }
      }

      return res.send({ url: session.url });
    } catch (e: any) {
      app.log.error(e, 'Error creating portal session');
      return res.internalServerError('Error abriendo portal de facturación');
    }
  });

  app.post('/checkout', { 
    schema: { 
      summary: 'Create Stripe checkout session',
      body: {
        type: 'object',
        properties: {
          plan: { type: 'string', enum: ['MONTHLY', 'ANNUAL', 'LIFETIME', 'QUARTERLY', 'EXTRA_PROFILE', 'EXTRA_EMAIL'] },
          trial: { type: 'boolean' }
        }
      }
    } 
  }, async (req, res) => {
    const auth = requireAuth(app, req, res);
    if (!auth) return;
    const { userId } = auth;
    const body: any = req.body || {};
    const plan: 'MONTHLY' | 'ANNUAL' | 'LIFETIME' | 'QUARTERLY' | 'EXTRA_PROFILE' | 'EXTRA_EMAIL' = body.plan || 'MONTHLY';
    // Robust boolean check: true, "true", 1, "1"
    const isTrial = String(body.trial) === 'true' || body.trial === true || body.trial === 1;
    
    app.log.info({ plan, body, isTrial }, 'Checkout initiated');

    // Validar plan
    if (!['MONTHLY', 'ANNUAL', 'LIFETIME', 'QUARTERLY', 'EXTRA_PROFILE', 'EXTRA_EMAIL'].includes(plan)) {
      return res.badRequest(`Plan inválido: ${plan}`);
    }

    const user = await app.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.unauthorized('No autenticado');

    // Validaciones para Trial
    if (isTrial) {
        if (plan !== 'MONTHLY') {
            return res.badRequest('El periodo de prueba solo está disponible para el plan mensual.');
        }
        if (user.hasUsedTrial) {
            return res.badRequest('Ya has utilizado tu periodo de prueba anteriormente.');
        }
    }

    // Si ya tiene suscripción y trata de comprar otra (no EXTRA_PROFILE), enviarlo al portal
    if (user.stripeSubscriptionId && ['MONTHLY', 'ANNUAL', 'QUARTERLY'].includes(plan)) {
      // Verificar si la suscripción sigue activa en Stripe
      try {
        const sub = (await stripe.subscriptions.retrieve(user.stripeSubscriptionId)) as Stripe.Subscription;
        if (sub.status === 'active' || sub.status === 'trialing') {
           app.log.info({ userId, plan }, 'User has active subscription, redirecting to portal');
           const portalSession = await stripe.billingPortal.sessions.create({
             customer: user.stripeCustomerId!,
             return_url: `${config.frontendUrl}/pricing`,
           });
           return res.send({ url: portalSession.url });
        }
      } catch (e) {
        // Si falla (ej. suscripción no existe), dejar continuar
        app.log.warn({ userId, err: e }, 'Error checking existing subscription, proceeding with checkout');
      }
    }

    // Obtener Price ID
    let priceId = '';
    let amount = 0; // Solo referencial para la DB
    let mode: Stripe.Checkout.SessionCreateParams.Mode = 'subscription';

    if (plan === 'EXTRA_EMAIL') {
        let interval: 'month' | 'year' = 'month';
        
        if (user.stripeSubscriptionId) {
            try {
                const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
                if (sub.items && sub.items.data.length > 0) {
                    const price = sub.items.data[0].price;
                    if (price.recurring?.interval === 'year') interval = 'year';
                }
            } catch (e) {
                 app.log.warn(e, 'Could not retrieve subscription details for extra email pricing');
            }
        }
        
        priceId = getExtraEmailPriceId(interval);
        mode = 'subscription';
        if (interval === 'month') amount = 5;
        else if (interval === 'year') amount = 40;
    } else if (plan === 'EXTRA_PROFILE') {
        let interval: 'month' | 'year' = 'month';
        
        if (user.stripeSubscriptionId) {
            try {
                const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
                if (sub.items && sub.items.data.length > 0) {
                    const price = sub.items.data[0].price;
                    if (price.recurring?.interval === 'year') interval = 'year';
                    // Even if quarter or lifetime, we default to month as requested
                }
            } catch (e) {
                 app.log.warn(e, 'Could not retrieve subscription details for extra profile pricing');
            }
        }
        
        priceId = getExtraProfilePriceId(interval);
        mode = 'subscription';
        if (interval === 'month') amount = 5;
        else if (interval === 'year') amount = 40;
    } else {
        priceId = getStripePriceId(plan);
        if (plan === 'LIFETIME') {
            mode = 'payment';
            amount = 100;
        }
        
        // Si hay configuración en DB, usarla (opcional, si queremos override)
        try {
            const ps = await app.prisma.planSetting.findUnique({ where: { period: plan } });
            if (ps && ps.active !== false) {
                if (ps.stripePriceId) priceId = ps.stripePriceId;
                amount = ps.priceUsd;
            }
        } catch {}
    }

    if (!priceId) {
      app.log.error({ plan, userPlan: user.plan, subId: user.stripeSubscriptionId }, 'Configuración de precios incompleta (priceId empty)');
      return res.internalServerError('Configuración de precios incompleta');
    }

    // TikTok Event: InitiateCheckout
    TikTokService.sendEvent({
      eventName: 'InitiateCheckout',
      user: {
        email: user.email,
        phone: user.phoneNumber || user.whatsappPhone || undefined,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      },
      properties: {
        content_name: plan,
        content_type: 'product',
        value: amount,
        currency: 'USD'
      }
    });

    // Crear o recuperar Stripe Customer
    let customerId = user.stripeCustomerId;

    const ensureCustomer = async () => {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name || undefined,
        metadata: { userId: user.id },
      });
      await app.prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customer.id } });
      return customer.id;
    };

    if (!customerId) {
      customerId = await ensureCustomer();
    }

    const orderId = `cp${Math.random().toString(36).slice(2,10)}${Date.now().toString(36).slice(-4)}`;
    
    const createSession = async (custId: string) => {
      const sessionConfig: Stripe.Checkout.SessionCreateParams = {
        customer: custId,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: mode,
        success_url: plan === 'EXTRA_PROFILE' || plan === 'EXTRA_EMAIL'
            ? `${config.frontendUrl}/dashboard?action=${plan.toLowerCase()}_purchased`
            : `${config.frontendUrl}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: plan === 'EXTRA_PROFILE' || plan === 'EXTRA_EMAIL'
            ? `${config.frontendUrl}/dashboard`
            : `${config.frontendUrl}/pricing`,
        metadata: {
          userId,
          plan,
          orderId,
          ...(isTrial ? { trial: 'true' } : {}),
        },
        // Para suscripciones, permitir gestión en portal
        allow_promotion_codes: true,
        
        // Trial Configuration & Subscription Metadata
        subscription_data: mode === 'subscription' ? {
            ...(isTrial ? { trial_period_days: 7 } : {}),
            metadata: {
              userId,
              plan,
              orderId,
            }
        } : undefined,
        payment_method_collection: isTrial ? 'always' : undefined,
      };

      return await stripe.checkout.sessions.create(sessionConfig);
    };

    try {
      let sessionResult;
      try {
        sessionResult = await createSession(customerId);
      } catch (e: any) {
        // Auto-heal: If customer doesn't exist (e.g. environment mismatch), clear and recreate
        if (e?.code === 'resource_missing' && e?.param === 'customer' || (e?.message && e.message.includes('No such customer'))) {
            app.log.warn({ userId, invalidCustomerId: customerId }, 'Invalid Stripe Customer ID found, recreating...');
            const newCustId = await ensureCustomer();
            sessionResult = await createSession(newCustId);
        } else {
            throw e;
        }
      }
      
      app.log.info({ sessionId: sessionResult.id }, 'Stripe Session Created');

      await app.prisma.payment.create({
        data: {
          userId,
          provider: 'STRIPE',
          orderId,
          stripeSessionId: sessionResult.id,
          period: plan,
          currency: 'USD',
          amount: amount,
          status: 'PENDING',
        },
      });

      return res.send({ url: sessionResult.url });
    } catch (e: any) {
      app.log.error(e, 'Error creating checkout session');
      return res.internalServerError(`Error al iniciar pago: ${e.message || 'Error desconocido'}`);
    }
  });

  // NOTA: Esta ruta debe llamarse con /api/payments/stripe/webhook si se registra bajo ese prefijo.
  // Sin embargo, para mantener consistencia con la documentación externa, a veces es mejor
  // registrarla fuera o ajustarla. En este caso, al estar dentro de paymentsRoutes con prefix '/api/payments',
  // la URL final es /api/payments/stripe/webhook.
  // SI SE REQUIERE QUE SEA /api/stripe/webhook, habría que moverla a otro plugin o cambiar el registro.
  //
  // Para corregirlo según lo hablado (URL: /api/stripe/webhook), esta ruta NO debería estar aquí dentro de
  // un plugin prefijado con /api/payments.
  //
  // Moveremos la lógica del webhook a un archivo separado o la registraremos en root si es necesario,
  // pero dado el pedido "verifica y corrige todo", vamos a asumir que la URL deseada es la que el usuario mencionó.
  //
  // Solución rápida: Dejarla aquí pero siendo consciente del prefijo, O moverla.
  // Vamos a moverla a un nuevo archivo src/routes/stripe_webhook.ts y registrarla en index.ts
  // para tener control total de la URL.

  app.get('/history', { schema: { summary: 'Get payment history' } }, async (req, res) => {
    const auth = requireAuth(app, req, res);
    if (!auth) return;
    const { userId } = auth;

    const items = await app.prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, period: true, status: true, amount: true, currency: true }
    });

    return res.send({ ok: true, items });
  });

  // ========================
  // In-App Subscription Management
  // ========================

  app.get('/payment-methods', { schema: { summary: 'List saved payment methods' } }, async (req, res) => {
    const auth = requireAuth(app, req, res);
    if (!auth) return;
    const { userId } = auth;

    const user = await app.prisma.user.findUnique({ 
        where: { id: userId }, 
        select: { stripeCustomerId: true } 
    });

    let items: any[] = [];

    if (!user?.stripeCustomerId) return res.send({ ok: true, items: [] });

    try {
      const customer = await stripe.customers.retrieve(user.stripeCustomerId) as Stripe.Customer;
      const methods = await stripe.paymentMethods.list({
        customer: user.stripeCustomerId,
        type: 'card',
      });

      const items = methods.data.map(m => ({
        id: m.id,
        brand: m.card?.brand,
        last4: m.card?.last4,
        expMonth: m.card?.exp_month,
        expYear: m.card?.exp_year,
        isDefault: customer.invoice_settings?.default_payment_method === m.id
      }));

      return res.send({ ok: true, items });
    } catch (e: any) {
      app.log.error(e, 'Error listing payment methods');
      return res.internalServerError('Error al obtener métodos de pago');
    }
  });

  app.post('/payment-methods/:id/detach', { schema: { summary: 'Remove a payment method' } }, async (req, res) => {
    const auth = requireAuth(app, req, res);
    if (!auth) return;
    const { userId } = auth;
    const { id } = req.params as { id: string };

    const user = await app.prisma.user.findUnique({ where: { id: userId }, select: { stripeCustomerId: true } });
    if (!user?.stripeCustomerId) return res.badRequest('No tienes cuenta de facturación');

    try {
      // Verificar que el método pertenece al cliente
      const method = await stripe.paymentMethods.retrieve(id);
      if (method.customer !== user.stripeCustomerId) {
          return res.unauthorized('No tienes permiso para eliminar este método');
      }

      await stripe.paymentMethods.detach(id);
      
      // Notificar al frontend para recarga inmediata
      await publishEvent(userId, { type: 'payment_method:detached', id });
      
      return res.send({ ok: true });
    } catch (e: any) {
      app.log.error(e, 'Error detaching payment method');
      return res.internalServerError('Error al eliminar método de pago');
    }
  });

  app.post('/payment-methods/:id/default', { schema: { summary: 'Set default payment method' } }, async (req, res) => {
    const auth = requireAuth(app, req, res);
    if (!auth) return;
    const { userId } = auth;
    const { id } = req.params as { id: string };

    const user = await app.prisma.user.findUnique({ where: { id: userId }, select: { stripeCustomerId: true } });
    if (!user?.stripeCustomerId) return res.badRequest('No tienes cuenta de facturación');

    try {
      await stripe.customers.update(user.stripeCustomerId, {
        invoice_settings: { default_payment_method: id }
      });

      // Notificar al frontend para recarga inmediata
      await publishEvent(userId, { type: 'payment_method:default_updated', id });

      return res.send({ ok: true });
    } catch (e: any) {
      app.log.error(e, 'Error setting default payment method');
      return res.internalServerError('Error al establecer método predeterminado');
    }
  });

  app.get('/subscription', { schema: { summary: 'Get current subscription details' } }, async (req, res) => {
    const auth = requireAuth(app, req, res);
    if (!auth) return;
    const { userId } = auth;

    const user = await app.prisma.user.findUnique({ 
        where: { id: userId }, 
        select: { stripeSubscriptionId: true, plan: true, planExpires: true, stripeCustomerId: true } 
    });

    let mainSub = null;
    let extraSubs: any[] = [];

    if (user?.stripeCustomerId) {
        try {
            const allSubs = await stripe.subscriptions.list({
                customer: user.stripeCustomerId,
                status: 'all',
            });
            
            for (const s of allSubs.data) {
                const sub = s as any;
                const isMain = sub.id === user.stripeSubscriptionId;
                const currentPeriodEndTimestamp = sub.current_period_end || sub.items?.data?.[0]?.current_period_end;
                const formattedSub = {
                    id: sub.id,
                    status: sub.status,
                    currentPeriodEnd: currentPeriodEndTimestamp ? new Date(currentPeriodEndTimestamp * 1000).toISOString() : null,
                    cancelAtPeriodEnd: sub.cancel_at_period_end,
                    interval: sub.items.data[0]?.price.recurring?.interval,
                    amount: sub.items.data[0]?.price.unit_amount ? sub.items.data[0].price.unit_amount / 100 : 0,
                    currency: sub.currency.toUpperCase(),
                    plan: sub.metadata?.plan || (isMain ? user.plan : 'UNKNOWN')
                };

                if (isMain) {
                    mainSub = formattedSub;
                } else if (['EXTRA_PROFILE', 'EXTRA_EMAIL'].includes(formattedSub.plan)) {
                    extraSubs.push(formattedSub);
                }
            }
        } catch (e: any) {
            app.log.error(e, 'Error retrieving all subscriptions');
        }
    }

    return res.send({ 
      ok: true, 
      subscription: mainSub, 
      plan: user?.plan,
      extraSubscriptions: extraSubs 
    });
  });

  app.post('/subscription/:id/cancel', { schema: { summary: 'Cancel any subscription at period end' } }, async (req, res) => {
    const auth = requireAuth(app, req, res);
    if (!auth) return;
    const { userId } = auth;
    const { id } = req.params as { id: string };

    const user = await app.prisma.user.findUnique({ where: { id: userId }, select: { stripeCustomerId: true } });
    if (!user?.stripeCustomerId) return res.badRequest('No tienes una cuenta de facturación');

    try {
      const sub = await stripe.subscriptions.retrieve(id);
      if (sub.customer !== user.stripeCustomerId) {
          return res.unauthorized('No tienes permiso para cancelar esta suscripción');
      }

      await stripe.subscriptions.update(id, {
        cancel_at_period_end: true
      });

      // Only decrement if we were previously using this slot and we're cancelling it at period end.
      // Wait, `cancel_at_period_end` does NOT immediately stop the service.
      // We shouldn't decrement slots when they JUST click cancel.
      // We should ONLY decrement them when the webhook `customer.subscription.deleted` fires!
      
      await publishEvent(userId, { type: 'subscription:updated' });

      return res.send({ ok: true });
    } catch (e: any) {
      app.log.error(e, 'Error canceling subscription');
      return res.internalServerError('Error al cancelar la suscripción');
    }
  });

  app.post('/subscription/:id/resume', { schema: { summary: 'Resume any canceled subscription' } }, async (req, res) => {
    const auth = requireAuth(app, req, res);
    if (!auth) return;
    const { userId } = auth;
    const { id } = req.params as { id: string };

    const user = await app.prisma.user.findUnique({ where: { id: userId }, select: { stripeCustomerId: true, email: true } });
    if (!user?.stripeCustomerId || !user?.email) return res.badRequest('No tienes una cuenta de facturación');

    try {
      const sub = await stripe.subscriptions.retrieve(id);
      if (sub.customer !== user.stripeCustomerId) {
          return res.unauthorized('No tienes permiso para reactivar esta suscripción');
      }

      const updatedSub: any = await stripe.subscriptions.update(id, {
        cancel_at_period_end: false
      });

      // Update the database to match the reactivated subscription's end date
      const planFromMeta = updatedSub.metadata?.plan;
      const currentPeriodEndTimestamp = updatedSub.current_period_end || updatedSub.items?.data?.[0]?.current_period_end;

      if (planFromMeta === 'EXTRA_PROFILE' || planFromMeta === 'EXTRA_EMAIL') {
          // Reactivating an extra resource subscription.
          // Wait, if it was just canceled (cancel_at_period_end = true) but NOT deleted, 
          // the slot was NEVER decremented (because decrement only happens on `customer.subscription.deleted`).
          // So we do NOT need to increment it again.
          app.log.info({ userId, plan: planFromMeta }, 'Reactivated extra resource subscription (pending slots check)');
      } else {
          // If it's the main plan
          await app.prisma.user.update({
              where: { id: userId },
              data: { planExpires: currentPeriodEndTimestamp ? new Date(currentPeriodEndTimestamp * 1000) : null }
          });
      }

      await publishEvent(userId, { type: 'subscription:updated' });

      await sendPurchaseReceiptEmail(app, user.email, {
        orderId: updatedSub.id,
        period: 'REACTIVATION',
        amount: 0,
        currency: (updatedSub.currency || 'PEN').toUpperCase(),
        expires: currentPeriodEndTimestamp ? new Date(currentPeriodEndTimestamp * 1000) : new Date()
      });

      return res.send({ ok: true });
    } catch (e: any) {
      app.log.error(e, 'Error resuming subscription');
      return res.internalServerError('Error al reactivar la suscripción');
    }
  });

  app.get('/invoices', { schema: { summary: 'List Stripe invoices' } }, async (req, res) => {
    const auth = requireAuth(app, req, res);
    if (!auth) return;
    const { userId } = auth;

    const user = await app.prisma.user.findUnique({ where: { id: userId }, select: { stripeCustomerId: true } });
    
    let items: any[] = [];

    try {
      if (user?.stripeCustomerId) {
        const invoices = await stripe.invoices.list({
          customer: user.stripeCustomerId,
          limit: 12
        });

        items = invoices.data.map(inv => ({
          id: inv.id,
          number: inv.number,
          amount: inv.total / 100,
          currency: inv.currency.toUpperCase(),
          status: inv.status,
          date: new Date(inv.created * 1000),
          pdf: inv.invoice_pdf
        }));
      }

      return res.send({ ok: true, items });
    } catch (e: any) {
      app.log.error(e, 'Error listing invoices');
      return res.internalServerError('Error al obtener facturas');
    }
  });

  app.post('/setup-intent', { schema: { summary: 'Create a setup intent for adding cards' } }, async (req, res) => {
    const auth = requireAuth(app, req, res);
    if (!auth) return;
    const { userId } = auth;

    const user = await app.prisma.user.findUnique({ where: { id: userId }, select: { stripeCustomerId: true, email: true, name: true } });
    if (!user) return res.unauthorized();

    let customerId = user.stripeCustomerId;
    if (!customerId) {
        const customer = await stripe.customers.create({
            email: user.email,
            name: user.name || undefined,
            metadata: { userId }
        });
        await app.prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customer.id } });
        customerId = customer.id;
    }

    try {
      let setupIntent;
      try {
        setupIntent = await stripe.setupIntents.create({
          customer: customerId,
          payment_method_types: ['card'],
        });
      } catch (innerErr: any) {
        if (innerErr.code === 'resource_missing' && innerErr.param === 'customer') {
          // El customer guardado no existe en Stripe (ej. cambio de test a prod mode)
          app.log.warn({ userId, customerId }, 'Customer no existe en Stripe, recreando...');
          const newCustomer = await stripe.customers.create({
              email: user.email,
              name: user.name || undefined,
              metadata: { userId }
          });
          await app.prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: newCustomer.id } });
          customerId = newCustomer.id;
          
          setupIntent = await stripe.setupIntents.create({
            customer: customerId,
            payment_method_types: ['card'],
          });
        } else {
          throw innerErr;
        }
      }

      return res.send({ ok: true, clientSecret: setupIntent.client_secret });
    } catch (e: any) {
      app.log.error(e, 'Error creating setup intent');
      return res.internalServerError('Error preparando adición de tarjeta');
    }
  });

  app.post('/buy-extra', { 
    schema: { 
      summary: 'Buy extra slots or plan using saved payment method',
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
    const auth = requireAuth(app, req, res);
    if (!auth) return;
    const { userId } = auth;
    const { type, plan } = req.body as { type: 'EXTRA_PROFILE' | 'EXTRA_EMAIL' | 'PLAN', plan?: 'MONTHLY' | 'ANNUAL' | 'LIFETIME' | 'QUARTERLY' };

    const user = await app.prisma.user.findUnique({ where: { id: userId } });
    
    if (!user?.stripeCustomerId) return res.badRequest('No tienes cuenta de facturación');

    if (type === 'EXTRA_PROFILE' || type === 'EXTRA_EMAIL') {
      const isPremium = user?.plan === 'PREMIUM' && user?.planExpires && new Date(user.planExpires) > new Date();
      const isLifetime = user?.plan === 'LIFETIME';
      const hasTrial = user?.trialEnds && new Date(user.trialEnds) > new Date();
      const hasFullAccess = isPremium || isLifetime || hasTrial;

      if (!hasFullAccess) {
        return res.badRequest('Debes tener un plan activo para comprar recursos extra');
      }
    }

    try {
      const customer = await stripe.customers.retrieve(user.stripeCustomerId) as Stripe.Customer;
      const paymentMethodId = customer.invoice_settings?.default_payment_method as string;

      if (!paymentMethodId) {
        return res.badRequest('No tienes un método de pago predeterminado. Por favor añade uno.');
      }

      let priceId = '';
      let isOneTime = false;
      if (type === 'PLAN' && plan) {
          priceId = getStripePriceId(plan);
          if (plan === 'LIFETIME') isOneTime = true;
      } else if (type === 'EXTRA_EMAIL') {
          let interval: 'month' | 'year' = 'month';
          if (user.stripeSubscriptionId) {
              try {
                  const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
                  if (sub.items && sub.items.data.length > 0) {
                      const price = sub.items.data[0].price;
                      if (price.recurring?.interval === 'year') interval = 'year';
                  }
              } catch (e) {
                  app.log.warn(e, 'Could not retrieve subscription details for extra email pricing in buy-extra');
              }
          }
          priceId = getExtraEmailPriceId(interval);
      } else if (type === 'EXTRA_PROFILE') {
          let interval: 'month' | 'year' = 'month';
          if (user.stripeSubscriptionId) {
              try {
                  const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
                  if (sub.items && sub.items.data.length > 0) {
                      const price = sub.items.data[0].price;
                      if (price.recurring?.interval === 'year') interval = 'year';
                  }
              } catch (e) {
                  app.log.warn(e, 'Could not retrieve subscription details for extra profile pricing in buy-extra');
              }
          }
          priceId = getExtraProfilePriceId(interval);
      }

      if (!priceId) return res.badRequest('Plan o recurso no válido');

      if (isOneTime) {
          // Fetch price to get the amount
          const price = await stripe.prices.retrieve(priceId);
          const paymentIntent = await stripe.paymentIntents.create({
              amount: price.unit_amount || 0,
              currency: price.currency,
              customer: user.stripeCustomerId,
              payment_method: paymentMethodId,
              off_session: true,
              confirm: true,
              metadata: { userId, plan: plan || type }
          });
          
          if (paymentIntent.status === 'requires_action' || (paymentIntent.status as string) === 'requires_source_action') {
             // For one-time payments that require 3D secure but we used off_session: true,
             // it actually fails to confirm. If it somehow returns requires_action:
             return res.badRequest('El pago requiere autenticación 3D Secure. Por favor, usa otra tarjeta o procesa el pago desde el inicio.');
          }

          if (paymentIntent.status !== 'succeeded') {
             return res.badRequest(`Error procesando el pago. Estado: ${paymentIntent.status}`);
          }
          
          if (type === 'EXTRA_PROFILE') {
              await app.prisma.user.update({
                  where: { id: userId },
                  data: { extraProfileSlots: { increment: 1 } }
              });
          }
          
          await publishEvent(userId, { type: 'subscription:updated', plan: plan || type });
          return res.send({ ok: true, paymentIntentId: paymentIntent.id });
      }

      // Si es un plan principal y ya tiene suscripción, hacemos un swap
      if (type === 'PLAN' && user.stripeSubscriptionId) {
          const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
          const updatedSub = await stripe.subscriptions.update(user.stripeSubscriptionId, {
              items: [{
                  id: sub.items.data[0].id,
                  price: priceId,
              }],
              proration_behavior: 'always_invoice',
              default_payment_method: paymentMethodId,
              expand: ['latest_invoice.payment_intent']
          });

          if (updatedSub.status === 'incomplete' || updatedSub.status === 'past_due') {
              const invoice = updatedSub.latest_invoice as Stripe.Invoice;
              if (invoice && invoice.hosted_invoice_url) {
                  return res.send({ ok: true, url: invoice.hosted_invoice_url, pendingAuth: true });
              }
              return res.badRequest('La actualización requiere autenticación adicional. Revisa tu correo o contacta soporte.');
          }

          return res.send({ ok: true, subscriptionId: updatedSub.id });
      }
      
      const subscription = await stripe.subscriptions.create({
        customer: user.stripeCustomerId,
        items: [{ price: priceId }],
        default_payment_method: paymentMethodId,
        metadata: { userId, plan: plan || type },
        expand: ['latest_invoice.payment_intent']
      });

      if (subscription.status === 'incomplete' || subscription.status === 'incomplete_expired') {
          const invoice = subscription.latest_invoice as Stripe.Invoice;
          if (invoice && invoice.hosted_invoice_url) {
              return res.send({ ok: true, url: invoice.hosted_invoice_url, pendingAuth: true });
          }
          return res.badRequest('El pago requiere autenticación 3D Secure. Por favor, intenta usar otro método de pago.');
      }

      // No incrementamos los slots aquí. Confiamos estrictamente en el Webhook de Stripe 
      // (invoice.payment_succeeded) para aprovisionar los slots de forma segura y evitar dobles conteos.

      await publishEvent(userId, { type: 'subscription:created', plan: plan || type });

      return res.send({ ok: true, subscriptionId: subscription.id });
    } catch (e: any) {
      app.log.error(e, 'Error in buy-extra flow');
      if (e.code === 'authentication_required') {
          return res.badRequest('El pago requiere autenticación 3D Secure. Por favor, usa otra tarjeta o procesa el pago desde el inicio.');
      }
      return res.internalServerError(e.message || 'Error al procesar la compra');
    }
  });

};
