"use client";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Pencil } from "lucide-react";
import GlassCombobox from "@/components/ui/glass-combobox";
import { useTranslations } from "next-intl";

type Method = {
  id: string;
  name: string;
  provider: string;
  type: string;
  cardLast4?: string | null;
  accountNumber?: string | null;
  currency: string;
  active: boolean;
  balance: number;
  isFavorite: boolean;
};

type Props = {
  method: Method;
  onUpdate: (formData: FormData) => Promise<void>;
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export default function EditMethodDialog({
  method,
  onUpdate,
  children,
  open: externalOpen,
  onOpenChange: setExternalOpen,
}: Props) {
  const t = useTranslations("PaymentMethods");
  const [internalOpen, setInternalOpen] = useState(false);

  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = (val: boolean) => {
    if (setExternalOpen) setExternalOpen(val);
    else setInternalOpen(val);
  };

  const handleSubmit = async (formData: FormData) => {
    const isFavorite = formData.get("isFavorite") === "on";
    const balance = Number(formData.get("balance") || 0);
    
    const fd = new FormData();
    formData.forEach((value, key) => fd.append(key, value));
    fd.set("isFavorite", String(isFavorite));
    fd.set("balance", String(balance));

    await onUpdate(fd);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-md w-full border-white/20 bg-white/10 backdrop-blur-2xl rounded-[32px] shadow-2xl p-6 sm:p-8">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-white">{t("editTitle")}</DialogTitle>
          <DialogDescription className="text-white/50 text-sm">
            {t("editDescription")}
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-6">
          <input type="hidden" name="id" value={method.id} />

          {/* Provider */}
          <div className="space-y-2.5">
            <label className="text-[11px] uppercase font-bold tracking-[0.1em] text-white/40">
              {t("providerLabel")}
            </label>
            <input
              name="provider"
              defaultValue={method.provider}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/30 placeholder:text-white/30 backdrop-blur transition-all"
              required
              placeholder={t("providerPlaceholder")}
            />
          </div>

          {/* Display Name */}
          <div className="space-y-2.5">
            <label className="text-[11px] uppercase font-bold tracking-[0.1em] text-white/40">
              {t("customNameLabel")}
            </label>
            <input
              name="name"
              defaultValue={method.name}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/30 placeholder:text-white/30 backdrop-blur transition-all"
              required
              placeholder={t("customNamePlaceholder")}
            />
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/* Type */}
            <div className="space-y-2.5">
              <label className="text-[11px] uppercase font-bold tracking-[0.1em] text-white/40">
                {t("type")}
              </label>
              <GlassCombobox
                name="type"
                defaultValue={method.type}
                className="rounded-2xl h-[46px]"
                options={[
                  { value: "WALLET", label: t("typeWallet") },
                  { value: "TARJETA", label: t("typeCardShort") },
                  { value: "CUENTA", label: t("typeAccountShort") },
                  { value: "EFECTIVO", label: t("typeCash") },
                  { value: "OTRO", label: t("typeOther") },
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Account Number */}
            <div className="space-y-2.5">
              <label className="text-[11px] uppercase font-bold tracking-[0.1em] text-white/40">
                Número de Cuenta
              </label>
              <input
                name="accountNumber"
                defaultValue={method.accountNumber || ""}
                placeholder="0011-0123..."
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 h-[46px] text-sm text-white focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/30 placeholder:text-white/30 backdrop-blur transition-all"
              />
            </div>

            {/* Last 4 */}
            <div className="space-y-2.5">
              <label className="text-[11px] uppercase font-bold tracking-[0.1em] text-white/40">
                {t("last4Short")}
              </label>
              <input
                name="cardLast4"
                defaultValue={method.cardLast4 || ""}
                maxLength={4}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 h-[46px] text-sm text-white focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/30 placeholder:text-white/30 backdrop-blur transition-all"
                placeholder="1234"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Currency */}
            <div className="space-y-2.5">
              <label className="text-[11px] uppercase font-bold tracking-[0.1em] text-white/40">
                {t("currency")}
              </label>
              <GlassCombobox
                name="currency"
                defaultValue={method.currency}
                className="rounded-2xl h-[46px]"
                options={[
                  { value: "PEN", label: t("soles") },
                  { value: "USD", label: t("dollars") },
                  { value: "EUR", label: t("euros") },
                ]}
              />
            </div>

            {/* Current Balance */}
            <div className="space-y-2.5">
              <label className="text-[11px] uppercase font-bold tracking-[0.1em] text-white/40">
                Saldo Actual
              </label>
              <input
                name="balance"
                type="number"
                step="0.01"
                defaultValue={method.balance}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 h-[46px] text-sm text-white focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/30 placeholder:text-white/30 backdrop-blur transition-all"
                required
              />
            </div>
          </div>

          {/* Is Favorite */}
          <div className="flex items-center gap-3 px-1">
            <input
              type="checkbox"
              name="isFavorite"
              id="is-favorite-edit"
              defaultChecked={method.isFavorite}
              className="w-4 h-4 rounded border-white/10 bg-white/5 text-purple-500 focus:ring-purple-500/30"
            />
            <label htmlFor="is-favorite-edit" className="text-sm text-white/60 cursor-pointer select-none">
              Establecer como método favorito
            </label>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex-1 flex items-center justify-center px-6 py-2.5 rounded-full bg-white/5 text-white/70 font-medium hover:bg-white/10 hover:text-white backdrop-blur border border-white/10 transition-all text-sm active:scale-95"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              className="flex-1 flex items-center justify-center px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium backdrop-blur transition-all text-sm active:scale-95 shadow-[0_0_20px_-4px_rgba(255,255,255,0.05)]"
            >
              {t("saveChanges")}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
