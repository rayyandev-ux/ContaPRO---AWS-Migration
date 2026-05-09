
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
async function main() {
  console.log('Resetting ignored emails from last 24h...');
  
  const since = new Date();
  since.setHours(since.getHours() - 24);

  const ignored = await prisma.pendingExpense.findMany({
    where: { 
        status: 'IGNORED',
        date: { gte: since }
    }
  });

  console.log(`Found ${ignored.length} IGNORED expenses.`);

  for (const record of ignored) {
      console.log(`Deleting IGNORED record for ${record.sourceId} to allow re-scan...`);
      await prisma.pendingExpense.delete({
          where: { id: record.id }
      });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
