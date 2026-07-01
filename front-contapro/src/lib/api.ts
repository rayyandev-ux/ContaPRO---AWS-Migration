import { fetchAuthSession } from 'aws-amplify/auth';

export const BASE = (process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080").replace(/\/+$/, "");

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

let _fallbackToken: string | null = null;

export function setFallbackToken(token: string) {
  _fallbackToken = token;
  if (typeof window !== 'undefined') {
    try { sessionStorage.setItem('__contapro_token', token); } catch {}
  }
}

export function clearFallbackToken() {
  _fallbackToken = null;
  if (typeof window !== 'undefined') {
    try { sessionStorage.removeItem('__contapro_token'); } catch {}
  }
}

function getFallbackToken(): string | null {
  if (_fallbackToken) return _fallbackToken;
  if (typeof window !== 'undefined') {
    try { return sessionStorage.getItem('__contapro_token'); } catch {}
  }
  return null;
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

    let urlPath = path;
    if (path.startsWith('/api/proxy/')) {
      urlPath = '/api/' + path.substring(11);
    }
    const url = `${BASE}${urlPath}`;

    let authHeader = {};
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken ?? session.tokens?.accessToken;
      if (token) {
        authHeader = { "Authorization": `Bearer ${token.toString()}` };
      }
    } catch (e) {}
    if (!('Authorization' in authHeader)) {
      const fb = getFallbackToken();
      if (fb) authHeader = { "Authorization": `Bearer ${fb}` };
    }

    const res = await fetch(url, {
      ...init,
      headers: {
        ...(init.headers || {}),
        ...authHeader,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      credentials: "omit", // Cambiado de include a omit porque ya usamos el Header Authorization
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
    let urlPath = path;
    if (path.startsWith('/api/proxy/')) {
      urlPath = '/api/' + path.substring(11);
    }
    const url = `${BASE}${urlPath}`;
    
    let authHeader: any = {};
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken ?? session.tokens?.accessToken;
      if (token) {
        authHeader = { "Authorization": `Bearer ${token.toString()}` };
      }
    } catch (e) {}
    if (!('Authorization' in authHeader)) {
      const fb = getFallbackToken();
      if (fb) authHeader = { "Authorization": `Bearer ${fb}` };
    }

    const res = await fetch(url, {
      method: "POST",
      body: formData,
      headers: authHeader,
      credentials: "omit", // Cambiado a omit
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
