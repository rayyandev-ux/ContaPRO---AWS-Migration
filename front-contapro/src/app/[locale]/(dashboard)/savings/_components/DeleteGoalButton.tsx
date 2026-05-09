"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/routing";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function DeleteGoalButton({ goalId, goalName }: { goalId: string; goalName: string }) {
  const t = useTranslations('Savings');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/savings/goals/${goalId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setOpen(false);
        router.push("/savings");
        router.refresh();
      } else {
        alert(t('deleteError'));
      }
    } catch (error) {
      console.error(error);
      alert(t('deleteError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="icon" disabled={loading}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md w-full border-white/20">
        <DialogHeader>
          <DialogTitle>{t('deleteGoalTitle')}</DialogTitle>
          <DialogDescription className="text-white/50">
            {t.rich('deleteGoalDescription', {
              goalName,
              strong: (chunks) => <strong className="text-white">{chunks}</strong>
            })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading} className="border-white/10 text-white hover:bg-white/10 hover:text-white">
            {t('cancel')}
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={loading}>
            {loading ? t('deleting') : t('delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
