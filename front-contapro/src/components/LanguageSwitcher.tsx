"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";
import { useTransition, useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe, ChevronDown } from "lucide-react";

export default function LanguageSwitcher() {
  const [mounted, setMounted] = useState(false);
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setMounted(true);
  }, []);

  const labels: Record<string, string> = {
    es: "Español",
    en: "English",
    pt: "Português"
  };

  if (!mounted) {
    return (
      <div className="w-[140px] flex items-center justify-between bg-transparent border-none px-3 py-2 text-zinc-400">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4" />
          <span className="text-sm">{labels[locale] || 'Idioma'}</span>
        </div>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </div>
    );
  }

  const onSelectChange = (nextLocale: string) => {
    startTransition(() => {
      router.replace(pathname, { locale: nextLocale, scroll: false });
    });
  };

  return (
    <Select value={locale} onValueChange={onSelectChange} disabled={isPending}>
      <SelectTrigger className="w-[140px] bg-transparent border-none focus:ring-0 focus:ring-offset-0 text-zinc-400 hover:text-white transition-colors">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4" />
          <SelectValue placeholder="Idioma" />
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="es">Español</SelectItem>
        <SelectItem value="en">English</SelectItem>
        <SelectItem value="pt">Português</SelectItem>
      </SelectContent>
    </Select>
  );
}
