'use client';
import {Link, useRouter} from '@/i18n/routing';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import CardNav, { CardNavItem } from './CardNav';
import LanguageSwitcher from './LanguageSwitcher';
import { clearFallbackToken, clearApiCache } from '@/lib/api';

export default function SiteHeader() {
  const t = useTranslations('SiteHeader');
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [headerScrolled, setHeaderScrolled] = useState(false);

  const handleLogout = async () => {
    clearFallbackToken();
    clearApiCache();
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/';
  };

  const navItems: CardNavItem[] = [
    {
      label: t('platform'),
      bgColor: '#ffffff',
      textColor: '#000000',
      links: [
        { label: t('home'), href: '/', ariaLabel: t('home') },
        { label: t('pricing'), href: '/pricing', ariaLabel: t('pricing') },
        { label: t('contact'), href: '/contact', ariaLabel: t('contact') },
        { label: t('faq'), href: '/#faq', ariaLabel: t('faq') }
      ]
    },
    {
      label: t('account'),
      bgColor: '#18181b',
      textColor: '#ffffff',
      links: isAuthenticated
        ? [
            { label: t('logout'), href: '#', ariaLabel: t('logout'), onClick: handleLogout }
          ]
        : [
            { label: t('login'), href: '/login', ariaLabel: t('login') },
            { label: t('register'), href: '/register', ariaLabel: t('register') }
          ]
    }
  ];

  const mobileNavItems = navItems.map(item => ({
    ...item,
    links: item.links.filter(link => link.href !== '/#faq')
  }));

  useEffect(() => {
    const onScroll = () => { setHeaderScrolled(window.scrollY >= 2); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); };
  }, []);

  return (
    <header className={`fixed top-0 left-0 right-0 z-[9999] transition-[background,backdrop-filter] duration-100 ease-out ${headerScrolled ? 'md:bg-black/20 md:backdrop-blur-[10px] md:border-b md:border-border' : ''}`}>
      {/* Desktop Header */}
      <div className="hidden md:flex relative h-14 items-center px-6 text-white">
        <div className="flex items-center gap-4">
          <Link href="/" aria-label={t('home')}>
            <Image src="/logo.png" width={520} height={200} alt="ContaPRO" className="h-14 w-auto object-contain" unoptimized priority />
          </Link>
          <Link href="/pricing" className="w-[160px] text-center transition-opacity hover:opacity-90 hover:underline hover:decoration-white underline-offset-4">{t('plansAndPricing')}</Link>
        </div>
        <div className="flex items-center gap-4 absolute right-10 top-1/2 -translate-y-1/2">
          <LanguageSwitcher />
          {isAuthenticated ? (
            <>
              <Button onClick={handleLogout} variant="ghost" size="sm" className="w-[120px] text-white hover:text-white/80 hover:bg-white/10">
                {t('logout')}
              </Button>
              <Button asChild variant="panel" size="sm" className="w-[160px] px-3 py-1.5 bg-white text-black hover:bg-white/90 border-none">
                <Link href="/dashboard">{t('goToDashboard')}</Link>
              </Button>
            </>
          ) : (
            <>
              <Link href="/login" className="w-[100px] text-center transition-opacity hover:opacity-90 hover:underline hover:decoration-white underline-offset-4">{t('login')}</Link>
              <Button asChild variant="panel" size="sm" className="w-[160px] px-4 py-2 bg-white text-black hover:bg-white/90 border-none">
                <Link href="/register">{t('startFree')}</Link>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Mobile Header (CardNav) */}
      <div className={`md:hidden transition-[background,backdrop-filter] duration-200 ${headerScrolled ? 'bg-black/40 backdrop-blur-md' : ''}`}>
        <CardNav
          logo="/logo.png"
          items={mobileNavItems}
          baseColor="rgba(22, 22, 22, 0.8)"
          buttonBgColor="#fff"
          buttonTextColor="#000"
          menuColor="#fff"
          ctaLabel={isAuthenticated ? t('dashboard') : t('start')}
          onCtaClick={() => router.push(isAuthenticated ? '/dashboard' : '/register')}
          hideNav={false}
        />
      </div>
    </header>
  );
}