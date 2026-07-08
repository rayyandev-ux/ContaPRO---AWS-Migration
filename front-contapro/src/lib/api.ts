import { fetchAuthSession } from 'aws-amplify/auth';

export const BASE = (process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080").replace(/\/+$/, "");

const g = globalThis as Record<string, unknown>;
if (!g.__contapro_api_cache) {
  g.__contapro_api_cache = new Map<string, { expires: number; data: unknown }>();
}
const API_CACHE = g.__contapro_api_cache as Map<string, { expires: number; data: unknown }>;
const DEFAULT_TTL_MS = Number(process.env.NEXT_PUBLIC_API_CACHE_TTL ?? 300_000);

function makeKey(path: string): string {
  return path;
}

export function clearApiCache() {
  API_CACHE.clear();
}

let _fallbackToken: string | null = null;

export function setFallbackToken(token: string) {
  _fallbackToken = token;
  if (typeof window !== 'undefined') {
    try { sessionStorage.setItem('__contapro_token', token); } catch (_) { /* storage unavailable */ }
  }
}

export function clearFallbackToken() {
  _fallbackToken = null;
  if (typeof window !== 'undefined') {
    try { sessionStorage.removeItem('__contapro_token'); } catch (_) { /* storage unavailable */ }
  }
}

function getFallbackToken(): string | null {
  if (_fallbackToken) return _fallbackToken;
  if (typeof window !== 'undefined') {
    try { return sessionStorage.getItem('__contapro_token'); } catch (_) { /* storage unavailable */ }
  }
  return null;
}

export function invalidateApiCache(pathStartsWith: string) {
  for (const key of Array.from(API_CACHE.keys())) {
    if (key.startsWith(pathStartsWith)) API_CACHE.delete(key);
  }
}

async function resolveAuthHeader(): Promise<Record<string, string>> {
  try {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken ?? session.tokens?.accessToken;
    if (token) {
      return { "Authorization": `Bearer ${token.toString()}`, "X-Id-Token": token.toString() };
    }
  } catch (_) { /* no Cognito session */ }

  const fb = getFallbackToken();
  if (fb) return { "Authorization": `Bearer ${fb}`, "X-Id-Token": fb };

  return {};
}

function handle402(data: Record<string, unknown>, status: number): { ok: false; error: string } {
  const msg = String((data?.message || data?.error) || `Error ${status}`);
  if (typeof window !== 'undefined') {
    clearApiCache();
    window.location.href = '/billing';
  }
  return { ok: false, error: msg };
}

export async function apiJson<T = unknown>(path: string, init: RequestInit = {}): Promise<{ ok: boolean; data?: T; error?: string }> {
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
    const authHeader = await resolveAuthHeader();

    const res = await fetch(url, {
      ...init,
      headers: {
        ...(init.headers || {}),
        ...authHeader,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      credentials: "omit",
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 402) return handle402(data, res.status);
    if (!res.ok || (data && data.ok === false)) {
      const msg = (data && (data.message || data.error)) || `Error ${res.status}`;
      return { ok: false, error: String(msg) };
    }
    if (isGet && !skipCache) {
      API_CACHE.set(key, { expires: Date.now() + DEFAULT_TTL_MS, data });
    }
    return { ok: true, data };
  } catch (_) {
    return { ok: false, error: "Network error" };
  }
}

export async function apiMultipart<T = unknown>(path: string, formData: FormData): Promise<{ ok: boolean; data?: T; error?: string }> {
  try {
    let urlPath = path;
    if (path.startsWith('/api/proxy/')) {
      urlPath = '/api/' + path.substring(11);
    }
    const url = `${BASE}${urlPath}`;
    const authHeader = await resolveAuthHeader();

    const res = await fetch(url, {
      method: "POST",
      body: formData,
      headers: authHeader,
      credentials: "omit",
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 402) return handle402(data, res.status);
    if (!res.ok || (data && data.ok === false)) {
      const msg = (data && (data.message || data.error)) || `Error ${res.status}`;
      return { ok: false, error: String(msg) };
    }
    return { ok: true, data };
  } catch (_) {
    return { ok: false, error: "Network error" };
  }
}
