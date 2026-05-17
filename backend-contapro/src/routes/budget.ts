import type { FastifyPluginAsync, FastifyInstance } from 'fastify';
import { z } from 'zod';
import { isEntitled } from '../utils/subscription.js';
import { requireAuth } from '../utils/auth.js';
import { fixUtf8Mojibake } from '../utils/format.js';
import { publishEvent } from '../services/realtime.js';

import { getAmountNative } from '../utils/currency-helper.js';
import { CurrencyService } from '../services/currency.js';

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

// Utilidad auxiliar de gasto para presupuesto
async function calculateSpent(app: FastifyInstance, whereClause: any, targetCurrency: string) {
  const expenses = await app.prisma.expense.findMany({ 
    where: whereClause as any,
    select: { amount: true, currency: true, amountNative: true, exchangeRate: true }
  });
  
  const currencyService = new CurrencyService(app);
  let total = 0;
  for (const exp of expenses) {
    total += await getAmountNative(exp, targetCurrency, currencyService);
  }
  return total;
}

// Reemplazo del creador automático de presupuesto General
export async function ensureBudgetForUserMonth(app: FastifyInstance, userId: string, profileId: string, year: number, month: number, notify: boolean = true) {
  const user = await app.prisma.user.findUnique({ where: { id: userId }, select: { preferredCurrency: true } });
  const b = await app.prisma.budget.create({
    data: { userId, profileId, year, month, amount: 0, target: 'GENERAL', currency: user?.preferredCurrency || 'PEN', name: 'Presupuesto General', alertThreshold: 0.8 }
  });
  await app.prisma.budgetLog.create({
    data: { budgetId: b.id, userId, profileId, previousTotal: 0, newTotal: 0, amount: 0, reason: 'Definición inicial automática', type: 'INITIAL' }
  });
  return b;
}

const SetBudgetBody = z.object({
  target: z.enum(['GENERAL', 'CATEGORY']).default('GENERAL'),
  categoryId: z.string().optional().nullable(),
  month: z.number().min(1).max(12),
  year: z.number().min(2000).max(3000),
  amount: z.number().min(0).optional(),
  currency: z.string().default('PEN').optional(),
  alertThreshold: z.number().min(0).optional(),
  name: z.string().optional(),
});

const AdjustBudgetBody = z.object({
  month: z.number().min(1).max(12),
  year: z.number().min(2000).max(3000),
  adjustment: z.number(),
  reason: z.string().min(1),
});

export async function checkBudgetAlertAfterExpense(app: FastifyInstance, userId: string, profileId: string, issuedAt: Date, amountNative: number, categoryId?: string) {
  const month = issuedAt.getMonth() + 1;
  const year = issuedAt.getFullYear();
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  
  // GENERAL BUDGET ALERT
  const generalBudget = await app.prisma.budget.findFirst({ where: { userId, profileId, year, month, target: 'GENERAL' as any } });
  if (generalBudget && generalBudget.amount > 0 && generalBudget.alertThreshold) {
    const generalWhere = { userId, profileId, issuedAt: { gte: start, lte: end } };
    const spent = await calculateSpent(app, generalWhere, generalBudget.currency);
    
    if (spent >= generalBudget.amount * generalBudget.alertThreshold) {
      const type = spent >= generalBudget.amount ? 'EXCEEDED' : 'WARNING';
      const tg: any = (app as any).telegram;
      if (tg) tg.sendBudgetAlert(userId, 'GENERAL', 'Presupuesto General', generalBudget.amount, spent, generalBudget.currency, type, generalBudget.alertThreshold);
    }
  }

  // CATEGORY BUDGET ALERT
  if (categoryId) {
    const catBudget = await app.prisma.budget.findFirst({ 
      where: { 
        userId, 
        profileId, 
        year, 
        month, 
        target: 'CATEGORY' as any, 
        categoryId 
      }, 
      include: { category: true } 
    });
    
    if (catBudget && catBudget.amount > 0) {
      const threshold = catBudget.alertThreshold || 0.8;
      const catWhere = { userId, profileId, categoryId, issuedAt: { gte: start, lte: end } };
      const catSpent = await calculateSpent(app, catWhere, catBudget.currency);
      
      if (catSpent >= catBudget.amount * threshold) {
        const type = catSpent >= catBudget.amount ? 'EXCEEDED' : 'WARNING';
        const tg: any = (app as any).telegram;
        if (tg) tg.sendBudgetAlert(userId, 'CATEGORY', catBudget.category?.name || 'Categoría', catBudget.amount, catSpent, catBudget.currency, type, threshold);
      }
    }
  }
}

export const budgetRoutes: FastifyPluginAsync = async (app) => {

  app.addHook('onRequest', async (req, res) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return res.unauthorized('No autenticado');
    (req as any).userAuth = auth;
    
    const user = await app.prisma.user.findUnique({ 
        where: { id: auth.userId }, 
        select: { plan: true, planExpires: true, trialEnds: true, stripeSubscriptionId: true, preferredCurrency: true } 
    });
    if (!isEntitled(user)) return res.paymentRequired('Suscripción requerida para usar presupuestos');
    (req as any).userData = user;
  });

  app.get('/', { schema: { summary: 'Get Unified Budget Dashboard' } }, async (req, res) => {
    try {
      const { userId, profileId } = (req as any).userAuth;
      const q = (req.query || {}) as Record<string, string>;
      const now = new Date();
      const month = q.month ? Number(q.month) : now.getMonth() + 1;
      const year = q.year ? Number(q.year) : now.getFullYear();
      const autocreate = String(q.autocreate || '').trim() === '1';
      const source = (q.source || 'created').toLowerCase();
      const dateField = source === 'created' ? 'createdAt' : 'issuedAt';
      
      const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
      const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

      // 1. Calcular Saldo Total (Nuevo Modelo de Presupuesto)
      const paymentMethods = await app.prisma.paymentMethod.findMany({
        where: { userId, profileId, active: true }
      });

      const user = (req as any).userData;
      const targetCurrency = user?.preferredCurrency || 'PEN';
      
      // Import CurrencyService for calculation
      const { CurrencyService } = await import('../services/currency.js');
      const currencyService = new CurrencyService(app);

      let totalBalanceNative = 0;
      for (const pm of paymentMethods) {
          if (pm.balance === 0) continue;
          if (pm.currency === targetCurrency) {
              totalBalanceNative += pm.balance;
          } else {
              const { amount: native } = await currencyService.convert(pm.balance, pm.currency, targetCurrency);
              totalBalanceNative += native;
          }
      }

      // Mock a budget object for the frontend to maintain compatibility
      const generalBudget = {
          amount: round2(totalBalanceNative),
          currency: targetCurrency,
          name: 'Saldo Total Disponible',
          alertThreshold: 0.8
      };

      const generalWhereBase = { userId, profileId, [dateField]: { gte: start, lte: end } };
      const generalSpent = await calculateSpent(app, generalWhereBase, targetCurrency);

      // 2. Obtener Categorías Asignadas (Sobres)
      const budgets = await app.prisma.budget.findMany({ 
          where: { userId, profileId, year, month, target: 'CATEGORY' as any },
          include: { category: true }
      });
      
      const categorySpentMap = new Map<string, number>();
      const validCategoryIds = budgets.map(b => b.categoryId).filter(Boolean) as string[];
      
      if (validCategoryIds.length > 0) {
          const expenses = await app.prisma.expense.findMany({
              where: { ...generalWhereBase, categoryId: { in: validCategoryIds } } as any,
              select: { categoryId: true, amount: true, currency: true, amountNative: true, exchangeRate: true }
          });

          for (const e of expenses) {
              if (e.categoryId) {
                  const amt = await getAmountNative(e, targetCurrency, currencyService);
                  categorySpentMap.set(e.categoryId, (categorySpentMap.get(e.categoryId) || 0) + amt);
              }
          }
      }

      const assignedCategories = budgets.map(b => {
          const spent = categorySpentMap.get(b.categoryId as string) || 0;
          return {
              id: b.id,
              categoryId: b.categoryId,
              categoryName: b.category ? fixUtf8Mojibake(b.category.name) : 'Sin Nombre',
              amount: b.amount,
              currency: b.currency,
              alertThreshold: b.alertThreshold,
              spent,
              remaining: round2(b.amount - spent)
          };
      });

      const sumAssigned = assignedCategories.reduce((acc, curr) => acc + curr.amount, 0);
      const unallocatedBudget = round2((generalBudget?.amount ?? 0) - sumAssigned);

      return res.send({ 
        ok: true, 
        budget: generalBudget, 
        spent: generalSpent, 
        remaining: round2((generalBudget?.amount ?? 0) - generalSpent),
        unallocatedBudget,
        categories: assignedCategories
      });
    } catch (error) {
      console.error('[Budget] GET / error:', error);
      return res.internalServerError('Error obteniendo presupuesto unificado');
    }
  });

  app.post('/', { schema: { summary: 'Set/update budget' } }, async (req, res) => {
    const { userId, profileId } = (req as any).userAuth;
    const bodyArgs = SetBudgetBody.safeParse(req.body);
    if (!bodyArgs.success) return res.badRequest('Datos inválidos');
    
    const { month, year, amount, currency, alertThreshold, name, target, categoryId } = bodyArgs.data;
    const isCurrentMonth = (month === (new Date().getMonth() + 1)) && (year === new Date().getFullYear());

    try {
      if (target === 'CATEGORY' && !categoryId) {
          return res.badRequest('categoryId es requerido para target CATEGORY');
      }

      const filter: any = { userId, profileId, month, year, target: target as any };
      if (target === 'CATEGORY') filter.categoryId = categoryId;

      const existing = await app.prisma.budget.findFirst({ where: filter });

      if (target === 'GENERAL' && amount !== undefined) {
          return res.badRequest('El presupuesto general ahora se deriva de tus saldos reales. Para ajustarlo, registra un Ingreso o Gasto.');
      }

      if (!existing) {
        if (!isCurrentMonth) return res.forbidden('Sólo puedes configurar el presupuesto del mes actual');
        if (amount === undefined) return res.badRequest('amount requerido');
        
        const created = await app.prisma.$transaction(async (tx) => {
            const b = await tx.budget.create({ 
                data: { 
                    userId, profileId, month, year, amount, target, categoryId,
                    currency: currency ?? (req as any).userData?.preferredCurrency ?? 'PEN', 
                    alertThreshold, name 
                } 
            });
            await tx.budgetLog.create({
                data: { budgetId: b.id, userId, profileId, amount, previousTotal: 0, newTotal: amount, reason: 'Definición inicial', type: 'INITIAL' }
            });
            return b;
        });
        publishEvent(userId, { type: 'MUTATION', entity: 'BUDGET', action: 'CREATE' }).catch(console.error);
        return res.send({ ok: true, budget: created });
      }

      const data: any = {};
      if (amount !== undefined) {
         if (target === 'GENERAL' && existing.amount > 0) return res.badRequest('Usa /adjust para el General');
         data.amount = amount;
      }
      if (currency !== undefined) data.currency = currency;
      if (alertThreshold !== undefined) data.alertThreshold = alertThreshold;
      if (name !== undefined) data.name = name;

      if (Object.keys(data).length > 0) {
        const updated = await app.prisma.$transaction(async (tx) => {
            const b = await tx.budget.update({ where: { id: existing.id }, data });
            if (data.amount !== undefined) {
                await tx.budgetLog.create({
                    data: { budgetId: b.id, userId, profileId, amount: data.amount, previousTotal: existing.amount, newTotal: data.amount, reason: 'Actualización manual', type: 'INCREASE' }
                });
            }
            return b;
        });
        publishEvent(userId, { type: 'MUTATION', entity: 'BUDGET', action: 'UPDATE' }).catch(console.error);
        return res.send({ ok: true, budget: updated });
      }

      return res.send({ ok: true, budget: existing });
    } catch (error) {
        console.error('[Budget] POST / error:', error);
        return res.internalServerError('Error procesando request');
    }
  });

  app.post('/adjust', { schema: { summary: 'Adjust general budget' } }, async (req, res) => {
    return res.badRequest('Esta función ha sido reemplazada por el Registro de Ingresos/Gastos.');
  });

  app.delete('/', { schema: { summary: 'Delete budget allocation' } }, async (req, res) => {
    const { userId, profileId } = (req as any).userAuth;
    const q: any = req.query || {};
    const target = String(q.target || 'CATEGORY');
    if (target === 'GENERAL') return res.badRequest('El presupuesto general no se puede borrar, solo ajustar');

    const categoryId = q.categoryId;
    const month = Number(q.month);
    const year = Number(q.year);

    const budget = await app.prisma.budget.findFirst({ where: { userId, profileId, month, year, target: target as any, categoryId } });
    if (!budget) return res.send({ ok: true });

    await app.prisma.budget.delete({ where: { id: budget.id } });
    publishEvent(userId, { type: 'MUTATION', entity: 'BUDGET', action: 'DELETE' }).catch(console.error);
    return res.send({ ok: true });
  });

  app.get('/logs', { schema: { summary: 'Get budget history logs' } }, async (req, res) => {
    const { userId, profileId } = (req as any).userAuth;
    const q = (req.query || {}) as Record<string, string>;
    const month = Number(q.month);
    const year = Number(q.year);
    
    const budget = await app.prisma.budget.findFirst({ where: { userId, profileId, year, month, target: 'GENERAL' as any } });
    if (!budget) return res.send({ ok: true, logs: [] });

    const logs = await app.prisma.budgetLog.findMany({ where: { budgetId: budget.id }, orderBy: { createdAt: 'desc' } });
    return res.send({ ok: true, logs });
  });
};
