import { FastifyInstance } from 'fastify';
import { Worker } from 'bullmq';
import { NotificationService } from '../services/notifications.js';

export function setupPushNotificationWorker(app: FastifyInstance, connection: any) {
  const notifier = new NotificationService(app);

  const worker = new Worker(
    'push-notification',
    async (job) => {
      app.log.info({ msg: 'Processing push notification', jobId: job.id, name: job.name });
      
      try {
        if (job.name === 'email_receipt') {
          const { expenseId, userId } = job.data;
          
          if (!expenseId) {
            app.log.warn({ msg: 'Missing expenseId in push notification job', jobId: job.id });
            return;
          }

          // If the job is meant to notify about a single registered expense
          await notifier.notifyExpenseRegistered(expenseId);
          app.log.info({ msg: 'Push notification sent for expense', expenseId, userId });
        } else if (job.name === 'pending_expense_batch') {
          const { pendingNotificationIds, userId } = job.data;
          if (pendingNotificationIds && pendingNotificationIds.length > 0) {
            await notifier.notifyPendingExpensesBatch(pendingNotificationIds);
            app.log.info({ msg: 'Push notification sent for pending batch', userId, count: pendingNotificationIds.length });
          }
        }
      } catch (err) {
        app.log.error({ msg: 'Error in push notification worker', err });
        throw err;
      }
    },
    { connection }
  );

  worker.on('failed', (job, err) => {
    app.log.error({ msg: 'Push notification job failed', jobId: job?.id, err });
  });

  return worker;
}
