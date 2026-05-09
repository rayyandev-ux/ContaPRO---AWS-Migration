"use client";
import { motion, Variants } from "framer-motion";

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  amount?: number;
  once?: boolean;
  direction?: "up" | "down" | "left" | "right" | "none";
};

export function Reveal({ children, className, delay = 0, duration = 0.5, amount = 0.2, once = true, direction = "up" }: RevealProps) {
  const dx = direction === "left" ? 12 : direction === "right" ? -12 : 0;
  const dy = direction === "up" ? 12 : direction === "down" ? -12 : 0;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, x: dx, y: dy }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once, amount }}
      transition={{ duration, delay }}
    >
      {children}
    </motion.div>
  );
}

type RevealListProps = {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
  delayChildren?: number;
  amount?: number;
  once?: boolean;
  itemOffset?: { x?: number; y?: number };
  duration?: number;
  itemClassName?: string;
};

export function RevealList({ children, className, stagger = 0.08, delayChildren = 0, amount = 0.2, once = true, itemOffset = { y: 12 }, duration = 0.45, itemClassName }: RevealListProps) {
  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: stagger, delayChildren } },
  };
  const item: Variants = {
    hidden: { opacity: 0, x: itemOffset.x ?? 0, y: itemOffset.y ?? 0 },
    show: { opacity: 1, x: 0, y: 0 },
  };
  return (
    <motion.div className={className} initial="hidden" whileInView="show" viewport={{ once, amount }} variants={container}>
      {Array.isArray(children)
        ? children.map((child, i) => (
            <motion.div key={i} variants={item} transition={{ duration }} className={itemClassName}>
              {child as React.ReactNode}
            </motion.div>
          ))
        : (
            <motion.div variants={item} transition={{ duration }} className={itemClassName}>
              {children}
            </motion.div>
          )}
    </motion.div>
  );
}