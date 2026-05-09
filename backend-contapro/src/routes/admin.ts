import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getCookieOpts } from '../utils/auth.js';

export const adminRoutes: FastifyPluginAsync = async (app) => {
  // Middleware to ensure admin
  app.addHook('preHandler', async (req, res) => {
    const token = req.cookies.session;
    if (!token) {
      res.clearCookie('session', getCookieOpts(req));
      return res.unauthorized('No autenticado');
    }
    try {
      const payload = app.jwt.verify(token) as { sub: string };
      const user = await app.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || user.role !== 'ADMIN') return res.forbidden('Requiere permisos de administrador');
      (req as any).user = user;
    } catch {
      res.clearCookie('session', getCookieOpts(req));
      return res.unauthorized('Token inválido');
    }
  });

  // KPI Stats for Dashboard
  app.get('/stats/kpi', async (req, res) => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Total Users
    const totalUsers = await app.prisma.user.count();
    
    // New Users this month
    const newUsers = await app.prisma.user.count({
      where: { createdAt: { gte: startOfMonth } }
    });

    // Premium Users (Plan = PREMIUM or LIFETIME or active trial)
    const premiumUsers = await app.prisma.user.count({
      where: {
        OR: [
          { plan: 'PREMIUM' },
          { plan: 'LIFETIME' },
          { trialEnds: { gt: now } }
        ]
      }
    });

    // Total Expenses Processed (Total count of expenses)
    const totalExpenses = await app.prisma.expense.count();

    // Recent Payments (Last 5)
    const recentPayments = await app.prisma.payment.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { email: true, name: true } } }
    });

    return {
      totalUsers,
      newUsers,
      premiumUsers,
      totalExpenses,
      recentPayments
    };
  });

  // Users Management
  app.get('/users', async (req, res) => {
    const query = (req.query as any) || {};
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const search = query.search ? String(query.search) : undefined;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [total, users] = await Promise.all([
      app.prisma.user.count({ where }),
      app.prisma.user.findMany({
        where,
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            plan: true,
            createdAt: true,
            trialEnds: true,
            planExpires: true,
            emailVerified: true,
            whatsappPhone: true,
        }
      })
    ]);

    return { ok: true, users, total, page, pages: Math.ceil(total / limit) };
  });

  // Promote/Demote User or Change Plan
  const UpdateUserBody = z.object({
    role: z.enum(['USER', 'ADMIN']).optional(),
    plan: z.enum(['FREE', 'PREMIUM', 'LIFETIME']).optional(),
    planExpires: z.string().optional(), // ISO Date string or null
  });

  app.patch('/users/:id', async (req, res) => {
    const { id } = req.params as { id: string };
    const parse = UpdateUserBody.safeParse(req.body);
    if (!parse.success) return res.badRequest('Datos inválidos');
    
    const data: any = {};
    if (parse.data.role) data.role = parse.data.role;
    if (parse.data.plan) data.plan = parse.data.plan;
    if (parse.data.planExpires !== undefined) {
        data.planExpires = parse.data.planExpires ? new Date(parse.data.planExpires) : null;
    }

    const updated = await app.prisma.user.update({
        where: { id },
        data
    });

    return { ok: true, user: updated };
  });

  // Delete User
  app.delete('/users/:id', async (req, res) => {
    const { id } = req.params as { id: string };
    await app.prisma.user.delete({ where: { id } });
    return { ok: true };
  });

  // Pause Access (Downgrade to FREE & Unlink Email)
  app.post('/users/:id/pause', async (req, res) => {
      const { id } = req.params as { id: string };
      // 1. Update plan to FREE
      await app.prisma.user.update({
          where: { id },
          data: {
              plan: 'FREE',
              planExpires: null,
          }
      });
      // 2. Delete EmailIntegrations
      await app.prisma.emailIntegration.deleteMany({
          where: { userId: id }
      });
      return { ok: true, message: "Acceso pausado y correo desvinculado" };
  });

  // Impersonate User (Master Access)
  app.post('/users/:id/impersonate', async (req, res) => {
      const { id } = req.params as { id: string };
      const user = await app.prisma.user.findUnique({ where: { id } });
      if (!user) return res.notFound('Usuario no encontrado');

      let profile = await app.prisma.profile.findFirst({ where: { userId: id, isDefault: true } });
      if (!profile) {
         profile = await app.prisma.profile.create({
            data: { userId: id, name: user.name || 'Mi Perfil', isDefault: true, color: '#7c3aed', avatar: 'default' }
         });
      }

      const token = app.jwt.sign(
         { sub: id, userId: id, profileId: profile.id, type: 'session' },
         { expiresIn: '1h' }
      );

      return { ok: true, token };
  });

  // Subscriptions List
  app.get('/subscriptions', async (req, res) => {
     // Fetch users with active plans or trials
     const activeSubs = await app.prisma.user.findMany({
        where: {
            OR: [
                { plan: 'PREMIUM' },
                { plan: 'LIFETIME' },
                { trialEnds: { gt: new Date() } }
            ]
        },
        select: {
            id: true,
            email: true,
            name: true,
            plan: true,
            planExpires: true,
            trialEnds: true,
            stripeSubscriptionId: true
        },
        orderBy: { planExpires: 'desc' }
     });

     return { ok: true, subscriptions: activeSubs };
  });

  // Coupons Management
  app.get('/coupons', async (req, res) => {
    const coupons = await app.prisma.coupon.findMany({
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { redemptions: true } } }
    });
    return { ok: true, coupons };
  });

  const CreateCouponBody = z.object({
    code: z.string().min(3).max(20),
    days: z.number().min(1),
    maxUses: z.number().optional(), // 0 or null = unlimited
    expiresAt: z.string().optional()
  });

  app.post('/coupons', async (req, res) => {
    const parse = CreateCouponBody.safeParse(req.body);
    if (!parse.success) return res.badRequest('Datos inválidos');
    
    const { code, days, maxUses, expiresAt } = parse.data;
    const existing = await app.prisma.coupon.findUnique({ where: { code } });
    if (existing) return res.badRequest('El código ya existe');

    const coupon = await app.prisma.coupon.create({
        data: {
            code,
            days,
            maxUses: maxUses || null,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
        }
    });

    return { ok: true, coupon };
  });

  app.delete('/coupons/:id', async (req, res) => {
      const { id } = req.params as { id: string };
      await app.prisma.coupon.delete({ where: { id } });
      return { ok: true };
  });
};
