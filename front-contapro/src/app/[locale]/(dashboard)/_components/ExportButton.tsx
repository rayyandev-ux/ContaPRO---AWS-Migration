"use client";

import { useState } from "react";
import { Download, Send, Check, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import GlassCombobox from "@/components/ui/glass-combobox";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";

export function ExportButton() {
  const t = useTranslations('Dashboard');
  const [loading, setLoading] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => ({
    value: (currentYear - i).toString(),
    label: (currentYear - i).toString()
  }));

  const months = [
    { value: "1", label: "Enero" },
    { value: "2", label: "Febrero" },
    { value: "3", label: "Marzo" },
    { value: "4", label: "Abril" },
    { value: "5", label: "Mayo" },
    { value: "6", label: "Junio" },
    { value: "7", label: "Julio" },
    { value: "8", label: "Agosto" },
    { value: "9", label: "Septiembre" },
    { value: "10", label: "Octubre" },
    { value: "11", label: "Noviembre" },
    { value: "12", label: "Diciembre" }
  ];

  const handleExport = async () => {
    try {
      setLoading(true);
      setIsModalOpen(false);
      
      const month = parseInt(selectedMonth);
      const year = parseInt(selectedYear);

      const response = await fetch(`${BASE}/api/export/monthly?month=${month}&year=${year}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) throw new Error(t('downloadError'));

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Reporte_ContaPRO_${year}_${String(month).padStart(2, '0')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (error) {
      console.error('Export failed:', error);
      toast.error(t('exportError'));
    } finally {
      setLoading(false);
    }
  };

  const handleSendReport = async (frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY') => {
    try {
      setSendingReport(true);
      const response = await fetch(`${BASE}/api/export/send-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frequency }),
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t('reportSentError'));
      }

      toast.success(t('reportSentSuccess'), {
        icon: <Check className="h-4 w-4 text-emerald-500" />,
      });
    } catch (error: any) {
      console.error('Send report failed:', error);
      toast.error(error.message || t('reportSentError'), {
        icon: <AlertCircle className="h-4 w-4 text-rose-500" />,
      });
    } finally {
      setSendingReport(false);
    }
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3 items-center">
        {/* Selector Enviar Reporte con GlassCombobox */}
        <div className="relative w-full sm:w-auto">
          <GlassCombobox
            options={[
              { value: 'DAILY', label: t('dailyReport') },
              { value: 'WEEKLY', label: t('weeklyReport') },
              { value: 'MONTHLY', label: t('monthlyReport') },
            ]}
            value=""
            placeholder={t('sendReport')}
            onChange={(v) => handleSendReport(v as any)}
            disabled={sendingReport}
            hideSearch
            icon={sendingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            className="bg-white/5 border-white/10 text-white h-[42px] px-6 rounded-full hover:bg-white/10 transition-all shadow-lg backdrop-blur min-w-[180px]"
          />
        </div>

        {/* Botón Exportar Excel */}
        <Button 
          variant="default" 
          onClick={() => setIsModalOpen(true)}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap px-6 py-2.5 rounded-full bg-white/5 text-white font-medium hover:bg-white/10 backdrop-blur border border-white/10 transition-colors text-sm w-full sm:w-auto shadow-lg h-[42px]"
        >
          <Download className="h-4 w-4" />
          {loading ? t('generating') : t('exportExcel')}
        </Button>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Exportar Reporte Mensual</DialogTitle>
            <DialogDescription>
              Selecciona el mes y el año del cual deseas generar tu reporte en Excel.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/80">Mes</label>
                <GlassCombobox
                  options={months}
                  value={selectedMonth}
                  onChange={setSelectedMonth}
                  placeholder="Mes"
                  hideSearch
                  className="w-full bg-black/20 border-white/10 text-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/80">Año</label>
                <GlassCombobox
                  options={years}
                  value={selectedYear}
                  onChange={setSelectedYear}
                  placeholder="Año"
                  hideSearch
                  className="w-full bg-black/20 border-white/10 text-white"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="text-white/70 hover:text-white hover:bg-white/10">
              Cancelar
            </Button>
            <Button onClick={handleExport} className="bg-violet-600 hover:bg-violet-700 text-white border-none shadow-lg">
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
