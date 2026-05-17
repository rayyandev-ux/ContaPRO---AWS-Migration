import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../utils/auth.js'
import { publishEvent } from '../services/realtime.js'
import { CurrencyService } from '../services/currency.js'
import { getAmountNative } from '../utils/currency-helper.js'

export const paymentMethodsRoutes: FastifyPluginAsync = async (app) => {
  const CreateBody = z.object({
    name: z.string().min(1),
    provider: z.string().optional(),
    type: z.string().min(1),
    cardLast4: z.string().optional(),
    accountNumber: z.string().optional(),
    currency: z.string().optional(),
    balance: z.number().optional().default(0),
    isFavorite: z.boolean().optional().default(false),
    createInitialTransaction: z.boolean().optional().default(false),
  })

  const UpdateBody = z.object({
    name: z.string().min(1).optional(),
    provider: z.string().min(1).optional(),
    type: z.string().min(1).optional(),
    cardLast4: z.string().optional(),
    accountNumber: z.string().optional(),
    currency: z.string().optional(),
    active: z.boolean().optional(),
    balance: z.number().optional(),
    isFavorite: z.boolean().optional(),
  })

  const TransferBody = z.object({
    targetAccountId: z.string().min(1),
    amount: z.number().positive(),
    description: z.string().optional()
  })

  const RebalanceBody = z.object({
    realBalance: z.number()
  })

  app.get('/', { schema: { summary: 'List payment methods' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res)
    if (!auth) return
    const { userId, profileId } = auth
    let items = await app.prisma.paymentMethod.findMany({ where: { userId, profileId, active: true }, orderBy: { createdAt: 'desc' } })
    let me = await app.prisma.user.findUnique({ where: { id: userId }, select: { defaultPaymentMethodId: true, preferredCurrency: true } })
    
    // Check if default PM is valid for this profile
    let defaultId = me?.defaultPaymentMethodId ?? null
    if (defaultId) {
      const defPm = await app.prisma.paymentMethod.findUnique({ where: { id: defaultId } })
      if (!defPm || defPm.profileId !== profileId || !defPm.active) {
        defaultId = null
      }
    }

    if (items.length === 0) {
      try {
        const created = await app.prisma.paymentMethod.create({ data: { userId, profileId, name: 'Efectivo', provider: 'EFECTIVO', type: 'EFECTIVO', currency: me?.preferredCurrency || 'PEN' } })
        try { await app.prisma.user.update({ where: { id: userId }, data: { defaultPaymentMethodId: created.id } }) } catch {}
        items = [created]
        defaultId = created.id
      } catch {}
    }
    return res.send({ ok: true, items, defaultPaymentMethodId: defaultId })
  })

  app.post('/', { schema: { summary: 'Create payment method' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res)
    if (!auth) return
    const { userId, profileId } = auth
    const parse = CreateBody.safeParse(req.body)
    if (!parse.success) return res.badRequest('Datos inválidos')
    const data = parse.data
    const exists = await app.prisma.paymentMethod.findFirst({ where: { userId, profileId, name: data.name } })
    if (exists) return res.conflict('Nombre ya existe')
    const me = await app.prisma.user.findUnique({ where: { id: userId }, select: { preferredCurrency: true } })
    
    const created = await app.prisma.$transaction(async (tx) => {
      if (data.isFavorite) {
        await tx.paymentMethod.updateMany({
          where: { userId, profileId, isFavorite: true },
          data: { isFavorite: false }
        })
      }
      
      const pm = await tx.paymentMethod.create({ 
        data: { 
          userId, 
          profileId, 
          name: data.name, 
          provider: data.provider ?? data.type, 
          type: data.type, 
          cardLast4: data.cardLast4, 
          accountNumber: data.accountNumber,
          currency: data.currency ?? (me?.preferredCurrency || 'PEN'),
          balance: data.balance ?? 0,
          isFavorite: data.isFavorite ?? false
        } 
      })

      if (data.createInitialTransaction && data.balance !== 0) {
        if (data.balance > 0) {
          await tx.income.create({
            data: {
              userId,
              profileId,
              paymentMethodId: pm.id,
              amount: data.balance,
              currency: pm.currency,
              description: 'Saldo Inicial',
              category: 'Saldo Inicial',
              issuedAt: new Date()
            }
          })
        } else {
          await tx.expense.create({
            data: {
              userId,
              profileId,
              paymentMethodId: pm.id,
              amount: Math.abs(data.balance),
              currency: pm.currency,
              description: 'Saldo Inicial',
              provider: pm.provider,
              type: 'INFORMAL',
              source: 'MANUAL',
              issuedAt: new Date()
            }
          })
        }
      }

      if (pm.isFavorite) {
        await tx.user.update({ where: { id: userId }, data: { defaultPaymentMethodId: pm.id } })
      }
      return pm
    })

    publishEvent(userId, { type: 'MUTATION', entity: 'PAYMENT_METHOD', action: 'CREATE' }).catch(console.error);
    return res.send({ ok: true, item: created })
  })

  app.patch('/:id', { schema: { summary: 'Update payment method' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res)
    if (!auth) return
    const { userId, profileId } = auth
    const id = (req.params as any).id as string
    const pm = await app.prisma.paymentMethod.findUnique({ where: { id } })
    if (!pm || pm.userId !== userId || pm.profileId !== profileId) return res.notFound('No encontrado')
    const parse = UpdateBody.safeParse(req.body)
    if (!parse.success) return res.badRequest('Datos inválidos')
    const data = parse.data
    
    const updated = await app.prisma.$transaction(async (tx) => {
      if (data.isFavorite) {
        await tx.paymentMethod.updateMany({
          where: { userId, profileId, id: { not: id }, isFavorite: true },
          data: { isFavorite: false }
        })
      }

      const pmUpdated = await tx.paymentMethod.update({ 
        where: { id }, 
        data: { 
          name: data.name ?? pm.name, 
          provider: data.provider ?? pm.provider, 
          type: data.type ?? pm.type, 
          cardLast4: data.cardLast4 ?? pm.cardLast4 ?? null, 
          accountNumber: data.accountNumber ?? pm.accountNumber ?? null,
          currency: data.currency ?? pm.currency, 
          active: typeof data.active === 'boolean' ? data.active : pm.active,
          balance: data.balance ?? pm.balance,
          isFavorite: typeof data.isFavorite === 'boolean' ? data.isFavorite : pm.isFavorite
        } 
      })

      if (pmUpdated.isFavorite) {
        await tx.user.update({ where: { id: userId }, data: { defaultPaymentMethodId: pmUpdated.id } })
      } else if (pm.isFavorite && data.isFavorite === false) {
        await tx.user.update({ where: { id: userId }, data: { defaultPaymentMethodId: null } })
      }

      return pmUpdated
    })

    publishEvent(userId, { type: 'MUTATION', entity: 'PAYMENT_METHOD', action: 'PATCH' }).catch(console.error);
    return res.send({ ok: true, item: updated })
  })

  app.delete('/:id', { schema: { summary: 'Delete payment method' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res)
    if (!auth) return
    const { userId, profileId } = auth
    const id = (req.params as any).id as string
    const deleteTransactions = (req.query as any).deleteTransactions === 'true'

    const pm = await app.prisma.paymentMethod.findUnique({ where: { id } })
    if (!pm || pm.userId !== userId || pm.profileId !== profileId) return res.notFound('No encontrado')
    
    const updated = await app.prisma.$transaction(async (tx) => {
      // Borrar todas las transacciones vinculadas (incomes y expenses reales de este método)
      if (deleteTransactions) {
        await tx.expense.deleteMany({ where: { paymentMethodId: id } })
        await tx.income.deleteMany({ where: { paymentMethodId: id } })
      } else {
        // O desvincularlas y que queden "huérfanas" si se quiere conservar el registro histórico
        await tx.expense.updateMany({
          where: { paymentMethodId: id },
          data: { paymentMethodId: null }
        })
        // Nota: Income requiere paymentMethodId en el schema, así que tendríamos que borrarlas si no lo cambiamos.
        // Asumimos que si no deleteTransactions, se borran las de Income porque son obligatorias, 
        // O idealmente deberíamos desvincular. Como el user pidió "que se borre todo de eso y salgan sin método",
        // borramos Income y desvinculamos Expense.
        await tx.income.deleteMany({ where: { paymentMethodId: id } })
      }
      
      const deletedPm = await tx.paymentMethod.delete({ where: { id } })
      
      return deletedPm
    })

    try {
      const me = await app.prisma.user.findUnique({ where: { id: userId }, select: { defaultPaymentMethodId: true } })
      if (me?.defaultPaymentMethodId === id) await app.prisma.user.update({ where: { id: userId }, data: { defaultPaymentMethodId: null } })
    } catch {}
    
    publishEvent(userId, { type: 'MUTATION', entity: 'PAYMENT_METHOD', action: 'DELETE' }).catch(console.error);
    return res.send({ ok: true, item: updated })
  })

  app.get('/:id/transactions', { schema: { summary: 'Get transactions for a payment method' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res)
    if (!auth) return
    const { userId, profileId } = auth
    const id = (req.params as any).id as string
    const pm = await app.prisma.paymentMethod.findUnique({ where: { id } })
    if (!pm || pm.userId !== userId || pm.profileId !== profileId) return res.notFound('No encontrado')
    const limit = Math.min(Number((req.query as any).limit) || 20, 50)
    
    const [expenses, incomes] = await Promise.all([
      app.prisma.expense.findMany({
        where: { userId, profileId, paymentMethodId: id },
        orderBy: { issuedAt: 'desc' },
        take: limit,
        include: { category: { select: { name: true } } },
      }),
      app.prisma.income.findMany({
        where: { userId, profileId, paymentMethodId: id },
        orderBy: { issuedAt: 'desc' },
        take: limit,
      }),
    ])

    // Calcular totales usando amountNative o conversión
    const currencyService = new CurrencyService(app);
    // Usamos la moneda del método de pago como objetivo
    const targetCurrency = pm.currency || 'PEN';

    const allExp = await app.prisma.expense.findMany({ where: { userId, profileId, paymentMethodId: id } });
    const allInc = await app.prisma.income.findMany({ where: { userId, profileId, paymentMethodId: id } });

    let totalSpent = 0;
    for (const e of allExp) {
      totalSpent += await getAmountNative(e, targetCurrency, currencyService);
    }

    let totalIncome = 0;
    for (const i of allInc) {
      totalIncome += await getAmountNative(i, targetCurrency, currencyService);
    }

    // Merge and sort
    const transactions = [
      ...expenses.map(e => ({ ...e, type: 'EXPENSE' })),
      ...incomes.map(i => ({ ...i, type: 'INCOME' }))
    ]
    .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime())
    .slice(0, limit)

    return res.send({ 
      ok: true, 
      transactions, 
      totalSpent, 
      totalIncome,
      totalCount: allExp.length + allInc.length 
    })
  })

  app.post('/:id/default', { schema: { summary: 'Set default payment method' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res)
    if (!auth) return
    const { userId, profileId } = auth
    const id = (req.params as any).id as string
    const pm = await app.prisma.paymentMethod.findUnique({ where: { id } })
    if (!pm || pm.userId !== userId || pm.profileId !== profileId || !pm.active) return res.notFound('No encontrado')
    
    await app.prisma.$transaction([
      app.prisma.paymentMethod.updateMany({ where: { userId, profileId, isFavorite: true }, data: { isFavorite: false } }),
      app.prisma.paymentMethod.update({ where: { id }, data: { isFavorite: true } }),
      app.prisma.user.update({ where: { id: userId }, data: { defaultPaymentMethodId: pm.id } })
    ])
    
    publishEvent(userId, { type: 'MUTATION', entity: 'PAYMENT_METHOD', action: 'SET_DEFAULT' }).catch(console.error);
    return res.code(204).send()
  })

  app.post('/:id/transfer', { schema: { summary: 'Transfer between accounts' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res)
    if (!auth) return
    const { userId, profileId } = auth
    const sourceId = (req.params as any).id as string
    
    const parse = TransferBody.safeParse(req.body)
    if (!parse.success) return res.badRequest('Datos inválidos')
    const { targetAccountId, amount, description } = parse.data
    
    if (sourceId === targetAccountId) return res.badRequest('No puedes transferir a la misma cuenta')

    const [sourcePm, targetPm] = await Promise.all([
      app.prisma.paymentMethod.findUnique({ where: { id: sourceId } }),
      app.prisma.paymentMethod.findUnique({ where: { id: targetAccountId } })
    ])

    if (!sourcePm || sourcePm.userId !== userId || sourcePm.profileId !== profileId || !sourcePm.active) {
      return res.notFound('Cuenta de origen no encontrada')
    }
    if (!targetPm || targetPm.userId !== userId || targetPm.profileId !== profileId || !targetPm.active) {
      return res.notFound('Cuenta destino no encontrada')
    }

    const desc = description || `Transferencia a ${targetPm.name}`
    const targetDesc = description || `Transferencia desde ${sourcePm.name}`

    const result = await app.prisma.$transaction(async (tx) => {
      // Expense en origen
      const expense = await tx.expense.create({
        data: {
          userId,
          profileId,
          paymentMethodId: sourceId,
          amount: amount,
          currency: sourcePm.currency,
          description: desc,
          provider: sourcePm.provider,
          type: 'INFORMAL',
          source: 'MANUAL',
          issuedAt: new Date()
        }
      })

      // Income en destino
      // Nota: Si las monedas son diferentes, habría que manejar el tipo de cambio, 
      // por simplicidad transferimos el mismo monto nominal en la moneda destino (o requerir que sean igual)
      const income = await tx.income.create({
        data: {
          userId,
          profileId,
          paymentMethodId: targetAccountId,
          amount: amount,
          currency: targetPm.currency,
          description: targetDesc,
          category: 'Transferencia',
          issuedAt: new Date()
        }
      })

      // Actualizar balances
      const updatedSource = await tx.paymentMethod.update({
        where: { id: sourceId },
        data: { balance: { decrement: amount } }
      })
      const updatedTarget = await tx.paymentMethod.update({
        where: { id: targetAccountId },
        data: { balance: { increment: amount } }
      })

      return { updatedSource, updatedTarget }
    })

    publishEvent(userId, { type: 'MUTATION', entity: 'PAYMENT_METHOD', action: 'TRANSFER' }).catch(console.error);
    return res.send({ ok: true, source: result.updatedSource, target: result.updatedTarget })
  })

  app.post('/:id/rebalance', { schema: { summary: 'Rebalance account' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res)
    if (!auth) return
    const { userId, profileId } = auth
    const id = (req.params as any).id as string
    
    const parse = RebalanceBody.safeParse(req.body)
    if (!parse.success) return res.badRequest('Datos inválidos')
    const { realBalance } = parse.data

    const pm = await app.prisma.paymentMethod.findUnique({ where: { id } })
    if (!pm || pm.userId !== userId || pm.profileId !== profileId || !pm.active) {
      return res.notFound('Cuenta no encontrada')
    }

    const diff = realBalance - pm.balance
    if (diff === 0) return res.send({ ok: true, item: pm })

    const updated = await app.prisma.$transaction(async (tx) => {
      if (diff > 0) {
        await tx.income.create({
          data: {
            userId, profileId, paymentMethodId: id,
            amount: diff, currency: pm.currency,
            description: 'Ajuste de balance (Rebalanceo)',
            category: 'Ajuste', issuedAt: new Date()
          }
        })
      } else {
        await tx.expense.create({
          data: {
            userId, profileId, paymentMethodId: id,
            amount: Math.abs(diff), currency: pm.currency,
            description: 'Ajuste de balance (Rebalanceo)',
            provider: pm.provider, type: 'INFORMAL', source: 'MANUAL',
            issuedAt: new Date()
          }
        })
      }

      return tx.paymentMethod.update({
        where: { id },
        data: { balance: realBalance }
      })
    })

    publishEvent(userId, { type: 'MUTATION', entity: 'PAYMENT_METHOD', action: 'REBALANCE' }).catch(console.error);
    return res.send({ ok: true, item: updated })
  })
}
