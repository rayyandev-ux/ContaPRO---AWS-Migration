import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Actualizando preferencias de notificaciones a todos los usuarios existentes...');
    const result = await prisma.user.updateMany({
        where: {},
        data: {
            notifyEmailExpenseWhatsApp: true,
            notifyEmailExpenseTelegram: true,
            reportFrequency: 'DAILY'
        }
    });

    console.log(`¡Éxito! Se actualizaron ${result.count} usuarios.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
