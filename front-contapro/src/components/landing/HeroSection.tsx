"use client";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/routing";
import Image from "next/image";
import { ArrowRight, Bot } from "lucide-react";
import DarkVeil from '@/components/DarkVeil';
import BlurText from '@/components/BlurText';
import { PricingSparkles } from "@/components/PricingSparkles";
import ShinyText from '@/components/ShinyText';
import { useAuth } from '@/hooks/use-auth';
import { useTranslations } from 'next-intl';


import { useMediaQuery } from '@/hooks/use-media-query';

export function HeroSection() {
  const { isAuthenticated } = useAuth();
  const t = useTranslations('HeroSection');
  const isDesktop = useMediaQuery("(min-width: 768px)");
  
  return (
    <section 
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-16 pb-24 md:pt-20 md:pb-48 z-50"
      style={{ borderBottomLeftRadius: '50% 100px', borderBottomRightRadius: '50% 100px' }}
    >
      {/* Background Elements */}
      <div className="absolute inset-0 z-0">
         {/* Show DarkVeil only on medium screens and up */}
         {isDesktop ? (
           <div className="w-full h-full">
              <DarkVeil />
           </div>
         ) : (
           /* Fallback gradient for mobile */
           <div className="w-full h-full bg-gradient-to-b from-black via-slate-950 to-black" />
         )}
      </div>

      {/* Floating 3D Images - Only animate complex movement on desktop */}
      {isDesktop && (
        <>
          <motion.div
            className="absolute top-[15%] left-[5%] w-24 h-24 md:w-32 md:h-32 cursor-pointer z-0"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 0.8, scale: 1 }}
            whileHover={{ scale: 1.2, rotate: 15 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
          >
            <motion.div
              className="w-full h-full"
              animate={{ 
                y: [0, -20, 0], 
                rotate: [0, 10, 0] 
              }}
              transition={{ 
                duration: 6, 
                repeat: Infinity, 
                ease: "easeInOut" 
              }}
            >
              <Image 
                src="/espiral.png" 
                alt="Spiral 3D" 
                width={150} 
                height={150} 
                className="object-contain"
              />
            </motion.div>
          </motion.div>

          <motion.div
            className="absolute bottom-[20%] right-[5%] w-40 h-40 cursor-pointer z-0"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 0.8, scale: 1 }}
            whileHover={{ scale: 1.2, rotate: -15 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.4 }}
          >
            <motion.div
              className="w-full h-full"
              animate={{ 
                y: [0, 20, 0], 
                rotate: [0, -15, 0] 
              }}
              transition={{ 
                duration: 7, 
                repeat: Infinity, 
                ease: "easeInOut",
                delay: 1
              }}
            >
              <Image 
                src="/anillo.png" 
                alt="Ring 3D" 
                width={180} 
                height={180} 
                className="object-contain"
              />
            </motion.div>
          </motion.div>
        </>
      )}

      {/* Chaos Tags Animation (Background) - Removed */}

      <div className="container mx-auto relative z-10 px-4 text-center flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.1, rotate: 5 }}
          transition={{ duration: 0.5 }}
          className="mb-4 md:mb-6 relative w-36 h-36 md:w-64 md:h-64 cursor-pointer"
        >
           <Image 
            src="/pricing-plan-icon.png" 
            alt="ContaPRO Logo" 
            fill
            className="object-contain"
            priority
          />
        </motion.div>

        <h1 
          className="text-3xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-4 md:mb-6 max-w-4xl text-white flex flex-col items-center"
        >
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 items-baseline">
            <BlurText 
              text={t('from')}
              className="text-white font-playfair"
              delay={150}
              animateBy="words"
              direction="top"
            />
            <BlurText 
              text={t('financialChaos')}
              className="text-purple-300/90 font-playfair  decoration-red-300/50 decoration-4"
              delay={150}
              animateBy="words"
              direction="top"
            />
            <BlurText 
              text={t('to')}
              className="text-white font-playfair"
              delay={150}
              animateBy="words"
              direction="top"
            />
          </div>
           
           <BlurText 
            text={t('totalClarity')}
            className="text-purple-400 font-italika uppercase"
            delay={150}
            animateBy="words"
            direction="top"
          />
        </h1>

        <motion.p 
          className="text-base md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 md:mb-10 px-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          <ShinyText 
            text={t('description')}
            disabled={false} 
            speed={5} 
            className="italic"
          />
        </motion.p>

        <motion.div 
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <Button 
            size="lg" 
            className="h-12 md:h-14 px-6 md:px-8 text-base md:text-lg rounded-full relative group overflow-visible bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-sm transition-all shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)] hover:shadow-[0_0_25px_-5px_rgba(255,255,255,0.4)]" 
            asChild
          >
            <Link href="/register">
              <PricingSparkles color="text-white" />
              <span className="relative z-10 flex items-center">
                {t('startFree')} <ArrowRight className="ml-2 h-5 w-5" />
              </span>
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}

