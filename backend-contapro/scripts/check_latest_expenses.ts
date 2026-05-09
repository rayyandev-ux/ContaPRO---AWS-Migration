import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const expenses = await prisma.expense.findMany({
    orderBy: {
      createdAt: 'desc',
    },
    take: 5,
    include: {
        category: true,
        user: true
    }
  });

  console.log('Last 5 expenses:');
  expenses.forEach(e => {
    console.log(`ID: ${e.id}, UserID: ${e.userId}, User: ${e.user.email}, Amount: ${e.amount} ${e.currency}, CreatedAt: ${e.createdAt.toISOString()}`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
