import type { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../utils/auth.js'
import { publishEvent } from '../services/realtime.js'

export const savedViewsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', { schema: { summary: 'List saved views' } }, async (req, res) => {
    const auth = requireAuth(app, req, res)
    if (!auth) return
    const { userId } = auth

    const items = await app.prisma.savedView.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    })
    return res.send({ ok: true, items })
  })

  app.post('/', { schema: { summary: 'Create saved view' } }, async (req, res) => {
    const auth = requireAuth(app, req, res)
    if (!auth) return
    const { userId } = auth
    const body = req.body as any
    if (!body.name || !body.filters) return res.badRequest('Nombre y filtros son requeridos')

    try {
      const created = await app.prisma.savedView.create({
        data: {
          userId,
          name: body.name,
          filters: body.filters,
          isDefault: body.isDefault ?? false
        }
      })
      publishEvent(userId, { type: 'MUTATION', entity: 'SAVED_VIEW', action: 'CREATE' }).catch(console.error);
      return res.send({ ok: true, item: created })
    } catch (e) {
      return res.conflict('Ya existe una vista con este nombre')
    }
  })

  app.delete('/:id', { schema: { summary: 'Delete saved view' } }, async (req, res) => {
    const auth = requireAuth(app, req, res)
    if (!auth) return
    const { userId } = auth
    const id = (req.params as any).id as string

    const view = await app.prisma.savedView.findUnique({ where: { id } })
    if (!view || view.userId !== userId) return res.notFound('No encontrado')

    await app.prisma.savedView.delete({ where: { id } })
    publishEvent(userId, { type: 'MUTATION', entity: 'SAVED_VIEW', action: 'DELETE' }).catch(console.error);
    return res.send({ ok: true })
  })
}
