import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../utils/auth.js'
import { CurrencyService } from '../services/currency.js'
import { publishEvent } from '../services/realtime.js'

export const incomeRoutes: FastifyPluginAsync = async (app) => {
  const currencyService = new CurrencyService(app)

  const CreateBody = z.object({
    amount: z.number().positive(),
    currency: z.string().optional(),
    description: z.string().optional(),
    category: z.string().optional(),
    categoryId: z.string().optional(),
    paymentMethodId: z.string().min(1),
    issuedAt: z.string().optional(),
  })

  const UpdateBody = z.object({
    amount: z.number().positive().optional(),
    currency: z.string().optional(),
    description: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    categoryId: z.string().nullable().optional(),
    paymentMethodId: z.string().min(1).optional(),
    issuedAt: z.string().optional(),
  })

  app.get('', { schema: { summary: 'List incomes' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res)
    if (!auth) return
    const { userId, profileId } = auth
    
    const items = await app.prisma.income.findMany({
      where: { userId, profileId },
      include: { paymentMethod: true },
      orderBy: { issuedAt: 'desc' }
    })
    
    return res.send({ ok: true, items })
  })

  app.post('', { schema: { summary: 'Register income' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res)
    if (!auth) return
    const { userId, profileId } = auth
    
    const parse = CreateBody.safeParse(req.body)
    if (!parse.success) return res.badRequest('Datos inválidos')
    const data = parse.data

    const pm = await app.prisma.paymentMethod.findUnique({ where: { id: data.paymentMethodId } })
    if (!pm || pm.userId !== userId || pm.profileId !== profileId) return res.badRequest('Método de pago no encontrado')

    const user = await app.prisma.user.findUnique({ where: { id: userId }, select: { preferredCurrency: true } })
    const currency = data.currency || pm.currency || user?.preferredCurrency || 'PEN'
    const targetCurrency = user?.preferredCurrency || 'PEN'
    
    const { amount: native, rate } = await currencyService.convert(data.amount, currency, targetCurrency)

    const income = await app.prisma.$transaction(async (tx) => {
      // 1. Create income record
      const inc = await tx.income.create({
        data: {
          userId,
          profileId,
          paymentMethodId: data.paymentMethodId,
          amount: data.amount,
          currency,
          amountNative: native,
          exchangeRate: rate,
          description: data.description,
          category: data.category,
          categoryId: data.categoryId,
          issuedAt: data.issuedAt ? new Date(data.issuedAt) : new Date(),
        }
      })

      // 2. Update payment method balance
      // If currency is different, we should probably convert to PM currency too, 
      // but for simplicity we assume the user registers income in the PM's currency or we convert it.
      let amountToAdd = data.amount
      if (currency !== pm.currency) {
          const { amount: converted } = await currencyService.convert(data.amount, currency, pm.currency)
          amountToAdd = converted
      }

      await tx.paymentMethod.update({
        where: { id: pm.id },
        data: { balance: { increment: amountToAdd } }
      })

      // 3. Create Budget Log for history visibility
      try {
          const now = new Date();
          const month = now.getMonth() + 1;
          const year = now.getFullYear();
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
                      previousTotal: 0, // We don't track the "total budget" history accurately here anymore, just the movement
                      newTotal: 0,
                      reason: data.description || 'Ingreso registrado',
                      type: 'INCREASE'
                  }
              });
          }
      } catch (e) {
          app.log.error({ msg: 'Failed to create budget log for income', error: e });
      }

      return inc
    })

    publishEvent(userId, { type: 'MUTATION', entity: 'INCOME', action: 'CREATE' }).catch(console.error);

    return res.send({ ok: true, item: income })
  })

  app.delete('/:id', { schema: { summary: 'Delete income' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res)
    if (!auth) return
    const { userId, profileId } = auth
    const id = (req.params as any).id as string
    
    const income = await app.prisma.income.findUnique({ where: { id } })
    if (!income || income.userId !== userId || income.profileId !== profileId) return res.notFound('No encontrado')

    await app.prisma.$transaction(async (tx) => {
      // 1. Revert balance
      const pm = await tx.paymentMethod.findUnique({ where: { id: income.paymentMethodId } })
      if (pm) {
          let amountToSub = income.amount
          // If income currency was different from PM currency at the time, 
          // we should ideally use the original rate, but for now we re-convert.
          if (income.currency !== pm.currency) {
              const { amount: converted } = await currencyService.convert(income.amount, income.currency, pm.currency)
              amountToSub = converted
          }
          await tx.paymentMethod.update({
            where: { id: pm.id },
            data: { balance: { decrement: amountToSub } }
          })
      }
      
      // 2. Delete record
      await tx.income.delete({ where: { id } })
    })

    publishEvent(userId, { type: 'MUTATION', entity: 'INCOME', action: 'DELETE' }).catch(console.error);

    return res.code(204).send()
  })

  app.patch('/:id', { schema: { summary: 'Partial update income' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res)
    if (!auth) return
    const { userId, profileId } = auth
    const id = (req.params as any).id as string
    
    const inc = await app.prisma.income.findUnique({ where: { id } })
    if (!inc || inc.userId !== userId || inc.profileId !== profileId) return res.notFound('No encontrado')

    const parse = UpdateBody.safeParse(req.body)
    if (!parse.success) return res.badRequest('Datos inválidos')
    const data = parse.data

    const updateData: any = {}
    if (data.description !== undefined) updateData.description = data.description ?? null
    if (data.category !== undefined) updateData.category = data.category ?? null
    if (data.categoryId !== undefined) updateData.categoryId = data.categoryId ?? null
    if (data.issuedAt) updateData.issuedAt = new Date(data.issuedAt)
    if (data.amount !== undefined) updateData.amount = data.amount
    if (data.currency !== undefined) updateData.currency = data.currency

    if (data.paymentMethodId !== undefined) {
      const pm = await app.prisma.paymentMethod.findUnique({ where: { id: data.paymentMethodId } })
      if (pm && pm.userId === userId && pm.profileId === profileId && pm.active) updateData.paymentMethodId = pm.id
    }

    if (data.amount !== undefined || data.currency !== undefined) {
      const user = await app.prisma.user.findUnique({ where: { id: userId }, select: { preferredCurrency: true } })
      const targetCurrency = user?.preferredCurrency || 'PEN'
      const finalAmount = data.amount !== undefined ? data.amount : inc.amount
      const finalCurrency = data.currency !== undefined ? data.currency : inc.currency
      const { amount: native, rate } = await currencyService.convert(finalAmount, finalCurrency, targetCurrency)
      updateData.amountNative = native
      updateData.exchangeRate = rate
    }

    const updated = await app.prisma.income.update({ where: { id }, data: updateData, include: { paymentMethod: true } })
    
    publishEvent(userId, { type: 'MUTATION', entity: 'INCOME', action: 'PATCH' }).catch(console.error);
    
    return res.send({ ok: true, item: updated })
  })
}
