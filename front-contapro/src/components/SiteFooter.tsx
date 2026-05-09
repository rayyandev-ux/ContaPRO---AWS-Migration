"use client";
import Image from 'next/image';
import { Link } from '@/i18n/routing';
import LightRays from '@/components/LightRays';
import { useTranslations } from 'next-intl';
import { cn } from "@/lib/utils";

export default function SiteFooter({ className }: { className?: string }) {
  const t = useTranslations('SiteFooter');
  const tHeader = useTranslations('SiteHeader');
  const instagramUrl = "https://www.instagram.com/contapro.lat/";

  return (
    <footer 
      className={cn("w-full relative z-40 bg-black -mt-[80px] md:-mt-[150px]", className)}
      style={{
        borderTopLeftRadius: '40% 80px',
        borderTopRightRadius: '40% 80px',
        borderTop: '1px solid rgba(139, 92, 246, 0.6)',
        boxShadow: '0 -15px 40px -10px rgba(139, 92, 246, 0.5), 0 0 20px -5px rgba(139, 92, 246, 0.3)',
      }}
    >

      {/* LightRays */}
      <div className="absolute inset-0 hidden md:block overflow-hidden" style={{ zIndex: 1, borderTopLeftRadius: 'inherit', borderTopRightRadius: 'inherit' }}>
        <LightRays
          raysColor="#541dd4ff"
          raysSpeed={0.2}
          raysOrigin="top-center"
          lightSpread={0.7}
          rayLength={0.8}
          fadeDistance={0.6}
        />
      </div>

      {/* Contenido */}
      <div className="mx-auto max-w-7xl px-6 pb-10 relative pt-16 md:pt-28" style={{ zIndex: 2 }}>
        <div className="grid gap-8 grid-cols-2 md:grid-cols-4 text-center md:text-left">
          <div className="flex flex-col gap-4 items-center md:items-start col-span-2 md:col-span-1">
            <Image
              src="/logo.png"
              alt="ContaPRO"
              width={200}
              height={80}
              className="h-14 w-auto object-contain"
            />
          </div>
          <div className="flex flex-col items-center md:items-start">
            <div className="font-semibold">{t('usefulLinks')}</div>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <Link href="/pricing" className="text-muted-foreground hover:text-foreground">
                {tHeader('plansAndPricing')}
              </Link>
              <Link href="/contact" className="text-muted-foreground hover:text-foreground">
                {tHeader('contact')}
              </Link>
            </div>
          </div>
          <div className="flex flex-col items-center md:items-start">
            <div className="font-semibold">{t('compliance')}</div>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <Link href="/terms-of-service" className="text-muted-foreground hover:text-foreground">
                {t('terms')}
              </Link>
              <Link href="/privacy-policy" className="text-muted-foreground hover:text-foreground">
                {t('privacy')}
              </Link>
              <Link href="/refund-returns" className="text-muted-foreground hover:text-foreground">
                {t('refunds')}
              </Link>
            </div>
          </div>
          <div className="flex flex-col items-center md:items-start col-span-2 md:col-span-1">
            <div className="font-semibold">{t('followUs')}</div>
            <div className="mt-3 flex items-center gap-3">
              <a
                aria-label="Instagram"
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-card text-card-foreground shadow-md transition-transform hover:scale-105 active:scale-95 hover:bg-muted"
              >
                <Image
                  src="/instagram_f_icon-icons.com_65485.svg"
                  alt="Instagram"
                  width={20}
                  height={20}
                  className="h-5 w-5"
                />
              </a>
            </div>
          </div>
        </div>
        <div className="mt-8 flex items-center justify-center">
          <div className="text-xs text-muted-foreground text-center">
            {t('rightsReserved', { year: new Date().getFullYear() })}
          </div>
        </div>
      </div>
    </footer>
  );
}