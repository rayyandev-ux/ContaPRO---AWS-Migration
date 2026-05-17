import type { FastifyPluginAsync } from 'fastify';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { isEntitled } from '../utils/subscription.js';
import { checkBudgetAlertAfterExpense, ensureBudgetForUserMonth } from './budget.js';
import { requireAuth } from '../utils/auth.js';

import { CurrencyService } from '../services/currency.js';

export const analysisRoutes: FastifyPluginAsync = async (app) => {
  const currencyService = new CurrencyService(app as any);
  const UpdateSummaryBody = z.object({ summary: z.string().min(1) });

  const UpdateItemsBody = z.object({
    items: z.array(z.object({
      description: z.string().min(1),
      quantity: z.number().min(0),
      unitPrice: z.number().min(0),
    })).default([]),
  });

// Actualiza el resumen del análisis asociado a un documento
  app.patch('/:documentId/summary', { schema: { summary: 'Actualizar resumen de análisis' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return;
    const { userId, profileId } = auth;
    const user = await app.prisma.user.findUnique({ where: { id: userId }, select: { plan: true, planExpires: true, trialEnds: true, stripeSubscriptionId: true, preferredCurrency: true } });
    if (!isEntitled(user)) return res.paymentRequired('Suscripción requerida');
    const documentId = (req.params as any).documentId as string;

    // Validar cuerpo
    const parse = UpdateSummaryBody.safeParse(req.body);
    if (!parse.success) return res.badRequest('Datos inválidos');
    const { summary } = parse.data;

    // Verificar que el documento exista y sea del usuario y perfil
    const doc = await app.prisma.document.findUnique({ where: { id: documentId } });
    if (!doc || doc.userId !== userId) return res.notFound('Documento no encontrado');
    if (doc.profileId && doc.profileId !== profileId) return res.notFound('Documento no encontrado (perfil incorrecto)');

    // Crear o actualizar análisis
    const existing = await app.prisma.analysis.findUnique({ where: { documentId } });
    if (existing) {
      const updated = await app.prisma.analysis.update({ where: { documentId }, data: { summary } });
      return res.send({ ok: true, analysis: updated });
    } else {
      const created = await app.prisma.analysis.create({ data: { documentId, summary, total: null, details: Prisma.JsonNull } });
      return res.send({ ok: true, analysis: created });
    }
  });

  // Actualiza los ítems dentro de details del análisis
  app.patch('/:documentId/items', { schema: { summary: 'Actualizar ítems de análisis' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return;
    const { userId, profileId } = auth;
    const user = await app.prisma.user.findUnique({ where: { id: userId }, select: { plan: true, planExpires: true, trialEnds: true, stripeSubscriptionId: true } });
    if (!isEntitled(user)) return res.paymentRequired('Suscripción requerida');
    const documentId = (req.params as any).documentId as string;

    const parse = UpdateItemsBody.safeParse(req.body);
    if (!parse.success) return res.badRequest('Datos inválidos');
    const { items } = parse.data;

    const doc = await app.prisma.document.findUnique({ where: { id: documentId } });
    if (!doc || doc.userId !== userId) return res.notFound('Documento no encontrado');
    if (doc.profileId && doc.profileId !== profileId) return res.notFound('Documento no encontrado (perfil incorrecto)');

    const existing = await app.prisma.analysis.findUnique({ where: { documentId } });
    const sanitized = items.map(it => ({ description: it.description, quantity: it.quantity, unitPrice: it.unitPrice, lineTotal: Number((it.quantity || 0) * (it.unitPrice || 0)) }));
    const newTotal = sanitized.reduce((acc, it) => acc + Number(it.lineTotal || 0), 0);

    let analysisUpdated = null as any;
    if (existing) {
      const baseDetails = (existing.details && typeof existing.details === 'object') ? (existing.details as any) : {};
      const nextDetails = { ...baseDetails, items: sanitized };
      analysisUpdated = await app.prisma.analysis.update({ where: { documentId }, data: { details: nextDetails as any, total: newTotal } });
    } else {
      analysisUpdated = await app.prisma.analysis.create({ data: { documentId, summary: '', total: newTotal, details: { items: sanitized } as any } });
    }

    try {
      app.log.info({ msg: 'analysis: items update', documentId, newTotal, itemsCount: sanitized.length });
      const expense = await app.prisma.expense.findUnique({ where: { documentId } });
      if (expense && expense.userId === userId) {
        // Update expense amount and amountNative
        let amountNative = null as number | null;
        let exchangeRate = expense.exchangeRate;

        if (expense.currency && expense.currency !== 'PEN') {
             if (exchangeRate) {
                 amountNative = Number((newTotal * exchangeRate).toFixed(2));
             } else {
                 // Fetch new rate
                 const target = 'PEN';
                 const { amount: native, rate } = await currencyService.convert(newTotal, expense.currency, target);
                 amountNative = native;
                 exchangeRate = rate;
             }
        } else {
             // Same currency
             amountNative = newTotal;
             exchangeRate = 1;
        }

        const updatedExpense = await app.prisma.expense.update({ 
            where: { id: expense.id }, 
            data: { 
                amount: newTotal,
                amountNative,
                exchangeRate
            } 
        });
        app.log.info({ msg: 'analysis: expense amount updated from items', expenseId: updatedExpense.id, newAmount: updatedExpense.amount, newNative: updatedExpense.amountNative });
        
        // Check budget alerts
        const alertAmount = updatedExpense.amountNative ?? updatedExpense.amount;
        try {
          await checkBudgetAlertAfterExpense(app, updatedExpense.userId, profileId, new Date(updatedExpense.issuedAt), alertAmount, updatedExpense.categoryId ?? undefined);
        } catch (e) {
          app.log.error({ msg: 'budget alert check failed (items update)', e });
        }
      }
    } catch (e) {
      app.log.error({ msg: 'failed to sync expense amount', e });
    }

    return res.send({ ok: true, analysis: analysisUpdated });
  });
};
