import { cookies } from "next/headers";
import {Link} from "@/i18n/routing";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, ArrowUp, ArrowDown, History } from "lucide-react";
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
import { getTranslations } from "next-intl/server";

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

async function getGoal(id: string) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ");
  const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";

  try {
    const res = await fetch(`${BASE}/api/savings/goals/${id}`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
      next: { tags: [`savings-goal-${id}`] },
    });
    
    if (res.ok) {
      const data = await res.json();
      return data.goal;
    }
  } catch (error) {
    console.error("Error fetching goal:", error);
  }
  return null;
}

export default async function GoalDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const goal = (await getGoal(id)) as Goal | null;
  const t = await getTranslations('Savings');

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
                "bg-blue-500/10 text-blue-500 border-blue-500/20"
              )}>
                {goal.status === 'ACTIVE' ? t('inProgress') : 
                 goal.status === 'COMPLETED' ? t('completed') : goal.status}
              </span>
            </h1>
            <div className="flex items-center gap-2 text-sm text-white/50">
              {goal.deadline && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {t('deadlineDate', { date: new Date(goal.deadline).toLocaleDateString() })}
                </span>
              )}
            </div>
          </div>
        </div>
        <DeleteGoalButton goalId={goal.id} goalName={goal.name} />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2 bg-white/5 backdrop-blur-2xl border-white/10 text-white rounded-3xl">
          <CardHeader>
            <CardTitle>{t('progress')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-sm font-medium text-white/50">{t('saved')}</p>
                <div className="text-4xl font-bold">{formatter.format(goal.currentAmount)}</div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-white/50">{t('goal')}</p>
                <div className="text-xl font-semibold">{formatter.format(goal.targetAmount)}</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="h-4 w-full rounded-full bg-white/10 overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    percentage >= 100 ? "bg-green-500" : "bg-white"
                  )} 
                  style={{ width: `${percentage}%` }} 
                />
              </div>
              <div className="flex justify-between text-sm text-white/50">
                <span>0%</span>
                <span>{percentage.toFixed(1)}%</span>
                <span>100%</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
                <TransactionDialog
                  goalId={goal.id}
                  type="DEPOSIT"
                  currentAmount={goal.currentAmount}
                  currency={goal.currency}
                />
                <div className="flex gap-2">
                  <TransactionDialog
                    goalId={goal.id}
                    type="WITHDRAWAL"
                    currentAmount={goal.currentAmount}
                    currency={goal.currency}
                  />
                  <SpendFromSavingsDialog
                    goalId={goal.id}
                    goalName={goal.name}
                    currentAmount={goal.currentAmount}
                    currency={goal.currency}
                  />
                </div>
              </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-1 bg-white/5 backdrop-blur-2xl border-white/10 text-white rounded-3xl">
          <CardHeader>
            <CardTitle>{t('details')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between border-b border-white/10 pb-2">
              <span className="text-sm text-white/50">{t('created')}</span>
              <span className="text-sm font-medium">{new Date(goal.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between border-b border-white/10 pb-2">
              <span className="text-sm text-white/50">{t('currency')}</span>
              <span className="text-sm font-medium">{goal.currency}</span>
            </div>
            <div className="flex justify-between border-b border-white/10 pb-2">
              <span className="text-sm text-white/50">{t('remaining')}</span>
              <span className="text-sm font-medium">
                {formatter.format(Math.max(0, goal.targetAmount - goal.currentAmount))}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white/5 backdrop-blur-2xl border-white/10 text-white rounded-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-white/50" />
            {t('transactionHistory')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader className="border-white/10">
              <TableRow className="border-white/10 hover:bg-white/5">
                <TableHead className="text-white/50">{t('date')}</TableHead>
                <TableHead className="text-white/50">{t('conceptDescription')}</TableHead>
                <TableHead className="text-white/50">{t('type')}</TableHead>
                <TableHead className="text-right text-white/50">{t('amount')}</TableHead>
              </TableRow>
            </TableHeader>
              <TableBody>
                {goal.transactions && goal.transactions.length > 0 ? (
                goal.transactions.map((tx) => (
                  <TableRow key={tx.id} className="border-white/10 hover:bg-white/5">
                    <TableCell>{new Date(tx.createdAt).toLocaleDateString()} {new Date(tx.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</TableCell>
                    <TableCell>{tx.description || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                         {tx.amount > 0 ? (
                           <ArrowUp className="h-4 w-4 text-green-400" />
                         ) : (
                           <ArrowDown className="h-4 w-4 text-red-400" />
                         )}
                         <span className="text-xs font-medium text-white">
                           {tx.type === 'MANUAL_DEPOSIT' ? t('manualDeposit') : 
                            tx.type === 'BUDGET_SURPLUS' ? t('budgetSurplus') : 
                            t('withdrawal')}
                         </span>
                      </div>
                    </TableCell>
                    <TableCell className={cn(
                      "text-right font-medium",
                      tx.amount > 0 ? "text-green-400" : "text-red-400"
                    )}>
                      {tx.amount > 0 ? '+' : ''}{formatter.format(tx.amount)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableCell colSpan={4} className="text-center py-8 text-white/50">
                    {t('noTransactions')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
