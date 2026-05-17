"use client";

import { useEffect, useState, Suspense } from "react";
import { Link } from "@/i18n/routing";
import { notFound, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, ArrowUp, ArrowDown, History, Loader2 } from "lucide-react";
import TransactionDialog from "../_components/TransactionDialog";
import DeleteGoalButton from "../_components/DeleteGoalButton";
import SpendFromSavingsDialog from "../_components/SpendFromSavingsDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { apiJson } from "@/lib/api";

type GoalTransaction = {
  id: string;
  createdAt: string;
  description?: string;
  amount: number;
  type: "MANUAL_DEPOSIT" | "WITHDRAWAL" | "BUDGET_SURPLUS" | string;
};

type Goal = {
  id: string;
  name: string;
  status: "ACTIVE" | "COMPLETED" | "ARCHIVED" | string;
  currency: string;
  currentAmount: number;
  targetAmount: number;
  createdAt: string;
  deadline?: string | null;
  transactions?: GoalTransaction[];
};

function GoalDetailsContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const t = useTranslations('Savings');

  const [goal, setGoal] = useState<Goal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchGoal() {
      if (!id) return;
      try {
        const res = await apiJson(`/api/proxy/savings/goals/${id}`);
        if (res.ok && res.data) {
          setGoal(res.data.goal);
        } else {
          setGoal(null);
        }
      } catch (error) {
        console.error("Error fetching goal:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchGoal();
  }, [id]);

  if (!id) return notFound();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-white/50" />
      </div>
    );
  }

  if (!goal) {
    return notFound();
  }

  const percentage = Math.min(
    100,
    Math.max(0, (goal.currentAmount / goal.targetAmount) * 100)
  );
  
  const formatter = new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: goal.currency,
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/savings">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-white">
              {goal.name}
              <span className={cn(
                "px-2 py-0.5 rounded-full text-xs font-medium border",
                goal.status === 'COMPLETED' ? "bg-green-500/10 text-green-500 border-green-500/20" : 
                goal.status === 'ARCHIVED' ? "bg-white/10 text-white/50 border-white/10" :
                "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
              )}>
                {goal.status}
              </span>
            </h1>
            <p className="text-white/50 text-sm mt-1">
              Creado el {new Date(goal.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <TransactionDialog 
            goalId={goal.id} 
            type="DEPOSIT" 
            currency={goal.currency}
            currentAmount={goal.currentAmount}
          />
          <TransactionDialog 
            goalId={goal.id} 
            type="WITHDRAWAL" 
            currency={goal.currency}
            currentAmount={goal.currentAmount}
          />
          <SpendFromSavingsDialog goalId={goal.id} currency={goal.currency} goalName={goal.name} currentAmount={goal.currentAmount} />
          <DeleteGoalButton goalId={goal.id} goalName={goal.name} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-white/5 backdrop-blur-2xl border-white/10 text-white rounded-3xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Progreso</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatter.format(goal.currentAmount)}
              <span className="text-sm font-normal text-white/50 ml-2">
                / {formatter.format(goal.targetAmount)}
              </span>
            </div>
            <div className="mt-4 h-2 w-full bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all"
                style={{ width: `${percentage}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-white/50">{percentage.toFixed(1)}% completado</p>
          </CardContent>
        </Card>

        {goal.deadline && (
          <Card className="bg-white/5 backdrop-blur-2xl border-white/10 text-white rounded-3xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Fecha límite</CardTitle>
              <Calendar className="h-4 w-4 text-white/50" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Date(goal.deadline).toLocaleDateString()}
              </div>
              <p className="mt-1 text-sm text-white/50">
                {Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} días restantes
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="bg-white/5 backdrop-blur-2xl border-white/10 text-white rounded-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5 text-white/50" />
            Historial de Movimientos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {goal.transactions && goal.transactions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-white/5">
                  <TableHead className="text-white/50">Fecha</TableHead>
                  <TableHead className="text-white/50">Tipo</TableHead>
                  <TableHead className="text-white/50">Descripción</TableHead>
                  <TableHead className="text-white/50 text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {goal.transactions.map((tx) => (
                  <TableRow key={tx.id} className="border-white/10 hover:bg-white/5">
                    <TableCell className="font-medium">
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {tx.type === 'WITHDRAWAL' ? (
                          <ArrowDown className="h-4 w-4 text-red-400" />
                        ) : (
                          <ArrowUp className="h-4 w-4 text-green-400" />
                        )}
                        <span className="text-sm">{tx.type}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-white/70">
                      {tx.description || '-'}
                    </TableCell>
                    <TableCell className={cn(
                      "text-right font-medium",
                      tx.type === 'WITHDRAWAL' ? "text-red-400" : "text-green-400"
                    )}>
                      {tx.type === 'WITHDRAWAL' ? '-' : '+'}{formatter.format(tx.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-white/50">
              No hay movimientos registrados
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function GoalDetailsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-white/50" /></div>}>
      <GoalDetailsContent />
    </Suspense>
  );
}