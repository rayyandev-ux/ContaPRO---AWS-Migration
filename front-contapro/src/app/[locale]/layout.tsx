import type { Metadata } from "next";
import { Inter, Geist_Mono, Playfair_Display, Permanent_Marker, Montserrat } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";
import SmoothScroll from "@/components/SmoothScroll";
import { PHProvider } from "@/components/providers/PHProvider";
import PostHogPageView from "@/components/providers/PostHogPageView";
import {NextIntlClientProvider} from 'next-intl';
import {getMessages} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {setRequestLocale} from 'next-intl/server';
import {routing} from '@/i18n/routing';

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

const permanentMarker = Permanent_Marker({
  weight: "400",
  variable: "--font-permanent-marker",
  subsets: ["latin"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const baseUrl = process.env.NEXT_PUBLIC_APP_HOST 
    ? `https://${process.env.NEXT_PUBLIC_APP_HOST}` 
    : 'https://contapro.lat';

  return {
    title: {
      template: '%s | ContaPRO',
      default: 'ContaPRO — Gestión de Gastos',
    },
    description: "Dashboard web para facturas/boletas con IA y presupuesto",
    metadataBase: new URL(baseUrl),
    icons: {
      icon: [
        { url: "/logo3dNUEVO.ico", sizes: "any" },
      ],
      shortcut: "/logo3dNUEVO.ico",
      apple: "/logo3dNUEVO.ico",
    },
    openGraph: {
      title: "ContaPRO — Gestión de Gastos",
      description: "Dashboard web para facturas/boletas con IA y presupuesto",
      url: `/${locale}`,
      siteName: "ContaPRO",
      images: [
        { url: "/icono_carpeta_premium_hd.png", width: 1200, height: 630, alt: "ContaPRO" },
      ],
      locale: locale,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "ContaPRO — Gestión de Gastos",
      description: "Dashboard web para facturas/boletas con IA y presupuesto",
      images: ["/icono_carpeta_premium_hd.png"],
    },
  };
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
} as const;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function RootLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{locale: string}>;
}>) {
  const {locale} = await params;
  setRequestLocale(locale);

  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  const messages = await getMessages();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "ContaPRO",
    "applicationCategory": "FinanceApplication",
    "operatingSystem": "Web",
    "description": "Dashboard web para facturas/boletas con IA y presupuesto",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "author": {
      "@type": "Organization",
      "name": "ContaPRO"
    }
  };

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
!function (w, d, t) {
  w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(
  var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script")
  ;n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};

  ttq.load('D5FVAGRC77U4NSOIFJ7G');
  ttq.page();
}(window, document, 'ttq');
            `
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${inter.variable} ${geistMono.variable} ${playfair.variable} ${permanentMarker.variable} ${montserrat.variable} antialiased`}
      >
        <NextIntlClientProvider messages={messages}>
          <PHProvider>
            <PostHogPageView />
            <ThemeProvider
              attribute="class"
              defaultTheme="dark"
              forcedTheme="dark"
              disableTransitionOnChange
            >
              <SmoothScroll />
              {children}
              <Toaster position="bottom-right" closeButton richColors />
            </ThemeProvider>
          </PHProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
