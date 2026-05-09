import { FastifyInstance } from 'fastify';

// API pública para tasas de cambio
const API_URL = 'https://api.exchangerate-api.com/v4/latest/';

export class CurrencyService {
  private app: FastifyInstance;
  private localCache: Map<string, number> = new Map();

  constructor(app: FastifyInstance) {
    this.app = app;
  }

  async getExchangeRate(from: string, to: string): Promise<number> {
    const f = from.toUpperCase();
    const t = to.toUpperCase();
    
    if (f === t) return 1;

    const key = `RATE:${f}:${t}`;
    
    // 0. Try Local Instance Cache
    if (this.localCache.has(key)) {
      return this.localCache.get(key)!;
    }
    
    // 1. Try DB Cache
    try {
      const cached = await this.app.prisma.aiCache.findUnique({ where: { key } });
      if (cached) {
        const ageSec = (Date.now() - cached.createdAt.getTime()) / 1000;
        if (ageSec < (cached.ttl || 86400)) {
            const rate = (cached.value as any).rate;
            this.localCache.set(key, rate);
            return rate;
        }
      }
    } catch {}

    // 2. Fetch API
    try {
      const res = await fetch(`${API_URL}${f}`);
      if (res.ok) {
        const data = await res.json();
        const rate = data.rates[t];
        
        if (rate) {
          // Guardar en caché por 24h (86400s)
          await this.app.prisma.aiCache.upsert({
            where: { key },
            update: { value: { rate }, ttl: 86400, createdAt: new Date() },
            create: { key, value: { rate }, ttl: 86400 }
          });
          this.localCache.set(key, rate);
          return rate;
        }
      }
    } catch (e) {
      this.app.log.error({ msg: 'Currency fetch failed', e });
    }

    // 3. Fallback (Tasas aproximadas estáticas de seguridad)
    if (f === 'USD' && t === 'PEN') return 3.75;
    if (f === 'PEN' && t === 'USD') return 0.26;
    if (f === 'EUR' && t === 'PEN') return 4.10;
    if (f === 'PEN' && t === 'EUR') return 0.24;
    
    return 1; // Si falla todo, 1:1
  }
  
  async convert(amount: number, from: string, to: string): Promise<{ amount: number; rate: number }> {
    const rate = await this.getExchangeRate(from, to);
    return {
        amount: Number((amount * rate).toFixed(2)),
        rate
    };
  }
}
