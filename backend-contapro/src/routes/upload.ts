import type { FastifyPluginAsync } from 'fastify';
import { config } from '../config.js';
import { createOpenAI } from '../services/openai.js';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { checkBudgetAlertAfterExpense, ensureBudgetForUserMonth } from './budget.js';
import { formatDMY, sanitizeText, formatExpenseMessage } from '../utils/format.js';
import { isEntitled } from '../utils/subscription.js';
import { requireAuth } from '../utils/auth.js';
import { CurrencyService } from '../services/currency.js';

export const uploadRoutes: FastifyPluginAsync = async (app) => {
  const currencyService = new CurrencyService(app as any);
  app.post('/', { schema: { summary: 'Upload document' } }, async (req, res) => {
    const auth = requireAuth(app, req, res);
    if (!auth) return;
    const { userId, profileId } = auth;

    const user = await app.prisma.user.findUnique({ where: { id: userId }, select: { plan: true, planExpires: true, trialEnds: true, stripeSubscriptionId: true, preferredCurrency: true, telegramId: true, whatsappPhone: true } });
    if (!user) return res.unauthorized('No autenticado');
    if (!isEntitled(user)) {
      return res.paymentRequired('Suscripción requerida');
    }

    let mp: any = null;
    const bodyAny: any = (req as any).body;
    if (bodyAny && bodyAny.file) {
      const val = bodyAny.file;
      mp = Array.isArray(val) ? val[0] : val;
    }
    if (!mp || typeof mp.toBuffer !== 'function') {
      try {
        mp = await (req as any).file().catch(() => null);
      } catch {
        mp = null;
      }
    }
    if (!mp) return res.badRequest('Archivo requerido');

    const filename = mp.filename as string;
    const mimeType = mp.mimetype as string;
    const buf = await mp.toBuffer();

    app.log.info({ msg: 'upload: received file', filename, mimeType, size: buf.length });

    // Preprocess image to improve OCR/vision robustness (rotate, grayscale, normalize, resize, PNG)
    let analysisBuffer: Buffer = buf;
    let analysisMime: string = mimeType;
    try {
      if (mimeType?.startsWith('image/')) {
        const processed = await sharp(buf)
          .rotate() // auto orient
          .greyscale()
          .normalize()
          .resize({ width: 2000, withoutEnlargement: true })
          .png({ compressionLevel: 9 })
          .toBuffer();
        analysisBuffer = processed;
        analysisMime = 'image/png';
      }
    } catch {}

    // Ensure uploads directory
    const uploadsDir = path.join(process.cwd(), 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });
    // Save file to disk with a unique name
    const uniqueName = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
    const filePath = path.join(uploadsDir, uniqueName);
    await fs.writeFile(filePath, buf);

    // Create document record
    const doc = await app.prisma.document.create({ data: { userId, profileId, filename, mimeType, storagePath: filePath } });

    // Procesamiento inline (sin colas)

    // Ask AI to extract structured fields and classify (procesamiento inline)
    const ai = createOpenAI(app);
    const extraction = await ai.extractExpenseFields(app, {
      filename,
      mimeType: analysisMime,
      size: analysisBuffer.length,
    }, analysisBuffer);

    app.log.info({ msg: 'upload: extraction summary', summary: extraction?.summary, totals: extraction?.totals, provider: extraction?.provider });

    // Enforce plan limits considering Premium expiration
    // user ya cargado arriba
    const type = (() => {
      const t = String((extraction as any)?.type || '').trim().toUpperCase();
      const allowed = ['FACTURA','BOLETA','INFORMAL','YAPE','PLIN','TUNKI','LEMONPAY','BCP','INTERBANK','SCOTIABANK','BBVA'];
      return (allowed.includes(t) ? t : 'INFORMAL') as any;
    })();
    const issuedStr: string = String(extraction?.issuedAt || extraction?.fecha_emision || '').trim();
    const issued: Date = issuedStr ? new Date(issuedStr) : new Date();
    if (!isEntitled(user)) {
      const nowM = new Date();
      const start = new Date(nowM.getFullYear(), nowM.getMonth(), 1);
      const end = new Date(nowM.getFullYear(), nowM.getMonth() + 1, 0, 23, 59, 59, 999);
      const count = await app.prisma.expense.count({ where: { userId, profileId, type, createdAt: { gte: start, lte: end } } });
      if (count >= 10) return res.tooManyRequests('Límite del plan Free alcanzado para ' + type.toLowerCase());
    }

    // Resolver categoría del usuario (global o privada)
    let resolvedCategoryId: string | null = null;
    try {
      const catNameRaw = (extraction?.categoryName ?? extraction?.categoria_gasto ?? '').toString().trim();
      const catName = sanitizeText(catNameRaw);
      if (catName) {
        const key = catName.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const pool = await app.prisma.category.findMany({ where: { OR: [ { userId: null }, { userId, profileId } ] } });
        const hit = pool.find(c => c.name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === key);
        if (hit) resolvedCategoryId = hit.id;
        else {
          const map: Record<string, string> = { alimentacion: 'Alimentación', transporte: 'Transporte', servicios: 'Servicios', entretenimiento: 'Entretenimiento', educacion: 'Educación', salud: 'Salud', vivienda: 'Vivienda', tecnologia: 'Tecnología', impuestos: 'Impuestos', otros: 'Otros' };
          const nameFinal = map[key] || catName;
          const created = await app.prisma.category.create({ data: { name: nameFinal, userId, profileId } });
          resolvedCategoryId = created.id;
        }
      }
    } catch {}

    // Create expense from extraction
    let pmIdDoc: string | null = null;
    try {
      const pms = await app.prisma.paymentMethod.findMany({ where: { userId, profileId, active: true } });
      const mRaw = (extraction as any)?.payment?.method ?? '';
      const m = String(mRaw).trim().toLowerCase();
      const last4 = String((extraction as any)?.payment?.cardLast4 ?? '').replace(/\D+/g, '').slice(-4);
      let hit = pms.find(x => x.provider.toLowerCase() === m);
      if (!hit && last4) hit = pms.find(x => x.cardLast4 && String(x.cardLast4).slice(-4) === last4 && (m ? x.provider.toLowerCase() === m : true));
      if (!hit && m) hit = pms.find(x => x.provider.toLowerCase() === m || x.name.toLowerCase() === m);
      if (!hit) {
        const isWallet = ['yape','plin','tunki','lemonpay'].includes(m);
        const isBank = ['bcp','interbank','scotiabank','bbva'].includes(m);
        const typeStr = isWallet ? 'WALLET' : (isBank ? 'CUENTA' : (last4 ? 'TARJETA' : undefined));
        const providerCanonical = m ? m.toUpperCase() : (typeStr === 'TARJETA' ? 'TARJETA' : '');
        const name = last4 && typeStr === 'TARJETA' ? `Tarjeta ****${last4}` : (providerCanonical || (last4 ? `Tarjeta ****${last4}` : ''));
        if (typeStr && name) {
          try {
            const created = await app.prisma.paymentMethod.create({ data: { userId, profileId, name, provider: providerCanonical || name, type: typeStr, cardLast4: last4 || undefined, currency: extraction?.totals?.currency ?? (user?.preferredCurrency || 'PEN') } });
            hit = created as any;
          } catch {}
        }
      }
      pmIdDoc = hit?.id ?? (await app.prisma.user.findUnique({ where: { id: userId }, select: { defaultPaymentMethodId: true } }))?.defaultPaymentMethodId ?? null;
      if (!pmIdDoc) {
        try {
          const count = await app.prisma.paymentMethod.count({ where: { userId, profileId, active: true } });
          if (count === 0) {
            const created = await app.prisma.paymentMethod.create({ data: { userId, profileId, name: 'Efectivo', provider: 'EFECTIVO', type: 'EFECTIVO', currency: extraction?.totals?.currency ?? (user?.preferredCurrency || 'PEN') } });
            try { await app.prisma.user.update({ where: { id: userId }, data: { defaultPaymentMethodId: created.id } }); } catch {}
            pmIdDoc = created.id;
          }
        } catch {}
      }
    } catch {}
    const docType: 'FACTURA' | 'BOLETA' | 'INFORMAL' = (type === 'FACTURA' || type === 'BOLETA') ? type : 'INFORMAL';
    
    // Currency conversion
    const expAmount = typeof extraction?.totals?.total === 'number' ? extraction.totals.total : 0;
    const expCurrency = extraction?.totals?.currency ?? (user?.preferredCurrency || 'PEN');
    const targetCurrency = user?.preferredCurrency || 'PEN';
    const { amount: amountNative, rate: exchangeRate } = await currencyService.convert(expAmount, expCurrency, targetCurrency);

    const exp = await app.prisma.expense.create({
      data: {
        userId,
        profileId,
        type,
        source: 'DOCUMENT',
        issuedAt: issued,
        provider: sanitizeText(extraction.provider) ?? 'Proveedor desconocido',
        description: sanitizeText(extraction.description) ?? undefined,
        amount: expAmount,
        currency: expCurrency,
        amountNative,
        exchangeRate,
        categoryId: resolvedCategoryId,
        documentId: doc.id,
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
    try { await ensureBudgetForUserMonth(app, userId, profileId, issued.getFullYear(), issued.getMonth() + 1); } catch {}

    // Save analysis with structured details
    const details = { ...extraction, fecha_registro: new Date(exp.createdAt).toISOString().slice(0,10), registro_datetime: new Date(exp.createdAt).toISOString(), fecha_emision: (extraction?.issuedAt || extraction?.fecha_emision || issued.toISOString().slice(0,10)) };
    await app.prisma.analysis.create({ data: { documentId: doc.id, summary: (sanitizeText(extraction.summary) ?? 'Documento procesado'), total: exp.amount, details } });

    // Notify via Telegram if linked
    try {
      const tg: any = (app as any).telegram;
      if (tg && user.telegramId) {
        const currency = exp.currency || 'PEN';
        const amt = exp.amount.toFixed(2);
        const issuedText = formatDMY(new Date(exp.issuedAt));
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
        const pmLabel = (() => { if (!exp.paymentMethodId) return undefined; const pm = exp.paymentMethodId ? extraction?.payment?.method || null : null; return undefined; })();
        const text = formatExpenseMessage({
          title: '🧾 *Nuevo gasto registrado*',
          provider: exp.provider,
          amount: amt,
          currency,
          issuedText: issuedText,
          createdText: createdTxt,
          type: docType,
          docNumber,
          emitterId,
          category: catObj?.name || categoryName || undefined,
          subtotal,
          taxIgv: typeof igvAmt === 'number' ? Number(igvAmt) : undefined,
          description: expDesc,
          source: exp.source,
          id: exp.id,
          paymentMethod: (pmIdDoc ? (await app.prisma.paymentMethod.findUnique({ where: { id: pmIdDoc } }))?.provider + ' — ' + (await app.prisma.paymentMethod.findUnique({ where: { id: pmIdDoc } }))?.name : undefined),
        });
        await tg.sendMessage(user.telegramId, text);
      }
    } catch (e) {
      app.log.error({ msg: 'telegram notify failed (upload)', e });
    }
    // Notify via WhatsApp if linked
    try {
      const wa: any = (app as any).whatsapp;
      if (wa && user.whatsappPhone) {
        const to = user.whatsappPhone.startsWith('+') ? user.whatsappPhone : `+${user.whatsappPhone}`;
        const currency = exp.currency || 'PEN';
        const amt = exp.amount.toFixed(2);
        const issuedText2 = formatDMY(new Date(exp.issuedAt));
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
        const pmOut = pmIdDoc ? await app.prisma.paymentMethod.findUnique({ where: { id: pmIdDoc } }) : null;
        const text = formatExpenseMessage({
          title: '🧾 *Nuevo gasto registrado*',
          provider: exp.provider,
          amount: amt,
          currency,
          issuedText: issuedText2,
          createdText: createdTxt,
          type: docType,
          docNumber,
          emitterId,
          category: catObj?.name || categoryName || undefined,
          subtotal,
          taxIgv: typeof igvAmt === 'number' ? Number(igvAmt) : undefined,
          description: expDesc,
          source: exp.source,
          id: exp.id,
          paymentMethod: pmOut ? `${pmOut.provider} — ${pmOut.name}` : undefined,
        });
        await wa.sendText(to, text);
      }
    } catch (e) {
      app.log.error({ msg: 'whatsapp notify failed (upload)', e });
    }
    // Verificar umbral de presupuesto y notificar si corresponde
    try {
      const alertAmount = exp.amountNative ?? exp.amount;
      await checkBudgetAlertAfterExpense(app, userId, profileId, new Date(exp.issuedAt), alertAmount, exp.categoryId ?? undefined);
    } catch (e) {
      app.log.error({ msg: 'budget alert check failed (upload)', e });
    }

    return res.send({ ok: true, summary: extraction.summary, expenseId: exp.id, json: extraction, xml: extraction.xml });
  });
};
