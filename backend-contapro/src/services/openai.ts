import OpenAI from 'openai';
import { toFile } from 'openai/uploads';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { runPythonOCR } from './pythonOCR.js';
import { runPythonLLM } from './pythonLLM.js';

export function createOpenAI(app: FastifyInstance) {
  const apiKey = config.openaiApiKey;
  const client = new OpenAI({ apiKey });
  // Default to gpt-4o for maximum precision as requested by user
  const MODEL = config.openaiModel;

  async function cachedCompletion(key: string, prompt: string) {
    const ttl = config.cacheTtlSeconds;
    const existing = await app.prisma.aiCache.findUnique({ where: { key } });
    if (existing) return existing.value as any;

    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
    });
    const result = completion.choices[0]?.message?.content ?? '';
    await app.prisma.aiCache.create({ data: { key, value: { result }, ttl } });
    return { result };
  }

  return {
    async summarizeText(app: FastifyInstance, text: string) {
      const key = crypto.createHash('sha256').update('sum:' + text).digest('hex');
      return cachedCompletion(key, `Resume el siguiente texto en 1-2 líneas:\n${text}`);
    },
    async extractExpenseFromText(app: FastifyInstance, text: string, defaults?: { preferredCurrency?: string; preferredDateFormat?: 'DMY' | 'MDY' | 'YMD' }) {
      const key = crypto.createHash('sha256').update('nl_expense:' + text).digest('hex');
      const cached = await app.prisma.aiCache.findUnique({ where: { key } });
      if (cached) return (cached.value as any);

      const prefFmt = (defaults?.preferredDateFormat || 'DMY').toUpperCase();
      function fmtSpec(fmt: string): string { return fmt === 'DMY' ? 'DD-MM-YYYY' : (fmt === 'MDY' ? 'MM-DD-YYYY' : 'YYYY-MM-DD'); }
      function formatDate(d: Date, fmt: string): string {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        if (fmt === 'DMY') return `${dd}-${m}-${y}`;
        if (fmt === 'MDY') return `${m}-${dd}-${y}`;
        return `${y}-${m}-${dd}`;
      }
      const todayFmt = formatDate(new Date(), prefFmt);
      const prompt = [
        'Eres una IA que extrae datos de un mensaje en español donde una persona describe un gasto realizado.',
        'Devuelve solo un JSON con los siguientes campos:',
        '{',
        '  "amount": number,',
        '  "currency": "PEN" | "USD" | string,',
        `  "issuedAt": "${fmtSpec(prefFmt)}" | null,`,
        '  "provider": string | null,',
        '  "description": string | null,',
        '  "categoryName": string | null,',
        '  "type": "FACTURA" | "BOLETA" | "YAPE" | "PLIN" | "TUNKI" | "LEMONPAY" | "BCP" | "INTERBANK" | "SCOTIABANK" | "BBVA",',
        '  "ruc_proveedor": string | null',
        '}',
        'Reglas:',
        `- Fecha actual: ${todayFmt}.`,
        `- Si el texto usa fechas relativas como "hoy", "ayer", "anteayer", "antes de ayer", o expresiones del tipo "hace X dias" / "hace X días", calcula la fecha real en formato ${fmtSpec(prefFmt)} tomando como referencia la fecha actual.`,
        '- Si no se menciona fecha (ni relativa ni exacta), usa null.',
        '- Interpreta "soles", "S/" como PEN y "dólares", "$" como USD.',
        '- Si no se menciona tipo, usa "INFORMAL".',
        '- Extrae RUC si aparece (palabra "ruc" seguida de dígitos).',
        '- Provider es el establecimiento o empresa mencionada.',
        '- CategoryName es una categoría humana: alimentación, transporte, servicios, entretenimiento, educación, salud, vivienda, tecnología, impuestos, otros.',
        '- Si no puedes inferir una categoría, deja null.',
        'Ejemplos:',
        'Entrada: "Hice un gasto de 50 soles en la barbería"',
        '{"amount":50,"currency":"PEN","issuedAt":null,"provider":"Barbería","description":"Servicio de barbería","categoryName":"Salud","type":"INFORMAL","ruc_proveedor":null}',
        'Entrada: "Hoy pagué S/ 120 en Primax por gasolina, RUC 20123456789"',
        `{"amount":120,"currency":"PEN","issuedAt":"${todayFmt}","provider":"Primax","description":"Gasolina","categoryName":"Transporte","type":"INFORMAL","ruc_proveedor":"20123456789"}`,
        'Entrada: "compra de 50 soles en Ripley el dia de ayer"',
        `{"amount":50,"currency":"PEN","issuedAt":"${formatDate(new Date(Date.now()-24*60*60*1000), prefFmt)}","provider":"Ripley","description":"Compra","categoryName":"Otros","type":"INFORMAL","ruc_proveedor":null}`,
        'Entrada: "pagué $25 en Starbucks hace 2 días"',
        `{"amount":25,"currency":"USD","issuedAt":"${formatDate(new Date(Date.now()-2*24*60*60*1000), prefFmt)}","provider":"Starbucks","description":"Consumo","categoryName":"Entretenimiento","type":"INFORMAL","ruc_proveedor":null}`,
      ].join('\n');

      let parsed: any = null;
      try {
        const completion = await client.chat.completions.create({
          model: MODEL,
          messages: [{ role: 'user', content: prompt + '\n\nTexto:\n' + text }],
          temperature: 0.1,
          response_format: { type: 'json_object' },
        });
        const raw = completion.choices[0]?.message?.content ?? '{}';
        try { parsed = JSON.parse(raw); } catch {
          const m = raw.match(/\{[\s\S]*\}/);
          if (m) { try { parsed = JSON.parse(m[0]); } catch {} }
        }
      } catch {
        parsed = null;
      }
      if (!parsed || typeof parsed !== 'object') parsed = {};

      function parseAmount(input: any): number {
        if (typeof input === 'number') return input;
        const s = String(input ?? '').trim();
        if (!s) return 0;
        const cleaned = s.replace(/SOLES|USD|US\s?\$|S\/|[A-Z$]/gi, '').trim();
        const lastDot = cleaned.lastIndexOf('.');
        const lastComma = cleaned.lastIndexOf(',');
        let normalized = cleaned;
        if (lastComma > lastDot) normalized = cleaned.replace(/\./g, '').replace(',', '.');
        else normalized = cleaned.replace(/,/g, '');
        const n = Number(normalized.replace(/[^0-9.]/g, ''));
        return isFinite(n) ? n : 0;
      }
      function normalizeCurrency(s?: string | null): 'PEN' | 'USD' | string {
        const v = String(s ?? '').toUpperCase();
        if (v.includes('USD') || v.includes('US$') || v.includes('$') || v.includes('DOLAR') || v.includes('DÓLAR')) return 'USD';
        if (v.includes('PEN') || v.includes('S/') || v.includes('SOLES')) return 'PEN';
        return v || (defaults?.preferredCurrency || 'PEN');
      }
      function normalizeDate(s?: string | null): string | null {
        const t = String(s ?? '').trim();
        if (!t) return null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(t)) { const [y,m,d] = t.split('-').map(Number); return formatDate(new Date(y, m-1, d), prefFmt); }
        if (/^\d{2}-\d{2}-\d{4}$/.test(t)) {
          const a = t.split('-').map(Number);
          if (prefFmt === 'MDY') { const [m,d,y] = a; return formatDate(new Date(y, m-1, d), prefFmt); }
          const [d,m,y] = a; return formatDate(new Date(y, m-1, d), prefFmt);
        }
        return null;
      }
      function onlyDigits(s?: string | null) { return String(s ?? '').replace(/\D+/g, ''); }
      function normText(s?: string | null) { return String(s ?? '').trim(); }
      function normalizeCategoryName(input?: string | null): string | null {
        const s = String(input ?? '').trim();
        if (!s) return null;
        const v = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const map: Record<string, string> = {
          alimentacion: 'Alimentación', transporte: 'Transporte', servicios: 'Servicios', entretenimiento: 'Entretenimiento', educacion: 'Educación', salud: 'Salud', vivienda: 'Vivienda', tecnologia: 'Tecnología', impuestos: 'Impuestos', otros: 'Otros'
        };
        return map[v] || s;
      }
      function parseSpelledAmount(input: string): number {
        const base = (input || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const units: Record<string, number> = { cero:0, uno:1, una:1, dos:2, tres:3, cuatro:4, cinco:5, seis:6, siete:7, ocho:8, nueve:9 };
        const tens: Record<string, number> = { diez:10, veinte:20, treinta:30, cuarenta:40, cincuenta:50, sesenta:60, setenta:70, ochenta:80, noventa:90 };
        const teens: Record<string, number> = { once:11, doce:12, trece:13, catorce:14, quince:15 };
        const direct = Object.entries({ ...units, ...tens, ...teens }).find(([w]) => new RegExp(`\\b${w}\\b`).test(base));
        if (direct) return (units[direct[0]] ?? tens[direct[0]] ?? teens[direct[0]] ?? 0);
        const mDieci = base.match(/\bdieci(uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve)\b/);
        if (mDieci) return 10 + (units[mDieci[1]] || 0);
        const mVeinti = base.match(/\bveinti(uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve)\b/);
        if (mVeinti) return 20 + (units[mVeinti[1]] || 0);
        const mTensUnits = base.match(/\b(treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa)\s+y\s+(uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve)\b/);
        if (mTensUnits) return (tens[mTensUnits[1]] || 0) + (units[mTensUnits[2]] || 0);
        const mCiento = base.match(/\bciento\s+(veinte|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa)(?:\s+y\s+(uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve))?\b/);
        if (mCiento) return 100 + (tens[mCiento[1]] || 0) + (units[mCiento[2] || ''] || 0);
        const mCien = base.match(/\bcien\b/);
        if (mCien) return 100;
        return 0;
      }
      function relativeDateFromText(input: string): string | null {
        const s0 = String(input || '').toLowerCase();
        const s = ' ' + s0.replace(/\s+/g, ' ') + ' ';
        const mDays = s.match(/hace\s+(\d{1,2})\s*d[ií]as/);
        let offset: number | null = null;
        if (mDays) {
          const n = Number(mDays[1]);
          if (isFinite(n) && n >= 0 && n <= 31) offset = -n;
        }
        if (offset == null) {
          if (/\banteayer\b/.test(s) || /\bantes\s+de\s+ayer\b/.test(s)) offset = -2;
          else if (/\bayer\b/.test(s)) offset = -1;
          else if (/\bhoy\b/.test(s)) offset = 0;
        }
        if (offset == null) return null;
        const base = new Date();
        const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset, 12, 0, 0, 0);
        return formatDate(d, prefFmt);
      }
      function explicitDateFromText(input: string): string | null {
        const s0 = String(input || '').toLowerCase();
        const s = ' ' + s0.replace(/\s+/g, ' ') + ' ';
        const months: Record<string, number> = {
          'enero':1,'ene':1,'febrero':2,'feb':2,'marzo':3,'mar':3,'abril':4,'abr':4,'mayo':5,'may':5,'junio':6,'jun':6,'julio':7,'jul':7,'agosto':8,'ago':8,'septiembre':9,'setiembre':9,'sep':9,'set':9,'octubre':10,'oct':10,'noviembre':11,'nov':11,'diciembre':12,'dic':12
        };
        const m1 = s.match(/\b(\d{1,2})\s*(?:de\s+)?(enero|ene|febrero|feb|marzo|mar|abril|abr|mayo|may|junio|jun|julio|jul|agosto|ago|septiembre|setiembre|sep|set|octubre|oct|noviembre|nov|diciembre|dic)(?:\s*de\s*(\d{4}))?\b/);
        if (m1) {
          const d = Number(m1[1]);
          const m = months[m1[2]];
          const y = m1[3] ? Number(m1[3]) : new Date().getFullYear();
          if (isFinite(d) && d >= 1 && d <= 31 && isFinite(m) && isFinite(y)) return formatDate(new Date(y, m-1, d, 12, 0, 0, 0), prefFmt);
        }
        const m2 = s.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/);
        if (m2) {
          const a = m2.slice(1).map(x => x ? Number(x) : undefined);
          const d = a[0] as number; const m = a[1] as number; let y = a[2];
          if (!y || String(y).length === 2) { const baseY = new Date().getFullYear(); y = !y ? baseY : (y! + (y! >= 70 ? 1900 : 2000)); }
          if (isFinite(d) && isFinite(m) && isFinite(y as number)) return formatDate(new Date(y as number, m-1, d, 12, 0, 0, 0), prefFmt);
        }
        return null;
      }

      let amount = parseAmount(parsed.amount);
      let currency = normalizeCurrency(parsed.currency);
      let issuedAt = normalizeDate(parsed.issuedAt);
      {
        const expd = explicitDateFromText(text);
        if (expd) issuedAt = expd;
        else {
          const rel = relativeDateFromText(text);
          if (rel) issuedAt = rel;
        }
      }
      let provider = normText(parsed.provider) || null;
      let description = normText(parsed.description) || null;
      let categoryName = normalizeCategoryName(parsed.categoryName);
      let type = (() => {
        const t = String(parsed.type || '').trim().toUpperCase();
        if (t === 'FACTURA') return 'FACTURA';
        if (t === 'BOLETA') return 'BOLETA';
        if (t === 'YAPE') return 'YAPE';
        if (t === 'PLIN') return 'PLIN';
        if (t === 'TUNKI') return 'TUNKI';
        if (t === 'LEMONPAY') return 'LEMONPAY';
        if (t === 'BCP') return 'BCP';
        if (t === 'INTERBANK') return 'INTERBANK';
        if (t === 'SCOTIABANK') return 'SCOTIABANK';
        if (t === 'BBVA') return 'BBVA';
        return 'INFORMAL';
      })();
      let ruc = onlyDigits(parsed.ruc_proveedor);
      if (!ruc) {
        const m = text.match(/ruc\s*[:\-]?\s*([0-9]{8,20})/i);
        ruc = m ? onlyDigits(m[1]) : '';
      }

      if (!categoryName) {
        const p = String(provider || '').toLowerCase();
        if (/metro|tottus|plaza|wong|bodega|market|supermercado|comida|restaurante/.test(p)) categoryName = 'Alimentación';
        else if (/uber|cabify|bus|taxi|peaje|transporte|combustible|gasolina|grifo|primax|petroperu|repsol/.test(p)) categoryName = 'Transporte';
        else if (/claro|movistar|entel|internet|luz|agua|gas|telefono|celular|servicio/.test(p)) categoryName = 'Servicios';
        else if (/farmacia|botica|clinica|hospital|salud|medic|barberia|barbería|peluquer/.test(p)) categoryName = 'Salud';
        else if (/colegio|universidad|curso|educacion|libro/.test(p)) categoryName = 'Educación';
        else if (/cine|netflix|spotify|entretenimiento|ocio|evento/.test(p)) categoryName = 'Entretenimiento';
        else if (/hogar|casa|mueble|electrodomestico|ferreteria|vivienda/.test(p)) categoryName = 'Vivienda';
        else if (/laptop|computador|celular|smartphone|tecnologia|electronica/.test(p)) categoryName = 'Tecnología';
        else if (/impuesto|tributo|sunat|municipalidad|predial/.test(p)) categoryName = 'Impuestos';
        else categoryName = 'Otros';
      }

      if (!issuedAt) {
        const expd2 = explicitDateFromText(text);
        if (expd2) issuedAt = expd2;
        else {
          const rel2 = relativeDateFromText(text);
          if (rel2) issuedAt = rel2;
        }
      }

      // Fallback sin OpenAI: si amount==0 o provider vacío, intentar extraer con reglas locales
      if (amount <= 0 || !provider) {
        try {
          const t = ' ' + text + ' ';
          const cur = /\b(usd|dolares|dólares|\$)\b/i.test(t) ? 'USD' : (/\b(pen|soles|s\/)\b/i.test(t) ? 'PEN' : (defaults?.preferredCurrency || 'PEN'));
          currency = cur;
          const amtMatch = cur === 'USD'
            ? t.match(/\$\s*([0-9][0-9.,]*)/) || t.match(/\bUSD\s*([0-9][0-9.,]*)/i)
            : t.match(/S\/\s*([0-9][0-9.,]*)/) || t.match(/\b(?:PEN|soles)\s*([0-9][0-9.,]*)/i);
          const anyNumMatch = amtMatch || t.match(/([0-9][0-9.,]*)/);
          if (anyNumMatch) amount = parseAmount(anyNumMatch[1]);
          if (amount <= 0) {
            const fromWords = parseSpelledAmount(t);
            if (fromWords > 0) amount = fromWords;
          }
          const rucM = t.match(/ruc\s*[:\-]?\s*([0-9]{8,20})/i);
          if (rucM) ruc = onlyDigits(rucM[1]);
          const enM = t.match(/\ben\s+([^\.,;]+?)(?:\s+por\b|[\.,;]|$)/i);
          if (enM) provider = normText(enM[1]) || provider;
          const porM = t.match(/\bpor\s+([^\.,;]+?)(?:[\.,;]|$)/i);
          if (porM) description = normText(porM[1]) || description;
          if (!provider) {
            const primaxM = t.match(/\bprimax\b/i);
            if (primaxM) provider = 'Primax';
          }
          if (!categoryName) {
            const s = (String(description || '') + ' ' + String(provider || '')).toLowerCase();
            if (/gasolina|grifo|combustible|primax|petroperu|repsol/.test(s)) categoryName = 'Transporte';
            else if (/barber[íi]a|peluquer[íi]a|farmacia|botica/.test(s)) categoryName = 'Salud';
          }
        } catch {}
      }

      const value = {
        amount,
        currency,
        issuedAt,
        provider,
        description,
        categoryName,
        type,
        ruc_proveedor: ruc || null,
      };
      await app.prisma.aiCache.create({ data: { key, value, ttl: config.cacheTtlSeconds } });
      return value;
    },
    async extractExpenseFields(app: FastifyInstance, meta: { filename: string; mimeType: string; size: number }, fileBuffer?: Buffer, options?: { forcePythonOnly?: boolean }) {
      const bufHash = fileBuffer ? crypto.createHash('sha256').update(fileBuffer).digest('hex') : 'no-buffer';
      const key = crypto.createHash('sha256').update('expense:' + JSON.stringify(meta) + ':' + bufHash + ':forcePy=' + String(!!options?.forcePythonOnly)).digest('hex');
      const cached = await app.prisma.aiCache.findUnique({ where: { key } });
      if (cached) return (cached.value as any);

      const promptText = `Eres una IA experta en análisis de documentos financieros: facturas, boletas, vouchers de billeteras digitales (Yape, Plin, Tunki, Lemonpay) y vouchers/movimientos bancarios (BCP, Interbank, Scotiabank, BBVA).
Recibirás una imagen o texto y tu tarea es identificar y estructurar la información clave de manera precisa y estandarizada.

Debes analizar cuidadosamente el documento y devolver únicamente un JSON válido, con los siguientes campos:
{
  "tipo_documento": "factura | boleta | yape | plin | tunki | lemonpay | bcp | interbank | scotiabank | bbva",
  "proveedor": "nombre del comercio o empresa emisora",
  "ruc_proveedor": "RUC o número de identificación del proveedor (si existe)",
  "fecha_emision": "YYYY-MM-DD",
  "monto_total": "monto total del documento",
  "moneda": "PEN, USD, etc.",
  "categoria_gasto": "categoría del gasto detectada o nueva",
  "numero_documento": "número o serie del documento",
  "items": [
    {
      "descripcion": "nombre del producto o servicio",
      "cantidad": "cantidad comprada",
      "precio_unitario": "precio por unidad",
      "subtotal": "subtotal del ítem"
    }
  ],
  "observaciones": "comentarios o detalles adicionales relevantes"
}

Reglas de extracción:
- Si un dato no aparece en el documento, deja su valor vacío ("") sin inventarlo.
- Detecta si el documento corresponde a factura, boleta, voucher de billetera digital (yape, plin, tunki, lemonpay) o voucher/movimiento bancario (bcp, interbank, scotiabank, bbva). Usa ese valor exacto en "tipo_documento".
- Usa formato (DD-MM-YYYY) para las fechas (ej. "25-12-2023").
- Si no encuentras las palabras anteriores, igualmente busca fechas explícitas en los formatos "YYYY-MM-DD" y "DD-MM-YYYY" y usa la más coherente con el documento.
- La "fecha_emision" DEBE ser la fecha impresa en el documento (ej. "Fecha de emisión", "Emitido", "Fecha comprobante", "Fecha del documento"). NO uses la fecha actual del sistema.
- Para que encuentres las fechas tambien busca FECHA:(FECHA)
- Si hay varias fechas en el documento, prioriza la que esté más cerca de las palabras: "emisión", "emitido", "comprobante", "documento", "venta". En caso de duda, elige la más antigua.
- Redondea los montos a dos decimales.
- Si hay varios ítems, incluye todos en la lista "items".
- No incluyas texto, explicaciones o comentarios fuera del JSON.
- Los montos deben usar punto como separador decimal. Si el documento usa coma decimal (1.234,56), conviértelo a 1234.56.
- Identifica la moneda: 'PEN' (símbolo 'S/') o 'USD' (símbolo '$'). Si no está explícito, asume 'PEN'.

Categorías base:
- alimentación, transporte, servicios, entretenimiento, educación, salud, vivienda, tecnología, otros.
- Si el gasto pertenece a una categoría nueva, identifícala con un nombre claro y coherente (por ejemplo: "ropa", "mascotas", "viajes") y asigna ese valor en "categoria_gasto" , IGNORA LAS TILDES AL MOMENTO DE ASIGNAR EL VALOR.

Instrucción final:
Devuelve solo el JSON final sin texto adicional, encabezados ni explicaciones.`;

      const lowerMime = String(meta.mimeType || '').toLowerCase();
      const isPdf = lowerMime.includes('pdf') || /\.pdf$/i.test(meta.filename || '');

      let result: any = {
        tipo_documento: /factura/i.test(meta.filename) ? 'factura' : 'boleta',
        fecha_emision: new Date().toISOString().slice(0, 10),
        proveedor: 'Desconocido',
        monto_total: 0,
        moneda: 'PEN',
        numero_documento: '',
        items: null,
        observaciones: `Documento ${meta.filename} (${meta.mimeType}), tamaño ${meta.size} bytes`,
      };
      const usePythonLLM = !isPdf;
      let pyRes: any = null;

      if (isPdf && fileBuffer && !options?.forcePythonOnly) {
        try {
          const file = await client.files.create({
            file: await toFile(fileBuffer, meta.filename || 'documento.pdf', { type: meta.mimeType || 'application/pdf' }),
            purpose: 'user_data',
          });
          const response = await client.responses.create({
            model: MODEL,
            input: [
              {
                role: 'user',
                content: [
                  { type: 'input_text', text: promptText },
                  { type: 'input_file', file_id: file.id },
                ],
              },
            ],
          });
          const text = (response as any).output_text || '';
          let parsed: any = null;
          try { parsed = JSON.parse(text); } catch {
            const m = typeof text === 'string' ? text.match(/\{[\s\S]*\}/) : null;
            if (m) { try { parsed = JSON.parse(m[0]); } catch {} }
          }
          if (parsed && typeof parsed === 'object') {
            result = { ...result, ...parsed };
            pyRes = parsed;
          }
        } catch (e) {
          app.log.warn({ msg: 'pdf vision extraction failed', error: String(e) });
        }
      }

      if (usePythonLLM && fileBuffer) {
        try {
          pyRes = await runPythonLLM(app, fileBuffer, meta.mimeType);
          if (pyRes && typeof pyRes === 'object') {
            // Log de error si Python devolvió campo error
            if ((pyRes as any).error) {
              app.log.warn({ msg: 'python llm result contained error', error: (pyRes as any).error });
              // Añadir trazas mínimas en observaciones para facilitar diagnóstico en análisis guardado
              const obs = String(result.observaciones ?? '').trim();
              const hint = ` | py_llm_error: ${(pyRes as any).error}`;
              result.observaciones = obs ? (obs + hint) : `py_llm_error: ${(pyRes as any).error}`;
            }
            // Mezclar sobre la base por si faltan campos
            result = { ...result, ...pyRes };
          }
        } catch {}
      }
      // Fallback con cliente Node si Python LLM no devolvió nada (solo si MIME es imagen)
      if (!pyRes && !options?.forcePythonOnly && fileBuffer && String(meta.mimeType || '').startsWith('image/')) try {
        // Build multimodal message when file buffer is provided
        const b64 = fileBuffer.toString('base64');
        const dataUrl = `data:${meta.mimeType};base64,${b64}`;
        const messages: ChatCompletionMessageParam[] = [
          { role: 'user', content: [
            { type: 'text', text: promptText },
            { type: 'image_url', image_url: { url: dataUrl } },
          ] },
        ];
        const completion = await client.chat.completions.create({
          model: MODEL,
          messages,
          temperature: 0.2,
          response_format: { type: 'json_object' },
        });
        const text = completion.choices[0]?.message?.content ?? '';
        let parsed: any = null;
        try { parsed = JSON.parse(text); } catch {
          const m = text.match(/\{[\s\S]*\}/);
          if (m) { try { parsed = JSON.parse(m[0]); } catch {} }
        }
        if (parsed && typeof parsed === 'object') result = parsed;
      } catch (e) {
        // Fallback heurístico si no hay API o error
      }

      // Ya se intentó Python LLM primero; si no trajo datos, se usó Node.

      // Si faltan datos críticos, intentar OCR Python como fallback y fusionar
      const isEmpty = (v: any) => v == null || String(v).trim() === '';
      const isUnknown = (v: any) => {
        const s = String(v ?? '').trim().toLowerCase();
        return s === '' || s === 'desconocido' || s === 'unknown' || s === 'n/a' || s === 'no disponible' || s === '—';
      };
      const amountZeroOrMissing = () => {
        const v: any = (result as any)?.monto_total;
        if (typeof v === 'number') return v <= 0; // considerar 0 como faltante
        return isEmpty(v) || parseAmount(v) === 0;
      };
      const needFallback = fileBuffer && !isPdf ? (
        isEmpty(result?.proveedor) || isUnknown(result?.proveedor) ||
        isEmpty(result?.fecha_emision) ||
        amountZeroOrMissing() ||
        isEmpty(result?.numero_documento) || isUnknown(result?.numero_documento)
      ) : false;
      if (needFallback && fileBuffer) {
        const py = await runPythonOCR(app, fileBuffer, meta.mimeType);
        if (py) {
          if ((py as any).error) {
            app.log.warn({ msg: 'python ocr result contained error', error: (py as any).error });
            const obs2 = String(result.observaciones ?? '').trim();
            const hint2 = ` | py_ocr_error: ${(py as any).error}`;
            result.observaciones = obs2 ? (obs2 + hint2) : `py_ocr_error: ${(py as any).error}`;
          }
          // Merge conservador: sólo rellenar campos vacíos
          if ((isEmpty(result.proveedor) || isUnknown(result.proveedor)) && py.proveedor) result.proveedor = py.proveedor;
          if ((isEmpty(result.ruc_proveedor) || isUnknown(result.ruc_proveedor)) && py.ruc_proveedor) result.ruc_proveedor = py.ruc_proveedor;
          if ((isEmpty(result.fecha_emision) || isUnknown(result.fecha_emision)) && py.fecha_emision) result.fecha_emision = py.fecha_emision;
          if ((isEmpty(result.monto_total) || parseAmount(result.monto_total) === 0) && py.monto_total) result.monto_total = py.monto_total;
          if ((isEmpty(result.moneda) || isUnknown(result.moneda)) && py.moneda) result.moneda = py.moneda;
          if ((isEmpty(result.numero_documento) || isUnknown(result.numero_documento)) && py.numero_documento) result.numero_documento = py.numero_documento;
          if ((isEmpty(result.categoria_gasto) || isUnknown(result.categoria_gasto)) && py.categoria_gasto) result.categoria_gasto = py.categoria_gasto;
          // Observaciones: anexar trazas OCR si no hay summary
          if (isEmpty(result.observaciones) && py.text) result.observaciones = `OCR: ${py.text.slice(0, 400)}`;

          // Si ambos tienen monto_total pero difieren mucho, preferir OCR
          try {
            const llmAmt = parseAmount(result.monto_total);
            const ocrAmt = parseAmount(py.monto_total);
            if (ocrAmt > 0 && llmAmt > 0) {
              const rel = Math.abs(ocrAmt - llmAmt) / Math.max(1, llmAmt);
              if (rel > 0.4) { // diferencia > 40%
                result.monto_total = ocrAmt;
                if (py.moneda) result.moneda = py.moneda;
              }
            }
          } catch {}
        }
      }

      // Si tras OCR seguimos con datos pobres, usar cliente Node Vision como último fallback (solo si MIME es imagen)
      const stillPoor = fileBuffer ? (
        isEmpty(result?.proveedor) || isUnknown(result?.proveedor) ||
        amountZeroOrMissing() ||
        isEmpty(result?.fecha_emision)
      ) : false;
      if (stillPoor && fileBuffer && !options?.forcePythonOnly && String(meta.mimeType || '').startsWith('image/')) {
        try {
          const b64 = fileBuffer.toString('base64');
          const dataUrl = `data:${meta.mimeType};base64,${b64}`;
          const messages2: ChatCompletionMessageParam[] = [
            { role: 'user', content: [
              { type: 'text', text: promptText },
              { type: 'image_url', image_url: { url: dataUrl } },
            ] },
          ];
          const completion = await client.chat.completions.create({
            model: MODEL,
            messages: messages2,
            temperature: 0.0,
            response_format: { type: 'json_object' },
          });
          const text = completion.choices[0]?.message?.content ?? '';
          let parsed: any = null;
          try { parsed = JSON.parse(text); } catch {
            const m = text.match(/\{[\s\S]*\}/);
            if (m) { try { parsed = JSON.parse(m[0]); } catch {} }
          }
          if (parsed && typeof parsed === 'object') {
            const obsN = String(result.observaciones ?? '').trim();
            const hintN = ' | node_llm_fallback:true';
            result.observaciones = obsN ? (obsN + hintN) : 'node_llm_fallback:true';
            // Fusionar sólo para campos vacíos o inválidos
            if ((isEmpty(result.proveedor) || isUnknown(result.proveedor)) && parsed.proveedor) result.proveedor = parsed.proveedor;
            if ((isEmpty(result.ruc_proveedor) || isUnknown(result.ruc_proveedor)) && parsed.ruc_proveedor) result.ruc_proveedor = parsed.ruc_proveedor;
            if ((isEmpty(result.fecha_emision) || isUnknown(result.fecha_emision)) && parsed.fecha_emision) result.fecha_emision = parsed.fecha_emision;
            if ((isEmpty(result.monto_total) || parseAmount(result.monto_total) === 0) && parsed.monto_total) result.monto_total = parsed.monto_total;
            if ((isEmpty(result.moneda) || isUnknown(result.moneda)) && parsed.moneda) result.moneda = parsed.moneda;
            if ((isEmpty(result.numero_documento) || isUnknown(result.numero_documento)) && parsed.numero_documento) result.numero_documento = parsed.numero_documento;
            if ((isEmpty(result.categoria_gasto) || isUnknown(result.categoria_gasto)) && parsed.categoria_gasto) result.categoria_gasto = parsed.categoria_gasto;
            if (isEmpty(result.items) && parsed.items) result.items = parsed.items;
          }
        } catch (e) {
          app.log.warn({ msg: 'node vision fallback failed', e });
        }
      }

      // Utilidades de normalización/validación
      function onlyDigits(s?: string | null) { return String(s ?? '').replace(/\D+/g, ''); }
      function validDate(s?: string | null) { return !!String(s ?? '').match(/^\d{4}-\d{2}-\d{2}$/); }
      function approx(a?: number | null, b?: number | null, tol = 0.02) { if (typeof a !== 'number' || typeof b !== 'number') return false; const rel = Math.abs(a - b) / Math.max(1, b); return rel <= tol; }
      function parseAmount(input: any): number {
        if (typeof input === 'number') return input;
        const s = String(input ?? '').trim();
        if (!s) return 0;
        const cleaned = s.replace(/SOLES|USD|US\s?\$|S\/|[A-Z$]/gi, '').trim();
        const lastDot = cleaned.lastIndexOf('.');
        const lastComma = cleaned.lastIndexOf(',');
        let normalized = cleaned;
        if (lastComma > lastDot) { // comma as decimal
          normalized = cleaned.replace(/\./g, '').replace(',', '.');
        } else { // dot as decimal, remove commas
          normalized = cleaned.replace(/,/g, '');
        }
        const n = Number(normalized.replace(/[^0-9.]/g, ''));
        return isFinite(n) ? n : 0;
      }
      function normalizeDate(s?: string | null): string | null {
        const str = String(s ?? '').trim();
        if (!str) return null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
        const m = str.match(/^([0-3]?\d)[\/-]([0-1]?\d)[\/-](\d{4})$/); // DD/MM/YYYY
        if (m) {
          const dd = m[1].padStart(2,'0');
          const mm = m[2].padStart(2,'0');
          const yyyy = m[3];
          return `${yyyy}-${mm}-${dd}`;
        }
        const m2 = str.match(/^(\d{4})[\/-]([0-1]?\d)[\/-]([0-3]?\d)$/); // YYYY/MM/DD
        if (m2) {
          const yyyy = m2[1];
          const mm = m2[2].padStart(2,'0');
          const dd = m2[3].padStart(2,'0');
          return `${yyyy}-${mm}-${dd}`;
        }
        return null;
      }
      function normalizeCurrency(s?: string | null): 'PEN' | 'USD' {
        const v = String(s ?? '').toUpperCase();
        if (v.includes('USD') || v.includes('US$') || v.includes('$')) return 'USD';
        if (v.includes('PEN') || v.includes('S/') || v.includes('SOLES')) return 'PEN';
        return v === 'USD' ? 'USD' : 'PEN';
      }

      // Clasificación por proveedor/cadena y normalización de categoría
      function normalizeCategoryName(cat?: string | null) {
        const c = String(cat ?? '').trim().toLowerCase();
        if (!c) return undefined;
        if (/alimentaci[óo]n/.test(c)) return 'Alimentación';
        if (/transporte/.test(c)) return 'Transporte';
        if (/servicios?/.test(c)) return 'Servicios';
        if (/entretenimiento|ocio/.test(c)) return 'Entretenimiento';
        if (/educaci[óo]n|colegio|universidad/.test(c)) return 'Educación';
        if (/salud|farmacia|botica/.test(c)) return 'Salud';
        if (/vivienda|hogar|casa|mueble|electrodom[ée]stico|ferreter[ií]a/.test(c)) return 'Vivienda';
        if (/tecnolog[ií]a|electr[óo]nica|computadora|celular|smartphone|laptop/.test(c)) return 'Tecnología';
        if (/impuestos?/.test(c)) return 'Impuestos';
        return c ? c.charAt(0).toUpperCase() + c.slice(1) : undefined;
      }
      const providerRaw = (result.provider ?? result.proveedor ?? 'Desconocido');
      const provider = providerRaw.toLowerCase();
      let categoryName = normalizeCategoryName(result.categoryName ?? result.categoria_gasto);
      if (!categoryName) {
        if (/metro|tottus|plaza|wong|bodega|market|supermercado|comida|restaurante/.test(provider)) categoryName = 'Alimentación';
        else if (/uber|cabify|bus|taxi|peaje|transporte|combustible|gasolina|grifo/.test(provider)) categoryName = 'Transporte';
        else if (/claro|movistar|entel|internet|luz|agua|gas|telefono|celular|servicio/.test(provider)) categoryName = 'Servicios';
        else if (/farmacia|botica|clinica|hospital|salud|medic/.test(provider)) categoryName = 'Salud';
        else if (/colegio|universidad|curso|educacion|libro/.test(provider)) categoryName = 'Educación';
        else if (/cine|netflix|spotify|entretenimiento|ocio|evento/.test(provider)) categoryName = 'Entretenimiento';
        else if (/hogar|casa|mueble|electrodomestico|ferreteria|vivienda/.test(provider)) categoryName = 'Vivienda';
        else if (/laptop|computador|celular|smartphone|tecnolog[ií]a|electr[óo]nica/.test(provider)) categoryName = 'Tecnología';
        else if (/impuesto|tributo|sunat|municipalidad|predial/.test(provider)) categoryName = 'Impuestos';
        else categoryName = 'Otros';
      }

      // Normalize and sanitize result
      const typeRaw = (result.type ?? result.tipo_documento ?? '').toString();
      const typeNorm = (() => {
        const t = String(typeRaw || '').toLowerCase();
        if (/factura/.test(t)) return 'FACTURA';
        if (/boleta|ticket/.test(t)) return 'BOLETA';
        if (/yape/.test(t)) return 'YAPE';
        if (/plin/.test(t)) return 'PLIN';
        if (/tunki/.test(t)) return 'TUNKI';
        if (/lemonpay/.test(t)) return 'LEMONPAY';
        if (/\bbc\bp/.test(t) || /bcp/.test(t)) return 'BCP';
        if (/interbank/.test(t)) return 'INTERBANK';
        if (/scotia|scotiabank/.test(t)) return 'SCOTIABANK';
        if (/bbva/.test(t)) return 'BBVA';
        const p = ((result.provider ?? result.proveedor) || '').toString().toLowerCase();
        if (/yape/.test(p)) return 'YAPE';
        if (/plin/.test(p)) return 'PLIN';
        if (/tunki/.test(p)) return 'TUNKI';
        if (/lemonpay/.test(p)) return 'LEMONPAY';
        if (/\bbc\bp/.test(p) || /bcp/.test(p)) return 'BCP';
        if (/interbank/.test(p)) return 'INTERBANK';
        if (/scotia|scotiabank/.test(p)) return 'SCOTIABANK';
        if (/bbva/.test(p)) return 'BBVA';
        return 'INFORMAL';
      })();
      // Intentar recuperar fecha de emisión con heurísticas adicionales
      function extractDateFromText(txt?: string | null): string | null {
        const s = String(txt ?? '').toLowerCase();
        const regexNear = /(emisi[óo]n|emitid[oa]|comprobante|documento|venta)[^\n]{0,50}?((?:\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})|(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}))/i;
        const m1 = s.match(regexNear);
        if (m1) return normalizeDate(m1[2]);
        const regexAny = /((?:\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})|(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}))/g;
        const all = Array.from(s.matchAll(regexAny)).map(x => normalizeDate(x[1])).filter(Boolean) as string[];
        if (all.length) return all.sort()[0] || null; // fecha más antigua
        return null;
      }
      const issuedPrimary = normalizeDate((result as any).issuedAt ?? (result as any).fecha_emision);
      const issuedSecondary = extractDateFromText((result as any).observaciones ?? (result as any).raw?.text ?? (result as any).rawText);
      const issuedAtNorm = issuedPrimary ?? issuedSecondary ?? new Date().toISOString().slice(0,10);
      const totalsInput = result.totals ?? null;
      const totals = totalsInput ? totalsInput : { total: result.monto_total ?? 0, currency: result.moneda ?? 'PEN', subtotal: null, taxes: null };
      const currencyNorm = normalizeCurrency(totals.currency ?? (result.moneda ?? 'PEN'));
      const totalNum = typeof (totals.total ?? result.monto_total) === 'number' ? (totals.total ?? result.monto_total) : parseAmount(totals.total ?? result.monto_total);
      const providerNorm = ((result.provider ?? result.proveedor) || 'Desconocido').trim();
      const docNumberNorm = (result.docNumber ?? result.numero_documento ?? null) ? String(result.docNumber ?? result.numero_documento).trim() : null;
      const rucDigits = String(result.ruc_proveedor ?? '').replace(/\D+/g,'');
      const emitter = result.emitter || { name: providerNorm || null, idType: rucDigits ? 'RUC' : null, idNumber: rucDigits || null };
      const receiver = result.receiver || null;
      let items: any = Array.isArray(result.items) ? result.items : null;
      if (Array.isArray(items) && items.length && items[0] && (items[0].descripcion || items[0].precio_unitario || items[0].subtotal)) {
        items = items.map((it: any) => ({
          description: String(it.descripcion ?? '').trim(),
          quantity: it.cantidad != null ? parseAmount(it.cantidad) : null,
          unitPrice: it.precio_unitario != null ? parseAmount(it.precio_unitario) : null,
          lineTotal: it.subtotal != null ? parseAmount(it.subtotal) : null,
          taxRate: null,
        })).filter((x: any) => x.description);
      }
      let subtotal = typeof totals.subtotal === 'number' ? totals.subtotal : null;
      let taxes = Array.isArray(totals.taxes) ? totals.taxes : null;

      // Compute IGV if missing
      if ((subtotal == null || !Array.isArray(taxes) || taxes.length === 0) && totalNum > 0) {
        const igvRate = 0.18;
        subtotal = Number((totalNum / (1 + igvRate)).toFixed(2));
        const igvAmount = Number((totalNum - subtotal).toFixed(2));
        taxes = [{ name: 'IGV', rate: 18, amount: igvAmount }];
      }

      // Validations and anomaly detection
      const anomalies: string[] = Array.isArray(result?.classification?.anomalies) ? result.classification.anomalies.slice(0) : [];
      if (emitter.idType === 'RUC' && onlyDigits(emitter.idNumber).length !== 11) anomalies.push('RUC emisor inválido');
      if (emitter.idType === 'DNI' && onlyDigits(emitter.idNumber).length !== 8) anomalies.push('DNI emisor inválido');
      if (receiver && receiver.idType === 'RUC' && onlyDigits(receiver.idNumber).length !== 11) anomalies.push('RUC receptor inválido');
      if (receiver && receiver.idType === 'DNI' && onlyDigits(receiver.idNumber).length !== 8) anomalies.push('DNI receptor inválido');
      if (!validDate(issuedAtNorm)) anomalies.push('Fecha inválida');
      if (items && items.length > 0) {
        const sumLines = items.reduce((acc: number, it: any) => acc + (typeof it.lineTotal === 'number' ? it.lineTotal : 0), 0);
        if (!approx(sumLines, totalNum)) anomalies.push('Suma de ítems no coincide con total');
      }
      const classification = {
        documentType: typeNorm,
        signatures: { hasSignature: !!result?.classification?.signatures?.hasSignature, hasStamp: !!result?.classification?.signatures?.hasStamp },
        anomalies,
      };

      // Resolver categoría: devolver solo el nombre; la asignación/creación se hará con contexto de usuario en rutas
      let categoryId: string | undefined = undefined;

      // Build normalized value
      const value = {
        type: typeNorm,
        docNumber: docNumberNorm,
        issuedAt: issuedAtNorm,
        provider: providerNorm,
        description: (result.description ?? result.observaciones ?? null),
        emitter,
        receiver,
        items,
        totals: { subtotal, taxes, total: totalNum, currency: currencyNorm },
        payment: result.payment ?? null,
        classification,
        categoryName,
        summary: (result.summary ?? result.observaciones ?? `Documento ${meta.filename} (${meta.mimeType}), tamaño ${meta.size} bytes`),
        categoryId,
        raw: result,
      };

      // Simple XML builder (sin librerías)
      function esc(s: any) { return String(s ?? '').replace(/[<&>]/g, ch => ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : '&amp;'); }
      function el(name: string, content: string | null) { return content == null ? `<${name}/>` : `<${name}>${content}</${name}>`; }
      function objToXml(obj: any): string {
        let xml = '<ExpenseExtraction>';
        xml += el('Type', obj.type);
        xml += el('DocNumber', obj.docNumber);
        xml += el('IssuedAt', obj.issuedAt);
        xml += el('Provider', esc(obj.provider));
        xml += el('Description', obj.description ? esc(obj.description) : null);
        xml += '<Emitter>' + el('Name', obj.emitter?.name) + el('IdType', obj.emitter?.idType) + el('IdNumber', obj.emitter?.idNumber) + '</Emitter>';
        if (obj.receiver) xml += '<Receiver>' + el('Name', obj.receiver?.name) + el('IdType', obj.receiver?.idType) + el('IdNumber', obj.receiver?.idNumber) + '</Receiver>';
        if (Array.isArray(obj.items)) {
          xml += '<Items>' + obj.items.map((it: any) => `<Item>${el('Description', esc(it.description))}${el('Quantity', it.quantity?.toString() ?? null)}${el('UnitPrice', it.unitPrice?.toString() ?? null)}${el('LineTotal', it.lineTotal?.toString() ?? null)}${el('TaxRate', it.taxRate?.toString() ?? null)}</Item>`).join('') + '</Items>';
        }
        xml += '<Totals>' + el('Subtotal', obj.totals?.subtotal?.toString() ?? null) + (Array.isArray(obj.totals?.taxes) ? '<Taxes>' + obj.totals.taxes.map((t: any) => `<Tax>${el('Name', t.name)}${el('Rate', t.rate?.toString() ?? null)}${el('Amount', t.amount?.toString() ?? null)}</Tax>`).join('') + '</Taxes>' : '<Taxes/>') + el('Total', obj.totals?.total?.toString()) + el('Currency', obj.totals?.currency) + '</Totals>';
        if (obj.payment) {
          xml += '<Payment>' + el('Method', obj.payment.method) + el('CardLast4', obj.payment.cardLast4) + el('DueDate', obj.payment.dueDate) + el('PaidDate', obj.payment.paidDate) + el('TransactionId', obj.payment.transactionId) + '</Payment>';
        }
        xml += '<Classification>' + el('DocumentType', obj.classification?.documentType) + '<Signatures>' + el('HasSignature', String(!!obj.classification?.signatures?.hasSignature)) + el('HasStamp', String(!!obj.classification?.signatures?.hasStamp)) + '</Signatures>' + (Array.isArray(obj.classification?.anomalies) ? '<Anomalies>' + obj.classification.anomalies.map((a: string) => el('Anomaly', esc(a))).join('') + '</Anomalies>' : '<Anomalies/>') + '</Classification>';
        xml += el('CategoryName', obj.categoryName);
        xml += el('Summary', esc(obj.summary));
        if (obj.categoryId) xml += el('CategoryId', obj.categoryId);
        xml += '</ExpenseExtraction>';
        return xml;
      }
      const xml = objToXml(value);

      const cachedValue = { ...value, xml };
      await app.prisma.aiCache.create({ data: { key, value: cachedValue, ttl: config.cacheTtlSeconds } });
      return cachedValue;
    },
    async transcribeAudio(app: FastifyInstance, buffer: Buffer, mimeType?: string): Promise<{ text: string }> {
      const hash = crypto.createHash('sha256').update(buffer).digest('hex');
      const key = 'audio_transc:' + hash;
      const cached = await app.prisma.aiCache.findUnique({ where: { key } });
      if (cached) {
        const v: any = cached.value;
        const text = typeof v?.text === 'string' ? v.text : '';
        return { text };
      }

      const MODEL_TX = (process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe').trim();
      function detectExt(buf: Buffer, mt?: string): string {
        const mtL = String(mt || '').toLowerCase();
        if (/(mpeg|mp3)/.test(mtL)) return 'mp3';
        if (/ogg/.test(mtL)) return 'ogg';
        if (/webm/.test(mtL)) return 'webm';
        if (/wav/.test(mtL)) return 'wav';
        if (/m4a|mp4|aac/.test(mtL)) return 'm4a';
        if (buf && buf.length >= 12) {
          const s4 = buf.subarray(0, 4).toString('ascii');
          if (s4 === 'OggS') return 'ogg';
          const riff = s4 === 'RIFF';
          const wave = buf.subarray(8, 12).toString('ascii') === 'WAVE';
          if (riff && wave) return 'wav';
          const id3 = buf.subarray(0, 3).toString('ascii') === 'ID3';
          if (id3) return 'mp3';
          const ebml = buf.subarray(0, 4);
          if (ebml[0] === 0x1a && ebml[1] === 0x45 && ebml[2] === 0xdf && ebml[3] === 0xa3) return 'webm';
          const ftyp = buf.subarray(4, 8).toString('ascii');
          if (s4 === '\u0000\u0000\u0000\u0000' && ftyp === 'ftyp') return 'm4a';
        }
        return 'wav';
      }
      const ext = detectExt(buffer, mimeType);
      const defaultName = `audio.${ext}`;
      const normMime = (() => {
        const mt = String(mimeType || '').toLowerCase().split(';')[0].trim();
        if (mt) return mt;
        if (ext === 'ogg') return 'audio/ogg';
        if (ext === 'mp3') return 'audio/mpeg';
        if (ext === 'wav') return 'audio/wav';
        if (ext === 'webm') return 'audio/webm';
        if (ext === 'm4a') return 'audio/mp4';
        return 'application/octet-stream';
      })();

      let textOut = '';
      try {
        const file = await toFile(buffer, defaultName, { type: normMime });
        const res = await client.audio.transcriptions.create({
          model: MODEL_TX,
          file,
        });
        textOut = String((res as any)?.text || '');
      } catch (e) {
        try {
          const file = await toFile(buffer, defaultName, { type: normMime });
          const res = await client.audio.transcriptions.create({
            model: 'whisper-1',
            file,
          });
          textOut = String((res as any)?.text || '');
        } catch (e2) {
          textOut = '';
          app.log.warn({ msg: 'audio transcription failed', error: String(e2 || e) });
        }
      }

      if (textOut && textOut.trim().length > 0) {
        await app.prisma.aiCache.create({ data: { key, value: { text: textOut }, ttl: config.cacheTtlSeconds } });
      }
      return { text: textOut };
    },
  };
}
