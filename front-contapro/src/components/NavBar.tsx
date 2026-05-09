"use client";
import {Link} from "@/i18n/routing";
import { useEffect, useState } from "react";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import { Button } from "@/components/ui/button";

export default function NavBar() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      try { setScrolled(window.scrollY > 0); } catch {}
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header className={`sticky top-0 z-50 w-full ${scrolled ? 'border-b border-border bg-card/80 backdrop-blur-[10px] shadow-sm' : ''} transition-[background,backdrop-filter] duration-200 ease-in-out`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold text-primary">
            ContaPRO
          </Link>
          <nav className="hidden md:block">
            <NavigationMenu>
              <NavigationMenuList>
                <NavigationMenuItem>
                  <NavigationMenuLink href="/">Dashboard</NavigationMenuLink>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <NavigationMenuLink href="/upload">Subir</NavigationMenuLink>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Link className="text-sm text-muted-foreground hover:text-foreground" href="/login">Entrar</Link>
          <Link href="/register">
            <Button size="sm">Crear cuenta</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}