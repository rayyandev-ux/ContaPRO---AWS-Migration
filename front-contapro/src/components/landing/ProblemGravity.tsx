"use client";

import React, { useEffect, useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import GlitchText from '@/components/GlitchText';
import { useTranslations } from 'next-intl';

import { useMediaQuery } from '@/hooks/use-media-query';

const FinancialChaosBackground = () => {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!isDesktop) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = window.innerWidth;
    let height = window.innerHeight;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    
    window.addEventListener('resize', resize);
    resize();

    // Line particles
    const lines: { x: number; y: number; length: number; speed: number; angle: number; color: string }[] = [];
    const lineCount = 30;

    for (let i = 0; i < lineCount; i++) {
      lines.push({
        x: Math.random() * width,
        y: Math.random() * height,
        length: Math.random() * 200 + 50,
        speed: Math.random() * 2 + 0.5,
        angle: Math.random() > 0.5 ? 0 : Math.PI / 2, // Horizontal or Vertical
        color: Math.random() > 0.5 ? 'rgba(139, 92, 246, 0.15)' : 'rgba(59, 130, 246, 0.15)' // Violet or Blue low opacity
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      
      // Draw grid hints
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      const gridSize = 100;
      
      for(let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      
      for(let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw chaotic lines
      lines.forEach(line => {
        ctx.beginPath();
        ctx.strokeStyle = line.color;
        ctx.lineWidth = 2;
        ctx.moveTo(line.x, line.y);
        
        const endX = line.x + Math.cos(line.angle) * line.length;
        const endY = line.y + Math.sin(line.angle) * line.length;
        
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Move
        if (line.angle === 0) { // Horizontal
           line.x += line.speed;
           if (line.x > width) line.x = -line.length;
        } else { // Vertical
           line.y += line.speed;
           if (line.y > height) line.y = -line.length;
        }
        
        // Random glitch jump
        if (Math.random() < 0.01) {
            line.x = Math.random() * width;
            line.y = Math.random() * height;
        }
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 z-0 opacity-60" />;
};

export function ProblemGravity() {
  const t = useTranslations('ProblemGravity');
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  const y1 = useTransform(scrollYProgress, [0, 1], [0, 100]);
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);

  return (
    <section 
      ref={containerRef}
      className="relative min-h-[60vh] md:min-h-[90vh] flex flex-col items-center justify-center overflow-hidden py-12 md:py-40 bg-black -mt-[100px] md:-mt-[150px] z-40"
      style={{ 
        borderBottomLeftRadius: '50% 60px', 
        borderBottomRightRadius: '50% 60px',
      }}
    >
      {/* Background Elements */}
      <div className="absolute inset-0 z-0 bg-black">
        {/* Subtle Violet/Blue Glows from edges */}
        <div className="absolute -left-[20%] top-[20%] w-[50%] h-[50%] bg-purple-900/20 blur-[80px] md:blur-[120px] rounded-full mix-blend-screen animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute -right-[20%] bottom-[20%] w-[50%] h-[50%] bg-blue-900/10 blur-[80px] md:blur-[120px] rounded-full mix-blend-screen animate-pulse" style={{ animationDuration: '7s' }} />
        
        {isDesktop && (
          <div className="absolute inset-0">
            <FinancialChaosBackground />
          </div>
        )}
      </div>

      {/* Content Container */}
      <motion.div 
        className="container mx-auto px-4 text-center relative z-10 flex flex-col items-center justify-center h-full"
        style={{ opacity }}
      >
        
        {/* Top Text Group */}
        <motion.div 
          className="mb-6 md:mb-8 relative z-20 flex flex-col items-center max-w-3xl mx-auto space-y-4 md:space-y-6 px-4"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
        >
            <p className="text-base md:text-2xl font-light tracking-wide text-zinc-200/80 font-sans leading-relaxed">
              {t('promiseToSave')} 
              <span className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] mx-2">
                {t('accountZero')}
              </span>
            </p>
            
            <p className="text-xl md:text-4xl font-normal text-white tracking-tight drop-shadow-[0_0_12px_rgba(255,255,255,0.3)]">
              {t('notLackOfDiscipline')}
            </p>
        </motion.div>

        {/* Huge Headline Glitch */}
        <div className="relative z-20 py-8 flex justify-center items-center w-full">
           <GlitchText text={t('itIsChaos')} />
           
           {/* Decorative elements around glitch text */}
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[150%] bg-violet-500/15 blur-[60px] md:blur-[100px] -z-10 rounded-full" />
        </div>

      </motion.div>
    </section>
  );
}
