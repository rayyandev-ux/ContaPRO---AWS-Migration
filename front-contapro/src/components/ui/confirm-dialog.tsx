"use client";
import { ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2 } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "default" | "danger";
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  onConfirm,
  loading = false,
  disabled = false,
  variant = "default"
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] bg-black/80 backdrop-blur-3xl border border-white/10 text-white p-0 overflow-hidden rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)]">
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
        
        <div className="p-8 space-y-6 relative z-10">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className={`h-16 w-16 rounded-[1.5rem] flex items-center justify-center border shadow-2xl ${
              variant === 'danger' 
                ? 'bg-red-500/10 border-red-500/20 text-red-500' 
                : 'bg-white/5 border-white/10 text-white'
            }`}>
              <AlertTriangle className="h-8 w-8" />
            </div>
            
            <div className="space-y-2">
              <DialogTitle className="text-2xl font-playfair italic font-bold">{title}</DialogTitle>
              <DialogDescription asChild>
                <div className="text-white/40 text-sm leading-relaxed font-medium px-2">
                  {description}
                </div>
              </DialogDescription>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <Button 
                onClick={onConfirm}
                disabled={loading || disabled}
                className={`w-full rounded-2xl h-14 text-xs font-black uppercase tracking-[0.2em] transition-all shadow-2xl ${
                  loading || disabled 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'hover:scale-[1.02] active:scale-[0.98]'
                } ${
                  variant === 'danger'
                    ? 'bg-red-500 text-white hover:bg-red-600 shadow-red-500/20'
                    : 'bg-white text-black hover:bg-zinc-200 shadow-white/10'
                }`}
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                {confirmText}
              </Button>
            
            <Button 
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="w-full rounded-2xl h-14 text-[10px] font-black uppercase tracking-[0.2em] text-white/40 hover:text-white hover:bg-white/5 transition-all"
            >
              {cancelText}
            </Button>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/[0.02] blur-3xl rounded-full -mr-16 -mt-16 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/[0.01] blur-2xl rounded-full -ml-12 -mb-12 pointer-events-none" />
      </DialogContent>
    </Dialog>
  );
}
