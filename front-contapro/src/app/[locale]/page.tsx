import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { HeroSection } from "@/components/landing/HeroSection";
import { ProblemGravity } from "@/components/landing/ProblemGravity";
import { SolutionSection } from "@/components/landing/SolutionSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { CTASection } from "@/components/landing/CTASection";
import type { Metadata } from "next";

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    alternates: {
      canonical: `/${locale}`,
      languages: {
        'es': '/es',
        'en': '/en',
        'pt': '/pt',
      },
    },
  };
}

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col bg-black text-foreground">
      <SiteHeader />
      <div className="flex-1">
        <HeroSection />
        <ProblemGravity />
        <SolutionSection />
        <PricingSection />
        <CTASection />
      </div>
      <SiteFooter />
    </main>
  );
}
