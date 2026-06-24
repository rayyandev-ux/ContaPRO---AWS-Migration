import type { FastifyInstance } from 'fastify';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import sharp from 'sharp';
import { createOpenAI } from '../services/openai.js';
import { checkBudgetAlertAfterExpense, ensureBudgetForUserMonth } from '../routes/budget.js';
import { formatDMY, sanitizeText, formatExpenseMessage } from '../utils/format.js';
import { isEntitled } from '../utils/subscription.js';
import { AgentService } from '../services/agent.js';
import { SalesService } from '../services/sales.js';
import { GroqService } from './groq.js';
import { ConversationHandler } from './conversation.js';
import { processAudioBuffer } from '../utils/media_processor.js';

type IncomingCandidate = {
  from?: string;
  text?: string;
  type?: string;
  imageUrl?: string;
  imageHdUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  imageSizeKB?: number;
  thumbnailJpeg?: Buffer;
  documentUrl?: string;
  documentName?: string;
  documentMime?: string;
  messageId?: string;
  audioUrl?: string;
  audioMime?: string;
  audioDurationSec?: number;
  remoteJid?: string;
  raw: any;
};

let _groq: GroqService | null = null;
function getGroq() { return _groq ??= new GroqService(); }

export class WhatsAppService {
  private app: FastifyInstance;
  private apiBase: string;
  private token: string;
  private number: string;
  private session: string;
  private agent: AgentService;
  private conversation: ConversationHandler;
  public sales: SalesService;

  constructor(app: FastifyInstance) {
    this.app = app;
    this.apiBase = config.wazendApiBase;
    this.token = config.wazendApiToken;
    this.number = config.whatsappNumber;
    this.session = (config as any).wazendSession || process.env.WAZEND_SESSION || '';
    this.agent = new AgentService(app);
    this.conversation = new ConversationHandler(app);
    this.sales = new SalesService(app);
    // Ejecuta una verificación de conectividad al inicializar el servicio
    void this._initConnectivity();
  }

  isConfigured() {
    return !!(this.apiBase && this.token && this.number);
  }

  async sendText(toPhone: string, text: string) {
    try {
      const base = this.apiBase.replace(/\/$/, '');
      // Evolution API v2: sendText requiere instancia en el path y header 'apikey'
      if (!this.session) {
        this.app.log.warn({ msg: 'wazend sendText failed', endpoint: '/message/sendText', reason: 'missing session' });
        return false;
      }
      const headers = {
        'Content-Type': 'application/json',
        'apikey': this.token,
      } as Record<string, string>;
      const digits = String(toPhone).replace(/[^0-9]/g, '');
      const res = await fetch(`${base}/message/sendText/${encodeURIComponent(this.session)}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ number: digits, text }),
      });
      if (!res.ok) {
        const body = await res.text();
        this.app.log.warn({ msg: 'wazend sendText failed', status: res.status, body, endpoint: `/message/sendText/${this.session}` });
        return false;
      }
      return true;
    } catch (e) {
      this.app.log.error({ msg: 'wazend sendText error', e });
      return false;
    }
  }

  async sendUrlButton(toPhone: string, text: string, url: string, btnText: string) {
    try {
      const base = this.apiBase.replace(/\/$/, '');
      if (!this.session) return false;
      const headers = {
        'Content-Type': 'application/json',
        'apikey': this.token,
      } as Record<string, string>;
      const digits = String(toPhone).replace(/[^0-9]/g, '');

      const res = await fetch(`${base}/message/sendUrlButton/${encodeURIComponent(this.session)}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            number: digits,
            url: url,
            title: btnText,
            text: text,
            footer: 'ContaPRO'
        }),
      });

      if (!res.ok) {
         const errBody = await res.text().catch(() => '');
         this.app.log.warn({ msg: 'wazend sendUrlButton failed, falling back to text', status: res.status, body: errBody });
         // Fallback to cleaner text link which generates a preview card
         return this.sendText(toPhone, `${text}\n\n${url}`);
      }
      return true;
    } catch (e) {
      this.app.log.error({ msg: 'wazend sendUrlButton error', e });
      return this.sendText(toPhone, `${text}\n\n${url}`);
    }
  }

  async sendImage(toPhone: string, imageBuffer: Buffer, caption: string) {
    try {
        const base64Image = imageBuffer.toString('base64');
        const base = this.apiBase.replace(/\/$/, '');
        if (!this.session) return false;
        const url = `${base}/message/sendMedia/${encodeURIComponent(this.session)}`;
        const digits = String(toPhone).replace(/[^0-9]/g, '');
        
        const res = await fetch(url, {
            method: 'POST',
            body: JSON.stringify({
              number: digits,
              mediatype: "image",
              mimetype: "image/png",
              caption: caption,
              media: base64Image,
              fileName: "reporte.png"
            }),
            headers: {
                'apikey': this.token,
                'Content-Type': 'application/json'
            }
        });
        if (!res.ok) {
            const errBody = await res.text().catch(() => '');
            this.app.log.warn({ msg: 'wazend sendImage failed', status: res.status, body: errBody });
            return false;
        }
        return true;
    } catch (e) {
        this.app.log.error({ msg: 'wazend sendImage error', e });
        return false;
    }
  }

  async sendPresence(toPhone: string, presence: 'composing' | 'recording' | 'available' | 'unavailable' = 'composing', delay: number = 1200) {
      // Fire and forget
      const task = async () => {
          try {
              const base = this.apiBase.replace(/\/$/, '');
              if (!this.session) return;
              const headers = {
                  'Content-Type': 'application/json',
                  'apikey': this.token,
              } as Record<string, string>;
              const digits = String(toPhone).replace(/[^0-9]/g, '');
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 3000);
              await fetch(`${base}/chat/sendPresence/${encodeURIComponent(this.session)}`, {
                  method: 'POST',
                  headers,
                  body: JSON.stringify({ number: digits, presence, delay }),
                  signal: controller.signal
              });
              clearTimeout(timeoutId);
          } catch {}
      };
      task();
      return true;
  }

  async sendReaction(toPhone: string, messageId: string, reaction: string, remoteJid?: string) {
    // Fire and forget - Don't await reaction to speed up main flow
    // this.app.log.info({ msg: 'Attempting to send reaction', toPhone, messageId, reaction, remoteJid });
    const task = async () => {
        try {
            if (!messageId) return;
            const base = this.apiBase.replace(/\/$/, '');
            if (!this.session) return;
            
            const headers = {
                'Content-Type': 'application/json',
                'apikey': this.token,
            } as Record<string, string>;
            const digits = String(toPhone).replace(/[^0-9]/g, '');
            
            const jid = remoteJid || `${digits}@s.whatsapp.net`;
            const body = JSON.stringify({ key: { remoteJid: jid, fromMe: false, id: messageId }, reaction });

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            await fetch(`${base}/message/sendReaction/${encodeURIComponent(this.session)}`, {
                method: 'POST',
                headers,
                body,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
        } catch (e) {
            this.app.log.warn({ msg: 'wazend sendReaction silent error', e });
        }
    };
    
    // Ejecutar en segundo plano sin await
    task();
    return true;
  }

  private startTyping(phone: string): NodeJS.Timeout {
    this.sendPresence(phone, 'composing', 1200).catch(() => {});
    return setInterval(() => {
      this.sendPresence(phone, 'composing', 1200).catch(() => {});
    }, 10000);
  }

  private stopTyping(phone: string, interval: NodeJS.Timeout) {
      clearInterval(interval);
      this.sendPresence(phone, 'available', 0).catch(() => {});
  }

  async downloadMedia(url: string): Promise<{ buffer: Buffer; mimeType?: string } | null> {
    if (!url) return null;
    try {
      const u = String(url);
      if (/mmg\.whatsapp\.net\//i.test(u)) {
        this.app.log.warn({ msg: 'wazend media url rejected mmg', url: u });
        return null;
      }
      // Procesar todos los enlaces de media con el header apikey (si el origen lo ignora, no afecta)
      const tryFetch = async (headers: Record<string, string>) => {
        const res = await fetch(u, { headers });
        if (!res.ok) return null;
        const ab = await res.arrayBuffer();
        const ct = res.headers.get('content-type') || undefined;
        return { buffer: Buffer.from(ab), mimeType: ct ? ct.split(';')[0].trim() : undefined };
      };
      let out = await tryFetch({ apikey: this.token });
      if (!out) out = await tryFetch({ Authorization: `Bearer ${this.token}` });
      if (!out) out = await tryFetch({});
      if (!out) {
        this.app.log.warn({ msg: 'wazend download media failed', url: u });
        return null;
      }
      return out;
    } catch (e) {
      this.app.log.error({ msg: 'wazend download media error', e });
      return null;
    }
  }

  async downloadMediaByMessageId(messageId: string): Promise<{ buffer: Buffer; mimeType?: string } | null> {
    try {
      const base = this.apiBase.replace(/\/$/, '');
      if (!this.session) {
        this.app.log.warn({ msg: 'wazend getBase64 failed', reason: 'missing session' });
        return null;
      }
      const url = `${base}/chat/getBase64FromMediaMessage/${encodeURIComponent(this.session)}`;
      const headers = { 'Content-Type': 'application/json', 'apikey': this.token } as Record<string, string>;
      const body = JSON.stringify({ message: { key: { id: messageId } }, convertToMp4: false });
      const res = await fetch(url, { method: 'POST', headers, body });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        this.app.log.warn({ msg: 'wazend getBase64 failed', status: res.status, body: t });
        return null;
      }
      let mt: string | undefined;
      let b64: string | undefined;
      try {
        const json: any = await res.json();
        const candidateStr = String(json?.base64 || json?.data || json?.file || '');
        if (candidateStr.startsWith('data:')) {
          const comma = candidateStr.indexOf(',');
          const header = candidateStr.slice(5, comma);
          mt = header.split(';')[0];
          b64 = candidateStr.slice(comma + 1);
        } else if (/^[A-Za-z0-9+/=]+$/.test(candidateStr)) {
          b64 = candidateStr;
          mt = (json?.mimetype || json?.mimeType || undefined);
        }
      } catch {
        const text = await res.text().catch(() => '');
        const m = text.match(/data:([^;]+);base64,([A-Za-z0-9+/=]+)/);
        if (m) { mt = m[1]; b64 = m[2]; }
      }
      if (!b64) return null;
      const buf = Buffer.from(b64, 'base64');
      return { buffer: buf, mimeType: mt };
    } catch (e) {
      this.app.log.error({ msg: 'wazend getBase64 error', e });
      return null;
    }
  }

  private async findLinkedUser(phone: string) {
    const digits = String(phone).replace(/[^0-9]/g, '');
    const withPlus = `+${digits}`;
    const user = await this.app.prisma.user.findFirst({
      where: { OR: [ { whatsappPhone: String(phone) }, { whatsappPhone: withPlus } ] },
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

  async processUploadedBuffer(phone: string, filename: string, mimeType: string, buf: Buffer, text?: string, messageId?: string, remoteJid?: string) {
    const user = await this.findLinkedUser(phone);
    if (!user) {
      await this.sales.handleUnlinked('whatsapp', phone, (t) => this.sendText(phone, t));
      return;
    }
    if (!isEntitled(user)) {
      await this.sales.handleExpired('whatsapp', phone, (t) => this.sendText(phone, t));
      return;
    }

    if (messageId) this.sendReaction(phone, messageId, '⏳', remoteJid);

    // Preprocesado de imágenes
    let analysisBuffer: Buffer = buf;
    let analysisMime: string = mimeType;
    const lowerMime = (mimeType || '').toLowerCase();
    const lowerName = (filename || '').toLowerCase();
    const isLikelyImageByExt = /\.(jpe?g|png|gif|webp|bmp|tiff?)$/.test(lowerName);
    const isLikelyImageByMagic = (b: Buffer) => {
      if (!b || b.length < 12) return false;
      const isPNG = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
      const isJPEG = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
      const isGIF = b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38;
      const isRIFF = b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46;
      const isWEBP = isRIFF && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
      return isPNG || isJPEG || isGIF || isWEBP;
    };
    const mimeLooksImage = lowerMime.startsWith('image/');
    const treatAsImage = mimeLooksImage || isLikelyImageByExt || isLikelyImageByMagic(buf);
    
    try {
      if (treatAsImage) {
        const processed = await sharp(buf)
          .rotate()
          .greyscale()
          .normalize()
          .sharpen()
          .modulate({ brightness: 1.08, saturation: 0.95 })
          .resize({ width: 2200, withoutEnlargement: true })
          .png({ compressionLevel: 8 })
          .toBuffer();
        analysisBuffer = processed;
        analysisMime = 'image/png';
      } else {
        analysisMime = lowerMime || analysisMime;
      }
    } catch {
      analysisBuffer = buf;
      analysisMime = mimeType;
    }

    const uploadsDir = path.join(process.cwd(), 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });
    const uniqueName = `${Date.now()}_${(filename || 'archivo').replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
    const filePath = path.join(uploadsDir, uniqueName);
    await fs.writeFile(filePath, buf);

    // Resolve profile (Default or First)
    const profileId = this.resolveProfileId(user);

    // Store relative path in DB for better portability (Docker <-> Local)
    // documents.ts handles resolution relative to process.cwd()
    const storagePath = `uploads/${uniqueName}`;

    const doc = await this.app.prisma.document.create({ 
        data: { 
            userId: user.id, 
            profileId,
            filename: filename || uniqueName, 
            mimeType, 
            storagePath // Use relative path
        } 
    });

    // 4. Handle Media (Image/Audio)
     // ------------------------------------------------
     let imageAnalysis: any = null;
     let publicUrl: string | undefined = undefined;

     if (treatAsImage) {
         // --- IMAGE HANDLING VIA GROQ (LLAMA VISION) ---
         console.log('[WhatsApp] Analyzing image with Groq Vision...');
         publicUrl = `https://contapro.lat/api/proxy/documents/${doc.id}/preview`; 
         
         // Use the storagePath or construct a temporary public URL if needed. 
         // Note: Groq needs a public URL. If 'filePath' is local, we might need to expose it or upload to a public bucket first.
         // Assuming 'storage.uploadFile' or similar logic handles public availability. 
         // For this implementation, let's assume we use the uploaded file URL.
         
         // Since we are inside processUploadedBuffer, we have 'filePath' (local). 
         // If Groq supports base64 (it does via data URI), we can use that to avoid public URL dependency.
         const b64 = analysisBuffer.toString('base64');
         const dataUri = `data:${analysisMime};base64,${b64}`;
         
         imageAnalysis = await getGroq().analyzeImage(dataUri);
         console.log('[WhatsApp] Vision Analysis:', imageAnalysis);

         // Check if extraction is practically empty (missing amount)
         const isEmptyExtraction = imageAnalysis && (!imageAnalysis.amount || imageAnalysis.amount === 0);

         if (!imageAnalysis || isEmptyExtraction) {
             console.log('[WhatsApp] Vision Analysis failed or returned empty data. Using fallback context.');
             imageAnalysis = { 
                 warning: "La extracción automática de la imagen falló o no detectó datos claros.",
                 instruction: "EL USUARIO HA ENVIADO UNA IMAGEN DE GASTO. Confía plenamente en el texto que acompaña la imagen para registrar el gasto. Si falta el monto, PREGUNTA."
             };
         }
     }
 
     // 2. AGENT PROCESSING (Generalist)
    // Pass extracted data as "extraction" context AND imageUrl
    const userMessage = text || (imageAnalysis ? 'He enviado una imagen / I sent an image. Analízala / Analyze it.' : 'He enviado un archivo / I sent a file.');
    
    // await this.sendText(phone, '🤖 Analizando con Agente IA...');
    const typingInterval = this.startTyping(phone);

    try {
      const response = await this.conversation.handleMessage(user.id, userMessage, 'WHATSAPP', { extraction: imageAnalysis, imageUrl: publicUrl, profileId });

      // 3. REPLY
      if (typeof response === 'string') {
        await this.sendText(phone, response);
      } else {
        // @ts-ignore
        if (response.mediaBuffer) {
           // @ts-ignore
           await this.sendImage(phone, response.mediaBuffer, response.text || '');
        } else if (response.buttons && response.buttons.length > 0 && response.buttons[0].type === 'url') {
             // @ts-ignore
            const btn = response.buttons[0];
            // @ts-ignore
            await this.sendUrlButton(phone, response.text, btn.url, btn.display);
        } else {
             // @ts-ignore
            await this.sendText(phone, response.text || response);
        }
      }

      if (messageId) {
          // Fire-and-forget reaction AFTER response is sent
          void this.sendReaction(phone, messageId, '✅', remoteJid);
      }
    } finally {
      this.stopTyping(phone, typingInterval);
    }
  }

  async processText(phone: string, text: string, messageId?: string, remoteJid?: string) {
    const user = await this.findLinkedUser(phone);
    if (!user) {
      await this.sales.handleUnlinked('whatsapp', phone, (t) => this.sendText(phone, t), text);
      return;
    }
    if (!isEntitled(user)) {
      await this.sales.handleExpired('whatsapp', phone, (t) => this.sendText(phone, t), text);
      return;
    }

    if (messageId) this.sendReaction(phone, messageId, '⏳', remoteJid);

    // await this.sendText(phone, '🧠 *ContaPRO está pensando...*');
    const typingInterval = this.startTyping(phone);
    try {
      const profileId = this.resolveProfileId(user);
      const response = await this.conversation.handleMessage(user.id, text, 'WHATSAPP', { profileId });
      
      if (typeof response === 'string') {
        await this.sendText(phone, response);
      } else {
         // @ts-ignore
        if (response.mediaBuffer) {
            // @ts-ignore
            await this.sendImage(phone, response.mediaBuffer, response.text || '');
        } else if (response.buttons && response.buttons.length > 0 && response.buttons[0].type === 'url') {
            // @ts-ignore
            const btn = response.buttons[0];
            // @ts-ignore
            await this.sendUrlButton(phone, response.text, btn.url, btn.display);
        } else {
             // @ts-ignore
            await this.sendText(phone, response.text || response);
        }
      }

    if (messageId) {
        void this.sendReaction(phone, messageId, '✅', remoteJid);
    }
    } finally {
      this.stopTyping(phone, typingInterval);
    }
  }

  async processAudio(phone: string, buffer: Buffer, mimeType: string, messageId?: string, remoteJid?: string) {
    const user = await this.findLinkedUser(phone);
    if (!user) {
        await this.sales.handleUnlinked('whatsapp', phone, (t) => this.sendText(phone, t));
        return;
    }
    if (!isEntitled(user)) {
        await this.sales.handleExpired('whatsapp', phone, (t) => this.sendText(phone, t));
        return;
    }

    if (messageId) this.sendReaction(phone, messageId, '⏳', remoteJid);

    // await this.sendText(phone, '🧠 *ContaPRO está escuchando...*');
    
    try {
        // --- AUDIO HANDLING VIA GROQ (WHISPER) ---
        console.log('[WhatsApp] Transcribing audio with Groq...');
        const text = await processAudioBuffer(buffer, groq);
        console.log('[WhatsApp] Transcription:', text);

        if (!text) {
            await this.sendText(phone, '🔘 No pude entender el audio. Intenta hablar más claro.');
            return;
        }

        // await this.sendText(phone, `🗣️ Dijiste: "${text}"`);
        const typingInterval = this.startTyping(phone);
        
        // Pass to agent
        try {
          const profileId = this.resolveProfileId(user);
          const response = await this.agent.processMessage(user.id, text, { profileId });
          
          if (typeof response === 'string') {
            await this.sendText(phone, response);
          } else {
            if (response.mediaBuffer) {
                await this.sendImage(phone, response.mediaBuffer, response.text || '');
            } else if (response.buttons && response.buttons.length > 0 && response.buttons[0].type === 'url') {
                const btn = response.buttons[0];
                await this.sendUrlButton(phone, response.text, btn.url, btn.display);
            } else {
                await this.sendText(phone, response.text);
            }
          }

          if (messageId) {
              void this.sendReaction(phone, messageId, '✅', remoteJid);
          }
        } finally {
          this.stopTyping(phone, typingInterval);
        }
    } catch (e) {
        this.app.log.error({ msg: 'Audio processing error', e });
        await this.sendText(phone, '⚫ Ocurrió un error procesando tu audio.');
    }
  }

  extractIncoming(body: any): IncomingCandidate {
    const candidate: IncomingCandidate = { raw: body } as any;
    try {
      // Evolution API / Wazend payloads vary; normalize the inner message object
      const m = body?.message || body?.messages?.[0] || body?.payload || body?.data;
      const msg = m?.message || m; // Baileys-style messages come under m.message
      let from = (m?.from?.phone || m?.from || m?.sender?.phone || body?.from || body?.phone || body?.sender) as string | undefined;
      // Evolution API: prefer remoteJidAlt when present (maps LID to real JID)
      const remoteJidPrimary = m?.key?.remoteJid || msg?.key?.remoteJid || m?.remoteJid || body?.remoteJid;
      const remoteJidAlt = m?.key?.remoteJidAlt || msg?.key?.remoteJidAlt || m?.remoteJidAlt || body?.remoteJidAlt;
      let jidForFrom: string | undefined;
      if (typeof remoteJidAlt === 'string' && /@s\.whatsapp\.net$/.test(remoteJidAlt)) {
        jidForFrom = remoteJidAlt;
      } else if (typeof remoteJidPrimary === 'string' && /@s\.whatsapp\.net$/.test(remoteJidPrimary)) {
        jidForFrom = remoteJidPrimary;
      } else if (typeof remoteJidPrimary === 'string') {
        jidForFrom = remoteJidPrimary; // fallback (e.g., @lid)
      }
      if (!from && typeof jidForFrom === 'string') {
        const digits = jidForFrom.split('@')[0];
        if (digits) from = digits;
      }
      // Text can be in several places: conversation, extendedTextMessage, caption, or plain fields
      const text = (
        msg?.message?.conversation ||
        msg?.conversation ||
        msg?.extendedTextMessage?.text ||
        msg?.text?.body ||
        msg?.text ||
        msg?.body?.text ||
        msg?.body ||
        msg?.imageMessage?.caption ||
        msg?.documentMessage?.caption ||
        body?.text
      ) as string | undefined;

      const type = (msg?.type || m?.type || body?.type) as string | undefined;
      const isDocument = Boolean(msg?.documentMessage || msg?.document || /document/i.test(String(type || '')));
      const isAudio = Boolean(
        msg?.audioMessage || msg?.audio ||
        /audio|ptt/i.test(String(type || '')) ||
        /audio/i.test(String(msg?.mimeType || '')) ||
        /audio/i.test(String(m?.mimetype || '')) ||
        /\.(ogg|mp3|wav|m4a)$/i.test(String(m?.mediaUrl || body?.mediaUrl || ''))
      );
      const isImage = Boolean(!isAudio && (msg?.imageMessage || msg?.image || /image/i.test(String(type || ''))));
      // Media URLs para imágenes (preferir variantes HD/original y presigned mediaUrl)
      const imageUrl = (
        isAudio ? undefined : (
          msg?.imageMessage?.url ||
          msg?.image?.url ||
          msg?.media?.image?.url ||
          body?.imageUrl ||
          body?.data?.imageUrl ||
          msg?.mediaUrl
        )
      ) as string | undefined;
      // Variantes HD/original y presigned MinIO
      const imageHdUrl = (
        isAudio ? undefined : (
          msg?.mediaUrl ||
          msg?.imageMessage?.hdUrl ||
          msg?.imageMessage?.hqUrl ||
          msg?.image?.hdUrl ||
          msg?.media?.image?.hdUrl ||
          msg?.imageMessage?.originalUrl ||
          msg?.image?.originalUrl ||
          m?.mediaUrl ||
          body?.mediaUrl ||
          body?.data?.mediaUrl ||
          m?.hdUrl ||
          body?.hdUrl
        )
      ) as string | undefined;
      // Small preview often available; useful fallback when mmg content is encrypted
      let thumbnailJpeg: Buffer | undefined = undefined;
      const thumbRaw: any = (
        msg?.imageMessage?.jpegThumbnail ||
        msg?.image?.jpegThumbnail ||
        msg?.thumbnail ||
        m?.jpegThumbnail ||
        body?.data?.message?.imageMessage?.jpegThumbnail
      );
      try {
        if (thumbRaw) {
          if (Buffer.isBuffer(thumbRaw)) {
            thumbnailJpeg = thumbRaw as Buffer;
          } else if (typeof thumbRaw === 'string') {
            // sometimes base64
            const b64 = thumbRaw.trim();
            if (/^[A-Za-z0-9+/=]+$/.test(b64)) {
              thumbnailJpeg = Buffer.from(b64, 'base64');
            }
          } else if (typeof thumbRaw === 'object' && thumbRaw !== null) {
            // serialized byte object like {0:255,1:216,...}
            const arr = Object.values(thumbRaw).filter(v => typeof v === 'number') as number[];
            if (arr.length > 0) thumbnailJpeg = Buffer.from(Uint8Array.from(arr));
          }
        }
      } catch {}
      // Dimensiones y tamaño reportados por el proveedor (si disponibles)
      const width = (msg?.imageMessage?.width || msg?.image?.width) as number | undefined;
      const height = (msg?.imageMessage?.height || msg?.image?.height) as number | undefined;
      const fileLengthObj = (msg?.imageMessage?.fileLength || msg?.image?.fileLength) as any;
      const bytes = typeof fileLengthObj === 'number' ? fileLengthObj
        : (typeof fileLengthObj?.low === 'number' ? fileLengthObj.low : undefined);
      // URLs para documentos; sólo usar mediaUrl si realmente es documento
      let documentUrl = (
        msg?.documentMessage?.url ||
        msg?.document?.url ||
        msg?.media?.document?.url ||
        msg?.file?.url
      ) as string | undefined;
      if (!documentUrl && isDocument) {
        documentUrl = (m?.mediaUrl || body?.mediaUrl) as string | undefined;
      }
      const isMmg = (u?: string) => !!u && /mmg\.whatsapp\.net\//i.test(String(u));
      const preferredAudio = (isAudio ? (m?.mediaUrl || body?.mediaUrl) : undefined) as string | undefined;
      const audioCandidates: (string | undefined)[] = [
        preferredAudio,
        (msg?.audioMessage?.url as string | undefined),
        (msg?.audio?.url as string | undefined),
        (msg?.media?.audio?.url as string | undefined),
        (body?.audioUrl as string | undefined),
        (body?.data?.audioUrl as string | undefined),
      ];
      const audioUrl = audioCandidates.find(u => u && !isMmg(u)) || audioCandidates.find(u => !!u);
      const audioMime = (
        msg?.audioMessage?.mimetype ||
        msg?.audio?.mime ||
        msg?.mimeType ||
        m?.mimetype ||
        body?.mimeType
      ) as string | undefined;
      const audioDurationSec = (
        (msg?.audioMessage?.seconds || msg?.audio?.seconds || msg?.audioMessage?.duration || msg?.audio?.duration) as number | undefined
      );
      const messageId = (msg?.key?.id || m?.key?.id || body?.data?.key?.id || body?.key?.id) as string | undefined;
      const documentName = (
        msg?.documentMessage?.fileName ||
        msg?.document?.filename ||
        msg?.file?.name ||
        msg?.filename
      ) as string | undefined;
      const documentMime = (
        msg?.documentMessage?.mimetype ||
        msg?.document?.mime ||
        msg?.file?.mime ||
        msg?.mimeType
      ) as string | undefined;
      if (from) candidate.from = String(from).replace(/[^0-9+]/g, '');
      if (text) candidate.text = String(text);
      // Preferir "document" sólo cuando realmente es documento; si es imagen, mantener tipo imagen
      candidate.type = type || (candidate.text ? 'text' : (audioUrl ? 'audio' : (isDocument && documentUrl ? 'document' : (imageUrl ? 'image' : undefined))));
      candidate.imageUrl = imageUrl;
      candidate.imageHdUrl = imageHdUrl;
      candidate.imageWidth = typeof width === 'number' ? width : undefined;
      candidate.imageHeight = typeof height === 'number' ? height : undefined;
      candidate.imageSizeKB = typeof bytes === 'number' ? Math.round(bytes / 1024) : undefined;
      candidate.thumbnailJpeg = thumbnailJpeg;
      candidate.documentUrl = documentUrl;
      candidate.documentName = documentName;
      candidate.documentMime = documentMime;
      candidate.audioUrl = audioUrl;
      candidate.audioMime = audioMime;
      candidate.audioDurationSec = typeof audioDurationSec === 'number' ? audioDurationSec : undefined;
      candidate.messageId = messageId;
    } catch {}
    return candidate;
  }

  getInfo() {
    return { apiBase: this.apiBase, number: this.number };
  }

  async checkConnectivity(): Promise<{ reachable: boolean; authorized: boolean; status?: number; reason?: string }> {
    if (!this.isConfigured()) {
      return { reachable: false, authorized: false, reason: 'missing configuration' };
    }
    const base = this.apiBase?.replace(/\/$/, '') || '';
    const headers: Record<string, string> = { 'Authorization': `Bearer ${this.token}` };
    const tryUrls = [base, `${base}/messages`, `${base}/status`, `${base}/health`];
    for (const url of tryUrls) {
      try {
        const res = await fetch(url, { method: 'GET', headers });
        const authorized = res.status !== 401 && res.status !== 403;
        return { reachable: true, authorized, status: res.status };
      } catch (e: any) {
        // Intentar siguiente URL
        this.app.log.warn({ msg: 'wazend connectivity attempt failed', url, error: String(e) });
      }
    }
    return { reachable: false, authorized: false, reason: 'all connectivity attempts failed' };
  }

  private async _initConnectivity() {
    const info = this.getInfo();
    if (!this.isConfigured()) {
      this.app.log.info({ msg: 'WhatsAppService not configured', apiBase: info.apiBase, number: info.number });
      return;
    }
    try {
      const result = await this.checkConnectivity();
      this.app.log.info({
        msg: 'Wazend connectivity check',
        apiBase: info.apiBase,
        number: info.number,
        reachable: result.reachable,
        authorized: result.authorized,
        status: result.status ?? null,
        reason: result.reason ?? null,
      });
    } catch (e) {
      this.app.log.error({ msg: 'Wazend connectivity check error', e });
    }
  }
}
