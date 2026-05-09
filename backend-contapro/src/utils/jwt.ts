import jwt from 'jsonwebtoken';
import { config } from '../config.js';

const JWT_SECRET = config.jwtSecret;

export function generateMagicToken(userId: string, expiresIn: string | number = '24h', profileId?: string): string {
  const payload: any = { userId, action: 'activate_trial' };
  if (profileId) payload.profileId = profileId;
  return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresIn as any });
}

export function verifyMagicToken(token: string): { userId: string; action: string; profileId?: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; action: string; profileId?: string };
    return decoded;
  } catch (error) {
    return null;
  }
}

export function generateSessionToken(userId: string, profileId: string, expiresIn: string | number = '7d'): string {
  return jwt.sign({ sub: userId, userId, profileId, type: 'session' }, JWT_SECRET, { expiresIn: expiresIn as any });
}

export function verifySessionToken(token: string): { userId: string; profileId: string; type: 'session'; sub: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.type !== 'session') return null;
    return decoded;
  } catch (error) {
    return null;
  }
}
