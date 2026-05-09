"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

function FlowReturnContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const type = searchParams.get("type");
  const success = searchParams.get("success");

  useEffect(() => {
    if (!token) {
      router.push("/billing?flow=error");
      return;
    }

    // El backend ya procesó el callback. 
    // Redirigimos con el parámetro de éxito o error a billing.
    const timer = setTimeout(() => {
      if (success === "true") {
        if (type === "register") {
          router.push("/billing?flow=card-success");
        } else {
          router.push("/billing?flow=payment-success");
        }
      } else if (success === "pending") {
        router.push("/billing?flow=payment-pending");
      } else {
        if (type === "register") {
          router.push("/billing?flow=card-error");
        } else {
          router.push("/billing?flow=error");
        }
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [token, type, success, router]);

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white">
      <Loader2 className="w-12 h-12 text-violet-500 animate-spin mb-4" />
      <h2 className="text-xl font-semibold">Procesando tu solicitud...</h2>
      <p className="text-zinc-400 mt-2 text-sm">Por favor espera, estamos confirmando tu pago con Flow.</p>
    </div>
  );
}

export default function FlowReturnPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="w-12 h-12 text-violet-500 animate-spin" /></div>}>
      <FlowReturnContent />
    </Suspense>
  );
}