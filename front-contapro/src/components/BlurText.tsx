"use client";
import { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface BlurTextProps {
  text?: string;
  delay?: number;
  className?: string;
  animateBy?: 'words' | 'letters';
  direction?: 'top' | 'bottom';
  threshold?: number;
  rootMargin?: string;
  onAnimationComplete?: () => void;
}

const BlurText = ({
  text = '',
  delay = 200,
  className = '',
  animateBy = 'words',
  direction = 'top',
  threshold = 0.1,
  rootMargin = '0px',
  onAnimationComplete,
}: BlurTextProps) => {
  const elements = animateBy === 'words' ? text.split(' ') : text.split('');
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (ref.current) {
            observer.unobserve(ref.current);
          }
        }
      },
      { threshold, rootMargin }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  const defaultFrom = {
    filter: 'blur(10px)',
    opacity: 0,
    transform: direction === 'top' ? 'translate3d(0,-50px,0)' : 'translate3d(0,50px,0)',
  };

  const defaultTo = {
    filter: 'blur(0px)',
    opacity: 1,
    transform: 'translate3d(0,0,0)',
  };

  return (
    <span ref={ref} className={`inline-flex flex-wrap ${className}`}>
      {elements.map((element, index) => (
        <motion.span
          key={index}
          initial={defaultFrom}
          animate={inView ? defaultTo : defaultFrom}
          transition={{
            delay: (index * delay) / 1000,
            duration: 1,
            ease: 'easeOut',
          }}
          className={`inline-block ${animateBy === 'words' && index !== elements.length - 1 ? 'mr-2' : ''}`}
          onAnimationComplete={index === elements.length - 1 ? onAnimationComplete : undefined}
        >
          {element === ' ' ? '\u00A0' : element}
        </motion.span>
      ))}
    </span>
  );
};

export default BlurText;
