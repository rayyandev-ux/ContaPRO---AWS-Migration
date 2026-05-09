"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

import { cn } from "@/lib/utils"

const DialogContext = React.createContext({ open: false })

const Dialog = ({
  children,
  open: openProp,
  defaultOpen,
  onOpenChange,
  ...props
}: DialogPrimitive.DialogProps) => {
  const [open, setOpen] = React.useState(defaultOpen || false)
  const isOpen = openProp !== undefined ? openProp : open

  const handleOpenChange = (val: boolean) => {
    setOpen(val)
    onOpenChange?.(val)
  }

  return (
    <DialogContext.Provider value={{ open: isOpen }}>
      <DialogPrimitive.Root open={isOpen} onOpenChange={handleOpenChange} {...props}>
        {children}
      </DialogPrimitive.Root>
    </DialogContext.Provider>
  )
}

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    asChild
    forceMount
    className={cn(
      "fixed inset-0 z-50 bg-black/40 backdrop-blur-[4px]",
      className
    )}
    {...props}
  >
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0"
    />
  </DialogPrimitive.Overlay>
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const { open } = React.useContext(DialogContext)

  return (
    <DialogPortal forceMount>
      <AnimatePresence>
        {open && (
          <>
            <DialogOverlay />
            <DialogPrimitive.Content
              ref={ref}
              forceMount
              asChild
              className={cn(
                "fixed left-[50%] top-[50%] z-50 grid w-[calc(100%-2rem)] max-w-lg gap-4 border border-white/20 bg-white/10 backdrop-blur-2xl p-6 sm:p-8 shadow-2xl rounded-[32px] text-white outline-none",
                className
              )}
              {...props}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9, x: "-50%", y: "-48%" }}
                animate={{ opacity: 1, scale: 1, x: "-50%", y: "-50%" }}
                exit={{ opacity: 0, scale: 0.9, x: "-50%", y: "-48%" }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                {children}
                <DialogPrimitive.Close className="absolute right-6 top-6 rounded-full h-8 w-8 flex items-center justify-center bg-white/5 border border-white/10 opacity-70 ring-offset-background transition-all hover:opacity-100 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
                  <X className="h-4 w-4 text-white/70 hover:text-white" />
                  <span className="sr-only">Close</span>
                </DialogPrimitive.Close>
              </motion.div>
            </DialogPrimitive.Content>
          </>
        )}
      </AnimatePresence>
    </DialogPortal>
  )
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight text-white",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-zinc-400", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
