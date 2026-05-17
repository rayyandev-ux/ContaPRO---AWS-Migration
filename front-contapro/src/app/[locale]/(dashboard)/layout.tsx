"use client";

import { ReactNode, useEffect, useState } from "react";
import DashboardShell from "./_components/DashboardShell";
import SubscriptionGuard from "./_components/SubscriptionGuard";
import Aurora from "@/components/Aurora";
import { apiJson } from "@/lib/api";
import { Loader2 } from "lucide-react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ name?: string | null; email?: string | null; plan?: string; planExpires?: string; trialEnds?: string } | undefined>(undefined);
  const [tutorialSeen, setTutorialSeen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await apiJson("/api/auth/me");
        if (res.ok && res.data) {
          const data = res.data;
          setUser({ 
            name: data?.user?.name ?? null, 
            email: data?.user?.email ?? null,
            plan: data?.user?.plan,
            planExpires: data?.user?.planExpires,
            trialEnds: data?.user?.trialEnds
          });
          setTutorialSeen(data?.user?.tutorialSeen === true);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, []);

  if (loading) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-black">
        <Loader2 className="w-10 h-10 animate-spin text-white/50" />
      </div>
    );
  }

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden font-stack-sans hero-dark bg-black">
      {/* Background Aurora */}
      <div className="fixed inset-0 z-0 w-full h-full pointer-events-none">
        <Aurora 
          colorStops={["#5a0a70","#eaeaeb"]} 
          amplitude={0.2} 
          blend={0.7} 
        />
      </div>

      <div className="relative z-10 w-full h-full">
        <SubscriptionGuard user={user ? { ...user, name: user.name ?? undefined, email: user.email ?? undefined } : null}>
          <DashboardShell user={user} tutorialSeen={tutorialSeen}>{children}</DashboardShell>
        </SubscriptionGuard>
      </div>
    </div>
  );
}