import type { FastifyInstance } from 'fastify';
import { Worker } from 'bullmq';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { createOpenAI } from '../services/openai.js';
import { formatDMY, sanitizeText, formatExpenseMessage } from '../utils/format.js';
import { checkBudgetAlertAfterExpense, ensureBudgetForUserMonth } from '../routes/budget.js';
import { isEntitled } from '../utils/subscription.js';

export type AnalysisJobData = {
  userId: string;
  documentId: string;
  filename: string;
  mimeType: string;
  storagePath: string;
};

export function setupAnalysisWorker(app: FastifyInstance, connection: any) {
  const worker = new Worker<AnalysisJobData>('analysis', async (job) => {
    const { userId, documentId, filename, mimeType, storagePath } = job.data;

    const buf = await fs.readFile(storagePath);
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

    const ai = createOpenAI(app);
    const extraction = await ai.extractExpenseFields(app, {
      filename,
      mimeType: analysisMime,
      size: analysisBuffer.length,
    }, analysisBuffer);

    app.log.info({ msg: 'queue: extraction summary', summary: extraction?.summary, totals: extraction?.totals, provider: extraction?.provider });

    const user = await app.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      app.log.warn('queue: user not found');
      return;
    }
    const docMeta = await app.prisma.document.findUnique({ where: { id: documentId }, select: { profileId: true } });
    const profileId = docMeta?.profileId ?? null;

    const type = (() => {
      const t = String((extraction as any)?.type || '').toUpperCase();
      if (t === 'FACTURA' || t === 'BOLETA') return t as 'FACTURA' | 'BOLETA' | 'INFORMAL';
      return 'INFORMAL';
    })();
    const issuedStr: string = String(extraction?.issuedAt || extraction?.fecha_emision || '').trim();
    const issued: Date = issuedStr ? new Date(issuedStr) : new Date();
    if (!isEntitled(user)) {
      const nowM = new Date();
      const start = new Date(nowM.getFullYear(), nowM.getMonth(), 1);
      const end = new Date(nowM.getFullYear(), nowM.getMonth() + 1, 0, 23, 59, 59, 999);
      const count = await app.prisma.expense.count({ where: { userId, profileId, type, createdAt: { gte: start, lte: end } } });
      if (count >= 10) {
        app.log.warn({ msg: 'Free plan limit reached', type });
        return;
      }
    }

    let pmIdDoc: string | null = null;
    try {
      const pms = await app.prisma.paymentMethod.findMany({ where: { userId, profileId, active: true } });
      const m = String((extraction as any)?.payment?.method || '').trim().toLowerCase();
      const last4 = String((extraction as any)?.payment?.cardLast4 || '').replace(/\D+/g, '').slice(-4);
      let hit = pms.find(x => x.provider.toLowerCase() === m);
      if (!hit && last4) hit = pms.find(x => String(x.cardLast4 || '').slice(-4) === last4 && (m ? x.provider.toLowerCase() === m : true));
      if (!hit) hit = pms.find(x => x.provider.toLowerCase() === String(type).toLowerCase());
      pmIdDoc = hit?.id ?? (await app.prisma.user.findUnique({ where: { id: userId }, select: { defaultPaymentMethodId: true } }))?.defaultPaymentMethodId ?? null;
    } catch {}
    const exp = await app.prisma.expense.create({
      data: {
        userId,
        profileId,
        type,
        source: 'DOCUMENT',
        issuedAt: issued,
        provider: sanitizeText(extraction.provider) ?? 'Proveedor desconocido',
        description: sanitizeText(extraction.description) ?? undefined,
        amount: typeof extraction?.totals?.total === 'number' ? extraction.totals.total : 0,
        currency: extraction?.totals?.currency ?? (user?.preferredCurrency || 'PEN'),
        categoryId: extraction.categoryId ?? null,
        documentId,
        paymentMethodId: pmIdDoc ?? undefined,
      },
    });
    try {
      const idNumRaw = extraction?.emitter?.idNumber ?? extraction?.ruc_proveedor ?? null;
      if (idNumRaw) {
        const idNum = sanitizeText(String(idNumRaw)) ?? null;
        await app.prisma.expense.update({ where: { id: exp.id }, data: { emitterIdNumber: idNum } });
      }
    } catch {}

    try { await ensureBudgetForUserMonth(app, userId, profileId!, issued.getFullYear(), issued.getMonth() + 1); } catch {}

    const details = { ...extraction, fecha_registro: new Date(exp.createdAt).toISOString().slice(0,10), registro_datetime: new Date(exp.createdAt).toISOString(), fecha_emision: (extraction?.issuedAt || extraction?.fecha_emision || issued.toISOString().slice(0,10)) };
    await app.prisma.analysis.create({ data: { documentId, summary: (sanitizeText(extraction.summary) ?? 'Documento procesado'), total: exp.amount, details } });

    // Telegram notify
    try {
      const tg: any = (app as any).telegram;
      if (tg && user.telegramId) {
        const currency = exp.currency || 'PEN';
        const amt = exp.amount.toFixed(2);
        const issuedTxt = formatDMY(new Date(exp.issuedAt));
        const createdTxt = formatDMY(new Date(exp.createdAt));
        const docNumber = sanitizeText((extraction?.docNumber ?? extraction?.numero_documento ?? '').toString().trim()) ?? '';
        const emitterId = (() => {
          const idNum = extraction?.emitter?.idNumber ?? extraction?.ruc_proveedor;
          return sanitizeText(idNum ? String(idNum) : '') ?? '';
        })();
        const catObj = exp.categoryId ? await app.prisma.category.findUnique({ where: { id: exp.categoryId } }) : null;
        const subtotal = typeof extraction?.totals?.subtotal === 'number' ? extraction.totals.subtotal : undefined;
        const taxesArr: any[] = Array.isArray(extraction?.totals?.taxes) ? extraction.totals.taxes : [];
        const igvAmt = taxesArr.find(t => /igv/i.test(String(t?.name)))?.amount ?? (typeof taxesArr[0]?.amount === 'number' ? taxesArr[0].amount : undefined);
        const categoryName = sanitizeText((extraction?.categoryName ?? extraction?.categoria_gasto ?? '').toString().trim()) ?? '';
        const expDesc = sanitizeText(exp.description);
        const text = formatExpenseMessage({
          title: '🧾 *Nuevo gasto registrado*',
          provider: exp.provider,
          amount: amt,
          currency,
          issuedText: issuedTxt,
          createdText: createdTxt,
          type: exp.type,
          docNumber,
          emitterId,
          category: catObj?.name || categoryName || undefined,
          subtotal,
          taxIgv: typeof igvAmt === 'number' ? Number(igvAmt) : undefined,
          description: expDesc,
          source: exp.source,
          id: exp.id,
        });
        await tg.sendMessage(user.telegramId, text);
      }
    } catch (e) {
      app.log.error({ msg: 'telegram notify failed (queue)', e });
    }

    // WhatsApp notify
    try {
      const wa: any = (app as any).whatsapp;
      if (wa && user.whatsappPhone) {
        const to = user.whatsappPhone.startsWith('+') ? user.whatsappPhone : `+${user.whatsappPhone}`;
        const currency = exp.currency || 'PEN';
        const amt = exp.amount.toFixed(2);
        const issuedTxt = formatDMY(new Date(exp.issuedAt));
        const createdTxt = formatDMY(new Date(exp.createdAt));
        const docNumber = sanitizeText((extraction?.docNumber ?? extraction?.numero_documento ?? '').toString().trim()) ?? '';
        const emitterId = (() => {
          const idNum = extraction?.emitter?.idNumber ?? extraction?.ruc_proveedor;
          return sanitizeText(idNum ? String(idNum) : '') ?? '';
        })();
        const catObj = exp.categoryId ? await app.prisma.category.findUnique({ where: { id: exp.categoryId } }) : null;
        const subtotal = typeof extraction?.totals?.subtotal === 'number' ? extraction.totals.subtotal : undefined;
        const taxesArr: any[] = Array.isArray(extraction?.totals?.taxes) ? extraction.totals.taxes : [];
        const igvAmt = taxesArr.find(t => /igv/i.test(String(t?.name)))?.amount ?? (typeof taxesArr[0]?.amount === 'number' ? taxesArr[0].amount : undefined);
        const categoryName = sanitizeText((extraction?.categoryName ?? extraction?.categoria_gasto ?? '').toString().trim()) ?? '';
        const expDesc = sanitizeText(exp.description);
        const text = formatExpenseMessage({
          title: '🧾 *Nuevo gasto registrado*',
          provider: exp.provider,
          amount: amt,
          currency,
          issuedText: issuedTxt,
          createdText: createdTxt,
          type: exp.type,
          docNumber,
          emitterId,
          category: catObj?.name || categoryName || undefined,
          subtotal,
          taxIgv: typeof igvAmt === 'number' ? Number(igvAmt) : undefined,
          description: expDesc,
          source: exp.source,
          id: exp.id,
        });
        await wa.sendText(to, text);
      }
    } catch (e) {
      app.log.error({ msg: 'whatsapp notify failed (queue)', e });
    }

    // Budget alert
    try {
      await checkBudgetAlertAfterExpense(app, userId, profileId!, new Date(exp.issuedAt), exp.amount, exp.categoryId ?? undefined);
    } catch (e) {
      app.log.error({ msg: 'budget alert check failed (queue)', e });
    }
  }, { connection, concurrency: 2 });

  worker.on('completed', (job) => app.log.info({ msg: 'analysis job completed', jobId: job.id }));
  worker.on('failed', (job, err) => app.log.error({ msg: 'analysis job failed', jobId: job?.id, err }));
}
