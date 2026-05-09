"use client";
import { useEffect, useState } from "react";
import { Bookmark, Plus, X, Check, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { apiJson } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";

export type SavedView = {
  id: string;
  name: string;
  filters: any;
  isDefault: boolean;
};

type Props = {
  currentFilters: any;
  onApplyView: (filters: any) => void;
};

export default function SavedViewsMenu({ currentFilters, onApplyView }: Props) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const loadViews = async () => {
    setLoading(true);
    const res = await apiJson("/api/saved-views");
    if (res.ok) setViews(res.data.items);
    setLoading(false);
  };

  useEffect(() => {
    if (open) loadViews();
  }, [open]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    const res = await apiJson("/api/saved-views", {
      method: "POST",
      body: JSON.stringify({ name: newName, filters: currentFilters })
    });
    if (res.ok) {
      setNewName("");
      setIsAdding(false);
      await loadViews();
    }
    setSaving(false);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const res = await apiJson(`/api/saved-views/${id}`, { method: "DELETE" });
    if (res.ok) {
      setViews(views.filter(v => v.id !== id));
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          className="h-[42px] px-4 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md text-white/80 hover:bg-white/10 hover:text-white transition-all shadow-[0_0_15px_-3px_rgba(139,92,246,0.05)]"
        >
          <Bookmark className="mr-2 h-4 w-4 text-purple-400" />
          Vistas guardadas
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        align="end" 
        className="w-72 p-2 rounded-2xl bg-[#1c1c1e]/90 backdrop-blur-2xl border border-white/10 shadow-2xl overflow-hidden"
      >
        <div className="space-y-1">
          {loading && !views.length && (
            <div className="p-4 flex justify-center text-white/50">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
          
          {!loading && views.length === 0 && !isAdding && (
            <div className="p-4 text-center text-sm text-white/40">
              No tienes vistas guardadas
            </div>
          )}

          {!loading && views.map((v) => (
            <div
              key={v.id}
              onClick={() => {
                onApplyView(v.filters);
                setOpen(false);
              }}
              className="flex items-center justify-between p-2 rounded-xl hover:bg-white/10 cursor-pointer transition-colors group"
            >
              <span className="text-sm text-white/90 pl-2">{v.name}</span>
              <button 
                onClick={(e) => handleDelete(e, v.id)}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-all"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}

          <AnimatePresence>
            {isAdding ? (
              <motion.form 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                onSubmit={handleSave} 
                className="pt-2 px-1 pb-1 overflow-hidden"
              >
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nombre de la vista..."
                    className="flex-1 h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-white placeholder:text-white/30 focus:border-purple-500/50 focus:outline-none transition-colors"
                  />
                  <Button type="submit" size="sm" disabled={saving || !newName.trim()} className="h-9 w-9 p-0 flex-shrink-0 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setIsAdding(false)} className="h-9 w-9 p-0 flex-shrink-0 rounded-lg text-white/50 hover:text-white">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </motion.form>
            ) : (
              <div className="pt-2 mt-2 border-t border-white/10">
                <Button 
                  variant="ghost" 
                  onClick={() => setIsAdding(true)}
                  className="w-full justify-start text-xs text-purple-300 hover:text-purple-200 hover:bg-purple-500/10 rounded-xl"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Guardar vista actual
                </Button>
              </div>
            )}
          </AnimatePresence>
        </div>
      </PopoverContent>
    </Popover>
  );
}