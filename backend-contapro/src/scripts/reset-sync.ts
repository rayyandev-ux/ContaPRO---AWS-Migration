import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Resetting lastSync for all email integrations to force re-scan...');
  
  // Reset lastSync to 24 hours ago for all active integrations
  // This ensures the next scan cycle picks up emails from the last day
  const yesterday = new Date();
  yesterday.setHours(yesterday.getHours() - 24);

  const result = await prisma.emailIntegration.updateMany({
    where: { isActive: true },
    data: { lastSync: yesterday }
  });

  console.log(`Updated ${result.count} integrations. Next scan will check emails from: ${yesterday.toISOString()}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());