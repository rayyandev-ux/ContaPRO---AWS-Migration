"use client";
import {Link} from "@/i18n/routing";
import { useTranslations } from "next-intl";
import LanguageSwitcher from "./LanguageSwitcher";
import {
  BadgeCheck,
  BarChart3,
  BookOpen,
  Boxes,
  Files,
  FolderClosed,
  HelpCircle,
  LayoutDashboard,
  Search,
  Settings,
  Users,
} from "lucide-react";

function NavItem({ href, label, icon: Icon, active = false }: { href: string; label: string; icon: any; active?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
        active ? "bg-black text-white" : "text-gray-700 hover:bg-gray-100"
      }`}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </Link>
  );
}

export default function Sidebar() {
  const t = useTranslations('Sidebar');
  return (
    <aside className="h-screen w-64 border-r bg-white flex flex-col">
      <div className="h-14 flex items-center px-4 font-semibold">ContaPRO</div>
      <div className="px-2 space-y-2">
        <NavItem href="#" label={t('quickCreate')} icon={BadgeCheck} active />
        <NavItem href="/dashboard" label={t('dashboard')} icon={LayoutDashboard} />
        <NavItem href="#" label={t('lifecycle')} icon={Boxes} />
        <NavItem href="#" label={t('analytics')} icon={BarChart3} />
        <NavItem href="#" label={t('projects')} icon={FolderClosed} />
        <NavItem href="#" label={t('team')} icon={Users} />
      </div>
      <div className="mt-6 px-4 text-xs font-medium text-gray-500">{t('documents')}</div>
      <div className="px-2 space-y-2 mt-2">
        <NavItem href="#" label={t('dataLibrary')} icon={BookOpen} />
        <NavItem href="#" label={t('reports')} icon={Files} />
        <NavItem href="#" label={t('wordAssistant')} icon={Search} />
        <NavItem href="#" label={t('more')} icon={FolderClosed} />
      </div>
      <div className="mt-auto px-2 space-y-2 mb-3">
        <NavItem href="#" label={t('settings')} icon={Settings} />
        <NavItem href="#" label={t('getHelp')} icon={HelpCircle} />
        <div className="px-3 py-2">
          <LanguageSwitcher />
        </div>
      </div>
    </aside>
  );
}