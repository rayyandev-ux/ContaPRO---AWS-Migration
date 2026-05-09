import fs from 'fs';
import path from 'path';
import ejs from 'ejs';
import puppeteer from 'puppeteer';
import { FastifyInstance } from 'fastify';

export class ImageGeneratorService {
    private app: FastifyInstance;

    constructor(app: FastifyInstance) {
        this.app = app;
    }

    async generateDailySummaryImage(data: {
        date: string;
        currency: string;
        totalAmount: number;
        highestExpense: { amount: number; category: string } | null;
        categories: { name: string; amount: number; percentage: number }[];
        tip: string;
        totalBalance: number;
        monthlyIncome: number;
        monthlyExpense: number;
        budgetAmount: number;
        savingsGoals: { name: string; current: number; target: number; percentage: number }[];
        projectedExpense: number;
        weeklyComparison: number;
        antTotal: number;
        antCount: number;
        pendingCount: number;
    }): Promise<Buffer> {
        try {
            // 1. Cargar el logo como base64
            const logoPath = path.join(process.cwd(), 'src', 'templates', 'logo.png');
            let logoBase64 = '';
            try {
                const logoBuffer = fs.readFileSync(logoPath);
                logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
            } catch (err) {
                this.app.log.warn('Could not load logo for daily summary, proceeding without it.');
            }

            // 2. Cargar y compilar la plantilla EJS
            const templatePath = path.join(process.cwd(), 'src', 'templates', 'daily-summary.ejs');
            const template = fs.readFileSync(templatePath, 'utf-8');
            const html = ejs.render(template, { ...data, logoBase64 });

            // 2. Lanzar Puppeteer
            const browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            const page = await browser.newPage();
            
            // Establecer el tamaño exacto que definimos en el CSS
            await page.setViewport({ width: 800, height: 1000, deviceScaleFactor: 2 });
            
            // Cargar el HTML
            await page.setContent(html, { waitUntil: 'networkidle0' });

            // Esperar a que las fuentes y estilos se carguen bien
            await page.evaluateHandle('document.fonts.ready');

            // Capturar el elemento contenedor principal para ajustar el tamaño dinámicamente
            const element = await page.$('.container');
            const boundingBox = await element?.boundingBox();

            if (boundingBox) {
                // Ajustar el viewport al tamaño real del contenido + un pequeño padding
                await page.setViewport({
                    width: 600,
                    height: Math.ceil(boundingBox.height) + 40,
                    deviceScaleFactor: 2
                });
            }

            // 3. Tomar el screenshot
            const buffer = await page.screenshot({
                type: 'png',
                omitBackground: true,
                fullPage: false // Ya ajustamos el viewport
            });
            
            await browser.close();
            
            return Buffer.from(buffer);
        } catch (error) {
            this.app.log.error({ msg: 'Error generating image', error });
            throw error;
        }
    }
}