"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { apiJson } from "@/lib/api";
import { UpgradePromptDialog } from "../../_components/UpgradePromptDialog";

export default function BuyExtraEmailButton() {
  const [upgradePromptOpen, setUpgradePromptOpen] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  
  const router = useRouter();

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const [meRes, subRes] = await Promise.all([
          apiJson("/api/auth/me", { cache: "no-store" }),
          apiJson("/api/payments/subscription", { cache: "no-store" })
        ]);
        if (meRes.ok) setUser(meRes.data.user);
        if (subRes.ok) setSubscriptionInfo(subRes.data.subscription);
      } catch (e) {
        console.error(e);
      }
    };
    fetchInfo();
  }, []);

  const isAnnual = subscriptionInfo?.interval === 'year' || user?.plan === 'ANNUAL';
  const resourcePrice = isAnnual ? '49.90' : '5.00';

  const isPremium = user?.plan === 'PREMIUM' && user?.planExpires && new Date(user.planExpires) > new Date();
  const isLifetime = user?.plan === 'LIFETIME';
  const hasTrial = user?.trialEnds && new Date(user.trialEnds) > new Date();
  const hasFullAccess = isPremium || isLifetime || hasTrial;

  return (
    <>
      <Button 
        onClick={() => {
          if (!hasFullAccess) {
            setUpgradePromptOpen(true);
            return;
          }
          router.push("/billing?action=buy_email");
        }} 
        className="rounded-full bg-white text-black font-medium hover:bg-white/90 transition-colors text-sm px-6 h-11 shadow-md"
      >
        <Plus className="h-4 w-4 mr-2" />
        <span>Añadir correo extra</span>
        <span className="ml-2 px-2 py-0.5 rounded-full bg-black/5 text-[10px] font-bold border border-black/5">S/ {resourcePrice}</span>
      </Button>

      <UpgradePromptDialog open={upgradePromptOpen} onOpenChange={setUpgradePromptOpen} />
    </>
  );
}
