import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config.js';

import { getCognitoVerifier } from '../services/aws.js';

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

/**
 * Extrae el token de autenticación de una petición, en orden de prioridad:
 *   1. Header Authorization (Bearer)      -> flujo normal
 *   2. Header X-Id-Token                   -> IMPRESCINDIBLE detrás de API Gateway:
 *      el HTTP API descarta el header Authorization y no permite remapearlo,
 *      así que el frontend envía el mismo token también en X-Id-Token.
 *   3. Cookie de sesión                    -> compatibilidad con el dashboard antiguo
 *   4. Query param ?token=                 -> usado por algunos webhooks/callbacks
 */
export function extractToken(req: FastifyRequest): string | undefined {
  const strip = (v: unknown) => (v ? String(v).replace(/^Bearer\s+/i, '') : undefined);
  return (
    strip(req.headers.authorization) ??
    strip(req.headers['x-id-token']) ??
    (req as any).cookies?.session ??
    (req.query as any)?.token
  );
}

export async function requireAuth(app: FastifyInstance, req: FastifyRequest | any, res: FastifyReply | any): Promise<{ userId: string, profileId: string } | null> {
  const token = extractToken(req);

  if (!token) {
    res.unauthorized('No autenticado');
    return null;
  }
  
  try {
    const cognitoVerifier = getCognitoVerifier();
    if (cognitoVerifier) {
      try {
        const payload = await cognitoVerifier.verify(token);
        const email = (payload as any).email;
        if (!email) {
          app.log.warn('Cognito ID token missing email claim');
          res.unauthorized('Token inválido');
          return null;
        }
        const user = await app.prisma.user.findUnique({ where: { email } });
        if (!user) {
          res.unauthorized('Usuario no encontrado');
          return null;
        }
        const profile = await app.prisma.profile.findFirst({
          where: { userId: user.id, isDefault: true }
        });
        if (!profile) {
          res.unauthorized('Perfil no encontrado');
          return null;
        }
        return { userId: user.id, profileId: profile.id };
      } catch (err) {
        // Si falla Cognito, quizás es un token legacy (fallback local)
        app.log.warn('Cognito JWT verification failed, falling back to local JWT: ' + (err as Error).message);
      }
    }

    const payload = app.jwt.verify(token) as { sub: string; profileId?: string };
    if (!payload.profileId) {
      res.unauthorized('Sesión antigua. Por favor inicie sesión nuevamente.');
      return null;
    }
    return { userId: payload.sub, profileId: payload.profileId };
  } catch (err) {
    // Clear cookie to avoid infinite 401 loops si es que se usó
    res.clearCookie('session', getCookieOpts(req));
    res.unauthorized('Token inválido');
    return null;
  }
}
