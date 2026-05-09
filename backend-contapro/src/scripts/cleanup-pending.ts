
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const userId = 'f29a0d33-92a1-4433-ac9e-896b1b44b106';

async function main() {
  console.log('Cleaning up old WAITING_USER pending expenses...');
  const { count } = await prisma.pendingExpense.deleteMany({
    where: { 
        userId, 
        status: 'WAITING_USER' 
    }
  });
  console.log(`Deleted ${count} pending expenses.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
