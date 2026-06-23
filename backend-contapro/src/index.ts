import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import swagger from '@fastify/swagger';
import formbody from '@fastify/formbody';
import multipart from '@fastify/multipart';
import rawBody from 'fastify-raw-body';
import oauth2 from '@fastify/oauth2';
import crypto from 'node:crypto';
import jwt from '@fastify/jwt';
import { config } from './config.js';
import { fetchAwsSecrets } from './services/aws.js';
import { prisma } from './plugins/prisma.js';
import { authRoutes } from './routes/auth.js';
import { historyRoutes } from './routes/history.js';
import { uploadRoutes } from './routes/upload.js';
import { metricsRoutes } from './routes/metrics.js';
import { expensesRoutes } from './routes/expenses.js';
import { incomeRoutes } from './routes/income.js';
import { transactionsRoutes } from './routes/transactions.js';
import { savedViewsRoutes } from './routes/savedViews.js';
import { budgetRoutes } from './routes/budget.js';
import { categoriesRoutes } from './routes/categories.js';
import { documentsRoutes } from './routes/documents.js';
import { statsRoutes } from './routes/stats.js';
import { adminRoutes } from './routes/admin.js';
import { integrationsRoutes } from './routes/integrations.js';
import { TelegramService } from './services/telegram.js';
import { WhatsAppService } from './services/whatsapp.js';
import { analysisRoutes } from './routes/analysis.js';
import { paymentsRoutes } from './routes/payments.js';
import { paymentMethodsRoutes } from './routes/paymentMethods.js';
import { stripeWebhookRoutes } from './routes/stripe_webhook.js';
import { flowCallbackRoutes } from './routes/flow_callbacks.js';
import { flowPaymentsRoutes } from './routes/flow_payments.js';
import { webhooksRoutes } from './routes/webhooks.js';
import { promoRoutes } from './routes/promo.js';
import { profilesRoutes } from './routes/profiles.js';
import { savingsRoutes } from './routes/savings.js';
import { exportRoutes } from './routes/exports.js';
import { chatRoutes } from './routes/chat.js';
import { configRoutes } from './routes/config.js';
import { streamRoutes } from './routes/stream.js';
import { initQueues } from './services/queues.js';
import { setupAnalysisWorker } from './workers/analysisWorker.js';
import { setupEmailScannerWorker } from './workers/emailScanner.js';
import { setupPushNotificationWorker } from './workers/pushNotification.js';
import { DailyReportJob } from './jobs/DailyReportJob.js';

async function buildServer() {
  // Load AWS Secrets if configured before booting everything
  if (config.awsSecretsManagerSecretId) {
    const secrets = await fetchAwsSecrets();
    for (const [key, value] of Object.entries(secrets)) {
      if (!process.env[key]) {
        process.env[key] = value as string;
      }
    }
  }

  // Elevar bodyLimit para evitar 413 en cargas grandes (se complementa con @fastify/multipart)
  const fastify = Fastify({ logger: true, bodyLimit: Math.max(5 * 1024 * 1024, config.uploadMaxBytes + (1 * 1024 * 1024)) });

  await fastify.register(sensible);
  await fastify.register(helmet);
  // CORS: en producción solo se acepta el dominio del frontend (CloudFront),
  // definido en FRONTEND_URL por la task definition de ECS (Terraform).
  // En desarrollo se permite cualquier localhost para no estorbar.
  const allowedOrigins: (string | RegExp)[] = [config.frontendUrl, /^https?:\/\/localhost(:\d+)?$/];
  await fastify.register(cors, { origin: allowedOrigins, credentials: true, methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'] });
  await fastify.register(rawBody, {
    field: 'rawBody', // req.rawBody
    global: false,    // Solo para rutas que lo pidan
    encoding: 'utf8', // Stripe necesita string
    runFirst: true,   // Ejecutar antes de JSON parser
  });
  await fastify.register(cookie, { hook: 'onRequest' });
  await fastify.register(jwt, { secret: config.jwtSecret });
  await fastify.register(swagger, {
    openapi: {
      info: { title: 'ContaPRO API', version: '0.1.0' },
      servers: [{ url: 'http://localhost:' + config.port }],
    },
  });
  // Swagger UI opcional: se puede habilitar registrando '@fastify/swagger-ui' si está instalado

  // Plugins
  await fastify.register(prisma);
  // Parsear application/x-www-form-urlencoded (necesario para webhooks de Flow)
  await fastify.register(formbody);
  await fastify.register(multipart, {
    attachFieldsToBody: true,
    limits: {
      fileSize: config.uploadMaxBytes,
      fieldSize: config.uploadMaxBytes,
      files: 1,
      parts: 20,
    },
  });

  // Google OAuth2 (opcional, requiere credenciales)
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
    const callbackUri = (process.env.GOOGLE_CALLBACK_URL || `${config.backendPublicUrl}/api/auth/google/callback`).trim();
    if (clientId && clientSecret) {
      // 1. Instancia para Login (openid profile email)
      await fastify.register(oauth2, {
        name: 'googleOAuth2',
        scope: ['openid', 'profile', 'email'],
        credentials: {
          client: { id: clientId, secret: clientSecret },
          auth: oauth2.GOOGLE_CONFIGURATION,
        },
        startRedirectPath: '/api/auth/google',
        callbackUri,
        generateStateFunction: () => crypto.randomBytes(16).toString('hex'),
        checkStateFunction: async () => true,
      });

      // 2. Instancia para Gmail Readonly (permisos adicionales)
      const gmailCallback = (process.env.GMAIL_CALLBACK_URL || `${config.backendPublicUrl}/api/integrations/google/callback`).trim();
      await fastify.register(oauth2, {
        name: 'gmailOAuth2',
        scope: ['https://www.googleapis.com/auth/gmail.readonly'],
        credentials: {
          client: { id: clientId, secret: clientSecret },
          auth: oauth2.GOOGLE_CONFIGURATION,
        },
        // Eliminamos startRedirectPath automático para controlar la redirección manualmente y agregar params (access_type=offline)
        // startRedirectPath: '/api/integrations/google/connect',
        callbackUri: gmailCallback,
        generateStateFunction: () => crypto.randomBytes(16).toString('hex'),
        checkStateFunction: async () => true,
      });

    } else {
      fastify.log.info('Google OAuth2 no configurado (faltan GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).');
    }
  } catch (e) {
    fastify.log.warn({ msg: 'Error configurando OAuth2', error: String(e) });
  }

  // Microsoft OAuth2 (opcional, requiere credenciales)
  try {
    const msClientId = config.microsoftClientId;
    const msClientSecret = config.microsoftClientSecret;
    const msCallbackUri = config.outlookCallbackUrl || `${config.backendPublicUrl}/api/integrations/outlook/callback`;

    if (msClientId && msClientSecret) {
      await fastify.register(oauth2, {
        name: 'microsoftOAuth2',
        credentials: {
          client: {
            id: msClientId,
            secret: msClientSecret
          },
          auth: {
            authorizeHost: 'https://login.microsoftonline.com',
            authorizePath: '/common/oauth2/v2.0/authorize',
            tokenHost: 'https://login.microsoftonline.com',
            tokenPath: '/common/oauth2/v2.0/token'
          }
        },
        scope: ['openid', 'profile', 'email', 'offline_access', 'https://outlook.office.com/mail.read'],
        callbackUri: msCallbackUri,
        generateStateFunction: () => crypto.randomBytes(16).toString('hex'),
        checkStateFunction: async () => true,
      });
      fastify.log.info('Microsoft OAuth2 configurado.');
    } else {
      fastify.log.info('Microsoft OAuth2 no configurado (faltan MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET).');
    }
  } catch (e) {
    fastify.log.warn({ msg: 'Error configurando Microsoft OAuth2', error: String(e) });
  }

  // Routes
  await fastify.register(authRoutes, { prefix: '/api/auth' });
  await fastify.register(exportRoutes, { prefix: '/api/export' });
  await fastify.register(savingsRoutes, { prefix: '/api/savings' });
  await fastify.register(historyRoutes, { prefix: '/api/history' });
  await fastify.register(metricsRoutes, { prefix: '/api/metrics' });
  await fastify.register(expensesRoutes, { prefix: '/api/expenses' });
  await fastify.register(incomeRoutes, { prefix: '/api/income' });
  await fastify.register(transactionsRoutes, { prefix: '/api/transactions' });
  await fastify.register(savedViewsRoutes, { prefix: '/api/saved-views' });
  await fastify.register(uploadRoutes, { prefix: '/api/upload' });
  await fastify.register(categoriesRoutes, { prefix: '/api/categories' });
  await fastify.register(budgetRoutes, { prefix: '/api/budget' });
  await fastify.register(documentsRoutes, { prefix: '/api/documents' });
  await fastify.register(analysisRoutes, { prefix: '/api/analysis' });
  await fastify.register(integrationsRoutes, { prefix: '/api/integrations' });
  await fastify.register(stripeWebhookRoutes, { prefix: '/api/stripe' });
  await fastify.register(flowCallbackRoutes, { prefix: '/api/flow' });
  await fastify.register(flowPaymentsRoutes, { prefix: '/api/payments' });
  await fastify.register(webhooksRoutes, { prefix: '/api/webhooks' });
  await fastify.register(paymentMethodsRoutes, { prefix: '/api/payment-methods' });
  await fastify.register(paymentsRoutes, { prefix: '/api/payments' });
  await fastify.register(promoRoutes, { prefix: '/api/promo' });
  await fastify.register(profilesRoutes, { prefix: '/api/profiles' });
  await fastify.register(statsRoutes, { prefix: '/api/stats' });
  await fastify.register(adminRoutes, { prefix: '/api/admin' });
  await fastify.register(metricsRoutes, { prefix: '/metrics' });
  await fastify.register(chatRoutes, { prefix: '/api/chat' });
  await fastify.register(configRoutes, { prefix: '/api/config' });
  await fastify.register(streamRoutes, { prefix: '/api/stream' });

  // Redis + BullMQ (opcional)
  if (config.queuesEnabled) {
    const { analysisQueue, emailScannerQueue, pushNotificationQueue, connection } = initQueues(fastify);
    if (connection) {
      setupAnalysisWorker(fastify, connection);
      setupEmailScannerWorker(fastify, connection);
      setupPushNotificationWorker(fastify, connection);

      (fastify as any).analysisQueue = analysisQueue;
      (fastify as any).emailScannerQueue = emailScannerQueue;
      (fastify as any).pushNotificationQueue = pushNotificationQueue;

      // Programar escaneo recurrente
      // Usamos un job ID fijo para evitar duplicados al reiniciar
      if (emailScannerQueue) {
        await emailScannerQueue.add(
            'scan-emails', 
            {}, 
            { 
                repeat: { every: 60 * 1000 }, // 60 segundos (Optimizado para reducir carga de CPU)
                jobId: 'recurring-email-scan'
            }
        );
      }
    }
  }

  // Telegram bot polling (optional)
  if (config.telegramBotToken) {
    const tg = new TelegramService(fastify, config.telegramBotToken);
    (fastify as any).telegram = tg;
    tg.startPolling();
  }

  // WhatsApp (Wazend) service (optional)
  if (config.wazendApiBase && config.wazendApiToken && config.whatsappNumber) {
    const wa = new WhatsAppService(fastify);
    (fastify as any).whatsapp = wa;
    fastify.log.info({ msg: 'whatsapp: wazend configured', number: config.whatsappNumber });
  } else {
    fastify.log.info('WhatsApp/Wazend no configurado (faltan WAZEND_API_BASE, WAZEND_API_TOKEN, WHATSAPP_NUMBER).');
  }

  // Healthchecks: deben responder 200 rápido y SIN autenticación.
  // - /health     -> lo usa el HEALTHCHECK del Dockerfile
  // - /api/health -> lo usa el Target Group del ALB (Terraform: modules/backend)
  //   Si esta ruta falla, ECS marca el contenedor como unhealthy y lo reinicia.
  fastify.get('/health', async () => ({ ok: true }));
  fastify.get('/api/health', async () => ({ ok: true }));

  // Asegurar presupuesto del mes actual para todos los usuarios al iniciar (sin notificar)
  try {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    
    // 1. Obtener todos los presupuestos existentes para este mes/año
    const existingBudgets = await fastify.prisma.budget.findMany({
      where: { year, month, target: 'GENERAL' },
      select: { userId: true, profileId: true }
    });

    const budgetSet = new Set(existingBudgets.map(b => `${b.userId}:${b.profileId}`));

    // 2. Obtener usuarios y sus perfiles
    const users = await fastify.prisma.user.findMany({ 
      select: { id: true, profiles: { select: { id: true } } } 
    });

    const { ensureBudgetForUserMonth } = await import('./routes/budget.js');

    for (const u of users) {
      if (!u.profiles) continue;
      for (const p of u.profiles) {
        if (!budgetSet.has(`${u.id}:${p.id}`)) {
          try {
            await ensureBudgetForUserMonth(fastify, u.id, p.id, year, month, false);
          } catch (e) {
            fastify.log.error({ msg: 'startup: ensureBudget failed', userId: u.id, profileId: p.id, e });
          }
        }
      }
    }
  } catch (e) {
    fastify.log.error({ msg: 'startup: budget check failed', e });
  }

  // Verificación diaria para garantizar presupuesto del mes actual
  setInterval(async () => {
    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      const users = await fastify.prisma.user.findMany({ select: { id: true, profiles: { select: { id: true } } } });
      for (const u of users) {
        if (!u.profiles || u.profiles.length === 0) continue;
        for (const p of u.profiles) {
          try {
            const existing = await fastify.prisma.budget.findFirst({ where: { userId: u.id, profileId: p.id, year, month, target: 'GENERAL' } });
            if (!existing) {
              const { ensureBudgetForUserMonth } = await import('./routes/budget.js');
              await ensureBudgetForUserMonth(fastify, u.id, p.id, year, month, false);
            }
          } catch {}
        }
      }
      fastify.log.info({ msg: 'cron: monthly budgets ensured', users: users.length, month, year });
    } catch (e) {
      fastify.log.error({ msg: 'cron: ensure monthly budgets failed', e });
    }
  }, 24 * 60 * 60 * 1000);

  return fastify;
}

buildServer()
  .then(async (app) => {
    await app.listen({ port: config.port, host: '0.0.0.0' });
    app.log.info(`Server listening on ${config.port}`);
    
    // Iniciar el Cron Job de reportes diarios
    const dailyReportJob = new DailyReportJob(app);
    dailyReportJob.start();
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
