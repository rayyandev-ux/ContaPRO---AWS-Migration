"use client";
import { CreditCard, Trash2, CheckCircle2, MoreVertical, Star, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
}

export function PaymentMethodItem({ 
  method, 
  onSetDefault, 
  onDelete, 
  loadingAction 
}: { 
  method: PaymentMethod; 
  onSetDefault: (id: string) => void; 
  onDelete: (id: string) => void;
  loadingAction?: string | null;
}) {
  const isLoading = loadingAction === method.id;

  return (
    <div className={`relative p-6 rounded-[2rem] border transition-all duration-500 overflow-hidden ${
      method.isDefault 
        ? 'bg-white/10 border-white/30 shadow-[0_0_40px_rgba(255,255,255,0.05)]' 
        : 'bg-white/5 border-white/10 hover:bg-white/[0.07] hover:border-white/20'
    }`}>
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-5">
          <div className={`h-14 w-14 rounded-2xl flex items-center justify-center border shadow-inner ${
            method.isDefault ? 'bg-white/10 border-white/20' : 'bg-white/5 border-white/10'
          }`}>
            <CreditCard className={`h-6 w-6 ${method.isDefault ? 'text-white' : 'text-white/30'}`} />
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold text-white capitalize">
                {method.brand} {method.last4 !== '****' ? `•••• ${method.last4}` : ''}
              </span>
              {method.isDefault && (
                <div className="px-2.5 py-1 rounded-full bg-white text-black text-[10px] font-black uppercase tracking-wider shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                  PRINCIPAL
                </div>
              )}
            </div>
            <p className="text-xs text-white/40 font-medium tracking-wide uppercase">
              {method.expMonth && method.expYear 
                ? `Expira: ${method.expMonth.toString().padStart(2, '0')}/${method.expYear.toString().slice(-2)}`
                : 'Tarjeta Activa'}
            </p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/10 h-10 w-10 text-white/40 hover:text-white" disabled={isLoading}>
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <MoreVertical className="h-5 w-5" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-black/90 backdrop-blur-2xl border border-white/10 text-white rounded-2xl p-2 min-w-[160px]">
            {!method.isDefault && (
              <DropdownMenuItem onClick={() => onSetDefault(method.id)} className="rounded-xl focus:bg-white/10 cursor-pointer gap-3 py-2.5 px-3">
                <Star className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Hacer principal</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onDelete(method.id)} className="rounded-xl focus:bg-red-500/10 text-red-400 focus:text-red-400 cursor-pointer gap-3 py-2.5 px-3">
              <Trash2 className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Eliminar</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Glass decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 blur-3xl rounded-full -mr-16 -mt-16 pointer-events-none" />
    </div>
  );
}

export function InvoiceRow({ invoice }: { invoice: any }) {
  const date = new Date(invoice.date);
  
  return (
    <div className="group flex items-center justify-between p-6 rounded-3xl hover:bg-white/5 border border-transparent hover:border-white/10 transition-all duration-300">
      <div className="flex items-center gap-5">
        <div className="h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-white/10 transition-colors">
          <CreditCard className="h-5 w-5 text-white/20 group-hover:text-white/40 transition-colors" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-bold text-white tracking-wide uppercase">{invoice.number || 'Factura'}</p>
          <p className="text-[11px] text-white/30 font-medium uppercase tracking-wider">
            {date.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-8">
        <div className="text-right space-y-1">
          <p className="text-sm font-black text-white">{invoice.amount.toLocaleString('es-PE', { style: 'currency', currency: invoice.currency })}</p>
          <div className={`text-[10px] font-black uppercase tracking-[0.1em] ${
            invoice.status === 'paid' ? 'text-green-400' : 'text-white/20'
          }`}>
            {invoice.status === 'paid' ? 'Pagado' : invoice.status}
          </div>
        </div>

        <Button 
          variant="ghost" 
          size="sm" 
          asChild 
          className="rounded-full bg-white/5 hover:bg-white text-white/60 hover:text-black border border-white/10 transition-all font-bold text-[10px] uppercase tracking-widest px-5"
        >
          <a href={invoice.pdf} target="_blank" rel="noopener noreferrer">PDF</a>
        </Button>
      </div>
    </div>
  );
}
