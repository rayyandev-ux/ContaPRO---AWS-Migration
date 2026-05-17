import type { FastifyPluginAsync } from 'fastify';
import { config } from '../config.js';
import { isEntitled } from '../utils/subscription.js';
import { requireAuth } from '../utils/auth.js';
import { NotificationService } from '../services/notifications.js';
import { encrypt } from '../utils/crypto.js';

export const integrationsRoutes: FastifyPluginAsync = async (app) => {
  async function requireEntitled(userId: string, res: any): Promise<boolean> {
    const user = await app.prisma.user.findUnique({ where: { id: userId }, select: { plan: true, planExpires: true, trialEnds: true, stripeSubscriptionId: true } });
    if (!user) { res.unauthorized('No autenticado'); return false; }
    if (!isEntitled(user)) { res.paymentRequired('Suscripción requerida'); return false; }
    return true;
  }

  // Estado de Telegram
  app.get('/telegram/status', { schema: { summary: 'Estado de integracion Telegram' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return;
    const { userId } = auth;
    // Permitir ver estado sin gating para mostrar UI informativa
    if (!config.telegramBotToken) return res.send({ ok: false, error: 'Bot no configurado' });
    const user = await app.prisma.user.findUnique({ where: { id: userId }, select: { telegramId: true } });
    const me = await (app as any).telegram?.getMe();
    let userHandle: string | undefined = undefined;
    if (user?.telegramId) {
      try {
        const chat = await (app as any).telegram?.getChat(user.telegramId);
        userHandle = (chat?.username ? `@${chat.username}` : undefined);
      } catch {}
    }
    return res.send({ ok: true, linked: !!user?.telegramId, botUsername: me?.username || config.telegramBotName || undefined, userHandle });
  });

  // Generar código y deep-link
  app.post('/telegram/link', { schema: { summary: 'Generar link de vinculación Telegram' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return;
    const { userId } = auth;
    if (!(await requireEntitled(userId, res))) return;
    if (!config.telegramBotToken) return res.badRequest('Bot no configurado');
    const me = await (app as any).telegram?.getMe();
    const username = me?.username || config.telegramBotName;
    if (!username) return res.badRequest('Nombre de bot no disponible');
    const code = Math.random().toString(36).slice(2, 8);
    const key = `tg_link:${code}`;
    await app.prisma.aiCache.upsert({
      where: { key },
      update: { value: { userId }, ttl: 600 },
      create: { key, value: { userId }, ttl: 600 },
    });
    const deepLink = `https://t.me/${username}?start=${code}`;
    return res.send({ ok: true, code, deepLink, botUsername: username });
  });

  // Desvincular
  app.post('/telegram/unlink', { schema: { summary: 'Desvincular Telegram' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return;
    const { userId } = auth;
    if (!(await requireEntitled(userId, res))) return;
    await app.prisma.user.update({ where: { id: userId }, data: { telegramId: null } });
    return res.send({ ok: true });
  });

  // Probar envío
  app.post('/telegram/test', { schema: { summary: 'Enviar mensaje de prueba por Telegram' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return;
    const { userId } = auth;
    if (!(await requireEntitled(userId, res))) return;
    const user = await app.prisma.user.findUnique({ where: { id: userId }, select: { telegramId: true } });
    if (!user?.telegramId) return res.badRequest('No vinculado');
    await (app as any).telegram?.sendMessage(user.telegramId, '🔔 Prueba de notificación desde ContaPRO');
    return res.send({ ok: true });
  });

  // ========================
  // WhatsApp (Wazend)
  // ========================

  app.get('/whatsapp/status', { schema: { summary: 'Estado de integración WhatsApp' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return;
    const { userId } = auth;
    // Permitir ver estado sin gating para mostrar UI informativa
    if (!config.wazendApiBase || !config.wazendApiToken || !config.whatsappNumber) {
      return res.send({ ok: false, error: 'WhatsApp no configurado' });
    }
    const user = await app.prisma.user.findUnique({ where: { id: userId }, select: { whatsappPhone: true } });
    const wa = (app as any).whatsapp;
    let connectivity: any = undefined;
    try { connectivity = await wa?.checkConnectivity(); } catch {}
    return res.send({ ok: true, linked: !!user?.whatsappPhone, botNumber: config.whatsappNumber, phone: user?.whatsappPhone || undefined, connectivity });
  });

  app.post('/whatsapp/link', { schema: { summary: 'Generar código de vinculación WhatsApp' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return;
    const { userId } = auth;
    if (!(await requireEntitled(userId, res))) return;
    if (!config.wazendApiBase || !config.wazendApiToken || !config.whatsappNumber) {
      return res.badRequest('WhatsApp no configurado');
    }
    // Generar un código de 6 caracteres que contenga al menos un dígito,
    // para evitar colisiones con comandos como "gastos", "saldo", etc.
    let code = '';
    do {
      code = Math.random().toString(36).slice(2, 8);
    } while (!/\d/.test(code));
    const key = `wa_link:${code}`;
    await app.prisma.aiCache.upsert({
      where: { key },
      update: { value: { userId }, ttl: 600 },
      create: { key, value: { userId }, ttl: 600 },
    });
    const waMe = `https://wa.me/${encodeURIComponent(config.whatsappNumber.replace(/[^0-9]/g, ''))}?text=${encodeURIComponent(code)}`;
    return res.send({ ok: true, code, waMe, botNumber: config.whatsappNumber });
  });

  app.post('/whatsapp/unlink', { schema: { summary: 'Desvincular WhatsApp' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return;
    const { userId } = auth;
    if (!(await requireEntitled(userId, res))) return;
    await app.prisma.user.update({ where: { id: userId }, data: { whatsappPhone: null, whatsappLinkedAt: null } });
    return res.send({ ok: true });
  });

  // Confirmar vinculación manualmente con código (sin depender del webhook)
  app.post('/whatsapp/link/confirm', { schema: { summary: 'Confirmar vinculación WhatsApp por código' } }, async (req: any, res: any) => {
    // Permitir confirmación sin cookie; si hay cookie, debe coincidir con el usuario del código
    let requesterId: string | undefined;
    try {
      const token = req.cookies?.session;
      if (token) requesterId = (app.jwt.verify(token) as { sub: string }).sub;
    } catch {}
    const { code, phone } = req.body || {};
    if (!code) return res.badRequest('Falta código');
    const key = `wa_link:${String(code).trim()}`;
    const entry = await app.prisma.aiCache.findUnique({ where: { key } });
    // aiCache.value es Prisma.JsonValue. Validar y extraer userId de forma segura.
    const val: any = entry?.value ?? null;
    const cacheUserId: string | undefined = typeof val?.userId === 'string' ? val.userId : undefined;
    if (!cacheUserId) {
      return res.badRequest('Código inválido o vencido');
    }
    if (requesterId && requesterId !== cacheUserId) {
      return res.forbidden('Código no pertenece al usuario autenticado');
    }
    const normalized = typeof phone === 'string' && phone.trim()
      ? (phone.trim().startsWith('+') ? phone.trim() : `+${phone.trim()}`)
      : undefined;
    if (!normalized) {
      return res.badRequest('Falta número de teléfono');
    }
    await app.prisma.user.update({ where: { id: cacheUserId }, data: { whatsappPhone: normalized, whatsappLinkedAt: new Date() } });
    try { await app.prisma.aiCache.delete({ where: { key } }); } catch {}

    // Intentar enviar confirmación si el servicio está disponible (puede fallar sin sesión)
    const wa = (app as any).whatsapp;
    try {
      await wa?.sendText(normalized, '✅ Tu cuenta ha sido vinculada correctamente.');
      await wa?.sendText(normalized, config.whatsappWelcomeMessage);
    } catch {}

    return res.send({ ok: true, linked: true, phone: normalized });
  });

  app.post('/whatsapp/test', { schema: { summary: 'Enviar mensaje de prueba por WhatsApp (Wazend)' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return;
    const { userId } = auth;
    if (!(await requireEntitled(userId, res))) return;
    const user = await app.prisma.user.findUnique({ where: { id: userId }, select: { whatsappPhone: true } });
    if (!user?.whatsappPhone) return res.badRequest('No vinculado');
    const to = user.whatsappPhone;
    const wa = (app as any).whatsapp;
    const body: any = req.body || {};
    const text: string = (typeof body.text === 'string' && body.text.trim()) ? body.text.trim() : config.whatsappTestMessage;
    const ok = await wa?.sendText(to.startsWith('+') ? to : `+${to}`, text);
    if (!ok) return res.internalServerError('No se pudo enviar');
    return res.send({ ok: true, to });
  });

  // Enlace directo por teléfono (sin OTP) para el usuario autenticado
  app.post('/whatsapp/link/direct', { schema: { summary: 'Vincular WhatsApp por teléfono (directo)' } }, async (req: any, res: any) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return;
    const { userId } = auth;
    if (!(await requireEntitled(userId, res))) return;
    const { phone } = req.body || {};
    const normalized = typeof phone === 'string' && phone.trim()
      ? (phone.trim().startsWith('+') ? phone.trim() : `+${phone.trim()}`)
      : undefined;
    if (!normalized) return res.badRequest('Falta número de teléfono');
    await app.prisma.user.update({ where: { id: userId }, data: { whatsappPhone: normalized, whatsappLinkedAt: new Date() } });
    // Intentar enviar confirmación (puede fallar si sesión no está lista)
    const wa = (app as any).whatsapp;
    try {
      const welcomeMsg = `🤖 *Hola, soy tu Agente de IA de ContaPRO*

Estoy aquí para ayudarte a gestionar tus finanzas de manera inteligente. 🧠✨

*¿Qué puedo hacer por ti?*
📸 *Analizar Facturas:* Envíame una foto o PDF y extraeré los datos automáticamente.
🎤 *Reconocimiento de Voz:* Envíame un audio diciendo tu gasto.
💬 *Chat Natural:* Dime "registra un gasto de 20 soles en almuerzo".
📊 *Consultas:* Pregúntame "¿cuánto gasté en comida este mes?".

¡Empecemos! Envíame tu primer gasto. 🚀`;

      await wa?.sendText(normalized, '✅ ¡Tu cuenta ha sido vinculada con éxito!');
      await wa?.sendText(normalized, welcomeMsg);
    } catch {}
    return res.send({ ok: true, linked: true, phone: normalized });
  });

  // ========================
  // Testing Email/Expense Ingestion
  // ========================
  app.post('/simulate-expense', { schema: { summary: 'Simular detección de gasto por Email/SMS' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return;
    const { userId } = auth;
    
    // Validar body
    const { amount, currency, merchant, source, description } = req.body as any;
    if (!amount || !merchant) return res.badRequest('Missing amount or merchant');

    // Crear Pending Expense
    const pending = await app.prisma.pendingExpense.create({
      data: {
        userId,
        amount: Number(amount),
        currency: currency || 'PEN',
        merchant,
        description: description || 'Simulación de gasto',
        date: new Date(),
        source: source || 'SIMULATION',
        status: 'WAITING_USER'
      }
    });

    // Notificar
    const notificationService = new NotificationService(app);
    await notificationService.notifyPendingExpense(pending.id);

    return res.send({ ok: true, pendingExpenseId: pending.id });
  });

  // ========================
  // Google / Gmail Connect Endpoint
  // ========================
  app.get('/google/connect', { schema: { summary: 'Iniciar conexión con Gmail' } }, async (req, res) => {
    try {
        const token = req.cookies.session;
        if (!token) return res.redirect(`${config.frontendUrl}/integrations?error=unauthorized`);
        const decoded = app.jwt.verify(token) as { sub: string };
        const user = await app.prisma.user.findUnique({ where: { id: decoded.sub } });
        
        if (!user || user.plan === 'FREE') {
            return res.redirect(`${config.frontendUrl}/integrations?error=upgrade_required`);
        }

        const activeIntegrations = await app.prisma.emailIntegration.count({
            where: { userId: user.id, isActive: true }
        });

        const allowedEmails = 1 + (user.extraEmailSlots || 0);
        if (activeIntegrations >= allowedEmails) {
            return res.redirect(`${config.frontendUrl}/integrations?error=email_limit_reached`);
        }
    } catch {
        return res.redirect(`${config.frontendUrl}/integrations?error=unauthorized`);
    }

    // Generar URL de autorización manualmente para incluir access_type=offline y prompt=consent
    // Esto asegura que Google nos devuelva un refresh_token, vital para el worker en background.
    
    if ((app as any).gmailOAuth2) {
        // fastify-oauth2 genera la URI base. Le podemos pasar opciones adicionales si la librería lo soporta en generateAuthorizationUri
        // Según docs de oauth2 (simple-oauth2 under hood) o fastify-oauth2, generateAuthorizationUri acepta params.
        
        // CORRECCION FINAL: generateAuthorizationUri no acepta opciones en el 3er argumento en esta versión.
        // Llamamos sin opciones para que genere el state y cookie correctamente.
        // Luego agregamos los parámetros extra (access_type y prompt) manualmente al string de URL.
        
        let authorizationUrl = await (app as any).gmailOAuth2.generateAuthorizationUri(req, res);
        
        // Asegurar que es string
        if (typeof authorizationUrl !== 'string') {
             // Si por alguna razón es objeto o array (raro), lo convertimos o manejamos error
             authorizationUrl = String(authorizationUrl);
        }

        // Agregar params si no existen
        const separator = authorizationUrl.includes('?') ? '&' : '?';
        authorizationUrl += `${separator}access_type=offline&prompt=consent`;
        
        return res.redirect(authorizationUrl);
    }
    
    return res.internalServerError('OAuth no configurado');
  });

  // ========================
  // Google / Gmail OAuth Callback
  // ========================
  app.get('/google/callback', { schema: { summary: 'Callback de conexión Gmail' } }, async (req, res) => {
    // 1. Obtener token
    let token: any;
    try {
        token = await (app as any).gmailOAuth2.getAccessTokenFromAuthorizationCodeFlow(req);
        app.log.info({ msg: 'Gmail OAuth Callback Token Received', hasAccessToken: !!token?.token?.access_token, hasRefreshToken: !!token?.token?.refresh_token });
    } catch (e) {
        app.log.error({ msg: 'Gmail OAuth Callback Error', error: e });
        return res.redirect(`${config.frontendUrl}/integrations?error=auth_failed_token`);
    }

    // 2. Identificar usuario (la cookie de sesión debe estar presente)
    // Nota: Como es un callback cross-site, asegúrate de que SameSite=None o Lax permita la cookie.
    // Si no llega cookie, podríamos pasar un 'state' con el userId encriptado.
    
    // Intentar leer cookie session
    let userId: string | undefined;
    try {
        const session = req.cookies.session;
        if (session) {
            const decoded = app.jwt.verify(session) as { sub: string };
            userId = decoded.sub;
        }
    } catch {}

    if (!userId) {
        // Fallback: Si no hay sesión, no podemos vincular. Redirigir a error en frontend.
        return res.redirect(`${config.frontendUrl}/integrations?error=session_expired`);
    }

    // Verificar Plan antes de guardar credenciales
    const user = await app.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.plan === 'FREE') {
        return res.redirect(`${config.frontendUrl}/integrations?error=upgrade_required`);
    }

    const activeIntegrations = await app.prisma.emailIntegration.count({
        where: { userId: user.id, isActive: true }
    });

    const allowedEmails = 1 + (user.extraEmailSlots || 0);
    if (activeIntegrations >= allowedEmails) {
        return res.redirect(`${config.frontendUrl}/integrations?error=email_limit_reached`);
    }

    // 3. Guardar credenciales
    if (token.token.access_token && token.token.refresh_token) {
        // Obtener email del usuario conectado
        let userEmail = 'gmail_primary';
        try {
            const meRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${token.token.access_token}` }
            });
            if (meRes.ok) {
                const meData = await meRes.json();
                if (meData.email) {
                    userEmail = meData.email;
                }
            }
        } catch (err) {
            app.log.warn({ msg: 'Failed to fetch Google user profile', err });
        }

        const { encrypt } = await import('../utils/crypto.js');
        
        await app.prisma.emailIntegration.upsert({
            where: { userId_email: { userId, email: userEmail } },
            update: {
                accessToken: encrypt(token.token.access_token),
                refreshToken: encrypt(token.token.refresh_token),
                lastSync: new Date(),
                isActive: true,
                provider: 'GMAIL',
                email: userEmail
            },
            create: {
                userId,
                provider: 'GMAIL',
                email: userEmail,
                accessToken: encrypt(token.token.access_token),
                refreshToken: encrypt(token.token.refresh_token),
                isActive: true
            }
        });

        // 4. Notificar vinculación exitosa (WhatsApp y Telegram)
        try {
            const notificationService = new NotificationService(app);
            
            // Mensaje de éxito
            const message = `🎉 *¡Gmail Connect Vinculado!*
Tu correo ha sido conectado exitosamente. Ahora ContaPRO escaneará tus gastos automáticamente. 📧✨

Recuerda que puedes gestionar los filtros en la sección de Integraciones.`;

            // Enviar notificación a ambos canales si están disponibles
            await notificationService.notify(userId, message);
        } catch (error) {
            app.log.error({ msg: 'Failed to send integration notification', userId, error });
        }
        
        return res.redirect(`${config.frontendUrl}/integrations/emails?success=gmail_connected`);
    }

    return res.redirect(`${config.frontendUrl}/integrations/emails?error=auth_failed`);
  });

  // ========================
  // Email Integrations Global Status
  // ========================
  app.get('/emails/status', { schema: { summary: 'Estado global de todas las integraciones de correo' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return;
    const { userId } = auth;
    
    const integrations = await app.prisma.emailIntegration.findMany({
        where: { userId, isActive: true }
    });

    const defaultSenders = ['yape', 'plin', 'uber', 'rappi', 'didifood', 'bcp', 'bbva', 'interbank', 'scotiabank'];
    
    const formatted = integrations.map(it => {
        const settings = it.settings as { allowedSenders?: string[]; autoApprove?: boolean; customName?: string } | null;
        return {
            id: it.id,
            provider: it.provider,
            email: it.email,
            lastSync: it.lastSync,
            settings: {
                allowedSenders: settings?.allowedSenders ?? defaultSenders,
                autoApprove: settings?.autoApprove ?? false,
                customName: settings?.customName
            }
        };
    });

    return res.send({
        ok: true,
        count: formatted.length,
        integrations: formatted
    });
  });

  // ========================
  // Gmail Status & Management
  // ========================
  app.get('/google/status', { schema: { summary: 'Estado de conexión Gmail' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return;
    const { userId } = auth;
    
    // Buscar todas las integraciones activas del usuario (para contar slots globales)
    const allActive = await app.prisma.emailIntegration.count({
        where: { userId, isActive: true }
    });

    // Buscar todas las integraciones activas de Gmail
    const integrations = await app.prisma.emailIntegration.findMany({
        where: { userId, provider: 'GMAIL', isActive: true }
    });

    const defaultSenders = ['yape', 'plin', 'uber', 'rappi', 'didifood', 'bcp', 'bbva', 'interbank', 'scotiabank'];
    
    return res.send({
        ok: true,
        totalActiveCount: allActive,
        integrations: integrations.map(it => {
            const settings = it.settings as { allowedSenders?: string[]; autoApprove?: boolean; customName?: string } | null;
            return {
                id: it.id,
                linked: true,
                email: it.email,
                lastSync: it.lastSync,
                settings: {
                    allowedSenders: settings?.allowedSenders ?? defaultSenders,
                    autoApprove: settings?.autoApprove ?? false,
                    customName: settings?.customName
                }
            };
        })
    });
  });

  app.put('/google/settings', { schema: { summary: 'Actualizar configuración de Gmail' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return;
    const { userId } = auth;
    
    const { allowedSenders, autoApprove, email, customName } = req.body as { allowedSenders: string[]; autoApprove?: boolean, email?: string, customName?: string };
    
    if (!Array.isArray(allowedSenders)) {
        return res.badRequest('allowedSenders debe ser un array de strings');
    }

    // Buscar integración activa por email si se proporciona, de lo contrario la primera que encuentre
    const integration = await app.prisma.emailIntegration.findFirst({
        where: { userId, provider: 'GMAIL', isActive: true, email: email ?? undefined }
    });

    if (!integration) return res.badRequest('Gmail no conectado');

    // Actualizar settings
    const currentSettings = (integration.settings as any) || {};
    await app.prisma.emailIntegration.update({
        where: { id: integration.id },
        data: {
            settings: { 
                ...currentSettings,
                allowedSenders,
                autoApprove: !!autoApprove,
                customName: customName ?? currentSettings.customName
            }
        }
    });

    return res.send({ ok: true });
  });

  app.post('/google/disconnect', { schema: { summary: 'Desconectar Gmail' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return;
    const { userId } = auth;
    const body = (req.body || {}) as { email?: string };
    const { email } = body;
    
    // Desactivar integración (soft delete)
    await app.prisma.emailIntegration.updateMany({
        where: { userId, provider: 'GMAIL', email: email ?? undefined },
        data: { isActive: false, accessToken: '', refreshToken: '' }
    });

    return res.send({ ok: true });
  });

  app.post('/google/test', { schema: { summary: 'Probar escaneo manual de Gmail' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return;
    const { userId } = auth;
    const body = (req.body || {}) as { email?: string };
    const { email } = body;
    
    const integration = await app.prisma.emailIntegration.findFirst({
        where: { userId, provider: 'GMAIL', isActive: true, email: email ?? undefined }
    });

    if (!integration) return res.badRequest('Gmail no conectado');

    // Importaciones dinámicas para no sobrecargar el inicio si no se usan
    const { google } = await import('googleapis');
    const { decrypt } = await import('../utils/crypto.js');

    try {
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
        );

        oauth2Client.setCredentials({
            access_token: decrypt(integration.accessToken),
            refresh_token: decrypt(integration.refreshToken)
        });

        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
        
        // Query de prueba (dinámica según configuración)
        const settings = integration.settings as { allowedSenders?: string[] } | null;
        const defaultSenders = ['yape', 'plin', 'uber', 'rappi', 'didifood', 'bcp', 'bbva', 'interbank', 'scotiabank'];
        const allowedSenders = Array.isArray(settings?.allowedSenders) ? settings!.allowedSenders : defaultSenders;

        if (allowedSenders.length === 0) {
             return res.send({ ok: true, count: 0, message: 'Lista de remitentes vacía. Agrega remitentes para escanear.' });
        }

        const queryParts = allowedSenders.map(s => {
            // Si parece un dominio o correo, usamos solo from
            if (s.includes('@') || s.includes('.')) return `from:${s}`;
            // Si es una palabra simple (ej: "yape", "enviaste"), buscamos en from O subject
            return `(from:${s} OR subject:${s})`;
        });
        const filterQuery = queryParts.join(' OR ');
        
        // Opción 2: Filtro relajado (remitente o subject para keywords)
        // Aumentamos a 3d para pruebas manuales para detectar correos un poco más antiguos
        const q = `label:inbox newer_than:3d (${filterQuery})`;
        
        const listRes = await gmail.users.messages.list({ userId: 'me', q, maxResults: 30 });
        const count = listRes.data.resultSizeEstimate || listRes.data.messages?.length || 0;

        // Si no encontró nada, intentar búsqueda laxa para diagnóstico
        let diagnosis = '';
        if (count === 0) {
            // Diagnóstico 1: Ver si hay CUALQUIER correo reciente
            const laxQ = 'label:inbox newer_than:3d';
            const laxRes = await gmail.users.messages.list({ userId: 'me', q: laxQ, maxResults: 1 });
            const laxCount = laxRes.data.resultSizeEstimate || laxRes.data.messages?.length || 0;

            if (laxCount > 0) {
                diagnosis = ` (Hay correos recientes en tu bandeja, pero ninguno coincide con los remitentes permitidos: ${allowedSenders.join(', ')}. Verifica que el correo provenga EXACTAMENTE de esa dirección.)`;
            } else {
                diagnosis = ' (Tu bandeja de entrada parece vacía o sin correos en los últimos 2 días)';
            }
        } else {
            // Si encontró correos, verificar si son "ignorados" o "rechazados" por el escáner
            // Esto ayuda al usuario a saber si el correo fue detectado pero descartado
            diagnosis = ' (El escáner analizará estos correos. Si no ves notificaciones, revisa si ya fueron procesados o descartados por la IA)';
        }

        // Opcional: Si queremos procesarlos de verdad, podríamos encolar el trabajo también
        const queue = (app as any).emailScannerQueue;
        if (queue && count > 0) {
            await queue.add('scan-emails-manual', { userId, force: true }, { jobId: `manual-scan-${userId}-${Date.now()}` });
        }

        return res.send({ ok: true, count, message: `Se encontraron ${count} correos potenciales${diagnosis}` });
    } catch (error: any) {
        app.log.error({ msg: 'Google Test Error', error });
        return res.send({ ok: false, error: 'Error al conectar con Gmail: ' + error.message });
    }
  });

  // ========================
  // Microsoft / Outlook Connect Endpoint
  // ========================
  app.get('/outlook/connect', { schema: { summary: 'Iniciar conexión con Outlook' } }, async (req, res) => {
    try {
        const token = req.cookies.session;
        if (!token) return res.redirect(`${config.frontendUrl}/integrations?error=unauthorized`);
        const decoded = app.jwt.verify(token) as { sub: string };
        const user = await app.prisma.user.findUnique({ where: { id: decoded.sub } });
        
        if (!user || user.plan === 'FREE') {
            return res.redirect(`${config.frontendUrl}/integrations?error=upgrade_required`);
        }

        const activeIntegrations = await app.prisma.emailIntegration.count({
            where: { userId: user.id, isActive: true }
        });

        const allowedEmails = 1 + (user.extraEmailSlots || 0);
        if (activeIntegrations >= allowedEmails) {
            return res.redirect(`${config.frontendUrl}/integrations?error=email_limit_reached`);
        }
    } catch {
        return res.redirect(`${config.frontendUrl}/integrations?error=unauthorized`);
    }

    // Generar URL de autorización manualmente para incluir access_type=offline y prompt=consent si fuera necesario
    // Para Microsoft, el scope offline_access ya se solicitó en la config.
    
    if ((app as any).microsoftOAuth2) {
        let authorizationUrl = await (app as any).microsoftOAuth2.generateAuthorizationUri(req, res);
        
        // Asegurar que es string
        if (typeof authorizationUrl !== 'string') {
             authorizationUrl = String(authorizationUrl);
        }

        return res.redirect(authorizationUrl);
    }
    
    return res.internalServerError('Microsoft OAuth no configurado');
  });

  // ========================
  // Microsoft / Outlook OAuth Callback
  // ========================
  app.get('/outlook/callback', { schema: { summary: 'Callback de conexión Outlook' } }, async (req, res) => {
    // 1. Obtener token
    let token: any;
    try {
        token = await (app as any).microsoftOAuth2.getAccessTokenFromAuthorizationCodeFlow(req);
        app.log.info({ msg: 'Outlook OAuth Callback Token Received', hasAccessToken: !!token?.token?.access_token, hasRefreshToken: !!token?.token?.refresh_token });
    } catch (e) {
        app.log.error({ msg: 'Outlook OAuth Callback Error', error: e });
        return res.redirect(`${config.frontendUrl}/integrations?error=auth_failed_token`);
    }

    // 2. Identificar usuario (la cookie de sesión debe estar presente)
    let userId: string | undefined;
    try {
        const session = req.cookies.session;
        if (session) {
            const decoded = app.jwt.verify(session) as { sub: string };
            userId = decoded.sub;
        }
    } catch {}

    if (!userId) {
        return res.redirect(`${config.frontendUrl}/integrations?error=session_expired`);
    }

    const user = await app.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.plan === 'FREE') {
        return res.redirect(`${config.frontendUrl}/integrations?error=upgrade_required`);
    }

    const activeIntegrations = await app.prisma.emailIntegration.count({
        where: { userId: user.id, isActive: true }
    });

    const allowedEmails = 1 + (user.extraEmailSlots || 0);
    if (activeIntegrations >= allowedEmails) {
        return res.redirect(`${config.frontendUrl}/integrations?error=email_limit_reached`);
    }

    // 3. Guardar credenciales
    if (token.token.access_token && token.token.refresh_token) {
        const { encrypt } = await import('../utils/crypto.js');
        
        // Intentar obtener info del usuario para el email
        let userEmail = 'outlook_primary';
        try {
            // Nota: Se requiere fetch global o node-fetch. Asumimos fetch disponible en Node 18+
            const meRes = await fetch('https://graph.microsoft.com/v1.0/me', {
                headers: { Authorization: `Bearer ${token.token.access_token}` }
            });
            if (meRes.ok) {
                const meData = await meRes.json();
                if (meData.mail || meData.userPrincipalName) {
                    userEmail = meData.mail || meData.userPrincipalName;
                }
            }
        } catch (err) {
            app.log.warn({ msg: 'Failed to fetch Microsoft user profile', err });
        }

        // Microsoft OAuth2 devuelve los tokens dentro de token.token, PERO access_token puede ser un objeto si no se maneja bien
        // Aseguramos que sea string
        const accessToken = typeof token.token.access_token === 'string' ? token.token.access_token : JSON.stringify(token.token.access_token);
        const refreshToken = typeof token.token.refresh_token === 'string' ? token.token.refresh_token : JSON.stringify(token.token.refresh_token);

        await app.prisma.emailIntegration.upsert({
            where: { userId_email: { userId, email: userEmail } },
            update: {
                accessToken: encrypt(accessToken),
                refreshToken: encrypt(refreshToken),
                lastSync: new Date(),
                isActive: true,
                provider: 'OUTLOOK',
                email: userEmail
            },
            create: {
                userId,
                provider: 'OUTLOOK',
                email: userEmail,
                accessToken: encrypt(accessToken),
                refreshToken: encrypt(refreshToken),
                isActive: true
            }
        });

        // 4. Notificar vinculación exitosa
        try {
            const notificationService = new NotificationService(app);
            const message = `🎉 *¡Outlook Connect Vinculado!*
Tu correo de Outlook (${userEmail}) ha sido conectado exitosamente. Ahora ContaPRO escaneará tus gastos automáticamente. 📧✨

Recuerda que puedes gestionar los filtros en la sección de Integraciones.`;
            await notificationService.notify(userId, message);
        } catch (error) {
            app.log.error({ msg: 'Failed to send integration notification', userId, error });
        }
        
        return res.redirect(`${config.frontendUrl}/integrations/emails?success=outlook_connected`);
    }

    return res.redirect(`${config.frontendUrl}/integrations/emails?error=auth_failed`);
  });

  // ========================
  // Outlook Status & Management
  // ========================
  app.get('/outlook/status', { schema: { summary: 'Estado de conexión Outlook' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return;
    const { userId } = auth;
    
    // Buscar todas las integraciones activas del usuario (para contar slots globales)
    const allActive = await app.prisma.emailIntegration.count({
        where: { userId, isActive: true }
    });

    // Buscar todas las integraciones activas de Outlook
    const integrations = await app.prisma.emailIntegration.findMany({
        where: { userId, provider: 'OUTLOOK', isActive: true }
    });

    const defaultSenders = ['yape', 'plin', 'uber', 'rappi', 'didifood', 'bcp', 'bbva', 'interbank', 'scotiabank'];
    
    return res.send({
        ok: true,
        totalActiveCount: allActive,
        integrations: integrations.map(it => {
            const settings = it.settings as { allowedSenders?: string[]; autoApprove?: boolean; customName?: string } | null;
            return {
                id: it.id,
                linked: true,
                email: it.email,
                lastSync: it.lastSync,
                settings: {
                    allowedSenders: settings?.allowedSenders ?? defaultSenders,
                    autoApprove: settings?.autoApprove ?? false,
                    customName: settings?.customName
                }
            };
        })
    });
  });

  app.put('/outlook/settings', { schema: { summary: 'Actualizar configuración de Outlook' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return;
    const { userId } = auth;
    
    const { allowedSenders, autoApprove, email, customName } = req.body as { allowedSenders: string[]; autoApprove?: boolean, email?: string, customName?: string };
    
    if (!Array.isArray(allowedSenders)) {
        return res.badRequest('allowedSenders debe ser un array de strings');
    }

    const integration = await app.prisma.emailIntegration.findFirst({
        where: { userId, provider: 'OUTLOOK', isActive: true, email: email ?? undefined }
    });

    if (!integration) return res.badRequest('Outlook no conectado');

    const currentSettings = (integration.settings as any) || {};
    await app.prisma.emailIntegration.update({
        where: { id: integration.id },
        data: {
            settings: { 
                ...currentSettings,
                allowedSenders,
                autoApprove: !!autoApprove,
                customName: customName ?? currentSettings.customName
            }
        }
    });

    return res.send({ ok: true });
  });

  app.post('/outlook/disconnect', { schema: { summary: 'Desconectar Outlook' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return;
    const { userId } = auth;
    const body = (req.body || {}) as { email?: string };
    const { email } = body;
    
    await app.prisma.emailIntegration.updateMany({
        where: { userId, provider: 'OUTLOOK', email: email ?? undefined },
        data: { isActive: false, accessToken: '', refreshToken: '' }
    });

    return res.send({ ok: true });
  });

  app.post('/outlook/test', { schema: { summary: 'Probar escaneo manual de Outlook' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return;
    const { userId } = auth;
    const body = (req.body || {}) as { email?: string };
    const { email } = body;
    
    const integration = await app.prisma.emailIntegration.findFirst({
        where: { userId, provider: 'OUTLOOK', isActive: true, email: email ?? undefined }
    });

    if (!integration) return res.badRequest('Outlook no conectado');

    // Forzar escaneo manual (simulado o real)
    // Para Outlook, como el filtro OData es complejo, lo mejor es encolar el trabajo con flag force
    const queue = (app as any).emailScannerQueue;
    if (queue) {
        // Encolamos el trabajo de escaneo forzado
        await queue.add('scan-emails-manual', { userId, force: true, provider: 'OUTLOOK' }, { jobId: `manual-scan-outlook-${userId}-${Date.now()}` });
        
        // Devolvemos respuesta optimista
        return res.send({ ok: true, message: 'Escaneo manual iniciado. Revisa tus notificaciones en unos momentos.' });
    } else {
        return res.internalServerError('Cola de trabajos no disponible');
    }
  });
};