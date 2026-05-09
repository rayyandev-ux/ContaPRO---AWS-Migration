
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateDataToProfiles() {
  console.log('🚀 Iniciando migración de datos a perfiles...');

  // 1. Obtener todos los usuarios
  const users = await prisma.user.findMany({
    include: {
      profiles: true,
    },
  });

  console.log(`📊 Encontrados ${users.length} usuarios para procesar.`);

  for (const user of users) {
    try {
      console.log(`\n👤 Procesando usuario: ${user.email} (${user.id})`);

      // 2. Verificar si ya tiene perfil default
      let defaultProfile = user.profiles.find(p => p.isDefault);

      if (!defaultProfile) {
        console.log('   ✨ Creando perfil por defecto...');
        defaultProfile = await prisma.profile.create({
          data: {
            userId: user.id,
            name: user.name || 'Mi Perfil', // Nombre del perfil = nombre del usuario o "Mi Perfil"
            isDefault: true,
            color: '#7c3aed', // Color violeta default
            avatar: 'default',
          },
        });
        console.log(`   ✅ Perfil creado: ${defaultProfile.id}`);
      } else {
        console.log(`   ℹ️ Ya tiene perfil por defecto: ${defaultProfile.id}`);
      }

      const profileId = defaultProfile.id;

      // 3. Migrar Datos (Expenses)
      const expensesCount = await prisma.expense.updateMany({
        where: { userId: user.id, profileId: null },
        data: { profileId },
      });
      console.log(`   💸 Gastos migrados: ${expensesCount.count}`);

      // 4. Migrar Budgets
      const budgetsCount = await prisma.budget.updateMany({
        where: { userId: user.id, profileId: null },
        data: { profileId },
      });
      console.log(`   💰 Presupuestos migrados: ${budgetsCount.count}`);

      // 5. Migrar BudgetLogs
      const budgetLogsCount = await prisma.budgetLog.updateMany({
        where: { userId: user.id, profileId: null },
        data: { profileId },
      });
      console.log(`   📝 Logs de presupuesto migrados: ${budgetLogsCount.count}`);

      // 6. Migrar Categories
      // Nota: Categories tienen unique constraints, hay que tener cuidado.
      // Vamos a actualizar las que no tengan profileId
      const categories = await prisma.category.findMany({
        where: { userId: user.id, profileId: null },
      });
      
      let categoriesMigrated = 0;
      for (const cat of categories) {
        // Verificar si ya existe esa categoría en ese perfil (para evitar colisión unique)
        const exists = await prisma.category.findFirst({
            where: { profileId, name: cat.name }
        });

        if (!exists) {
            await prisma.category.update({
                where: { id: cat.id },
                data: { profileId }
            });
            categoriesMigrated++;
        } else {
            // Si ya existe (caso raro), podríamos borrar la duplicada sin profile o dejarla.
            // Por seguridad, la dejamos pero logueamos.
            console.warn(`   ⚠️ Categoría duplicada omitida: ${cat.name}`);
        }
      }
      console.log(`   🏷️ Categorías migradas: ${categoriesMigrated}`);

      // 7. Migrar PaymentMethods
      const paymentMethods = await prisma.paymentMethod.findMany({
        where: { userId: user.id, profileId: null },
      });

      let pmMigrated = 0;
      for (const pm of paymentMethods) {
         const exists = await prisma.paymentMethod.findFirst({
            where: { profileId, name: pm.name }
         });
         
         if (!exists) {
            await prisma.paymentMethod.update({
                where: { id: pm.id },
                data: { profileId }
            });
            pmMigrated++;
         }
      }
      console.log(`   💳 Métodos de pago migrados: ${pmMigrated}`);

      /* 
      // 8. Migrar PaymentMethodBudgets (Eliminado)
      // 9. Migrar CategoryBudgets (Eliminado)
      */

      // 10. Migrar SavingsGoals
      const savingsCount = await prisma.savingsGoal.updateMany({
        where: { userId: user.id, profileId: null },
        data: { profileId },
      });
      console.log(`   🐷 Metas de ahorro migradas: ${savingsCount.count}`);

       // 11. Migrar Documents
       const documentsCount = await prisma.document.updateMany({
        where: { userId: user.id, profileId: null },
        data: { profileId },
      });
      console.log(`   📄 Documentos migrados: ${documentsCount.count}`);

    } catch (error) {
      console.error(`❌ Error procesando usuario ${user.id}:`, error);
    }
  }

  console.log('\n🏁 Migración completada.');
}

migrateDataToProfiles()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
