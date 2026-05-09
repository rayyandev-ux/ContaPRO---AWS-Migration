import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Please provide an email.");
    process.exit(1);
  }

  const user = await prisma.user.update({
    where: { email },
    data: { role: 'ADMIN' },
  });

  console.log(`User ${user.email} promoted to ADMIN.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
