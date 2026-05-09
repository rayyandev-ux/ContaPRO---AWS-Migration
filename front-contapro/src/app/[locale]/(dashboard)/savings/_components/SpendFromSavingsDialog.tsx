"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/routing";
import { CreditCard, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import GlassDatePicker from "@/components/ui/glass-date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Props = {
  goalId: string;
  goalName: string;
  currentAmount: number;
  currency: string;
};

import { useTranslations } from "next-intl";

export default function SpendFromSavingsDialog({ goalId, goalName, currentAmount, currency }: Props) {
  const t = useTranslations('Savings');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (formData: FormData) => {
    if (loading) return;
    setLoading(true);
    
    const amount = Number(formData.get("amount"));
    const description = formData.get("description") as string;
    const date = formData.get("date") as string;

    try {
      // We use the same transaction endpoint but with extra flags for creating an expense
      const res = await fetch(`/api/savings/goals/${goalId}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: -amount, // Withdrawal is negative
          type: "WITHDRAWAL",
          description: description || t('expenseFrom', { goalName }),
          createExpense: true,
          expenseDate: date ? new Date(date).toISOString() : new Date().toISOString(),
        }),
      });

      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        const err = await res.json();
        alert(err.message || t('expenseError'));
      }
    } catch (error) {
      console.error(error);
      alert(t('expenseError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <Wallet className="mr-2 h-4 w-4" />
          {t('spendFromSavings')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md w-full border-white/20">
        <DialogHeader>
          <DialogTitle>{t('recordExpenseTitle')}</DialogTitle>
          <DialogDescription className="text-white/50">
            {t.rich('recordExpenseDescription', {
              goalName,
              strong: (chunks) => <strong className="text-white">{chunks}</strong>
            })}
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/90">{t('amountLabel', { currency })}</label>
            <input
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              max={currentAmount}
              placeholder="0.00"
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
              required
            />
            <p className="text-xs text-white/50">
              {t('availableAmount', { amount: currentAmount.toFixed(2), currency })}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white/90">{t('conceptDescription')}</label>
            <input
              name="description"
              placeholder={t('conceptPlaceholder')}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white/90">{t('date')}</label>
            <GlassDatePicker
              name="date"
              defaultValue={new Date().toISOString().split('T')[0]}
              required
            />
          </div>

          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? t('processing') : t('recordExpenseAction')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
