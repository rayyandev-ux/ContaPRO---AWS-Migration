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

export async function requireAuth(app: FastifyInstance, req: FastifyRequest | any, res: FastifyReply | any): Promise<{ userId: string, profileId: string } | null> {
  let token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    // Fallback a cookie por si hay dependencias temporales en el dashboard antiguo
    token = req.cookies.session;
  }
  
  if (!token) {
    res.unauthorized('No autenticado');
    return null;
  }
  
  try {
    const cognitoVerifier = getCognitoVerifier();
    if (cognitoVerifier) {
      try {
        const payload = await cognitoVerifier.verify(token);
        // En Cognito, userId suele ser `sub` o un atributo personalizado
        const userId = payload.sub;
        // Asumimos que profileId viene como atributo custom (ej. custom:profileId) o buscamos el default
        // Si no viene, tendríamos que buscarlo en DB. Como aquí solo devolvemos el string, 
        // pasamos el custom claim o un fallback.
        const profileId = (payload as any)['custom:profileId'];
        
        if (!profileId) {
          // Si no hay profileId en el token de Cognito, buscaremos el default en la DB usando Prisma
          const profile = await app.prisma.profile.findFirst({
            where: { userId, isDefault: true }
          });
          if (!profile) {
            res.unauthorized('Perfil no encontrado');
            return null;
          }
          return { userId, profileId: profile.id };
        }
        return { userId, profileId };
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
