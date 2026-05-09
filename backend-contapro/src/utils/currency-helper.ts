import { CurrencyService } from '../services/currency.js';

/**
 * Obtiene el monto nativo (convertido) de una transacción (gasto o ingreso).
 * Prioriza el campo amountNative si ya está presente.
 * De lo contrario, realiza una conversión dinámica usando CurrencyService.
 */
export async function getAmountNative(
  item: { amount: number; currency: string; amountNative?: number | null; exchangeRate?: number | null },
  targetCurrency: string,
  currencyService: CurrencyService
): Promise<number> {
  const from = (item.currency || 'PEN').toUpperCase();
  const to = (targetCurrency || 'PEN').toUpperCase();
  const amount = Number(item.amount) || 0;

  // 1. Si la moneda de origen es la misma que la de destino, devolvemos el monto original
  if (from === to) {
    return amount;
  }

  // 2. Prioridad absoluta al monto nativo guardado si existe y es coherente.
  // IMPORTANTE: Incluso si es igual al nominal, si las monedas son distintas, 
  // es posible que sea una conversión 1:1 o que falte el rate, pero si amountNative 
  // tiene un valor distinto de cero y coherente, lo usamos.
  if (item.amountNative !== undefined && item.amountNative !== null && Number(item.amountNative) !== 0) {
    const native = Number(item.amountNative);
    
    // Si el monto nativo es distinto al nominal (más de 1 centavo de diferencia), es una conversión válida.
    if (Math.abs(native - amount) > 0.01) {
      return native;
    }
    
    // Si son iguales pero el rate indica conversión, lo usamos.
    if (item.exchangeRate !== undefined && item.exchangeRate !== null && Number(item.exchangeRate) !== 1 && Number(item.exchangeRate) !== 0) {
      return native;
    }
    
    // CASO CRÍTICO: Si el monto nativo es IGUAL al nominal pero las monedas son DISTINTAS (ej. 5 USD -> 5 PEN),
    // esto es probablemente un error de guardado previo. Forzamos la conversión dinámica.
  }

  // 3. De lo contrario, convertimos dinámicamente
  try {
    const result = await currencyService.convert(amount, from, to);
    if (result && typeof result.amount === 'number') {
        return result.amount;
    }
    throw new Error('Invalid conversion result');
  } catch (e) {
    // Fallback: intentar usar una tasa de cambio estática del servicio
    try {
        const rate = await currencyService.getExchangeRate(from, to);
        return Number((amount * rate).toFixed(2));
    } catch {
        return amount;
    }
  }
}

/**
 * Suma una lista de transacciones convirtiéndolas a la moneda objetivo.
 */
export async function sumAmountNative(
  items: Array<{ amount: number; currency: string; amountNative?: number | null }>,
  targetCurrency: string,
  currencyService: CurrencyService
): Promise<number> {
  let total = 0;
  for (const item of items) {
    total += await getAmountNative(item, targetCurrency, currencyService);
  }
  return Number(total.toFixed(2));
}
