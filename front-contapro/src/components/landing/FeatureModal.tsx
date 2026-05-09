"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { X, ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

export type Feature = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  image: string;
  shadowColor: string;
  gradient: string;
};

interface FeatureModalProps {
  feature: Feature;
  onClose: () => void;
}

export function FeatureModal({ feature, onClose }: FeatureModalProps) {
  const t = useTranslations('FeatureModal');
  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
      />

      {/* Modal Container */}
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4">
        <motion.div
          layoutId={`card-${feature.id}`}
          className="relative w-full max-w-3xl overflow-hidden rounded-2xl md:rounded-3xl pointer-events-auto max-h-[90vh] overflow-y-auto"
          style={{
            background: "rgba(255, 255, 255, 0.03)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)", // Safari support
            boxShadow: `0 0 40px ${feature.shadowColor}`,
            border: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          {/* Internal Glow */}
          <div 
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{ background: feature.gradient }} 
          />
          
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-20 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 p-6 md:p-12 items-center relative z-10">
            {/* Left: 3D Image */}
            <div className="flex justify-center items-center">
              <motion.div
                layoutId={`image-${feature.id}`}
                className="relative w-48 h-48 md:w-64 md:h-64"
                style={{
                    filter: `drop-shadow(0 20px 50px ${feature.shadowColor})`
                }}
              >
                <Image
                  src={feature.image}
                  alt={feature.title}
                  fill
                  className="object-contain"
                  style={{ objectFit: "contain" }}
                />
              </motion.div>
            </div>

            {/* Right: Content */}
            <div className="text-center md:text-left space-y-4 md:space-y-6">
              <div>
                <motion.h2 
                  layoutId={`title-${feature.id}`}
                  className="text-3xl md:text-4xl font-bold text-white mb-2"
                >
                  {feature.title}
                </motion.h2>
                <motion.p 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-lg text-purple-200/80 font-medium"
                >
                  {feature.subtitle}
                </motion.p>
              </div>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-zinc-300 leading-relaxed"
              >
                {feature.description}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Link href="/register" className="group flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 transition-all text-white text-sm font-medium">
                  <span>{t('discoverMore')}</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
}
