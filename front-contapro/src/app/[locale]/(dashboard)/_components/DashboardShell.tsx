'use client';
import {Link, usePathname, useRouter} from '@/i18n/routing';
import Image from 'next/image';
import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import SidebarNav from './SidebarNav';
import MobileActionBar from './MobileActionBar';
import LogoutButton from '@/components/logout-button';
import RealtimeRefresh from '@/components/RealtimeRefresh';
import { X } from 'lucide-react';
import Portal from '@/components/Portal';
import OnboardingWizard from '@/components/OnboardingWizard';
import ProfileSwitcher from './ProfileSwitcher';
import { useTranslations } from 'next-intl';
import NotificationsMenu from '@/components/NotificationsMenu';
import InteractiveTutorial from '@/components/InteractiveTutorial';

type Props = {
  user?: { 
    name?: string | null; 
    email?: string | null;
    plan?: string;
    planExpires?: string;
    trialEnds?: string;
  };
  children: React.ReactNode;
  tutorialSeen?: boolean;
};

export default function DashboardShell({ user, children, tutorialSeen }: Props) {
  const t = useTranslations('Sidebar');
  const [hidden, setHidden] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileProfileOpen, setMobileProfileOpen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(!tutorialSeen);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const welcome = searchParams.get('welcome');
    if (welcome === 'trial_activated') {
      toast.success("¡Bienvenido a ContaPRO!", {
        description: "Tu prueba gratuita ha sido activada. Se te enviará un comprobante a tu email."
      });
      // Limpiar el parámetro de la URL
      const params = new URLSearchParams(window.location.search);
      params.delete('welcome');
      const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
      window.history.replaceState(null, '', newUrl);
    }
  }, [searchParams]);

  const rawLanding = (process.env.NEXT_PUBLIC_LANDING_HOST || 'contapro.lat').trim();
  const landingHref = (() => {
    const v = rawLanding.toLowerCase();
    if (v.startsWith('https//')) return `https://${rawLanding.slice('https//'.length)}`;
    if (v.startsWith('http//')) return `http://${rawLanding.slice('http//'.length)}`;
    if (v.startsWith('http://') || v.startsWith('https://')) return rawLanding;
    return `https://${rawLanding}`;
  })();

  useEffect(() => {
    // Lock body scroll to prevent "screen displacement" on navigation or focus
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.height = '100dvh';
    
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.body.style.height = '';
    };
  }, []);

  useEffect(() => {
    if (!isNavigating) return;
    const t = setTimeout(() => setIsNavigating(false), 800);
    return () => clearTimeout(t);
  }, [isNavigating]);
  useEffect(() => {
    if (isNavigating) setTimeout(() => setIsNavigating(false), 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    const el = scrollRef.current;
    const onScroll = () => {
      try { setHeaderScrolled((el?.scrollTop ?? 0) > 0); } catch {}
    };
    onScroll();
    el?.addEventListener('scroll', onScroll, { passive: true });
    return () => { el?.removeEventListener('scroll', onScroll); };
  }, []);

  
  const gridColsClass = hidden
    ? 'md:grid-cols-[110px_minmax(0,1fr)] md:gap-0'
    : 'md:grid-cols-[300px_minmax(0,1fr)] md:gap-0';
  return (
    <div className="relative h-[100dvh] w-full overflow-hidden">
      

      <div className={`grid w-full grid-cols-1 ${gridColsClass} h-[100dvh] overflow-hidden`}>
        <div className={`hidden md:flex md:flex-col p-4 pr-0 h-full transition-all duration-300 ${hidden ? 'md:w-[110px]' : 'md:w-[300px]'}`}>
          <aside className={`flex flex-col w-full h-full rounded-[32px] border border-white/20 bg-white/10 backdrop-blur-2xl shadow-2xl text-white p-4 overflow-hidden relative transition-all duration-300 ${hidden ? 'items-center' : ''}`}>
            <div className={`flex items-center gap-2 px-2 py-2 mb-4 relative min-h-[40px] ${hidden ? 'justify-center w-full mt-2' : 'justify-between w-full'}`}>
              <div className={`transition-all duration-300 absolute left-2 ${hidden ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'}`}>
                <Link href={landingHref} aria-label="Ir a la landing" className="flex items-center gap-2">
                  <Image src="/logo.png" width={160} height={60} alt="ContaPRO" className="h-8 w-auto object-contain brightness-200 contrast-125" unoptimized />
                </Link>
              </div>
                  <button
                    type="button"
                    aria-label={hidden ? 'Mostrar menú' : 'Ocultar menú'}
                    onClick={() => setHidden(v => !v)}
                    className={`flex items-center justify-center border hover:bg-white/10 hover:scale-95 active:scale-90 transition-all duration-300 z-10 ${hidden ? 'h-[52px] w-[52px] rounded-[20px] border-white/20 bg-white/5 mx-auto relative' : 'h-8 w-8 rounded-full border-transparent bg-transparent absolute right-2'}`}
                  >
                  {hidden ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/80"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/50 hover:text-white transition-colors"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  )}
                </button>
            </div>
          <div className={`mt-2 px-2 text-[11px] uppercase font-playfair font-bold tracking-[0.1em] text-white/60 transition-all duration-300 ${hidden ? 'opacity-0 h-0 overflow-hidden m-0 p-0' : 'opacity-100 h-auto'}`}>{t('platform')}</div>
          <div className="mt-1 flex-1 overflow-y-auto overflow-x-hidden scrollbar-none flex flex-col">
            <SidebarNav onNavigate={() => setIsNavigating(true)} isCollapsed={hidden} />
          </div>
          <div id="sidebar-account-section" className="mt-auto pt-4 space-y-2 px-2 relative z-10">
            <div className={`text-[11px] uppercase font-playfair font-bold tracking-[0.1em] text-white/60 transition-all duration-300 ${hidden ? 'opacity-0 h-0 overflow-hidden m-0 p-0' : 'opacity-100 h-auto mb-2'}`}>{t('account')}</div>
            <button
                id="user-menu-btn"
                type="button"
                className={`flex w-full items-center rounded-3xl border border-white/10 bg-white/5 p-2 text-left hover:bg-white/10 transition-all duration-300 group ${hidden ? 'justify-center w-[52px] h-[52px] p-0 mx-auto' : 'justify-between'}`}
                onClick={(e) => {
                if (profileOpen) { setProfileOpen(false); return; }
                setProfileOpen(true);
                try {
                  const btnRect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                  const vw = window.innerWidth;
                  const vh = window.innerHeight;
                  let top = 8;
                  let left = 8;
                  const estH = 180;
                  const estW = 256;
                  if (btnRect) {
                    top = btnRect.top - estH - 8;
                    left = btnRect.right + 8;
                    top = Math.max(8, Math.min(top, vh - estH - 8));
                    left = Math.max(8, Math.min(left, vw - estW - 8));
                  }
                  setMenuPos({ top, left });
                  requestAnimationFrame(() => {
                    const mRect = menuRef.current?.getBoundingClientRect();
                    const mh = mRect?.height ?? 135;
                    const mw = mRect?.width ?? 256;
                    if (btnRect) {
                      top = btnRect.top - mh - 8;
                      left = btnRect.right + 8;
                      top = Math.max(8, Math.min(top, vh - mh - 8));
                      left = Math.max(8, Math.min(left, vw - mw - 8));
                    }
                    setMenuPos({ top, left });
                  });
                } catch {}
              }}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                  <div className={`flex shrink-0 items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg transition-all duration-300 ${hidden ? 'h-[52px] w-[52px] rounded-[20px]' : 'h-10 w-10 rounded-full'}`}>
                    <span className={`font-bold transition-all duration-300 ${hidden ? 'text-xl' : 'text-sm'}`}>{(user?.name?.[0] || user?.email?.[0] || 'U')?.toUpperCase()}</span>
                  </div>
                <div className={`min-w-0 text-left transition-all duration-300 ${hidden ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100 block'}`}>
                  <div className="truncate text-sm font-semibold text-white">{user?.name || user?.email || 'Usuario'}</div>
                  {user?.email && (<div className="truncate text-[10px] text-white/50">{user.email}</div>)}
                </div>
              </div>
            </button>
            {profileOpen && (
              <Portal>
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} aria-hidden="true" />
                  <div className="fixed z-50" style={{ top: menuPos.top, left: menuPos.left }}>
                    <div ref={menuRef} className="w-64 rounded-2xl border border-white/20 bg-white/10 backdrop-blur-xl shadow-xl ring-1 ring-white/10 menu-pop text-white">
                      <div className="flex items-center gap-2 px-3 py-3 border-b border-white/10 rounded-t-2xl">
                        <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold text-white">
                          {(user?.name?.[0] || user?.email?.[0] || 'U')?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{user?.name || 'Usuario'}</div>
                          {user?.email && (<div className="truncate text-xs text-white/70">{user.email}</div>)}
                        </div>
                      </div>
                      <div className="py-1">
                        <Link href="/account" onClick={() => { setIsNavigating(true); setProfileOpen(false); }} className="block px-3 py-2 text-sm hover:bg-white/10">{t('myAccount')}</Link>
                        <Link href="/billing" onClick={() => { setIsNavigating(true); setProfileOpen(false); }} className="block px-3 py-2 text-sm hover:bg-white/10">{t('billing')}</Link>
                        <div className="px-3 py-2">
                          <LogoutButton className="w-full rounded-md border border-white/10 px-3 py-2 text-sm hover:bg-white/10" />
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              </Portal>
            )}
          </div>
        </aside>
        </div>

        <main className="h-full overflow-hidden min-h-0">
          <div className="relative flex flex-col h-full text-white">
            <div className={`fixed top-0 left-0 right-0 md:sticky md:top-0 z-30 flex items-center justify-between gap-4 px-4 py-3 md:px-8 md:py-4 shrink-0 transition-all duration-700 ${headerScrolled ? 'bg-black/20 backdrop-blur-3xl border-b border-white/5 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)]' : 'bg-transparent border-b border-transparent'}`}>
              <div className="flex items-center gap-3">
                <button
                    id="mobile-menu-btn"
                    type="button"
                    aria-label={hidden ? 'Mostrar barra lateral' : 'Ocultar barra lateral'}
                    onClick={() => {
                      try {
                        const mq = window.matchMedia('(min-width: 768px)');
                        if (mq.matches) setHidden(v => !v);
                        else setMobileOpen(true);
                      } catch {
                        setHidden(v => !v);
                      }
                    }}
                    className="inline-flex items-center justify-center rounded-full h-10 w-10 text-white/70 hover:bg-white/10 hover:text-white ring-1 ring-white/20 transition-all duration-200 md:hidden"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                  </button>
                <div className="hidden md:block">
                  <ProfileSwitcher />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <NotificationsMenu />
              </div>
            </div>
            <div id="main-scroll-container" ref={scrollRef} data-lenis-prevent className="overflow-y-auto w-full p-4 pt-20 pb-24 md:p-6 md:pt-6 md:pb-0 min-h-0 flex-1">
              <RealtimeRefresh />
              {children}
            </div>
          </div>
        </main>
      </div>

      {mobileOpen && (
        <Portal>
          <>
            <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" aria-hidden="true" onClick={() => setMobileOpen(false)} />
            <div className="fixed inset-y-4 left-4 z-50 h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[300px] bg-white/10 p-4 shadow-2xl border border-white/20 rounded-[32px] backdrop-blur-2xl flex flex-col text-white" role="dialog" aria-modal="true">
              <div className="mb-3 flex items-center justify-between">
                <Link href={landingHref} aria-label="Ir a la landing" onClick={() => setMobileOpen(false)}>
                  <Image src="/logo.png" width={160} height={60} alt="ContaPRO" className="h-12 w-auto object-contain brightness-200 contrast-125" unoptimized />
                </Link>
                <button 
                  type="button" 
                  aria-label="Cerrar menú" 
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 hover:bg-white/10 hover:scale-95 active:scale-90 transition-all duration-200" 
                  onClick={() => setMobileOpen(false)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <div className="mb-1 px-1 text-xs font-playfair font-medium text-white/50">Plataforma</div>
                <SidebarNav onNavigate={() => { setIsNavigating(true); setMobileOpen(false); }} mobileOnly hideAccount />
              </div>
              <div className="mt-3 space-y-2 px-1">
                <div className="text-xs font-playfair font-medium text-white/50">Cuenta</div>
                <button 
                  type="button"
                  onClick={() => setMobileProfileOpen(!mobileProfileOpen)}
                  className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 p-2 text-left hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
                      <span className="text-sm font-semibold">{(user?.name?.[0] || user?.email?.[0] || 'U')?.toUpperCase()}</span>
                    </div>
                    <div className="min-w-0 text-left">
                      <div className="truncate text-sm font-medium">{user?.name || user?.email || 'Usuario'}</div>
                      {user?.email && (<div className="truncate text-xs text-white/70">{user.email}</div>)}
                    </div>
                  </div>
                </button>
                {mobileProfileOpen && (
                  <div className="mt-2 w-full rounded-2xl border border-white/20 bg-white/10 backdrop-blur-xl shadow-sm overflow-hidden text-white">
                    <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
                        <span className="text-sm font-semibold">{user?.name ? user.name.charAt(0).toUpperCase() : 'U'}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{user?.name || 'Usuario'}</div>
                        {user?.email && (<div className="truncate text-xs text-white/70">{user.email}</div>)}
                      </div>
                    </div>
                    <div className="py-1">
                      <Link href="/account" onClick={() => { setIsNavigating(true); setMobileOpen(false); setMobileProfileOpen(false); }} className="block px-3 py-2 text-sm hover:bg-white/10">{t('myAccount')}</Link>
                      <Link href="/billing" onClick={() => { setIsNavigating(true); setMobileOpen(false); setMobileProfileOpen(false); }} className="block px-3 py-2 text-sm hover:bg-white/10">{t('billing')}</Link>
                      <div className="px-3 py-2">
                        <LogoutButton className="w-full rounded-md border border-white/10 px-3 py-2 text-sm hover:bg-white/10" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        </Portal>
      )}

      {isNavigating && (
        <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center">
          <div className="flex items-end gap-1">
            <div className="h-3 w-3 rounded-sm bg-white animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="h-3 w-3 rounded-sm bg-white animate-bounce" style={{ animationDelay: '120ms' }} />
            <div className="h-3 w-3 rounded-sm bg-white animate-bounce" style={{ animationDelay: '240ms' }} />
          </div>
        </div>
      )}

      <InteractiveTutorial plan={user?.plan} tutorialSeen={tutorialSeen} />
      <MobileActionBar onNavigate={() => setIsNavigating(true)} />
    </div>
  );
}