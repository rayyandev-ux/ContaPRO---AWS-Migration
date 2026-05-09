import { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../utils/auth.js';
import { subscribeToUserEvents } from '../services/realtime.js';

export const streamRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (req, res) => {
    const auth = requireAuth(app, req, res);
    if (!auth) return;

    res.raw.setHeader('Content-Type', 'text/event-stream');
    res.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    res.raw.setHeader('Connection', 'keep-alive');
    res.raw.flushHeaders();

    // Ping inicial para asegurar que la conexión se mantenga viva
    res.raw.write(`data: {"type":"PING"}\n\n`);

    // Ping cada 30 segundos para evitar timeouts de proxies/ELB
    const pingInterval = setInterval(() => {
      res.raw.write(`data: {"type":"PING"}\n\n`);
    }, 30000);

    const unsubscribe = subscribeToUserEvents(auth.userId, (msg) => {
      res.raw.write(`data: ${msg}\n\n`);
    });

    req.raw.on('close', () => {
      clearInterval(pingInterval);
      unsubscribe();
    });
  });
};
