
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Checking LIFETIME users...');
  const users = await prisma.user.findMany({
    where: {
      plan: 'LIFETIME'
    },
    select: {
      id: true,
      email: true,
      plan: true,
      planExpires: true,
      trialEnds: true
    }
  });

  console.log(`Found ${users.length} LIFETIME users.`);
  users.forEach(u => {
    console.log(`- ${u.email} (${u.id}): Plan=${u.plan}, Expires=${u.planExpires}`);
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
