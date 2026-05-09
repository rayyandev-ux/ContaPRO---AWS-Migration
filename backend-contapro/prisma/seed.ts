import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const defaultCategories = [
  "💬 Redes Sociales",
  "📺 Streaming",
  "🎵 Música",
  "🤖 IA",
  "⚡ Productividad",
  "💻 Desarrollo",
  "☁️ Almacenamiento",
  "🛵 Delivery",
  "🔗 Internet",
  "💰 Finanzas",
  "🔄 Transferencia",
  "🏆 Gimnasio",
  "👶 Hijos",
  "🌐 Hobbies",
  "📧 Inversiones",
  "🔧 Mantenimiento",
  "🐾 Mascotas",
  "🔶 Otros",
  "🏛️ Prestamos",
  "🎁 Regalos",
  "👕 Ropa",
  "💊 Salud",
  "🔒 Seguros",
  "📋 Servicios",
  "📱 Subscripciones",
  "🛒 Supermercado",
  "💳 Tarjetas",
  "💛 Ahorros",
  "🚌 Transporte",
  "🌴 Vacaciones",
  "🏠 Vivienda",
  "👜 Emprendimiento",
  "👫 Pareja",
  "🔄 Reconciliación de cuenta",
  "💼 Trabajo",
  "🚗 Auto",
  "🍽️ Comida",
  "⛽ Combustible",
  "🎨 Decoración",
  "⚽ Deportes",
  "💛 Donaciones",
  "📚 Educación",
  "🎭 Entretenimiento",
  "🅿️ Estacionamiento",
  "💊 Farmacia"
]

async function main() {
  console.log('Seeding default categories...')

  // Delete existing default categories first to avoid duplicates
  await prisma.category.deleteMany({
    where: { userId: null, profileId: null }
  })

  for (const name of defaultCategories) {
    await prisma.category.create({
      data: {
        name,
        userId: null,
        profileId: null
      }
    })
    console.log(`Added category: ${name}`)
  }

  console.log('Seeding completed successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
