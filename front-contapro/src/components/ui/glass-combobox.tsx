"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type ComboboxOption = {
  value: string;
  label: string;
  icon?: React.ReactNode;
};

export type ComboboxGroup = {
  label: string;
  options: ComboboxOption[];
};

interface GlassComboboxProps {
  /** Array of simple options */
  options?: ComboboxOption[];
  /** Array of grouped options (overrides simple options) */
  groups?: ComboboxGroup[];
  /** Current selected value (controlled) */
  value?: string;
  /** Callback on change (controlled) */
  onChange?: (value: string) => void;
  /** Placeholder when empty */
  placeholder?: string;
  /** Custom search prompt */
  searchPlaceholder?: string;
  /** Custom empty text */
  emptyText?: string;
  /** Whether to hide the search bar */
  hideSearch?: boolean;
  /** Whether to hide the check icon for selected items */
  hideCheck?: boolean;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Custom trigger element */
  trigger?: React.ReactNode;
  /** Additional classes for trigger */
  className?: string;
  /** Additional classes for popover content */
  contentClassName?: string;
  /** Name attribute for hidden input formatting (uncontrolled) */
  name?: string;
  /** Default value for uncontrolled usage */
  defaultValue?: string;
  /** Custom element to render at the top of the list */
  topAction?: React.ReactNode;
  /** Optional icon to display on the trigger button */
  icon?: React.ReactNode;
}

export default function GlassCombobox({
  options = [],
  groups,
  value,
  onChange,
  placeholder = "Seleccionar opción",
  searchPlaceholder = "Buscar...",
  emptyText = "No se encontraron resultados.",
  hideSearch = false,
  hideCheck = false,
  disabled = false,
  trigger,
  className,
  contentClassName,
  name,
  defaultValue = "",
  topAction,
  icon,
}: GlassComboboxProps) {
  const [open, setOpen] = React.useState(false);

  // Managed internal state for uncontrolled forms
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const currentValue = value !== undefined ? value : internalValue;

  const handleSelect = (currentValueToSet: string) => {
    // Standard combobox behavior allows toggling off by clicking same again, but select elements don't.
    // We enforce selection matching like standard HTML select.
    if (onChange) {
      onChange(currentValueToSet);
    } else {
      setInternalValue(currentValueToSet);
    }
    setOpen(false);
  };

  // Find the currently selected label
  const currentLabel = React.useMemo(() => {
    if (groups) {
      for (const group of groups) {
        const found = group.options.find((opt) => opt.value === currentValue);
        if (found) return found.label;
      }
    } else {
      const found = options.find((opt) => opt.value === currentValue);
      if (found) return found.label;
    }
    return "";
  }, [currentValue, options, groups]);

  return (
    <>
      {name && (
        <input type="hidden" name={name} value={currentValue} />
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {trigger ? (
            <div className={cn("cursor-pointer", className)}>{trigger}</div>
          ) : (
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              disabled={disabled}
              className={cn(
                "w-full justify-between font-normal",
                "rounded-xl border border-white/10 bg-white/5 backdrop-blur-md",
                "px-4 py-2 h-[42px]",
                "text-sm text-white",
                "hover:bg-white/10 hover:border-white/20 hover:text-white",
                "focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50",
                "transition-all duration-200",
                "shadow-[0_0_15px_-3px_rgba(139,92,246,0.05)]",
                !currentValue && "text-white/40",
                className
              )}
            >
              <span className="truncate flex items-center gap-2">
                {icon && <span>{icon}</span>}
                {currentValue ? currentLabel || placeholder : placeholder}
              </span>
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          )}
        </PopoverTrigger>
        <PopoverContent
          className={cn(
            "p-0 overflow-hidden",
            "border border-white/15 bg-[#0f0f0f]/90 backdrop-blur-2xl",
            "rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5),0_0_40px_-10px_rgba(139,92,246,0.15)]",
            !contentClassName && "w-[var(--radix-popover-trigger-width)]",
            trigger && !contentClassName && "min-w-[160px]",
            contentClassName
          )}
          align="end"
        >
          {/* Subtle gradient overlay for glass effect */}
          <div className="absolute inset-0 rounded-2xl pointer-events-none bg-gradient-to-b from-white/[0.06] via-transparent to-white/[0.02]" />
          
          <Command className="relative z-10 bg-transparent text-white pointer-events-auto">
            {!hideSearch && <CommandInput placeholder={searchPlaceholder} />}
            <CommandList className="custom-scrollbar">
              {topAction && (
                <>
                  <div className="p-1">{topAction}</div>
                  <div className="h-px bg-white/10 mx-1 my-1" />
                </>
              )}
              <CommandEmpty>{emptyText}</CommandEmpty>
              {groups ? (
                groups.map((group) => (
                  <CommandGroup key={group.label} heading={group.label}>
                    {group.options.map((opt) => (
                      <CommandItem
                        key={opt.value}
                        value={opt.label} // Use label for text search
                        onSelect={() => handleSelect(opt.value)}
                      >
                        {!hideCheck && (
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              currentValue === opt.value
                                ? "opacity-100 text-purple-400"
                                : "opacity-0"
                            )}
                          />
                        )}
                        {opt.icon && <span className="mr-2">{opt.icon}</span>}
                        {opt.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))
              ) : (
                <CommandGroup>
                  {options.map((opt) => (
                    <CommandItem
                      key={opt.value}
                      value={opt.label} // Use label for text search
                      onSelect={() => handleSelect(opt.value)}
                    >
                      {!hideCheck && (
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            currentValue === opt.value
                              ? "opacity-100 text-purple-400"
                              : "opacity-0"
                          )}
                        />
                      )}
                      {opt.icon && <span className="mr-2">{opt.icon}</span>}
                      {opt.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}
