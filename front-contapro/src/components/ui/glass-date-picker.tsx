"use client";

import * as React from "react";
import { format, parse } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface GlassDatePickerProps {
  /** Value in YYYY-MM-DD format (string) */
  value?: string;
  /** Callback with YYYY-MM-DD string */
  onChange?: (value: string) => void;
  /** Placeholder text when no date is selected */
  placeholder?: string;
  /** Additional className for the trigger button */
  className?: string;
  /** Whether field is required */
  required?: boolean;
  /** Name attribute for form compatibility */
  name?: string;
  /** Whether to disable the picker */
  disabled?: boolean;
  /** Default value for uncontrolled usage */
  defaultValue?: string;
}

export default function GlassDatePicker({
  value,
  onChange,
  placeholder = "Seleccionar fecha",
  className,
  required,
  name,
  disabled,
  defaultValue,
}: GlassDatePickerProps) {
  const [open, setOpen] = React.useState(false);

  // Support both controlled and uncontrolled
  const [internalValue, setInternalValue] = React.useState(defaultValue || "");
  const currentValue = value !== undefined ? value : internalValue;

  const dateObj = React.useMemo(() => {
    if (!currentValue) return undefined;
    try {
      // Parse YYYY-MM-DD string
      const d = parse(currentValue, "yyyy-MM-dd", new Date());
      return isNaN(d.getTime()) ? undefined : d;
    } catch {
      return undefined;
    }
  }, [currentValue]);

  const handleSelect = (date: Date | undefined) => {
    if (!date) return;
    const formatted = format(date, "yyyy-MM-dd");
    if (onChange) {
      onChange(formatted);
    } else {
      setInternalValue(formatted);
    }
    setOpen(false);
  };

  return (
    <>
      {/* Hidden input for form submission compatibility */}
      {name && (
        <input
          type="hidden"
          name={name}
          value={currentValue}
          required={required}
        />
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              // Glass styling matching the app aesthetic
              "w-auto md:w-full justify-center md:justify-start text-left font-normal",
              "rounded-xl border border-white/10 bg-white/5 backdrop-blur-md",
              "p-2 md:px-4 md:py-2 h-[42px] min-w-[42px]",
              "text-sm text-white",
              "hover:bg-white/10 hover:border-white/20 hover:text-white",
              "focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50",
              "transition-all duration-200",
              "shadow-[0_0_15px_-3px_rgba(139,92,246,0.05)]",
              !currentValue && "text-white/40",
              className
            )}
          >
            <CalendarIcon className="h-4 w-4 text-purple-400/70 md:mr-2" />
            <span className="hidden md:inline">
              {dateObj ? (
                format(dateObj, "dd 'de' MMMM, yyyy", { locale: es })
              ) : (
                placeholder
              )}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className={cn(
            "w-auto p-0",
            // Glassmorphism popover
            "border border-white/15 bg-[#0f0f0f]/90 backdrop-blur-2xl",
            "rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5),0_0_40px_-10px_rgba(139,92,246,0.15)]",
            "overflow-hidden",
          )}
          align="start"
          sideOffset={8}
        >
          {/* Subtle gradient overlay for glass effect */}
          <div className="absolute inset-0 rounded-2xl pointer-events-none bg-gradient-to-b from-white/[0.06] via-transparent to-white/[0.02]" />
          <div className="relative z-10">
            <Calendar
              mode="single"
              selected={dateObj}
              onSelect={handleSelect}
              locale={es}
              defaultMonth={dateObj}
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
                  "bg-gradient-to-br from-purple-600/80 to-indigo-600/80 text-white hover:from-purple-500/90 hover:to-indigo-500/90 rounded-lg shadow-[0_0_20px_-4px_rgba(139,92,246,0.5)] ring-1 ring-purple-400/20",
                today:
                  "bg-white/10 text-white font-semibold rounded-lg ring-1 ring-white/20",
                outside: "text-white/20 opacity-50",
                disabled: "text-white/20 opacity-30",
                range_middle: "aria-selected:bg-white/5 aria-selected:text-white",
                hidden: "invisible",
              }}
            />
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
