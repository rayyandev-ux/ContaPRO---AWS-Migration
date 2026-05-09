import { cookies } from "next/headers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet } from "lucide-react";
import CreateGoalDialog from "./_components/CreateGoalDialog";
import GoalCard from "./_components/GoalCard";
import { getTranslations } from "next-intl/server";

async function getGoals() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ");
  const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";

  try {
    const res = await fetch(`${BASE}/api/savings/goals`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
      next: { tags: ["savings-goals"] },
    });
    
    if (res.ok) {
      const data = await res.json();
      return data.goals || [];
    }
  } catch (error) {
    console.error("Error fetching goals:", error);
  }
  return [];
}

export default async function SavingsPage() {
  const t = await getTranslations('Savings');
  const goals = await getGoals();
  
  const totalSaved = goals.reduce((acc: number, g: any) => acc + (g.currency === 'PEN' ? g.currentAmount : 0), 0); // Simplification: Sum only PEN for total or separate. 
  // Better: Show total per currency or just assume main currency for summary. 
  // Let's just show total saved in PEN for now (or multiple if mixed).
  
  // Group by currency
  const totalsByCurrency = goals.reduce((acc: any, g: any) => {
    acc[g.currency] = (acc[g.currency] || 0) + g.currentAmount;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6 p-6" id="savings-page-container">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-playfair font-bold tracking-tight text-white">{t('title')}</h1>
          <p className="text-white/50">{t('description')}</p>
        </div>
        <div id="btn-new-goal">
          <CreateGoalDialog />
        </div>
      </div>

      <div id="savings-summary-cards" className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Object.entries(totalsByCurrency).map(([currency, total]) => (
          <Card key={currency} className="bg-white/5 backdrop-blur-2xl border-white/10 text-white rounded-3xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t('totalSaved')} ({currency})
              </CardTitle>
              <Wallet className="h-4 w-4 text-white/50" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat("es-PE", { style: "currency", currency: currency as string }).format(total as number)}
              </div>
            </CardContent>
          </Card>
        ))}
        {Object.keys(totalsByCurrency).length === 0 && (
           <Card className="bg-white/5 backdrop-blur-2xl border-white/10 text-white rounded-3xl">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">
               {t('totalSaved')}
             </CardTitle>
             <Wallet className="h-4 w-4 text-white/50" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold">
               S/ 0.00
             </div>
           </CardContent>
         </Card>
        )}
      </div>

      <div>
        <h2 className="text-xl font-playfair font-semibold mb-4 text-white">{t('myGoals')}</h2>
        {goals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border border-white/10 rounded-3xl bg-white/5 backdrop-blur-2xl text-white">
            <div className="bg-white/10 p-4 rounded-full mb-4">
              <Wallet className="h-8 w-8 text-white/50" />
            </div>
            <h3 className="text-lg font-medium">{t('noGoals')}</h3>
            <p className="text-sm text-white/50 max-w-sm mt-1 mb-4">
              {t('createFirstGoal')}
            </p>
            <CreateGoalDialog />
          </div>
        ) : (
          <div id="savings-goals-list" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {goals.map((goal: any) => (
              <GoalCard key={goal.id} goal={goal} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
