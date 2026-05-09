import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../utils/auth.js';
import { isEntitled } from '../utils/subscription.js';
import { ConversationHandler } from '../services/conversation.js';
import { GroqService } from '../services/groq.js';
import sharp from 'sharp';

export const chatRoutes: FastifyPluginAsync = async (app) => {
  const conversationHandler = new ConversationHandler(app);
  const groqService = new GroqService();

  app.post('/message', { schema: { summary: 'Chat with AI agent' } }, async (req, res) => {
    const auth = requireAuth(app, req, res);
    if (!auth) return;
    const { userId } = auth;

    const user = await app.prisma.user.findUnique({ 
        where: { id: userId }, 
        select: { plan: true, planExpires: true, trialEnds: true, stripeSubscriptionId: true } 
    });
    if (!user) return res.unauthorized('No autenticado');
    if (!isEntitled(user)) {
      return res.paymentRequired('Suscripción requerida para usar el chat');
    }

    let mp: any = null;
    let text = '';
    
    // Si viene como multipart/form-data pero req.body no tiene text o file, usamos iteración de parts()
    if (req.isMultipart && req.isMultipart()) {
      try {
        const parts = (req as any).parts();
        for await (const part of parts) {
            if (part.type === 'file') {
                mp = part;
                // Read the buffer right away to save it
                const buf = await part.toBuffer();
                mp.bufferData = buf; // Store it for later
            } else {
                if (part.fieldname === 'text') {
                    text = part.value as string;
                }
            }
        }
      } catch (err) {
        app.log.error({ msg: 'Error parsing multipart', err });
      }
    } else {
        const bodyAny: any = (req as any).body;
        if (bodyAny && bodyAny.text) {
            text = bodyAny.text;
        }
    }

    if (!mp && !text) {
        // Fastify multipart plugin might consume parts differently depending on config, let's also check if req.body has fields.
        const bodyAny: any = (req as any).body;
        if (bodyAny) {
            if (bodyAny.text) text = bodyAny.text.value || bodyAny.text;
            if (bodyAny.file) {
                mp = Array.isArray(bodyAny.file) ? bodyAny.file[0] : bodyAny.file;
                if (mp && typeof mp.toBuffer === 'function') {
                    mp.bufferData = await mp.toBuffer();
                }
            }
        }
        
        if (!mp && !text) {
            return res.badRequest('Mensaje o archivo requerido');
        }
    }

    // If there is a file, handle it
    if (mp && mp.bufferData) {
        const mimeType = mp.mimetype as string;
        const buf = mp.bufferData;

        if (mimeType.startsWith('audio/')) {
            try {
                const transcribedText = await groqService.transcribeAudio(buf);
                text = transcribedText;
                if (!text) {
                    return res.send({ reply: "No pude entender el audio. ¿Podrías repetirlo?" });
                }
            } catch (e) {
                app.log.error({ msg: 'Audio transcription failed in web chat', e });
                return res.send({ reply: "Hubo un error procesando tu audio." });
            }
        } else if (mimeType.startsWith('image/') || mimeType === 'application/pdf') {
            // For images and PDFs, we will use the same WhatsApp logic: processUploadedBuffer
            // Wait, processUploadedBuffer expects a phone number. 
            // We need a web equivalent or to call processUploadedBuffer by modifying WhatsAppService to support web?
            // Actually, we can just use AgentService or OpenAI to extract fields here, 
            // just like in `upload.ts`, but then we return a chat response instead of standard JSON.
            
            // Let's use the WhatsAppService's logic directly if possible, or just OpenAI extraction.
            const wa: any = (app as any).whatsapp;
            if (wa) {
                // To avoid rewriting the entire extraction+agent logic, we can leverage processUploadedBuffer
                // But wait, WhatsAppService sends messages back via WhatsApp API. 
                // We don't want it to send a WhatsApp message, we want the text back.
            }
            
            // So we must handle it manually for WEB.
            try {
                let extraction: any = null;

                if (mimeType.startsWith('image/')) {
                    const analysisBuffer = await sharp(buf).rotate().greyscale().normalize().resize({ width: 2000, withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer();
                    const b64 = analysisBuffer.toString('base64');
                    const dataUri = `data:image/png;base64,${b64}`;
                    
                    extraction = await groqService.analyzeImage(dataUri);
                    
                    const isEmptyExtraction = extraction && (!extraction.amount || extraction.amount === 0);
                    if (!extraction || isEmptyExtraction) {
                        extraction = { 
                            warning: "La extracción automática de la imagen falló o no detectó datos claros.",
                            instruction: "EL USUARIO HA ENVIADO UNA IMAGEN DE GASTO. Confía plenamente en el texto que acompaña la imagen para registrar el gasto. Si falta el monto, PREGUNTA."
                        };
                    }
                } else if (mimeType === 'application/pdf') {
                    // Fallback to OpenAI only for PDFs because Groq doesn't process PDFs directly
                    const ai = await import('../services/openai.js').then(m => m.createOpenAI(app));
                    extraction = await ai.extractExpenseFields(app, {
                        filename: mp.filename,
                        mimeType: mimeType,
                        size: buf.length,
                    }, buf);
                }

                // Pass the extraction context to the ConversationHandler
                const context = {
                    extractedData: extraction,
                    originalText: text
                };
                
                // Construct a text for the agent to know what happened
                const promptText = text ? `Adjunté un documento y escribí: "${text}". Los datos extraídos son: ${JSON.stringify(extraction)}` : `Adjunté un documento. Los datos extraídos son: ${JSON.stringify(extraction)}. Por favor regístralo o dime qué opinas.`;

                const reply = await conversationHandler.handleMessage(userId, promptText, 'WEB' as any, context);
                const replyText = typeof reply === 'string' ? reply : reply.text;
                return res.send({ reply: replyText });

            } catch (e) {
                app.log.error({ msg: 'Document processing failed in web chat', e });
                return res.send({ reply: "Hubo un error analizando tu documento." });
            }
        }
    }

    // Normal Text Message
    try {
        const reply = await conversationHandler.handleMessage(userId, text, 'WEB' as any);
        const replyText = typeof reply === 'string' ? reply : reply.text;
        return res.send({ reply: replyText });
    } catch (e) {
        app.log.error({ msg: 'Text processing failed in web chat', e });
        return res.send({ reply: "Ocurrió un error procesando tu mensaje." });
    }
  });
};
