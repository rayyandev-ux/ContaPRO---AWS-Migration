"use client";

import * as React from "react";
import { 
  format, 
  subDays, 
  startOfMonth, 
  endOfMonth, 
  startOfQuarter, 
  endOfQuarter, 
  startOfYear, 
  endOfYear, 
  subMonths, 
  subQuarters, 
  subYears,
  isSameDay,
  startOfDay,
  endOfDay
} from "date-fns";
import { es, enUS, pt } from "date-fns/locale";
import { CalendarIcon, ChevronDown } from "lucide-react";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const dateFnsLocales: Record<string, any> = {
  es,
  en: enUS,
  pt
};

interface GlassDateRangePickerProps {
  /** Initial date range */
  value?: { start: Date; end: Date };
  /** Callback when range is applied */
  onApply?: (range: { start: Date; end: Date }) => void;
  /** Additional className for the trigger button */
  className?: string;
  /** Locale for the calendar */
  locale?: string;
}

export default function GlassDateRangePicker({
  value,
  onApply,
  className,
  locale = "es",
}: GlassDateRangePickerProps) {
  const currentLocale = dateFnsLocales[locale] || es;
  const [open, setOpen] = React.useState(false);
  const [range, setRange] = React.useState<DateRange | undefined>({
    from: value?.start || startOfMonth(new Date()),
    to: value?.end || endOfMonth(new Date()),
  });
  const [lastDays, setLastDays] = React.useState<string>("");
  const [lastUnit, setLastDaysUnit] = React.useState<string>("days");

  // Sync internal range with prop value when it changes or popover opens
  React.useEffect(() => {
    if (open && value) {
      setRange({
        from: value.start,
        to: value.end,
      });
    }
  }, [open, value]);

  const presets = [
    { label: "Este mes", getRange: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
    { label: "El mes pasado", getRange: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
    { label: "Este trimestre", getRange: () => ({ from: startOfQuarter(new Date()), to: endOfQuarter(new Date()) }) },
    { label: "El trimestre pasado", getRange: () => ({ from: startOfQuarter(subQuarters(new Date(), 1)), to: endOfQuarter(subQuarters(new Date(), 1)) }) },
    { label: "Lo que va del año", getRange: () => ({ from: startOfYear(new Date()), to: new Date() }) },
    { label: "El año pasado", getRange: () => ({ from: startOfYear(subYears(new Date(), 1)), to: endOfYear(subYears(new Date(), 1)) }) },
    { label: "Todo el historial", getRange: () => ({ from: new Date(2020, 0, 1), to: new Date() }) },
  ];

  const handleApply = () => {
    if (range?.from && range?.to) {
      onApply?.({ 
        start: startOfDay(range.from), 
        end: endOfDay(range.to) 
      });
      setOpen(false);
    }
  };

  const handleLastDaysApply = () => {
    const num = parseInt(lastDays);
    if (!isNaN(num) && num > 0) {
      const end = new Date();
      let start: Date;
      if (lastUnit === "days") start = subDays(end, num);
      else if (lastUnit === "months") start = subMonths(end, num);
      else start = subYears(end, num);
      
      const newRange = { from: start, to: end };
      setRange(newRange);
      onApply?.({ start: startOfDay(start), end: endOfDay(end) });
      setOpen(false);
    }
  };

  const activePreset = presets.find(p => {
    const pr = p.getRange();
    return range?.from && range?.to && 
           isSameDay(range.from, pr.from!) && 
           isSameDay(range.to, pr.to!);
  });

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-auto justify-center md:justify-start text-left font-medium",
              "rounded-xl border border-white/10 bg-white/5 backdrop-blur-md",
              "p-2 md:px-4 md:py-2 h-[42px] min-w-[42px]",
              "text-sm text-white/90 hover:text-white",
              "hover:bg-white/10 hover:border-white/20",
              "transition-all duration-200 shadow-lg",
              !range && "text-white/40"
            )}
          >
            <CalendarIcon className="h-4 w-4 opacity-60 md:mr-2" />
            <div className="hidden md:flex items-center">
              {range?.from ? (
                range.to ? (
                  <>
                    {format(range.from, "dd/MM/yyyy", { locale: currentLocale })}
                    <span className="mx-2 opacity-40">→</span>
                    {format(range.to, "dd/MM/yyyy", { locale: currentLocale })}
                  </>
                ) : (
                  format(range.from, "dd/MM/yyyy", { locale: currentLocale })
                )
              ) : (
                <span>Seleccionar fechas</span>
              )}
              <ChevronDown className="ml-2 h-4 w-4 opacity-40" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-auto p-0 border-white/15 bg-[#0f0f0f]/95 backdrop-blur-3xl rounded-2xl shadow-2xl overflow-hidden" 
          align="end"
          sideOffset={8}
        >
          {/* Subtle gradient overlay for glass effect */}
          <div className="absolute inset-0 rounded-2xl pointer-events-none bg-gradient-to-b from-white/[0.08] via-transparent to-white/[0.02]" />
          
          <div className="relative z-10 flex flex-col md:flex-row min-h-[380px]">
            {/* Sidebar Presets */}
            <div className="w-full md:w-48 border-b md:border-b-0 md:border-r border-white/10 p-3 flex flex-col gap-1">
              {presets.map((p) => (
                <button
                  key={p.label}
                  onClick={() => setRange(p.getRange())}
                  className={cn(
                    "text-left px-3 py-2 rounded-lg text-sm transition-all",
                    activePreset?.label === p.label 
                      ? "bg-white/10 text-white font-medium" 
                      : "text-white/50 hover:bg-white/5 hover:text-white/80"
                  )}
                >
                  {p.label}
                </button>
              ))}
              
              <div className="mt-auto pt-4 border-t border-white/10">
                <p className="text-[10px] uppercase font-bold tracking-widest text-white/30 px-3 mb-2">Últimos</p>
                <div className="flex items-center gap-2 px-1">
                  <Input 
                    className="h-8 bg-white/5 border-white/10 text-white rounded-lg text-xs w-14" 
                    placeholder="N"
                    value={lastDays}
                    onChange={(e) => setLastDays(e.target.value)}
                  />
                  <Select value={lastUnit} onValueChange={setLastDaysUnit}>
                    <SelectTrigger className="h-8 bg-white/5 border-white/10 text-white rounded-lg text-[10px] w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1a1a] border-white/10 text-white">
                      <SelectItem value="days">días</SelectItem>
                      <SelectItem value="months">meses</SelectItem>
                      <SelectItem value="years">años</SelectItem>
                    </SelectContent>
                  </Select>
                  <button 
                    onClick={handleLastDaysApply}
                    className="text-[10px] font-bold text-purple-400 hover:text-purple-300 transition-colors ml-1"
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            </div>

            {/* Calendar and Actions */}
            <div className="flex flex-col">
              <div className="p-2">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={range?.from}
                  selected={range}
                  onSelect={setRange}
                  numberOfMonths={1}
                  locale={currentLocale}
                  classNames={{
                    months: "flex flex-col sm:flex-row gap-2",
                    month: "flex flex-col gap-4",
                    month_caption: "flex justify-center pt-1 relative items-center w-full",
                    caption_label: "text-sm font-semibold text-white/90 tracking-wide",
                    nav: "flex items-center gap-1",
                    button_previous:
                      "absolute left-1 top-0 h-7 w-7 bg-white/5 border border-white/10 rounded-lg p-0 opacity-60 hover:opacity-100 hover:bg-white/15 transition-all inline-flex items-center justify-center",
                    button_next:
                      "absolute right-1 top-0 h-7 w-7 bg-white/5 border border-white/10 rounded-lg p-0 opacity-60 hover:opacity-100 hover:bg-white/15 transition-all inline-flex items-center justify-center",
                    month_grid: "w-full border-collapse",
                    weekdays: "flex",
                    weekday:
                      "text-white/40 rounded-md w-9 font-medium text-[0.7rem] uppercase tracking-widest",
                    week: "flex w-full mt-1",
                    day: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:rounded-lg",
                    day_button:
                      "h-9 w-9 p-0 font-normal rounded-lg transition-all duration-150 text-white/80 hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white aria-selected:opacity-100 inline-flex items-center justify-center",
                    selected:
                      "bg-purple-600 text-white hover:bg-purple-500 rounded-lg shadow-[0_0_15px_rgba(147,51,234,0.4)]",
                    today:
                      "bg-white/10 text-white font-semibold rounded-lg ring-1 ring-white/20",
                    outside: "text-white/10 opacity-30",
                    disabled: "text-white/10 opacity-20",
                    range_start: "rounded-r-none",
                    range_end: "rounded-l-none",
                    range_middle: "bg-purple-600/20 text-purple-200 rounded-none",
                    hidden: "invisible",
                  }}
                />
              </div>
              <div className="mt-auto border-t border-white/10 p-4 flex justify-end gap-3 bg-white/[0.02]">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setOpen(false)}
                  className="text-white/50 hover:text-white hover:bg-white/5 rounded-xl h-9 px-4"
                >
                  Cancelar
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleApply}
                  className="bg-purple-600 text-white hover:bg-purple-500 rounded-xl h-9 px-6 shadow-lg shadow-purple-900/20"
                >
                  Aplicar
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
