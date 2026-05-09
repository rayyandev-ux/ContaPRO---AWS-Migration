import React, { useEffect, useRef, useMemo, ReactNode, RefObject } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './ScrollReveal.css';

gsap.registerPlugin(ScrollTrigger);

interface ScrollRevealProps {
  children: ReactNode;
  scrollContainerRef?: RefObject<HTMLElement>;
  enableBlur?: boolean;
  baseOpacity?: number;
  baseRotation?: number;
  blurStrength?: number;
  containerClassName?: string;
  textClassName?: string;
  rotationEnd?: string;
  wordAnimationEnd?: string;
  as?: React.ElementType;
  scrub?: number | boolean;
}

const ScrollReveal: React.FC<ScrollRevealProps> = ({
  children,
  scrollContainerRef,
  enableBlur = true,
  baseOpacity = 0.1,
  baseRotation = 3,
  blurStrength = 4,
  containerClassName = '',
  textClassName = '',
  rotationEnd = 'bottom bottom',
  wordAnimationEnd = 'bottom bottom',
  as: Component = 'h2',
  scrub = 1
}) => {
  const containerRef = useRef<HTMLElement>(null);

  const splitText = useMemo(() => {
    if (typeof children !== 'string') return children;
    const text = children;
    return text.split(/(\s+)/).map((word, index) => {
      if (word.match(/^\s+$/)) return word;
      return (
        <span className="word" key={index}>
          {word}
        </span>
      );
    });
  }, [children]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const scroller = scrollContainerRef && scrollContainerRef.current ? scrollContainerRef.current : window;

    gsap.fromTo(
      el,
      { transformOrigin: '0% 50%', rotate: baseRotation },
      {
        ease: 'none',
        rotate: 0,
        scrollTrigger: {
          trigger: el,
          scroller,
          start: 'top bottom',
          end: rotationEnd,
          scrub: scrub
        }
      }
    );

    const wordElements = el.querySelectorAll<HTMLElement>('.word');

    if (wordElements.length > 0) {
      gsap.fromTo(
        wordElements,
        { opacity: baseOpacity, willChange: 'opacity' },
        {
          ease: 'none',
          opacity: 1,
          stagger: 0.05,
          scrollTrigger: {
            trigger: el,
            scroller,
            start: 'top bottom-=20%',
            end: wordAnimationEnd,
            scrub: scrub
          }
        }
      );

      if (enableBlur) {
        gsap.fromTo(
          wordElements,
          { filter: `blur(${blurStrength}px)` },
          {
            ease: 'none',
            filter: 'blur(0px)',
            stagger: 0.05,
            scrollTrigger: {
              trigger: el,
              scroller,
              start: 'top bottom-=20%',
              end: wordAnimationEnd,
              scrub: scrub
            }
          }
        );
      }
    } else {
       // Logic for non-text content (e.g. components)
       const contentElement = el.querySelector('.scroll-reveal-text');
       if (contentElement) {
          gsap.fromTo(
             contentElement,
             { opacity: baseOpacity, filter: enableBlur ? `blur(${blurStrength}px)` : 'none' },
             {
                ease: 'none',
                opacity: 1,
                filter: 'blur(0px)',
                scrollTrigger: {
                   trigger: el,
                   scroller,
                   start: 'top bottom-=20%',
                   end: wordAnimationEnd,
                   scrub: scrub
                }
             }
          );
       }
    }

    return () => {
      ScrollTrigger.getAll().forEach(trigger => trigger.kill());
    };
  }, [scrollContainerRef, enableBlur, baseRotation, baseOpacity, rotationEnd, wordAnimationEnd, blurStrength, scrub]);

  const Tag = Component as any;

  return (
    <Tag ref={containerRef} className={`scroll-reveal ${containerClassName}`}>
      <div className={`scroll-reveal-text ${textClassName}`}>{splitText}</div>
    </Tag>
  );
};

export default ScrollReveal;
