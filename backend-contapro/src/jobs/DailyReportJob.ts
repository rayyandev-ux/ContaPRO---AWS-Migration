import cron from 'node-cron';
import { FastifyInstance } from 'fastify';
import { ImageGeneratorService } from '../services/image-generator.js';
import { CurrencyService } from '../services/currency.js';
import { formatDMY } from '../utils/format.js';
import { config } from '../config.js';
import axios from 'axios';

export class DailyReportJob {
    private app: FastifyInstance;
    private imageService: ImageGeneratorService;
    private currencyService: CurrencyService;

    constructor(app: FastifyInstance) {
        this.app = app;
        this.imageService = new ImageGeneratorService(app);
        this.currencyService = new CurrencyService(app);
    }

    start() {
        // Ejecutar todos los días a las 23:50 (Hora local del servidor)
        cron.schedule('50 23 * * *', async () => {
            this.app.log.info('Starting Daily Report Job...');
            await this.processReports();
        });
        this.app.log.info('Daily Report Job scheduled at 23:50 daily.');
    }

    private getDailyTip(highestCategory: string, total: number): string {
        const tips = [
            "Evita los gastos hormiga: esos pequeños consumos diarios suman mucho al final del mes.",
            "Revisa tus suscripciones activas. ¿Realmente usas todas las plataformas que pagas?",
            "Intenta aplicar la regla 50/30/20: 50% necesidades, 30% gustos, 20% ahorro.",
            "Antes de una compra grande, aplica la regla de las 24 horas para evitar compras impulsivas.",
            "Llevar tu propia comida al trabajo o universidad puede ahorrarte cientos de soles al mes."
        ];

        if (highestCategory.toLowerCase().includes('comida') || highestCategory.toLowerCase().includes('restaurante')) {
            return "Hoy tu mayor gasto fue en comida. ¡Preparar en casa un par de días a la semana hace una gran diferencia!";
        }
        if (highestCategory.toLowerCase().includes('transporte') || highestCategory.toLowerCase().includes('taxi')) {
            return "El transporte se llevó una buena parte hoy. Considera compartir viajes o usar transporte público cuando sea posible.";
        }

        // Random tip
        return tips[Math.floor(Math.random() * tips.length)];
    }

    async processReports() {
        try {
            const today = new Date();
            const startOfDay = new Date(today);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(today);
            endOfDay.setHours(23, 59, 59, 999);

            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
            const daysInMonth = endOfMonth.getDate();
            const currentDayOfMonth = today.getDate();

            const lastWeekStart = new Date(today);
            lastWeekStart.setDate(today.getDate() - 7);
            const prevWeekStart = new Date(today);
            prevWeekStart.setDate(today.getDate() - 14);

            const dayOfWeek = today.getDay(); // 0 = Domingo
            const isLastDayOfMonth = today.getDate() === endOfMonth.getDate();

            // 1. Obtener todos los usuarios activos que tengan un WhatsApp vinculado y reportes activados
            const users = await this.app.prisma.user.findMany({
                where: { 
                    status: 'ACTIVE',
                    whatsappPhone: { not: null },
                    reportFrequency: { not: 'OFF' }
                }
            });

            for (const user of users) {
                // Verificar si corresponde enviar reporte según frecuencia
                const freq = user.reportFrequency || 'OFF';
                if (freq === 'WEEKLY' && dayOfWeek !== 0) continue; // Solo domingos
                if (freq === 'MONTHLY' && !isLastDayOfMonth) continue; // Solo fin de mes

                const report = await this.generateReportForUser(user);
                if (report && user.whatsappPhone) {
                    await this.sendWhatsAppImage(user.whatsappPhone, report.buffer, report.greeting);
                }
            }

        } catch (error) {
            this.app.log.error({ msg: 'Error in DailyReportJob processReports', error });
        }
    }

    public async generateReportForUser(user: any): Promise<{ buffer: Buffer, greeting: string } | null> {
        try {
            const today = new Date();
            const startOfDay = new Date(today);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(today);
            endOfDay.setHours(23, 59, 59, 999);

            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
            const daysInMonth = endOfMonth.getDate();
            const currentDayOfMonth = today.getDate();

            const lastWeekStart = new Date(today);
            lastWeekStart.setDate(today.getDate() - 7);
            const prevWeekStart = new Date(today);
            prevWeekStart.setDate(today.getDate() - 14);

            const currency = user.preferredCurrency || 'PEN';

            const [expensesToday, expensesMonth, incomesMonth, paymentMethods, budget, savingsGoals, expensesLastWeek, expensesPrevWeek, antExpensesMonth, pendingCount] = await Promise.all([
                this.app.prisma.expense.findMany({ where: { userId: user.id, issuedAt: { gte: startOfDay, lte: endOfDay } }, include: { category: true } }),
                this.app.prisma.expense.findMany({ where: { userId: user.id, issuedAt: { gte: startOfMonth, lte: endOfMonth } } }),
                this.app.prisma.income.findMany({ where: { userId: user.id, issuedAt: { gte: startOfMonth, lte: endOfMonth } } }),
                this.app.prisma.paymentMethod.findMany({ where: { userId: user.id, active: true } }),
                this.app.prisma.budget.findFirst({ where: { userId: user.id, month: today.getMonth() + 1, year: today.getFullYear(), target: 'GENERAL' } }),
                this.app.prisma.savingsGoal.findMany({ where: { userId: user.id, status: 'ACTIVE' } }),
                this.app.prisma.expense.findMany({ where: { userId: user.id, issuedAt: { gte: lastWeekStart, lte: today } } }),
                this.app.prisma.expense.findMany({ where: { userId: user.id, issuedAt: { gte: prevWeekStart, lte: lastWeekStart } } }),
                this.app.prisma.expense.findMany({ where: { userId: user.id, issuedAt: { gte: startOfMonth, lte: endOfMonth }, amount: { lte: user.antExpenseLimit || 50 } } }),
                this.app.prisma.pendingExpense.count({ where: { userId: user.id, status: 'WAITING_USER' } })
            ]);

            const convert = async (amount: number, from: string) => {
                if (from === currency) return amount;
                const res = await this.currencyService.convert(amount, from, currency);
                return res.amount;
            };

            let dailyTotal = 0;
            let highestExpense = null;
            const categoryMap: Record<string, number> = {};

            for (const exp of expensesToday) {
                const amountInPref = exp.amountNative ?? (await convert(exp.amount, exp.currency));
                dailyTotal += amountInPref;
                if (!highestExpense || amountInPref > highestExpense.amount) {
                    highestExpense = { amount: amountInPref, category: exp.category?.name || 'Varios' };
                }
                const catName = exp.category?.name || 'Varios';
                categoryMap[catName] = (categoryMap[catName] || 0) + amountInPref;
            }

            const categoriesList = Object.entries(categoryMap)
                .map(([name, amount]) => ({ name, amount, percentage: (amount / (dailyTotal || 1)) * 100 }))
                .sort((a, b) => b.amount - a.amount)
                .slice(0, 4);

            let totalBalance = 0;
            for (const pm of paymentMethods) totalBalance += await convert(pm.balance, pm.currency);

            let monthlyExpense = 0;
            for (const exp of expensesMonth) monthlyExpense += exp.amountNative ?? (await convert(exp.amount, exp.currency));

            let monthlyIncome = 0;
            for (const inc of incomesMonth) monthlyIncome += await convert(inc.amount, inc.currency);

            let lastWeekTotal = 0;
            for (const exp of expensesLastWeek) lastWeekTotal += exp.amountNative ?? (await convert(exp.amount, exp.currency));

            let prevWeekTotal = 0;
            for (const exp of expensesPrevWeek) prevWeekTotal += exp.amountNative ?? (await convert(exp.amount, exp.currency));

            let weeklyComparison = 0;
            if (prevWeekTotal > 0) weeklyComparison = ((lastWeekTotal - prevWeekTotal) / prevWeekTotal) * 100;

            let antTotal = 0;
            for (const exp of antExpensesMonth) antTotal += exp.amountNative ?? (await convert(exp.amount, exp.currency));

            const reportData = {
                date: today.toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
                currency,
                totalAmount: dailyTotal,
                highestExpense,
                categories: categoriesList,
                tip: this.getDailyTip(highestExpense?.category || '', dailyTotal),
                totalBalance,
                monthlyExpense,
                monthlyIncome,
                budgetAmount: budget?.amount || 0,
                savingsGoals: await Promise.all(savingsGoals.map(async g => ({
                    name: g.name,
                    current: await convert(g.currentAmount, g.currency),
                    target: await convert(g.targetAmount, g.currency),
                    percentage: (g.currentAmount / (g.targetAmount || 1)) * 100
                }))),
                projectedExpense: (monthlyExpense / currentDayOfMonth) * daysInMonth,
                weeklyComparison,
                antTotal,
                antCount: antExpensesMonth.length,
                pendingCount
            };

            const imageBuffer = await this.imageService.generateDailySummaryImage(reportData);
            const greeting = dailyTotal > 0 
                ? `¡Aquí tienes tu reporte generado ${user.name ? user.name.split(' ')[0] : ''}! 📊 Este es el resumen de tus movimientos.`
                : `¡Hola ${user.name ? user.name.split(' ')[0] : ''}! ✨ Aquí tienes tu balance y reporte actual.`;

            return { buffer: imageBuffer, greeting };
        } catch (error) {
            this.app.log.error({ msg: 'Error in generateReportForUser', error });
            return null;
        }
    }

    async sendWhatsAppImage(phone: string, imageBuffer: Buffer, caption: string) {
        try {
            const base64Image = imageBuffer.toString('base64');
            // Wazend expects plain base64 or dataUri depending on the exact endpoint,
            // but the codebase uses /message/sendMedia/:session with apikey header.
            const dataUri = `data:image/png;base64,${base64Image}`;

            const base = config.wazendApiBase.replace(/\/$/, '');
            const session = config.wazendSession;
            const url = `${base}/message/sendMedia/${encodeURIComponent(session)}`;
            const digits = String(phone).replace(/[^0-9]/g, '');
            
            await axios.post(url, {
                number: digits,
                mediatype: "image",
                mimetype: "image/png",
                caption: caption,
                media: base64Image,
                fileName: "resumen-diario.png"
            }, {
                headers: {
                    'apikey': config.wazendApiToken,
                    'Content-Type': 'application/json'
                }
            });

            this.app.log.info(`Daily report sent to ${phone}`);
        } catch (error: any) {
            this.app.log.error({ msg: 'Error sending WhatsApp image report via Wazend', phone, error: error.message });
        }
    }
}