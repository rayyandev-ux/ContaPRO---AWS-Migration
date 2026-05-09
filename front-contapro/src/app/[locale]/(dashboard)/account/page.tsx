"use client";
import { useEffect, useState } from "react";
import { apiJson, invalidateApiCache } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/routing";
import { motion } from "framer-motion";
import { User, Mail, Crown, ShieldCheck, AlertCircle, CalendarDays, CheckCircle2, XCircle, Save, Loader2, Bell, MessageSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import DangerZone from "./DangerZone";
import GlassDatePicker from "@/components/ui/glass-date-picker";
import GlassCombobox from "@/components/ui/glass-combobox";

type MeUser = {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  plan: string;
  emailVerified?: boolean;
  trialEnds?: string | null;
  planExpires?: string | null;
  preferredCurrency?: 'PEN' | 'USD' | 'EUR';
  dateFormat?: 'DMY' | 'MDY';
  whatsappPhone?: string | null;
  birthDate?: string | null;
  language?: 'es' | 'en' | 'pt';
  antExpenseLimit?: number | null;
  antExpenseStreakAlert?: number | null;
  antExpenseCountAlert?: number | null;
  antExpenseEnabled?: boolean;
  notifyEmailExpenseWhatsApp?: boolean;
  notifyEmailExpenseTelegram?: boolean;
  reportFrequency?: 'OFF' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
};

export default function AccountPage() {
  const [user, setUser] = useState<MeUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [original, setOriginal] = useState<MeUser | null>(null);
  
  useEffect(() => {
    (async () => {
      const res = await apiJson<{ ok: boolean; user: MeUser }>("/api/auth/me");
      if (!res.ok) {
        setError(res.error || "No autenticado");
        return;
      }
      setUser(res.data!.user);
      setOriginal(res.data!.user);
    })();
  }, []);

  const dirty = !!user && !!original && (
    user.preferredCurrency !== original.preferredCurrency || 
    user.dateFormat !== original.dateFormat ||
    user.name !== original.name ||
    user.whatsappPhone !== original.whatsappPhone ||
    user.birthDate !== original.birthDate ||
    user.language !== original.language ||
    user.antExpenseLimit !== original.antExpenseLimit ||
    user.antExpenseStreakAlert !== original.antExpenseStreakAlert ||
    user.antExpenseCountAlert !== original.antExpenseCountAlert ||
    user.antExpenseEnabled !== original.antExpenseEnabled ||
    user.notifyEmailExpenseWhatsApp !== original.notifyEmailExpenseWhatsApp ||
    user.notifyEmailExpenseTelegram !== original.notifyEmailExpenseTelegram ||
    user.reportFrequency !== original.reportFrequency
  );

  const fmtDate = (iso?: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString();
  };

  const roleChip = (role?: string) => {
    if (!role) return null;
    return (
      <span className="px-4 py-1.5 rounded-full text-xs font-medium border bg-zinc-900 text-white border-zinc-700 shadow-[0_0_15px_-3px_rgba(255,255,255,0.1)]">
        {role}
      </span>
    );
  };

  const secAccent = user?.emailVerified ? "text-white" : "text-white";
  const t = useTranslations('Account');

  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="max-w-[1600px] w-full mx-auto px-6 md:px-8 xl:px-12 py-6 md:py-8 lg:py-10">
        <div className="mb-6">
          <h1 className="text-4xl md:text-5xl font-playfair font-bold tracking-tight text-white mb-2">{t('title')}</h1>
          <p className="text-base text-muted-foreground">{t('subtitle')}</p>
        </div>
        {error && <p className="mb-6 text-sm text-red-600" aria-live="polite">{error}</p>}

        <div className="grid grid-cols-1 gap-8">
        {/* Perfil */}
        <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl overflow-hidden shadow-xl">
          <div className="px-8 py-6 border-b border-white/10">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 border border-white/20 text-white shadow-inner">
                <User className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{t('profileTitle')}</h2>
                <p className="text-sm text-white/50">{t('profileSubtitle')}</p>
              </div>
            </div>
          </div>
          <div className="p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-[11px] text-white/40 uppercase tracking-[0.2em] font-bold block ml-1">{t('nameLabel')}</label>
                <div className="flex items-center gap-3">
                  <Input 
                    value={user?.name || ''} 
                    onChange={(e) => setUser(u => u ? { ...u, name: e.target.value } : u)}
                    className="bg-white/5 border-white/10 text-white h-12 rounded-xl focus:bg-white/10 transition-all placeholder:text-white/20"
                  />
                  {roleChip(user?.role)}
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[11px] text-white/40 uppercase tracking-[0.2em] font-bold block ml-1">{t('emailLabel')}</label>
                <div className="flex items-center gap-3 text-sm text-white/80 bg-white/5 px-4 h-12 rounded-xl border border-white/10">
                  <Mail className="h-5 w-5 text-white/30" />
                  <span className="truncate">{user?.email}</span>
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[11px] text-white/40 uppercase tracking-[0.2em] font-bold block ml-1">{t('whatsappLabel')}</label>
                <Input 
                    value={user?.whatsappPhone || ''} 
                    onChange={(e) => setUser(u => u ? { ...u, whatsappPhone: e.target.value } : u)}
                    placeholder="+51..."
                    className="bg-white/5 border-white/10 text-white h-12 rounded-xl focus:bg-white/10 transition-all placeholder:text-white/20"
                />
              </div>
              <div className="space-y-3">
                <label className="text-[11px] text-white/40 uppercase tracking-[0.2em] font-bold block ml-1">{t('birthDateLabel')}</label>
                <GlassDatePicker 
                    value={user?.birthDate ? new Date(user.birthDate).toISOString().split('T')[0] : ''} 
                    onChange={(v) => setUser(u => u ? { ...u, birthDate: v } : u)}
                    className="bg-white/5 border-white/10 text-white h-12 rounded-xl hover:bg-white/10 transition-all"
                    placeholder={t('birthDateLabel')}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Configuraciones */}
        <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl overflow-hidden shadow-xl">
          <div className="px-8 py-6 border-b border-white/10">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 shadow-inner">
                <CalendarDays className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{t('settingsTitle')}</h2>
                <p className="text-sm text-white/50">{t('settingsSubtitle')}</p>
              </div>
            </div>
          </div>
          <div className="p-8 space-y-8">
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
              <div className="space-y-3">
                <label className="text-[11px] text-white/40 uppercase tracking-[0.2em] font-bold block ml-1">{t('currencyLabel')}</label>
                <GlassCombobox
                  options={[
                    { value: 'PEN', label: 'PEN (S/)' },
                    { value: 'USD', label: 'USD ($)' },
                    { value: 'EUR', label: 'EUR (€)' },
                  ]}
                  value={user?.preferredCurrency || 'PEN'}
                  onChange={(v) => setUser(u => u ? { ...u, preferredCurrency: v as any } : u)}
                  className="bg-white/5 border-white/10 text-white h-12 rounded-xl"
                />
              </div>
              <div className="space-y-3">
                <label className="text-[11px] text-white/40 uppercase tracking-[0.2em] font-bold block ml-1">{t('dateFormatLabel')}</label>
                <GlassCombobox
                  options={[
                    { value: 'DMY', label: 'Día/Mes/Año' },
                    { value: 'MDY', label: 'Mes/Día/Año' },
                  ]}
                  value={user?.dateFormat || 'DMY'}
                  onChange={(v) => setUser(u => u ? { ...u, dateFormat: v as any } : u)}
                  className="bg-white/5 border-white/10 text-white h-12 rounded-xl"
                />
              </div>
              <div className="space-y-3">
                <label className="text-[11px] text-white/40 uppercase tracking-[0.2em] font-bold block ml-1">{t('languageLabel')}</label>
                <GlassCombobox
                  options={[
                    { value: 'es', label: 'Español' },
                    { value: 'en', label: 'English' },
                    { value: 'pt', label: 'Português' },
                  ]}
                  value={user?.language || 'es'}
                  onChange={(v) => setUser(u => u ? { ...u, language: v as any } : u)}
                  className="bg-white/5 border-white/10 text-white h-12 rounded-xl"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Gastos Hormiga */}
        <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl overflow-hidden shadow-xl">
          <div className="px-8 py-6 border-b border-white/10">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shadow-inner">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{t('antExpensesTitle')}</h2>
                <p className="text-sm text-white/50">{t('antExpensesSubtitle')}</p>
              </div>
            </div>
          </div>
          <div className="p-8 space-y-8">
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-3">
                <label className="text-[11px] text-white/40 uppercase tracking-[0.2em] font-bold block ml-1">{t('antExpenseLimitLabel')}</label>
                <Input
                  type="number"
                  value={user?.antExpenseLimit ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setUser(u => u ? { ...u, antExpenseLimit: val === '' ? undefined : parseFloat(val) } : u)
                  }}
                  className="bg-white/5 border-white/10 text-white h-12 rounded-xl focus:bg-white/10 transition-all placeholder:text-white/20"
                  placeholder={t('antExpenseLimitPlaceholder')}
                />
              </div>
              <div className="space-y-3">
                <label className="text-[11px] text-white/40 uppercase tracking-[0.2em] font-bold block ml-1">{t('antExpenseStreakAlertLabel')}</label>
                <Input
                  type="number"
                  value={user?.antExpenseStreakAlert || ''}
                  onChange={(e) => setUser(u => u ? { ...u, antExpenseStreakAlert: e.target.value ? Number(e.target.value) : null } : u)}
                  className="bg-white/5 border-white/10 text-white h-12 rounded-xl focus:bg-white/10 transition-all placeholder:text-white/20"
                  placeholder={t('antExpenseStreakAlertPlaceholder')}
                />
              </div>
              <div className="space-y-3">
                <label className="text-[11px] text-white/40 uppercase tracking-[0.2em] font-bold block ml-1">{t('antExpenseCountAlertLabel')}</label>
                <Input
                  type="number"
                  value={user?.antExpenseCountAlert || ''}
                  onChange={(e) => setUser(u => u ? { ...u, antExpenseCountAlert: e.target.value ? Number(e.target.value) : null } : u)}
                  className="bg-white/5 border-white/10 text-white h-12 rounded-xl focus:bg-white/10 transition-all placeholder:text-white/20"
                  placeholder={t('antExpenseCountAlertPlaceholder')}
                />
              </div>
              <div className="space-y-3">
                <label className="text-[11px] text-white/40 uppercase tracking-[0.2em] font-bold block ml-1">{t('antExpenseEnabledLabel')}</label>
                <GlassCombobox
                  options={[
                    { value: 'true', label: t('enabled') },
                    { value: 'false', label: t('disabled') },
                  ]}
                  value={user?.antExpenseEnabled !== false ? 'true' : 'false'}
                  onChange={(v) => setUser(u => u ? { ...u, antExpenseEnabled: v === 'true' } : u)}
                  className="bg-white/5 border-white/10 text-white h-12 rounded-xl"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Notificaciones y Reportes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Notificaciones por Email */}
          <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl overflow-hidden shadow-xl">
            <div className="px-8 py-6 border-b border-white/10">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shadow-inner">
                  <Bell className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{t('emailNotificationsTitle')}</h2>
                  <p className="text-sm text-white/50">{t('emailNotificationsSubtitle')}</p>
                </div>
              </div>
            </div>
            <div className="p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium text-white">{t('notifyWhatsAppLabel')}</label>
                </div>
                <GlassCombobox
                  options={[
                    { value: 'true', label: t('enabled') },
                    { value: 'false', label: t('disabled') },
                  ]}
                  value={user?.notifyEmailExpenseWhatsApp ? 'true' : 'false'}
                  onChange={(v) => setUser(u => u ? { ...u, notifyEmailExpenseWhatsApp: v === 'true' } : u)}
                  className="bg-white/5 border-white/10 text-white h-10 w-32 rounded-xl"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium text-white">{t('notifyTelegramLabel')}</label>
                </div>
                <GlassCombobox
                  options={[
                    { value: 'true', label: t('enabled') },
                    { value: 'false', label: t('disabled') },
                  ]}
                  value={user?.notifyEmailExpenseTelegram ? 'true' : 'false'}
                  onChange={(v) => setUser(u => u ? { ...u, notifyEmailExpenseTelegram: v === 'true' } : u)}
                  className="bg-white/5 border-white/10 text-white h-10 w-32 rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* Reportes Periódicos */}
          <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl overflow-hidden shadow-xl">
            <div className="px-8 py-6 border-b border-white/10">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-inner">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{t('reportsTitle')}</h2>
                  <p className="text-sm text-white/50">{t('reportsSubtitle')}</p>
                </div>
              </div>
            </div>
            <div className="p-8 space-y-6">
              <div className="space-y-3">
                <label className="text-[11px] text-white/40 uppercase tracking-[0.2em] font-bold block ml-1">{t('reportFrequencyLabel')}</label>
                <GlassCombobox
                  options={[
                    { value: 'OFF', label: t('reportOff') },
                    { value: 'DAILY', label: t('reportDaily') },
                    { value: 'WEEKLY', label: t('reportWeekly') },
                    { value: 'MONTHLY', label: t('reportMonthly') },
                  ]}
                  value={user?.reportFrequency || 'OFF'}
                  onChange={(v) => setUser(u => u ? { ...u, reportFrequency: v as any } : u)}
                  className="bg-white/5 border-white/10 text-white h-12 rounded-xl"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Seguridad */}
        <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl overflow-hidden shadow-xl">
          <div className="px-8 py-6 border-b border-white/10">
            <div className="flex items-center gap-4">
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 border border-white/20 shadow-inner ${secAccent}`}>
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{t('securityTitle')}</h2>
                <p className="text-sm text-white/50">{t('securitySubtitle')}</p>
              </div>
            </div>
          </div>
          <div className="p-8 space-y-8">
            <div className="space-y-3">
              <label className="text-[11px] text-white/40 uppercase tracking-[0.2em] font-bold block ml-1">{t('verificationStatusLabel')}</label>
              <div className="flex items-center justify-between text-sm text-white bg-white/5 p-4 rounded-xl border border-white/10">
                <span className="flex items-center gap-3 font-medium">
                   {user?.emailVerified ? <CheckCircle2 className="h-5 w-5 text-green-400" /> : <XCircle className="h-5 w-5 text-red-400" />}
                   {user?.emailVerified ? t('emailVerified') : t('emailNotVerified')}
                </span>
                {!user?.emailVerified && (
                  <Link href="/verify">
                    <button className="text-xs bg-white text-black hover:bg-white/90 px-4 py-2 rounded-lg font-bold transition-all shadow-lg">
                      {t('verifyButton')}
                    </button>
                  </Link>
                )}
              </div>
            </div>
            
            <div className="pt-2">
              <Link href="/forgot">
                <button className="inline-flex items-center justify-center gap-2 whitespace-nowrap px-8 py-3 rounded-full border border-white/20 bg-white/5 text-white font-bold hover:bg-white/10 transition-all text-sm w-full sm:w-auto shadow-md">
                  <ShieldCheck className="h-4 w-4" /> Cambiar contraseña
                </button>
              </Link>
            </div>
          </div>
        </div>

        <DangerZone />
        </div>
      </div>
      <motion.div 
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: dirty ? 0 : 100, opacity: dirty ? 1 : 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed bottom-6 right-6 z-50"
      >
        <button
          disabled={saving}
          onClick={async () => {
            if (!user) return;
            setSaving(true); setSaved(null);
            const payload: Partial<MeUser> = { 
                preferredCurrency: user.preferredCurrency, 
                dateFormat: user.dateFormat,
                name: user.name,
                whatsappPhone: user.whatsappPhone,
                birthDate: user.birthDate,
                language: user.language,
                antExpenseLimit: user.antExpenseLimit,
                antExpenseStreakAlert: user.antExpenseStreakAlert,
                antExpenseCountAlert: user.antExpenseCountAlert,
                antExpenseEnabled: user.antExpenseEnabled,
                notifyEmailExpenseWhatsApp: user.notifyEmailExpenseWhatsApp,
                notifyEmailExpenseTelegram: user.notifyEmailExpenseTelegram,
                reportFrequency: user.reportFrequency
            };
            const res = await apiJson<{ ok: boolean; user: Partial<MeUser> }>("/api/auth/preferences", { method: 'PATCH', body: JSON.stringify(payload) });
            setSaving(false);
            if (!res.ok) { setSaved(res.error || t('errorSaving')); return; }
            setUser(prev => prev ? { ...prev, ...res.data!.user } : prev);
            setOriginal(res.data!.user as MeUser);
            setSaved(t('saved'));
            try { invalidateApiCache('/api/auth'); } catch {}
            setTimeout(() => setSaved(null), 2000);
          }}
          className="shadow-2xl inline-flex items-center justify-center gap-2 px-8 py-3 rounded-full bg-white text-black font-semibold hover:bg-zinc-200 transition-all hover:scale-105 text-sm disabled:opacity-50 border-4 border-zinc-900"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" /> {t('saveChanges')}</>}
        </button>
      </motion.div>
    </motion.div>
  );
}
