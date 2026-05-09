"use client";
import { Reveal } from "@/components/Reveal";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/routing";
import { ArrowRight } from "lucide-react";
import { PricingSparkles } from "@/components/PricingSparkles";
import { useAuth } from "@/hooks/use-auth";
import { useTranslations } from "next-intl";

export function CTASection() {
  const { isAuthenticated } = useAuth();
  const t = useTranslations('CTASection');

  return (
    <section 
      className="relative pt-[150px] pb-[80px] md:pt-[300px] md:pb-[150px] overflow-visible bg-black -mt-[100px] md:-mt-[200px] z-30"
    >
      {/* Fondo Atmosférico */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1200px] h-[400px] md:h-[600px] bg-[radial-gradient(circle,rgba(124,58,237,0.15)_0%,rgba(0,0,0,0)_70%)] blur-[50px] md:blur-[80px]" />
        <div className="absolute -bottom-20 right-0 w-[400px] md:w-[800px] h-[400px] md:h-[600px] bg-[radial-gradient(circle,rgba(6,182,212,0.1)_0%,rgba(0,0,0,0)_70%)] blur-[60px] md:blur-[100px]" />
        <div className="absolute top-1/2 -left-20 -translate-y-1/2 w-[300px] md:w-[600px] h-[300px] md:h-[600px] bg-[radial-gradient(circle,rgba(76,29,149,0.1)_0%,rgba(0,0,0,0)_70%)] blur-[60px] md:blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-full h-[200px] md:h-[300px] bg-gradient-to-t from-violet-900/20 via-violet-900/5 to-transparent blur-2xl md:blur-3xl" />
      </div>

      <div className="container relative z-10 mx-auto px-4 text-center">
        <Reveal>
          <h2 className="text-3xl md:text-6xl font-bold font-playfair mb-4 md:mb-6 text-white tracking-tight drop-shadow-[0_0_25px_rgba(139,92,246,0.3)]">
            {t('title').split(' ').slice(0, 3).join(' ')} <br className="hidden md:block" />
            <span className="relative inline-block">
              {t('title').split(' ').slice(3).join(' ')}
              <div className="absolute inset-0 bg-violet-500/20 blur-xl -z-10 rounded-full" />
            </span>
          </h2>

          <p
            className="text-base md:text-xl text-slate-200/80 max-w-2xl mx-auto mb-8 md:mb-12 leading-relaxed drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] shiny-text italic"
            style={{ animationDuration: '5s' }}
          >
            {t('subtitle')}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 md:gap-6 pb-8 md:pb-12">
            <Button
              size="lg"
              className="
                w-full sm:w-auto h-14 md:h-16 rounded-full text-base font-medium tracking-wide transition-all duration-300 overflow-visible group relative px-8 md:px-10
                bg-gradient-to-b from-white/30 to-white/10 backdrop-blur-xl border border-white/20 text-white shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:bg-white/20 hover:shadow-[0_0_35px_rgba(255,255,255,0.5)]
              "
              asChild
            >
              <Link href={isAuthenticated ? "/dashboard" : "/register"}>
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-md" />
                <div className="absolute inset-0 rounded-full">
                  <PricingSparkles color="text-white" />
                </div>
                <span className="relative z-10 flex items-center">
                  {isAuthenticated ? t('goToDashboard') : t('createAccount')}
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-violet-200" />
                </span>
              </Link>
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}