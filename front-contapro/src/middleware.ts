import { NextRequest, NextResponse } from "next/server";
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  
  // 1. Run intl middleware first to handle locale redirects and rewrites
  const response = intlMiddleware(req);
  
  // If intl middleware wants to redirect (e.g. / -> /es), let it.
  if (response.headers.get('Location')) {
    return response;
  }

  // 2. Custom Logic
  // We need to determine the "logical" path (without locale) for our checks
  const localePattern = /^\/(es|en|pt)/;
  const pathWithoutLocale = pathname.replace(localePattern, '') || '/';

  const token = req.cookies.get("session")?.value;
  const forwardedHost = req.headers.get("x-forwarded-host") || req.headers.get("host") || undefined;
  const host = (forwardedHost ? forwardedHost.split(":")[0] : req.nextUrl.hostname);

  const cookieDomainEnv = (process.env.NEXT_PUBLIC_COOKIE_DOMAIN || process.env.COOKIE_DOMAIN || "").trim();
  const baseDomain = cookieDomainEnv.startsWith(".") ? cookieDomainEnv.slice(1) : cookieDomainEnv;
  const APP_HOST = (process.env.NEXT_PUBLIC_APP_HOST || "app.contapro.lat").trim();
  const landingHost = (process.env.NEXT_PUBLIC_LANDING_HOST || baseDomain || "contapro.lat").trim();
  const isLandingHost = host === landingHost || host === `www.${landingHost}`;

  const isStatic = pathname.startsWith("/_next") || pathname === "/favicon.ico" || pathname === "/robots.txt" || pathname === "/sitemap.xml";

  // Landing Host Redirect Logic
  // We use pathWithoutLocale to check if it's "home"
  if (isLandingHost && pathWithoutLocale !== "/" && !isStatic) {
    // Construir destino sin heredar puerto del request interno
    // Preserves the full path including locale if present
    const dest = new URL(req.nextUrl.pathname + req.nextUrl.search, `https://${APP_HOST}`);
    return NextResponse.redirect(dest);
  }

  const protectedPaths = ["/dashboard", "/upload", "/history", "/expenses", "/budget"];
  const isProtected = protectedPaths.some((p) => pathWithoutLocale.startsWith(p));

  const sameBaseDomain = baseDomain && (host === baseDomain || host.endsWith("." + baseDomain));

  // Helper to get current locale prefix for redirects
  const localeMatch = pathname.match(localePattern);
  const localePrefix = localeMatch ? localeMatch[0] : '/es';

  // Only enforce cookie check when the frontend shares base domain.
  if (sameBaseDomain && isProtected && !token) {
    const url = new URL(`${localePrefix}/login`, `https://${host}`);
    return NextResponse.redirect(url);
  }

  if (sameBaseDomain && isProtected) {
    try {
      const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
      const res = await fetch(`${BASE}/api/auth/me`, {
        headers: token ? { cookie: `session=${token}` } : undefined,
        cache: 'no-store',
      });
      if (!res.ok) {
        const url = new URL(`${localePrefix}/login`, `https://${host}`);
        return NextResponse.redirect(url);
      }
      const data = await res.json();
      const now = new Date();
      const plan = String(data?.user?.plan || "").trim().toUpperCase();
      const planExpires = data?.user?.planExpires ? new Date(data.user.planExpires) : null;
      const trialEnds = data?.user?.trialEnds ? new Date(data.user.trialEnds) : null;
      const premiumActivo = (plan === "PREMIUM" && planExpires != null && planExpires > now) || plan === "LIFETIME";
      const trialActivo = trialEnds != null && trialEnds > now;
      
      // La validación de onboarding tiene máxima prioridad para usuarios autenticados
      const tutorialSeen = data?.user?.tutorialSeen === true;

      // Si no ha visto el tutorial y no está ya en la página de onboarding, redirigirlo obligatoriamente
      if (!tutorialSeen && !pathWithoutLocale.startsWith("/onboarding")) {
        const url = new URL(`${localePrefix}/onboarding`, `https://${host}`);
        return NextResponse.redirect(url);
      }

      // Logic moved to client side (SubscriptionGuard) to show a friendly UI
      // instead of a hard redirect. We only ensure authentication here.
      // Ahora el plan FREE está permitido por defecto en SubscriptionGuard.
      /*
      if (!premiumActivo && !trialActivo) {
        if (!pathWithoutLocale.startsWith("/pricing") && !pathWithoutLocale.startsWith("/billing")) {
          const url = new URL(`${localePrefix}/pricing`, `https://${host}`);
          return NextResponse.redirect(url);
        }
      }
      */
    } catch {
      const url = new URL(`${localePrefix}/login`, `https://${host}`);
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  // Match all paths except static files and API
  matcher: ['/', '/(es|en|pt)/:path*', '/((?!_next|_vercel|api|.*\\..*).*)']
};
