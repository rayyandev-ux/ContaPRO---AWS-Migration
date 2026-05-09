import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config.js';

export function getCookieOpts(req: FastifyRequest | any) {
  const isProd = process.env.NODE_ENV === 'production';
  const host = String(req.headers?.host || '').split(':')[0];
  const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
  const cfgDomain = (config.cookieDomain || '').trim();
  const domain = cfgDomain && cfgDomain !== 'localhost' && host.endsWith(cfgDomain) ? cfgDomain : undefined;
  const sameSite: 'lax' | 'none' = isLocalHost ? 'lax' : 'none';
  return {
    httpOnly: true,
    sameSite,
    path: '/',
    secure: isProd,
    domain,
  };
}

export function requireAuth(app: FastifyInstance, req: FastifyRequest | any, res: FastifyReply | any): { userId: string, profileId: string } | null {
  const token = req.cookies.session;
  if (!token) {
    res.unauthorized('No autenticado');
    return null;
  }
  try {
    const payload = app.jwt.verify(token) as { sub: string; profileId?: string };
    if (!payload.profileId) {
      res.unauthorized('Sesión antigua. Por favor inicie sesión nuevamente.');
      return null;
    }
    return { userId: payload.sub, profileId: payload.profileId };
  } catch (err) {
    // Clear cookie to avoid infinite 401 loops
    res.clearCookie('session', getCookieOpts(req));
    res.unauthorized('Token inválido');
    return null;
  }
}
