import type { FastifyPluginAsync } from 'fastify';
import { config } from '../config.js';

export const configRoutes: FastifyPluginAsync = async (app) => {
  app.get('/public', { schema: { summary: 'Get public configuration' } }, async (req, res) => {
    return res.send({
      ok: true,
      frontendUrl: config.frontendUrl,
    });
  });
};
