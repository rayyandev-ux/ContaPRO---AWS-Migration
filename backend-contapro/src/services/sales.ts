import type { FastifyInstance } from 'fastify';
import OpenAI from 'openai';
import { config } from '../config.js';
import { generateMagicToken } from '../utils/jwt.js';

type Platform = 'whatsapp' | 'telegram';

export class SalesService {
  private app: FastifyInstance;
  private openai: OpenAI;

  constructor(app: FastifyInstance) {
    this.app = app;
    this.openai = new OpenAI({ apiKey: config.openaiApiKey });
  }

  private async createShadowAccount(platform: Platform, phone: string): Promise<string> {
    // 1. Check if user exists (even if unlinked or pending)
    const digits = String(phone).replace(/[^0-9]/g, '');
    const withPlus = `+${digits}`;
    const tempEmail = `${digits}@contapro.temp`;
    
    let user = await this.app.prisma.user.findFirst({
        where: { 
            OR: [ 
                { whatsappPhone: String(phone) }, 
                { whatsappPhone: withPlus },
                { email: tempEmail }
            ] 
        }
    });

    if (!user) {
        // Create Shadow Account
        user = await this.app.prisma.user.create({
            data: {
                whatsappPhone: withPlus, // Normalize
                plan: 'FREE',
                status: 'NEW_LEAD',
                email: tempEmail, // Temp email
                password: 'SHADOW_ACCOUNT',
                preferredCurrency: 'PEN',
                language: 'es' // Default to Spanish for leads, will be updated upon registration
            }
        });
        try {
            const existingDefault = await this.app.prisma.profile.findFirst({ where: { userId: user.id, isDefault: true } });
            if (!existingDefault) {
                await this.app.prisma.profile.create({
                    data: { userId: user.id, name: 'Mi Perfil', isDefault: true, color: '#7c3aed', avatar: 'default' }
                });
            }
        } catch {}
    }

    // 2. Generate Magic Token (24h)
    const defaultProfile = await this.app.prisma.profile.findFirst({ where: { userId: user.id, isDefault: true } });
    const token = generateMagicToken(user.id, '24h', defaultProfile?.id);
    
    // 3. Return Link
    return `https://contapro.lat/api/auth/magic-activate?token=${token}`;
  }

  private async generateSalesResponse(userQuery: string, type: 'lead' | 'churn', magicLink?: string): Promise<string> {
    const isLead = type === 'lead';
    
    // Si detectamos intención de cambio de idioma o configuración en el mensaje del lead, lo procesamos aunque sea sales
    // Pero por simplicidad, SalesService se enfoca en VENTAS.
    // La configuración real se hace en ChatService (usuarios activos).
    // Aquí solo mantenemos el pitch de ventas multilingüe.

    const systemPrompt = `Eres el Agente de Ventas y Soporte de ContaPRO (un gestor de gastos inteligente con IA).

    TU OBJETIVO: ${isLead ? 'CONVERTIR AL USUARIO (LEAD) EN TRIAL (PRUEBA)' : 'RECUPERAR AL USUARIO (CHURN)'}.

    INSTRUCCIÓN DE IDIOMA / LANGUAGE INSTRUCTION:
    Detecta el idioma del usuario (Español, Inglés o Portugués) y responde SIEMPRE en ese mismo idioma.
    
    SI EL USUARIO PIDE CAMBIAR IDIOMA explícitamente (ej. "speak english"):
    - Responde en el nuevo idioma confirmando el cambio, PERO NO OLVIDES TU OBJETIVO DE VENTA.
    - Ejemplo: "Understood! I'll speak English. Now, about your free trial..."

    SI ES UN LEAD (NUEVO USUARIO):
    - Usa un tono INTELIGENTE, PROACTIVO y con un toque de HUMOR (estilo "Memorae").
    - NO le pidas registrarse manualmente. YA LE HAS CREADO UNA CUENTA.
    - TU MISIÓN es que haga clic en el "Magic Link" para activar su regalo.
    - EL REGALO ES: 14 Días de Premium Gratis (Trial).

    PLANTILLAS DE RESPUESTA (ADAPTA SEGÚN EL IDIOMA):

    [ESPAÑOL]
    "¿Sabes qué? Me caes bien. Te voy a activar 14 días de ContaPRO Premium GRATIS. Sin tarjetas, sin trucos.
    Solo quiero que veas cómo convierto una foto de tu factura, un audio rápido o un simple texto en reportes financieros ordenados. 📊
    
    Activa tu regalo aquí (expira en 24h):
    👉 ${magicLink}"

    [ENGLISH]
    "You know what? I like your vibe. I'm activating 14 days of ContaPRO Premium for FREE. No cards, no tricks.
    I just want you to see how I turn a photo of your receipt, a quick voice note, or a simple text into organized financial reports. 📊

    Activate your gift here (expires in 24h):
    👉 ${magicLink}"

    [PORTUGUÊS]
    "Quer saber? Gostei de você. Vou ativar 14 dias de ContaPRO Premium GRÁTIS. Sem cartões, sem truques.
    Só quero que você veja como transformo uma foto da sua fatura, um áudio rápido ou um simples texto em relatórios financeiros organizados. 📊

    Ative seu presente aqui (expira em 24h):
    👉 ${magicLink}"

    SI ES CHURN (VENCIDO):
    - Sé directo pero amable. Recuérdale lo que pierde.
    - Precios: Mensual $8.90, Anual $49.90, Vitalicio $69.90.
    - Link: https://contapro.lat/pricing

    IMPORTANTE:
    - Si el usuario dice "Hola", lanza el PITCH DE BIENVENIDA (Plantillas arriba).
    - Si el usuario pregunta "Cómo funciona", responde brevemente y CIERRA con el Magic Link.
    - NO inventes enlaces. Usa SOLO el proporcionado.`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: config.openaiModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userQuery }
        ],
        temperature: 0.7,
        max_tokens: 300
      });
      return completion.choices[0]?.message?.content || (isLead ? `¡Hola! Activa tu prueba de 14 días aquí: ${magicLink}` : `Renueva tu plan aquí: https://contapro.lat/pricing`);
    } catch (e) {
      console.error('Sales AI Error:', e);
      return isLead ? `¡Hola! Activa tu prueba de 14 días aquí: ${magicLink}` : `Renueva tu plan aquí: https://contapro.lat/pricing`;
    }
  }

  /**
   * Maneja el caso de usuario no vinculado (Lead).
   * Ahora implementa el flujo "Memorae": Shadow Account + Magic Link.
   */
  async handleUnlinked(platform: Platform, chatIdOrPhone: string | number, sendMessageFn: (text: string) => Promise<any>, text?: string) {
    let magicLink = '';

    if (platform === 'whatsapp') {
        // WhatsApp: Fricción Cero. Creamos cuenta y generamos link.
        magicLink = await this.createShadowAccount(platform, String(chatIdOrPhone));
    } else {
        // Telegram: Si llega aquí sin estar vinculado, es porque ya compartió contacto (idealmente)
        // O si es un mensaje de texto normal sin contacto, no podemos crear cuenta aún.
        if (String(chatIdOrPhone).length < 8) { 
             await sendMessageFn("Please share your contact to start. / Por favor comparte tu contacto para iniciar.");
             return;
        }
        magicLink = await this.createShadowAccount(platform, String(chatIdOrPhone));
    }

    // Si hay texto, usamos la IA para responder con el Magic Link inyectado
    if (text && text.trim().length > 0) {
        const response = await this.generateSalesResponse(text, 'lead', magicLink);
        await sendMessageFn(response);
        return;
    }

    // Si es solo media o vacío (primer contacto sin texto), lanzamos el pitch directo
    const key = `sales:unlinked:${platform}:${chatIdOrPhone}`;
    const lastSent = await this.app.prisma.aiCache.findUnique({ where: { key } });
    
    // Si ya enviamos el pitch, enviamos recordatorio
    if (lastSent) {
        const shortMsg = `👋 ¡Hola de nuevo! / Hi again! \n\nRecuerda activar tu regalo (14 días Premium) aquí: \n👉 ${magicLink}`;
        await sendMessageFn(shortMsg);
        return;
    }

    // Pitch Inicial (Default si no hay texto para analizar idioma, asumimos Español/Inglés genérico o enviamos multilingüe)
    // Usamos un prompt más limpio sin tanto texto mixto si es posible, pero para primer contacto está bien.
    const pitch = `👋 ¡Hola! / Hello! / Olá!
    
(ES) ¿Sabes qué? Me caes bien. Te activo **14 días de ContaPRO Premium GRATIS**. 
Sin tarjetas. Convierte audios y fotos en finanzas. 📊

(EN) I like your vibe. Activating **14 days of Premium for FREE**. 
No cards. Turn voice notes & photos into finance reports. 📊

(PT) Gostei de você. Ativando **14 dias de Premium GRÁTIS**. 
Sem cartões. Transforme áudios e fotos em finanças. 📊

👉 Activa aquí / Activate here: 
${magicLink}`;

    await sendMessageFn(pitch);

    await this.app.prisma.aiCache.create({
        data: { key, value: { sentAt: new Date() }, ttl: 3600 }
    });
  }

  /**
   * Maneja el caso de usuario con plan vencido (Churn).
   * Si hay texto, responde con IA. Si es solo media, usa el pitch estático.
   */
  async handleExpired(platform: Platform, chatIdOrPhone: string | number, sendMessageFn: (text: string) => Promise<any>, text?: string) {
    // Si hay texto, usamos la IA
    if (text && text.trim().length > 0) {
        const response = await this.generateSalesResponse(text, 'churn');
        await sendMessageFn(response);
        return;
    }

    const key = `sales:expired:${platform}:${chatIdOrPhone}`;
    // Verificar cooldown (ej. 1 hora)
    const lastSent = await this.app.prisma.aiCache.findUnique({ where: { key } });
    if (lastSent) {
        const shortMsg = `🔒 *Función Premium Bloqueada*\n\nReactiva tu cuenta aquí para continuar: https://contapro.lat/pricing`;
        await sendMessageFn(shortMsg);
        return;
    }

    // Script de Retención (Precios Reales)
    const pitch = `🔒 *Función Premium Bloqueada*
    
    Tu periodo de prueba o suscripción ha finalizado. 😢

    Para procesar este audio, imagen o texto y mantener tus reportes al día, necesitas reactivar tu cuenta.

    💎 *Precios:*
    • Mensual: *$8.90*
    • Anual: *$49.90* (¡Ahorras un 53%!)
    • De Por Vida: *$69.90* (Un solo pago)

    👉 *Reactiva aquí al instante:*
    https://contapro.lat/pricing

    _¡Tus datos siguen seguros! Reactiva ahora y sigue sumando._`;

    await sendMessageFn(pitch);

    // Guardar en cache con TTL de 1 hora
    await this.app.prisma.aiCache.create({
        data: {
            key,
            value: { sentAt: new Date() },
            ttl: 3600
        }
    });
  }
}
