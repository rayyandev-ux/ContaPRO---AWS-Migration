"use client";

import { motion } from "framer-motion";
import { Lock, Edit2 } from "lucide-react";
import { getCategoryVisuals, extractEmoji } from "./category-emoji-utils";
import { useTranslations } from "next-intl";
import { DeleteConfirmButton } from "./DeleteConfirmButton";

type CategoryCardProps = {
  id: string;
  name: string;
  isDefault: boolean;
  onDelete?: (id: string) => void;
  onEdit?: (id: string, name: string) => void;
  isDeleting?: boolean;
};

export function CategoryCard({ id, name, isDefault, onDelete, onEdit, isDeleting }: CategoryCardProps) {
  const t = useTranslations('Categories');
  const { emoji, name: cleanName } = extractEmoji(name);
  const { colorClass } = getCategoryVisuals(cleanName);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
      className="group relative flex flex-col items-center justify-center gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md transition-all duration-300 hover:border-white/20 hover:bg-white/10"
    >
      <div
        className={`flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br border shadow-inner ${colorClass}`}
      >
        <span className="text-3xl">{emoji}</span>
      </div>
      
      <div className="text-center">
        <h3 className="font-medium text-white line-clamp-1 px-2">{cleanName}</h3>
        {isDefault && (
          <span className="mt-1 flex items-center justify-center gap-1 text-xs text-white/40">
            <Lock className="h-3 w-3" />
            {t('defaultCategories')}
          </span>
        )}
      </div>

      {!isDefault && onEdit && (
        <button
          onClick={() => onEdit(id, name)}
          title={t('edit') || "Editar"}
          className="absolute left-3 top-3 rounded-full bg-black/20 p-2 text-white/40 opacity-0 backdrop-blur-md transition-all hover:bg-white/20 hover:text-white group-hover:opacity-100 focus:opacity-100"
        >
          <Edit2 className="h-4 w-4" />
        </button>
      )}

      {!isDefault && onDelete && (
        <DeleteConfirmButton onDelete={() => onDelete(id)} isDeleting={isDeleting} />
      )}
    </motion.div>
  );
}

