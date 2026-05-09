"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area, ReferenceLine } from 'recharts';

type CustomTooltipPayloadItem = {
  name?: string;
  value?: number;
  color?: string;
  payload?: any;
};

type CustomTooltipProps = {
  active?: boolean;
  payload?: CustomTooltipPayloadItem[];
  label?: string;
  currency: string;
  locale: string;
};

const CustomTooltip = ({ active, payload, label, currency, locale }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl shadow-2xl text-xs backdrop-blur-md">
        <p className="text-zinc-500 mb-2 font-medium uppercase tracking-wider">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-zinc-300">{entry.name}:</span>
            <span className="font-bold" style={{ color: entry.color }}>
              {new Intl.NumberFormat(locale, { style: "currency", currency }).format(entry.value ?? 0)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

type Props = {
  view: "balance" | "donut";
  subView?: "balance" | "income" | "expenses";
  data: Array<Record<string, any>>;
  currency: string;
  locale: string;
  totalMonth?: number;
};

export default function DashboardCharts({ view, subView = "balance", data, currency, locale, totalMonth = 0 }: Props) {
  const fmt = new Intl.NumberFormat(locale === 'es' ? "es-PE" : locale === 'en' ? "en-US" : "pt-BR", { style: "currency", currency });

  if (view === "donut") {
    return (
      <div className="flex flex-col h-full">
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
                animationDuration={500}
                stroke="none"
              >
                {data.map((entry: Record<string, any>, index: number) => (
                  <Cell key={`cell-${index}`} fill={String(entry.color)} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip currency={currency} locale={locale} />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 flex flex-col items-center">
          <div className="text-2xl font-bold text-white">{fmt.format(totalMonth)}</div>
          <div className="text-xs text-white/50 mb-4">Total</div>
        </div>
        <div className="mt-auto space-y-2 max-h-[120px] overflow-y-auto pr-2 custom-scrollbar">
          {data.map((item: Record<string, any>) => (
            <div key={String(item.name)} className="flex items-center gap-3 text-sm group">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: String(item.color) }} />
              <span className="flex-1 truncate text-white/50 group-hover:text-white/80 transition-colors">{String(item.name)}</span>
              <span className="font-medium text-white/90">{fmt.format(Number(item.value))}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (view === "balance") {
    const currentMonthIdx = new Date().getMonth();
    const currentMonthName = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(2000, i, 1);
      return d.toLocaleString(locale, { month: 'short' }).charAt(0).toUpperCase() + d.toLocaleString(locale, { month: 'short' }).slice(1);
    })[currentMonthIdx];

    return (
      <div className="h-[250px] w-full mt-4">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart data={data} margin={{ top: 20, right: 0, left: 0, bottom: 20 }}>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.03)" strokeDasharray="3 3" />
            <XAxis 
              dataKey="name" 
              stroke="rgba(255,255,255,0.2)" 
              fontSize={11} 
              tickLine={false} 
              axisLine={false}
              dy={15}
            />
            <YAxis hide domain={['auto', 'auto']} />
            <Tooltip 
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              content={<CustomTooltip currency={currency} locale={locale} />} 
            />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" />
            <Bar 
              dataKey="value" 
              radius={[4, 4, 4, 4]}
              barSize={40}
              animationDuration={1000}
            >
              {data.map((entry, index) => {
                const isCurrent = entry.name === currentMonthName;
                const val = Number(entry.value);
                
                // Color logic matching the subView and value
                let color = "rgba(255,255,255,0.05)"; // Default dash color
                
                if (isCurrent || val !== 0) {
                  if (subView === 'expenses') color = "#ef4444";
                  else if (subView === 'income') color = "#10b981";
                  else color = val >= 0 ? "#10b981" : "#ef4444";
                }

                return (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={color} 
                    fillOpacity={isCurrent ? 0.8 : 0.3}
                    // If not current month and value is 0, we show a small dash
                    height={!isCurrent && val === 0 ? 2 : undefined}
                    y={!isCurrent && val === 0 ? 125 : undefined} // Center dash at 0 line
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return null;
}
