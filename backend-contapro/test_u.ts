import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
p.user.findFirst({ where: { email: 'ra.yya.nthepro1.23@gmail.com' } }).then(console.log).finally(() => p.$disconnect());