"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { usePathname } from "@/i18n/routing";

export default function SmoothScroll() {
  const pathname = usePathname();

  useEffect(() => {
    // Disable smooth scroll on dashboard-like pages where we have internal scrolling
    const isDashboard = 
      pathname.includes('/dashboard') || 
      pathname.includes('/budget') || 
      pathname.includes('/transactions') || 
      pathname.includes('/categories') || 
      pathname.includes('/history') || 
      pathname.includes('/integrations') || 
      pathname.includes('/payment-methods') || 
      pathname.includes('/upload') || 
      pathname.includes('/account') ||
      pathname.includes('/coupons') ||
      pathname.includes('/users') ||
      pathname.includes('/subscriptions');

    if (isDashboard) return;

    // Detect mobile to optionally disable or configure differently
    const isMobile = window.innerWidth < 768;
    if (isMobile) return; // Disable on mobile completely for native feel and performance

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
    };
  }, [pathname]);

  return null;
}
