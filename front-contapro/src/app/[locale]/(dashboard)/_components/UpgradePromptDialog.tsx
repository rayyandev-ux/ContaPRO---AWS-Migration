"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Crown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/routing";

interface UpgradePromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UpgradePromptDialog({ open, onOpenChange }: UpgradePromptDialogProps) {
  const router = useRouter();

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-white/5 border border-white/10 rounded-3xl p-8 overflow-hidden shadow-2xl backdrop-blur-3xl"
          >
            {/* Background Effects */}
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-40 h-40 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

            <button
              onClick={() => onOpenChange(false)}
              className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all border border-white/10"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex flex-col items-center text-center space-y-6">
              <div className="relative">
                <div className="h-20 w-20 rounded-full bg-gradient-to-br from-emerald-400/20 to-blue-500/20 flex items-center justify-center border border-white/10">
                  <Crown className="h-10 w-10 text-emerald-400" />
                </div>
                <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                  <Sparkles className="h-3 w-3 text-white" />
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-white font-playfair tracking-tight">
                  Funcionalidad Premium
                </h2>
                <p className="text-white/60 text-sm leading-relaxed">
                  Para acceder a esta función y desbloquear todo el potencial de ContaPRO, necesitas un plan activo.
                </p>
              </div>

              <Button
                onClick={() => {
                  onOpenChange(false);
                  router.push("/pricing");
                }}
                className="w-full h-12 rounded-full bg-white text-black font-bold hover:bg-white/90 transition-all uppercase tracking-widest text-xs mt-2"
              >
                Ver Planes Disponibles
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
