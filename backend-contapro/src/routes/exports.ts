import { FastifyPluginAsync } from 'fastify';
import { ExcelService } from '../services/excel.js';
import { prisma } from '../plugins/prisma.js';
import { isEntitled } from '../utils/subscription.js';
import { requireAuth } from '../utils/auth.js';
import { DailyReportJob } from '../jobs/DailyReportJob.js';
import { ImageGeneratorService } from '../services/image-generator.js';
import { z } from 'zod';

export const exportRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/monthly', {
    schema: {
      summary: 'Export monthly report',
      querystring: {
        type: 'object',
        required: ['month', 'year'],
        properties: {
          month: { type: 'string' },
          year: { type: 'string' }
        }
      }
    }
  }, async (req, reply) => {
    const auth = requireAuth(fastify, req, reply);
    if (!auth) return;
    const { userId } = auth;

    const query = req.query as { month: string, year: string };
    const month = parseInt(query.month, 10);
    const year = parseInt(query.year, 10);

    if (isNaN(month) || isNaN(year)) {
      return reply.badRequest('Mes o año inválido');
    }

    try {
      const user = await fastify.prisma.user.findUnique({ where: { id: userId } });
      if (!user) return reply.notFound('Usuario no encontrado');

      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999);

      const [expenses, incomes, budget, categoryBudgets, categories, paymentMethods, savingsGoals] = await Promise.all([
        fastify.prisma.expense.findMany({
          where: { userId, issuedAt: { gte: startDate, lte: endDate } },
          include: { category: true, paymentMethod: true },
          orderBy: { issuedAt: 'desc' }
        }),
        fastify.prisma.income.findMany({
          where: { userId, issuedAt: { gte: startDate, lte: endDate } },
          include: { paymentMethod: true },
          orderBy: { issuedAt: 'desc' }
        }),
        fastify.prisma.budget.findFirst({
          where: { userId, month, year, target: 'GENERAL' }
        }),
        fastify.prisma.budget.findMany({
          where: { userId, month, year, target: 'CATEGORY' },
          include: { category: true }
        }),
        fastify.prisma.category.findMany({ where: { userId } }),
        fastify.prisma.paymentMethod.findMany({ where: { userId } }),
        fastify.prisma.savingsGoal.findMany({ where: { userId } })
      ]);

      const buffer = await ExcelService.generateMonthlyReport({
        user,
        month,
        year,
        expenses,
        incomes,
        budget,
        categoryBudgets,
        categories,
        paymentMethods,
        savingsGoals
      });

      reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      reply.header('Content-Disposition', `attachment; filename="ContaPRO_${month}_${year}.xlsx"`);
      return reply.send(buffer);
    } catch (error) {
      fastify.log.error(error, 'Error al exportar reporte mensual');
      return reply.status(500).send({ error: 'Error al exportar el reporte', details: String(error) });
    }
  });

  fastify.post('/send-report', { schema: { summary: 'Send on-demand report to WhatsApp/Telegram' } }, async (req, reply) => {
    const auth = requireAuth(fastify, req, reply);
    if (!auth) return;
    const { userId } = auth;

    const BodySchema = z.object({
      frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY'])
    });

    const parse = BodySchema.safeParse(req.body);
    if (!parse.success) return reply.badRequest('Frecuencia inválida');
    const { frequency } = parse.data;

    try {
      const user = await fastify.prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) return reply.notFound('Usuario no encontrado');

      // Instanciar servicios necesarios
      const imageService = new ImageGeneratorService(fastify);
      const reportJob = new DailyReportJob(fastify);

      // 1. Recopilar datos (Lógica similar a DailyReportJob pero forzada por frecuencia)
      const today = new Date();
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);

      let startDate = startOfDay;
      if (frequency === 'WEEKLY') {
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 7);
      } else if (frequency === 'MONTHLY') {
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      }

      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
      const daysInMonth = endOfMonth.getDate();
      const currentDayOfMonth = today.getDate();

      const lastWeekStart = new Date(today);
      lastWeekStart.setDate(today.getDate() - 7);
      const prevWeekStart = new Date(today);
      prevWeekStart.setDate(today.getDate() - 14);

      const [expensesInPeriod, expensesMonth, incomesMonth, paymentMethods, budget, savingsGoals, expensesLastWeek, expensesPrevWeek, antExpensesMonth, pendingCount] = await Promise.all([
          fastify.prisma.expense.findMany({
              where: { userId, issuedAt: { gte: startDate, lte: endOfDay } },
              include: { category: true }
          }),
          fastify.prisma.expense.aggregate({
              where: { userId, issuedAt: { gte: startOfMonth, lte: endOfMonth } },
              _sum: { amount: true }
          }),
          fastify.prisma.income.aggregate({
              where: { userId, issuedAt: { gte: startOfMonth, lte: endOfMonth } },
              _sum: { amount: true }
          }),
          fastify.prisma.paymentMethod.findMany({
              where: { userId, active: true }
          }),
          fastify.prisma.budget.findFirst({
              where: { userId, year: today.getFullYear(), month: today.getMonth() + 1, target: 'GENERAL' }
          }),
          fastify.prisma.savingsGoal.findMany({
              where: { userId, status: 'ACTIVE' },
              orderBy: { updatedAt: 'desc' },
              take: 2
          }),
          fastify.prisma.expense.aggregate({
              where: { userId, issuedAt: { gte: lastWeekStart, lte: endOfDay } },
              _sum: { amount: true }
          }),
          fastify.prisma.expense.aggregate({
              where: { userId, issuedAt: { gte: prevWeekStart, lte: lastWeekStart } },
              _sum: { amount: true }
          }),
          fastify.prisma.expense.aggregate({
              where: { 
                  userId, 
                  issuedAt: { gte: startOfMonth, lte: endOfMonth },
                  amount: { lte: user.antExpenseLimit || 50.0 }
              },
              _sum: { amount: true },
              _count: true
          }),
          fastify.prisma.pendingExpense.count({
              where: { userId, status: 'WAITING_USER' }
          })
      ]);

      // 2. Procesar datos para la plantilla
      let periodTotal = 0;
      let highestExpense = null;
      const categoryMap: Record<string, number> = {};

      for (const exp of expensesInPeriod) {
          const amount = exp.amountNative ?? exp.amount;
          periodTotal += amount;
          if (!highestExpense || amount > highestExpense.amount) {
              highestExpense = { amount, category: exp.category?.name || 'Varios' };
          }
          const catName = exp.category?.name || 'Varios';
          categoryMap[catName] = (categoryMap[catName] || 0) + amount;
      }

      const categoriesList = Object.entries(categoryMap)
          .map(([name, amount]) => ({ name, amount, percentage: (amount / (periodTotal || 1)) * 100 }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 4);

      const totalBalance = paymentMethods.reduce((sum, pm) => sum + pm.balance, 0);
      const monthlyExpense = expensesMonth._sum.amount || 0;
      const monthlyIncome = incomesMonth._sum.amount || 0;
      const budgetAmount = budget?.amount || 0;
      const projectedExpense = (monthlyExpense / (currentDayOfMonth || 1)) * daysInMonth;
      
      const lastWeekTotal = expensesLastWeek._sum.amount || 0;
      const prevWeekTotal = expensesPrevWeek._sum.amount || 0;
      let weeklyComparison = 0;
      if (prevWeekTotal > 0) weeklyComparison = ((lastWeekTotal - prevWeekTotal) / prevWeekTotal) * 100;

      const reportData = {
          date: today.toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
          currency: user.preferredCurrency || 'PEN',
          totalAmount: periodTotal,
          highestExpense,
          categories: categoriesList,
          tip: (reportJob as any).getDailyTip(highestExpense?.category || '', periodTotal),
          totalBalance,
          monthlyExpense,
          monthlyIncome,
          budgetAmount,
          savingsGoals: savingsGoals.map(g => ({
              name: g.name,
              current: g.currentAmount,
              target: g.targetAmount,
              percentage: (g.currentAmount / (g.targetAmount || 1)) * 100
          })),
          projectedExpense,
          weeklyComparison,
          antTotal: antExpensesMonth._sum.amount || 0,
          antCount: antExpensesMonth._count || 0,
          pendingCount
      };

      // 3. Generar Imagen
      const imageBuffer = await imageService.generateDailySummaryImage(reportData);

      // 4. Enviar por canales configurados
      const freqLabel = frequency === 'DAILY' ? 'diario' : frequency === 'WEEKLY' ? 'semanal' : 'mensual';
      const greeting = `¡Hola ${user.name ? user.name.split(' ')[0] : ''}! 📊 Aquí tienes el reporte *${freqLabel}* que solicitaste.`;
      
      let sent = false;

      // WhatsApp
      if (user.whatsappPhone && user.notifyEmailExpenseWhatsApp !== false) {
        try {
          await reportJob.sendWhatsAppImage(user.whatsappPhone, imageBuffer, greeting);
          sent = true;
        } catch (e) {
          fastify.log.error({ msg: 'Failed to send manual WA report', userId, error: e });
        }
      }

      // Telegram
      if (user.telegramId) {
        const tg = (fastify as any).telegram;
        if (tg) {
          try {
            await tg.sendPhoto(user.telegramId, imageBuffer, greeting);
            sent = true;
          } catch (e) {
            fastify.log.error({ msg: 'Failed to send manual TG report', userId, error: e });
          }
        }
      }

      if (!sent) return reply.badRequest('No se pudo enviar el reporte por ningún medio (verifica tus conexiones de WhatsApp/Telegram)');

      return reply.send({ success: true, message: `Reporte ${freqLabel} enviado con éxito` });

    } catch (error) {
      fastify.log.error(error, 'Error sending on-demand report');
      return reply.status(500).send({ error: 'Error al enviar el reporte', details: String(error) });
    }
  });
}
