
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Checking PREMIUM users...');
  const users = await prisma.user.findMany({
    where: {
      plan: 'PREMIUM'
    },
    select: {
      id: true,
      email: true,
      plan: true,
      planExpires: true
    }
  });

  console.log(`Found ${users.length} PREMIUM users.`);
  users.forEach(u => {
    console.log(`- ${u.email}: Plan=${u.plan}, Expires=${u.planExpires}`);
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
