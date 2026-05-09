"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function LogoutButton({ className }: { className?: string }) {
  const [loading, setLoading] = useState(false);

  const onClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await fetch("/api/logout", { method: "POST" });
      window.location.href = "/login";
    } catch (e) {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={onClick}
      disabled={loading}
      variant="ghost"
      size="sm"
      className={`w-full justify-start gap-2 hover:bg-red-500/10 hover:text-red-400 text-white/80 transition-colors ${className || ""}`}
    >
      {loading ? "Cerrando sesión..." : "Cerrar sesión"}
    </Button>
  );
}