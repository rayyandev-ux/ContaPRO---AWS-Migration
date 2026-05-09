"use client";

import { motion } from "framer-motion";

export default function SankeySkeleton() {
  return (
    <div className="w-full h-full min-h-[350px] flex flex-col bg-[#1c1c1c] rounded-xl border border-white/5 shadow-2xl p-6 overflow-hidden relative group">
      {/* Header matching the image */}
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-sm font-medium text-white/40 tracking-tight">Flujo por categoría</h3>
        <div className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-white/20">
          <span className="text-[10px]">¥</span>
        </div>
      </div>
      
      {/* Action buttons skeleton */}
      <div className="flex gap-2 mb-8">
        <div className="h-7 w-16 bg-white/10 rounded-md animate-pulse opacity-50" />
        <div className="h-7 w-20 bg-white/5 rounded-md animate-pulse opacity-30" />
      </div>

      <div className="flex-1 relative flex items-center justify-center px-4">
        <svg
          viewBox="0 0 600 220"
          className="w-full h-full opacity-20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="flow-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.01)" />
              <stop offset="50%" stopColor="rgba(255,255,255,0.12)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.01)" />
            </linearGradient>
            
            <mask id="mask-flow">
              <motion.rect
                x="-100%"
                y="0"
                width="100%"
                height="100%"
                fill="url(#flow-grad)"
                animate={{
                  x: ["100%", "-100%"]
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "linear"
                }}
              />
            </mask>
          </defs>

          {/* Paths - Background */}
          <g stroke="white" strokeWidth="22" strokeOpacity="0.05" strokeLinecap="butt">
            {/* L1 -> M1, M2 */}
            <path d="M40 30 C 150 30, 150 30, 300 30" />
            <path d="M40 30 C 150 30, 150 110, 300 110" />
            
            {/* L2 -> M2 */}
            <path d="M40 110 C 150 110, 150 110, 300 110" />
            
            {/* L3 -> M2, M3 */}
            <path d="M40 190 C 150 190, 150 110, 300 110" />
            <path d="M40 190 C 150 190, 150 190, 300 190" />
            
            {/* M1 -> R1 */}
            <path d="M300 30 C 420 30, 420 70, 560 70" />
            
            {/* M2 -> R1, R2 */}
            <path d="M300 110 C 420 110, 420 70, 560 70" />
            <path d="M300 110 C 420 110, 420 150, 560 150" />
            
            {/* M3 -> R2 */}
            <path d="M300 190 C 420 190, 420 150, 560 150" />
          </g>

          {/* Animated Flow Overlay */}
          <g stroke="white" strokeWidth="22" strokeOpacity="0.08" strokeLinecap="butt" mask="url(#mask-flow)">
            <path d="M40 30 C 150 30, 150 30, 300 30" />
            <path d="M40 30 C 150 30, 150 110, 300 110" />
            <path d="M40 110 C 150 110, 150 110, 300 110" />
            <path d="M40 190 C 150 190, 150 110, 300 110" />
            <path d="M40 190 C 150 190, 150 190, 300 190" />
            <path d="M300 30 C 420 30, 420 70, 560 70" />
            <path d="M300 110 C 420 110, 420 70, 560 70" />
            <path d="M300 110 C 420 110, 420 150, 560 150" />
            <path d="M300 190 C 420 190, 420 150, 560 150" />
          </g>

          {/* Nodes - matching the grey blocks in image */}
          <g fill="white" fillOpacity="0.1">
            {/* Column 1 */}
            <rect x="20" y="10" width="16" height="40" rx="1" />
            <rect x="20" y="90" width="16" height="40" rx="1" />
            <rect x="20" y="170" width="16" height="40" rx="1" />
            
            {/* Column 2 */}
            <rect x="292" y="10" width="16" height="40" rx="1" />
            <rect x="292" y="90" width="16" height="40" rx="1" />
            <rect x="292" y="170" width="16" height="40" rx="1" />
            
            {/* Column 3 */}
            <rect x="564" y="50" width="16" height="40" rx="1" />
            <rect x="564" y="130" width="16" height="40" rx="1" />
          </g>
        </svg>
      </div>
      
      {/* Background Subtle Gradient Pulse */}
      <motion.div 
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full"
        animate={{ x: ["100%", "-100%"] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}


