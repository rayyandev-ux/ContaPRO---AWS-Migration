import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const userId = 'f29a0d33-92a1-4433-ac9e-896b1b44b106';
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  console.log('User:', user);
  const now = new Date();
  console.log('Now:', now);
  if (user) {
      console.log('Trial Ends:', user.trialEnds);
      console.log('Plan Expires:', user.planExpires);
      console.log('Is Trial Active?', user.trialEnds && user.trialEnds > now);
      console.log('Is Plan Active?', user.planExpires && user.planExpires > now);
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
