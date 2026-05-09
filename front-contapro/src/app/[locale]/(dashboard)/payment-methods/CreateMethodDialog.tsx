"use client";
import { useState, useRef, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import GlassCombobox from "@/components/ui/glass-combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Props = {
  onSubmit: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
};

const SUGGESTIONS = [
  { name: "Yape", type: "WALLET" },
  { name: "Plin", type: "WALLET" },
  { name: "BCP", type: "TARJETA" },
  { name: "Interbank", type: "TARJETA" },
  { name: "BBVA", type: "TARJETA" },
  { name: "Scotiabank", type: "TARJETA" },
  { name: "Efectivo", type: "EFECTIVO" },
  { name: "Agora", type: "WALLET" },
  { name: "Máximo", type: "TARJETA" },
  { name: "Ligo", type: "TARJETA" },
  { name: "Tunki", type: "WALLET" },
  { name: "Lemon", type: "WALLET" },
];

export default function CreateMethodDialog({ onSubmit, children }: Props) {
  const t = useTranslations("PaymentMethods");
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState("");
  const [type, setType] = useState("TARJETA");
  const [name, setName] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const handleProviderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setProvider(val);
    const found = SUGGESTIONS.find(
      (s) => s.name.toLowerCase() === val.toLowerCase()
    );
    if (found) setType(found.type);
    if (!name || (provider && name.toLowerCase() === provider.toLowerCase())) {
      setName(val);
    }
  };

  const handleSubmit = async (formData: FormData) => {
    // Process checkbox manually because FormData might not include it if unchecked
    const isFavorite = formData.get("isFavorite") === "on" || formData.get("isFavorite") === "true";
    const createInitialTransaction = formData.get("createInitialTransaction") === "on" || formData.get("createInitialTransaction") === "true";
    const balance = Number(formData.get("balance") || 0);
    
    // Create a new FormData to ensure correct types
    const fd = new FormData();
    formData.forEach((value, key) => fd.append(key, value));
    fd.set("isFavorite", String(isFavorite));
    fd.set("createInitialTransaction", String(createInitialTransaction));
    fd.set("balance", String(balance));

    await onSubmit(fd);
    setProvider("");
    setName("");
    setType("TARJETA");
    formRef.current?.reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md w-full border-white/20 bg-white/10 backdrop-blur-2xl rounded-[32px] shadow-2xl p-6 sm:p-8">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-white">{t("createTitle")}</DialogTitle>
          <DialogDescription className="text-white/50 text-sm">
            {t("createDescription")}
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} action={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {/* Provider (Bank or App) */}
            <div className="space-y-2.5">
              <label className="text-[11px] uppercase font-bold tracking-[0.1em] text-white/40">
                {t("providerLabel")}
              </label>
              <div className="relative">
                <input
                  name="provider"
                  list="providers-list-dialog"
                  value={provider}
                  onChange={handleProviderChange}
                  placeholder={t("providerPlaceholder")}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 h-[46px] text-sm text-white placeholder:text-white/30 focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/30 backdrop-blur transition-all"
                  required
                  autoComplete="off"
                />
                <datalist id="providers-list-dialog">
                  {SUGGESTIONS.map((s) => (
                    <option key={s.name} value={s.name} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* Display Name */}
            <div className="space-y-2.5">
              <label className="text-[11px] uppercase font-bold tracking-[0.1em] text-white/40">
                {t("nameLabel")}
              </label>
              <input
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("namePlaceholder")}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 h-[46px] text-sm text-white placeholder:text-white/30 focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/30 backdrop-blur transition-all"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Type */}
            <div className="space-y-2.5">
              <label className="text-[11px] uppercase font-bold tracking-[0.1em] text-white/40">
                {t("type")}
              </label>
              <GlassCombobox
                name="type"
                value={type}
                onChange={setType}
                className="rounded-2xl h-[46px]"
                options={[
                  { value: "WALLET", label: t("typeWallet") },
                  { value: "TARJETA", label: t("typeCard") },
                  { value: "CUENTA", label: t("typeAccount") },
                  { value: "EFECTIVO", label: t("typeCash") },
                  { value: "OTRO", label: t("typeOther") },
                ]}
              />
            </div>

            {/* Currency */}
            <div className="space-y-2.5">
              <label className="text-[11px] uppercase font-bold tracking-[0.1em] text-white/40">
                {t("currency")}
              </label>
              <GlassCombobox
                name="currency"
                defaultValue="PEN"
                className="rounded-2xl h-[46px]"
                options={[
                  { value: "PEN", label: t("soles") },
                  { value: "USD", label: t("dollars") },
                  { value: "EUR", label: t("euros") },
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Last 4 Digits */}
            <div className="space-y-2.5">
              <label className="text-[11px] uppercase font-bold tracking-[0.1em] text-white/40">
                {t("last4Label")}
              </label>
              <input
                name="cardLast4"
                placeholder="1234"
                maxLength={4}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/30 backdrop-blur transition-all"
              />
            </div>

            {/* Initial Balance */}
            <div className="space-y-2.5">
              <label className="text-[11px] uppercase font-bold tracking-[0.1em] text-white/40">
                Saldo Inicial
              </label>
              <input
                name="balance"
                type="number"
                step="0.01"
                placeholder="0.00"
                defaultValue="0.00"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/30 backdrop-blur transition-all"
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
                placeholder="0011-0123..."
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/30 backdrop-blur transition-all"
              />
            </div>

            {/* Last 4 Digits */}
            <div className="space-y-2.5">
              <label className="text-[11px] uppercase font-bold tracking-[0.1em] text-white/40">
                {t("last4Label")}
              </label>
              <input
                name="cardLast4"
                placeholder="1234"
                maxLength={4}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/30 backdrop-blur transition-all"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 px-1">
            {/* Create initial transaction */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                name="createInitialTransaction"
                id="create-initial-tx"
                value="true"
                defaultChecked
                className="w-4 h-4 rounded border-white/10 bg-white/5 text-purple-500 focus:ring-purple-500/30"
              />
              <label htmlFor="create-initial-tx" className="text-sm text-white/60 cursor-pointer select-none">
                Crear transacción de saldo inicial
              </label>
            </div>
            
            {/* Is Favorite */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                name="isFavorite"
                id="is-favorite-create"
                className="w-4 h-4 rounded border-white/10 bg-white/5 text-purple-500 focus:ring-purple-500/30"
              />
              <label htmlFor="is-favorite-create" className="text-sm text-white/60 cursor-pointer select-none">
                Establecer como método favorito
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 pt-4">
            <button
              type="submit"
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium transition-all text-sm active:scale-[0.98] backdrop-blur shadow-[0_0_20px_-4px_rgba(255,255,255,0.05)]"
            >
              <Plus className="w-4 h-4" />
              {t("addMethod")}
            </button>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-center text-sm text-white/40 hover:text-white/60 transition-colors py-1"
            >
              {t("cancel")}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
