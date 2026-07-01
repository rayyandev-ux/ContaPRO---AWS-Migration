import type { FastifyPluginAsync } from 'fastify';
import crypto from 'node:crypto';
import { z } from 'zod';
import { hashPassword, verifyPassword } from '../services/hash.js';
import { sendVerificationEmail, sendPasswordResetEmail, generateCode } from '../services/email.js';
import { config } from '../config.js';
import { getCookieOpts, requireAuth } from '../utils/auth.js';

import { generateSessionToken, verifyMagicToken } from '../utils/jwt.js';
import { calculateProfileLimits } from '../services/profile-limits.js';
import { TikTokService } from '../services/tiktok.js';

export const authRoutes: FastifyPluginAsync = async (app) => {
  const getOrCreateDefaultProfile = async (userId: string, userName?: string) => {
    let profile = await app.prisma.profile.findFirst({ where: { userId, isDefault: true } });
    if (!profile) {
      profile = await app.prisma.profile.create({
        data: { userId, name: userName || 'Mi Perfil', isDefault: true, color: '#7c3aed', avatar: 'default' }
      });
    }
    return profile;
  };

  const RegisterBody = z.object({ email: z.string().email(), password: z.string().min(6), name: z.string().optional() });
  const LoginBody = z.object({ email: z.string().email(), password: z.string().min(6), remember: z.boolean().optional() });
  const VerifyBody = z.object({ email: z.string().email(), code: z.string().length(6) });
  const ResendBody = z.object({ email: z.string().email() });
  const ForgotBody = z.object({ email: z.string().email() });
  const ResetBody = z.object({ email: z.string().email(), code: z.string().length(6), password: z.string().min(6) });


  // Activar Magic Link (Trial 14 días)
  app.get('/magic-activate', { schema: { summary: 'Activate Trial via Magic Link' } }, async (req, res) => {
    const q = (req.query || {}) as any;
    const token = String(q.token || '');
    
    if (!token) return res.badRequest('Token faltante');

    const decoded = verifyMagicToken(token);
    if (!decoded || decoded.action !== 'activate_trial') {
        return res.badRequest('Link inválido o expirado.');
    }

    const user = await app.prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) return res.notFound('Usuario no encontrado');

    // Activar Trial 14 Días
    const now = new Date();
    const trialEnds = new Date(now.setDate(now.getDate() + 14));

    // Si ya es premium o tuvo trial, quizás queramos bloquear o permitir reactivación.
    // Asumimos que "Magic Link" siempre otorga el beneficio si se invoca.
    
    await app.prisma.user.update({
        where: { id: user.id },
        data: {
            plan: 'PREMIUM',
            status: 'ACTIVE',
            trialEnds: trialEnds,
            emailVerified: true // Auto-verificar si viene de WhatsApp/Telegram confiable
        }
    });

    // Send TikTok Event
    TikTokService.sendEvent({
      eventName: 'StartTrial',
      user: {
        email: user.email,
        phone: user.phoneNumber || user.whatsappPhone || undefined,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }
    });

    // Iniciar Sesión (Set Cookie)
    const profile = await getOrCreateDefaultProfile(user.id, user.name || undefined);
    const sessionToken = app.jwt.sign({ sub: user.id, userId: user.id, profileId: profile.id, type: 'session' }, { expiresIn: '14d' });
    const baseOpts = getCookieOpts(req);
    res.setCookie('session', sessionToken, { ...baseOpts, maxAge: 14 * 24 * 60 * 60 });

    // Redirigir al Dashboard con mensaje de éxito
    const dest = `${config.frontendUrl}/dashboard?welcome=trial_activated`;
    return res.redirect(dest);
  });

  // Acceso Maestro (Impersonate)
  app.get('/admin-impersonate', { schema: { summary: 'Admin Impersonate Login' } }, async (req, res) => {
    const q = (req.query || {}) as any;
    const token = String(q.token || '');
    if (!token) return res.badRequest('Token faltante');

    try {
      const decoded = app.jwt.verify(token) as any;
      if (!decoded || decoded.type !== 'session') {
        return res.unauthorized('Token inválido');
      }

      const baseOpts = getCookieOpts(req);
      // Establecer sesión temporal de 1 hora
      res.setCookie('session', token, { ...baseOpts, maxAge: 1 * 60 * 60 });

      return res.redirect(`${config.frontendUrl}/dashboard`);
    } catch (e) {
      return res.unauthorized('Token expirado o inválido');
    }
  });


  // Registro con Fusión Inteligente (Smart Merge)
  app.post('/register', {
    schema: { 
        summary: 'Register (with Smart Merge)', 
        body: { 
            type: 'object', 
            properties: { 
                email: { type: 'string' }, 
                password: { type: 'string' }, 
                name: { type: 'string' }, 
                whatsappPhone: { type: 'string' }, 
                language: { type: 'string' }, 
                birthDate: { type: 'string' } 
            } 
        }
    }
  }, async (req, res) => {
    // 1. Validar Inputs
    const RegisterSchema = z.object({ 
      email: z.string().email(), 
      password: z.string().min(6), 
      name: z.string().optional(),
      whatsappPhone: z.string().optional(), // Esperamos formato internacional, ej. +51999999999
      language: z.enum(['es', 'en', 'pt']).optional().default('es'),
      birthDate: z.string().optional() // Esperamos formato YYYY-MM-DD
    });

    const parse = RegisterSchema.safeParse(req.body);
    if (!parse.success) return res.badRequest('Datos inválidos: ' + JSON.stringify(parse.error.format()));
    let { email, password, name, whatsappPhone, language, birthDate } = parse.data;

    // Sanitize whatsappPhone: empty string should be null/undefined to avoid unique constraint violation
    // FIX: Check strictly for string type, as "" is falsy and skipped the previous check
    if (typeof whatsappPhone === 'string' && whatsappPhone.trim() === '') {
        whatsappPhone = undefined;
    }

    // 2. Verificar si el email ya existe
    const exists = await app.prisma.user.findUnique({ where: { email } });
    if (exists) return res.conflict('Este email ya está registrado. Por favor inicia sesión.');

    // 3. (Smart Merge desactivado por solicitud: NO vincular WhatsApp automáticamente)
    // El número ingresado se guardará solo como contacto en 'phoneNumber'.
    
    // 4. Hashear contraseña y código de verificación
    const hashed = await hashPassword(password);
    const code = generateCode();

    let user;
    const commonData = {
        name: name || email.split('@')[0],
        email,
        password: hashed,
        status: 'PENDING', // Requiere verificación de email
        verificationCode: code,
        verificationExpires: new Date(Date.now() + 1000 * 60 * 30), // 30 min
        language,
        birthDate: birthDate ? new Date(birthDate) : null,
        phoneNumber: whatsappPhone, // Guardamos como teléfono de contacto
        whatsappPhone: undefined    // No vinculamos automáticamente
    };

    // --- CREATE NEW USER ---
    try {
        user = await app.prisma.user.create({
            data: commonData
        });
        
        // Send TikTok Event
        TikTokService.sendEvent({
            eventName: 'CompleteRegistration',
            user: {
                email: user.email,
                phone: user.phoneNumber || user.whatsappPhone || undefined,
                ip: req.ip,
                userAgent: req.headers['user-agent'],
            }
        });
    } catch (err: any) {
        if (err.code === 'P2002') {
            return res.conflict('Este email ya está registrado.');
        }
        app.log.error(err, 'Error creating user');
        return res.internalServerError('Error al crear la cuenta. Por favor intente nuevamente.');
    }

    // 5. Enviar Email de Verificación (solo si NO hay Cognito configurado,
    //    ya que Cognito envía su propio código de verificación)
    if (!config.cognitoUserPoolId) {
      try {
          const emailLocale = language === 'en' ? 'en' : 'es';
          await sendVerificationEmail(app, email, code, { locale: emailLocale });
      } catch (err) {
          app.log.error(err);
      }
    }

    return res.status(201).send({ ok: true, message: 'Usuario registrado. Revisa tu email para verificar la cuenta.', userId: user.id, merged: false });
  });

  // Login sólo si email verificado
  app.post('/login', {
    schema: { summary: 'Login', body: { type: 'object', properties: { email: { type: 'string' }, password: { type: 'string' }, remember: { type: 'boolean' } } } }
  }, async (req, res) => {
    const parse = LoginBody.safeParse(req.body);
    if (!parse.success) return res.badRequest('Datos inválidos');
    const { email, password, remember } = parse.data;
    const user = await app.prisma.user.findUnique({ where: { email } });
    if (!user) return res.unauthorized('Credenciales inválidas');
    const ok = await verifyPassword(user.password, password);
    if (!ok) return res.unauthorized('Credenciales inválidas');
    if (!user.emailVerified) return res.forbidden('Cuenta no verificada');
    // Generate token
    const expiresIn = remember ? '30d' : '1d';
    const profile = await getOrCreateDefaultProfile(user.id, user.name || undefined);
    const token = app.jwt.sign({ sub: user.id, userId: user.id, profileId: profile.id, type: 'session' }, { expiresIn });
    const baseOpts = getCookieOpts(req);
    res.setCookie('session', token, { ...baseOpts, maxAge: remember ? 30 * 24 * 60 * 60 : 24 * 60 * 60 });

    return res.send({ ok: true, token, user: { id: user.id, email: user.email, name: user.name } });
  });

  // Verificar código
  app.post('/verify', { schema: { summary: 'Verify email by code' } }, async (req, res) => {
    const parse = VerifyBody.safeParse(req.body);
    if (!parse.success) return res.badRequest('Datos inválidos');
    const { email, code } = parse.data;
    const user = await app.prisma.user.findUnique({ where: { email } });
    if (!user || user.emailVerified !== false) return res.badRequest('Estado inválido');

    if (config.cognitoUserPoolId) {
      // Cognito ya verificó el código via confirmSignUp en el frontend
    } else {
      if (!user.verificationCode || !user.verificationExpires) return res.badRequest('No hay código activo');
      if (user.verificationCode !== code) return res.badRequest('Código inválido');
      if (user.verificationExpires.getTime() < Date.now()) return res.badRequest('Código expirado');
    }

    const updated = await app.prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, verificationCode: null, verificationExpires: null },
      select: { id: true, name: true },
    });
    const profile = await getOrCreateDefaultProfile(updated.id, updated.name || undefined);
    const token = app.jwt.sign({ sub: updated.id, userId: updated.id, profileId: profile.id, type: 'session' }, { expiresIn: '7d' });
    const baseOpts = getCookieOpts(req);
    res.setCookie('session', token, { ...baseOpts, maxAge: 7 * 24 * 60 * 60 });
    return res.send({ ok: true });
  });

  // Reenviar código
  app.post('/resend', { schema: { summary: 'Resend verification code' } }, async (req, res) => {
    const parse = ResendBody.safeParse(req.body);
    if (!parse.success) return res.badRequest('Datos inválidos');
    const { email } = parse.data;
    const user = await app.prisma.user.findUnique({ where: { email } });
    if (!user) return res.notFound('No existe');
    if (user.emailVerified) return res.badRequest('Ya verificado');

    if (!config.cognitoUserPoolId) {
      const code = generateCode();
      const expires = new Date(Date.now() + 15 * 60 * 1000);
      await app.prisma.user.update({ where: { id: user.id }, data: { verificationCode: code, verificationExpires: expires } });
      const locale = String((req.headers as any)['accept-language'] || '').toLowerCase().startsWith('en') ? 'en' : 'es';
      await sendVerificationEmail(app, email, code, { locale });
    }

    return res.send({ ok: true });
  });

  // Solicitar recuperación de contraseña
  app.post('/forgot', { schema: { summary: 'Forgot password (request reset code)' } }, async (req, res) => {
    const parse = ForgotBody.safeParse(req.body);
    if (!parse.success) return res.badRequest('Datos inválidos');
    const { email } = parse.data;
    const user = await app.prisma.user.findUnique({ where: { email } });
    // Responder siempre ok para no revelar existencia
    if (!user) {
      return res.send({ ok: true });
    }
    const code = generateCode();
    const expires = new Date(Date.now() + 15 * 60 * 1000);
    await app.prisma.user.update({ where: { id: user.id }, data: { resetCode: code, resetExpires: expires } });
    const locale = String((req.headers as any)['accept-language'] || '').toLowerCase().startsWith('en') ? 'en' : 'es';
    await sendPasswordResetEmail(app, email, code, { locale });
    return res.send({ ok: true });
  });

  // Restablecer contraseña con código
  app.post('/reset', { schema: { summary: 'Reset password by code' } }, async (req, res) => {
    const parse = ResetBody.safeParse(req.body);
    if (!parse.success) return res.badRequest('Datos inválidos');
    const { email, code, password } = parse.data;
    const user = await app.prisma.user.findUnique({ where: { email } });
    if (!user || !user.resetCode || !user.resetExpires) return res.badRequest('Código inválido');
    const now = Date.now();
    if (user.resetCode !== code) return res.badRequest('Código inválido');
    if (user.resetExpires.getTime() < now) return res.badRequest('Código expirado');
    const hashed = await hashPassword(password);
    const updated = await app.prisma.user.update({ where: { id: user.id }, data: { password: hashed, resetCode: null, resetExpires: null }, select: { id: true } });
    const token = app.jwt.sign({ sub: updated.id }, { expiresIn: '7d' });
    res.setCookie('session', token, getCookieOpts(req));
    return res.send({ ok: true });
  });

  // DEPRECATED: This endpoint is no longer used. Please use the checkout flow.
  app.post('/activate-free-trial', { schema: { summary: 'Activate 7 Day Free Trial', deprecated: true } }, async (req, res) => {
    return res.badRequest('Please use the checkout flow to activate your trial.');
  });

  app.post('/logout', { schema: { summary: 'Logout' } }, async (req, res) => {
    res.clearCookie('session', getCookieOpts(req));
    return res.send({ ok: true });
  });

  app.get('/me', { schema: { summary: 'Get current user' } }, async (req, res) => {
    const token = req.cookies.session;
    if (!token) {
      res.clearCookie('session', getCookieOpts(req));
      return res.unauthorized('No autenticado');
    }
    try {
      const payload = app.jwt.verify(token) as { sub: string, profileId?: string };                                                                                                                                                         
      const user = await app.prisma.user.findUnique({
         where: { id: payload.sub },
         select: { 
           id: true, email: true, name: true, role: true, plan: true, emailVerified: true, 
           trialEnds: true, planExpires: true, preferredCurrency: true, dateFormat: true, 
           tutorialSeen: true, whatsappPhone: true, phoneNumber: true, birthDate: true, 
           language: true, antExpenseLimit: true, antExpenseStreakAlert: true, 
           antExpenseCountAlert: true, antExpenseEnabled: true, notifyEmailExpenseWhatsApp: true, 
           notifyEmailExpenseTelegram: true, reportFrequency: true, extraEmailSlots: true,
           stripeCustomerId: true, extraProfileSlots: true,
           profiles: {
             select: { id: true, name: true, color: true, avatar: true, isDefault: true }
           }
         },
      });
      if (!user) return res.unauthorized('Usuario no encontrado');                                                                          

      const { profiles, ...userData } = user;
      const limits = await calculateProfileLimits(user.id, app.prisma, user);
      
      let currentProfileId = payload.profileId;
      if (currentProfileId && !profiles.some(p => p.id === currentProfileId)) {
          currentProfileId = undefined;
      }
      if (!currentProfileId && profiles.length > 0) {
          currentProfileId = (profiles.find(p => p.isDefault) || profiles[0]).id;
          const newToken = app.jwt.sign({ sub: user.id, userId: user.id, profileId: currentProfileId, type: 'session' }, { expiresIn: '7d' });
          res.setCookie('session', newToken, getCookieOpts(req));
      }

      return res.send({
        ok: true,
        user,
        profiles,
        currentProfileId,
        limits
      });
    } catch (err) {
      app.log.error(err, 'Token verification failed in /me');
      res.clearCookie('session', getCookieOpts(req));
      return res.unauthorized('Token inválido');
    }
  });

  const SwitchProfileBody = z.object({ profileId: z.string() });
  app.post('/switch-profile', { schema: { summary: 'Switch active profile' } }, async (req, res) => {
    const token = req.cookies.session;
    if (!token) return res.unauthorized('No autenticado');
    try {
      const payload = app.jwt.verify(token) as { sub: string };
      const userId = payload.sub;
      
      const parse = SwitchProfileBody.safeParse(req.body);
      if (!parse.success) return res.badRequest('ID de perfil inválido');
      const { profileId } = parse.data;

      const profile = await app.prisma.profile.findFirst({ where: { id: profileId, userId } });
      if (!profile) return res.forbidden('Perfil no encontrado o no autorizado');

      // Validar si el perfil está dentro del límite permitido
      const limits = await calculateProfileLimits(userId, app.prisma);
      
      // Obtener todos los perfiles ordenados por fecha de creación
      const allProfiles = await app.prisma.profile.findMany({
          where: { userId },
          orderBy: { createdAt: 'asc' },
          select: { id: true }
      });
      
      const profileIndex = allProfiles.findIndex(p => p.id === profileId);
      if (profileIndex >= limits.max) {
          return res.forbidden('Este perfil está bloqueado porque excediste el límite de perfiles de tu plan. Mejora tu plan o adquiere un slot extra para acceder.');
      }

      const newToken = app.jwt.sign({ sub: userId, userId, profileId: profile.id, type: 'session' }, { expiresIn: '7d' }); // Default to 7d or keep original expiration? 7d is fine for switch.
      res.setCookie('session', newToken, getCookieOpts(req));
      return res.send({ ok: true, currentProfileId: profile.id });
    } catch (err: any) {
      app.log.error(err, 'Token verification failed in /switch-profile');
      res.clearCookie('session', getCookieOpts(req));
      return res.unauthorized('Token inválido');
    }
  });

  const PrefsBody = z.object({
    preferredCurrency: z.enum(['PEN', 'USD', 'EUR']).optional(),
    dateFormat: z.enum(['DMY', 'MDY']).optional(),
    tutorialSeen: z.boolean().optional(),
    whatsappPhone: z.string().nullable().optional(),
    phoneNumber: z.string().nullable().optional(),
    birthDate: z.string().optional().nullable(),
    language: z.enum(['es', 'en', 'pt']).optional(),
    name: z.string().nullable().optional(),
    // Gastos Hormiga Config
    antExpenseLimit: z.number().optional(),
    antExpenseStreakAlert: z.number().nullable().optional(),
    antExpenseCountAlert: z.number().nullable().optional(),
    antExpenseEnabled: z.boolean().optional(),
    // Notificaciones y Reportes
    notifyEmailExpenseWhatsApp: z.boolean().optional(),
    notifyEmailExpenseTelegram: z.boolean().optional(),
    reportFrequency: z.enum(['OFF', 'DAILY', 'WEEKLY', 'MONTHLY']).optional(),
    onboardingData: z.any().optional(),
  });
  app.patch('/preferences', { schema: { summary: 'Actualizar preferencias de usuario' } }, async (req, res) => {
    const token = req.cookies.session;
    if (!token) return res.unauthorized('No autenticado');
    let userId: string;
    try {
      const payload = app.jwt.verify(token) as { sub: string };
      userId = payload.sub;
    } catch (err: any) { 
      app.log.error(err, 'Token verification failed in /preferences');
      res.clearCookie('session', getCookieOpts(req));
      return res.unauthorized('Token inválido'); 
    }
    const parse = PrefsBody.safeParse(req.body);
    if (!parse.success) {
      console.log('Validation failed for payload:', req.body);
      console.log('Zod error:', parse.error);
      return res.badRequest('Datos inválidos');
    }
    const data: any = {};
    if (parse.data.preferredCurrency) data.preferredCurrency = parse.data.preferredCurrency;
    if (parse.data.dateFormat) data.dateFormat = parse.data.dateFormat;
    if (parse.data.tutorialSeen !== undefined) data.tutorialSeen = parse.data.tutorialSeen;
    if (parse.data.whatsappPhone !== undefined) data.whatsappPhone = parse.data.whatsappPhone;
    if (parse.data.phoneNumber !== undefined) data.phoneNumber = parse.data.phoneNumber;
    if (parse.data.birthDate !== undefined) {
      data.birthDate = parse.data.birthDate ? new Date(parse.data.birthDate) : null;
    }
    if (parse.data.language) data.language = parse.data.language;
    if (parse.data.name !== undefined) data.name = parse.data.name;

    // Gastos Hormiga
    if (parse.data.antExpenseLimit !== undefined) data.antExpenseLimit = parse.data.antExpenseLimit;
    if (parse.data.antExpenseStreakAlert !== undefined) data.antExpenseStreakAlert = parse.data.antExpenseStreakAlert;
    if (parse.data.antExpenseCountAlert !== undefined) data.antExpenseCountAlert = parse.data.antExpenseCountAlert;
    if (parse.data.antExpenseEnabled !== undefined) data.antExpenseEnabled = parse.data.antExpenseEnabled;
    
    // Notificaciones y Reportes
    if (parse.data.notifyEmailExpenseWhatsApp !== undefined) data.notifyEmailExpenseWhatsApp = parse.data.notifyEmailExpenseWhatsApp;
    if (parse.data.notifyEmailExpenseTelegram !== undefined) data.notifyEmailExpenseTelegram = parse.data.notifyEmailExpenseTelegram;
    if (parse.data.reportFrequency !== undefined) data.reportFrequency = parse.data.reportFrequency;

    if (parse.data.onboardingData !== undefined) data.onboardingData = parse.data.onboardingData;
    
    if (Object.keys(data).length === 0) return res.badRequest('Sin cambios');
    const updated = await app.prisma.user.update({ 
      where: { id: userId }, 
      data, 
      select: { id: true, preferredCurrency: true, dateFormat: true, tutorialSeen: true, whatsappPhone: true, phoneNumber: true, birthDate: true, language: true, name: true, antExpenseLimit: true, antExpenseStreakAlert: true, antExpenseCountAlert: true, antExpenseEnabled: true, onboardingData: true, notifyEmailExpenseWhatsApp: true, notifyEmailExpenseTelegram: true, reportFrequency: true }
    });
    return res.send({ ok: true, user: updated });
  });

  // Callback de Google OAuth2
  app.get('/google/callback', { schema: { summary: 'Google OAuth callback' } }, async (req, res) => {
    try {
      const q = (req.query || {}) as any;
      const code = String(q.code || '');
      if (!code) return res.badRequest('Código inválido');
      const callbackUri = (process.env.GOOGLE_CALLBACK_URL || `${config.backendPublicUrl}/api/auth/google/callback`).trim();
      const form = new URLSearchParams();
      form.set('code', code);
      form.set('client_id', String(process.env.GOOGLE_CLIENT_ID || ''));
      form.set('client_secret', String(process.env.GOOGLE_CLIENT_SECRET || ''));
      form.set('redirect_uri', callbackUri);
      form.set('grant_type', 'authorization_code');
      const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });
      const tokenJson: any = await tokenResp.json().catch(() => ({}));
      let accessToken: string | undefined = tokenJson?.access_token;
      let uinfo: any = {};
      if (accessToken) {
        const uinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } });
        uinfo = await uinfoRes.json().catch(() => ({}));
      } else {
        const idToken: string | undefined = tokenJson?.id_token;
        if (!idToken) return res.badRequest('Token inválido');
        const parts = idToken.split('.');
        if (parts.length === 3) {
          const payloadJson = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
          try { uinfo = JSON.parse(payloadJson); } catch { uinfo = {}; }
        }
      }
      const email = String(uinfo?.email || '').toLowerCase();
      const googleId = String(uinfo?.sub || '');
      const emailVerified = Boolean(uinfo?.email_verified);
      if (!email || !googleId) return res.badRequest('Perfil de Google incompleto');

      let user = await app.prisma.user.findFirst({ where: { OR: [{ googleId }, { email }] } });
      if (!user) {
        const randomPass = await hashPassword('oauth-google:' + crypto.randomUUID());
        user = await app.prisma.user.create({
          data: {
            email,
            password: randomPass,
            name: uinfo?.name || undefined,
            role: email === config.adminEmail ? 'ADMIN' : 'USER',
            googleId,
            emailVerified: emailVerified || true,
            trialEnds: null,
          },
        });
      } else if (!user.googleId) {
        user = await app.prisma.user.update({ where: { id: user.id }, data: { googleId, emailVerified: emailVerified || user.emailVerified } });
      }

      const profile = await getOrCreateDefaultProfile(user.id, user.name || undefined);
      const jwtToken = generateSessionToken(user.id, profile.id, '7d');
      res.setCookie('session', jwtToken, {
        httpOnly: true,
        sameSite: 'none',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        domain: (config.cookieDomain || undefined) || undefined,
      });
      const dest = new URL('/pricing', config.frontendUrl).toString();
      res.redirect(dest);
    } catch (e) {
      app.log.error({ msg: 'Google OAuth error', error: String(e) });
      return res.internalServerError('OAuth error');
    }
  });

  // Get Data Counts for Reset
  app.get('/reset-data/counts', {
    schema: { summary: 'Get User Data Counts' }
  }, async (req, res) => {
     const auth = await requireAuth(app, req, res);
     if (!auth) return;
     const { userId } = auth;

     const [transactions, accounts, budgets, categories] = await Promise.all([
        app.prisma.expense.count({ where: { userId } }),
        app.prisma.paymentMethod.count({ where: { userId } }),
        app.prisma.budget.count({ where: { userId } }),
        app.prisma.category.count({ where: { userId } }),
     ]);

     return {
        transactions,
        accounts,
        budgets,
        categories,
        configurations: 1, // Always 1
     };
  });

  // Reset Data (Danger Zone)
  const ResetDataBody = z.object({
    transactions: z.boolean().optional(),
    accounts: z.boolean().optional(),
    budgets: z.boolean().optional(),
    categories: z.boolean().optional(),
    configurations: z.boolean().optional(),
  });

  app.post('/reset-data', {
    schema: {
        summary: 'Reset User Data',
        body: {
            type: 'object',
            properties: {
                transactions: { type: 'boolean' },
                accounts: { type: 'boolean' },
                budgets: { type: 'boolean' },
                categories: { type: 'boolean' },
                configurations: { type: 'boolean' },
            }
        }
    }
  }, async (req, res) => {
     const auth = await requireAuth(app, req, res);
     if (!auth) return;
     const { userId } = auth;
     const body = ResetDataBody.parse(req.body);

     if (body.transactions) {
        // Delete Expenses
        await app.prisma.expense.deleteMany({ where: { userId } });
        await app.prisma.document.deleteMany({ where: { userId } });
     }

     if (body.budgets) {
        await app.prisma.budget.deleteMany({ where: { userId } });
     }

     if (body.accounts) {
        // Payment Methods
        await app.prisma.income.deleteMany({ where: { userId } });
        await app.prisma.expense.updateMany({ where: { userId }, data: { paymentMethodId: null } });
        await app.prisma.paymentMethod.deleteMany({ where: { userId } });
     }

     if (body.categories) {
        // Custom categories only? 
        // We delete all categories belonging to this user.
        await app.prisma.category.deleteMany({ where: { userId } });
     }

     if (body.configurations) {
        // Reset user preferences
        await app.prisma.user.update({
            where: { id: userId },
            data: {
                preferredCurrency: 'PEN',
                dateFormat: 'DMY',
                antExpenseLimit: 50.0,
                antExpenseEnabled: true,
                language: 'es',
                // Keep name, email, plan, etc.
            }
        });
     }
     
     // Recurring not implemented yet
     
     return { ok: true };
  });
};