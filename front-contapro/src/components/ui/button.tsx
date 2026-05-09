import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-all active:scale-95 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-white/10 hover:bg-white/20 border border-white/20 text-white backdrop-blur shadow-[0_0_20px_-4px_rgba(255,255,255,0.05)]",
        destructive: "border border-red-500/30 bg-red-500/20 text-white hover:bg-red-500/30 backdrop-blur",
        outline: "border border-white/10 bg-transparent text-white hover:bg-white/5 backdrop-blur",
        secondary: "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white backdrop-blur border border-white/10",
        ghost: "hover:bg-white/5 hover:text-white text-white/70",
        link: "text-white underline-offset-4 hover:underline",
        panel: "btn-panel bg-white/5 text-white border-transparent hover:bg-white/10 backdrop-blur",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
