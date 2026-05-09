import type { FastifyPluginAsync } from 'fastify';
import { WhatsAppService } from '../services/whatsapp.js';
import { config } from '../config.js';
import { isEntitled } from '../utils/subscription.js';

export const webhooksRoutes: FastifyPluginAsync = async (app) => {
  // Handshake/health for providers that do GET/HEAD verification
  app.get('/wazend', async (_req, reply) => {
    return reply.status(200).send({ ok: true });
  });

  app.post('/wazend', async (req, reply) => {
    const wa: any = (app as any).whatsapp ?? new WhatsAppService(app);
    if (!wa.isConfigured()) {
      app.log.warn({ msg: 'wazend webhook received but service not configured' });
      return reply.status(200).send({ ok: true });
    }

    const candidate = wa.extractIncoming(req.body);
    app.log.info({ msg: 'wazend webhook incoming', candidate });
    const raw: any = candidate?.raw ?? req.body ?? {};
    const event: string | undefined = raw?.event || raw?.data?.event;
    const fromMe: boolean = Boolean(raw?.data?.key?.fromMe ?? raw?.fromMe);
    if (fromMe || event === 'send.message') {
      app.log.info({ msg: 'wazend webhook ignored outgoing/self message', event, fromMe });
      return reply.status(200).send({ ok: true, ignored: true });
    }
    const keyObj: any = raw?.data?.key || raw?.key || {};
    const remoteJid: string | undefined = keyObj?.remoteJid || raw?.data?.remoteJid || raw?.remoteJid;
    const remoteJidAlt: string | undefined = keyObj?.remoteJidAlt || raw?.data?.remoteJidAlt || raw?.remoteJidAlt;
    const selfDigits = String(config.whatsappNumber || '').replace(/[^0-9]/g, '');
    const rDigits = typeof remoteJid === 'string' && /@s\.whatsapp\.net$/.test(remoteJid) ? remoteJid.split('@')[0] : undefined;
    const rAltDigits = typeof remoteJidAlt === 'string' && /@s\.whatsapp\.net$/.test(remoteJidAlt) ? remoteJidAlt.split('@')[0] : undefined;
    const fromDigits = String(candidate.from || '').replace(/[^0-9]/g, '');
    const toDigits = [rAltDigits, rDigits, fromDigits].find(d => d && d !== selfDigits);
    const phoneNormalized = toDigits ? (toDigits.startsWith('+') ? toDigits : `+${toDigits}`) : (fromDigits ? `+${fromDigits}` : undefined);

    if (!phoneNormalized) {
      return reply.status(400).send({ error: 'missing sender phone' });
    }

    const getUserByPhone = async () => {
      const digits = String(phoneNormalized).replace(/[^0-9]/g, '');
      const withPlus = `+${digits}`;
      return await app.prisma.user.findFirst({ where: { OR: [ { whatsappPhone: withPlus }, { whatsappPhone: digits } ] } });
    };

    const checkMessageLimit = async (user: any, wa: any, phoneNormalized: string): Promise<boolean> => {
      if (user.plan !== 'FREE') return true; // Planes PRO no tienen límites
      
      const now = new Date();
      const resetDate = user.botMessageResetAt ? new Date(user.botMessageResetAt) : new Date(0);
      
      // Si estamos en un nuevo mes, resetear el contador
      let currentCount = user.botMessageCount || 0;
      if (now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear()) {
        currentCount = 0;
      }
      
      if (currentCount >= 5) {
        await wa.sendText(phoneNormalized, '❌ Has alcanzado el límite de 5 mensajes gratuitos por mes en tu plan FREE.\n\nPara seguir conversando con tu asistente y desbloquear consultas ilimitadas, actualiza a PRO desde el Dashboard web. 🚀');
        return false;
      }
      
      // Incrementar contador
      await app.prisma.user.update({
        where: { id: user.id },
        data: { 
          botMessageCount: currentCount + 1,
          botMessageResetAt: now
        }
      });
      return true;
    };

    // AUDIO: procesar antes que imagen
    if (candidate.audioUrl) {
      void (async () => {
        try {
          const user = await getUserByPhone();
          if (!user) { try { await wa.sales.handleUnlinked('whatsapp', phoneNormalized!, (t: string) => wa.sendText(phoneNormalized!, t), candidate.text); } catch {} return; }
          if (!isEntitled(user)) { try { await wa.sales.handleExpired('whatsapp', phoneNormalized!, (t: string) => wa.sendText(phoneNormalized!, t), candidate.text); } catch {} return; }
          if (!(await checkMessageLimit(user, wa, phoneNormalized!))) return;

          let dlA = await wa.downloadMedia(candidate.audioUrl);
          if (!dlA && candidate.messageId) {
            dlA = await wa.downloadMediaByMessageId(candidate.messageId);
          }
          if (!dlA) {
            await wa.sendText(phoneNormalized!, 'No pude descargar el audio. Intenta nuevamente.');
            return;
          }
          const mimeA = dlA.mimeType || candidate.audioMime || 'audio/ogg';
          await wa.processAudio(phoneNormalized!, dlA.buffer, mimeA, candidate.messageId, candidate.remoteJid);
        } catch (e) {
          app.log.error({ msg: 'Background audio processing error', e });
        }
      })();
      return reply.status(200).send({ ok: true });
    }

    // DOCUMENTO: procesar
    if (candidate.documentUrl) {
      void (async () => {
        try {
          const user = await getUserByPhone();
          if (!user) { try { await wa.sales.handleUnlinked('whatsapp', phoneNormalized!, (t: string) => wa.sendText(phoneNormalized!, t), candidate.text); } catch {} return; }
          if (!isEntitled(user)) { try { await wa.sales.handleExpired('whatsapp', phoneNormalized!, (t: string) => wa.sendText(phoneNormalized!, t), candidate.text); } catch {} return; }
          if (!(await checkMessageLimit(user, wa, phoneNormalized!))) return;
          
          const isEnc = /mmg\.whatsapp\.net\/.*\.enc/i.test(String(candidate.documentUrl));
          const preferredUrl = isEnc ? (candidate.imageHdUrl || candidate.imageUrl || candidate.documentUrl) : candidate.documentUrl;
          const dl2 = await wa.downloadMedia(preferredUrl);
          if (!dl2) {
            const altUrl = preferredUrl === candidate.documentUrl ? (candidate.imageHdUrl || candidate.imageUrl) : candidate.documentUrl;
            const dlAlt = altUrl ? await wa.downloadMedia(altUrl) : null;
            if (!dlAlt) {
              await wa.sendText(phoneNormalized!, 'No pude descargar el archivo. Intenta nuevamente.');
              return;
            }
            const docMimeAlt = dlAlt.mimeType || candidate.documentMime || 'application/octet-stream';
            const docNameAlt = candidate.documentName || (docMimeAlt === 'application/pdf' ? 'documento.pdf' : 'archivo');
            const txt = String(candidate.text || '').trim();
            await wa.processUploadedBuffer(phoneNormalized!, docNameAlt, docMimeAlt, dlAlt.buffer, txt, candidate.messageId, candidate.remoteJid);
            return;
          }
          const docMime = dl2.mimeType || candidate.documentMime || 'application/octet-stream';
          const docName = candidate.documentName || (docMime === 'application/pdf' ? 'documento.pdf' : 'archivo');
          const txt = String(candidate.text || '').trim();
          await wa.processUploadedBuffer(phoneNormalized!, docName, docMime, dl2.buffer, txt, candidate.messageId, candidate.remoteJid);
        } catch (e) {
           app.log.error({ msg: 'Background document processing error', e });
        }
      })();
      return reply.status(200).send({ ok: true });
    }

    // IMAGEN: procesar
    if (candidate.imageUrl || candidate.imageHdUrl) {
      void (async () => {
        try {
          const user = await getUserByPhone();
          if (!user) { try { await wa.sales.handleUnlinked('whatsapp', phoneNormalized!, (t: string) => wa.sendText(phoneNormalized!, t), candidate.text); } catch {} return; }
          if (!isEntitled(user)) { try { await wa.sales.handleExpired('whatsapp', phoneNormalized!, (t: string) => wa.sendText(phoneNormalized!, t), candidate.text); } catch {} return; }
          if (!(await checkMessageLimit(user, wa, phoneNormalized!))) return;
          
          const isMmgUrl = (u?: string) => !!u && /mmg\.whatsapp\.net\//i.test(String(u));
          const urls: string[] = [];
          const hd = candidate.imageHdUrl;
          const low = candidate.imageUrl;
          if (hd && !isMmgUrl(hd)) urls.push(hd);
          if (low && !isMmgUrl(low)) urls.push(low);
          if (hd) urls.push(hd);
          if (low) urls.push(low);
          let dl: { buffer: Buffer; mimeType?: string } | null = null;
          let usedUrl: string | undefined;
          for (const u of urls) {
            dl = await wa.downloadMedia(u);
            if (dl) { usedUrl = u; break; }
          }
          if (!dl) {
            await wa.sendText(phoneNormalized!, 'No pude descargar la imagen. Intenta nuevamente o envíala como Documento.');
            return;
          }
          const mime = dl.mimeType || 'image/jpeg';
          const name = mime === 'image/png' ? 'imagen.png' : 'imagen.jpg';
          const txt = String(candidate.text || '').trim();
          await wa.processUploadedBuffer(phoneNormalized!, name, mime, dl.buffer, txt, candidate.messageId, candidate.remoteJid);
        } catch (e) {
          app.log.error({ msg: 'Background image processing error', e });
        }
      })();
      return reply.status(200).send({ ok: true });
    }

    // TEXTO: manejar OTP y comandos naturales
    const txt = String(candidate.text || '').trim();
    if (txt) {
      void (async () => {
        try {
          // Vinculación estilo Telegram: aceptar "/start <code>" o "start <code>"
          const startMatch = txt.match(/^\/start\s+([A-Za-z0-9_-]{4,32})$/i) || txt.match(/^start\s+([A-Za-z0-9_-]{4,32})$/i);
          if (startMatch) {
            const code = startMatch[1];
            const key = `wa_link:${code}`;
            const entry = await app.prisma.aiCache.findUnique({ where: { key } });
            const ageSec = entry ? (Date.now() - new Date(entry.createdAt).getTime()) / 1000 : 0;
            if (entry && ageSec > (entry.ttl || 0)) {
              await app.prisma.aiCache.delete({ where: { key } }).catch(() => {});
            }
            const val: any = entry?.value ?? null;
            const uid: string | undefined = typeof val?.userId === 'string' ? val.userId : undefined;
            if (uid && entry && ageSec <= (entry.ttl || 0)) {
              await app.prisma.user.update({ where: { id: uid }, data: { whatsappPhone: phoneNormalized, whatsappLinkedAt: new Date() } });
              try { await app.prisma.aiCache.delete({ where: { key } }); } catch {}
              const welcomeMsg = `🤖 *Hola, soy tu Agente de IA de ContaPRO*

Estoy aquí para ayudarte a gestionar tus finanzas de manera inteligente. 🧠✨

*¿Qué puedo hacer por ti?*
📸 *Analizar Facturas:* Envíame una foto o PDF y extraeré los datos automáticamente.
🎤 *Reconocimiento de Voz:* Envíame un audio diciendo tu gasto.
💬 *Chat Natural:* Dime "registra un gasto de 20 soles en almuerzo".
📊 *Consultas:* Pregúntame "¿cuánto gasté en comida este mes?".

¡Empecemos! Envíame tu primer gasto. 🚀`;

              await wa.sendText(phoneNormalized!, '✅ ¡Tu cuenta ha sido vinculada con éxito!');
              try { await wa.sendText(phoneNormalized!, welcomeMsg); } catch {}
              return;
            } else {
              await wa.sendText(phoneNormalized!, '❌ Código inválido o expirado. Genera uno nuevo desde el dashboard.');
              return;
            }
          }
          // Aceptar únicamente códigos de 6 caracteres que contengan al menos un dígito.
          // Evita colisiones con palabras como "gastos", "saldo", etc.
          const match = txt.match(/^(?=.*\d)[A-Za-z0-9]{6}$/);
          const code = match ? txt.toLowerCase() : null;
          if (code) {
            const key = `wa_link:${code}`;
            const entry = await app.prisma.aiCache.findUnique({ where: { key } });
            const ageSec = entry ? (Date.now() - new Date(entry.createdAt).getTime()) / 1000 : 0;
            if (entry && ageSec > (entry.ttl || 0)) {
              await app.prisma.aiCache.delete({ where: { key } }).catch(() => {});
            }
            const val: any = entry?.value ?? null;
            const uid: string | undefined = typeof val?.userId === 'string' ? val.userId : undefined;
            // Sólo actuar si el código existe en cache y no está expirado
            if (uid && entry && ageSec <= (entry.ttl || 0)) {
              app.log.info({ msg: 'wazend link attempt', code, userId: uid, phone: phoneNormalized });
              
              // Verificar si el número ya está en uso por otro usuario (ej. Shadow Account)
              const existingUser = await app.prisma.user.findUnique({ 
                where: { whatsappPhone: phoneNormalized } 
              });

              if (existingUser && existingUser.id !== uid) {
                // Si es una cuenta shadow/lead, la desvinculamos para permitir el enlace con la cuenta real
                if (existingUser.password === 'SHADOW_ACCOUNT' || existingUser.status === 'NEW_LEAD') {
                    await app.prisma.user.update({
                        where: { id: existingUser.id },
                        data: { whatsappPhone: null }
                    });
                    app.log.info({ msg: 'Unlinked phone from shadow account', shadowUserId: existingUser.id, phone: phoneNormalized });
                } else {
                    // Si es otra cuenta real, bloqueamos
                    await wa.sendText(phoneNormalized!, '❌ Este número ya está asociado a otra cuenta de ContaPRO.');
                    return;
                }
              }

              await app.prisma.user.update({ where: { id: uid }, data: { whatsappPhone: phoneNormalized, whatsappLinkedAt: new Date() } });
              try { await app.prisma.aiCache.delete({ where: { key } }); } catch {}
              const welcomeMsg = `🤖 *Hola, soy tu Agente de IA de ContaPRO*

Estoy aquí para ayudarte a gestionar tus finanzas de manera inteligente. 🧠✨

*¿Qué puedo hacer por ti?*
📸 *Analizar Facturas:* Envíame una foto o PDF y extraeré los datos automáticamente.
🎤 *Reconocimiento de Voz:* Envíame un audio diciendo tu gasto.
💬 *Chat Natural:* Dime "registra un gasto de 20 soles en almuerzo".
📊 *Consultas:* Pregúntame "¿cuánto gasté en comida este mes?".

¡Empecemos! Envíame tu primer gasto. 🚀`;

              await wa.sendText(phoneNormalized!, '✅ ¡Tu cuenta ha sido vinculada con éxito!');
              try { await wa.sendText(phoneNormalized!, welcomeMsg); } catch {}
              app.log.info({ msg: 'wazend link success', userId: uid, phone: phoneNormalized });
              return;
            } else {
              await wa.sendText(phoneNormalized!, '❌ Código inválido o expirado. Genera uno nuevo desde el dashboard.');
              return;
            }
          }

          // Help command
          if (/^(ayuda|help|comandos|que puedes hacer|qué puedes hacer)$/i.test(txt)) {
              const helpMsg = `🤖 *Agente de IA ContaPRO*

Aquí tienes algunas cosas que puedo hacer por ti:

📝 *Registrar Gastos*
• "Compré un café por 5 soles"
• Envía una foto de tu recibo o factura
• Envía un audio diciendo tu gasto

💰 *Presupuestos y Alertas*
• "Define mi presupuesto de este mes en 2000"
• "Pon un presupuesto de 500 para Alimentos"
• "Avísame si gasto más del 80% en Transporte"

📊 *Consultas*
• "¿Cuánto he gastado este mes?"
• "¿Cómo voy con mi presupuesto?"
• "Listame mis últimos 5 gastos"
• "¿Ya borraste el gasto de ayer?"

⚙️ *Gestión*
• "Elimina el gasto de 50 soles"
• "Cambia la categoría del último gasto a Salud"

¡Simplemente habla conmigo como si fuera tu contador personal! 😉`;
              await wa.sendText(phoneNormalized!, helpMsg);
              return;
          }

          // Antes de procesar texto natural, verificar si el usuario existe y su límite
          const user = await getUserByPhone();
          if (!user) { try { await wa.sales.handleUnlinked('whatsapp', phoneNormalized!, (t: string) => wa.sendText(phoneNormalized!, t), txt); } catch {} return; }
          if (!isEntitled(user)) { try { await wa.sales.handleExpired('whatsapp', phoneNormalized!, (t: string) => wa.sendText(phoneNormalized!, t), txt); } catch {} return; }
          if (!(await checkMessageLimit(user, wa, phoneNormalized!))) return;

          // Process text with Agent (Natural Language)
          // The agent handles intent detection, expense creation, queries, etc.
          await wa.processText(phoneNormalized!, txt, candidate.messageId);
        } catch (e) {
          app.log.error({ msg: 'Background text processing error', e });
        }
      })();
      return reply.status(200).send({ ok: true });
    }

    return reply.status(200).send({ ok: true });
  });
};
