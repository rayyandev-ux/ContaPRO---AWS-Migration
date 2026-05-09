import type { FastifyPluginAsync } from 'fastify';
import { isEntitled } from '../utils/subscription.js';
import { requireAuth } from '../utils/auth.js';
import { getAmountNative } from '../utils/currency-helper.js';
import { CurrencyService } from '../services/currency.js';

export const statsRoutes: FastifyPluginAsync = async (app) => {

  // Sumas por categoría del mes dado (source: issued|created)
  app.get('/expenses/by-category', { schema: { summary: 'Gastos por categoría (mes)' } }, async (req, res) => {
    const auth = requireAuth(app, req, res);
    if (!auth) return;
    const { userId, profileId } = auth;
    const user = await app.prisma.user.findUnique({ where: { id: userId }, select: { plan: true, planExpires: true, trialEnds: true, preferredCurrency: true } });
    if (!isEntitled(user)) return res.paymentRequired('Suscripción requerida');
    
    const currencyService = new CurrencyService(app);
    const targetCurrency = user?.preferredCurrency || 'PEN';

    const now = new Date();
    const q = (req.query || {}) as Record<string, string>;
    const month = q.month ? Number(q.month) : now.getMonth() + 1;
    const year = q.year ? Number(q.year) : now.getFullYear();
    const source = (q.source || 'created').toLowerCase();
    const dateField = source === 'created' ? 'createdAt' : 'issuedAt';
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    const items = await app.prisma.expense.findMany({ where: { userId, profileId, [dateField]: { gte: start, lte: end } } as any, include: { category: true } });
    const map = new Map<string, number>();
    for (const it of items) {
      const key = it.category?.name || 'Sin categoría';
      const amount = await getAmountNative(it, targetCurrency, currencyService);
      map.set(key, (map.get(key) || 0) + amount);
    }
    const out = Array.from(map.entries()).map(([category, total]) => ({ category, total }));
    return res.send({ ok: true, items: out, month, year, currency: targetCurrency });
  });

  // Sumas por categoría del mes dado para INGRESOS
  app.get('/income/by-category', { schema: { summary: 'Ingresos por categoría (mes)' } }, async (req, res) => {
    const auth = requireAuth(app, req, res);
    if (!auth) return;
    const { userId, profileId } = auth;
    const user = await app.prisma.user.findUnique({ where: { id: userId }, select: { plan: true, planExpires: true, trialEnds: true, preferredCurrency: true } });
    if (!isEntitled(user)) return res.paymentRequired('Suscripción requerida');
    
    const currencyService = new CurrencyService(app);
    const targetCurrency = user?.preferredCurrency || 'PEN';

    const now = new Date();
    const q = (req.query || {}) as Record<string, string>;
    const month = q.month ? Number(q.month) : now.getMonth() + 1;
    const year = q.year ? Number(q.year) : now.getFullYear();
    
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    
    const items = await app.prisma.income.findMany({ 
      where: { userId, profileId, issuedAt: { gte: start, lte: end } } as any 
    });
    
    const map = new Map<string, number>();
    for (const it of items) {
      const key = it.category || 'Sin categoría';
      const amount = await getAmountNative(it, targetCurrency, currencyService);
      map.set(key, (map.get(key) || 0) + amount);
    }
    const out = Array.from(map.entries()).map(([category, total]) => ({ category, total }));
    return res.send({ ok: true, items: out, month, year, currency: targetCurrency });
  });

  // Sumas por mes del año dado (source: issued|created)
  app.get('/expenses/by-month', { schema: { summary: 'Gastos por mes (año)' } }, async (req, res) => {
    const auth = requireAuth(app, req, res);
    if (!auth) return;
    const { userId, profileId } = auth;
    const user = await app.prisma.user.findUnique({ where: { id: userId }, select: { plan: true, planExpires: true, trialEnds: true, preferredCurrency: true } });
    if (!isEntitled(user)) return res.paymentRequired('Suscripción requerida');
    
    const currencyService = new CurrencyService(app);
    const targetCurrency = user?.preferredCurrency || 'PEN';

    const now = new Date();
    const q = (req.query || {}) as Record<string, string>;
    const year = q.year ? Number(q.year) : now.getFullYear();
    const source = (q.source || 'created').toLowerCase();
    const dateField = source === 'created' ? 'createdAt' : 'issuedAt';
    const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
    const items = await app.prisma.expense.findMany({ where: { userId, profileId, [dateField]: { gte: start, lte: end } } as any });
    const arr = Array.from({ length: 12 }, () => 0);
    for (const it of items) {
      const m = new Date((it as any)[dateField]).getMonth();
      const amount = await getAmountNative(it, targetCurrency, currencyService);
      arr[m] += amount;
    }
    const out = arr.map((total, i) => ({ month: i + 1, total }));
    return res.send({ ok: true, items: out, year, source, currency: targetCurrency });
  });

  app.get('/budget/by-month', { schema: { summary: 'Presupuesto vs gasto vs ingresos por mes (año)' } }, async (req, res) => {
    const auth = requireAuth(app, req, res);
    if (!auth) return;
    const { userId, profileId } = auth;
    const user = await app.prisma.user.findUnique({ where: { id: userId }, select: { plan: true, planExpires: true, trialEnds: true, preferredCurrency: true } });
    if (!isEntitled(user)) return res.paymentRequired('Suscripción requerida');
    
    const now = new Date();
    const q = (req.query || {}) as Record<string, string>;
    const year = q.year ? Number(q.year) : now.getFullYear();
    const source = (q.source || 'created').toLowerCase();
    const dateField = source === 'created' ? 'createdAt' : 'issuedAt';
    const targetCurrency = user?.preferredCurrency || 'PEN';

    const startOfYear = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
    const endOfYear = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    // 1. Fetch all data for the year in parallel
    const [allBudgets, allExpenses, allIncomes] = await Promise.all([
      app.prisma.budget.findMany({ where: { userId, profileId, year, target: 'GENERAL' } }),
      app.prisma.expense.findMany({ where: { userId, profileId, [dateField]: { gte: startOfYear, lte: endOfYear } } as any }),
      app.prisma.income.findMany({ where: { userId, profileId, issuedAt: { gte: startOfYear, lte: endOfYear } } as any })
    ]);

    const currencyService = new CurrencyService(app);
    const out: Array<{ month: number; budget: number; spent: number; income: number; remaining: number; currency: string }> = [];

    // Pre-calculate totals per month in memory
    for (let m = 1; m <= 12; m++) {
      const monthBudgets = allBudgets.filter(b => b.month === m);
      const budgetAmount = monthBudgets.reduce((sum, b) => sum + b.amount, 0);
      const budgetCurrency = monthBudgets[0]?.currency || targetCurrency;

      // Filter expenses for this month
      const monthExpenses = allExpenses.filter(exp => {
        const d = new Date((exp as any)[dateField]);
        return d.getUTCMonth() + 1 === m;
      });

      let totalSpent = 0;
      for (const exp of monthExpenses) {
        totalSpent += await getAmountNative(exp, targetCurrency, currencyService);
      }

      // Filter incomes for this month
      const monthIncomes = allIncomes.filter(inc => {
        const d = new Date(inc.issuedAt);
        return d.getUTCMonth() + 1 === m;
      });

      let totalIncome = 0;
      for (const inc of monthIncomes) {
        totalIncome += await getAmountNative(inc, targetCurrency, currencyService);
      }

      out.push({
        month: m,
        budget: budgetAmount,
        spent: Number(totalSpent.toFixed(2)),
        income: Number(totalIncome.toFixed(2)),
        remaining: Number((budgetAmount - totalSpent).toFixed(2)),
        currency: budgetCurrency
      });
    }

    return res.send({ ok: true, items: out, year, source });
  });

  // Gasto acumulado diario del mes (source: issued|created)
  app.get('/expenses/daily-trend', { schema: { summary: 'Tendencia de gasto diario (mes actual)' } }, async (req, res) => {
    const auth = requireAuth(app, req, res);
    if (!auth) return;
    const { userId, profileId } = auth;
    const user = await app.prisma.user.findUnique({ where: { id: userId }, select: { plan: true, planExpires: true, trialEnds: true, preferredCurrency: true } });
    if (!isEntitled(user)) return res.paymentRequired('Suscripción requerida');
    
    const currencyService = new CurrencyService(app);
    const targetCurrency = user?.preferredCurrency || 'PEN';

    const now = new Date();
    const q = (req.query || {}) as Record<string, string>;
    const month = q.month ? Number(q.month) : now.getMonth() + 1;
    const year = q.year ? Number(q.year) : now.getFullYear();
    const source = (q.source || 'created').toLowerCase();
    const dateField = source === 'created' ? 'createdAt' : 'issuedAt';

    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    const daysInMonth = end.getDate();

    const items = await app.prisma.expense.findMany({ 
      where: { userId, profileId, [dateField]: { gte: start, lte: end } } as any,
      select: { [dateField]: true, amount: true, currency: true, amountNative: true, exchangeRate: true }
    });

    // Array de días (1..31)
    const dailyData = Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1, spent: 0, accumulated: 0 }));

    // Rellenar gasto por día
    for (const it of items) {
      const d = new Date((it as any)[dateField]).getDate();
      if (dailyData[d - 1]) {
        const amount = await getAmountNative(it as any, targetCurrency, currencyService);
        dailyData[d - 1].spent += amount;
      }
    }

    // Calcular acumulado
    let acc = 0;
    for (const day of dailyData) {
      acc += day.spent;
      day.accumulated = acc;
    }

    return res.send({ ok: true, items: dailyData, month, year, currency: targetCurrency });
  });
};