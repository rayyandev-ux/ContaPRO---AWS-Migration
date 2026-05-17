import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { CurrencyService } from '../services/currency.js';
import { checkBudgetAlertAfterExpense, ensureBudgetForUserMonth } from './budget.js';
import { formatDMY, fixUtf8Mojibake, formatExpenseMessage } from '../utils/format.js';
import { isEntitled } from '../utils/subscription.js';
import { requireAuth } from '../utils/auth.js';
import { publishEvent } from '../services/realtime.js';
import fs from 'node:fs/promises';
import path from 'node:path';

export const expensesRoutes: FastifyPluginAsync = async (app) => {
  const currencyService = new CurrencyService(app);

  const ManualExpenseBody = z.object({
    type: z.enum(['FACTURA','BOLETA','INFORMAL','YAPE','PLIN','TUNKI','LEMONPAY','BCP','INTERBANK','SCOTIABANK','BBVA']),
    issuedAt: z.string(),
    provider: z.string().min(1),
    description: z.string().optional(),
    amount: z.number().positive(),
    currency: z.string().optional(),
    categoryId: z.string().optional(),
    emitterIdNumber: z.string().optional(),
    editReason: z.string().optional(),
    paymentMethodId: z.string().optional(),
  });

  const UpdateExpenseBody = z.object({
    type: z.enum(['FACTURA','BOLETA','INFORMAL','YAPE','PLIN','TUNKI','LEMONPAY','BCP','INTERBANK','SCOTIABANK','BBVA']).optional(),
    issuedAt: z.string().optional(),
    provider: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    editReason: z.string().nullable().optional(),
    amount: z.number().positive().optional(),
    currency: z.string().optional(),
    // Permitir desasignar categoría con null
    categoryId: z.string().nullable().optional(),
    emitterIdNumber: z.string().nullable().optional(),
    paymentMethodId: z.string().nullable().optional(),
  });

  const BulkDeleteBody = z.object({
    ids: z.array(z.string()).min(1),
  });

  // GET /pending - Listar notificaciones/gastos pendientes de aprobación
  app.get('/pending', { schema: { summary: 'Listar gastos pendientes de aprobación' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return;
    const { userId } = auth;
    
    const items = await app.prisma.pendingExpense.findMany({
        where: { userId, status: 'WAITING_USER' },
        orderBy: { createdAt: 'desc' }
    });
    
    return res.send({ ok: true, items });
  });

  // POST /pending/:id/approve - Aprobar gasto pendiente
  app.post('/pending/:id/approve', { schema: { summary: 'Aprobar gasto pendiente' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return;
    const { userId, profileId } = auth;

    const id = (req.params as any).id as string;
    const pending = await app.prisma.pendingExpense.findUnique({ where: { id } });

    if (!pending || pending.userId !== userId) return res.notFound('No encontrado');
    if (pending.status !== 'WAITING_USER') return res.badRequest('El gasto ya fue procesado');

    // Convertir PendingExpense -> Expense
    // Intentar deducir tipo si no viene definido (asumir INFORMAL si no es claro)
    // PendingExpense source (GMAIL, SMS) -> Expense source (DOCUMENT, MANUAL)
    // Mapeo: GMAIL -> DOCUMENT, SMS/WHATSAPP -> MANUAL (o DOCUMENT si tiene foto, pero PendingExpense guarda rawText)
    
    // Buscar si ya existe la categoría o crearla (opcional, por ahora null)
    
    const currency = pending.currency || 'PEN';
    const targetCurrency = (await app.prisma.user.findUnique({ where: { id: userId }, select: { preferredCurrency: true } }))?.preferredCurrency || 'PEN';
    const { amount: native, rate } = await currencyService.convert(pending.amount, currency, targetCurrency);

    const expense = await app.prisma.expense.create({
        data: {
            userId,
            profileId, // Asignar al perfil actual
            type: 'INFORMAL', // Default
            source: pending.source === 'GMAIL' ? 'DOCUMENT' : 'MANUAL',
            provider: pending.merchant || pending.source,
            description: pending.description || pending.rawText || 'Gasto importado',
            amount: pending.amount,
            currency: currency,
            amountNative: native,
            exchangeRate: rate,
            issuedAt: pending.date,
            // Guardar referencia
            documentId: undefined, // Si quisiéramos linkear, necesitaríamos lógica extra
        }
    });

    await app.prisma.pendingExpense.update({
        where: { id },
        data: { status: 'APPROVED' }
    });

    // Notificar éxito (opcional, o confiar en el frontend)
    publishEvent(userId, { type: 'MUTATION', entity: 'EXPENSE', action: 'APPROVE' }).catch(console.error);
    return res.send({ ok: true, expense });
  });

  // POST /pending/:id/reject - Rechazar gasto pendiente
  app.post('/pending/:id/reject', { schema: { summary: 'Rechazar gasto pendiente' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return;
    const { userId } = auth;

    const id = (req.params as any).id as string;
    const pending = await app.prisma.pendingExpense.findUnique({ where: { id } });

    if (!pending || pending.userId !== userId) return res.notFound('No encontrado');
    
    await app.prisma.pendingExpense.update({
        where: { id },
        data: { status: 'REJECTED' }
    });

    publishEvent(userId, { type: 'MUTATION', entity: 'EXPENSE', action: 'REJECT' }).catch(console.error);

    return res.send({ ok: true });
  });

  app.get('', { schema: { summary: 'List expenses' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return;
    const { userId, profileId } = auth;

    const q = (req.query || {}) as Record<string, string>;
    const type = q.type as ('FACTURA'|'BOLETA'|'YAPE'|'PLIN'|'TUNKI'|'LEMONPAY'|'BCP'|'INTERBANK'|'SCOTIABANK'|'BBVA'|'INFORMAL'|undefined);
    const provider = q.provider;
    const categoryId = q.categoryId;
    const start = q.start ? new Date(q.start) : undefined;
    const end = q.end ? new Date(q.end) : undefined;
    const dateField = q.dateField === 'issuedAt' ? 'issuedAt' : 'createdAt';

    const where: any = { userId, profileId };
    if (type) {
      if (type === 'INFORMAL') where.type = { notIn: ['FACTURA','BOLETA'] };
      else where.type = type;
    }
    if (provider) where.provider = { contains: provider, mode: 'insensitive' };
    if (categoryId) where.categoryId = categoryId;
    
    if (start || end) {
      where[dateField] = {};
      if (start) where[dateField].gte = start;
      if (end) where[dateField].lte = end;
    }

    // 1. Parallel fetch: User gate check + Expenses
    const [userGate, itemsRaw] = await Promise.all([
      app.prisma.user.findUnique({ where: { id: userId }, select: { plan: true, planExpires: true, trialEnds: true, stripeSubscriptionId: true } }),
      app.prisma.expense.findMany({ where, include: { category: true, document: true, paymentMethod: true }, orderBy: { [dateField]: 'desc' } })
    ]);

    if (!isEntitled(userGate)) return res.paymentRequired('Suscripción requerida');

    const items = itemsRaw.map((it: any) => ({
      ...it,
      category: it.category ? { ...it.category, name: fixUtf8Mojibake(it.category.name) } : it.category,
    }));
    return res.send({ ok: true, items });
  });

  // GET /:id - Get expense
  app.get('/:id', { schema: { summary: 'Get expense' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return;
    const { userId, profileId } = auth;
    const userGate = await app.prisma.user.findUnique({ where: { id: userId }, select: { plan: true, planExpires: true, trialEnds: true, stripeSubscriptionId: true } });
    if (!isEntitled(userGate)) return res.paymentRequired('Suscripción requerida');
    const id = (req.params as any).id as string;
    const exp = await app.prisma.expense.findUnique({ where: { id }, include: { category: true, document: { include: { analysis: true } }, user: { select: { id: true, email: true } }, paymentMethod: true } });
    if (!exp || exp.userId !== userId || exp.profileId !== profileId) return res.notFound('No encontrado');
    return res.send({ ok: true, item: exp });
  });

  // DELETE /:id
  app.delete('/:id', { schema: { summary: 'Delete expense' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return;
    const { userId, profileId } = auth;
    const userGate = await app.prisma.user.findUnique({ where: { id: userId }, select: { plan: true, planExpires: true, trialEnds: true, stripeSubscriptionId: true } });
    if (!isEntitled(userGate)) return res.paymentRequired('Suscripción requerida');
    const id = (req.params as any).id as string;
    const exp = await app.prisma.expense.findUnique({ where: { id } });
    if (!exp || exp.userId !== userId || exp.profileId !== profileId) return res.notFound('No encontrado');
    
    const docId = exp.documentId;
    
    try {
        await app.prisma.expense.delete({ where: { id } });
    } catch (e: any) {
        if (e.code === 'P2025') return res.status(404).send({ error: 'Expense not found' });
        throw e;
    }

    if (docId) {
      try { await app.prisma.document.delete({ where: { id: docId } }); } catch {}
    }

    publishEvent(userId, { type: 'MUTATION', entity: 'EXPENSE', action: 'DELETE' }).catch(console.error);

    return res.code(204).send();
  });

  // DELETE /bulk - Delete multiple
  app.post('/bulk-delete', { schema: { summary: 'Delete multiple expenses' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return;
    const { userId, profileId } = auth;
    const userGate = await app.prisma.user.findUnique({ where: { id: userId }, select: { plan: true, planExpires: true, trialEnds: true, stripeSubscriptionId: true } });
    if (!isEntitled(userGate)) return res.paymentRequired('Suscripción requerida');
    const parse = BulkDeleteBody.safeParse(req.body);
    if (!parse.success) return res.badRequest('Datos inválidos');
    const { ids } = parse.data;

    const expenses = await app.prisma.expense.findMany({ where: { userId, profileId, id: { in: ids } }, select: { id: true, documentId: true } });
    const docIds = expenses.map(e => e.documentId).filter((d): d is string => !!d);

    const del = await app.prisma.expense.deleteMany({ where: { userId, profileId, id: { in: ids } } });

    if (docIds.length > 0) {
      try { await app.prisma.analysis.deleteMany({ where: { documentId: { in: docIds } } }); } catch {}
      try { await app.prisma.document.deleteMany({ where: { id: { in: docIds } } }); } catch {}
    }

    publishEvent(userId, { type: 'MUTATION', entity: 'EXPENSE', action: 'BULK_DELETE' }).catch(console.error);

    return res.send({ ok: true, deleted: del.count });
  });

  // PUT /:id - Update expense
  app.put('/:id', {
    schema: { summary: 'Update expense', params: { type: 'object', properties: { id: { type: 'string' } } } }
  }, async (req, res) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return;
    const { userId, profileId } = auth;
    const userGate = await app.prisma.user.findUnique({ where: { id: userId }, select: { plan: true, planExpires: true, trialEnds: true, stripeSubscriptionId: true } });
    if (!isEntitled(userGate)) return res.paymentRequired('Suscripción requerida');
    const id = (req.params as any).id as string;

    const exp = await app.prisma.expense.findUnique({ where: { id } });
    if (!exp || exp.userId !== userId || exp.profileId !== profileId) return res.notFound('No encontrado');
    const now = new Date();
    // Restriction removed as requested
    // const isCurrentMonth = (new Date(exp.createdAt).getMonth() === now.getMonth()) && (new Date(exp.createdAt).getFullYear() === now.getFullYear());
    // if (!isCurrentMonth) return res.forbidden('No se puede editar gastos de meses anteriores');

    const parse = UpdateExpenseBody.safeParse(req.body);
    if (!parse.success) return res.badRequest('Datos inválidos');
    const data = parse.data;

    const updateData: any = {};
    if (data.type) updateData.type = data.type;
    if (data.issuedAt) updateData.issuedAt = new Date(data.issuedAt);
    if (typeof data.provider === 'string') updateData.provider = data.provider;
    if (data.description !== undefined) updateData.description = data.description ?? null;
    if (data.editReason !== undefined) updateData.editReason = data.editReason ?? null;
    if (typeof data.amount === 'number') updateData.amount = data.amount;
    if (typeof data.currency === 'string') updateData.currency = data.currency;
    if (data.categoryId !== undefined) updateData.categoryId = data.categoryId ?? null;
    if (data.emitterIdNumber !== undefined) updateData.emitterIdNumber = data.emitterIdNumber ?? null;

    if (data.paymentMethodId !== undefined) {
      if (data.paymentMethodId === null) updateData.paymentMethodId = null;
      else {
        const pm = await app.prisma.paymentMethod.findUnique({ where: { id: data.paymentMethodId } });
        if (pm && pm.userId === userId && pm.profileId === profileId && pm.active) updateData.paymentMethodId = pm.id;
      }
    }

    // Multicurrency Update Logic
    if (data.amount !== undefined || data.currency !== undefined) {
      const user = await app.prisma.user.findUnique({ where: { id: userId }, select: { preferredCurrency: true } });
      const targetCurrency = user?.preferredCurrency || 'PEN';
      
      const finalAmount = data.amount !== undefined ? data.amount : exp.amount;
      const finalCurrency = data.currency !== undefined ? data.currency : exp.currency;
      
      const { amount: native, rate } = await currencyService.convert(finalAmount, finalCurrency, targetCurrency);
      updateData.amountNative = native;
      updateData.exchangeRate = rate;
    }

    const updated = await app.prisma.expense.update({ where: { id }, data: updateData, include: { category: true, document: true, paymentMethod: true } });
    try {
      await checkBudgetAlertAfterExpense(app, userId, profileId, new Date(updated.issuedAt), updated.amount, updated.categoryId ?? undefined);
    } catch (e) {
      app.log.error({ msg: 'budget alert check failed (expense update)', e });
    }
    publishEvent(userId, { type: 'MUTATION', entity: 'EXPENSE', action: 'UPDATE' }).catch(console.error);
    return res.send({ ok: true, item: updated });
  });

  // PATCH /:id - Partial update expense
  app.patch('/:id', {
    schema: { summary: 'Partial update expense', params: { type: 'object', properties: { id: { type: 'string' } } } }
  }, async (req, res) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return;
    const { userId, profileId } = auth;
    const id = (req.params as any).id as string;

    const exp = await app.prisma.expense.findUnique({ where: { id } });
    if (!exp || exp.userId !== userId || exp.profileId !== profileId) return res.notFound('No encontrado');

    const parse = UpdateExpenseBody.safeParse(req.body);
    if (!parse.success) return res.badRequest('Datos inválidos');
    const data = parse.data;

    const updateData: any = {};
    if (data.type) updateData.type = data.type;
    if (data.issuedAt) updateData.issuedAt = new Date(data.issuedAt);
    if (typeof data.provider === 'string') updateData.provider = data.provider;
    if (data.description !== undefined) updateData.description = data.description ?? null;
    if (data.editReason !== undefined) updateData.editReason = data.editReason ?? null;
    if (typeof data.amount === 'number') updateData.amount = data.amount;
    if (typeof data.currency === 'string') updateData.currency = data.currency;
    if (data.categoryId !== undefined) updateData.categoryId = data.categoryId ?? null;
    if (data.emitterIdNumber !== undefined) updateData.emitterIdNumber = data.emitterIdNumber ?? null;

    if (data.paymentMethodId !== undefined) {
      if (data.paymentMethodId === null) updateData.paymentMethodId = null;
      else {
        const pm = await app.prisma.paymentMethod.findUnique({ where: { id: data.paymentMethodId } });
        if (pm && pm.userId === userId && pm.profileId === profileId && pm.active) updateData.paymentMethodId = pm.id;
      }
    }

    if (data.amount !== undefined || data.currency !== undefined) {
      const user = await app.prisma.user.findUnique({ where: { id: userId }, select: { preferredCurrency: true } });
      const targetCurrency = user?.preferredCurrency || 'PEN';
      const finalAmount = data.amount !== undefined ? data.amount : exp.amount;
      const finalCurrency = data.currency !== undefined ? data.currency : exp.currency;
      const { amount: native, rate } = await currencyService.convert(finalAmount, finalCurrency, targetCurrency);
      updateData.amountNative = native;
      updateData.exchangeRate = rate;
    }

    const updated = await app.prisma.expense.update({ where: { id }, data: updateData, include: { category: true, document: true, paymentMethod: true } });
    publishEvent(userId, { type: 'MUTATION', entity: 'EXPENSE', action: 'PATCH' }).catch(console.error);
    return res.send({ ok: true, item: updated });
  });

  app.post('', { schema: { summary: 'Create manual expense' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return;
    const { userId, profileId } = auth;
    const ct = String((req.headers as any)['content-type'] || '').toLowerCase();
    const isMultipart = ct.includes('multipart/form-data');
    let data: z.infer<typeof ManualExpenseBody>;
    if (isMultipart) {
      const body: any = (req as any).body || {};
      const getField = (name: string) => {
        const field = body[name];
        if (!field) return undefined;
        if (typeof field === 'object' && 'value' in field) return field.value;
        return field;
      };

      const pre = {
        type: getField('type'),
        issuedAt: getField('issuedAt'),
        provider: getField('provider'),
        description: getField('description'),
        amount: Number(getField('amount')),
        currency: getField('currency'),
        categoryId: getField('categoryId'),
        emitterIdNumber: getField('emitterIdNumber'),
        editReason: getField('editReason'),
        paymentMethodId: getField('paymentMethodId'),
      } as any;

      const parse = ManualExpenseBody.safeParse(pre);
      if (!parse.success) {
        app.log.warn({ msg: 'Manual expense validation failed (multipart)', errors: parse.error.format(), pre });
        return res.badRequest('Datos inválidos');
      }
      data = parse.data;
    } else {
      const parse = ManualExpenseBody.safeParse(req.body);
      if (!parse.success) return res.badRequest('Datos inválidos');
      data = parse.data;
    }

    // Enforce plan limits considering Premium expiration
    const user = await app.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.unauthorized('No autenticado');
    if (!isEntitled(user)) return res.paymentRequired('Suscripción requerida');

    let linkedDocId: string | null = null;
    if (isMultipart) {
      try {
        const body: any = (req as any).body || {};
        let mp: any = null;
        if (body.file) {
          mp = Array.isArray(body.file) ? body.file[0] : body.file;
        }

        if (!mp || typeof mp.toBuffer !== 'function') {
          // Fallback si por alguna razón no está en el body (aunque attachFieldsToBody está activo)
          mp = await (req as any).file().catch(() => null);
        }

        if (mp) {
          const uploadsDir = path.join(process.cwd(), 'uploads');
          await fs.mkdir(uploadsDir, { recursive: true });
          const uniqueName = `${Date.now()}_${String(mp.filename || 'upload').replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
          const filePath = path.join(uploadsDir, uniqueName);
          const buf = await mp.toBuffer();
          await fs.writeFile(filePath, buf);
          const doc = await app.prisma.document.create({ data: { userId, profileId, filename: mp.filename, mimeType: mp.mimetype, storagePath: filePath } });
          linkedDocId = doc.id;
        }
      } catch {}
    }

    // Fallback to Favorite PM if none provided
    let pmId: string | null = null;
    if (data.paymentMethodId) {
      const pm = await app.prisma.paymentMethod.findUnique({ where: { id: data.paymentMethodId } });
      if (pm && pm.userId === userId && pm.profileId === profileId && pm.active) pmId = pm.id;
    }
    if (!pmId) {
      const favoritePm = await app.prisma.paymentMethod.findFirst({ where: { userId, profileId, isFavorite: true, active: true } });
      if (favoritePm) pmId = favoritePm.id;
      else {
        // Legacy fallback
        const me2 = await app.prisma.user.findUnique({ where: { id: userId }, select: { defaultPaymentMethodId: true } });
        pmId = me2?.defaultPaymentMethodId ?? null;
      }
      
      if (!pmId) {
        try {
          const firstPm = await app.prisma.paymentMethod.findFirst({ where: { userId, profileId, active: true } });
          if (firstPm) pmId = firstPm.id;
          else {
            const created = await app.prisma.paymentMethod.create({ data: { userId, profileId, name: 'Efectivo', provider: 'EFECTIVO', type: 'EFECTIVO', currency: data.currency ?? (user?.preferredCurrency || 'PEN'), isFavorite: true } });
            try { await app.prisma.user.update({ where: { id: userId }, data: { defaultPaymentMethodId: created.id } }); } catch {}
            pmId = created.id;
          }
        } catch {}
      }
    }

    const currency = data.currency ?? (user?.preferredCurrency || 'PEN');
    const targetCurrency = user?.preferredCurrency || 'PEN';
    const { amount: native, rate } = await currencyService.convert(data.amount, currency, targetCurrency);

    const exp = await app.prisma.$transaction(async (tx) => {
      // 1. Create expense
      const e = await tx.expense.create({
        data: {
          userId,
          profileId,
          type: data.type,
          source: 'MANUAL',
          issuedAt: new Date(data.issuedAt),
          provider: data.provider,
          description: data.description,
          editReason: data.editReason,
          amount: data.amount,
          currency: currency,
          amountNative: native,
          exchangeRate: rate,
          categoryId: data.categoryId,
          emitterIdNumber: data.emitterIdNumber,
          documentId: linkedDocId ?? undefined,
          paymentMethodId: pmId ?? undefined,
        },
      });

      // 2. Deduct from Payment Method Balance
      if (pmId) {
          const pm = await tx.paymentMethod.findUnique({ where: { id: pmId } });
          if (pm) {
              let amountToSub = data.amount;
              if (currency !== pm.currency) {
                  const { amount: converted } = await currencyService.convert(data.amount, currency, pm.currency);
                  amountToSub = converted;
              }
              await tx.paymentMethod.update({
                  where: { id: pmId },
                  data: { balance: { decrement: amountToSub } }
              });

              // 3. Create Budget Log for history visibility
              try {
                  const issued = new Date(data.issuedAt);
                  const month = issued.getMonth() + 1;
                  const year = issued.getFullYear();
                  const budget = await tx.budget.findFirst({
                      where: { userId, profileId, month, year, target: 'GENERAL' }
                  });
                  if (budget) {
                      await tx.budgetLog.create({
                          data: {
                              budgetId: budget.id,
                              userId,
                              profileId,
                              amount: native,
                              previousTotal: 0,
                              newTotal: 0,
                              reason: `Gasto: ${data.provider}`,
                              type: 'DECREASE'
                          }
                      });
                  }
              } catch (e) {
                  app.log.error({ msg: 'Failed to create budget log for expense', error: e });
              }
          }
      }
      return e;
    });

    try {
      const issued = new Date(exp.issuedAt);
      await ensureBudgetForUserMonth(app, userId, profileId, issued.getFullYear(), issued.getMonth() + 1);
    } catch {}
    // Notify via Telegram if linked
    try {
      const user = await app.prisma.user.findUnique({ where: { id: userId }, select: { telegramId: true } });
      const tg: any = (app as any).telegram;
      if (tg && user?.telegramId) {
        const amt = exp.amount.toFixed(2);
        const issuedText = formatDMY(new Date(exp.issuedAt));
        const cat = exp.categoryId ? await app.prisma.category.findUnique({ where: { id: exp.categoryId } }) : null;
        const createdTxt = formatDMY(new Date(exp.createdAt));
        const pm = exp.paymentMethodId ? await app.prisma.paymentMethod.findUnique({ where: { id: exp.paymentMethodId } }) : null;
        const docType = (exp.type === 'FACTURA' || exp.type === 'BOLETA') ? exp.type : 'INFORMAL';
        const text = formatExpenseMessage({
          title: '✍️ *Gasto manual registrado*',
          provider: exp.provider,
          amount: amt,
          currency: exp.currency,
          issuedText: issuedText,
          createdText: createdTxt,
          type: docType,
          category: cat?.name || undefined,
          description: exp.description || undefined,
          source: exp.source,
          id: exp.id,
          paymentMethod: pm ? `${pm.provider} — ${pm.name}` : undefined,
        });
        await tg.sendMessage(user.telegramId, text);
      }
    } catch (e) {
      app.log.error({ msg: 'telegram notify failed (manual expense)', e });
    }
    // Notify via WhatsApp if linked
    try {
      const user = await app.prisma.user.findUnique({ where: { id: userId }, select: { whatsappPhone: true } });
      const wa: any = (app as any).whatsapp;
      if (wa && user?.whatsappPhone) {
        const to = user.whatsappPhone.startsWith('+') ? user.whatsappPhone : `+${user.whatsappPhone}`;
        const amt = exp.amount.toFixed(2);
        const issued = formatDMY(new Date(exp.issuedAt));
        const cat = exp.categoryId ? await app.prisma.category.findUnique({ where: { id: exp.categoryId } }) : null;
        const createdTxt2 = formatDMY(new Date(exp.createdAt));
        const pm2 = exp.paymentMethodId ? await app.prisma.paymentMethod.findUnique({ where: { id: exp.paymentMethodId } }) : null;
        const docType2 = (exp.type === 'FACTURA' || exp.type === 'BOLETA') ? exp.type : 'INFORMAL';
        const text = formatExpenseMessage({
          title: '✍️ *Gasto manual registrado*',
          provider: exp.provider,
          amount: amt,
          currency: exp.currency,
          issuedText: issued,
          createdText: createdTxt2,
          type: docType2,
          category: cat?.name || undefined,
          description: exp.description || undefined,
          source: exp.source,
          id: exp.id,
          paymentMethod: pm2 ? `${pm2.provider} — ${pm2.name}` : undefined,
        });
        await wa.sendText(to, text);
      }
    } catch (e) {
      app.log.error({ msg: 'whatsapp notify failed (manual expense)', e });
    }
    // Verificar umbral de presupuesto y notificar si corresponde
    try {
      await checkBudgetAlertAfterExpense(app, userId, profileId, new Date(exp.issuedAt), exp.amount, exp.categoryId ?? undefined);
    } catch (e) {
      app.log.error({ msg: 'budget alert check failed (manual expense)', e });
    }
    publishEvent(userId, { type: 'MUTATION', entity: 'EXPENSE', action: 'CREATE' }).catch(console.error);
    return res.send({ ok: true, item: exp });
  });
};
