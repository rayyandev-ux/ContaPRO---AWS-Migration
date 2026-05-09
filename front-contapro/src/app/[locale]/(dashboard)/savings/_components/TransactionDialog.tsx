"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Minus } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";

type Props = {
  goalId: string;
  type: "DEPOSIT" | "WITHDRAWAL";
  currentAmount: number;
  currency: string;
};

export default function TransactionDialog({ goalId, type, currentAmount, currency }: Props) {
  const t = useTranslations('Savings');
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const isDeposit = type === "DEPOSIT";
  const title = isDeposit ? t('depositTitle') : t('withdrawTitle');
  const description = isDeposit 
    ? t('depositDescription')
    : t('withdrawDescription');
  const icon = isDeposit ? <Plus className="mr-2 h-4 w-4" /> : <Minus className="mr-2 h-4 w-4" />;

  const handleSubmit = async (formData: FormData) => {
    if (loading) return; // Prevent double submit
    setLoading(true);
    const amount = Number(formData.get("amount"));
    
    // Backend expects positive amount for the transaction record itself, but handles sign based on type? 
    // Wait, let's check backend logic.
    // In backend: 
    // if (type === 'WITHDRAWAL') { if (goal.currentAmount < amount) throw ...; newAmount = current - amount; transactionAmount = -amount; }
    // if (type === 'MANUAL_DEPOSIT') { newAmount = current + amount; transactionAmount = amount; }
    // So I should send positive amount and correct type.

    const apiType = isDeposit ? "MANUAL_DEPOSIT" : "WITHDRAWAL";
    const finalAmount = isDeposit ? amount : -amount;

    const data = {
      amount: finalAmount,
      type: apiType,
      description: formData.get("description"),
    };

    try {
      const res = await fetch(`/api/savings/goals/${goalId}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        // Handle error (e.g. insufficient funds)
        const err = await res.json();
        alert(err.message || t('transactionError'));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={isDeposit ? "default" : "outline"}>
          {icon}
          {isDeposit ? t('deposit') : t('withdraw')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md w-full border-white/20">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-white/50">{description}</DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/90">{t('amountLabel', { currency })}</label>
            <input
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              max={!isDeposit ? currentAmount : undefined}
              placeholder="0.00"
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
              required
            />
            {!isDeposit && (
              <p className="text-xs text-white/50">
                {t('availableAmount', { amount: currentAmount.toFixed(2), currency })}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white/90">{t('noteOptional')}</label>
            <input
              name="description"
              placeholder={isDeposit ? t('depositPlaceholder') : t('withdrawPlaceholder')}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
            />
          </div>

          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={loading} variant={isDeposit ? "default" : "destructive"}>
              {loading ? t('processing') : (isDeposit ? t('deposit') : t('withdraw'))}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
