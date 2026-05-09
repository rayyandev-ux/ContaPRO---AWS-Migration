'use client';
import {Link} from '@/i18n/routing';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Menu, X, ChevronRight } from 'lucide-react';
import Portal from '@/components/Portal';
import ThemeToggle from '@/components/ThemeToggle';
import NotificationsMenu from '@/components/NotificationsMenu';

export default function MobileNav({ dashboardHref, showThemeToggle = true, onLogout }: { dashboardHref: string; showThemeToggle?: boolean; onLogout?: () => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      const headers = document.querySelectorAll('header');
      headers.forEach(h => {
        const el = h as HTMLElement;
        if (open) {
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
        } else {
          el.style.opacity = '';
          el.style.pointerEvents = '';
        }
      });
      document.body.style.overflow = open ? 'hidden' : '';
    } catch {}
  }, [open]);
  return (
    <div className="md:hidden flex items-center justify-between p-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Abrir menú"
          className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground rounded-full transition-all active:scale-95 p-1"
          onClick={() => setOpen(true)}
        >
          <Menu className="h-6 w-6" strokeWidth={2.5} />
        </button>
        <Link href="/dashboard" className="font-semibold text-lg tracking-tight">
          ContaPRO
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <NotificationsMenu />
      </div>

      {open && (
        <Portal>
          <>
            <div className="fixed inset-0 z-[10000] h-screen w-screen overflow-y-auto bg-black p-4 shadow-xl ring-1 ring-border" role="dialog" aria-modal="true">
              <div className="flex items-center justify-between">
                <Link href="/" aria-label="Ir a la landing" onClick={() => setOpen(false)}>
                  <Image src="/logo.png" alt="ContaPRO" width={120} height={40} className="h-6 w-auto object-contain" unoptimized />
                </Link>
                <button
                  type="button"
                  aria-label="Cerrar menú"
                  className="inline-flex items-center justify-center p-2 text-muted-foreground hover:opacity-80 rounded-full transition-all active:scale-95"
                  onClick={() => setOpen(false)}
                >
                  <X className="h-6 w-6" strokeWidth={2.5} />
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {dashboardHref === "/dashboard" ? (
                  <Link href="/dashboard" className="block h-10 rounded-full transition-all active:scale-95 bg-muted text-foreground text-sm font-semibold text-center leading-10 hover:opacity-90" onClick={() => setOpen(false)}>
                    Ir al dashboard
                  </Link>
                ) : (
                  <>
                    <Link href="/login" className="block h-10 rounded-full transition-all active:scale-95 bg-muted text-foreground text-sm font-semibold text-center leading-10 hover:opacity-90" onClick={() => setOpen(false)}>
                      Ingresar
                    </Link>
                    <Link href="/register" className="block h-10 rounded-full transition-all active:scale-95 bg-white text-black text-sm font-semibold text-center leading-10 hover:opacity-90" onClick={() => setOpen(false)}>
                      Empieza gratis
                    </Link>
                  </>
                )}
              </div>
              <nav className="mt-6">
                <ul className="divide-y divide-border">
                  <li>
                    <Link href="/pricing" className="flex items-center justify-between px-1 py-3 text-sm" onClick={() => setOpen(false)}>
                      <span className="font-medium text-foreground">Planes y precios</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  </li>
                  <li>
                    <Link href="/contact" className="flex items-center justify-between px-1 py-3 text-sm" onClick={() => setOpen(false)}>
                      <span className="font-medium text-foreground">Contacto</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  </li>
                  <li>
                    <a href="#faq" className="flex items-center justify-between px-1 py-3 text-sm" onClick={() => setOpen(false)}>
                      <span className="font-medium text-foreground">Base de conocimientos</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </a>
                  </li>
                </ul>
              </nav>
            </div>
          </>
        </Portal>
      )}
    </div>
  );
}