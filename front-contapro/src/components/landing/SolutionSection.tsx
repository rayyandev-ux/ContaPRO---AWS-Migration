"use client";
import { motion, useScroll, useTransform, useSpring, AnimatePresence } from "framer-motion";
import { useRef, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { FeatureModal, Feature } from "./FeatureModal";

import { useTranslations } from 'next-intl';

import { useMediaQuery } from '@/hooks/use-media-query';

export function SolutionSection() {
  const t = useTranslations('SolutionSection');
  const containerRef = useRef<HTMLElement>(null);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const FEATURES: Feature[] = [
    {
      id: "chat",
      title: t('features.chat.title'),
      subtitle: t('features.chat.subtitle'),
      description: t('features.chat.description'),
      image: "/CHAT 3D.png",
      shadowColor: "rgba(147,51,234,0.3)",
      gradient: "radial-gradient(circle at center, rgba(147,51,234,0.2) 0%, transparent 70%)"
    },
    {
      id: "camera",
      title: t('features.camera.title'),
      subtitle: t('features.camera.subtitle'),
      description: t('features.camera.description'),
      image: "/CAMARA 3D.png",
      shadowColor: "rgba(147,51,234,0.2)",
      gradient: "radial-gradient(circle at center, rgba(147,51,234,0.15) 0%, transparent 70%)"
    },
    {
      id: "mic",
      title: t('features.mic.title'),
      subtitle: t('features.mic.subtitle'),
      description: t('features.mic.description'),
      image: "/MICROFONO 3D.png",
      shadowColor: "rgba(249,115,22,0.2)",
      gradient: "radial-gradient(circle at center, rgba(249,115,22,0.15) 0%, transparent 70%)"
    },
    {
      id: "chart",
      title: t('features.chart.title') || "Tu Balance",
      subtitle: t('features.chart.subtitle') || "Control total",
      description: t('features.chart.description') || "Visualiza tus finanzas en tiempo real...",
      image: "/GRAFICO 3D.png",
      shadowColor: "rgba(34,197,94,0.2)",
      gradient: "radial-gradient(circle at center, rgba(34,197,94,0.15) 0%, transparent 70%)"
    }
  ];

  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  
  // Track scroll progress relative to this section
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Desktop: smooth spring for cinematic feel
  // Mobile: use raw scroll progress — springs fight touch scrolling and cause lag
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  // Pick the right progress source based on device
  const progress = isDesktop ? smoothProgress : scrollYProgress;

  // --- Animation Phases ---
  
  // 1. Darkness / Overlay — opacity only (cheap)
  const darknessOpacity = useTransform(progress, [0, 0.2], [0.9, 0]);
  
  // 2. The Sun / Light Source
  // Desktop: full scale + position animation
  // Mobile: opacity-only (scale is very expensive on large elements)
  const sunScaleDesktop = useTransform(progress, [0, 0.3], [0.5, 3]);
  const sunOpacity = useTransform(progress, [0, 0.2], [0, 0.8]);
  const sunYDesktop = useTransform(progress, [0, 0.3], ["50%", "0%"]);

  // 3. Text Phase 1: "Cansado de la oscuridad?"
  const text1Opacity = useTransform(progress, [0, 0.05, 0.2, 0.25], [0, 1, 1, 0]);
  const text1Y = useTransform(progress, [0, 0.25], [20, -20]);

  // 4. Text Phase 2: "Aquí empieza tu tranquilidad"
  const text2Opacity = useTransform(progress, [0.25, 0.4], [0, 1]);
  const text2ScaleDesktop = useTransform(progress, [0.25, 0.4], [0.9, 1]);
  const text2Y = useTransform(progress, [0.5, 0.9], [0, -100]);
  
  // 5. The Content Grid (3D Elements)
  const gridOpacity = useTransform(progress, [0.35, 0.55], [0, 1]);
  const gridY = useTransform(progress, [0.35, 0.55], [30, 0]);
  
  return (
    <section 
      ref={containerRef}
      id="solution" 
      className="relative bg-black -mt-[60px] md:-mt-[100px] z-30"
      style={{ height: isDesktop ? '300vh' : '200vh' }}
    >
      {/* Sticky container */}
      <div className="sticky top-0 h-screen w-full flex flex-col items-center justify-center overflow-hidden pb-16 md:pb-32">
        
        {/* Background gradient — opacity only, very cheap */}
        <motion.div 
          className="absolute inset-0 z-0 bg-gradient-to-b from-purple-900/20 via-purple-900/10 to-black pointer-events-none"
          style={{ opacity: sunOpacity }}
        />

        {/* The "Sun" Light Source */}
        {isDesktop ? (
          /* Desktop: full cinematic scale + translate */
          <motion.div
            className="absolute left-1/2 bottom-0 -translate-x-1/2 w-[100vw] h-[50vh] max-w-[800px] pointer-events-none"
            style={{ 
              scale: sunScaleDesktop,
              opacity: sunOpacity,
              y: sunYDesktop,
              background: "radial-gradient(circle at bottom, rgba(255,255,255,0.8) 0%, rgba(168,85,247,0.4) 40%, transparent 80%)"
            }}
          />
        ) : (
          /* Mobile: opacity-only fade-in, no scale (huge perf win) */
          <motion.div
            className="absolute left-1/2 bottom-0 -translate-x-1/2 w-[100vw] h-[40vh] pointer-events-none"
            style={{ 
              opacity: sunOpacity,
              background: "radial-gradient(circle at bottom, rgba(255,255,255,0.6) 0%, rgba(168,85,247,0.3) 40%, transparent 80%)"
            }}
          />
        )}

        {/* Darkness Overlay — opacity only */}
        <motion.div 
          className="absolute inset-0 bg-black z-10 pointer-events-none"
          style={{ opacity: darknessOpacity }}
        />

        {/* Text Phase 1: The Problem/Question */}
        <motion.div 
          className="absolute z-20 text-center px-4 top-1/2 -translate-y-1/2 w-full"
          style={{ 
            opacity: text1Opacity, 
            y: text1Y,
          }}
        >
          <h2 className="text-3xl md:text-6xl font-bold text-white/80 tracking-tight">
            {t('tiredOfDisorder')}
          </h2>
          <p className="text-base md:text-xl text-white/50 mt-3 md:mt-4">{t('chaosEndsHere')}</p>
        </motion.div>

        {/* Text Phase 2: The Solution */}
        <motion.div 
          className="absolute z-20 text-center px-4 top-[10%] w-full"
          style={{ 
            opacity: text2Opacity,
            scale: isDesktop ? text2ScaleDesktop : undefined,
            y: text2Y
          }}
        >
          <h2 className="text-3xl md:text-6xl lg:text-7xl font-bold font-playfair text-transparent bg-clip-text bg-gradient-to-b from-white to-purple-200 drop-shadow-lg">
            {t('tranquilityStartsHere')}
          </h2>
        </motion.div>

        {/* Main Content Grid */}
        <motion.div 
          className="relative z-30 w-full max-w-7xl mx-auto px-4 mt-12 md:mt-20 flex-1 flex items-center justify-center"
          style={{ 
            opacity: gridOpacity,
            y: gridY
          }}
        >
          <div className="flex flex-wrap justify-center items-center gap-6 md:gap-20 w-full max-w-6xl">
            
            {FEATURES.map((feature, index) => (
                <div 
                  key={feature.id}
                  className={cn(
                    "relative group flex flex-col items-center w-[40%] md:w-auto cursor-pointer",
                    index % 2 !== 0 && "md:mt-24"
                  )}
                  onClick={() => setSelectedFeature(feature)}
                 >
                    <motion.div 
                      layoutId={`card-${feature.id}`}
                      className="rounded-3xl p-4 transition-colors duration-300 hover:bg-white/5"
                    >
                      <div className={isDesktop ? "animate-float" : ""} style={isDesktop ? { animationDelay: `${index * 0.5}s` } : undefined}>
                        <motion.div
                          layoutId={`image-${feature.id}`}
                          className="relative w-24 h-24 sm:w-48 sm:h-48"
                          style={{
                             filter: isDesktop ? `drop-shadow(0 10px 30px ${feature.shadowColor})` : `drop-shadow(0 5px 10px ${feature.shadowColor})`
                          }}
                        >
                          <Image 
                            src={feature.image} 
                            alt={feature.title} 
                            fill 
                            className="object-contain"
                            style={{ objectFit: "contain" }}
                            sizes="(max-width: 640px) 96px, (max-width: 1024px) 192px, 250px"
                            priority={index < 2}
                          />
                        </motion.div>
                      </div>
                    </motion.div>
                   
                   <div className="mt-2 text-center">
                       <motion.h3 
                        layoutId={`title-${feature.id}`}
                        className="text-base sm:text-2xl font-light text-white tracking-wide group-hover:text-purple-200 transition-colors"
                      >
                        {feature.title}
                      </motion.h3>
                      <p className="text-zinc-400 text-xs sm:text-sm mt-1 font-light group-hover:text-zinc-300 transition-colors">
                         {feature.subtitle}
                      </p>
                    </div>
                 </div>
              ))}

          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {selectedFeature && (
          <FeatureModal 
            key={selectedFeature.id}
            feature={selectedFeature} 
            onClose={() => setSelectedFeature(null)} 
          />
        )}
      </AnimatePresence>
    </section>
  );
}
