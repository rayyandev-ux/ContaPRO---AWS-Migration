import OnboardingChat from "../register/OnboardingChat";
import { getTranslations } from "next-intl/server";
import Aurora from "@/components/Aurora";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });
  return {
    title: t('onboarding'),
  };
}

export default function OnboardingPage() {
  return (
    <div className="relative h-[100dvh] w-full overflow-hidden font-stack-sans hero-dark bg-black flex flex-col md:p-4">
      {/* Background gradients */}
      <div className="fixed inset-0 z-0 w-full h-full pointer-events-none">
        <Aurora 
          colorStops={["#5a0a70","#eaeaeb"]} 
          amplitude={0.2} 
          blend={0.7} 
        />
      </div>

      <div className="w-full h-full max-w-5xl mx-auto relative z-10 flex flex-col">
        <OnboardingChat />
      </div>
    </div>
  );
}