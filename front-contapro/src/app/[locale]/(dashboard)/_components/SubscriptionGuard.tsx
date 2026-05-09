"use client";

import { Loader2 } from "lucide-react";

interface User {
  plan?: string;
  planExpires?: string;
  trialEnds?: string;
  name?: string;
  email?: string;
}

interface SubscriptionGuardProps {
  children: React.ReactNode;
  user: User | null;
}

export default function SubscriptionGuard({ children, user }: SubscriptionGuardProps) {
  // Ahora el plan FREE está permitido por defecto.
  // Solo devolvemos a los hijos si existe un usuario.
  
  if (!user) {
    return (
      <div className="h-[100dvh] w-full flex items-center justify-center bg-background">
           <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Ya no hay restricción "hard" de pago en el Guard general,
  // las restricciones de pago se manejarán por features específicas o endpoints.
  return <>{children}</>;
}
