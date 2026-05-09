import type { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../utils/auth.js'
import { getAmountNative } from '../utils/currency-helper.js'
import { CurrencyService } from '../services/currency.js'

export const transactionsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', { schema: { summary: 'List combined transactions' } }, async (req, res) => {
    const auth = requireAuth(app, req, res)
    if (!auth) return
    const { userId, profileId } = auth
    const q = req.query as any

    const start = q.start ? new Date(q.start) : undefined
    const end = q.end ? new Date(q.end) : undefined
    const paymentMethodId = q.paymentMethodId
    const category = q.category
    const search = q.search ? String(q.search).toLowerCase() : undefined
    const typeFilter = q.type // 'INCOME' or 'EXPENSE'
    
    const page = Math.max(Number(q.page) || 1, 1)
    const limit = Math.min(Number(q.limit) || 20, 100)
    const skip = (page - 1) * limit

    const dateField = q.dateField === 'createdAt' ? 'createdAt' : 'issuedAt'

    const whereExp: any = { userId, profileId, deletedAt: null }
    const whereInc: any = { userId, profileId, deletedAt: null }

    if (start || end) {
      const dExp: any = {}
      const dInc: any = {}
      if (start) { dExp.gte = start; dInc.gte = start }
      if (end) { dExp.lte = end; dInc.lte = end }
      whereExp[dateField] = dExp
      whereInc[dateField] = dInc
    }

    if (paymentMethodId) {
      whereExp.paymentMethodId = paymentMethodId
      whereInc.paymentMethodId = paymentMethodId
    }

    if (category) {
      // Expense uses relation, Income uses string
      whereExp.category = { name: { contains: category, mode: 'insensitive' } }
      whereInc.category = { contains: category, mode: 'insensitive' }
    }

    if (search) {
      whereExp.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { provider: { contains: search, mode: 'insensitive' } }
      ]
      whereInc.OR = [
        { description: { contains: search, mode: 'insensitive' } }
      ]
    }

    // If fetching both
    const [expenses, incomes] = await Promise.all([
      (typeFilter === 'INCOME') ? [] : app.prisma.expense.findMany({
        where: whereExp,
        include: { category: true, paymentMethod: true }
      }),
      (typeFilter === 'EXPENSE') ? [] : app.prisma.income.findMany({
        where: whereInc,
        include: { paymentMethod: true }
      })
    ])

    let combined = [
      ...expenses.map((e: any) => ({
        ...e,
        transactionType: 'EXPENSE',
        categoryName: e.category?.name || null
      })),
      ...incomes.map((i: any) => ({
        ...i,
        transactionType: 'INCOME',
        categoryName: i.category || null,
        provider: null,
        source: 'MANUAL'
      }))
    ]

    // Sort by createdAt desc by default so newly added past transactions appear at the top
    combined.sort((a, b) => new Date(b.createdAt || b.issuedAt).getTime() - new Date(a.createdAt || a.issuedAt).getTime())

    const total = combined.length
    const paginated = combined.slice(skip, skip + limit)

    return res.send({
      ok: true,
      items: paginated,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    })
  })

  app.get('/summary', { schema: { summary: 'Get transactions summary' } }, async (req, res) => {
    const auth = requireAuth(app, req, res)
    if (!auth) return
    const { userId, profileId } = auth
    const user = await app.prisma.user.findUnique({ where: { id: userId }, select: { preferredCurrency: true } })
    const targetCurrency = user?.preferredCurrency || 'PEN'
    const currencyService = new CurrencyService(app)

    const q = req.query as any

    const start = q.start ? new Date(q.start) : undefined
    const end = q.end ? new Date(q.end) : undefined
    const paymentMethodId = q.paymentMethodId
    const category = q.category
    const search = q.search ? String(q.search).toLowerCase() : undefined
    const typeFilter = q.type // 'INCOME' or 'EXPENSE'
    const dateField = q.dateField === 'createdAt' ? 'createdAt' : 'issuedAt'
    
    const whereExp: any = { userId, profileId, deletedAt: null }
    const whereInc: any = { userId, profileId, deletedAt: null }

    if (start || end) {
      const dExp: any = {}
      const dInc: any = {}
      if (start) { dExp.gte = start; dInc.gte = start }
      if (end) { dExp.lte = end; dInc.lte = end }
      whereExp[dateField] = dExp
      whereInc[dateField] = dInc
    }

    if (paymentMethodId) {
      whereExp.paymentMethodId = paymentMethodId
      whereInc.paymentMethodId = paymentMethodId
    }
    
    if (category) {
      whereExp.category = { name: { contains: category, mode: 'insensitive' } }
      whereInc.category = { contains: category, mode: 'insensitive' }
    }

    if (search) {
      whereExp.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { provider: { contains: search, mode: 'insensitive' } }
      ]
      whereInc.OR = [
        { description: { contains: search, mode: 'insensitive' } }
      ]
    }

    const [expenses, incomes] = await Promise.all([
      (typeFilter === 'INCOME') ? [] : app.prisma.expense.findMany({
        where: whereExp,
        include: { category: true }
      }),
      (typeFilter === 'EXPENSE') ? [] : app.prisma.income.findMany({
        where: whereInc
      })
    ])

    let totalExpenses = 0
    for (const e of expenses) {
      totalExpenses += await getAmountNative(e, targetCurrency, currencyService)
    }

    let totalIncomes = 0
    for (const i of incomes) {
      totalIncomes += await getAmountNative(i, targetCurrency, currencyService)
    }

    const balance = totalIncomes - totalExpenses

    // Top category (expenses)
    const catMap: Record<string, number> = {}
    for (const e of expenses) {
      const name = e.category?.name || 'Sin categoría'
      const amount = await getAmountNative(e, targetCurrency, currencyService)
      catMap[name] = (catMap[name] || 0) + amount
    }

    let topCategory = null
    let maxAmount = 0
    for (const [name, amount] of Object.entries(catMap)) {
      if (amount > maxAmount) {
        maxAmount = amount
        topCategory = { name, amount }
      }
    }

    return res.send({
      ok: true,
      summary: {
        totalExpenses,
        totalIncomes,
        balance,
        topCategory,
        currency: targetCurrency
      }
    })
  })
}
