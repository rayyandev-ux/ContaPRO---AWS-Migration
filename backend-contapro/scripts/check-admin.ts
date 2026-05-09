import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { email: true, name: true, id: true }
  });

  if (admins.length === 0) {
    console.log("No admins found.");
    console.log("To promote a user, run: npx tsx scripts/promote-admin.ts <email>");
  } else {
    console.log("Admins found:", admins);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
