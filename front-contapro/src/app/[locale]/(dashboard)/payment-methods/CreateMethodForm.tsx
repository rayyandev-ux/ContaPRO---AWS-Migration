"use client";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import GlassCombobox from "@/components/ui/glass-combobox";

type Props = {
  onSubmit: (formData: FormData) => void | Promise<void>;
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

export default function CreateMethodForm({ onSubmit }: Props) {
  const t = useTranslations('PaymentMethods');
  const [provider, setProvider] = useState("");
  const [type, setType] = useState("TARJETA");
  const [name, setName] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const handleProviderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setProvider(val);
    
    // Auto-detect type
    const found = SUGGESTIONS.find(s => s.name.toLowerCase() === val.toLowerCase());
    if (found) {
      setType(found.type);
    }

    // Auto-fill name if empty or matches previous provider (ignoring case)
    if (!name || (provider && name.toLowerCase() === provider.toLowerCase())) {
      setName(val);
    }
  };

  const handleSubmit = async (formData: FormData) => {
    await onSubmit(formData);
    // Reset form
    setProvider("");
    setName("");
    setType("TARJETA");
    formRef.current?.reset();
  };

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
                <label className="text-xs text-white/50">{t('providerLabel')}</label>
                <div className="relative">
                    <input 
                        name="provider" 
                        list="providers-list"
                        value={provider}
                        onChange={handleProviderChange}
                        placeholder={t('providerPlaceholder')} 
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20" 
                        required 
                        autoComplete="off"
                    />
                    <datalist id="providers-list">
                        {SUGGESTIONS.map(s => <option key={s.name} value={s.name} />)}
                    </datalist>
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-xs text-white/50">{t('nameLabel')}</label>
                <input 
                    name="name" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('namePlaceholder')} 
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20" 
                    required 
                />
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div className="space-y-2">
                <label className="text-xs text-white/50">{t('type')}</label>
                <GlassCombobox
                    name="type"
                    value={type}
                    onChange={setType}
                    options={[
                        { value: "WALLET", label: t('typeWallet') },
                        { value: "TARJETA", label: t('typeCard') },
                        { value: "CUENTA", label: t('typeAccount') },
                        { value: "EFECTIVO", label: t('typeCash') },
                        { value: "OTRO", label: t('typeOther') }
                    ]}
                />
            </div>

            <div className="space-y-2">
                <label className="text-xs text-white/50">{t('currency')}</label>
                  <GlassCombobox
                    name="currency"
                    defaultValue="PEN"
                    options={[
                        { value: "PEN", label: t('soles') + " (S/)" },
                        { value: "USD", label: t('dollars') + " ($)" },
                        { value: "EUR", label: t('euros') + " (€)" }
                    ]}
                />
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
                <label className="text-xs text-white/50">Balance inicial</label>
                <input 
                    name="balance" 
                    type="number"
                    step="0.01"
                    defaultValue="0"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20" 
                />
            </div>

            <div className="space-y-2">
                <label className="text-xs text-white/50">Número de cuenta (opcional)</label>
                <input 
                    name="accountNumber" 
                    placeholder="0011-0123..." 
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20" 
                />
            </div>

            <div className="space-y-2">
                <label className="text-xs text-white/50">{t('last4Label')}</label>
                <input 
                    name="cardLast4" 
                    placeholder="1234" 
                    maxLength={4}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20" 
                />
                <p className="text-[10px] text-white/50">{t('last4Help')}</p>
            </div>
        </div>

        <div className="flex items-center gap-3 pt-2 pb-2">
            <input 
              type="checkbox" 
              name="createInitialTransaction" 
              id="createInitialTransaction" 
              value="true"
              className="w-4 h-4 rounded bg-white/5 border-white/10 text-primary accent-primary" 
              defaultChecked 
            />
            <label htmlFor="createInitialTransaction" className="text-sm text-white/70 cursor-pointer">
              Crear transacción del saldo inicial automáticamente
            </label>
        </div>

        <div className="pt-2">
             <Button type="submit" className="w-full bg-white text-black hover:bg-white/90 font-medium">
                <Plus className="w-4 h-4 mr-2" /> {t('addMethod')}
             </Button>
        </div>
    </form>
  );
}
