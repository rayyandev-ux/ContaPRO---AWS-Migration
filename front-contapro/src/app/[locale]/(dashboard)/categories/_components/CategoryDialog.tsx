"use client";

import { useState, useEffect } from "react";
import { Loader2, Plus, Tag, Edit2, Smile } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getCategoryVisuals, extractEmoji, combineEmoji } from "./category-emoji-utils";
import EmojiPicker, { Theme, EmojiStyle } from "emoji-picker-react";

type CategoryDialogProps = {
  mode: "create" | "edit";
  initialName?: string;
  categoryId?: string | null;
  onSave: (id: string | null, newName: string) => Promise<void>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function CategoryDialog({ mode, initialName = "", categoryId = null, onSave, open, onOpenChange }: CategoryDialogProps) {
  const t = useTranslations('Categories');
  
  // Manage internal state if open is not controlled
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open !== undefined ? open : internalOpen;
  const setIsOpen = onOpenChange || setInternalOpen;

  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("📌");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const extracted = extractEmoji(initialName);
      setEmoji(extracted.emoji);
      setName(extracted.name);
    }
  }, [isOpen, initialName]);

  const { colorClass } = getCategoryVisuals(name || "Preview");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    
    setIsSubmitting(true);
    const fullName = combineEmoji(emoji, name);
    await onSave(categoryId, fullName);
    setIsSubmitting(false);
    
    if (mode === "create") {
      setName("");
      setEmoji("📌");
    }
    setIsOpen(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {mode === "create" && !onOpenChange && (
        <DialogTrigger asChild>
          <button className="group flex items-center gap-2 rounded-2xl bg-white text-black px-4 py-2.5 text-sm font-semibold hover:bg-white/90 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.2)]">
            <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
            {t('create') || "Nueva Categoría"}
          </button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md bg-[#0a0a0a]/80 backdrop-blur-3xl border-white/10 text-white rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-playfair">
            {mode === "create" ? (t('create') || "Nueva Categoría") : (t('edit') || "Editar Categoría")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          <div className="space-y-4">
            <label className="text-sm font-medium text-white/70">Icono y Nombre</label>
            <div className="flex items-center gap-3">
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-2xl hover:bg-white/10 transition-all focus:outline-none focus:ring-1 focus:ring-white/20"
                  >
                    {emoji}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 border-none bg-transparent shadow-2xl" side="bottom" align="start">
                  <div className="rounded-2xl overflow-hidden border border-white/10">
                    <EmojiPicker
                      theme={Theme.DARK}
                      emojiStyle={EmojiStyle.NATIVE}
                      onEmojiClick={(e) => {
                        setEmoji(e.emoji);
                        setPickerOpen(false);
                      }}
                      searchDisabled={false}
                      skinTonesDisabled
                    />
                  </div>
                </PopoverContent>
              </Popover>

              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Tag className="h-4 w-4 text-white/50" />
                </div>
                <input
                  type="text"
                  autoFocus
                  className="w-full rounded-2xl border border-white/10 bg-white/5 pl-10 pr-4 py-[11px] text-white placeholder:text-white/30 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all"
                  placeholder={t('newCategoryPlaceholder') || "Ej. Restaurantes, Viajes..."}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 flex items-center gap-4">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br border shadow-inner ${colorClass}`}>
              <span className="text-2xl">{emoji}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-white/40 uppercase tracking-wider">Vista previa</span>
              <span className="text-sm font-medium text-white line-clamp-1">{name || "Escribe un nombre..."}</span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
              className="flex-1 rounded-2xl border border-white/10 bg-transparent px-4 py-2.5 text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white transition-all disabled:opacity-50"
            >
              {t('cancel') || "Cancelar"}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-medium text-black hover:bg-white/90 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : mode === "create" ? (
                <Plus className="h-4 w-4" />
              ) : (
                <Edit2 className="h-4 w-4" />
              )}
              {mode === "create" ? (t('create') || "Crear") : (t('save') || "Guardar")}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
