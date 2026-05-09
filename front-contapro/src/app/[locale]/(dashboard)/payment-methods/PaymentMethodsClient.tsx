"use client";
import { useState, useEffect, useCallback } from "react";
import { useRealtime } from "@/hooks/useRealtime";
import { motion, AnimatePresence } from "framer-motion";
import {
  CreditCard,
  Wallet as WalletIcon,
  Landmark,
  Banknote,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Star,
  Clock,
  ChevronRight,
  Receipt,
  ArrowRightLeft,
  RefreshCcw,
} from "lucide-react";
import { useTranslations } from "next-intl";
import CreateMethodDialog from "./CreateMethodDialog";
import EditMethodDialog from "./EditMethodDialog";
import TransferDialog from "./TransferDialog";
import RebalanceDialog from "./RebalanceDialog";
import GlassCombobox from "@/components/ui/glass-combobox";

type Method = {
  id: string;
  name: string;
  provider: string;
  type: string;
  cardLast4?: string | null;
  accountNumber?: string | null;
  currency: string;
  active: boolean;
  balance: number;
  isFavorite: boolean;
};

type Transaction = {
  id: string;
  amount: number;
  currency: string;
  provider: string;
  description?: string | null;
  issuedAt: string;
  type: "EXPENSE" | "INCOME";
  category?: { name: string } | null;
};

type Props = {
  items: Method[];
  defaultPaymentMethodId: string | null;
  createMethod: (formData: FormData) => Promise<void>;
  setDefault: (formData: FormData) => Promise<void>;
  deactivate: (formData: FormData) => Promise<void>;
  updateMethod: (formData: FormData) => Promise<void>;
  transferMethod: (formData: FormData) => Promise<void>;
  rebalanceMethod: (formData: FormData) => Promise<void>;
};

function getIcon(type: string, provider: string) {
  const p = (provider || "").toLowerCase();
  if (
    p.includes("yape") ||
    p.includes("plin") ||
    p.includes("tunki") ||
    p.includes("wallet") ||
    type === "WALLET"
  )
    return WalletIcon;
  if (type === "EFECTIVO" || p.includes("efectivo") || p.includes("cash"))
    return Banknote;
  if (type === "TARJETA" || p.includes("tarjeta") || p.includes("card"))
    return CreditCard;
  return Landmark;
}

function getTypeColor(type: string) {
  switch (type) {
    case "WALLET":
      return "from-violet-500/20 to-purple-600/20 border-violet-500/30";
    case "TARJETA":
      return "from-blue-500/20 to-indigo-600/20 border-blue-500/30";
    case "CUENTA":
      return "from-cyan-500/20 to-teal-600/20 border-cyan-500/30";
    case "EFECTIVO":
      return "from-emerald-500/20 to-green-600/20 border-emerald-500/30";
    default:
      return "from-white/10 to-white/5 border-white/20";
  }
}

function getIconAccent(type: string) {
  switch (type) {
    case "WALLET":
      return "text-violet-400";
    case "TARJETA":
      return "text-blue-400";
    case "CUENTA":
      return "text-cyan-400";
    case "EFECTIVO":
      return "text-emerald-400";
    default:
      return "text-white/60";
  }
}

function formatCurrency(amount: number, currency: string) {
  const symbols: Record<string, string> = { PEN: "S/", USD: "$", EUR: "€" };
  const sym = symbols[currency] || currency;
  return `${sym} ${amount.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" });
}

export default function PaymentMethodsClient({
  items,
  defaultPaymentMethodId,
  createMethod,
  setDefault,
  deactivate,
  updateMethod,
  transferMethod,
  rebalanceMethod,
}: Props) {
  const t = useTranslations("PaymentMethods");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingMethod, setEditingMethod] = useState<Method | null>(null);
  const [transferMethodId, setTransferMethodId] = useState<string | null>(null);
  const [rebalanceMethodId, setRebalanceMethodId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalSpent, setTotalSpent] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loadingTx, setLoadingTx] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const selectedMethod = items.find((m) => m.id === selectedId);

  const fetchTransactions = useCallback(async (id: string) => {
    setLoadingTx(true);
    try {
      const res = await fetch(`/api/proxy/payment-methods/${id}/transactions?limit=10`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions || []);
        setTotalSpent(data.totalSpent || 0);
        setTotalCount(data.totalCount || 0);
      }
    } catch {
    } finally {
      setLoadingTx(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) {
      fetchTransactions(selectedId);
    } else {
      setTransactions([]);
      setTotalSpent(0);
      setTotalCount(0);
    }
  }, [selectedId, fetchTransactions]);

  useRealtime(() => {
    if (selectedId) fetchTransactions(selectedId);
  });

  const handleSelect = (id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  };

  const handleDelete = async (id: string, deleteTransactions: boolean) => {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("deleteTransactions", String(deleteTransactions));
    await deactivate(fd);
    if (selectedId === id) setSelectedId(null);
    setDeleteConfirmId(null);
  };

  const handleSetDefault = async (id: string) => {
    const fd = new FormData();
    fd.set("id", id);
    await setDefault(fd);
  };

  // ─── Empty state ───
  if (items.length === 0) {
    return (
      <section className="flex items-center justify-center min-h-[50vh]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-sm mx-auto"
        >
          <div className="mx-auto w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-5">
            <CreditCard className="w-7 h-7 text-white/40" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            {t("emptyTitle")}
          </h2>
          <p className="text-sm text-white/50 mb-6">{t("emptyDescription")}</p>
          <CreateMethodDialog onSubmit={createMethod}>
            <button className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-indigo-600/80 to-purple-600/80 text-white font-medium text-sm shadow-[0_0_20px_-4px_rgba(139,92,246,0.4)] hover:shadow-[0_0_30px_-4px_rgba(139,92,246,0.6)] transition-all hover:scale-105 active:scale-95 border border-white/10">
              <Plus className="w-4 h-4" />
              {t("createNew")}
            </button>
          </CreateMethodDialog>
        </motion.div>
      </section>
    );
  }

  // ─── Methods Grid ───
  return (
    <section id="payment-methods-page-container" className="space-y-6 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl md:text-5xl font-playfair font-bold text-white tracking-tight">
            {t("title")}
          </h1>
          <p className="text-sm md:text-base text-white/50 mt-1">{t("description")}</p>
        </div>
        <div id="btn-new-payment-method">
          <CreateMethodDialog onSubmit={createMethod}>
            <button className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium text-sm border border-white/10 backdrop-blur-md shadow-[0_0_15px_-3px_rgba(255,255,255,0.05)] transition-all hover:scale-105 active:scale-95">
              <Plus className="w-4 h-4" />
              {t("createNew")}
            </button>
          </CreateMethodDialog>
        </div>
      </div>

      {/* Cards Grid */}
      <div id="payment-methods-list" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <AnimatePresence mode="popLayout">
          {items.map((m, i) => {
            const Icon = getIcon(m.type, m.provider);
            const isSelected = selectedId === m.id;
            const isDefault = defaultPaymentMethodId === m.id;
            const typeColor = getTypeColor(m.type);
            const iconAccent = getIconAccent(m.type);

            return (
              <motion.div
                key={m.id}
                id={i === 0 ? "payment-method-card-0" : undefined}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                onClick={() => handleSelect(m.id)}
                className={`relative cursor-pointer group rounded-2xl border p-5 transition-all duration-300 backdrop-blur-xl ${
                  isSelected
                    ? `bg-gradient-to-br ${typeColor} shadow-[0_0_30px_-8px_rgba(139,92,246,0.35)] scale-[1.02]`
                    : "bg-white/5 border-white/10 hover:bg-white/8 hover:border-white/15 hover:shadow-lg"
                }`}
              >
                {/* Top row: icon + name + menu */}
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center justify-between flex-1 gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/10`}
                      >
                        <Icon className={`h-5 w-5 ${iconAccent}`} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white flex items-center gap-2">
                          {m.name}
                          {m.isFavorite && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
                          {isDefault && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 text-[10px] font-medium border border-emerald-500/20">
                              <Star className="w-2.5 h-2.5" fill="currentColor" />
                              {t("default")}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-white/40 truncate max-w-[140px]">
                          {m.provider}
                          {m.cardLast4 ? ` • ****${String(m.cardLast4).slice(-4)}` : ""}
                        </div>
                      </div>
                    </div>
                    <div className="text-right mr-2">
                      <p className="text-sm font-bold text-white">
                        {formatCurrency(m.balance, m.currency)}
                      </p>
                      <p className="text-[9px] text-white/30 uppercase tracking-tighter">Saldo Actual</p>
                    </div>
                  </div>

                  {/* 3-dot menu */}
                  <div className="relative">
                    <div onClick={(e) => e.stopPropagation()}>
                       <GlassCombobox
                         hideSearch
                         hideCheck
                         contentClassName="w-48"
                         trigger={
                          <div className="h-8 w-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors">
                            <MoreVertical className="h-4 w-4" />
                          </div>
                        }
                        options={[
                          {
                            value: "edit",
                            label: t("edit"),
                            icon: <Pencil className="w-3.5 h-3.5" />,
                          },
                          {
                            value: "transfer",
                            label: "Transferir",
                            icon: <ArrowRightLeft className="w-3.5 h-3.5" />,
                          },
                          {
                            value: "rebalance",
                            label: "Rebalancear",
                            icon: <RefreshCcw className="w-3.5 h-3.5" />,
                          },
                          ...(!isDefault
                            ? [
                                {
                                  value: "default",
                                  label: t("makeDefault"),
                                  icon: <Star className="w-3.5 h-3.5" />,
                                },
                              ]
                            : []),
                          {
                            value: "delete",
                            label: t("deactivate"),
                            icon: <Trash2 className="w-3.5 h-3.5 text-red-400" />,
                          },
                        ]}
                        onChange={(val) => {
                          if (val === "edit") {
                            setEditingMethod(m);
                          } else if (val === "transfer") {
                            setTransferMethodId(m.id);
                          } else if (val === "rebalance") {
                            setRebalanceMethodId(m.id);
                          } else if (val === "default") {
                            handleSetDefault(m.id);
                          } else if (val === "delete") {
                            setDeleteConfirmId(m.id);
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Bottom: currency + type badges */}
                <div className="flex items-end justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-white/40 uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/5 border border-white/10">
                      {m.currency}
                    </span>
                    <span className="text-[11px] text-white/30 uppercase tracking-wider">
                      {m.type === "WALLET" ? t("typeWallet") : 
                       m.type === "TARJETA" ? t("typeCardShort") :
                       m.type === "CUENTA" ? t("typeAccountShort") :
                       m.type === "EFECTIVO" ? t("typeCash") : m.type}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setDeleteConfirmId(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 10 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-[90vw] max-w-sm rounded-[32px] bg-white/10 backdrop-blur-2xl border border-white/20 p-8 shadow-2xl"
            >
              <h3 className="text-xl font-semibold text-white mb-2">
                {t("deleteConfirm")}
              </h3>
              <p className="text-sm text-white/50 mb-6">
                {items.find((m) => m.id === deleteConfirmId)?.name}
              </p>
              
              <form action={async (fd) => {
                const deleteTx = fd.get('deleteTransactions') === 'true';
                if (deleteConfirmId) handleDelete(deleteConfirmId, deleteTx);
              }}>
                <div className="flex items-center gap-3 mb-8 px-1">
                  <input
                    type="checkbox"
                    name="deleteTransactions"
                    id="delete-tx"
                    value="true"
                    className="w-4 h-4 rounded border-white/10 bg-white/5 text-red-500 focus:ring-red-500/30"
                  />
                  <label htmlFor="delete-tx" className="text-sm text-white/60 cursor-pointer select-none">
                    Ocultar también el historial de transacciones
                  </label>
                </div>
                
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmId(null)}
                    className="flex-1 px-6 py-2.5 rounded-full text-sm font-medium text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all backdrop-blur active:scale-95"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-2.5 rounded-full text-sm font-medium text-white bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 transition-all backdrop-blur active:scale-95"
                  >
                    {t("deactivate")}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected Method Detail — Transaction History */}
      <AnimatePresence>
        {selectedId && selectedMethod && (
          <motion.div
            layout
            initial={{ opacity: 0, y: 20, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: 10, height: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl p-6">
              {/* History Header */}
              <div className="flex items-center gap-3 mb-5">
                <Clock className="w-5 h-5 text-white/40" />
                <h3 className="text-base font-semibold text-white">
                  {t("transactionHistory")}
                </h3>
                {totalCount > 0 && (
                  <span className="ml-auto text-xs text-white/30">
                    {t("totalSpent")}: {formatCurrency(totalSpent, selectedMethod.currency)}
                  </span>
                )}
              </div>

              {/* Transactions List */}
              {loadingTx ? (
                <div className="flex items-center justify-center py-10">
                  <div className="w-6 h-6 border-2 border-white/20 border-t-purple-500 rounded-full animate-spin" />
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-10">
                  <Receipt className="w-8 h-8 text-white/20 mx-auto mb-3" />
                  <p className="text-sm text-white/40">{t("noTransactions")}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {transactions.map((tx, i) => (
                    <motion.div
                      key={tx.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">
                          {tx.description || tx.provider}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {tx.category?.name && (
                            <span className="text-[11px] text-white/30">
                              {tx.category.name}
                            </span>
                          )}
                          <span className="text-[11px] text-white/20">
                            {formatDate(tx.issuedAt)}
                          </span>
                        </div>
                      </div>
                      <div className={`text-sm font-semibold font-mono whitespace-nowrap ${tx.type === "INCOME" ? "text-green-400" : "text-red-400"}`}>
                        {tx.type === "INCOME" ? "+" : "-"}{formatCurrency(tx.amount, tx.currency)}
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </motion.div>
                  ))}

                  {totalCount > transactions.length && (
                    <p className="text-center text-xs text-white/30 pt-2">
                      {t("showingTransactions", {
                        from: 1,
                        to: transactions.length,
                        total: totalCount,
                      })}
                    </p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Dialog */}
      <EditMethodDialog
        method={editingMethod || items[0] || ({} as Method)}
        onUpdate={updateMethod}
        open={!!editingMethod}
        onOpenChange={(open) => !open && setEditingMethod(null)}
      />

      {/* Transfer Dialog */}
      <TransferDialog
        method={items.find(m => m.id === transferMethodId) || items[0] || ({} as Method)}
        allMethods={items}
        onTransfer={transferMethod}
        open={!!transferMethodId}
        onOpenChange={(open) => !open && setTransferMethodId(null)}
      />

      {/* Rebalance Dialog */}
      <RebalanceDialog
        method={items.find(m => m.id === rebalanceMethodId) || items[0] || ({} as Method)}
        onRebalance={rebalanceMethod}
        open={!!rebalanceMethodId}
        onOpenChange={(open) => !open && setRebalanceMethodId(null)}
      />
    </section>
  );
}
