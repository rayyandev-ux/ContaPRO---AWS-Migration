"use client";

import { Link } from "@/i18n/routing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, Calendar, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

type Goal = {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: string;
  deadline?: string;
  status: string;
};

export default function GoalCard({ goal }: { goal: Goal }) {
  const t = useTranslations('Savings');
  const percentage = Math.min(
    100,
    Math.max(0, (goal.currentAmount / goal.targetAmount) * 100)
  );
  
  const formatter = new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: goal.currency,
  });

  return (
    <Link href={`/savings/detail?id=${goal.id}`}>
      <Card className="hover:bg-white/10 transition-colors cursor-pointer h-full bg-white/5 backdrop-blur-2xl border-white/10 text-white rounded-3xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium line-clamp-1">
            {goal.name}
          </CardTitle>
          <Target className="h-4 w-4 text-white/50" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatter.format(goal.currentAmount)}
          </div>
          <p className="text-xs text-white/50">
            {t('of')} {formatter.format(goal.targetAmount)}
          </p>
          
          <div className="mt-4 h-2 w-full rounded-full bg-white/10 overflow-hidden">
            <div 
              className={cn(
                "h-full rounded-full transition-all duration-500",
                percentage >= 100 ? "bg-green-500" : "bg-white"
              )} 
              style={{ width: `${percentage}%` }} 
            />
          </div>
          
          <div className="mt-2 flex items-center justify-between text-xs text-white/50">
            <span>{percentage.toFixed(0)}%</span>
            {goal.deadline && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(goal.deadline).toLocaleDateString()}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
