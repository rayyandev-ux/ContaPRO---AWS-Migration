
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const userId = 'f29a0d33-92a1-4433-ac9e-896b1b44b106';
const msgId = '19c3b67693a4acb6';

async function main() {
  const pending = await prisma.pendingExpense.findFirst({
    where: { userId, sourceId: msgId }
  });

  if (pending) {
    console.log('Found PendingExpense:', pending);
  } else {
    console.log('No PendingExpense found for this message ID.');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
