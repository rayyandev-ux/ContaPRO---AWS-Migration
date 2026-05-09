"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Pencil, Trash2, Plus, Info, CreditCard, DollarSign, Globe 
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { useTranslations } from "next-intl";

interface PaymentMethodBudgetViewProps {
  monthLabel: string;
  generalAmount: number;
  totalAssigned: number;
  methods: Array<{ id: string; name: string; provider: string; cardLast4?: string | null; active: boolean }>;
  pmStatuses: Array<{ 
    paymentMethodId: string; 
    name: string; 
    budget?: { amount: number; currency: string; alertThreshold?: number | null }; 
    spent: number; 
    remaining: number 
  }>;
  currencyCode: string;
  monthStr: string;
  yearStr: string;
  onSave: (formData: FormData) => Promise<void>;
  onDelete: (formData: FormData) => Promise<void>;
}

export default function PaymentMethodBudgetView({
  monthLabel,
  generalAmount,
  totalAssigned,
  methods,
  pmStatuses,
  currencyCode,
  monthStr,
  yearStr,
  onSave,
  onDelete
}: PaymentMethodBudgetViewProps) {
  const t = useTranslations('PaymentMethodBudget');
  const [isPending, startTransition] = useTransition();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<string | null>(null);

  // Form State
  const [selectedMethod, setSelectedMethod] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [thresholdType, setThresholdType] = useState<"amount" | "percent">("amount");
  const [thresholdInput, setThresholdInput] = useState("");
  const [currency, setCurrency] = useState(currencyCode);

  const configuredIds = new Set(pmStatuses.filter(s => s.budget).map(s => s.paymentMethodId));
  const availableMethods = methods.filter(m => !configuredIds.has(m.id));
  const canAddMore = (generalAmount - totalAssigned) > 0 && availableMethods.length > 0;
  const remainingGeneral = Math.max(0, generalAmount - totalAssigned);

  const openCreate = () => {
    setSelectedMethod(availableMethods[0]?.id || "");
    setAmountInput("");
    setThresholdInput("");
    setCurrency(currencyCode);
    setThresholdType("amount");
    setIsCreateOpen(true);
  };

  const openEdit = (item: typeof pmStatuses[0]) => {
    if (!item.budget) return;
    setSelectedMethod(item.paymentMethodId);
    setAmountInput(String(item.budget.amount));
    setCurrency(item.budget.currency);
    
    if (item.budget.alertThreshold && item.budget.alertThreshold > 0 && item.budget.alertThreshold <= 1) {
      setThresholdType("percent");
      setThresholdInput(String(item.budget.alertThreshold * 100));
    } else {
      setThresholdType("amount");
      setThresholdInput(String(item.budget.alertThreshold || ""));
    }
    setEditingItem(item.paymentMethodId);
  };

  const handleSave = async (formData: FormData) => {
    formData.append("month", monthStr);
    formData.append("year", yearStr);
    startTransition(async () => {
      try {
        await onSave(formData);
        setIsCreateOpen(false);
        setEditingItem(null);
      } catch (e) {
        console.error("Error saving:", e);
      }
    });
  };

  const handleDelete = async (paymentMethodId: string) => {
    if (!confirm("¿Estás seguro de eliminar el presupuesto de este método?")) return;
    const formData = new FormData();
    formData.append("paymentMethodId", paymentMethodId);
    formData.append("month", monthStr);
    formData.append("year", yearStr);
    startTransition(async () => {
      try {
        await onDelete(formData);
      } catch (e) {
        console.error("Error deleting:", e);
      }
    });
  };

  const formatCurrency = (n: number, curr = currencyCode) => 
    new Intl.NumberFormat("es-PE", { style: "currency", currency: curr }).format(n);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-playfair font-bold tracking-tight text-white">{t('title')}</h2>
          <p className="text-white/50">{t('subtitle', { month: monthLabel })}</p>
        </div>
        <div className="flex items-center gap-2">
           <Button onClick={openCreate} disabled={!canAddMore || isPending} className="bg-white text-black hover:bg-white/90 rounded-xl">
              <Plus className="mr-2 h-4 w-4" />
              {t('assignMethod')}
           </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white/80">{t('generalBudget')}</CardTitle>
            <DollarSign className="h-4 w-4 text-white/50" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{formatCurrency(generalAmount)}</div>
            <p className="text-xs text-white/50">{t('totalAvailable')}</p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white/80">{t('assigned')}</CardTitle>
            <CreditCard className="h-4 w-4 text-white/50" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{formatCurrency(totalAssigned)}</div>
            <p className="text-xs text-white/50">
              {t('configuredMethods', { count: pmStatuses.filter(s => s.budget).length })}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white/80">{t('toAssign')}</CardTitle>
            <Info className="h-4 w-4 text-white/50" />
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", remainingGeneral < 0 ? "text-red-500" : "text-white")}>
              {formatCurrency(remainingGeneral)}
            </div>
            <p className="text-xs text-white/50">{t('availableForNew')}</p>
          </CardContent>
        </Card>
      </div>

      {/* List */}
      <Card className="bg-white/5 border border-white/10 backdrop-blur-md rounded-3xl mt-6">
        <CardHeader>
          <CardTitle className="text-white font-playfair">{t('statusTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {pmStatuses.filter(s => s.budget).length === 0 ? (
            <div className="text-center py-10 text-white/50">
              {t('noBudgets')}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pmStatuses.filter(s => s.budget).map(item => {
                const budgetAmt = item.budget?.amount || 0;
                const spent = item.spent || 0;
                const percent = budgetAmt > 0 ? (spent / budgetAmt) * 100 : 0;
                const isOver = percent > 100;
                const isWarning = percent > 80;
                
                return (
                  <div key={item.paymentMethodId} className="rounded-2xl border border-white/10 bg-white/5 p-4 relative group backdrop-blur-md">
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-white/50 hover:text-white hover:bg-white/10 rounded-xl" onClick={() => openEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-white/50 hover:text-red-400 hover:bg-white/10 rounded-xl" onClick={() => handleDelete(item.paymentMethodId)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="mb-4">
                      <h3 className="font-semibold text-white truncate pr-16">{item.name}</h3>
                      <div className="text-sm text-white/50 flex items-center gap-2 mt-1">
                        <span>{formatCurrency(budgetAmt, item.budget?.currency)}</span>
                        {item.budget?.currency !== currencyCode && <Globe className="h-3 w-3" />}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-white/50">{t('spent', { amount: formatCurrency(spent, item.budget?.currency) })}</span>
                        <span className={cn(isOver ? "text-red-500" : isWarning ? "text-orange-500" : "text-white/50")}>
                          {percent.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className={cn("h-full rounded-full transition-all", isOver ? "bg-red-500" : isWarning ? "bg-orange-500" : "bg-white/80")} 
                          style={{ width: `${Math.min(percent, 100)}%` }} 
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={isCreateOpen || !!editingItem} onOpenChange={(open) => {
        if (!open) {
          setIsCreateOpen(false);
          setEditingItem(null);
        }
      }}>
        <DialogContent className="sm:max-w-md w-full border-white/20">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar Presupuesto" : "Asignar Presupuesto"}</DialogTitle>
            <DialogDescription className="text-white/50">
              {editingItem ? "Modifica el límite de gasto para este método." : "Define un límite de gasto para un método de pago."}
            </DialogDescription>
          </DialogHeader>
          <form action={handleSave} className="grid gap-4 py-4">
            <input type="hidden" name="paymentMethodId" value={editingItem || selectedMethod} />
            
            <div className="grid gap-2">
              <Label htmlFor="method" className="text-white/70">Método de Pago</Label>
              {editingItem ? (
                 <div className="p-2 rounded-md border border-white/10 bg-white/5 text-white/80 text-sm">
                   {pmStatuses.find(c => c.paymentMethodId === editingItem)?.name}
                 </div>
              ) : (
                <Select name="paymentMethodId" value={selectedMethod} onValueChange={setSelectedMethod} disabled={!!editingItem}>
                  <SelectTrigger className="bg-white/5 border border-white/10 text-white focus:ring-white/20 rounded-xl">
                    <SelectValue placeholder="Selecciona un método" />
                  </SelectTrigger>
                  <SelectContent className="bg-black/90 backdrop-blur-2xl border border-white/10 text-white rounded-xl">
                    {availableMethods.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.provider} — {m.name}{m.cardLast4 ? ` (${String(m.cardLast4).slice(-4)})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="amount" className="text-white/70">Monto</Label>
                <div className="relative">
                   <span className="absolute left-3 top-2.5 text-white/50">$</span>
                   <Input 
                     id="amount" 
                     name="pmAmount" 
                     type="number" 
                     step="0.01" 
                     placeholder="0.00"
                     className="pl-7 bg-white/5 border border-white/10 text-white focus-visible:ring-white/20 placeholder:text-white/30 rounded-xl"
                     value={amountInput}
                     onChange={(e) => setAmountInput(e.target.value)}
                     required
                   />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="currency" className="text-white/70">Moneda</Label>
                <Select name="pmCurrency" value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="bg-white/5 border border-white/10 text-white focus:ring-white/20 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-black/90 backdrop-blur-2xl border border-white/10 text-white rounded-xl">
                    <SelectItem value="PEN">Soles (PEN)</SelectItem>
                    <SelectItem value="USD">Dólares (USD)</SelectItem>
                    <SelectItem value="EUR">Euros (EUR)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="text-white/70">Umbral de Alerta</Label>
              <div className="flex items-center gap-2">
                 <div className="flex rounded-xl bg-white/5 p-1 border border-white/10">
                    <button
                      type="button"
                      onClick={() => setThresholdType("amount")}
                      className={cn(
                        "px-3 py-1 text-xs rounded-lg transition-all",
                        thresholdType === "amount" ? "bg-white/10 text-white shadow-sm" : "text-white/50 hover:text-white hover:bg-white/5"
                      )}
                    >
                      $
                    </button>
                    <button
                      type="button"
                      onClick={() => setThresholdType("percent")}
                      className={cn(
                        "px-3 py-1 text-xs rounded-lg transition-all",
                        thresholdType === "percent" ? "bg-white/10 text-white shadow-sm" : "text-white/50 hover:text-white hover:bg-white/5"
                      )}
                    >
                      %
                    </button>
                 </div>
                 <Input 
                    name="pmThreshold"
                    type="number"
                    step={thresholdType === "percent" ? "1" : "0.01"}
                    placeholder={thresholdType === "percent" ? "80" : "500.00"}
                    className="bg-white/5 border border-white/10 text-white focus-visible:ring-white/20 placeholder:text-white/30 rounded-xl"
                    value={thresholdInput}
                    onChange={(e) => setThresholdInput(e.target.value)}
                 />
                 <input type="hidden" name="pmThresholdType" value={thresholdType} />
              </div>
              <p className="text-[10px] text-white/50">
                Recibe una alerta cuando el gasto supere este {thresholdType === "percent" ? "porcentaje" : "monto"}.
              </p>
            </div>

            <DialogFooter className="mt-4 gap-2 sm:gap-0">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => { setIsCreateOpen(false); setEditingItem(null); }} 
                className="border border-white/10 bg-transparent text-white/70 hover:bg-white/10 hover:text-white rounded-xl"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={isPending} 
                className="bg-white text-black hover:bg-white/90 rounded-xl"
              >
                {isPending ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
