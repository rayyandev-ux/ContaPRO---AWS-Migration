"use client";

import {Link, usePathname, useRouter} from "@/i18n/routing";
import { useState } from "react";
import Image from "next/image";
import { useTranslations, useLocale } from 'next-intl';
import {
  LayoutDashboard,
  Upload,
  Wallet,
  PiggyBank,
  Puzzle,
  User,
  ChevronDown,
  MessageCircle,
  Send,
  CalendarDays,
  Tag,
  CreditCard,
  Target,
  Mail,
  Layers,
  Sparkles,
} from "lucide-react";

type Props = {
  onNavigate?: () => void;
  mobileOnly?: boolean;
  hideAccount?: boolean;
};

type NavItem = {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
};

function getNavId(href: string) {
  if (href === '/dashboard') return 'nav-dashboard';
  if (href === '/chat') return 'nav-chat';
  if (href === '/transactions') return 'nav-transactions';
  if (href === '/budget') return 'nav-budget';
  if (href === '/savings') return 'nav-savings';
  if (href === '/account') return 'nav-account';
  if (href === '/payment-methods') return 'nav-payment-methods';
  if (href === '/integrations') return 'nav-integrations';
  return undefined;
}

export default function SidebarNav({ onNavigate, mobileOnly, hideAccount, isCollapsed = false }: Props & { isCollapsed?: boolean }) {
  const t = useTranslations('Sidebar');
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  
  const items: NavItem[] = [
    { href: "/chat", label: "ContaPRO", Icon: Sparkles },
    { href: "/dashboard", label: t('summary'), Icon: LayoutDashboard },
    { href: "/transactions", label: "Transacciones", Icon: Wallet },
    { href: "/categories", label: t('categories'), Icon: Layers },
    { href: "/payment-methods", label: t('paymentMethods'), Icon: CreditCard },
    { href: "/budget", label: t('budget'), Icon: PiggyBank },
    { href: "/savings", label: t('savings'), Icon: Target },
    { href: "/integrations", label: t('integrations'), Icon: Puzzle },
  ];

  const isBudgetActive = pathname === "/budget";
  const isIntegrationsActive = pathname === "/integrations" || pathname.startsWith("/integrations/");
  const [openIntegrations, setOpenIntegrations] = useState(isIntegrationsActive);
  let list = items;
  if (mobileOnly) {
    list = list.filter((i) => i.href === '/integrations' || i.href === '/account' || i.href === '/payment-methods' || i.href === '/categories');
  }
  if (hideAccount) {
    list = list.filter((i) => i.href !== '/account');
  }

  return (
    <nav className={`text-base flex-1 flex flex-col ${mobileOnly ? '' : 'h-full'}`}>
      <ul className={`flex flex-col gap-1 ${mobileOnly ? 'mt-2' : 'flex-1 justify-evenly'}`}>
        {list.map(({ href, label, Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          const isChat = href === "/chat";
          const base =
            `group flex items-center gap-4 px-4 py-4 rounded-full transition-all duration-300 active:scale-95 relative ${isCollapsed ? 'justify-center w-[56px] h-[56px] mx-auto px-0' : ''}`;
          
          let active = "bg-white/10 text-white font-medium shadow-sm border border-white/10";
          let inactive = "text-white/50 hover:bg-white/5 hover:text-white border border-transparent";
          
          if (isChat) {
            // Special styling for the ContaPRO chat button to match the image
            active = "bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-white font-medium shadow-md border border-indigo-500/30";
            inactive = "text-white/80 hover:bg-white/5 border border-transparent";
          }
          const navId = getNavId(href);
          


          if (href === "/integrations") {
            return (
              <li key={href} className="relative flex-1 flex flex-col justify-center">
                <button id={navId} type="button" onClick={() => setOpenIntegrations((o) => !o)} className={`${base} ${isIntegrationsActive ? active : inactive} w-full text-left`} title={isCollapsed ? label : undefined}>
                  <Icon className={`shrink-0 transition-colors duration-300 ${isCollapsed ? 'h-7 w-7' : 'h-6 w-6'} ${isIntegrationsActive ? "text-white" : "text-white/50 group-hover:text-white"}`} />
                  {!isCollapsed && <span className="flex-1 font-playfair font-medium text-[15px]">{label}</span>}
                  {!isCollapsed && <ChevronDown className={`h-5 w-5 shrink-0 ${isIntegrationsActive ? "text-white" : "text-white/50 group-hover:text-white"} transition-transform ${openIntegrations ? "rotate-180" : "rotate-0"}`} />}
                </button>
                {openIntegrations && !isCollapsed && (
                  <ul className="mt-1 ml-10 flex flex-col gap-1 relative before:absolute before:left-[-12px] before:top-2 before:bottom-2 before:w-px before:bg-white/10">
                    <li>
                      <Link id="nav-integrations-emails" href="/integrations/emails" scroll={false} onClick={() => { setOpenIntegrations(false); onNavigate?.(); }} className="group flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-150 active:scale-95 text-sidebar-foreground hover:bg-muted">
                        <Mail className="h-4 w-4 text-sidebar-foreground/70 group-hover:text-sidebar-foreground" />
                        <span className="flex-1 font-playfair font-semibold text-[15px]">Emails</span>
                      </Link>
                    </li>
                    <li>
                      <Link id="nav-integrations-whatsapp" href="/integrations/whatsapp" scroll={false} onClick={() => { setOpenIntegrations(false); onNavigate?.(); }} className="group flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-150 active:scale-95 text-sidebar-foreground hover:bg-muted">
                        <MessageCircle className="h-4 w-4 text-sidebar-foreground/70 group-hover:text-sidebar-foreground" />
                        <span className="flex-1 font-playfair font-semibold text-[15px]">{t('whatsapp')}</span>
                      </Link>
                    </li>
                    <li>
                      <Link id="nav-integrations-telegram" href="/integrations/telegram" scroll={false} onClick={() => { setOpenIntegrations(false); onNavigate?.(); }} className="group flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-150 active:scale-95 text-sidebar-foreground hover:bg-muted">
                        <Send className="h-4 w-4 text-sidebar-foreground/70 group-hover:text-sidebar-foreground" />
                        <span className="flex-1 font-playfair font-semibold text-[15px]">{t('telegram')}</span>
                      </Link>
                    </li>
                  </ul>
                )}
              </li>
            );
          }
          return (
            <li key={href} className="relative flex-1 flex flex-col justify-center">
              <Link
                href={href}
                id={navId}
                scroll={false}
                onClick={() => onNavigate?.()}
                className={`${base} ${isActive ? active : inactive} ${isCollapsed ? 'hover:bg-white/10' : ''}`}
                title={isCollapsed ? label : undefined}
              >
                {isChat ? (
                  <div className={`relative shrink-0 flex items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-600/20 shadow-lg shadow-purple-500/10 transition-all duration-300 ${isCollapsed ? 'h-10 w-10' : 'h-8 w-8'}`}>
                    <Image src="/pricing-plan-icon.png" alt="ContaPRO Chat" fill className="object-contain p-[3px] drop-shadow-[0_0_5px_rgba(139,92,246,0.5)]" />
                  </div>
                ) : (
                  <Icon
                    className={`shrink-0 transition-colors duration-300 ${isCollapsed ? 'h-7 w-7' : 'h-6 w-6'} ${
                      isActive
                        ? "text-white"
                        : "text-white/50 group-hover:text-white"
                    }`}
                  />
                )}
                {!isCollapsed && (
                  <span className={`flex-1 font-playfair font-bold text-[16px] ${isChat && !isActive ? 'text-white font-bold' : ''}`}>
                    {label}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
      
      <div className={`mt-6 pt-4 border-t border-white/10 transition-all duration-300 ${isCollapsed ? 'px-0 flex justify-center' : 'px-3'}`}>
        {!isCollapsed && <p className="text-[10px] uppercase text-white/50 font-bold tracking-wider mb-3 pl-1">Language / Idioma</p>}
        <div className={`flex ${isCollapsed ? 'flex-col gap-2' : 'gap-2'}`}>
          {['es', 'en', 'pt'].map((l) => (
            <button
                key={l}
                onClick={() => router.replace(pathname, { locale: l, scroll: false })}
                className={`text-xs px-2.5 py-1.5 rounded-full border transition-all duration-300 active:scale-95 ${
                  locale === l
                    ? "bg-white/10 text-white border-white/20 font-medium shadow-sm"
                    : "bg-transparent text-white/50 border-transparent hover:bg-white/5 hover:text-white"
                } ${isCollapsed ? 'w-[52px] h-[52px] flex items-center justify-center p-0' : ''}`}
                title={isCollapsed ? l.toUpperCase() : undefined}
              >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
