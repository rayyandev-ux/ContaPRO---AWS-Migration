import 'dotenv/config';
import fastify from 'fastify';
import { DailyReportJob } from '../src/jobs/DailyReportJob.js';
import { PrismaClient } from '@prisma/client';
import { ImageGeneratorService } from '../src/services/image-generator.js';
import { config } from '../src/config.js';

// Setup minimal app context
const app = fastify({ logger: true });
const prisma = new PrismaClient();
app.decorate('prisma', prisma);

const TARGET_PHONE = '51924172652'; // Format for Evolution API / WhatsApp

async function runTest() {
    try {
        console.log(`Starting manual report generation for phone: ${TARGET_PHONE}`);
        
        // Find the user by phone to get their real data
        const user = await prisma.user.findFirst({
            where: { whatsappPhone: { contains: TARGET_PHONE } }
        });

        if (!user) {
            console.log(`User with phone ${TARGET_PHONE} not found in DB. Creating dummy data report...`);
            await sendDummyReport();
            return;
        }

        console.log(`User found: ${user.name} (${user.id})`);
        
        // We will execute the exact same logic as DailyReportJob but forced for this user
        const job = new DailyReportJob(app as any);
        
        // Override the processReports to just process this single user for testing
        // To avoid rewriting the whole logic, we can just call processReports and 
        // rely on it, but it processes ALL users. 
        // Let's create a specific test function in the job or just do it here.
        
        const today = new Date();
        const startOfDay = new Date(today.setHours(0, 0, 0, 0));
        const endOfDay = new Date(today.setHours(23, 59, 59, 999));

        const expenses = await prisma.expense.findMany({
            where: {
                userId: user.id,
                issuedAt: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            },
            include: { category: true }
        });

        console.log(`Found ${expenses.length} expenses for today.`);

        let totalAmount = 0;
        let highestExpense = null;
        const categoryMap: Record<string, number> = {};

        for (const exp of expenses) {
            const amount = exp.amountNative ?? exp.amount;
            totalAmount += amount;

            if (!highestExpense || amount > highestExpense.amount) {
                highestExpense = {
                    amount,
                    category: exp.category?.name || 'Varios'
                };
            }

            const catName = exp.category?.name || 'Varios';
            categoryMap[catName] = (categoryMap[catName] || 0) + amount;
        }

        const categoriesList = Object.entries(categoryMap)
            .map(([name, amount]) => ({
                name,
                amount,
                percentage: totalAmount > 0 ? (amount / totalAmount) * 100 : 0
            }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 4);

        const reportData = {
            date: new Date().toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
            currency: user.preferredCurrency || 'PEN',
            totalAmount,
            highestExpense,
            categories: categoriesList,
            // Access private method using any
            tip: (job as any).getDailyTip(highestExpense?.category || '', totalAmount),
            totalBalance: 1500,
            monthlyIncome: 3000,
            monthlyExpense: 1500,
            budgetAmount: 2000,
            topPaymentMethod: { name: "Efectivo", amount: 1500 },
            savingsGoal: null,
            weeklyTrend: -5.2,
            antExpenseRatio: 12.5,
            pendingCount: 2
        };

        console.log('Generating image...');
        const imageService = new ImageGeneratorService(app as any);
        const imageBuffer = await imageService.generateDailySummaryImage(reportData as any);
        
        console.log('Sending WhatsApp message...');
        // Mock config for testing if env vars are missing
        if (!config.wazendApiBase) {
            console.log('⚠️ WAZEND_API_BASE is missing in .env. Skipping actual API call.');
        } else {
            await job.sendWhatsAppImage(TARGET_PHONE, imageBuffer, `¡Hola ${user.name ? user.name.split(' ')[0] : ''}! 🛠️ Este es un reporte de prueba manual de ContaPRO.`);
        }
        
        // Save image to disk to verify it looks good
        const fs = await import('fs');
        fs.writeFileSync('test-report.png', imageBuffer);
        console.log('🖼️  Image saved to test-report.png for preview.');
        
        console.log('✅ Test completed successfully!');

    } catch (error) {
        console.error('❌ Error running test:', error);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}

async function sendDummyReport() {
    const job = new DailyReportJob(app as any);
    const imageService = new ImageGeneratorService(app as any);
    
    const reportData = {
        date: new Date().toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        currency: 'PEN',
        totalAmount: 150.50,
        highestExpense: { amount: 80, category: 'Comida' },
        categories: [
            { name: 'Comida', amount: 80, percentage: 53 },
            { name: 'Transporte', amount: 40, percentage: 26 },
            { name: 'Otros', amount: 30.50, percentage: 21 }
        ],
        tip: "Hoy tu mayor gasto fue en comida. ¡Preparar en casa un par de días a la semana hace una gran diferencia!",
        totalBalance: 1500,
        monthlyIncome: 3000,
        monthlyExpense: 1500,
        budgetAmount: 2000,
        topPaymentMethod: { name: "Efectivo", amount: 1500 },
        savingsGoal: null,
        weeklyTrend: -5.2,
        antExpenseRatio: 12.5,
        pendingCount: 2
    };

    console.log('Generating dummy image...');
    const imageBuffer = await imageService.generateDailySummaryImage(reportData as any);
    
    console.log('Sending WhatsApp message...');
    await job.sendWhatsAppImage(TARGET_PHONE, imageBuffer, `¡Hola! 🛠️ Este es un reporte de prueba generado con datos de ejemplo.`);
    console.log('✅ Dummy test completed successfully!');
}

runTest();