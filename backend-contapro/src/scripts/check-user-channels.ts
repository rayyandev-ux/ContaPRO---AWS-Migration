
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const userId = 'f29a0d33-92a1-4433-ac9e-896b1b44b106';

async function main() {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { 
        email: true, 
        telegramId: true, 
        whatsappPhone: true,
        whatsappLinkedAt: true
    }
  });

  console.log('User Channels:', user);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
