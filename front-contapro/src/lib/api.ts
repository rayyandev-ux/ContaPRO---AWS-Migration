const BASE = (process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080").replace(/\/+$/, "");

// Caché simple en memoria (sólo en cliente) para GETs
const g: any = globalThis as any;
if (!g.__contapro_api_cache) {
  g.__contapro_api_cache = new Map<string, { expires: number; data: any }>();
}
const API_CACHE: Map<string, { expires: number; data: any }> = g.__contapro_api_cache;
const DEFAULT_TTL_MS = Number(process.env.NEXT_PUBLIC_API_CACHE_TTL ?? 300_000); // 5 minutos por defecto

function makeKey(path: string): string {
  // credential include hace el caché por sesión del navegador
  return path;
}

export function clearApiCache() {
  API_CACHE.clear();
}

export function invalidateApiCache(pathStartsWith: string) {
  const prefix = pathStartsWith;
  for (const key of Array.from(API_CACHE.keys())) {
    if (key.startsWith(prefix)) API_CACHE.delete(key);
  }
}

export async function apiJson<T = any>(path: string, init: RequestInit = {}): Promise<{ ok: boolean; data?: T; error?: string }>{
  try {
    const method = (init.method || 'GET').toUpperCase();
    const isGet = method === 'GET';
    const skipCache = !isGet || (init.cache === 'no-store');
    const key = isGet ? makeKey(path) : '';
    if (isGet && !skipCache) {
      const hit = API_CACHE.get(key);
      if (hit && hit.expires > Date.now()) {
        return { ok: true, data: hit.data as T };
      }
    }

    const isProxy = path.startsWith('/api/proxy');
    const url = isProxy ? path : `${BASE}${path}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        ...(init.headers || {}),
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 402) {
      const msg402 = (data && (data.message || data.error)) || `Error ${res.status}`;
      try {
        if (typeof window !== 'undefined') {
          clearApiCache();
          window.location.href = '/billing';
        }
      } catch {}
      return { ok: false, error: msg402 };
    }
    if (!res.ok || (data && data.ok === false)) {
      const msg = (data && (data.message || data.error)) || `Error ${res.status}`;
      return { ok: false, error: msg };
    }
    if (isGet && !skipCache) {
      API_CACHE.set(key, { expires: Date.now() + DEFAULT_TTL_MS, data });
    }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: "Network error" };
  }
}

export async function apiMultipart<T = any>(path: string, formData: FormData): Promise<{ ok: boolean; data?: T; error?: string }>{
  try {
    const isProxy = path.startsWith('/api/proxy');
    const url = isProxy ? path : `${BASE}${path}`;
    const res = await fetch(url, {
      method: "POST",
      body: formData,
      credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 402) {
      const msg402 = (data && (data.message || data.error)) || `Error ${res.status}`;
      try {
        if (typeof window !== 'undefined') {
          clearApiCache();
          window.location.href = '/billing';
        }
      } catch {}
      return { ok: false, error: msg402 };
    }
    if (!res.ok || (data && data.ok === false)) {
      const msg = (data && (data.message || data.error)) || `Error ${res.status}`;
      return { ok: false, error: msg };
    }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: "Network error" };
  }
}
