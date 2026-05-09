
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const msgId = '19c3b74a3a592baa';

async function main() {
  const record = await prisma.pendingExpense.findFirst({
    where: { sourceId: msgId }
  });

  console.log('Record found:', record);

  if (record && record.status === 'IGNORED') {
      console.log('Deleting IGNORED record to allow re-scan...');
      await prisma.pendingExpense.delete({
          where: { id: record.id }
      });
      console.log('Deleted.');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
