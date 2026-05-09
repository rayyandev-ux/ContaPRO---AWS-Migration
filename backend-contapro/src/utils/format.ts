export function formatDMY(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

// Try to fix common UTF-8/Latin1 mojibake like "TecnologÃ­a" → "Tecnología"
export function fixUtf8Mojibake(s: string): string {
  const score = (str: string) => ((str.match(/[�]/g)?.length ?? 0) + (str.match(/Ã|Â/g)?.length ?? 0));
  const candidates = [
    s,
    Buffer.from(s, 'latin1').toString('utf8'),
  ];
  let best = candidates[0];
  for (const c of candidates) {
    if (score(c) < score(best)) best = c;
  }
  best = best.replace(/N�/g, 'N°');
  best = best
    .replace(/Ã¡/g, 'á')
    .replace(/Ã©/g, 'é')
    .replace(/Ã­/g, 'í')
    .replace(/Ã³/g, 'ó')
    .replace(/Ãº/g, 'ú')
    .replace(/Ã±/g, 'ñ')
    .replace(/ÃÁ/g, 'Á')
    .replace(/Ã‰/g, 'É')
    .replace(/ÃÍ/g, 'Í')
    .replace(/ÃÓ/g, 'Ó')
    .replace(/ÃÚ/g, 'Ú')
    .replace(/ÃÑ/g, 'Ñ')
    .replace(/Â°/g, '°')
    .replace(/Â¿/g, '¿')
    .replace(/Â¡/g, '¡');
  return best;
}

export function sanitizeText(input: unknown): string | undefined {
  if (input === undefined || input === null) return undefined;
  let s = String(input);
  // Remove sensitive python command paths anywhere (with or without preceding pipe)
  s = s.replace(/(?:\s*\|\s*)?py_cmd:[^\n]+/gi, '');
  // Normalize whitespace
  s = s.replace(/[\t\r]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  s = fixUtf8Mojibake(s);
  return s.length ? s : undefined;
}

export type ExpenseMessageInput = {
  title: string;
  provider: string;
  amount: number | string;
  currency: string;
  issuedText: string;
  createdText?: string;
  type: string;
  category?: string;
  description?: string;
  source?: string;
  id?: string | number;
  docNumber?: string;
  emitterId?: string;
  subtotal?: number;
  taxIgv?: number;
  paymentMethod?: string;
};

export function formatExpenseMessage(input: ExpenseMessageInput): string {
  const amt = typeof input.amount === 'number' ? input.amount.toFixed(2) : String(input.amount);
  const lines: string[] = [];
  lines.push(input.title);
  lines.push(`• Proveedor: ${input.provider}`);
  lines.push(`• Monto: *${amt} ${input.currency}*`);
  lines.push(`• Fecha: ${input.issuedText}`);
  if (input.createdText) lines.push(`• Registro: ${input.createdText}`);
  lines.push(`• Tipo: ${input.type}`);
  if (input.paymentMethod) lines.push(`• Método de pago: ${input.paymentMethod}`);
  if (input.docNumber) lines.push(`• N° Doc: ${input.docNumber}`);
  if (input.emitterId) lines.push(`• RUC: ${input.emitterId}`);
  if (input.category) lines.push(`• Categoría: ${input.category}`);
  if (typeof input.subtotal === 'number') lines.push(`• Subtotal: ${input.subtotal.toFixed(2)} ${input.currency}`);
  if (typeof input.taxIgv === 'number') lines.push(`• IGV 18%: ${input.taxIgv.toFixed(2)} ${input.currency}`);
  if (input.description) lines.push(`• Descripción: ${input.description}`);
  if (input.source) lines.push(`• Origen: ${input.source}`);
  if (input.id !== undefined) lines.push(`• ID: ${input.id}`);
  return lines.join('\n');
}

export type BudgetSummaryInput = {
  title: string;
  budgetAmount: number;
  spent: number;
  remaining: number;
  currency: string;
  month?: number;
  year?: number;
};

export function formatBudgetSummaryMessage(input: BudgetSummaryInput): string {
  const lines: string[] = [];
  lines.push(input.title);
  if (typeof input.month === 'number' && typeof input.year === 'number') {
    const mm = String(input.month).padStart(2, '0');
    lines.push(`• Mes: ${mm}/${input.year}`);
  }
  lines.push(`• Presupuesto: *${input.budgetAmount.toFixed(2)} ${input.currency}*`);
  lines.push(`• Gasto: *${input.spent.toFixed(2)} ${input.currency}*`);
  lines.push(`• Restante: *${input.remaining.toFixed(2)} ${input.currency}*`);
  return lines.join('\n');
}
