"use client";

import { useCallback, useState, useTransition, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiJson } from "@/lib/api";
import { 
  Pencil, AlertTriangle, CheckCircle, TrendingUp, Wallet, Settings, 
  History, Calendar, Plus, Minus, Info, ArrowUp, ArrowDown, FileText, Layers, Tag, Trash2,
  Receipt, ArrowRight, ExternalLink, Star
} from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { motion, AnimatePresence } from "framer-motion";
import { useRealtime } from "@/hooks/useRealtime";
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
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell,
} from "recharts";
import { cn } from "@/lib/utils";
import GlassCombobox from "@/components/ui/glass-combobox";

interface BudgetViewProps {
  monthLabel: string;
  amount: number;
  spent: number;
  remaining: number;
  alertThreshold: number;
  currencyCode: string;
  byMonthBudget?: Array<{ month: number; budget: number; spent: number; remaining: number; currency: string }>;
  categories: Array<{ id: string; name: string; budget: number; spent: number; remaining: number; expenseCount: number }>;
  unallocatedBudget: number;
  onSaveBudget: (formData: FormData) => Promise<void>;
  onSaveThreshold: (formData: FormData) => Promise<void>;
  onSaveCategoryBudget: (formData: FormData) => Promise<void>;
  onDeleteCategoryBudget?: (formData: FormData) => Promise<void>;
  onRegisterIncome?: (formData: FormData) => Promise<void>;
  budgetName?: string;
  allCategories?: Array<{ id: string; name: string }>;
  paymentMethods?: Array<{ id: string; name: string; currency: string; balance: number }>;
  source?: "created" | "issued";
}

interface BudgetLog {
  id: string;
  amount: number;
  previousTotal: number;
  newTotal: number;
  reason: string;
  type: "INITIAL" | "INCREASE" | "DECREASE";
  createdAt: string;
}

export default function BudgetView({
  monthLabel,
  amount,
  spent,
  remaining,
  alertThreshold,
  currencyCode,
  byMonthBudget = [],
  categories = [],
  unallocatedBudget = 0,
  onSaveBudget,
  onSaveThreshold,
  onSaveCategoryBudget,
  onDeleteCategoryBudget,
  onRegisterIncome,
  budgetName,
  allCategories = [],
  paymentMethods = [],
  source = "created",
}: BudgetViewProps) {
  const t = useTranslations('Budget');
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // --- Date Formatting ---
  const [yearStr, monthStr] = monthLabel.split("-");
  const dateObj = new Date(parseInt(yearStr), parseInt(monthStr) - 1);
  const formattedDate = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(dateObj);
  const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

  // --- Currency Formatting ---
  const formatCurrency = (n: number) =>
    new Intl.NumberFormat(locale === 'es' ? "es-PE" : "en-US", { style: "currency", currency: currencyCode }).format(n);


  // --- State for Management ---
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"adjust" | "history">("adjust");
  const [logs, setLogs] = useState<BudgetLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Adjust State
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustError, setAdjustError] = useState<string | null>(null);

  // Threshold State
  const [isThresholdDialogOpen, setIsThresholdDialogOpen] = useState(false);
  const [editThreshold, setEditThreshold] = useState(
    alertThreshold > 0 && alertThreshold <= 1 ? (alertThreshold * 100).toString() : alertThreshold.toString()
  );
  const [thresholdType, setThresholdType] = useState<"percent"|"amount">("percent");

  // Category Edit State
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<any | null>(null);
  const [categoryEditAmount, setCategoryEditAmount] = useState("");
  const [catThresholdInput, setCatThresholdInput] = useState("");
  const [catThresholdType, setCatThresholdType] = useState<"percent" | "amount">("percent");
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [selectedNewCategoryId, setSelectedNewCategoryId] = useState("");
  const [categoryToDelete, setCategoryToDelete] = useState<any | null>(null);

  // Income State
  const [incomePMId, setIncomePMId] = useState("");

  // Details Dialog State
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [monthExpenses, setMonthExpenses] = useState<any[]>([]);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [selectedMonthLabel, setSelectedMonthLabel] = useState("");
  const [selectedMonthData, setSelectedMonthData] = useState<{ month: number, year: number } | null>(null);

  const activeCategoryName = activeCategory?.name || activeCategory?.categoryName;

  const unassignedCategories = allCategories.filter(c => !categories.find(assigned => (assigned as any).categoryId === c.id));

  // --- History State (Previous Months) ---
  const prevMonths = Array.from(new Set(byMonthBudget
    .filter(m => m.month < parseInt(monthStr) && (((m.budget ?? 0) > 0) || ((m.spent ?? 0) > 0)))
    .map(m => m.month)
  )).sort((a, b) => b - a);

  // --- Visualization Logic ---
  const percentageSpent = amount > 0 ? Math.min((spent / amount) * 100, 100) : 0;
  
  let statusColor = "rgba(255,255,255,0.8)";
  if (percentageSpent >= 100) statusColor = "#ef4444"; 

  const gaugeData = [
    { name: t('spent'), value: percentageSpent, fill: statusColor }
  ];

  // Daily Projection Logic
  const today = new Date();
  const daysInMonth = new Date(parseInt(yearStr), parseInt(monthStr), 0).getDate();
  const currentDay = today.getDate();
  const isCurrentMonth = parseInt(monthStr) === (today.getMonth() + 1) && parseInt(yearStr) === today.getFullYear();
  const dailyAverage = isCurrentMonth && currentDay > 0 ? spent / currentDay : 0;
  const projectedTotal = isCurrentMonth ? dailyAverage * daysInMonth : spent;
  
  // --- History Data Prep ---
  const chartData = (byMonthBudget as any[])
    .filter(m => m.month <= parseInt(monthStr))
    .sort((a, b) => a.month - b.month)
    .slice(-6)
    .map(m => ({
      name: new Date(parseInt(yearStr), m.month - 1).toLocaleString(locale === 'es' ? 'es-ES' : 'en-US', { month: 'short' }),
      budget: m.budget,
      spent: m.spent,
      income: m.income || 0,
      remaining: m.remaining,
      month: m.month
    }));

  const avgSaving = chartData.length > 0 
    ? chartData.reduce((acc, curr) => acc + Math.max(0, curr.remaining), 0) / chartData.length 
    : 0;

  const healthScore = chartData.length > 0
    ? (chartData.filter(m => m.spent <= m.budget).length / chartData.length) * 100
    : 0;

  // --- Handlers ---

  const fetchLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const res = await apiJson<{ logs: BudgetLog[] }>(`/api/proxy/budget/logs?month=${monthStr}&year=${yearStr}&_t=${Date.now()}`);
      if (res.ok && res.data) {
        setLogs(res.data.logs);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingLogs(false);
    }
  }, [monthStr, yearStr]);

  // Fetch logs on mount for main view too
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useRealtime(() => {
    router.refresh();
    fetchLogs();
  });

  const handleRegisterIncome = async () => {
    if (!adjustAmount || !incomePMId) {
      setAdjustError("Debes especificar monto y cuenta de destino");
      return;
    }

    startTransition(async () => {
      try {
        const res = await apiJson("/api/proxy/income", {
          method: "POST",
          body: JSON.stringify({
            amount: Number(adjustAmount),
            description: adjustReason || "Ingreso manual",
            paymentMethodId: incomePMId,
            issuedAt: new Date().toISOString()
          })
        });

        if (res.ok) {
          router.refresh();
          setIsManageOpen(false);
          setAdjustAmount("");
          setAdjustReason("");
          setIncomePMId("");
        } else {
          setAdjustError(res.error || "Error al registrar ingreso");
        }
      } catch {
        setAdjustError("Error de conexión");
      }
    });
  };

  const handleSaveThreshold = async () => {
    const formData = new FormData();
    let val = parseFloat(editThreshold);
    if (thresholdType === "percent") val = val / 100;
    formData.append("threshold", val.toString());
    formData.append("month", monthStr);
    formData.append("year", yearStr);
    
    startTransition(async () => {
      await onSaveThreshold(formData);
      setIsThresholdDialogOpen(false);
    });
  };

  const openAddCategory = () => {
    setIsAddingNewCategory(true);
    setActiveCategory(null);
    setSelectedNewCategoryId("");
    setCategoryEditAmount("");
    setCatThresholdInput("80");
    setCatThresholdType("percent");
    setIsCategoryDialogOpen(true);
  };

  const handleSaveCategoryBudget = async () => {
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("amount", categoryEditAmount);
        formData.append("month", monthStr);
        formData.append("year", yearStr);

        let threshold = parseFloat(catThresholdInput || "0");
        if (catThresholdType === "percent") threshold = threshold / 100;
        formData.append("alertThreshold", threshold.toString());
        
        if (isAddingNewCategory) {
          if (!selectedNewCategoryId) return;
          formData.append("categoryId", selectedNewCategoryId);
        } else {
          formData.append("categoryId", activeCategory?.categoryId || activeCategory?.id || "");
        }
        
        await onSaveCategoryBudget(formData);
        setIsCategoryDialogOpen(false);
      } catch (err: any) {
        setAdjustError(err.message || "Error al asignar");
      }
    });
  };

  const handleDeleteCategoryBudget = async () => {
    if (!categoryToDelete || !onDeleteCategoryBudget) return;
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("month", monthStr);
        formData.append("year", yearStr);
        formData.append("categoryId", categoryToDelete.categoryId || categoryToDelete.id || "");
        
        await onDeleteCategoryBudget(formData);
        setCategoryToDelete(null);
      } catch (err: any) {
        setAdjustError(err.message || "Error al eliminar");
      }
    });
  };

  const openCategoryEdit = (cat: any) => {
    setActiveCategory(cat);
    setCategoryEditAmount(cat.amount ? String(cat.amount) : "");
    const threshold = cat.alertThreshold || 0.8;
    if (threshold > 0 && threshold <= 1) {
      setCatThresholdInput(String(Math.round(threshold * 100)));
      setCatThresholdType("percent");
    } else {
      setCatThresholdInput(String(threshold));
      setCatThresholdType("amount");
    }
    setIsCategoryDialogOpen(true);
  };

  const handleOpenMonthDetails = async (month: number, year: number) => {
    setLoadingExpenses(true);
    setIsDetailsDialogOpen(true);
    setMonthExpenses([]);
    setSelectedMonthData({ month, year });
    
    const label = new Date(year, month - 1).toLocaleString(locale === 'es' ? 'es-ES' : 'en-US', { month: 'long', year: 'numeric' });
    setSelectedMonthLabel(label.charAt(0).toUpperCase() + label.slice(1));
    
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)).toISOString();
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)).toISOString();
    const dateField = source === "created" ? "createdAt" : "issuedAt";
    
    try {
      const res = await apiJson<{ items: any[] }>(`/api/proxy/expenses?start=${start}&end=${end}&dateField=${dateField}&limit=100`);
      if (res.ok && res.data) {
        setMonthExpenses(res.data.items);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingExpenses(false);
    }
  };


  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 id="budget-header-title" className="text-3xl md:text-5xl font-playfair font-bold text-white tracking-tight">
            {budgetName ? budgetName : t('monthlyBudgetTitle')}
          </h1>
          <p className="text-white/60 mt-1 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {capitalizedDate}
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            id="btn-register-income"
            onClick={() => setIsManageOpen(true)} 
            className="bg-white text-black hover:bg-white/90 rounded-xl"
          >
            <Plus className="w-4 h-4 mr-2" />
            Registrar Ingreso
          </Button>
        </div>
      </div>

      {/* Top Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card id="card-total-balance" className="bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl">
            <CardHeader className="pb-2 border-b border-white/10">
              <CardTitle className="text-sm font-medium text-white/80 uppercase tracking-wide flex items-center gap-2">
                <Wallet className="w-4 h-4 text-white/50" />
                Saldo Total
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-white">{formatCurrency(amount)}</div>
              <p className="text-xs text-white/50 mt-1">Suma de todas tus cuentas</p>
            </CardContent>
          </Card>

          <Card id="card-current-spent" className="bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl">
            <CardHeader className="pb-2 border-b border-white/10">
              <CardTitle className="text-sm font-medium text-white/80 uppercase tracking-wide flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-white/50" />
                {t('currentSpent')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-white">{formatCurrency(spent)}</div>
              <div className="w-full bg-white/10 h-1.5 rounded-full mt-3 overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(percentageSpent, 100)}%`, backgroundColor: statusColor }}
                />
              </div>
            </CardContent>
          </Card>

          <Card id="card-available-amount" className="bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl">
            <CardHeader className="pb-2 border-b border-white/10">
              <CardTitle className="text-sm font-medium text-white/80 uppercase tracking-wide flex items-center gap-2">
                <CheckCircle className={`w-4 h-4 ${remaining < 0 ? 'text-red-500' : 'text-white/50'}`} />
                {t('available')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className={`text-2xl font-bold ${remaining < 0 ? "text-red-500" : "text-white"}`}>
                {formatCurrency(remaining)}
              </div>
              <p className="text-xs text-white/50 mt-1">
                {remaining < 0 ? t('exceededLimit') : t('availableToSpend')}
              </p>
            </CardContent>
          </Card>

          <Card id="card-unallocated-budget" className={`border backdrop-blur-md rounded-2xl ${amount > 0 && unallocatedBudget > 0 ? 'bg-indigo-500/10 border-indigo-500/30' : amount > 0 && unallocatedBudget < 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-white/5 border-white/10'}`}>
            <CardHeader className={`pb-2 border-b ${amount > 0 && unallocatedBudget > 0 ? 'border-indigo-500/30' : amount > 0 && unallocatedBudget < 0 ? 'border-red-500/30' : 'border-white/10'}`}>
              <CardTitle className="text-sm font-medium text-white/80 uppercase tracking-wide flex items-center gap-2">
                <Layers className={`w-4 h-4 ${amount > 0 && unallocatedBudget > 0 ? 'text-indigo-400' : amount > 0 && unallocatedBudget < 0 ? 'text-red-400' : 'text-white/50'}`} />
                {t('unallocated') || "Por Asignar"}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className={`text-2xl font-bold ${amount > 0 && unallocatedBudget > 0 ? "text-indigo-400" : amount > 0 && unallocatedBudget < 0 ? "text-red-400" : "text-white"}`}>
                {formatCurrency(unallocatedBudget)}
              </div>
              <p className="text-xs text-white/50 mt-1 flex items-center gap-1">
                 {amount > 0 && unallocatedBudget > 0 ? "Listo para tus sobres" : amount > 0 && unallocatedBudget < 0 ? "Presupuesto excedido en sobres" : "Todo asignado"}
              </p>
            </CardContent>
          </Card>
      </div>

      {/* Daily Projection Logic & Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Monthly Trend Chart */}
        <Card id="chart-budget-trend" className="lg:col-span-2 bg-white/5 border border-white/10 backdrop-blur-md rounded-3xl overflow-hidden">
          <CardHeader className="pb-2 border-b border-white/10 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-medium text-white/80 uppercase tracking-wide flex items-center gap-2">
                <History className="w-4 h-4 text-white/50" />
                Tendencia de Presupuesto vs Gasto
              </CardTitle>
              <p className="text-[10px] text-white/40 mt-1">Últimos {chartData.length} meses</p>
            </div>
            <div className="flex gap-4 text-[10px] uppercase tracking-widest font-medium">
               <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-white/20" /> <span className="text-white/60">Presupuesto</span></div>
               <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-indigo-500" /> <span className="text-white/60">Gasto</span></div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 pb-2">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                    tickFormatter={(val) => `$${val/1000}k`}
                  />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-[#1a1a1a]/90 border border-white/10 backdrop-blur-xl p-3 rounded-xl shadow-2xl">
                            <p className="text-xs font-bold text-white mb-2">{payload[0].payload.name}</p>
                            <div className="space-y-1">
                              <div className="flex justify-between gap-8 text-[10px]">
                                <span className="text-white/50">Presupuesto:</span>
                                <span className="text-white font-medium">{formatCurrency(payload[0].value as number)}</span>
                              </div>
                              <div className="flex justify-between gap-8 text-[10px]">
                                <span className="text-white/50">Gasto Real:</span>
                                <span className="text-white font-medium">{formatCurrency(payload[1].value as number)}</span>
                              </div>
                              <div className="pt-1 mt-1 border-t border-white/5 flex justify-between gap-8 text-[10px]">
                                <span className="text-white/50">Diferencia:</span>
                                <span className={cn("font-bold", (payload[0].value as number) - (payload[1].value as number) >= 0 ? "text-green-400" : "text-red-400")}>
                                  {formatCurrency((payload[0].value as number) - (payload[1].value as number))}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar 
                    dataKey="budget" 
                    fill="rgba(255,255,255,0.1)" 
                    radius={[4, 4, 0, 0]} 
                    barSize={30}
                  />
                  <Bar 
                    dataKey="spent" 
                    radius={[4, 4, 0, 0]} 
                    barSize={30}
                  >
                    {chartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.spent > entry.budget ? '#ef4444' : '#6366f1'} 
                        fillOpacity={0.8}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Right: Performance Metrics */}
        <div className="space-y-6 flex flex-col">
          <Card id="metric-avg-saving" className="flex-1 bg-white/5 border border-white/10 backdrop-blur-md rounded-3xl p-6 flex flex-col justify-center relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
               <TrendingUp className="w-24 h-24 text-white" />
            </div>
            <p className="text-xs text-white/50 uppercase tracking-widest mb-1">Ahorro Promedio</p>
            <h3 className="text-4xl font-bold text-white tracking-tight">{formatCurrency(avgSaving)}</h3>
            <p className="text-xs text-green-400 mt-2 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Basado en los últimos meses
            </p>
          </Card>

          <Card id="metric-health-score" className="flex-1 bg-white/5 border border-white/10 backdrop-blur-md rounded-3xl p-6 flex flex-col justify-center relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
               <CheckCircle className="w-24 h-24 text-white" />
            </div>
            <p className="text-xs text-white/50 uppercase tracking-widest mb-1">Salud Financiera</p>
            <div className="flex items-end gap-2">
               <h3 className="text-4xl font-bold text-white tracking-tight">{healthScore.toFixed(0)}%</h3>
               <span className="text-sm text-white/40 mb-1.5">de éxito</span>
            </div>
            <div className="w-full bg-white/5 h-1.5 rounded-full mt-4 overflow-hidden">
               <div 
                 className="h-full bg-indigo-500 rounded-full transition-all duration-1000" 
                 style={{ width: `${healthScore}%` }} 
               />
            </div>
          </Card>
        </div>
      </div>

      {/* Main Analysis Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Visual Gauge Chart */}
        <Card id="chart-consumption-gauge" className="lg:col-span-2 flex flex-col justify-center items-center py-8 relative overflow-hidden bg-white/5 border border-white/10 backdrop-blur-md rounded-3xl">
          <div className="absolute inset-0 bg-gradient-to-br from-white/0 via-white/0 to-white/5 pointer-events-none" />
          <div className="relative z-10 w-64 h-64">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <RadialBarChart 
                innerRadius="70%" 
                outerRadius="100%" 
                barSize={20} 
                data={gaugeData} 
                startAngle={180} 
                endAngle={0}
              >
                <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                <RadialBar
                  background={{ fill: 'rgba(255,255,255,0.1)' }}
                  dataKey="value"
                  cornerRadius={30}
                />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pt-8">
              <span className="text-5xl font-bold text-white tracking-tighter">{percentageSpent.toFixed(0)}%</span>
              <span className="text-sm text-white/50 uppercase tracking-widest mt-1">{t('consumed')}</span>
            </div>
          </div>
          <div className="mt-4 text-center z-10">
            <p className="text-white/60 text-sm max-w-md mx-auto">
              {t.rich('consumedMessage', {
                percent: percentageSpent.toFixed(1),
                amount: formatCurrency(amount),
                highlight: (chunks) => <span className="text-white font-medium">{chunks}</span>,
              })}
            </p>
          </div>
        </Card>

        {/* Right: Detailed Analysis & Logs */}
        <div className="space-y-6 flex flex-col">
          {/* Daily Average */}
          <Card className="bg-white/5 border border-white/10 backdrop-blur-md rounded-3xl">
            <CardHeader className="pb-2 border-b border-white/10">
              <CardTitle className="text-sm font-medium text-white/80 uppercase tracking-wide">{t('spendingPace')}</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between mb-4">
                 <div>
                   <div className="text-2xl font-bold text-white">{formatCurrency(dailyAverage)}</div>
                   <div className="text-xs text-white/50">{t('dailyAverage')}</div>
                 </div>
                 <div className="p-3 bg-white/10 rounded-full">
                    <TrendingUp className="w-5 h-5 text-white/60" />
                 </div>
              </div>
              
              {isCurrentMonth && (
                <div className="pt-4 border-t border-white/10">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-white/60">{t('endOfMonthProjection')}</span>
                    <span className="text-sm font-bold text-white">{formatCurrency(projectedTotal)}</span>
                  </div>
                  <div className="mt-2 text-xs text-white/50">
                    {projectedTotal > amount ? (
                      <span className="text-red-400 flex items-center gap-1">
                         <AlertTriangle className="w-3 h-3" />
                         {t('willExceedBy', { amount: formatCurrency(projectedTotal - amount) })}
                      </span>
                    ) : (
                      <span className="text-white/60 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        {t('willSave', { amount: formatCurrency(amount - projectedTotal) })}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Logs (NEW INTEGRATION) */}
          <Card className="flex-1 bg-white/5 border border-white/10 backdrop-blur-md rounded-3xl overflow-hidden flex flex-col">
             <CardHeader className="pb-2 border-b border-white/10">
                <CardTitle className="text-sm font-medium text-white/80 uppercase tracking-wide flex items-center justify-between">
                   Ajustes Recientes
                   <FileText className="w-4 h-4 text-white/30" />
                </CardTitle>
             </CardHeader>
             <CardContent className="pt-4 flex-1 overflow-y-auto max-h-[200px] custom-scrollbar px-4">
                {logs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-white/30 py-8">
                     <Info className="w-8 h-8 mb-2 opacity-20" />
                     <p className="text-[10px] uppercase tracking-tighter">Sin ajustes registrados</p>
                  </div>
                ) : (
                  <div className="space-y-3 pb-2">
                     {logs.slice(0, 5).map(log => (
                        <div key={log.id} className="p-2.5 bg-white/5 border border-white/5 rounded-xl flex items-start gap-2.5">
                           <div className={cn(
                             "mt-0.5 p-1 rounded-full shrink-0",
                             log.type === "INCREASE" ? "bg-green-500/20 text-green-400" : 
                             log.type === "DECREASE" ? "bg-red-500/20 text-red-400" :
                             "bg-white/10 text-white/50"
                           )}>
                             {log.type === "INCREASE" && <ArrowUp className="w-2.5 h-2.5" />}
                             {log.type === "DECREASE" && <ArrowDown className="w-2.5 h-2.5" />}
                             {log.type === "INITIAL" && <FileText className="w-2.5 h-2.5" />}
                           </div>
                           <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-medium text-white/80 truncate leading-none mb-1">{log.reason}</p>
                              <div className="flex justify-between items-center">
                                 <span className="text-[9px] text-white/40">
                                   {new Date(log.createdAt).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US', { day: '2-digit', month: 'short' })}
                                 </span>
                                 <span className={cn("text-[10px] font-bold", log.type === "DECREASE" ? "text-red-500" : "text-white/80")}>
                                   {log.type === "DECREASE" ? "-" : "+"}{formatCurrency(Math.abs(log.amount))}
                                 </span>
                              </div>
                           </div>
                        </div>
                     ))}
                  </div>
                )}
             </CardContent>
          </Card>
        </div>
      </div>

       {/* Categories / Envelopes Section */}
      <div id="section-category-envelopes" className="mt-10 pt-10 border-t border-white/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h2 className="text-2xl md:text-3xl font-playfair font-bold text-white flex items-center gap-2">
            <Layers className="w-6 h-6 text-white/50" />
            {t('categoryEnvelopes') || 'Sobres de Categorías'}
          </h2>
          <div className="flex items-center gap-3">
            <Button 
              id="btn-add-envelope"
              variant="outline" 
              onClick={openAddCategory}
              className="border border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white rounded-xl shadow-lg border-dashed"
            >
              <Plus className="w-4 h-4 mr-2" />
              Añadir Sobre
            </Button>
          </div>
        </div>
         
         {categories && categories.length > 0 ? (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {categories.map((cat) => {
                 const pct = cat.budget > 0 ? Math.min((cat.spent / cat.budget) * 100, 100) : 0;
                 return (
                    <Card key={cat.id} onClick={() => openCategoryEdit(cat)} className="relative group cursor-pointer bg-white/5 border border-white/10 backdrop-blur-md overflow-hidden hover:bg-white/10 transition-colors">
                     <div className="absolute top-0 left-0 h-1 bg-white/10 w-full">
                        <div
                          className={`h-full transition-all duration-500 ${cat.remaining < 0 ? 'bg-red-500' : cat.budget > 0 && pct > 80 ? 'bg-orange-500' : 'bg-indigo-400'}`}
                          style={{ width: `${pct}%` }}
                        />
                     </div>
                     
                     <CardContent className="pt-6 pb-4 px-4">
                        <div className="flex justify-between items-start mb-4">
                           <div>
                              <h3 className="text-lg font-bold text-white leading-tight flex items-center gap-2">
                                 <Tag className="w-4 h-4 text-white/50" />
                                 {cat.name || (cat as any).categoryName}
                              </h3>
                              <p className="text-xs text-white/40 mt-1">{cat.expenseCount} gastos</p>
                           </div>
                           <Button 
                             variant="ghost" 
                             size="icon" 
                             className="w-8 h-8 rounded-full text-white/50 hover:text-red-400 hover:bg-white/10 z-10 relative"
                             onClick={(e) => {
                               e.stopPropagation();
                               setCategoryToDelete(cat);
                             }}
                             title="Eliminar"
                           >
                              <Trash2 className="w-4 h-4" />
                           </Button>
                        </div>
                         
                         <div className="grid grid-cols-2 gap-2 text-sm mt-4">
                            <div className="bg-white/5 rounded-lg p-2 border border-white/5 text-center">
                               <p className="text-[10px] text-white/50 uppercase tracking-widest mb-1">Presupuesto</p>
                               <p className={`font-semibold ${cat.budget > 0 ? 'text-white' : 'text-white/30'}`}>{cat.budget > 0 ? formatCurrency(cat.budget) : "-"}</p>
                            </div>
                            <div className="bg-white/5 rounded-lg p-2 border border-white/5 text-center">
                               <p className="text-[10px] text-white/50 uppercase tracking-widest mb-1">Disponible</p>
                               <p className={`font-semibold ${cat.remaining < 0 ? 'text-red-400' : (cat.budget > 0 ? 'text-green-400' : 'text-white/30')}`}>
                                  {cat.budget > 0 ? formatCurrency(cat.remaining) : "-"}
                               </p>
                            </div>
                         </div>
                         <div className="mt-3 flex justify-between items-center px-1">
                             <span className="text-xs text-white/50 uppercase tracking-wider">Gastado</span>
                             <span className="text-sm font-bold text-white">{formatCurrency(cat.spent)}</span>
                         </div>
                     </CardContent>
                   </Card>
                 );
              })}
           </div>
         ) : (
           <div className="text-center py-12 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-md">
              <Layers className="w-12 h-12 text-white/20 mx-auto mb-3" />
              <p className="text-white/60 mb-4">No tienes sobres de categorías asignados este mes.</p>
              <Button onClick={openAddCategory} className="bg-white text-black hover:bg-white/90 rounded-xl">
                 Comenzar a asignar
              </Button>
           </div>
         )}
       </div>


      {/* History Section - REFACTORED TO ORGANIC VIEW */}
      {prevMonths.length > 0 && (
        <div className="mt-10 pt-10 border-t border-white/10">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl md:text-3xl font-playfair font-bold text-white flex items-center gap-2">
              <Calendar className="w-6 h-6 text-white/50" />
              Comparativa de Meses Anteriores
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {chartData.filter(m => m.month !== parseInt(monthStr)).reverse().map(m => {
                const savingsRate = m.income > 0 ? Math.round(((m.income - m.spent) / m.income) * 100) : 0;
                const isPositive = m.income >= m.spent;
                const healthStatus = m.spent <= m.budget ? (savingsRate > 20 ? 'EXCELENTE' : 'BUENO') : (m.spent > m.income ? 'DÉFICIT' : 'AJUSTADO');
                const statusColors = {
                  'EXCELENTE': 'bg-green-500/20 text-green-400 border-green-500/20',
                  'BUENO': 'bg-blue-500/20 text-blue-400 border-blue-500/20',
                  'AJUSTADO': 'bg-orange-500/20 text-orange-400 border-orange-500/20',
                  'DÉFICIT': 'bg-red-500/20 text-red-400 border-red-500/20'
                };

                return (
                  <Card 
                    key={m.month} 
                    onClick={() => handleOpenMonthDetails(m.month, parseInt(yearStr))}
                    className="bg-white/5 border border-white/10 backdrop-blur-md rounded-[2rem] p-6 hover:bg-white/10 transition-all cursor-pointer group relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-4">
                      <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-full border tracking-widest", statusColors[healthStatus as keyof typeof statusColors])}>
                        {healthStatus}
                      </span>
                    </div>

                    <div className="mb-6">
                      <span className="text-xl font-playfair font-bold text-white capitalize">
                        {new Date(parseInt(yearStr), m.month - 1).toLocaleString(locale === 'es' ? 'es-ES' : 'en-US', { month: 'long' })}
                      </span>
                      <p className="text-[10px] text-white/30 uppercase tracking-widest mt-1">Resumen de Salud Financiera</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="space-y-1">
                        <p className="text-[10px] text-white/40 uppercase font-medium">Ingresos</p>
                        <p className="text-sm font-bold text-green-400">{formatCurrency(m.income)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] text-white/40 uppercase font-medium">Egresos</p>
                        <p className="text-sm font-bold text-red-400">{formatCurrency(m.spent)}</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-[10px] mb-1.5">
                          <span className="text-white/40 uppercase">Cumplimiento Presupuesto</span>
                          <span className="text-white/80 font-bold">{Math.round(Math.min((m.spent/m.budget)*100, 100))}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                          <div 
                            className={cn("h-full transition-all duration-1000", m.spent <= m.budget ? "bg-indigo-500" : "bg-red-500")}
                            style={{ width: `${Math.min((m.spent/m.budget)*100, 100)}%` }}
                          />
                        </div>
                      </div>

                      <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-white/40 uppercase mb-0.5">Ahorro Neto</p>
                          <p className={cn("text-lg font-bold", isPositive ? "text-white" : "text-red-400")}>
                            {formatCurrency(m.income - m.spent)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-white/40 uppercase mb-0.5">Tasa</p>
                          <p className={cn("text-lg font-bold", isPositive ? "text-indigo-400" : "text-red-400")}>
                            {savingsRate}%
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 flex items-center justify-center gap-2 text-[10px] text-white/20 group-hover:text-white/40 transition-colors uppercase tracking-widest font-bold">
                      <History className="w-3 h-3" />
                      Click para ver detalles
                    </div>
                  </Card>
                );
             })}
          </div>
        </div>
      )}

      {/* Register Income Dialog */}
      <Dialog open={isManageOpen} onOpenChange={setIsManageOpen}>
        <DialogContent className="sm:max-w-md w-full border-white/20 bg-[#1a1a1a]">
          <DialogHeader>
            <DialogTitle>
              Registrar Ingreso
            </DialogTitle>
            <DialogDescription className="text-white/50">
              Añade fondos a una de tus cuentas para incrementar tu saldo disponible.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="income-amount" className="text-white/70">Monto</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50">{currencyCode === 'PEN' ? 'S/' : '$'}</span>
                <Input
                  id="income-amount"
                  type="number"
                  placeholder="0.00"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  className="bg-white/5 border-white/10 text-white pl-8 rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="income-pm" className="text-white/70">Cuenta de Destino</Label>
              <GlassCombobox
                name="incomePMId"
                value={incomePMId}
                onChange={setIncomePMId}
                className="rounded-xl h-10 w-full"
                placeholder="Seleccionar cuenta..."
                options={paymentMethods.map(pm => ({
                  value: pm.id,
                  label: `${pm.name} (${formatCurrency(pm.balance)})`
                }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="income-reason" className="text-white/70">Descripción (Opcional)</Label>
              <Input
                id="income-reason"
                type="text"
                placeholder="Ej. Sueldo, Transferencia..."
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                className="bg-white/5 border-white/10 text-white rounded-xl"
              />
            </div>

            {adjustError && (
              <p className="text-xs text-red-400 flex items-center gap-1 mt-2">
                <AlertTriangle className="w-3 h-3" />
                {adjustError}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsManageOpen(false)}
              className="border-white/10 bg-white/5 text-white hover:bg-white/10 rounded-xl"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleRegisterIncome}
              disabled={isPending || !adjustAmount || !incomePMId}
              className="bg-white text-black hover:bg-white/90 rounded-xl"
            >
              {isPending ? "Registrando..." : "Registrar Ingreso"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Configure Category Budget Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
         <DialogContent className="sm:max-w-md w-full border-white/20 bg-[#1a1a1a]">
            <DialogHeader>
               <DialogTitle>Asignar Presupuesto</DialogTitle>
               <DialogDescription className="text-white/50">
                  {isAddingNewCategory 
                    ? "Selecciona una categoría y asígnale un presupuesto"
                    : `¿Cuánto del presupuesto deseas asignar al sobre "${activeCategoryName}"?`
                  }
               </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
               {isAddingNewCategory && (
                 <div className="space-y-2">
                   <Label className="text-white/70">Categoría</Label>
                   <GlassCombobox
                     name="categoryId"
                     value={selectedNewCategoryId}
                     onChange={setSelectedNewCategoryId}
                     className="rounded-xl h-10 w-full"
                     placeholder="Seleccionar categoría..."
                     options={unassignedCategories.map(c => ({
                       value: c.id,
                       label: c.name
                     }))}
                   />
                   {unassignedCategories.length === 0 && (
                     <p className="text-xs text-orange-400 mt-1">Ya asignaste presupuestos a todas tus categorías.</p>
                   )}
                 </div>
               )}

               <Label className="text-white/70">Monto asignado ({currencyCode})</Label>
               <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50">{currencyCode === 'PEN' ? 'S/' : '$'}</span>
                  <Input 
                     type="number"
                     placeholder="0.00"
                     value={categoryEditAmount}
                     onChange={(e) => setCategoryEditAmount(e.target.value)}
                     className="pl-8 bg-white/5 border border-white/10 text-white focus-visible:ring-white/20 rounded-xl"
                  />
               </div>

               <div className="space-y-2">
                  <Label className="text-white/70">Umbral de Alerta</Label>
                  <div className="flex items-center gap-2">
                    <div className="flex rounded-xl bg-white/5 p-1 border border-white/10 h-10">
                      <button
                        type="button"
                        onClick={() => setCatThresholdType("amount")}
                        className={cn(
                          "px-3 h-full text-xs rounded-lg transition-all",
                          catThresholdType === "amount" ? "bg-white/10 text-white shadow-sm" : "text-white/50 hover:text-white hover:bg-white/5"
                        )}
                      >
                        {currencyCode === 'PEN' ? 'S/' : '$'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCatThresholdType("percent")}
                        className={cn(
                          "px-3 h-full text-xs rounded-lg transition-all",
                          catThresholdType === "percent" ? "bg-white/10 text-white shadow-sm" : "text-white/50 hover:text-white hover:bg-white/5"
                        )}
                      >
                        %
                      </button>
                    </div>
                    <Input 
                      type="number"
                      step={catThresholdType === "percent" ? "1" : "0.01"}
                      placeholder={catThresholdType === "percent" ? "80" : "0.00"}
                      value={catThresholdInput}
                      onChange={(e) => setCatThresholdInput(e.target.value)}
                      className="bg-white/5 border border-white/10 text-white focus-visible:ring-white/20 rounded-xl h-10"
                    />
                  </div>
                  <p className="text-[10px] text-white/40">
                    Recibe una notificación cuando el gasto en este sobre supere el {catThresholdType === "percent" ? `${catThresholdInput || '0'}%` : `${currencyCode} ${catThresholdInput || '0.00'}`}.
                  </p>
               </div>
               
               <div className="text-xs text-white/50 bg-white/5 p-3 rounded-lg flex items-start gap-2 border border-white/5">
                  <Info className="w-4 h-4 mt-0.5 shrink-0" />
                  <p>Asigna un monto a esta categoría para controlar tus gastos y restarlo del total Por Asignar. Puedes dejarlo en blanco o en 0 para quitar el límite.</p>
               </div>
            </div>
            <DialogFooter>
               <Button 
                  onClick={handleSaveCategoryBudget} 
                  disabled={isPending}
                  className="w-full bg-white text-black hover:bg-white/90 rounded-xl"
               >
                  {isPending ? "Guardando..." : "Guardar Asignación"}
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

      {/* Threshold Dialog */}
      <Dialog open={isThresholdDialogOpen} onOpenChange={setIsThresholdDialogOpen}>
        <DialogContent className="sm:max-w-md w-full border-white/20 bg-[#1a1a1a]">
          <DialogHeader>
             <DialogTitle>{t('configureAlerts')}</DialogTitle>
             <DialogDescription className="text-white/50">{t('alertsDescription')}</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
             <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
                <button 
                  onClick={() => setThresholdType("percent")}
                  className={cn("flex-1 py-1.5 text-xs font-medium rounded-lg transition-all", thresholdType === "percent" ? "bg-white/10 text-white shadow-sm border border-white/10" : "text-white/50 hover:text-white hover:bg-white/5")}
                >{t('percent')}</button>
                <button 
                  onClick={() => setThresholdType("amount")}
                  className={cn("flex-1 py-1.5 text-xs font-medium rounded-lg transition-all", thresholdType === "amount" ? "bg-white/10 text-white shadow-sm border border-white/10" : "text-white/50 hover:text-white hover:bg-white/5")}
                >{t('fixedAmount')}</button>
             </div>
             <div className="relative">
                <Input 
                  type="number" 
                  value={editThreshold}
                  onChange={e => setEditThreshold(e.target.value)}
                  className="bg-white/5 border border-white/10 text-white focus-visible:ring-white/20 rounded-xl"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 text-sm">
                  {thresholdType === "percent" ? "%" : "$"}
                </span>
             </div>
          </div>
          <DialogFooter>
             <Button onClick={handleSaveThreshold} className="w-full bg-white text-black hover:bg-white/90 rounded-xl">{t('saveConfiguration')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!categoryToDelete} onOpenChange={(open) => !open && setCategoryToDelete(null)}>
        <DialogContent className="sm:max-w-md w-full border-white/20 bg-[#1a1a1a]">
          <DialogHeader>
            <DialogTitle>Eliminar Sobre</DialogTitle>
            <DialogDescription className="text-white/50">
              ¿Estás seguro de que deseas eliminar el sobre de "{categoryToDelete?.name || categoryToDelete?.categoryName}"?
              Tus gastos no se verán afectados, solo se eliminará el límite de presupuesto para esta categoría.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="outline" onClick={() => setCategoryToDelete(null)} className="border-white/10 bg-white/5 text-white hover:bg-white/10 rounded-xl">Cancelar</Button>
            <Button onClick={handleDeleteCategoryBudget} className="bg-red-500 text-white hover:bg-red-600 rounded-xl" disabled={isPending}>
              {isPending ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Month Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="sm:max-w-2xl w-full border-white/20 bg-[#1a1a1a] flex flex-col max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl font-playfair">
              <History className="w-5 h-5 text-white/50" />
              Detalle de Gastos: {selectedMonthLabel}
            </DialogTitle>
            <DialogDescription className="text-white/50">
              Listado completo de transacciones registradas en este periodo (según {source === 'created' ? 'fecha de registro' : 'fecha de recibo'}).
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar my-4 relative">
             {loadingExpenses ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                   <div className="w-10 h-10 border-4 border-white/10 border-t-indigo-500 rounded-full animate-spin" />
                   <p className="text-sm text-white/40 uppercase tracking-widest animate-pulse">Cargando transacciones...</p>
                </div>
             ) : monthExpenses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                   <Receipt className="w-12 h-12 text-white/10 mb-4" />
                   <p className="text-white/60 font-medium">No hay gastos registrados</p>
                   <p className="text-xs text-white/30 mt-1">Este mes no tuvo actividad financiera reportada.</p>
                </div>
             ) : (
                <div className="space-y-3">
                   {monthExpenses.map((exp: any) => (
                      <div 
                        key={exp.id} 
                        className="group flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white/10 transition-all"
                      >
                         <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform">
                               <Tag className="w-5 h-5 text-white/60" />
                            </div>
                            <div className="min-w-0">
                               <p className="text-sm font-bold text-white truncate max-w-[200px] md:max-w-[300px]">
                                 {exp.description || "Sin descripción"}
                               </p>
                               <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/10 text-white/60 font-medium uppercase">
                                     {exp.category?.name || "Sin categoría"}
                                  </span>
                                  <span className="text-[10px] text-white/30 flex items-center gap-1">
                                     <Calendar className="w-2.5 h-2.5" />
                                     {new Date(exp.issuedAt || exp.createdAt).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US', { day: '2-digit', month: 'short' })}
                                  </span>
                               </div>
                            </div>
                         </div>
                         <div className="text-right">
                            <p className="text-sm font-bold text-white">
                               {formatCurrency(exp.amountNative || exp.amount)}
                            </p>
                            <p className="text-[10px] text-white/30 uppercase tracking-tighter">
                               {exp.paymentMethod?.name || "Efectivo"}
                            </p>
                         </div>
                      </div>
                   ))}
                </div>
             )}
          </div>

          <DialogFooter className="border-t border-white/10 pt-4 flex sm:justify-between items-center gap-4">
             <div className="hidden sm:flex items-center gap-2 text-[10px] text-white/40 uppercase tracking-widest">
                <Info className="w-3 h-3" />
                {monthExpenses.length} transacciones encontradas
             </div>
             <div className="flex gap-2 w-full sm:w-auto">
                <Button 
                  variant="outline" 
                  onClick={() => setIsDetailsDialogOpen(false)}
                  className="flex-1 sm:flex-none border-white/10 bg-white/5 text-white hover:bg-white/10 rounded-xl"
                >
                   Cerrar
                </Button>
                <Button 
                  onClick={() => {
                    if (selectedMonthData) {
                      router.push(`/budget?month=${selectedMonthData.month}&year=${selectedMonthData.year}`);
                    }
                  }}
                  className="flex-1 sm:flex-none bg-white text-black hover:bg-white/90 rounded-xl flex items-center gap-2"
                >
                   Ver Presupuesto Completo
                   <ExternalLink className="w-3 h-3" />
                </Button>
             </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
