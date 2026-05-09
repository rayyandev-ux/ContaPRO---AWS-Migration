
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const userId = 'f29a0d33-92a1-4433-ac9e-896b1b44b106';

async function monitor() {
  console.log('👀 Monitoring for new emails/expenses for user:', userId);
  console.log('Send your email now...');

  // Get initial counts
  let initialPending = await prisma.pendingExpense.count({ where: { userId } });
  let initialExpenses = await prisma.expense.count({ where: { userId } });

  setInterval(async () => {
    try {
      const currentPending = await prisma.pendingExpense.count({ where: { userId } });
      const currentExpenses = await prisma.expense.count({ where: { userId } });

      if (currentPending > initialPending) {
        console.log('🚨 NEW PENDING EXPENSE DETECTED!');
        const newPending = await prisma.pendingExpense.findFirst({
            where: { userId },
            orderBy: { date: 'desc' }
        });
        console.log(newPending);
        initialPending = currentPending;
      }

      if (currentExpenses > initialExpenses) {
        console.log('✅ NEW EXPENSE REGISTERED!');
        const newExpense = await prisma.expense.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        });
        console.log(newExpense);
        initialExpenses = currentExpenses;
      }
      
      // Optional: Check integration lastSync to see if it updated
      const integration = await prisma.emailIntegration.findFirst({
          where: { userId, provider: 'GMAIL' }
      });
      if (integration) {
          // console.log('Last sync:', integration.lastSync);
      }

    } catch (e) {
      console.error('Error polling:', e);
    }
  }, 2000); // Check every 2 seconds
}

monitor();
