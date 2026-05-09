import type { FastifyInstance } from 'fastify';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createOpenAI } from './openai.js';
import { checkBudgetAlertAfterExpense, ensureBudgetForUserMonth } from '../routes/budget.js';
import { formatDMY, sanitizeText, formatExpenseMessage, formatBudgetSummaryMessage } from '../utils/format.js';
import { isEntitled } from '../utils/subscription.js';
import { AgentService } from './agent.js';
import { SalesService } from './sales.js';
import { GroqService } from './groq.js';
import { ConversationHandler } from './conversation.js';
import { processAudioBuffer } from '../utils/media_processor.js';

type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    date: number;
    chat: { id: number; type: string; username?: string; first_name?: string };
    text?: string;
    caption?: string;
    document?: { file_id: string; file_name?: string; mime_type?: string; file_size?: number };
    photo?: Array<{ file_id: string; width?: number; height?: number; file_size?: number }>;
    voice?: { file_id: string; mime_type?: string; file_size?: number; duration?: number };
    audio?: { file_id: string; file_name?: string; mime_type?: string; file_size?: number; duration?: number };
    contact?: { phone_number: string; first_name: string; user_id?: number };
  };
};

export class TelegramService {
  private app: FastifyInstance;
  private token: string;
  private baseUrl: string;
  private offset = 0;
  private polling = false;
  private botUsername: string | undefined;
  private agent: AgentService;
  private conversation: ConversationHandler;
  private sales: SalesService;
  private groq: GroqService;

  constructor(app: FastifyInstance, token: string) {
    this.app = app;
    this.token = token;
    this.baseUrl = `https://api.telegram.org/bot${token}`;
    this.agent = new AgentService(app);
    this.conversation = new ConversationHandler(app);
    this.sales = new SalesService(app);
    this.groq = new GroqService();
  }

  async getMe(): Promise<{ username?: string } | null> {
    try {
      const res = await fetch(`${this.baseUrl}/getMe`);
      const data = await res.json();
      if (data?.ok) {
        this.botUsername = data.result?.username;
        return { username: this.botUsername };
      }
    } catch (e) {
      this.app.log.error({ msg: 'telegram getMe failed', e });
    }
    return null;
  }

  async sendMessage(chatId: string | number, text: string) {
    try {
      await fetch(`${this.baseUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown', disable_web_page_preview: true })
      });
    } catch (e) {
      this.app.log.error({ msg: 'telegram sendMessage failed', e });
    }
  }

  async sendPhoto(chatId: string | number, photo: Buffer, caption?: string) {
    try {
      const formData = new FormData();
      formData.append('chat_id', String(chatId));
      formData.append('caption', caption || '');
      formData.append('parse_mode', 'Markdown');
      
      const blob = new Blob([photo as any], { type: 'image/png' });
      formData.append('photo', blob, 'report.png');

      await fetch(`${this.baseUrl}/sendPhoto`, {
        method: 'POST',
        body: formData
      });
    } catch (e) {
      this.app.log.error({ msg: 'telegram sendPhoto failed', e });
    }
  }

  // Mostrar acción en el chat (typing/upload_photo/upload_document)
  private async sendChatAction(chatId: string | number, action: 'typing' | 'upload_photo' | 'upload_document') {
    try {
      await fetch(`${this.baseUrl}/sendChatAction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, action }),
      });
    } catch (e) {
      this.app.log.error({ msg: 'telegram sendChatAction failed', e });
    }
  }

  private extractStartCode(text?: string): string | undefined {
    if (!text) return undefined;
    const t = text.trim();
    // Solo aceptar explícitamente "/start <code>" o "start <code>"
    const m = t.match(/^\/start\s+([A-Za-z0-9_-]{4,32})$/i) || t.match(/^start\s+([A-Za-z0-9_-]{4,32})$/i);
    return m ? m[1] : undefined;
  }

  private async completeLink(code: string, chatId: number) {
    // Lookup link code in AiCache with TTL
    const key = `tg_link:${code}`;
    const entry = await this.app.prisma.aiCache.findUnique({ where: { key } });
    if (!entry) return false;
    const ageSec = (Date.now() - new Date(entry.createdAt).getTime()) / 1000;
    if (ageSec > (entry.ttl || 0)) {
      await this.app.prisma.aiCache.delete({ where: { key } }).catch(() => {});
      return false;
    }
    const value = entry.value as any;
    const userId = value?.userId as string | undefined;
    if (!userId) return false;
    await this.app.prisma.user.update({ where: { id: userId }, data: { telegramId: String(chatId) } });
    await this.app.prisma.aiCache.delete({ where: { key } }).catch(() => {});
    return true;
  }

  private async getFilePath(fileId: string): Promise<string | null> {
    try {
      const res = await fetch(`${this.baseUrl}/getFile?file_id=${encodeURIComponent(fileId)}`);
      const data = await res.json();
      if (data?.ok && data.result?.file_path) return data.result.file_path as string;
    } catch (e) {
      this.app.log.error({ msg: 'telegram getFile failed', e });
    }
    return null;
  }

  private async downloadFile(filePath: string): Promise<Buffer | null> {
    try {
      const url = `https://api.telegram.org/file/bot${this.token}/${filePath}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const ab = await res.arrayBuffer();
      return Buffer.from(ab);
    } catch (e) {
      this.app.log.error({ msg: 'telegram download file failed', e });
      return null;
    }
  }

  private async findLinkedUser(chatId: number) {
    const user = await this.app.prisma.user.findFirst({ 
        where: { telegramId: String(chatId) },
        include: { profiles: true }
    });
    return user;
  }

  private resolveProfileId(user: any): string | null {
    if (user.profiles && user.profiles.length > 0) {
        const defaultProfile = user.profiles.find((p: any) => p.isDefault);
        return defaultProfile ? defaultProfile.id : user.profiles[0].id;
    }
    return null;
  }

  private async checkMessageLimit(user: any, chatId: number | string): Promise<boolean> {
    if (user.plan !== 'FREE') return true;
    
    const now = new Date();
    const resetDate = user.botMessageResetAt ? new Date(user.botMessageResetAt) : new Date(0);
    
    let currentCount = user.botMessageCount || 0;
    if (now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear()) {
      currentCount = 0;
    }
    
    if (currentCount >= 5) {
      await this.sendMessage(chatId, '❌ Has alcanzado el límite de 5 mensajes gratuitos por mes en tu plan FREE.\n\nPara seguir conversando con tu asistente y desbloquear consultas ilimitadas, actualiza a PRO desde el Dashboard web. 🚀');
      return false;
    }
    
    await this.app.prisma.user.update({
      where: { id: user.id },
      data: { 
        botMessageCount: currentCount + 1,
        botMessageResetAt: now
      }
    });
    return true;
  }

  private async processUploadedBuffer(chatId: number, filename: string, mimeType: string, buf: Buffer, text?: string) {
    const user = await this.findLinkedUser(chatId);
    const send = async (text: string) => this.sendMessage(chatId, text);

    if (!user) {
      await this.sales.handleUnlinked('telegram', chatId, send);
      return;
    }

    if (!isEntitled(user)) {
      await this.sales.handleExpired('telegram', chatId, send);
      return;
    }
    if (!(await this.checkMessageLimit(user, chatId))) return;

    // Preprocesar imagen similar al flujo web
    let analysisBuffer: Buffer = buf;
    let analysisMime: string = mimeType;
    try {
      if (mimeType?.startsWith('image/')) {
        const processed = await sharp(buf)
          .rotate()
          .greyscale()
          .normalize()
          .resize({ width: 2000, withoutEnlargement: true })
          .png({ compressionLevel: 9 })
          .toBuffer();
        analysisBuffer = processed;
        analysisMime = 'image/png';
      }
    } catch {}

    // Guardar archivo en uploads
    const uploadsDir = path.join(process.cwd(), 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });
    const uniqueName = `${Date.now()}_${(filename || 'archivo').replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
    const filePath = path.join(uploadsDir, uniqueName);
    await fs.writeFile(filePath, buf);

    const profileId = this.resolveProfileId(user);

    // Crear documento
    const doc = await this.app.prisma.document.create({ 
        data: { 
            userId: user.id, 
            profileId,
            filename: filename || uniqueName, 
            mimeType, 
            storagePath: filePath 
        } 
    });

    // --- NEW LOGIC: Groq Vision + Agent ---
    let imageAnalysis: any = null;
    let publicUrl: string | undefined = undefined;
    let transcribedAudioText: string | null = null;

    const isImage = mimeType?.startsWith('image/');
    const isAudio = mimeType?.startsWith('audio/') || mimeType?.includes('ogg');

    if (isImage) {
        console.log('[Telegram] Analyzing image with Groq Vision...');
        publicUrl = `https://contapro.lat/api/proxy/documents/${doc.id}/preview`;

        const b64 = analysisBuffer.toString('base64');
        const dataUri = `data:${analysisMime};base64,${b64}`;
        
        imageAnalysis = await this.groq.analyzeImage(dataUri);
        console.log('[Telegram] Vision Analysis:', imageAnalysis);
    } else if (isAudio) {
        console.log('[Telegram] Transcribing audio with Groq...');
        transcribedAudioText = await processAudioBuffer(buf, this.groq);
        console.log('[Telegram] Transcription:', transcribedAudioText);
    }

    const userMessage = text || transcribedAudioText || (imageAnalysis ? 'He enviado una imagen / I sent an image. Analízala / Analyze it.' : 'He enviado un archivo / I sent a file.');
    
    // await this.sendMessage(chatId, '🤖 Analizando con Agente IA...');
    
    const response = await this.conversation.handleMessage(user.id, userMessage, 'TELEGRAM', { extraction: imageAnalysis, imageUrl: publicUrl, profileId });

    if (typeof response === 'string') {
        await this.sendMessage(chatId, response);
    } else {
        let finalMsg = response.text;
        if (response.buttons && response.buttons.length > 0) {
            const btn = response.buttons[0];
            finalMsg += `\n\n🔗 [${btn.display}](${btn.url})`;
        }
        if (response.mediaBuffer) {
            await this.sendPhoto(chatId, response.mediaBuffer, finalMsg);
        } else {
            await this.sendMessage(chatId, finalMsg);
        }
    }
  }

  // Conversación para gasto manual (/add)
  private async getConv(chatId: number): Promise<any | null> {
    const key = `tg_conv:${chatId}`;
    const entry = await this.app.prisma.aiCache.findUnique({ where: { key } });
    return entry ? entry.value : null;
  }
  private async setConv(chatId: number, state: any) {
    const key = `tg_conv:${chatId}`;
    await this.app.prisma.aiCache.upsert({ where: { key }, update: { value: state, ttl: 900 }, create: { key, value: state, ttl: 900 } });
  }
  private async clearConv(chatId: number) {
    const key = `tg_conv:${chatId}`;
    await this.app.prisma.aiCache.delete({ where: { key } }).catch(() => {});
  }

  private async startManual(chatId: number) {
    const user = await this.findLinkedUser(chatId);
    const send = async (text: string) => this.sendMessage(chatId, text);
    if (!user) {
      await this.sales.handleUnlinked('telegram', chatId, send);
      return;
    }
    if (!isEntitled(user)) {
      await this.sales.handleExpired('telegram', chatId, send);
      return;
    }
    await this.setConv(chatId, { step: 'type', data: {} });
    await this.sendMessage(chatId, 'Crear gasto manual. Tipo? (FACTURA/BOLETA).\nSi no se especifica, se considera *INFORMAL*.');
  }

  private async handleManual(chatId: number, text: string) {
    const user = await this.findLinkedUser(chatId);
    const send = async (text: string) => this.sendMessage(chatId, text);
    if (!user) return;
    if (!isEntitled(user)) {
      await this.sales.handleExpired('telegram', chatId, send);
      await this.clearConv(chatId);
      return;
    }
    const profileId = this.resolveProfileId(user);
    const conv = await this.getConv(chatId);
    if (!conv) return;
    const t = text.trim();
    const data = conv.data || {};
    const mapType = (s: string): 'FACTURA' | 'BOLETA' | null => {
      const v = s.trim().toLowerCase();
      if (['factura','fact','fac'].includes(v)) return 'FACTURA';
      if (['boleta','ticket','tiquete','bole','recibo','comprobante'].includes(v)) return 'BOLETA';
      return null;
    };
    switch (conv.step) {
      case 'type': {
        const mt = mapType(t) || 'INFORMAL';
        const valid = ['FACTURA','BOLETA','INFORMAL'];
        if (!valid.includes(mt)) {
          await this.sendMessage(chatId, '❌ *Tipo inválido.*\nEscribe uno de: *FACTURA, BOLETA* o deja vacío para *INFORMAL*.');
          return;
        }
        data.type = mt;
        conv.step = 'amount';
        await this.setConv(chatId, { step: conv.step, data });
        await this.sendMessage(chatId, '💰 ¿Cuál es el *monto* del gasto?\n\n_Ejemplo:_ 123.45');
        return;
      }
      case 'amount': {
        const n = Number(t.replace(',', '.'));
        if (!isFinite(n) || n <= 0) {
          await this.sendMessage(chatId, '❌ *Monto inválido.* 😅\n\nPor favor ingresa un número *positivo*.\n\n💡 *Ejemplo:* 123.45');
          return;
        }
        data.amount = n;
        conv.step = 'currency';
        await this.setConv(chatId, { step: conv.step, data });
        const pref = user.preferredCurrency || 'PEN';
        await this.sendMessage(chatId, `💵 *¿En qué moneda está el gasto?*\n\nEscribe: *PEN*, *USD*, *EUR*, *CLP* o *ARS*.\n\n💡 _Dejar vacío usa tu preferida:_ *${pref}*`);
        return;
      }
      case 'currency': {
        const pref = user.preferredCurrency || 'PEN';
        const up = t ? t.toUpperCase() : pref;
        data.currency = ['PEN','USD','EUR','CLP','ARS'].includes(up) ? up : pref;
        conv.step = 'provider';
        await this.setConv(chatId, { step: conv.step, data });
        await this.sendMessage(chatId, '🏢 *¿Quién es el proveedor?*\n\nEscribe el nombre de la empresa o persona.\n\n💡 *Ejemplo:* *Tecnología SAC*');
        return;
      }
      case 'provider': {
        if (!t) {
          await this.sendMessage(chatId, '❌ *¡Proveedor inválido!* 😅\n\nPor favor ingresa un *nombre válido* para el proveedor.\n\n💡 *Ejemplo:* *Tecnología SAC*');
          return;
        }
        data.provider = t;
        conv.step = 'date';
        await this.setConv(chatId, { step: conv.step, data });
        await this.sendMessage(chatId, '📅 *¿En qué fecha ocurrió el gasto?*\n\n💡 Escribe la fecha en formato *YYYY-MM-DD* (por ejemplo: *2024-07-15*).\n\n⏩ Si fue hoy, simplemente envía un mensaje vacío o escribe *hoy*.');
        return;
      }
      case 'date': {
        let dt: Date;
        if (!t) dt = new Date();
        else {
          const m = t.match(/^\d{4}-\d{2}-\d{2}$/);
          dt = m ? new Date(t) : new Date();
        }
        data.issuedAt = dt.toISOString();
        conv.step = 'description';
        await this.setConv(chatId, { step: conv.step, data });
        await this.sendMessage(chatId, '📝 *¿Qué es lo que gastaste?*\n\nEscribe una *descripción breve* del gasto.\n\n💡 *Ejemplo:* *Compra de tecnología*');
        return;
      }
      case 'description': {
        if (t && t.toLowerCase() !== 'skip') data.description = t;
        // Enforce FREE plan
      if (!isEntitled(user)) {
        const issued = new Date(data.issuedAt);
        const start = new Date(issued.getFullYear(), issued.getMonth(), 1);
        const end = new Date(issued.getFullYear(), issued.getMonth() + 1, 0, 23, 59, 59, 999);
        const count = await this.app.prisma.expense.count({ where: { userId: user.id, profileId, type: data.type, issuedAt: { gte: start, lte: end } } });
        if (count >= 10) {
          await this.clearConv(chatId);
          await this.sendMessage(chatId, `🚫 *Límite del plan Free alcanzado* para ${String(data.type).toLowerCase()}.

Actualiza a *Premium* para registrar más de 10 comprobantes al mes.

👉 https://contapro.lat/pricing`);
          return;
        }
      }
        // Solicitar categoría (opcional)
        conv.step = 'category';
        await this.setConv(chatId, { step: conv.step, data });
        await this.sendMessage(chatId, '🏷️ *Categoría (opcional)*\n\nEscribe el nombre de la categoría o "skip" para omitir.\n\n💡 Ejemplos: *Alimentación*, *Transporte*, *Servicios*');
        return;
      }
      case 'category': {
        // Resolver/crear categoría si se ingresó
        if (t && t.toLowerCase() !== 'skip') {
          try {
            const nameRaw = sanitizeText(t);
            if (nameRaw) {
              const key = nameRaw.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
              const pool = await this.app.prisma.category.findMany({ where: { OR: [ { userId: user.id, profileId }, { userId: null, profileId: null } ] } });
              const hit = pool.find(c => c.name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === key);
              if (hit) data.categoryId = hit.id;
              else {
                const map: Record<string, string> = { alimentacion: 'Alimentación', transporte: 'Transporte', servicios: 'Servicios', entretenimiento: 'Entretenimiento', educacion: 'Educación', salud: 'Salud', vivienda: 'Vivienda', tecnologia: 'Tecnología', impuestos: 'Impuestos', otros: 'Otros' };
                const created = await this.app.prisma.category.create({ data: { name: map[key] || nameRaw, userId: user.id, profileId } });
                data.categoryId = created.id;
              }
            }
          } catch {}
        }

        let pmIdMan: string | null = null;
        try {
          const pms = await this.app.prisma.paymentMethod.findMany({ where: { userId: user.id, profileId, active: true } });
          const tLower = String(data.type || '').toLowerCase();
          const pLower = String(data.provider || '').toLowerCase();
          let hit = pms.find(x => x.provider.toLowerCase() === tLower);
          if (!hit) {
            const cands = pms.filter(x => x.provider.toLowerCase() === pLower || x.name.toLowerCase() === pLower);
            hit = cands.length === 1 ? cands[0] : undefined;
          }
          if (hit) {
            pmIdMan = hit.id;
          } else {
            const defId = (await this.app.prisma.user.findUnique({ where: { id: user.id }, select: { defaultPaymentMethodId: true } }))?.defaultPaymentMethodId ?? null;
            if (defId && pms.some(pm => pm.id === defId)) pmIdMan = defId;
            else pmIdMan = null;
          }
        } catch {}
        const exp = await this.app.prisma.expense.create({
          data: {
            userId: user.id,
            profileId,
            type: data.type,
            source: 'MANUAL',
            issuedAt: new Date(data.issuedAt),
            provider: data.provider,
            description: data.description,
            amount: data.amount,
            currency: data.currency,
            categoryId: data.categoryId ?? null,
            paymentMethodId: pmIdMan ?? undefined,
          }
        });
        try {
          const nowIssue = new Date();
          await ensureBudgetForUserMonth(this.app, user.id, profileId!, nowIssue.getFullYear(), nowIssue.getMonth() + 1);
        } catch {}
        // Verificar umbral de presupuesto y notificar si corresponde (basado en issuedAt)
        try {
          await checkBudgetAlertAfterExpense(this.app, user.id, profileId!, new Date(exp.issuedAt), exp.amount, exp.categoryId ?? undefined);
        } catch (e) {
          this.app.log.error({ msg: 'budget alert check failed (telegram manual)', e });
        }

        await this.clearConv(chatId);
        const amt = exp.amount.toFixed(2);
        const issuedText = formatDMY(new Date(exp.issuedAt));
        const createdText = formatDMY(new Date(exp.createdAt));
        const cat = exp.categoryId ? await this.app.prisma.category.findUnique({ where: { id: exp.categoryId } }) : null;
        const pmObjManual = exp.paymentMethodId ? await this.app.prisma.paymentMethod.findUnique({ where: { id: exp.paymentMethodId } }) : null;
        const pmLabelManual = pmObjManual ? `${pmObjManual.provider}${pmObjManual.name ? ' — ' + pmObjManual.name : ''}` : undefined;
        const docTypeM = (exp.type === 'FACTURA' || exp.type === 'BOLETA') ? exp.type : 'INFORMAL';
        const text2 = formatExpenseMessage({
          title: '✍️ *Gasto manual registrado*',
          provider: exp.provider,
          amount: amt,
          currency: exp.currency,
          issuedText: issuedText,
          createdText: createdText,
          type: docTypeM,
          paymentMethod: pmLabelManual,
          category: sanitizeText(cat?.name) || undefined,
          description: sanitizeText(exp.description) ?? undefined,
          source: exp.source,
          id: exp.id,
        });
        await this.sendMessage(chatId, text2);
        return;
      }
    }
  }

  private async sendHelp(chatId: number) {
    const lines = [
      '🤖 *Agente de IA ContaPRO*',
      '',
      'Aquí tienes algunas cosas que puedo hacer por ti:',
      '',
      '📝 *Registrar Gastos*',
      '• "Compré un café por 5 soles"',
      '• Envía una foto de tu recibo o factura',
      '• Envía un audio diciendo tu gasto',
      '',
      '💰 *Presupuestos y Alertas*',
      '• "Define mi presupuesto de este mes en 2000"',
      '• "Pon un presupuesto de 500 para Alimentos"',
      '• "Avísame si gasto más del 80% en Transporte"',
      '',
      '📊 *Consultas*',
      '• "¿Cuánto he gastado este mes?"',
      '• "¿Cómo voy con mi presupuesto?"',
      '• "Listame mis últimos 5 gastos"',
      '• "¿Ya borraste el gasto de ayer?"',
      '',
      '⚙️ *Gestión*',
      '• "Elimina el gasto de 50 soles"',
      '• "Cambia la categoría del último gasto a Salud"',
      '',
      '🔗 */start <código>* — vincular tu cuenta.',
      '➕ */add* — crear gasto manual paso a paso.',
      '❓ */ayuda* — ver esta ayuda.',
      '',
      '¡Simplemente habla conmigo como si fuera tu contador personal! 😉'
    ];
    await this.sendMessage(chatId, lines.join('\n'));
  }

  private async sendSummary(chatId: number) {
    const user = await this.findLinkedUser(chatId);
    const send = async (text: string) => this.sendMessage(chatId, text);
    if (!user) {
      await this.sales.handleUnlinked('telegram', chatId, send);
      return;
    }
    if (!isEntitled(user)) {
      await this.sales.handleExpired('telegram', chatId, send);
      return;
    }
    const profileId = this.resolveProfileId(user);
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
    const budget = await this.app.prisma.budget.findFirst({ where: { userId: user.id, profileId: profileId!, year, month: month + 1, target: 'GENERAL' } });
    const agg = await this.app.prisma.expense.aggregate({ _sum: { amount: true }, where: { userId: user.id, profileId: profileId!, createdAt: { gte: start, lte: end } } });
    const spent = agg._sum.amount || 0;
    const remaining = (budget?.amount ?? 0) - spent;
    const currency = budget?.currency || user?.preferredCurrency || 'PEN';
    const text = formatBudgetSummaryMessage({
      title: '📊 *Mes actual*',
      budgetAmount: budget?.amount || 0,
      spent,
      remaining,
      currency,
      month: month + 1,
      year,
    });
    await this.sendMessage(chatId, text);
  }

  private async sendLastExpenses(chatId: number) {
    const user = await this.findLinkedUser(chatId);
    const send = async (text: string) => this.sendMessage(chatId, text);
    if (!user) {
      await this.sales.handleUnlinked('telegram', chatId, send);
      return;
    }
    const profileId = this.resolveProfileId(user);
    const items = await this.app.prisma.expense.findMany({ where: { userId: user.id, profileId: profileId! }, orderBy: { issuedAt: 'desc' }, take: 5 });
    if (items.length === 0) {
      await this.sendMessage(chatId, '📁 *¡Aún no tienes gastos registrados!* 📓\n\nCuando envíes tu primer comprobante o uses */add*, aquí aparecerá tu historial.');
      return;
    }
    const lines = items.map((it: any) => {
      const ds = formatDMY(new Date(it.issuedAt));
      return `• ${ds} — ${it.provider}: ${it.amount.toFixed(2)} ${it.currency}`;
    });
    await this.sendMessage(chatId, ['📋 *Últimos gastos:*', ...lines].join('\n'));
  }

  async handleUpdate(update: TelegramUpdate) {
    if (!update.message) return;
    const msg = update.message;
    const chatId = msg.chat.id;
    
    // Si es un grupo, ignorar o manejar diferente
    // if (msg.chat.type !== 'private') return; 

    // 0. Verificar si es un comando /start con código de vinculación
    const startCode = this.extractStartCode(msg.text);
    if (startCode) {
      const success = await this.completeLink(startCode, chatId);
      if (success) {
        await this.sendMessage(chatId, '✅ *¡Telegram vinculado exitosamente!*\nAhora puedes enviar tus gastos aquí.');
      } else {
        await this.sendMessage(chatId, '❌ *Código inválido o expirado.*\nIntenta escanear el QR nuevamente desde la web.');
      }
      return;
    }

    // 1. Manejo de Contacto (Onboarding Telegram)
    if (msg.contact) {
      const contact = msg.contact;
      // Verificar propiedad (si es posible) o simplemente confiar si viene en el chat privado
      const phoneRaw = contact.phone_number.replace(/[^0-9]/g, '');
      const phone = `+${phoneRaw}`;

      // Buscar o Crear Usuario y Vincular TelegramId
      let user = await this.app.prisma.user.findFirst({
        where: { OR: [{ whatsappPhone: phone }, { whatsappPhone: phoneRaw }] }
      });

      if (!user) {
        user = await this.app.prisma.user.create({
          data: {
            whatsappPhone: phone,
            telegramId: String(chatId),
            plan: 'FREE',
            status: 'NEW_LEAD',
            email: `${phoneRaw}@contapro.temp`,
            password: 'SHADOW_ACCOUNT',
            preferredCurrency: 'PEN'
          }
        });
        try {
          const exists = await this.app.prisma.profile.findFirst({ where: { userId: user.id, isDefault: true } });
          if (!exists) {
            await this.app.prisma.profile.create({ data: { userId: user.id, name: 'Mi Perfil', isDefault: true, color: '#7c3aed', avatar: 'default' } });
          }
        } catch {}
      } else {
        if (user.telegramId !== String(chatId)) {
          await this.app.prisma.user.update({
            where: { id: user.id },
            data: { telegramId: String(chatId) }
          });
        }
      }

      // Delegar a SalesService para el Pitch y Magic Link
      // Pasamos el teléfono para que createShadowAccount (dentro de handleUnlinked) lo encuentre rápido
      await this.sales.handleUnlinked('telegram', phone, async (t) => this.sendMessage(chatId, t));
      return;
    }

    // 2. Verificar usuario vinculado
    const user = await this.findLinkedUser(chatId);

    // Si NO hay usuario vinculado, solicitar contacto OBLIGATORIAMENTE
    if (!user) {
        const welcome = `👋 *¡Hola! / Hello! / Olá!*
        
Para crear tu cuenta segura en ContaPRO, necesito confirmar tu número.
*To create your secure account, I need to verify your number.*

👇 *Toca el botón abajo / Tap the button below*`;

        try {
            await fetch(`${this.baseUrl}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    chat_id: chatId, 
                    text: welcome, 
                    parse_mode: 'Markdown',
                    reply_markup: {
                        keyboard: [[{
                            text: "📱 Enviar mi número / Share Contact",
                            request_contact: true
                        }]],
                        one_time_keyboard: true,
                        resize_keyboard: true
                    }
                })
            });
        } catch (e) {
            this.app.log.error({ msg: 'telegram sendContactRequest failed', e });
        }
        return;
    }

    // 3. Flujos normales (Usuario ya vinculado)
    if (!isEntitled(user)) {
      // Si el usuario existe pero está expirado, sales.handleExpired manejará
      // Pero handleExpired necesita 'chatIdOrPhone'. Para Telegram vinculado, usamos chatId para identificar
      const send = async (t: string) => this.sendMessage(chatId, t);
      await this.sales.handleExpired('telegram', chatId, send, msg.text);
      return;
    }
    if (!(await this.checkMessageLimit(user, chatId))) return;

    // 4. Procesar Mensajes (Texto, Fotos, Archivos, Audio)
    
    // A) Texto
    if (msg.text) {
      const text = msg.text;
      
      // Comandos Manuales
      if (text.startsWith('/add')) {
        await this.startManual(chatId);
        return;
      }
      
      // Flujo Manual en progreso
      const conv = await this.getConv(chatId);
      if (conv) {
        await this.handleManual(chatId, text);
        return;
      }

      // Agente IA
      await this.sendChatAction(chatId, 'typing');
      const response = await this.conversation.handleMessage(user.id, text, 'TELEGRAM', { profileId: this.resolveProfileId(user) || undefined });
      
      if (typeof response === 'string') {
          await this.sendMessage(chatId, response);
      } else {
          // For Telegram, we can append the link text or implement inline keyboard
          // For simplicity and to match previous behavior:
          let finalMsg = response.text;
          if (response.buttons && response.buttons.length > 0) {
              const btn = response.buttons[0];
              // Use markdown link for Telegram: [Label](URL)
              finalMsg += `\n\n🔗 [${btn.display}](${btn.url})`;
          }
          if (response.mediaBuffer) {
              await this.sendPhoto(chatId, response.mediaBuffer, finalMsg);
          } else {
              await this.sendMessage(chatId, finalMsg);
          }
      }
      return;
    }

    // B) Fotos / Documentos / Audio
    const processFile = async (fileId: string, fileName: string, mime: string) => {
      await this.sendChatAction(chatId, 'upload_document');
      const path = await this.getFilePath(fileId);
      if (!path) return;
      const buf = await this.downloadFile(path);
      if (!buf) return;
      await this.processUploadedBuffer(chatId, fileName, mime, buf, msg.caption);
    };

    if (msg.photo && msg.photo.length > 0) {
      // Tomar la foto de mayor resolución (última)
      const p = msg.photo[msg.photo.length - 1];
      await processFile(p.file_id, `photo_${p.file_id}.jpg`, 'image/jpeg');
    } else if (msg.document) {
      await processFile(msg.document.file_id, msg.document.file_name || 'doc', msg.document.mime_type || 'application/octet-stream');
    } else if (msg.voice) {
       await this.sendChatAction(chatId, 'typing'); // Audio processing takes time
       await processFile(msg.voice.file_id, 'voice.ogg', 'audio/ogg');
    } else if (msg.audio) {
       await this.sendChatAction(chatId, 'typing');
       await processFile(msg.audio.file_id, msg.audio.file_name || 'audio.mp3', msg.audio.mime_type || 'audio/mpeg');
    }
  }

  async startPolling() {
    if (this.polling) return;
    this.polling = true;
    await this.getMe();
    this.app.log.info({ msg: 'telegram: polling started', bot: this.botUsername });
    const loop = async () => {
      if (!this.polling) return;
      try {
        const res = await fetch(`${this.baseUrl}/getUpdates?timeout=25&offset=${this.offset}`);
        const data = await res.json();
        if (data?.ok && Array.isArray(data.result)) {
          const updates: TelegramUpdate[] = data.result;
          for (const u of updates) {
            this.offset = Math.max(this.offset, (u.update_id || 0) + 1);
            await this.handleUpdate(u);
          }
        }
      } catch (e) {
        this.app.log.error({ msg: 'telegram: polling error', e });
      }
      setTimeout(loop, 1000);
    };
    loop();
  }
}
