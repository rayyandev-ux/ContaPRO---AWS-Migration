import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando correccion de precios y limpieza de datos...');

  // 1. Actualizar configuración de precios locales (PlanSetting)
  const plans = [
    { period: 'MONTHLY', name: 'Plan Mensual', priceUsd: 8.9 },
    { period: 'ANNUAL', name: 'Plan Anual', priceUsd: 49.9 },
    { period: 'LIFETIME', name: 'Plan Lifetime', priceUsd: 69.9 }
  ];

  for (const plan of plans) {
    await prisma.planSetting.upsert({
      where: { period: plan.period },
      update: { priceUsd: plan.priceUsd },
      create: {
        period: plan.period,
        name: plan.name,
        priceUsd: plan.priceUsd,
        active: true
      }
    });
    console.log(`Configuracion local actualizada: ${plan.period} -> $${plan.priceUsd}`);
  }

  // 2. Limpiar pagos basura del historial local
  const badAmounts = [5, 20];
  const deletedBad = await prisma.payment.deleteMany({
    where: {
      amount: { in: badAmounts }
    }
  });
  console.log(`Eliminados ${deletedBad.count} pagos incorrectos (${badAmounts.join(', ')} USD) de la base de datos local.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });