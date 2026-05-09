import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { calculateProfileLimits } from '../services/profile-limits.js';
import { requireAuth, getCookieOpts } from '../utils/auth.js';

export async function profilesRoutes(app: FastifyInstance) {
  // GET / - List profiles
  app.get('/', {
    schema: {
      summary: 'List user profiles',
      response: {
        200: {
          type: 'object',
          properties: {
             profiles: { 
                 type: 'array',
                 items: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        isDefault: { type: 'boolean' },
                        color: { type: 'string', nullable: true },
                        avatar: { type: 'string', nullable: true }
                    }
                 }
             },
             limits: {
                 type: 'object',
                 properties: {
                     current: { type: 'number' },
                     max: { type: 'number' },
                     remaining: { type: 'number' },
                     canCreate: { type: 'boolean' },
                     baseLimit: { type: 'number' },
                     extraProfiles: { type: 'number' }
                 }
             }
          }
        }
      }
    }
  }, async (req, res) => {
    const auth = requireAuth(app, req, res);
    if (!auth) return;
    
    const profiles = await app.prisma.profile.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: 'asc' }
    });

    const limits = await calculateProfileLimits(auth.userId, app.prisma);
    
    return { profiles, limits };
  });

  // POST / - Create profile
  app.post('/', {
    schema: {
      summary: 'Create a new profile',
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1 },
          color: { type: 'string', nullable: true },
          avatar: { type: 'string', nullable: true },
          isDefault: { type: 'boolean' }
        }
      }
    }
  }, async (req, res) => {
    const auth = requireAuth(app, req, res);
    if (!auth) return;
    
    const { name, color, avatar, isDefault } = req.body as any;
    
    // Check if name exists
    const existing = await app.prisma.profile.findFirst({
      where: { userId: auth.userId, name }
    });
    
    if (existing) {
      return res.status(400).send({ error: 'Profile name already exists' });
    }
    
    const limits = await calculateProfileLimits(auth.userId, app.prisma);
    
    if (!limits.canCreate) {
         return res.status(400).send({ 
           error: 'Max profiles reached', 
           code: 'LIMIT_REACHED',
           current: limits.current,
           limit: limits.max,
           upgradeUrl: '/billing' 
         });
    }

    // If setting as default, unset others
    if (isDefault) {
      await app.prisma.profile.updateMany({
        where: { userId: auth.userId, isDefault: true },
        data: { isDefault: false }
      });
    }

    const profile = await app.prisma.profile.create({
      data: {
        userId: auth.userId,
        name,
        color,
        avatar,
        isDefault: isDefault || limits.current === 0 // Make default if it's the first one
      }
    });
    
    return profile;
  });

  // PUT /:id - Update profile
  app.put('/:id', {
    schema: {
      summary: 'Update a profile',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } }
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          color: { type: 'string', nullable: true },
          avatar: { type: 'string', nullable: true },
          isDefault: { type: 'boolean' }
        }
      }
    }
  }, async (req, res) => {
    const auth = requireAuth(app, req, res);
    if (!auth) return;
    const { id } = req.params as any;
    const { name, color, avatar, isDefault } = req.body as any;

    const profile = await app.prisma.profile.findUnique({ where: { id } });
    if (!profile || profile.userId !== auth.userId) {
      return res.status(404).send({ error: 'Profile not found' });
    }

    if (name && name !== profile.name) {
        const existing = await app.prisma.profile.findFirst({
            where: { userId: auth.userId, name, id: { not: id } }
        });
        if (existing) {
            return res.status(400).send({ error: 'Profile name already exists' });
        }
    }

    if (isDefault) {
        await app.prisma.profile.updateMany({
            where: { userId: auth.userId, isDefault: true },
            data: { isDefault: false }
        });
    }

    const updated = await app.prisma.profile.update({
        where: { id },
        data: {
            name: name ?? undefined,
            color: color ?? undefined,
            avatar: avatar ?? undefined,
            isDefault: isDefault ?? undefined
        }
    });

    return updated;
  });

  // DELETE /:id - Delete profile
  app.delete('/:id', {
      schema: {
          summary: 'Delete a profile',
          params: { type: 'object', properties: { id: { type: 'string' } } }
      }
  }, async (req, res) => {
      const auth = requireAuth(app, req, res);
      if (!auth) return;
      const { id } = req.params as any;

      const profile = await app.prisma.profile.findUnique({ 
          where: { id }
      });

      if (!profile || profile.userId !== auth.userId) {
          return res.status(404).send({ error: 'Profile not found' });
      }

      if (profile.isDefault) {
          // Check if there are other profiles to make default
          const otherProfile = await app.prisma.profile.findFirst({
              where: { userId: auth.userId, id: { not: id } }
          });
          
          if (!otherProfile) {
               return res.status(400).send({ error: 'Cannot delete the only profile' });
          }
          
          // Make the other profile default
          await app.prisma.profile.update({
              where: { id: otherProfile.id },
              data: { isDefault: true }
          });
      }

      // Clear default payment method references to avoid FK violation
      await app.prisma.user.updateMany({ 
          where: { defaultPaymentMethod: { profileId: id } },
          data: { defaultPaymentMethodId: null }
      });

      // Delete profile (cascade handles related records)
      try {
          await app.prisma.profile.delete({ where: { id } });
      } catch (e: any) {
          if (e.code === 'P2025') return res.status(404).send({ error: 'Profile not found' });
          throw e;
      }

      // If we deleted the active profile, we must update the session cookie immediately
      if (id === auth.profileId) {
          // Find the new default profile (which was set in the transaction if needed)
          const defaultProfile = await app.prisma.profile.findFirst({
              where: { userId: auth.userId, isDefault: true }
          });
          
          if (defaultProfile) {
              const newToken = app.jwt.sign({ sub: auth.userId, userId: auth.userId, profileId: defaultProfile.id, type: 'session' }, { expiresIn: '7d' });
              const opts = getCookieOpts(req);
              res.setCookie('session', newToken, opts);
          }
      }

      return { success: true };
  });
}
