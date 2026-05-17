"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Calendar, Wallet, Tags, Building2, AlignLeft, Receipt, ExternalLink, Lightbulb } from "lucide-react";
import EditExpenseDialog from "./EditExpenseDialog";
import { getExpenseTip } from "@/lib/expense-tips";

type Category = { id: string; name: string };
type PaymentMethod = { id: string; name: string };
type ExpenseItem = {
  id: string;
  type: string;
  issuedAt: string;
  createdAt: string;
  provider: string;
  description?: string | null;
  amount: number;
  currency: string;
  category?: Category | null;
  paymentMethod?: PaymentMethod | null;
  emitterIdNumber?: string | null;
  editReason?: string | null;
};

export default function DetailEditable({ item, isCurrentMonth }: { item: ExpenseItem; isCurrentMonth: boolean }) {
  const t = useTranslations("Expenses"); // General translation if needed
  const [modalOpen, setModalOpen] = useState(false);

  // Generar tip basado en la categoría y el monto (pasando item.id como semilla para evitar errores de hidratación)
  const tip = getExpenseTip(item.category?.name || "General", item.amount, item.currency, item.id);

  const formattedDate = new Date(item.issuedAt).toLocaleDateString("es-ES", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
  });
  
  const formattedCreated = new Date(item.createdAt).toLocaleDateString("es-ES", {
    day: "2-digit", month: "short", year: "numeric"
  });

  return (
    <div className="flex flex-col gap-6">
      
      {/* 1. HERO CARD (Amount & Main Info) */}
      <div className="relative overflow-hidden bg-white/5 backdrop-blur-md rounded-[32px] p-8 border border-white/10 shadow-xl">
        {/* Gradients to add a premium touch */}
        <div className="absolute top-0 right-0 p-32 bg-purple-500/10 mix-blend-screen rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 p-32 bg-blue-500/10 mix-blend-screen rounded-full blur-[100px] pointer-events-none" />
        
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <p className="text-white/50 text-sm font-medium tracking-widest uppercase mb-1">Total del Gasto</p>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl md:text-6xl font-bold tracking-tight text-white">
                {Number(item.amount).toFixed(2)}
              </span>
              <span className="text-2xl font-light text-white/50">{item.currency}</span>
            </div>
            
            <h1 className="text-xl text-white/90 mt-2 flex items-center gap-2">
              {item.provider}
              {item.type === 'FACTURA' && (
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold tracking-wider uppercase border border-blue-500/20">
                  FACTURA
                </span>
              )}
            </h1>

            <div className="flex flex-wrap items-center gap-3 mt-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 text-white/90 text-sm border border-white/5 backdrop-blur-sm">
                <Tags className="w-3.5 h-3.5 text-white/50" />
                {item.category?.name || "Sin Categoría"}
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 text-white/90 text-sm border border-white/5 backdrop-blur-sm">
                <Wallet className="w-3.5 h-3.5 text-white/50" />
                {item.paymentMethod?.name || "Método Sin Asignar"}
              </div>
            </div>
          </div>
          
          <div className="flex-shrink-0">
            {isCurrentMonth ? (
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white font-medium border border-white/20 shadow-[0_0_20px_-4px_rgba(255,255,255,0.05)] transition-all active:scale-95"
              >
                <Pencil className="w-4 h-4" />
                Editar Gasto
              </button>
            ) : (
              <div className="inline-flex items-center px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-sm text-white/50">
                Solo lectura (Mes pasado)
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 2. DATA GRID (Details) */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/10">
          
          <div className="flex flex-col gap-1.5 p-3 rounded-2xl hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-2 text-white/40 text-xs font-bold uppercase tracking-widest">
              <Calendar className="w-4 h-4" /> Fecha Emisión
            </div>
            <p className="text-white/90 text-sm font-medium">{formattedDate}</p>
          </div>

          <div className="flex flex-col gap-1.5 p-3 rounded-2xl hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-2 text-white/40 text-xs font-bold uppercase tracking-widest">
              <Building2 className="w-4 h-4" /> RUC / DNI
            </div>
            <p className="text-white/90 text-sm font-medium">{item.emitterIdNumber || "No especificado"}</p>
          </div>
          
          <div className="flex flex-col gap-1.5 p-3 rounded-2xl hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-2 text-white/40 text-xs font-bold uppercase tracking-widest">
              <Wallet className="w-4 h-4" /> Método de pago
            </div>
            <p className="text-white/90 text-sm font-medium">{item.paymentMethod?.name || "No especificado"}</p>
          </div>

          <div className="flex flex-col gap-1.5 p-3 rounded-2xl hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-2 text-white/40 text-xs font-bold uppercase tracking-widest">
              <Receipt className="w-4 h-4" /> Tipo de doc.
            </div>
            <p className="text-white/90 text-sm font-medium capitalize">{item.type.toLowerCase()}</p>
          </div>

          <div className="flex flex-col gap-1.5 p-3 rounded-2xl hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-2 text-white/40 text-xs font-bold uppercase tracking-widest">
              <Calendar className="w-4 h-4 text-white/30" /> Fecha Sistema
            </div>
            <p className="text-white/60 text-sm">{formattedCreated}</p>
          </div>

          <div className="sm:col-span-2 flex flex-col gap-1.5 p-3 rounded-2xl hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-2 text-white/40 text-xs font-bold uppercase tracking-widest">
              <AlignLeft className="w-4 h-4" /> Descripción / Nota
            </div>
            <p className="text-white/80 text-sm leading-relaxed">
              {item.description || "Este gasto se registró sin descripción adicional."}
            </p>
          </div>
          
          {item.editReason && (
             <div className="sm:col-span-2 flex flex-col gap-1 p-3 rounded-2xl bg-orange-500/10 border border-orange-500/20">
               <div className="text-orange-500/60 text-[10px] font-bold uppercase tracking-widest mb-1">Editado Manualmente</div>
               <p className="text-orange-200 text-sm">Motivo: {item.editReason}</p>
             </div>
          )}

        </div>

        {/* 3. TIPS & INSIGHTS WIDGET */}
        <div className="flex flex-col gap-4">
          <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/5 backdrop-blur-md rounded-3xl p-6 border border-white/10 h-full flex flex-col justify-center">
             <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 shadow-inner">
                  <span className="text-xl">{tip.icon}</span>
                </div>
                <h3 className="text-white/90 font-semibold">{tip.title}</h3>
             </div>
             <p className="text-white/70 text-sm leading-relaxed">
                {tip.text}
             </p>
          </div>
        </div>

      </div>

      <EditExpenseDialog item={item} open={modalOpen} onOpenChange={setModalOpen} />
    </div>
  );
}
