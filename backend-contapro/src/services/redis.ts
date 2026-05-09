import type { FastifyInstance } from 'fastify';
import Redis from 'ioredis';
import { config } from '../config.js';

let client: Redis | null = null;

export function getRedis(app?: FastifyInstance): Redis | null {
  if (client) return client;
  if (!config.redisUrl || !config.queuesEnabled) {
    app?.log.info('redis: no configurado o colas deshabilitadas');
    return null;
  }
  try {
    // BullMQ requiere maxRetriesPerRequest = null para operaciones bloqueantes
    client = new Redis(config.redisUrl, { maxRetriesPerRequest: null as any });
    client.on('error', (e) => app?.log.error({ msg: 'redis error', e }));
    client.on('connect', () => app?.log.info('redis: conectado'));
    return client;
  } catch (e) {
    app?.log.error({ msg: 'redis init failed', e });
    return null;
  }
}

export async function closeRedis() {
  try { await client?.quit(); } catch {}
  client = null;
}