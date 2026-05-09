import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { isEntitled } from '../utils/subscription.js';
import { requireAuth } from '../utils/auth.js';

export const savingsRoutes: FastifyPluginAsync = async (app) => {
  const CreateGoalBody = z.object({
    name: z.string().min(1),
    targetAmount: z.number().min(0.01),
    currency: z.string().default('PEN'),
    deadline: z.string().optional(), // ISO date
    icon: z.string().optional(),
    color: z.string().optional(),
  });

  const TransactionBody = z.object({
    amount: z.number(), // Positive or negative
    type: z.enum(['MANUAL_DEPOSIT', 'BUDGET_SURPLUS', 'WITHDRAWAL']),
    description: z.string().optional(),
    // New optional fields for spending from savings
    createExpense: z.boolean().optional(),
    categoryId: z.string().optional(),
    expenseDate: z.string().optional(), // ISO string
  });

  app.get('/goals', { schema: { summary: 'List savings goals' } }, async (req, res) => {
    const auth = requireAuth(app, req, res);
    if (!auth) return;
    const { userId, profileId } = auth;

    const goals = await app.prisma.savingsGoal.findMany({
      where: { userId, profileId, status: { not: 'ARCHIVED' } },
      orderBy: { createdAt: 'desc' },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    });

    return res.send({ ok: true, goals });
  });

  // CREATE GOAL
  app.post('/goals', async (req, res) => {
    const auth = requireAuth(app, req, res);
    if (!auth) return;
    const { userId, profileId } = auth;
    
    // Check subscription
    const user = await app.prisma.user.findUnique({ where: { id: userId }, select: { plan: true, planExpires: true, trialEnds: true, stripeSubscriptionId: true } });
    if (!isEntitled(user)) return res.paymentRequired('Suscripción requerida');

    const body = CreateGoalBody.parse(req.body);

    const goal = await app.prisma.savingsGoal.create({
      data: {
        userId,
        profileId,
        name: body.name,
        targetAmount: body.targetAmount,
        currency: body.currency,
        deadline: body.deadline ? new Date(body.deadline) : null,
        icon: body.icon,
        color: body.color,
      }
    });

    return res.send({ ok: true, goal });
  });

  // GET GOAL DETAILS
  app.get('/goals/:id', async (req, res) => {
    const auth = requireAuth(app, req, res);
    if (!auth) return;
    const { userId, profileId } = auth;
    const { id } = req.params as { id: string };

    const goal = await app.prisma.savingsGoal.findFirst({
      where: { id, userId, profileId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!goal) return res.notFound('Meta no encontrada');
    return res.send({ ok: true, goal });
  });

  // ADD TRANSACTION (DEPOSIT/WITHDRAW)
  app.post('/goals/:id/transactions', async (req, res) => {
    const auth = requireAuth(app, req, res);
    if (!auth) return;
    const { userId, profileId } = auth;
    const { id } = req.params as { id: string };
    const body = TransactionBody.parse(req.body);

    const goal = await app.prisma.savingsGoal.findFirst({ where: { id, userId, profileId } });
    if (!goal) return res.notFound('Meta no encontrada');

    // Create transaction
    const tx = await app.prisma.savingsTransaction.create({
      data: {
        goalId: id,
        amount: body.amount,
        type: body.type,
        description: body.description || (body.amount > 0 ? 'Depósito' : 'Retiro'),
      }
    });

    // Handle Spend from Savings (create expense)
    if (body.type === 'WITHDRAWAL' && body.createExpense) {
      // For withdrawals, amount is negative in body? 
      // The frontend sends positive amount for DEPOSIT and negative for WITHDRAWAL in 'amount' field usually?
      // Wait, let's verify frontend logic again. 
      // Frontend: finalAmount = isDeposit ? amount : -amount;
      // So withdrawal has negative amount.
      // Expense amount should be positive.
      const expenseAmount = Math.abs(body.amount);
      
      await app.prisma.expense.create({
        data: {
          userId,
          profileId,
          amount: expenseAmount,
          currency: goal.currency,
          description: body.description || `Gasto desde ahorro: ${goal.name}`,
          type: 'INFORMAL',
          source: 'SAVINGS',
          categoryId: body.categoryId,
          issuedAt: body.expenseDate ? new Date(body.expenseDate) : new Date(),
          provider: 'Ahorros', // Just a label
        }
      });
    }

    // Update goal total
    const newTotal = goal.currentAmount + body.amount;
    const updatedGoal = await app.prisma.savingsGoal.update({
      where: { id },
      data: { 
        currentAmount: newTotal,
        status: newTotal >= goal.targetAmount ? 'COMPLETED' : 'ACTIVE'
      }
    });

    return res.send({ ok: true, goal: updatedGoal, transaction: tx });
  });

  // DELETE GOAL
  app.delete('/goals/:id', async (req, res) => {
    const auth = requireAuth(app, req, res);
    if (!auth) return;
    const { userId, profileId } = auth;
    const { id } = req.params as { id: string };

    const goal = await app.prisma.savingsGoal.findFirst({ where: { id, userId, profileId } });
    if (!goal) return res.notFound('Meta no encontrada');

    await app.prisma.savingsGoal.delete({ where: { id } });

    return res.send({ ok: true });
  });
};
