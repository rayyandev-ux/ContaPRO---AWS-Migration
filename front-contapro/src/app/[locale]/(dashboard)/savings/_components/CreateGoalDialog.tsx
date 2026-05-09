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
import { Plus } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import GlassDatePicker from "@/components/ui/glass-date-picker";
import GlassCombobox from "@/components/ui/glass-combobox";

export default function CreateGoalDialog() {
  const t = useTranslations('Savings');
  const tNewExpense = useTranslations('NewExpense');
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);
    const data = {
      name: formData.get("name"),
      targetAmount: Number(formData.get("targetAmount")),
      currency: formData.get("currency"),
      deadline: formData.get("deadline") || undefined,
    };

    try {
      const res = await fetch("/api/savings/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        setOpen(false);
        router.refresh();
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
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {t('newGoal')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md w-full border-white/20">
        <DialogHeader>
          <DialogTitle>{t('createGoalTitle')}</DialogTitle>
          <DialogDescription className="text-white/50">
            {t('createGoalDescription')}
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/90">{t('goalName')}</label>
            <input
              name="name"
              placeholder={t('goalNamePlaceholder')}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/90">{t('targetAmount')}</label>
              <input
                name="targetAmount"
                type="number"
                step="0.01"
                placeholder="0.00"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/90">{t('currency')}</label>
              <GlassCombobox
                name="currency"
                defaultValue="PEN"
                options={[
                  { value: "PEN", label: tNewExpense('pen') },
                  { value: "USD", label: tNewExpense('usd') }
                ]}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white/90">{t('deadlineOptional')}</label>
            <GlassDatePicker
              name="deadline"
              placeholder={t('deadlineOptional')}
            />
          </div>

          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? t('creating') : t('createGoalAction')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
