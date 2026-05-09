"use client";
import {Link, usePathname} from "@/i18n/routing";
import { useState } from "react";
import Portal from "@/components/Portal";
import Image from "next/image";
import { LayoutDashboard, Wallet, PiggyBank, ChevronDown, Target, Sparkles } from "lucide-react";
import { useTranslations } from 'next-intl';

export default function MobileActionBar({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations('Sidebar');
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const budgetActive = isActive("/budget");

  const itemBase =
    "flex flex-col items-center justify-center gap-1 text-[10px] leading-tight font-playfair font-bold h-12";


  return (
    <nav className="md:hidden fixed bottom-6 left-0 right-0 mx-auto z-30 w-[calc(100%-2.5rem)] max-w-md rounded-full border border-white/20 bg-white/10 backdrop-blur-2xl shadow-2xl p-2 px-1 text-white">
      <ul className="grid grid-cols-5 items-center">
        <li>
          <Link id="mobile-nav-dashboard" href="/dashboard" onClick={() => onNavigate?.()} className={`${itemBase} ${isActive("/dashboard") ? "text-white" : "text-white/50"}`}>
            <LayoutDashboard className={`h-5 w-5 ${isActive("/dashboard") ? "text-white" : "text-white/50"}`} />
            <span>{t('summary')}</span>
          </Link>
        </li>
        <li>
          <Link id="mobile-nav-expenses" href="/expenses" onClick={() => onNavigate?.()} className={`${itemBase} ${isActive("/expenses") ? "text-white" : "text-white/50"}`}>
            <Wallet className={`h-5 w-5 ${isActive("/expenses") ? "text-white" : "text-white/50"}`} />
            <span>{t('expenses')}</span>
          </Link>
        </li>
        <li>
          <Link id="mobile-nav-chat" href="/chat" onClick={() => onNavigate?.()} className="flex items-center justify-center group h-12">
            <div className={`relative h-11 w-11 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 p-0.5 shadow-lg border border-white/20 transition-transform duration-300 group-hover:scale-110 active:scale-95 ${isActive("/chat") ? "scale-105 border-white/40" : ""}`}>
              <div className="relative h-full w-full rounded-full overflow-hidden bg-black/20 backdrop-blur-sm">
                <Image 
                  src="/pricing-plan-icon.png" 
                  alt="ContaPRO" 
                  fill 
                  className="object-contain p-1.5"
                />
              </div>
            </div>
          </Link>
        </li>
        <li>
          <Link id="mobile-nav-savings" href="/savings" onClick={() => onNavigate?.()} className={`${itemBase} ${isActive("/savings") ? "text-white" : "text-white/50"}`}>
            <Target className={`h-5 w-5 ${isActive("/savings") ? "text-white" : "text-white/50"}`} />
            <span>{t('savings')}</span>
          </Link>
        </li>
        <li>
          <Link id="mobile-nav-budget" href="/budget" onClick={() => onNavigate?.()} className={`${itemBase} ${budgetActive ? "text-white" : "text-white/50"}`}>
            <PiggyBank className={`h-5 w-5 ${budgetActive ? "text-white" : "text-white/50"}`} />
            <span>{t('budgetShort')}</span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}
