"use client";
import { useState } from "react";
import { Link } from "@/i18n/routing";
import LogoutButton from "@/components/logout-button";
import { User as UserIcon, ChevronDown } from "lucide-react";

type UserInfo = {
  name?: string | null;
  email?: string | null;
};

export default function UserDropdown({ user }: { user?: UserInfo }) {
  const [open, setOpen] = useState(false);
  const label = (user?.name && user.name.trim()) || (user?.email || "Usuario");

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-1.5 text-sm text-foreground shadow-sm ring-1 ring-border hover:bg-muted transition-all active:scale-95"
      >
        <UserIcon className="h-4 w-4 text-muted-foreground" />
        <span className="hidden sm:inline max-w-[12rem] truncate">{label}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-56 rounded-md border bg-card p-2 text-sm shadow-lg ring-1 ring-border"
          >
            <div className="px-2 py-1 text-xs text-muted-foreground">Conectado como</div>
            <div className="px-2 py-1 font-medium truncate">{label}</div>
            <div className="my-2 h-px bg-border" />
            <Link href="/account" className="block rounded-md px-3 py-2 hover:bg-muted" onClick={() => setOpen(false)}>
              Cuenta
            </Link>
            <div className="my-2 h-px bg-border" />
            <div className="px-2 py-1">
              <LogoutButton />
            </div>
          </div>
        </>
      )}
    </div>
  );
}