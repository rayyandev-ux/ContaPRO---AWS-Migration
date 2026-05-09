import { cookies } from "next/headers";
import { ReactNode } from "react";
import DashboardShell from "./_components/DashboardShell";
import SubscriptionGuard from "./_components/SubscriptionGuard";
import Aurora from "@/components/Aurora";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ");
  let user: { name?: string | null; email?: string | null; plan?: string; planExpires?: string; trialEnds?: string } | undefined;
  let tutorialSeen = false;
  try {
    const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
    const res = await fetch(`${BASE}/api/auth/me`, {
      headers: { cookie: cookieHeader },
      next: { revalidate: 0, tags: ['auth-me'] }, // Ensure fresh data for subscription checks
    });
    if (res.ok) {
      const data = await res.json();
      user = { 
        name: data?.user?.name ?? null, 
        email: data?.user?.email ?? null,
        plan: data?.user?.plan,
        planExpires: data?.user?.planExpires,
        trialEnds: data?.user?.trialEnds
      };
      tutorialSeen = data?.user?.tutorialSeen === true;
    }
  } catch {}

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