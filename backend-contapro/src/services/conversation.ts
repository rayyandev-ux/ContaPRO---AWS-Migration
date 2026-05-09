
import { FastifyInstance } from 'fastify';
import { getRedis } from './redis.js';
import { AgentService } from './agent.js';
import { GroqService } from './groq.js';
import { formatDMY } from '../utils/format.js';

export class ConversationHandler {
  private app: FastifyInstance;
  private agent: AgentService;
  private groq: GroqService;

  constructor(app: FastifyInstance) {
    this.app = app;
    this.agent = new AgentService(app);
    this.groq = new GroqService();
  }

  async handleMessage(userId: string, text: string, source: 'WHATSAPP' | 'TELEGRAM' | 'WEB', context?: any): Promise<string | { text: string; buttons?: any[]; mediaBuffer?: Buffer }> {
    const redis = getRedis(this.app);
    
    // Si no hay Redis, pasamos directo al agente (modo stateless)
    if (!redis) {
        return this.agent.processMessage(userId, text, { ...context, source });
    }

    const stateKey = `chat_state:${userId}`;
    const stateRaw = await redis.get(stateKey);

    if (stateRaw) {
      const state = JSON.parse(stateRaw);
      
      // Lógica de aprobación de gastos pendientes
      if (state.action === 'WAITING_EXPENSE_APPROVAL') {
        return this.handleApprovalFlow(userId, text, state, redis, source, context);
      }
    }

    // Flujo normal
    return this.agent.processMessage(userId, text, { ...context, source });
  }

  private async handleApprovalFlow(userId: string, text: string, state: any, redis: any, source: 'WHATSAPP' | 'TELEGRAM' | 'WEB', context?: any): Promise<string | { text: string; buttons?: any[]; mediaBuffer?: Buffer }> {
    const pendingExpenses = state.pendingExpenses || [];
    
    // Si el estado es antiguo (solo 1 gasto), lo convertimos a array para compatibilidad
    if (state.pendingExpenseId && pendingExpenses.length === 0) {
        pendingExpenses.push({
            id: state.pendingExpenseId,
            context: state.expenseContext
        });
    }

    if (pendingExpenses.length === 0) {
        await redis.del(`chat_state:${userId}`);
        return "No encontré gastos pendientes para procesar.";
    }

    // Obtener Perfil del usuario para nombre y perfil default
    const user = await this.app.prisma.user.findUnique({ where: { id: userId }, include: { profiles: true } });
    const defaultProfileId = user?.profiles.find(p => p.isDefault)?.id || user?.profiles[0]?.id;
    const userName = user?.name ? user.name.split(' ')[0] : 'amigo';

    // Desactivamos RAG intencionalmente en este flujo para evitar alucinaciones con gastos pasados.
    const memoryContext = '';

    // 1. Analizar intención con LLM (Soporte Batch y Acciones Mixtas)
    const prompt = `
    El usuario tiene ${pendingExpenses.length} gasto(s) pendiente(s) de aprobación.
    
    Lista de gastos:
    ${JSON.stringify(pendingExpenses.map((p: any, i: number) => ({ index: i + 1, ...p.context })), null, 2)}
    
    El usuario respondió: "${text}"
    
    Analiza la intención y responde en JSON estricto con una lista de acciones:
    {
      "actions": [
        {
          "intent": "APPROVE" | "REJECT" | "MODIFY" | "IGNORE",
          "target_indices": number[] | "ALL", // Índices (1-based). "ALL" para todos.
          "changes": { "amount": number, "currency": "PEN"|"USD", "category": "string", "description": "string", "merchant": "string" } (Opcional, se extrae si el usuario da detalles como "en tambo", "es un free tea")
        }
      ],
      "others_behavior": "KEEP" | "REJECT", // Qué hacer con los gastos NO mencionados en las acciones. Default: KEEP.
      "reply_message": "Mensaje corto para el usuario. IMPORTANTE: Sé un AMIGO CERCANO, EMPÁTICO Y CON GRAN SENTIDO DEL HUMOR. Usa su nombre (${userName}) y responde de forma muy cálida y casual. Usa emojis.",
      "is_new_topic": boolean // true si el usuario dicta un NUEVO GASTO o cambia de tema radicalmente (ej. "Hola", "Gasto 5 soles en pan").
    }
    ${memoryContext}
    
    REGLAS:
    - "Sí", "Ok", "Acepto todos" -> actions: [{ intent: "APPROVE", target_indices: "ALL" }], is_new_topic: false
    - "No", "Rechazar todos" -> actions: [{ intent: "REJECT", target_indices: "ALL" }], is_new_topic: false
    - "Solo el 1 y 3" -> actions: [{ intent: "APPROVE", target_indices: [1, 3] }], others_behavior: "REJECT" (Porque dijo "Solo")
    - "Aprueba el 1" -> actions: [{ intent: "APPROVE", target_indices: [1] }], others_behavior: "KEEP" (No dijo que rechace el resto)
    - "Rechaza todos menos el primero" -> 
        actions: [
            { intent: "APPROVE", target_indices: [1] }
        ], others_behavior: "REJECT"
    - "Acepto el 1 pero rechazo el 2" -> 
        actions: [
            { intent: "APPROVE", target_indices: [1] },
            { intent: "REJECT", target_indices: [2] }
        ], others_behavior: "KEEP" (Ya especificó qué hacer con el 2, el 3 si existe se mantiene)
    - "Sí pero el de comida es 50" -> actions: [{ intent: "MODIFY", target_indices: [index], changes: { amount: 50 } }], is_new_topic: false (Es corrección)
    - "Si, me compre un free tea en el tambo, ponlo en Bebidas" -> actions: [{ intent: "MODIFY", target_indices: [1], changes: { category: "Bebidas", merchant: "tambo", description: "free tea" } }], is_new_topic: false
    - "Gasto de 5 soles en Tambo" (Si no tiene relación con el pendiente) -> actions: [], is_new_topic: true (Es un NUEVO GASTO, no una corrección)
    - "Hola", "¿Qué hago?", "¿Pendientes?", "¿Tengo gastos pendientes?" -> actions: [], is_new_topic: true (Es una pregunta general)
    - "No tengo pendientes", "Ya no hay nada" -> actions: [], is_new_topic: true (Usuario informa estado, no es una orden)
    `;

    const aiRes = await this.groq.chatCompletion([
      { role: 'system', content: 'Eres un asistente financiero inteligente que gestiona aprobaciones de gastos.' },
      { role: 'user', content: prompt }
    ]);

    if (!aiRes) return "Hubo un error al procesar tu respuesta. ¿Puedes repetir?";

    // 2. Manejo de Nuevo Tema (Interrupción del flujo)
    if (aiRes.is_new_topic) {
        // Borramos el estado de conversación para liberar el flujo
        await redis.del(`chat_state:${userId}`);
        // Reenviamos el mensaje original al agente para que lo procese como nuevo comando
        return this.agent.processMessage(userId, text, { ...context, source });
    }

    // Normalizar respuesta (soporte backward compatibility temporal)
    let actions = aiRes.actions;
    const { reply_message } = aiRes;

    // Si el LLM devuelve el formato antiguo o algo inesperado
    if (!actions || !Array.isArray(actions)) {
        if (aiRes.intent) {
            actions = [{
                intent: aiRes.intent,
                target_indices: aiRes.target_indices,
                changes: aiRes.changes
            }];
        } else {
            // Fallback total: Si no entiendo la acción, asumo que es una consulta general
            await redis.del(`chat_state:${userId}`);
            return this.agent.processMessage(userId, text, { ...context, source });
        }
    }

    // SAFEGUARD: Si no hay acciones válidas (intent explícito), NO procesar rechazos implícitos.
    // Esto evita que una pregunta mal interpretada borre todos los gastos.
    const validActions = actions.filter((a: any) => ['APPROVE', 'REJECT', 'MODIFY'].includes(a.intent));
    if (validActions.length === 0) {
        // Si no hay acciones concretas, asumimos cambio de tema o consulta
        await redis.del(`chat_state:${userId}`);
        return this.agent.processMessage(userId, text, { ...context, source });
    }

    // Procesar acciones secuencialmente
    let processedCount = 0;
    const processedIds = new Set<string>(); // Evitar procesar el mismo gasto dos veces en el mismo batch

    for (const action of actions) {
        const { intent, target_indices, changes } = action;

        if (intent === 'UNKNOWN') continue;
        if (intent === 'IGNORE') continue; // Explicitly ignored

        // Determinar índices para ESTA acción
        let indicesToProcess: number[] = [];
        if (target_indices === 'ALL') {
            indicesToProcess = pendingExpenses.map((_: any, i: number) => i);
        } else if (Array.isArray(target_indices)) {
            indicesToProcess = target_indices.map((i: number) => i - 1).filter((i: number) => i >= 0 && i < pendingExpenses.length);
        }

        for (const index of indicesToProcess) {
            const item = pendingExpenses[index];
            const pendingId = item.id;

            // Skip if already processed in a previous action within this batch
            if (processedIds.has(pendingId)) continue;

            if (intent === 'REJECT') {
                await this.app.prisma.pendingExpense.update({
                    where: { id: pendingId },
                    data: { status: 'REJECTED' }
                });
                processedIds.add(pendingId);
                processedCount++;
            } else if (intent === 'APPROVE' || intent === 'MODIFY') {
                const pending = await this.app.prisma.pendingExpense.findUnique({ where: { id: pendingId } });
                if (!pending) continue;
                
                // FIX: Check status to prevent duplicate processing
                if (pending.status !== 'WAITING_USER') {
                    this.app.log.warn({ msg: 'Skipping expense not in WAITING_USER state', id: pendingId, status: pending.status });
                    continue;
                }

                const finalData = {
                    amount: (indicesToProcess.length === 1 ? changes?.amount : null) || pending.amount,
                    currency: (indicesToProcess.length === 1 ? changes?.currency : null) || pending.currency,
                    description: (indicesToProcess.length === 1 ? changes?.description : null) || pending.description || pending.rawText || 'Gasto importado',
                    date: pending.date,
                    merchant: (indicesToProcess.length === 1 ? changes?.merchant : null) || pending.merchant || pending.source,
                    categoryId: null as string | null
                };

                if (indicesToProcess.length === 1 && changes?.category) {
                    let category = await this.app.prisma.category.findFirst({
                        where: { userId, name: { contains: changes.category, mode: 'insensitive' } }
                    });
                    if (!category) {
                        category = await this.app.prisma.category.create({
                            data: {
                                userId,
                                name: changes.category,
                                profileId: defaultProfileId
                            }
                        });
                    }
                    finalData.categoryId = category.id;
                }

                try {
                    const expense = await this.app.prisma.expense.create({
                        data: {
                            userId,
                            amount: finalData.amount,
                            currency: finalData.currency,
                            description: finalData.description,
                            issuedAt: finalData.date,
                            type: 'INFORMAL',
                            source: 'DOCUMENT',
                            provider: finalData.merchant,
                            categoryId: finalData.categoryId,
                            profileId: defaultProfileId // FIX: Assign profile
                        }
                    });

                    // Attach Screenshot if available
                    if (pending.screenshotPath) {
                        this.app.log.info({ msg: 'Attaching screenshot to expense', pendingId, path: pending.screenshotPath });
                        try {
                            // Verify file exists
                            const fs = await import('node:fs/promises');
                            try {
                                await fs.access(pending.screenshotPath);
                            } catch (e) {
                                this.app.log.warn({ msg: 'Screenshot file not found on disk', path: pending.screenshotPath });
                                // Don't throw, just skip attachment? Or continue and let create fail?
                            }

                            const doc = await this.app.prisma.document.create({
                                data: {
                                    userId,
                                    profileId: defaultProfileId,
                                    filename: `email_evidence_${pending.id}.png`,
                                    mimeType: 'image/png',
                                    storagePath: pending.screenshotPath
                                }
                            });
                            
                            await this.app.prisma.expense.update({
                                where: { id: expense.id },
                                data: { documentId: doc.id }
                            });
                            this.app.log.info({ msg: 'Screenshot attached successfully', docId: doc.id });
                        } catch (docErr) {
                             this.app.log.error({ msg: 'Failed to attach screenshot document', error: docErr });
                        }
                    } else {
                        this.app.log.info({ msg: 'No screenshotPath for pending expense', pendingId });
                    }

                    await this.app.prisma.pendingExpense.update({
                        where: { id: pendingId },
                        data: { status: 'APPROVED' }
                    });
                    processedIds.add(pendingId);
                    processedCount++;
                } catch (err) {
                    this.app.log.error({ msg: 'Error approving expense', error: err });
                }
            }
        }
    }

    // Procesar los restantes si others_behavior es REJECT
    const othersBehavior = aiRes.others_behavior || 'KEEP';
    
    if (othersBehavior === 'REJECT') {
        for (let i = 0; i < pendingExpenses.length; i++) {
            const item = pendingExpenses[i];
            // Si no ha sido procesado (ni aprobado ni rechazado explícitamente)
            if (!processedIds.has(item.id)) {
                // Verificar estado actual antes de rechazar (evitar sobrescribir aprobaciones concurrentes)
                const current = await this.app.prisma.pendingExpense.findUnique({ where: { id: item.id } });
                
                if (current && current.status === 'WAITING_USER') {
                     await this.app.prisma.pendingExpense.update({
                        where: { id: item.id },
                        data: { status: 'REJECTED' }
                    });
                    processedIds.add(item.id);
                }
            }
        }
    }

    // Limpiar estado
    await redis.del(`chat_state:${userId}`);
    
    if (processedCount === 0) return "No se pudo procesar ningún gasto. Intenta de nuevo.";
    
    return reply_message || "Gestión de gastos completada. ✅";
  }
}
