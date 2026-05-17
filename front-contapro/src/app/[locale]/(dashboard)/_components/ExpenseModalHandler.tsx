"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/routing";
import { apiJson } from "@/lib/api";
import EditExpenseDialog from "@/app/[locale]/(dashboard)/transactions/detail/EditExpenseDialog";

function HandlerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const modal = searchParams.get("modal");
  const id = searchParams.get("id");

  const [expense, setExpense] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (modal === "edit_expense" && id) {
      setLoading(true);
      apiJson(`/api/expenses/${id}`)
        .then((res) => {
          if (res.ok && res.data) {
            setExpense(res.data.item || res.data);
          }
        })
        .finally(() => setLoading(false));
    } else {
      setExpense(null);
    }
  }, [modal, id]);

  const handleClose = () => {
    setExpense(null);
    // Eliminar los searchParams de la URL sin recargar la página
    router.replace("/dashboard", { scroll: false });
  };

  if (!modal || modal !== "edit_expense" || !id) return null;

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
      </div>
    );
  }

  if (!expense) return null;

  return (
    <EditExpenseDialog 
      item={expense} 
      open={true} 
      onOpenChange={(open) => {
        if (!open) handleClose();
      }} 
    />
  );
}

export default function ExpenseModalHandler() {
  return (
    <Suspense fallback={null}>
      <HandlerContent />
    </Suspense>
  );
}
