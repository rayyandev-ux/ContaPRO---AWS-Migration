"use client";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Pencil, ArrowUpRight, ArrowDownRight, Eye } from "lucide-react";
import { Link } from "@/i18n/routing";

type Category = { id: string; name: string };
type PaymentMethod = { id: string; provider: string; name: string };
type Transaction = {
  id: string;
  transactionType: "EXPENSE" | "INCOME";
  type?: string;
  issuedAt: string;
  createdAt: string;
  provider?: string;
  description?: string;
  amount: number;
  currency: string;
  amountNative?: number | null;
  exchangeRate?: number | null;
  categoryName?: string | null;
  category?: Category | null;
  paymentMethod?: PaymentMethod | null;
  source?: string;
};

type Props = {
  tx: Transaction;
  isSelected: boolean;
  onToggleSelect: () => void;
  onEditCategory: (tx: Transaction) => void;
  onEditAccount: (tx: Transaction) => void;
  userPreferredCurrency?: string;
};

export default function TransactionCard({
  tx,
  isSelected,
  onToggleSelect,
  onEditCategory,
  onEditAccount,
  userPreferredCurrency = "PEN",
}: Props) {
  const isIncome = tx.transactionType === "INCOME";
  const amountColor = isIncome ? "text-emerald-400" : "text-rose-400";
  const amountSign = isIncome ? "+" : "-";
  const isMultiCurrency = tx.currency !== userPreferredCurrency && tx.amountNative;

  const formatAmount = (amount: number, currency: string) => {
    try {
      return new Intl.NumberFormat("es-PE", { style: "currency", currency: currency || "PEN" }).format(amount);
    } catch {
      return `${amount.toFixed(2)} ${currency || "PEN"}`;
    }
  };

  const title = tx.description || tx.provider || "Sin descripción";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -2 }}
      className={`group relative p-5 rounded-2xl border transition-all duration-300 backdrop-blur-xl ${
        isSelected 
          ? "bg-purple-500/10 border-purple-500/50 shadow-[0_0_30px_-5px_rgba(168,85,247,0.15)]" 
          : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 shadow-lg"
      }`}
    >
      {/* Checkbox */}
      <div className="absolute top-4 left-4 z-10">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          className="w-4 h-4 rounded border-white/20 bg-white/10 text-purple-500 focus:ring-purple-500/30 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity peer"
        />
        {isSelected && <div className="absolute inset-0 bg-purple-500/20 rounded pointer-events-none" />}
      </div>

      <div className="flex justify-between items-start mb-4 pl-6">
        <div className="flex-1 min-w-0 pr-4">
          <h3 className="text-white font-medium text-base truncate" title={title}>{title}</h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-white/40 text-xs capitalize" title="Fecha de emisión">
              {format(new Date(tx.issuedAt), "dd MMM yyyy", { locale: es })}
            </span>
            {tx.createdAt && new Date(tx.createdAt).toDateString() !== new Date(tx.issuedAt).toDateString() && (
              <span className="text-white/20 text-[10px]" title="Fecha de registro en el sistema">
                (Reg: {format(new Date(tx.createdAt), "dd MMM", { locale: es })})
              </span>
            )}
            {tx.source === "MANUAL" && (
              <span className="px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[9px] uppercase tracking-wider text-white/30">Manual</span>
            )}
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className={`text-lg font-bold tracking-tight tabular-nums ${amountColor}`}>
            {amountSign}{formatAmount(tx.amount, tx.currency)}
          </span>
          {isMultiCurrency && (
            <span className="text-[10px] text-white/40 font-medium tabular-nums">
              ≈ {formatAmount(tx.amountNative!, userPreferredCurrency)}
            </span>
          )}
          <div className={`p-1.5 rounded-full ${isIncome ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
            {isIncome ? <ArrowDownRight className={`w-3.5 h-3.5 ${amountColor}`} /> : <ArrowUpRight className={`w-3.5 h-3.5 ${amountColor}`} />}
          </div>
        </div>
      </div>

      {/* Tags / Actions */}
      <div className="flex items-center flex-wrap gap-2 pt-4 border-t border-white/5">
        {/* Category Tag */}
        <button
          onClick={() => onEditCategory(tx)}
          className="group/tag relative flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 hover:bg-purple-500/10 hover:border-purple-500/30 transition-all active:scale-95"
        >
          <span className="text-[11px] font-medium text-white/70 group-hover/tag:text-purple-300 truncate max-w-[120px]">
            {tx.categoryName || "Sin categoría"}
          </span>
          <Pencil className="w-3 h-3 text-white/0 group-hover/tag:text-purple-400 transition-colors" />
        </button>

        {/* Account Tag */}
        <button
          onClick={() => onEditAccount(tx)}
          className="group/tag relative flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 hover:bg-blue-500/10 hover:border-blue-500/30 transition-all active:scale-95"
        >
          <span className="text-[11px] font-medium text-white/70 group-hover/tag:text-blue-300 truncate max-w-[120px]">
            {tx.paymentMethod?.name || "Sin cuenta"}
          </span>
          <Pencil className="w-3 h-3 text-white/0 group-hover/tag:text-blue-400 transition-colors" />
        </button>
        
        {/* View Details Link */}
        {tx.transactionType === "EXPENSE" && (
          <Link
            href={`/transactions/detail?id=${tx.id}`}
            className="ml-auto p-1.5 rounded-full bg-white/5 text-white/40 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10 transition-all"
            title="Ver detalles"
          >
            <Eye className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
    </motion.div>
  );
}