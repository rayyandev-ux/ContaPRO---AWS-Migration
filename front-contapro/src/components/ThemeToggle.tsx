"use client";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";

export default function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggle = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label={
        mounted
          ? isDark
            ? "Cambiar a tema claro"
            : "Cambiar a tema oscuro"
          : "Cambiar tema"
      }
      onClick={toggle}
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted ring-1 ring-border transition-all active:scale-95"
      suppressHydrationWarning
    >
      {mounted ? (
        isDark ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )
      ) : (
        <Moon className="h-4 w-4 opacity-0" />
      )}
      <span className="hidden sm:inline">
        {mounted ? (isDark ? "Claro" : "Oscuro") : "Tema"}
      </span>
    </button>
  );
}
