"use client";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface Star {
  id: number;
  x: number;
  delay: number;
  duration: number;
  size: number;
}

export const FallingStars = () => {
  const [stars, setStars] = useState<Star[]>([]);

  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    const starCount = isMobile ? 15 : 40; // Reduced count for mobile
    const newStars = Array.from({ length: starCount }).map((_, i) => ({
      id: i,
      x: Math.random() * 100, // percentage
      delay: Math.random() * 5,
      duration: 3 + Math.random() * 4,
      size: 2 + Math.random() * 3,
    }));
    setStars(newStars);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[5]">
      {stars.map((star) => (
        <motion.div
          key={star.id}
          className="absolute rounded-full"
          style={{
            left: `${star.x}%`,
            width: star.size,
            height: star.size,
            top: -50,
            background: "linear-gradient(135deg, #e0e0e0 0%, #ffffff 50%, #a0a0a0 100%)",
            // Simplified shadow for performance
            boxShadow: "0 0 4px 1px rgba(255, 255, 255, 0.4)",
            border: "1px solid rgba(255, 255, 255, 0.8)"
          }}
          animate={{
            y: ["0vh", "100vh"],
            opacity: [0, 1, 1, 0],
            rotate: [0, 360], // Add rotation to catch the light
          }}
          transition={{
            duration: star.duration,
            delay: star.delay,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
};
