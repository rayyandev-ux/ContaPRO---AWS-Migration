import { describe, it, expect, beforeAll } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import crypto from 'node:crypto';
import { authRoutes } from '../src/routes/auth';

describe('auth', () => {
  const app = Fastify();
  beforeAll(async () => {
    const mem = new Map<string, any>();
    const prismaStub = {
      user: {
        findUnique: async ({ where }: any) => {
          if (where?.email) return mem.get(where.email) || null;
          if (where?.id) {
            for (const u of mem.values()) if (u.id === where.id) return u;
            return null;
          }
          return null;
        },
        findFirst: async ({ where }: any) => {
          const or = (where?.OR || []) as any[];
          const googleId = or[0]?.googleId;
          const email = or[1]?.email;
          for (const u of mem.values()) {
            if ((googleId && (u as any).googleId === googleId) || (email && (u as any).email === email)) return u;
          }
          return null;
        },
        create: async ({ data }: any) => {
          const u = { id: crypto.randomUUID(), ...data };
          mem.set(u.email, u);
          return u;
        },
        update: async ({ where, data, select }: any) => {
          let u = (await (prismaStub as any).user.findUnique({ where })) as any;
          if (!u) throw new Error('User not found');
          u = { ...u, ...data };
          mem.set(u.email, u);
          if (select) {
            const out: any = {};
            for (const k of Object.keys(select)) if (select[k]) out[k] = (u as any)[k];
            return out;
          }
          return u;
        },
      },
    } as any;
    (app as any).decorate('prisma', prismaStub);
    await app.register(cookie);
    await app.register(jwt, { secret: 'test-secret' });
    await app.register(authRoutes, { prefix: '/api/auth' });
  });

  it('registers and logs in', async () => {
    const email = `test${Math.random()}@example.com`;
    const reg = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email, password: '123456' } });
    expect(reg.statusCode).toBe(200);
    await (app as any).prisma.user.update({ where: { email }, data: { emailVerified: true } });
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password: '123456' } });
    expect(login.statusCode).toBe(200);
  });
});