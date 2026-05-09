"use client";

import { useEffect, useState } from "react";
import { apiJson } from "@/lib/api";
import { useTranslations } from "next-intl";
import { Loader2, Layers, ArrowLeft, Plus } from "lucide-react";
import { Link } from "@/i18n/routing";
import { toast } from "sonner";
import { CategoryCard } from "./_components/CategoryCard";
import { CategoryDialog } from "./_components/CategoryDialog";
import { motion, AnimatePresence } from "framer-motion";
import { useRealtime } from "@/hooks/useRealtime";

type Category = { id: string; name: string; userId?: string | null };

export default function Page() {
  const t = useTranslations('Categories');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editCatId, setEditCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState("");

  const loadData = async () => {
    const res = await apiJson(`/api/proxy/categories`);
    if (!res.ok) {
      toast.error(res.error || t('errorLoad') || "Error al cargar categorías");
      setLoading(false);
      return;
    }
    const items = ((res.data as any)?.items || []).map((c: any) => ({ id: c.id, name: c.name, userId: c.userId ?? null })) as Category[];
    setCategories(items.sort((a, b) => a.name.localeCompare(b.name)));
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [t]);

  useRealtime(loadData);

  async function handleCreateCategory(id: string | null, name: string) {
    const res = await apiJson(`/api/proxy/categories`, { method: "POST", body: JSON.stringify({ name }) });
    if (!res.ok) {
      toast.error(res.error || t('errorCreate') || "Error al crear la categoría");
      return;
    }
    const cat = (res.data as any)?.item as Category;
    setCategories(prev => [...prev, { id: cat.id, name: cat.name, userId: cat.userId ?? null }].sort((a, b) => a.name.localeCompare(b.name)));
    toast.success("Categoría creada con éxito");
  }

  async function handleEditCategory(id: string | null, name: string) {
    if (!id) return;
    const res = await apiJson(`/api/proxy/categories/${id}`, { method: "PUT", body: JSON.stringify({ name }) });
    if (!res.ok) {
      toast.error(res.error || t('errorEdit') || "Error al actualizar la categoría");
      return;
    }
    const cat = (res.data as any)?.item as Category;
    setCategories(prev => prev.map(c => c.id === id ? { ...c, name: cat.name } : c).sort((a, b) => a.name.localeCompare(b.name)));
    toast.success("Categoría actualizada con éxito");
    setEditOpen(false);
  }

  function openEdit(id: string, name: string) {
    setEditCatId(id);
    setEditCatName(name);
    setEditOpen(true);
  }

  async function handleDeleteCategory(id: string) {
    const cat = categories.find(c => c.id === id);
    if (!cat || cat.userId == null) return;
    
    setDeletingId(id);
    const previous = [...categories];
    
    // Optimistic UI update
    setCategories(prev => prev.filter(c => c.id !== id));

    const res = await apiJson(`/api/proxy/categories/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error(res.error || t('errorDelete') || "Error al eliminar la categoría");
      setCategories(previous); // Rollback
    } else {
      toast.success("Categoría eliminada con éxito");
    }
    setDeletingId(null);
  }

  const userCategories = categories.filter(c => c.userId);
  const defaultCategories = categories.filter(c => !c.userId);

  return (
    <section className="space-y-8 max-w-[1600px] w-full mx-auto px-6 md:px-8 xl:px-12 py-6 md:py-8 lg:py-10" id="categories-page-container">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-4xl md:text-5xl font-playfair font-bold text-white tracking-tight flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md border border-white/20">
              <Layers className="h-6 w-6 text-white" />
            </div>
            {t('title') || "Categorías"}
          </h1>
          <p className="text-lg text-white/50 mt-2">{t('description') || "Organiza tus transacciones personalizando tus categorías."}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link 
            href="/transactions" 
            className="inline-flex items-center justify-center gap-2 text-sm text-white/70 hover:text-white transition-all bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2.5 rounded-2xl backdrop-blur-md"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('backToExpense') || "Volver"}
          </Link>
          <div id="btn-new-category">
            <CategoryDialog mode="create" onSave={handleCreateCategory} />
          </div>
        </div>
      </div>

      <CategoryDialog 
        mode="edit" 
        open={editOpen} 
        onOpenChange={setEditOpen} 
        initialName={editCatName} 
        categoryId={editCatId || undefined} 
        onSave={handleEditCategory} 
      />

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="h-40 rounded-3xl border border-white/5 bg-white/5 animate-pulse backdrop-blur-md" />
          ))}
        </div>
      ) : (
        <div className="space-y-12">
          {/* User Categories */}
          <div className="space-y-6">
            <h2 className="text-xl font-playfair text-white/90 flex items-center gap-2">
              {t('yourCategories') || "Mis Categorías"}
              <span className="text-sm font-sans bg-white/10 px-2 py-0.5 rounded-full text-white/60">
                {userCategories.length}
              </span>
            </h2>
            
            {userCategories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 rounded-3xl border border-dashed border-white/10 bg-white/[0.02] backdrop-blur-md text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/5 border border-white/10 mb-4">
                  <Plus className="h-8 w-8 text-white/30" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">{t('noUserCategories') || "Sin categorías personalizadas"}</h3>
                <p className="text-white/50 max-w-sm">
                  Crea tu primera categoría para organizar mejor tus transacciones y tener un control más detallado.
                </p>
              </div>
            ) : (
              <motion.div 
                id="my-categories-list"
                className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
                initial="hidden"
                animate="show"
                variants={{
                  hidden: { opacity: 0 },
                  show: {
                    opacity: 1,
                    transition: { staggerChildren: 0.05 }
                  }
                }}
              >
                <AnimatePresence mode="popLayout">
                  {userCategories.map(c => (
                    <CategoryCard 
                      key={c.id} 
                      id={c.id} 
                      name={c.name} 
                      isDefault={false} 
                      onDelete={handleDeleteCategory}
                      onEdit={openEdit}
                      isDeleting={deletingId === c.id}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </div>

          {/* Default Categories */}
          <div className="space-y-6">
            <h2 className="text-xl font-playfair text-white/90 flex items-center gap-2">
              {t('defaultCategories') || "Categorías del Sistema"}
              <span className="text-sm font-sans bg-white/10 px-2 py-0.5 rounded-full text-white/60">
                {defaultCategories.length}
              </span>
            </h2>
            
            {defaultCategories.length === 0 ? (
              <div className="text-sm text-white/50 italic py-4">{t('noDefaultCategories') || "No hay categorías predeterminadas"}</div>
            ) : (
              <div id="system-categories-list" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 opacity-70 hover:opacity-100 transition-opacity duration-500">
                {defaultCategories.map(c => (
                  <CategoryCard 
                    key={c.id} 
                    id={c.id} 
                    name={c.name} 
                    isDefault={true} 
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
