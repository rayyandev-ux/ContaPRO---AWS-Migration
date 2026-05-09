"use client";
import { useEffect, useState, ReactNode } from "react";
import { loadStripe, Stripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { apiJson } from "@/lib/api";

let stripePromise: Promise<Stripe | null> | null = null;

const getStripe = () => {
  if (stripePromise) return stripePromise;
  
  stripePromise = (async () => {
    try {
      const res = await apiJson<{ stripePublishableKey: string }>("/api/config/public");
      if (res.ok && res.data?.stripePublishableKey) {
        return loadStripe(res.data.stripePublishableKey);
      }
    } catch (e) {
      console.error("Stripe init error:", e);
    }
    return null;
  })();
  
  return stripePromise;
};

export function StripeProvider({ children }: { children: ReactNode }) {
  const [promise, setPromise] = useState<Promise<Stripe | null> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const p = getStripe();
    setPromise(p);
    
    p.then(stripe => {
      if (!stripe) {
        // Solo mostrar error si intentamos cargar y no hay nada
        apiJson<{ stripePublishableKey: string }>("/api/config/public").then(res => {
          if (!res.data?.stripePublishableKey) {
            setError("Falta la clave pública de Stripe (STRIPE_PUBLISHABLE_KEY) en el .env del backend.");
          }
        });
      }
    });
  }, []);

  if (error) {
    return (
      <div className="p-8 rounded-[2rem] bg-red-500/5 border border-red-500/10 text-red-400 text-xs font-medium space-y-2">
        <p className="font-black uppercase tracking-widest">Error de Configuración</p>
        <p className="opacity-70">{error}</p>
      </div>
    );
  }

  if (!promise) {
    return <>{children}</>;
  }

  return (
    <Elements stripe={promise}>
      {children}
    </Elements>
  );
}
