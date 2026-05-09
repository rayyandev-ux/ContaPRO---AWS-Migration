
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Diagnosing Pending Expenses...');

    // 1. List all users with pending expenses
    const usersWithPending = await prisma.pendingExpense.groupBy({
        by: ['userId'],
        where: { status: 'WAITING_USER' },
        _count: true
    });

    console.log('Users with WAITING_USER expenses:', usersWithPending);

    // 2. Detail for each user
    for (const group of usersWithPending) {
        const expenses = await prisma.pendingExpense.findMany({
            where: { userId: group.userId },
            orderBy: { date: 'desc' }
        });
        
        console.log(`\nUser ${group.userId}:`);
        expenses.forEach(e => {
            console.log(`- [${e.status}] ${e.id} | ${e.merchant} | ${e.amount} ${e.currency} | Date: ${e.date.toISOString()} | Screenshot: ${e.screenshotPath}`);
        });
    }

    // 3. Check for specific logs if possible (not possible via script, relying on user output)
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
