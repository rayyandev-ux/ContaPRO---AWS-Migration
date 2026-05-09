
import { FastifyInstance } from 'fastify';
import { Worker, Job } from 'bullmq';
import puppeteer, { Browser } from 'puppeteer';
import { Client } from '@microsoft/microsoft-graph-client';
import 'isomorphic-fetch';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
import { decrypt, encrypt } from '../utils/crypto.js';
import { NotificationService } from '../services/notifications.js';
import { AgentService } from '../services/agent.js';
import { GroqService } from '../services/groq.js';
import { google } from 'googleapis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../');

const QUEUE_NAME = 'email-scanner';

export function setupEmailScannerWorker(app: FastifyInstance, connection: any) {
  const notificationService = new NotificationService(app);
  const agentService = new AgentService(app);
  const groqService = new GroqService();

  const worker = new Worker(QUEUE_NAME, async (job: Job) => {
    app.log.info({ msg: 'EmailScanner job started', jobId: job.id, name: job.name });
    
    const getBrowser = async (): Promise<Browser | null> => {
        try {
            app.log.info({ msg: 'Launching Puppeteer for capture...' });
            return await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox', 
                    '--disable-dev-shm-usage',
                    '--disable-gpu'
                ]
            });
        } catch (e: any) {
            app.log.error({ msg: 'Puppeteer launch failed', error: e.message, stack: e.stack });
            return null;
        }
    };
    
    // 1. Obtener todas las integraciones activas
    // Optimización: Si el job trae userId (scan manual), filtramos solo ese usuario.
    const filter: any = { isActive: true, provider: { in: ['GMAIL', 'OUTLOOK'] } };
    if (job.data?.userId) {
        filter.userId = job.data.userId;
    }
    
    // Si el job trae un provider específico, filtramos también por eso
    if (job.data?.provider) {
        filter.provider = job.data.provider;
    }

    const integrations = await app.prisma.emailIntegration.findMany({
      where: filter
    });

    const forceRescan = job.name === 'scan-emails-manual' || job.data?.force === true;

    for (const integration of integrations) {
      try {
        if (integration.provider === 'OUTLOOK') {
            await processOutlookIntegration(app, integration, notificationService, agentService, groqService, getBrowser, forceRescan);
        } else {
            await processIntegration(app, integration, notificationService, agentService, groqService, getBrowser, forceRescan);
        }
      } catch (e: any) {
        // Circuit Breaker for Gmail (caught in main loop)
        if (integration.provider === 'GMAIL' && (
            e?.response?.data?.error === 'invalid_grant' || 
            e?.response?.data?.error_description?.includes('Token has been expired') ||
            e?.message?.includes('invalid_grant')
        )) {
             app.log.error({ msg: 'Fatal Gmail Auth Error - Disabling Integration', userId: integration.userId });
             await app.prisma.emailIntegration.update({
                 where: { id: integration.id },
                 data: { isActive: false }
             });
             // Notify user potentially?
        }
        
        app.log.error({ msg: 'Error processing email integration', userId: integration.userId, error: e });
      }
    }
    
    app.log.info({ msg: 'EmailScanner job finished' });
  }, { connection });

  worker.on('failed', (job, err) => {
    app.log.error({ msg: 'EmailScanner job failed', jobId: job?.id, err });
  });

  return worker;
}

async function processIntegration(
    app: FastifyInstance, 
    integration: any, 
    notifier: NotificationService, 
    agent: AgentService, 
    groq: GroqService,
    getBrowser: () => Promise<Browser | null>,
    forceRescan: boolean = false
) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    access_token: decrypt(integration.accessToken),
    refresh_token: decrypt(integration.refreshToken)
  });

  // Auto-refresh token si es necesario (handled by googleapis mostly, but good to listen to event)
  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
        app.log.info({ msg: 'Gmail Token Refreshed via Event', userId: integration.userId });
        await app.prisma.emailIntegration.update({
            where: { id: integration.id },
            data: { 
                accessToken: encrypt(tokens.access_token),
                // Solo actualizamos refresh token si nos dan uno nuevo
                ...(tokens.refresh_token ? { refreshToken: encrypt(tokens.refresh_token) } : {})
            }
        });
    }
  });

  // FORZAR verificación de token antes de usarlo para asegurar permanencia
  try {
      // getAccessToken() verificará si el token expiró y lo refrescará automáticamente usando el refresh_token.
      // Esto dispara el evento 'tokens' definido arriba si hay cambios.
      await oauth2Client.getAccessToken();
  } catch (tokenErr: any) {
      app.log.error({ msg: 'Error refreshing Gmail token proactively', error: tokenErr });
      if (tokenErr?.response?.data?.error === 'invalid_grant' || tokenErr?.message?.includes('invalid_grant')) {
           app.log.error({ msg: 'Fatal Gmail Auth Error (Proactive) - Disabling Integration', userId: integration.userId });
           await app.prisma.emailIntegration.update({
               where: { id: integration.id },
               data: { isActive: false }
           });
           return; // Stop processing this integration
      }
      // Si es otro error (network), dejamos que falle más adelante o reintentamos
  }

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // 2. Buscar correos recientes (últimas 24h o desde lastSync)
  // Configuración de remitentes (default o custom)
  const settings = integration.settings as { allowedSenders?: string[]; autoApprove?: boolean } | null;
  const defaultSenders = ['yape', 'plin', 'uber', 'rappi', 'didifood', 'bcp', 'bbva', 'interbank', 'scotiabank'];
  
  // Si existe un array configurado (aunque sea vacío), lo usamos. Si no (null/undefined), usamos defaults.
  const allowedSenders = Array.isArray(settings?.allowedSenders) ? settings!.allowedSenders : defaultSenders;

  // Si la lista de permitidos está vacía, no escaneamos nada (cumpliendo "Solo analizaremos...")
  if (allowedSenders.length === 0) {
      return;
  }

  // Construir query dinámica: (from:X OR from:Y) O (subject:Z) para keywords
  const queryParts = allowedSenders.map(s => {
      // Si parece un dominio o correo, usamos solo from
      if (s.includes('@') || s.includes('.')) return `from:${s}`;
      // Si es una palabra simple (ej: "yape", "enviaste"), buscamos en from O subject
      return `(from:${s} OR subject:${s})`;
  });
  const filterQuery = queryParts.join(' OR ');
  
  // Usar filtro temporal inteligente: 
  // Si tenemos lastSync, buscamos desde esa fecha (con un margen de seguridad de 10 min).
  // Si es forceRescan (manual), miramos más atrás (3d) para coincidir con el endpoint de prueba.
  // Si no, usamos 1d como fallback.
  let timeQuery = 'newer_than:1d';
  
  if (forceRescan) {
      timeQuery = 'newer_than:3d';
  } else if (integration.lastSync) {
      const lastSyncSec = Math.floor(new Date(integration.lastSync).getTime() / 1000);
      const safeStart = lastSyncSec - 600; // 10 minutos de margen
      timeQuery = `after:${safeStart}`;
  }

  // El filtro de subject puede ser demasiado restrictivo
  const q = `label:inbox ${timeQuery} (${filterQuery})`;
  
  const res = await gmail.users.messages.list({ userId: 'me', q, maxResults: 30 });
  const messages = res.data.messages || [];

  // Array para recolectar IDs de gastos pendientes y notificar en lote al final
  const pendingNotificationIds: string[] = [];

  for (const msg of messages) {
    if (!msg.id) continue;

    // Verificar si ya procesamos este mensaje
    const existing = await app.prisma.pendingExpense.findFirst({
        where: { userId: integration.userId, sourceId: msg.id }
    });

    if (existing) {
        // Si ya fue rechazado, aprobado o ignorado, lo omitimos definitivamente
        if (['REJECTED', 'APPROVED', 'IGNORED'].includes(existing.status)) {
             // Si es forceRescan, permitimos re-evaluar incluso si fue ignorado/rechazado previamente
             if (forceRescan) {
                 app.log.info({ msg: 'Force rescan: Deleting previous status to re-process', msgId: msg.id, status: existing.status });
                 await app.prisma.pendingExpense.delete({ where: { id: existing.id } });
                 // Continuamos con el procesamiento (no continue)
             } else {
                 app.log.info({ msg: 'Skipping processed expense', msgId: msg.id, status: existing.status });
                 continue;
             }
        } else if (forceRescan) {
            // Verificar si el gasto REAL existe.
            // Si el gasto real existe, NO duplicamos.
            // Usamos la descripción (hack temporal) para encontrar el ID de Gmail
            const realExpense = await app.prisma.expense.findFirst({
                where: { 
                    userId: integration.userId,
                    description: { contains: msg.id } 
                }
            });

            if (realExpense) {
                app.log.info({ msg: 'Skipping existing expense (real exists)', msgId: msg.id });
                continue; 
            }

            // Si NO existe el gasto real pero está en WAITING_USER, lo borramos para re-intentar el análisis
            // Esto arregla el bug donde "Probar" no funcionaba si ya existía una notificación pendiente antigua
            await app.prisma.pendingExpense.delete({ where: { id: existing.id } });
            app.log.info({ msg: 'Force rescan: Deleted stuck pending expense to re-process', msgId: msg.id });
        } else {
            // Si existe y no es forceRescan, simplemente saltamos
            continue;
        }
    }

    // Obtener contenido
    const fullMsg = await gmail.users.messages.get({ userId: 'me', id: msg.id });
    const snippet = fullMsg.data.snippet;
    const payload = fullMsg.data.payload;
    
    // Extraer cuerpo (priorizar HTML para screenshot)
    let body = snippet || '';
    let isHtml = false;
    
    if (payload?.body?.data) {
        body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
        if (payload.mimeType === 'text/html') isHtml = true;
    } else if (payload?.parts) {
        // Buscar parte text/html
        const htmlPart = payload.parts.find(p => p.mimeType === 'text/html');
        if (htmlPart?.body?.data) {
             body = Buffer.from(htmlPart.body.data, 'base64').toString('utf-8');
             isHtml = true;
        } else {
             // Fallback to text/plain
             const textPart = payload.parts.find(p => p.mimeType === 'text/plain');
             if (textPart?.body?.data) {
                 body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
             }
        }
    }

    app.log.info({ msg: 'EmailScanner processing email', id: msg.id, snippet: snippet?.substring(0, 50) });

    // 3. Analizar con AI (Groq Vision Screenshot -> Agent)
    let extraction: any = null;
    let screenshotPath: string | null = null;

    // FORZAR SIEMPRE screenshot si hay navegador disponible, incluso si no parece HTML puro
    // (A veces el texto plano es engañoso o insuficiente para el contexto visual)
    const browser = await getBrowser();
    
    if (browser) {
        try {
            const page = await browser.newPage();
            
            // Si es HTML, usamos setContent. Si es texto, lo envolvemos en un <pre> o similar para renderizar.
            const contentToRender = isHtml ? body : `<html><body><pre style="white-space: pre-wrap; font-family: monospace;">${body}</pre></body></html>`;
            
            await page.setContent(contentToRender, { waitUntil: 'domcontentloaded' });
            // Mobile viewport for emails often looks better
            await page.setViewport({ width: 390, height: 844 }); 
            
            const screenshotBase64 = await page.screenshot({ encoding: 'base64', fullPage: true });
            await page.close();
            
            // Save screenshot to disk
            screenshotPath = await saveScreenshot(integration.userId, Buffer.from(screenshotBase64, 'base64'), app.log);

            const dataUri = `data:image/png;base64,${screenshotBase64}`;
            app.log.info({ msg: 'Analyzing email screenshot with Groq (FORCED)', userId: integration.userId, msgId: msg.id });
            
            const groqResult = await groq.analyzeImage(dataUri);
            
            if (groqResult) {
                // Pass "chewed" info to Agent for final standardization
                const chewedInfo = JSON.stringify(groqResult);
                extraction = await agent.processEmailInput(integration.userId, `[EXTRACTED FROM EMAIL SCREENSHOT VIA GROQ VISION]: ${chewedInfo}`);
            } else {
                app.log.warn({ msg: 'Groq returned null, falling back to raw text', msgId: msg.id });
                // Solo si Groq falla, usamos el texto crudo como fallback
                extraction = await agent.processEmailInput(integration.userId, body);
            }
        } catch (e) {
            app.log.error({ msg: 'Screenshot/Groq analysis failed, falling back to raw text', error: e });
            extraction = await agent.processEmailInput(integration.userId, body);
        } finally {
            if (browser) await browser.close();
        }
    } else {
        // Fallback total si puppeteer no inició
        app.log.warn({ msg: 'Puppeteer not available, using raw text', msgId: msg.id });
        extraction = await agent.processEmailInput(integration.userId, body);
    }
    
    app.log.info({ msg: 'EmailScanner extraction result', id: msg.id, extraction });

    await handleExtractionResult(
        app,
        integration.userId,
        msg.id,
        snippet,
        extraction,
        notifier,
        pendingNotificationIds,
        settings?.autoApprove === true && (extraction?.amount > 0),
        'GMAIL',
        screenshotPath
    );
  }

  // Notificar todos los pendientes encontrados en este ciclo (Batch)
  if (pendingNotificationIds.length > 0) {
      await notifier.notifyPendingExpensesBatch(pendingNotificationIds);
  }

  // Actualizar lastSync
  await app.prisma.emailIntegration.update({
      where: { id: integration.id },
      data: { lastSync: new Date() }
  });
}

async function processOutlookIntegration(
    app: FastifyInstance, 
    integration: any, 
    notifier: NotificationService, 
    agent: AgentService, 
    groq: GroqService,
    getBrowser: () => Promise<Browser | null>,
    forceRescan: boolean = false
) {
    let accessToken = decrypt(integration.accessToken);
    const refreshToken = decrypt(integration.refreshToken);

        const refresh = async () => {
             const newTokens = await refreshMicrosoftToken(refreshToken);
             if (newTokens && newTokens.access_token) {
                 accessToken = newTokens.access_token;
                 
                 // CRÍTICO: Si Microsoft rota el refresh token, debemos actualizar nuestra variable local
                 // para que futuras llamadas usen el nuevo, y guardarlo en BD.
                 if (newTokens.refresh_token) {
                     // refreshToken is const; new refresh token is saved in DB update below
                 }

                 // Guardar tokens cifrados
                 await app.prisma.emailIntegration.update({
                     where: { id: integration.id },
                     data: {
                         accessToken: encrypt(newTokens.access_token),
                         refreshToken: newTokens.refresh_token ? encrypt(newTokens.refresh_token) : undefined
                     }
                 });
                 app.log.info({ msg: 'Outlook Token Refreshed Successfully', userId: integration.userId, hasNewRefreshToken: !!newTokens.refresh_token });
                 return accessToken;
             }
             throw new Error('Could not refresh token - No access_token in response');
        };

    let client = Client.init({
        authProvider: (done) => {
            done(null, accessToken);
        }
    });

    const settings = integration.settings as { allowedSenders?: string[]; autoApprove?: boolean } | null;
    const defaultSenders = ['yape', 'plin', 'uber', 'rappi', 'didifood', 'bcp', 'bbva', 'interbank', 'scotiabank'];
    const allowedSenders = Array.isArray(settings?.allowedSenders) ? settings!.allowedSenders : defaultSenders;

    if (allowedSenders.length === 0) return;

    const senderFilters = allowedSenders.map(s => {
        if (s.includes('@')) {
            return `from/emailAddress/address eq '${s}'`;
        } else {
             return `(contains(from/emailAddress/address, '${s}') or contains(from/emailAddress/name, '${s}') or contains(subject, '${s}'))`;
        }
    });
    const sendersFilterString = `(${senderFilters.join(' or ')})`;

    let timeFilter = '';
    if (forceRescan) {
        const d = new Date();
        d.setDate(d.getDate() - 3);
        timeFilter = `receivedDateTime ge ${d.toISOString()}`;
    } else if (integration.lastSync) {
        const lastSync = new Date(integration.lastSync);
        lastSync.setMinutes(lastSync.getMinutes() - 10); 
        timeFilter = `receivedDateTime ge ${lastSync.toISOString()}`;
    } else {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        timeFilter = `receivedDateTime ge ${d.toISOString()}`;
    }

    const filter = `${timeFilter} and ${sendersFilterString}`;
    
    let messages: any[] = [];
    try {
        const res = await client.api('/me/messages')
            .filter(filter)
            .select('id,receivedDateTime,from,subject,bodyPreview,body')
            .top(30)
            .get();
        messages = res.value;
    } catch (e: any) {
        if (e.statusCode === 401) {
            app.log.info({ msg: 'Outlook token expired, refreshing...' });
            try {
                const newToken = await refresh();
                client = Client.init({
                    authProvider: (done) => {
                        done(null, newToken);
                    }
                });
                const res = await client.api('/me/messages')
                    .filter(filter)
                    .select('id,receivedDateTime,from,subject,bodyPreview,body')
                    .top(30)
                    .get();
                messages = res.value;
            } catch (refreshErr: any) {
                app.log.error({ msg: 'Failed to refresh Outlook token', error: refreshErr });
                
                // Circuit Breaker for Outlook
                if (refreshErr.message?.includes('invalid_grant') || refreshErr.message?.includes('AADSTS70000')) {
                    app.log.error({ msg: 'Fatal Outlook Auth Error - Disabling Integration', userId: integration.userId });
                    await app.prisma.emailIntegration.update({
                        where: { id: integration.id },
                        data: { isActive: false }
                    });
                }
                return;
            }
        } else {
            throw e;
        }
    }

    const pendingNotificationIds: string[] = [];

    for (const msg of messages) {
        const existing = await app.prisma.pendingExpense.findFirst({
             where: { userId: integration.userId, sourceId: msg.id }
        });

        if (existing) {
            if (['REJECTED', 'APPROVED', 'IGNORED'].includes(existing.status)) {
                 if (forceRescan) {
                     app.log.info({ msg: 'Force rescan: Deleting previous status to re-process', msgId: msg.id, status: existing.status });
                     await app.prisma.pendingExpense.delete({ where: { id: existing.id } });
                 } else {
                     continue;
                 }
            } else if (forceRescan) {
                 const realExpense = await app.prisma.expense.findFirst({
                    where: { userId: integration.userId, description: { contains: msg.id } }
                });
                if (realExpense) continue;
                await app.prisma.pendingExpense.delete({ where: { id: existing.id } });
            } else {
                continue;
            }
        }

        let body = msg.bodyPreview || '';
        let isHtml = false;
        if (msg.body?.contentType === 'html') {
            body = msg.body.content;
            isHtml = true;
        } else if (msg.body?.content) {
            body = msg.body.content;
        }

        app.log.info({ msg: 'OutlookScanner processing email', id: msg.id, snippet: msg.bodyPreview?.substring(0, 50) });

        let extraction: any = null;
        let screenshotPath: string | null = null;
        const browser = await getBrowser();
        if (browser) {
             try {
                const page = await browser.newPage();
                const contentToRender = isHtml ? body : `<html><body><pre>${body}</pre></body></html>`;
                await page.setContent(contentToRender, { waitUntil: 'domcontentloaded' });
                await page.setViewport({ width: 390, height: 844 });
                const screenshotBase64 = await page.screenshot({ encoding: 'base64', fullPage: true });
                await page.close();

                // Save screenshot to disk
                screenshotPath = await saveScreenshot(integration.userId, Buffer.from(screenshotBase64, 'base64'), app.log);

                const dataUri = `data:image/png;base64,${screenshotBase64}`;
                
                const groqResult = await groq.analyzeImage(dataUri);
                if (groqResult) {
                    const chewedInfo = JSON.stringify(groqResult);
                    extraction = await agent.processEmailInput(integration.userId, `[EXTRACTED FROM OUTLOOK SCREENSHOT]: ${chewedInfo}`);
                } else {
                    extraction = await agent.processEmailInput(integration.userId, body);
                }
             } catch (e) {
                 extraction = await agent.processEmailInput(integration.userId, body);
             } finally {
                 if (browser) await browser.close();
             }
        } else {
            extraction = await agent.processEmailInput(integration.userId, body);
        }

        await handleExtractionResult(
            app,
            integration.userId,
            msg.id,
            msg.bodyPreview,
            extraction,
            notifier,
            pendingNotificationIds,
            settings?.autoApprove === true && (extraction?.amount > 0),
            'OUTLOOK',
            screenshotPath
        );
    }

    if (pendingNotificationIds.length > 0) {
        await notifier.notifyPendingExpensesBatch(pendingNotificationIds);
    }

    await app.prisma.emailIntegration.update({
        where: { id: integration.id },
        data: { lastSync: new Date() }
    });
}

async function refreshMicrosoftToken(refreshToken: string) {
    // Debug: Log token length to detect malformed storage
    console.log('Refreshing Microsoft Token. Token length:', refreshToken?.length, 'Value prefix:', refreshToken?.substring(0, 10));

    const params = new URLSearchParams();
    params.append('client_id', process.env.MICROSOFT_CLIENT_ID!);
    params.append('client_secret', process.env.MICROSOFT_CLIENT_SECRET!);
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refreshToken);
    // Use .default scope for refresh as recommended by Microsoft identity platform
    params.append('scope', 'https://graph.microsoft.com/.default');

    // Use tenant-specific endpoint if possible, but common is standard for multi-tenant apps
    // However, if tenant ID is available, it's safer. Assuming common for now.
    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
    });

    if (!response.ok) {
        // Log error body for debugging
        const errText = await response.text();
        console.error('Microsoft Token Refresh Error Body:', errText);
        throw new Error(`Microsoft token refresh failed: ${response.statusText} - ${errText}`);
    }

    return await response.json();
}

async function handleExtractionResult(
    app: FastifyInstance,
    userId: string,
    msgId: string,
    snippet: string | null | undefined,
    extraction: any,
    notifier: NotificationService,
    pendingNotificationIds: string[],
    autoApprove: boolean,
    provider: string,
    screenshotPath: string | null = null
) {
    try {
        if (extraction && extraction.is_expense) {
            if (extraction.date) {
                const expenseDate = new Date(extraction.date);
                const now = new Date();
                const diffTime = Math.abs(now.getTime() - expenseDate.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (diffDays > 60) {
                    app.log.info({ msg: 'Skipping old expense', id: msgId, date: extraction.date, diffDays });
                    await app.prisma.pendingExpense.create({
                        data: {
                            userId: userId,
                            source: provider,
                            sourceId: msgId,
                            amount: extraction.amount || 0,
                            currency: extraction.currency || 'PEN',
                            merchant: extraction.merchant || 'Unknown',
                            description: extraction.description,
                            date: expenseDate,
                            rawText: snippet,
                            screenshotPath: screenshotPath,
                            status: 'REJECTED'
                        }
                    });
                    return;
                }
            }
            
            let finalMerchant = extraction.merchant;
            if (!finalMerchant || finalMerchant === 'Unknown') {
                const textToSearch = (extraction.description || '') + ' ' + (snippet || '');
                const yapeMatch = textToSearch.match(/Yapeaste a ([A-Za-z\s]+)/i);
                if (yapeMatch && yapeMatch[1]) {
                    finalMerchant = yapeMatch[1].split(' -')[0].trim();
                } else if (textToSearch.includes('Yape') || textToSearch.includes('yape')) {
                    finalMerchant = 'Yape';
                }
            }

            if (autoApprove) {
                app.log.info({ msg: `Auto-approving ${provider} expense`, userId: userId, amount: extraction.amount });
                
                // Create Document if screenshot exists
                let documentId: string | undefined;
                if (screenshotPath) {
                    try {
                        const user = await app.prisma.user.findUnique({ where: { id: userId }, include: { profiles: true } });
                        const defaultProfileId = user?.profiles.find(p => p.isDefault)?.id || user?.profiles[0]?.id;

                        const doc = await app.prisma.document.create({
                            data: {
                                userId,
                                profileId: defaultProfileId,
                                filename: `email_evidence_${msgId}.png`,
                                mimeType: 'image/png',
                                storagePath: screenshotPath
                            }
                        });
                        documentId = doc.id;
                    } catch (e) {
                        app.log.error({ msg: 'Failed to create document for auto-approved expense', error: e });
                    }
                }

                // Use transaction to ensure both Expense and PendingExpense are created or neither
                await app.prisma.$transaction(async (prisma) => {
                    const expense = await prisma.expense.create({
                        data: {
                            userId: userId,
                            type: 'INFORMAL',
                            source: 'DOCUMENT',
                            provider: `${provider} Auto`,
                            amount: extraction.amount,
                            currency: extraction.currency,
                            description: `${extraction.description || finalMerchant} (${provider}: ${msgId})`,
                            issuedAt: extraction.date ? new Date(extraction.date) : new Date(),
                            documentId: documentId
                        }
                    });

                    await prisma.pendingExpense.create({
                        data: {
                            userId: userId,
                            source: provider,
                            sourceId: msgId,
                            amount: extraction.amount,
                            currency: extraction.currency,
                            merchant: finalMerchant || 'Unknown',
                            description: extraction.description,
                            date: extraction.date ? new Date(extraction.date) : new Date(),
                            rawText: snippet,
                            screenshotPath: screenshotPath,
                            status: 'APPROVED'
                        }
                    });

                    // Usar Cola de Push Notifications si está disponible
                    const pushQueue = (app as any).pushNotificationQueue;
                    if (pushQueue) {
                        await pushQueue.add('email_receipt', { expenseId: expense.id, userId: userId });
                    } else {
                        await notifier.notifyExpenseRegistered(expense.id);
                    }
                });

            } else {
                const pending = await app.prisma.pendingExpense.create({
                    data: {
                        userId: userId,
                        source: provider,
                        sourceId: msgId,
                        amount: extraction.amount || 0,
                        currency: extraction.currency || 'PEN',
                        merchant: finalMerchant || 'Unknown',
                        description: extraction.description || 'Gasto detectado (Monto pendiente)',
                        date: extraction.date ? new Date(extraction.date) : new Date(),
                        rawText: snippet,
                        screenshotPath: screenshotPath,
                        status: 'WAITING_USER'
                    }
                });

                pendingNotificationIds.push(pending.id);
            }
        } else {
            app.log.info({ msg: 'Marking email as IGNORED (Not an expense)', id: msgId });
            
            await app.prisma.pendingExpense.create({
                data: {
                    userId: userId,
                    source: provider,
                    sourceId: msgId,
                    amount: 0,
                    currency: 'PEN',
                    merchant: 'Unknown',
                    description: 'Ignored by AI (Not detected as expense)',
                    date: new Date(),
                    rawText: snippet,
                    screenshotPath: screenshotPath,
                    status: 'IGNORED'
                }
            });
        }
    } catch (e: any) {
        // Handle duplicate error gracefully (P2002 is Prisma Unique Constraint Violation)
        if (e.code === 'P2002') {
            app.log.info({ msg: 'PendingExpense already exists (duplicate), skipping', sourceId: msgId });
            return;
        }
        // Log other errors but don't crash the worker
        app.log.error({ msg: 'Error creating PendingExpense', error: e, sourceId: msgId });
        throw e;
    }
}

async function saveScreenshot(userId: string, buffer: Buffer, log?: any): Promise<string | null> {
    try {
        const uploadDir = path.join(PROJECT_ROOT, 'uploads', 'screenshots', userId);
        
        // Log attempt
        if (log) log.info({ msg: 'Attempting to save screenshot', uploadDir });
        else console.log('Attempting to save screenshot', uploadDir);

        await fs.mkdir(uploadDir, { recursive: true });
        
        // Use random string to avoid collision
        const randomSuffix = Math.random().toString(36).substring(2, 15);
        const filename = `${Date.now()}_${randomSuffix}.png`;
        const filePath = path.join(uploadDir, filename);
        
        await fs.writeFile(filePath, buffer);
        
        if (log) log.info({ msg: 'Screenshot saved successfully', filePath });
        else console.log(`Screenshot saved to: ${filePath}`);
        
        // Return relative path for better portability (Docker <-> Local)
        return `uploads/screenshots/${userId}/${filename}`;
    } catch (e: any) {
        if (log) log.error({ msg: 'Failed to save screenshot', error: e.message, stack: e.stack });
        else console.error('Failed to save screenshot', e.message, e.stack);
        return null;
    }
}
