
import { FastifyInstance } from 'fastify';
import { getRedis } from './redis.js';
import { formatDMY } from '../utils/format.js';

export class NotificationService {
  constructor(private app: FastifyInstance) {}

  async notify(userId: string, message: string) {
    const user = await this.app.prisma.user.findUnique({
        where: { id: userId },
        select: { telegramId: true, whatsappPhone: true }
    });

    if (!user) return;

    let sent = false;

    // Intentar WhatsApp
    if (user.whatsappPhone) {
        const wa = (this.app as any).whatsapp;
        if (wa) {
            try {
                await wa.sendText(user.whatsappPhone, message);
                sent = true;
            } catch (e) {
                this.app.log.error({ msg: 'Failed to send WhatsApp notification', userId, error: e });
            }
        }
    } 
    
    // Intentar Telegram
    if (user.telegramId) {
        const tg = (this.app as any).telegram;
        if (tg) {
            try {
                await tg.sendMessage(user.telegramId, message);
                sent = true;
            } catch (e) {
                this.app.log.error({ msg: 'Failed to send Telegram notification', userId, error: e });
            }
        }
    }
    
    return sent;
  }

  async notifyPendingExpense(pendingExpenseId: string) {
    this.app.log.info({ msg: 'notifyPendingExpense called', id: pendingExpenseId });
    const pending = await this.app.prisma.pendingExpense.findUnique({
      where: { id: pendingExpenseId },
      include: { user: true }
    });
    if (!pending) {
        this.app.log.warn({ msg: 'notifyPendingExpense: expense not found', id: pendingExpenseId });
        return;
    }

    const { user } = pending;
    const redis = getRedis(this.app);
    const userName = user.name ? user.name.split(' ')[0] : 'amigo';

    // Mensaje con tono más natural y "cool" (estilo AgentService)
    const msg = `¡Hey ${userName}! 👋 Acabo de pillar un nuevo gasto.

Vi un movimiento de *${pending.merchant || 'algún lugar misterioso'}* por:
💰 *${pending.currency} ${pending.amount.toFixed(2)}*
📅 ${formatDMY(new Date(pending.date))}
${pending.description ? `📝 "${pending.description}"` : ''}

¿Qué hacemos? ¿Lo anoto en tu contabilidad? 👇
✅ *"Sí"*  /  ❌ *"No"*
✏️ *"Sí, fue en comida"* (para corregir la categoría o el lugar)`;

    const state = {
      action: 'WAITING_EXPENSE_APPROVAL',
      pendingExpenses: [{
          id: pending.id,
          context: { 
            amount: pending.amount, 
            currency: pending.currency, 
            merchant: pending.merchant, 
            date: pending.date, 
            description: pending.description 
          }
      }]
    };

    let sent = false;

    // Intentar WhatsApp
    if (user.whatsappPhone) {
        const wa = (this.app as any).whatsapp;
        if (wa) {
            await wa.sendText(user.whatsappPhone, msg);
            sent = true;
        }
    } 
    
    // Intentar Telegram
    if (user.telegramId) {
        const tg = (this.app as any).telegram;
        if (tg) {
            await tg.sendMessage(user.telegramId, msg);
            sent = true;
        }
    }

    if (sent && redis) {
        await redis.set(`chat_state:${user.id}`, JSON.stringify(state), 'EX', 3600); // 1 hora
    }
  }

  async notifyPendingExpensesBatch(pendingExpenseIds: string[]) {
      if (pendingExpenseIds.length === 0) return;
      
      this.app.log.info({ msg: 'notifyPendingExpensesBatch called', ids: pendingExpenseIds });

      // Obtener el usuario del primer ID para buscar TODOS sus pendientes
      const first = await this.app.prisma.pendingExpense.findUnique({ 
          where: { id: pendingExpenseIds[0] }, 
          select: { userId: true } 
      });
      if (!first) {
          this.app.log.warn({ msg: 'First pending expense not found', id: pendingExpenseIds[0] });
          return;
      }
      
      const userId = first.userId;

      // Buscar TODOS los gastos pendientes del usuario (no solo los nuevos)
      const pendingList = await this.app.prisma.pendingExpense.findMany({
          where: { userId, status: 'WAITING_USER' },
          orderBy: { date: 'asc' },
          include: { user: true }
      });
      
      this.app.log.info({ 
          msg: 'Pending expenses found for user in batch', 
          userId, 
          count: pendingList.length, 
          ids: pendingList.map(p => p.id),
          inputIds: pendingExpenseIds,
          statuses: pendingList.map(p => p.status) 
      });

      if (pendingList.length === 0) return;

      // Si solo hay uno en total, usamos el flujo simple
      if (pendingList.length === 1) {
          this.app.log.info({ msg: 'Only 1 pending expense total, sending single notification', id: pendingList[0].id });
          return this.notifyPendingExpense(pendingList[0].id);
      }

      const user = pendingList[0].user;
      const redis = getRedis(this.app);
      const userName = user.name ? user.name.split(' ')[0] : 'amigo';

      // Construir mensaje resumen con TODOS los pendientes
      let msg = `¡Hey ${userName}! 🧐 Tienes *${pendingList.length} gastos pendientes* esperando tu visto bueno:\n\n`;
      
      const pendingExpensesData: any[] = [];

      pendingList.forEach((p, index) => {
          const num = index + 1;
          msg += `*${num}.* ${p.merchant || 'Un gasto misterioso'} — *${p.currency} ${p.amount.toFixed(2)}*\n`;
          msg += `   📅 ${formatDMY(new Date(p.date))} ${p.description ? `(${p.description})` : ''}\n\n`;
          
          pendingExpensesData.push({
              id: p.id,
              context: {
                  amount: p.amount,
                  currency: p.currency,
                  merchant: p.merchant,
                  date: p.date,
                  description: p.description
              }
          });
      });

      msg += `*¿Cómo procedemos?* 👇\n`;
      msg += `✅ "Aprobar todos"\n`;
      msg += `❌ "Rechazar todos"\n`;
      msg += `🔢 "Solo el 1 y el 3"\n`;
      msg += `✏️ "El 2 fue en comida"`;

      const state = {
          action: 'WAITING_EXPENSE_APPROVAL',
          pendingExpenses: pendingExpensesData
      };

      let sent = false;

      if (user.whatsappPhone) {
          const wa = (this.app as any).whatsapp;
          if (wa) {
              await wa.sendText(user.whatsappPhone, msg);
              sent = true;
          }
      } 
      
      if (user.telegramId) {
          const tg = (this.app as any).telegram;
          if (tg) {
              await tg.sendMessage(user.telegramId, msg);
              sent = true;
          }
      }

      if (sent && redis) {
          await redis.set(`chat_state:${user.id}`, JSON.stringify(state), 'EX', 3600);
      }
  }

  async notifyExpenseRegistered(expenseId: string) {
    const expense = await this.app.prisma.expense.findUnique({
      where: { id: expenseId },
      include: { user: true }
    });
    if (!expense) return;

    const { user } = expense;
    const msg = `✅ *Gasto Registrado Automáticamente*
    
💰 ${expense.currency} ${expense.amount.toFixed(2)}
📅 ${formatDMY(new Date(expense.issuedAt))}
🏪 ${expense.description || 'Comercio'}`;

    if (user.whatsappPhone) {
        const wa = (this.app as any).whatsapp;
        if (wa) {
            this.app.log.info({ msg: 'Notifying WhatsApp', phone: user.whatsappPhone });
            await wa.sendText(user.whatsappPhone, msg);
        }
    }
    
    if (user.telegramId) {
        const tg = (this.app as any).telegram;
        if (tg) {
            this.app.log.info({ msg: 'Notifying Telegram', chatId: user.telegramId });
            await tg.sendMessage(user.telegramId, msg);
        }
    }
  }
}
