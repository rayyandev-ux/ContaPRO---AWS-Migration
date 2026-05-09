import type { FastifyInstance } from 'fastify';
import { Queue } from 'bullmq';
import { getRedis } from './redis.js';

let analysisQueue: Queue | null = null;
let pushNotificationQueue: Queue | null = null;

export function initQueues(app: FastifyInstance) {
  const connection = getRedis(app);
  if (!connection) {
    app.log.info('queues: deshabilitadas (sin redis)');
    return { analysisQueue: null, pushNotificationQueue: null };
  }
  analysisQueue = new Queue('analysis', { connection });
  pushNotificationQueue = new Queue('push-notification', { connection });
  
  // Cola de escaneo de emails (Job recurrente cada X minutos)
  // Nota: BullMQ Pro tiene soporte nativo para cron jobs, en Community usamos 'repeat'
  const emailScannerQueue = new Queue('email-scanner', { connection });

  app.log.info('queues: analysis, email-scanner & push-notification initialized');
  return { analysisQueue, emailScannerQueue, pushNotificationQueue, connection };
}

export function getAnalysisQueue() {
  return analysisQueue;
}

export function getPushNotificationQueue() {
  return pushNotificationQueue;
}