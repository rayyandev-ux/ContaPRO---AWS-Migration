
import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { NotificationService } from '../services/notifications.js';
import { TelegramService } from '../services/telegram.js';
import { WhatsAppService } from '../services/whatsapp.js';
import { config } from '../config.js';

// Mock Fastify App structure
const prisma = new PrismaClient();
const app: any = {
  prisma,
  log: { info: console.log, error: console.error, warn: console.warn },
  jwt: { verify: () => {} }
};

async function main() {
  // Setup Services
  if (config.telegramBotToken) {
    app.telegram = new TelegramService(app as any, config.telegramBotToken);
  }
  
  if (config.wazendApiBase && config.wazendApiToken && config.whatsappNumber) {
    app.whatsapp = new WhatsAppService(app as any);
  }

  const notifier = new NotificationService(app as any);
  const pendingId = 'd375c859-75fa-4d29-81d3-2e908ecdd1df';

  console.log('Attempting to send notification for pending expense:', pendingId);
  
  try {
    await notifier.notifyPendingExpense(pendingId);
    console.log('Notification function executed successfully.');
  } catch (e) {
    console.error('Notification failed:', e);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
