'use client';
import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Plus, Check, Loader2, X, UserPlus, Trash2 } from 'lucide-react';
import { useRouter } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';
import Portal from '@/components/Portal';
import { useTranslations } from 'next-intl';
import { UpgradePromptDialog } from './UpgradePromptDialog';

import { apiJson } from '@/lib/api';

type Profile = {
  id: string;
  name: string;
  color?: string | null;
  avatar?: string | null;
  isDefault: boolean;
};

type Limits = {
    current: number;
    max: number;
    remaining: number;
    canCreate: boolean;
};

export default function ProfileSwitcher() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [limits, setLimits] = useState<Limits | null>(null);
  const [user, setUser] = useState<any>(null);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [creating, setCreating] = useState(false);
  
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('Sidebar'); 

  useEffect(() => {
    // Check for post-purchase action
    if (searchParams.get('action') === 'profile_purchased') {
        setShowCreateModal(true);
        // Clean URL
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
    }
  }, [searchParams]);

  const fetchData = () => {
    setLoading(true);
    apiJson('/api/auth/me')
      .then(res => {
        if (res.ok && res.data && res.data.ok) {
          console.log('Profile limits:', res.data.limits);
          setProfiles(res.data.profiles || []);
          setActiveProfileId(res.data.currentProfileId);
          setLimits(res.data.limits || null);
          setUser(res.data.user || null);
        }
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();

    if (typeof window !== 'undefined') {
      const bc = new BroadcastChannel('contapro:mutated');
      const handleMessage = (e: MessageEvent) => {
        if (e.data === 'realtime_mutation' || e.data === 'updated' || e.data === 'deleted') {
          fetchData();
        }
      };
      bc.addEventListener('message', handleMessage);
      return () => {
        bc.removeEventListener('message', handleMessage);
        bc.close();
      };
    }
  }, []);

  const handleToggle = () => {
    if (isOpen) {
        setIsOpen(false);
        return;
    }
    setIsOpen(true);
    // Calculate position
    if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setMenuPos({
            top: rect.bottom + 8,
            left: rect.left
        });
    }
  };

  const handleSwitch = async (profileId: string) => {
    if (profileId === activeProfileId) {
      setIsOpen(false);
      return;
    }
    
    setSwitching(true);
    try {
      const res = await apiJson('/api/auth/switch-profile', {
        method: 'POST',
        body: JSON.stringify({ profileId })
      });
      
      if (res.ok && res.data && res.data.ok) {
        // Reload to apply new session
        window.location.reload();
      } else {
        setSwitching(false);
      }
    } catch {
      setSwitching(false);
    }
  };

  const handleDelete = async (profileId: string) => {
      if (!confirm('¿Estás seguro de eliminar este perfil? Se borrarán todos sus datos (gastos, presupuestos, etc.) permanentemente.')) return;
      
      setSwitching(true);
      try {
          const res = await apiJson(`/api/profiles/${profileId}`, { method: 'DELETE' });
          if (res.ok) {
              window.location.reload();
          } else {
              alert(res.error || 'Error al eliminar perfil');
              setSwitching(false);
          }
      } catch {
          alert('Error de conexión');
          setSwitching(false);
      }
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfileName.trim()) return;
    
    setCreating(true);
    try {
        const res = await apiJson('/api/profiles', {
            method: 'POST',
            body: JSON.stringify({ name: newProfileName })
        });
        
        if (res.ok && res.data) {
             // Profile created, now switch to it or reload
             window.location.reload();
        } else {
            const error = res.error || 'Error al crear perfil';
            if (res.data?.upgradeUrl) {
                // Limit reached
                if (confirm('Has alcanzado el límite de perfiles. ¿Deseas adquirir un espacio extra?')) {
                     setShowCreateModal(false);
                     handleBuyExtra();
                }
            } else {
                alert(error);
            }
        }
    } catch (e) {
        alert('Error inesperado al crear perfil');
    } finally {
        setCreating(false);
    }
  };

  const handleBuyExtra = async () => {
    const isPremium = user?.plan === 'PREMIUM' && user?.planExpires && new Date(user.planExpires) > new Date();
    const isLifetime = user?.plan === 'LIFETIME';
    const hasTrial = user?.trialEnds && new Date(user.trialEnds) > new Date();
    const hasFullAccess = isPremium || isLifetime || hasTrial;

    if (!hasFullAccess) {
        setShowUpgradePrompt(true);
        setIsOpen(false);
        return;
    }

    router.push('/billing?action=buy_profile');
    setIsOpen(false);
  };

  const activeProfile = profiles.find(p => p.id === activeProfileId);

  if (loading) {
      return <div className="h-8 w-32 bg-muted/50 rounded animate-pulse" />;
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        disabled={switching}
        className="flex items-center gap-3 rounded-[20px] border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-white/10 transition-all backdrop-blur-md"
      >
        <div 
            className="flex h-6 w-6 items-center justify-center rounded-full text-xs text-white shadow-inner"
            style={{ 
                background: activeProfile?.color ? `linear-gradient(135deg, ${activeProfile.color} 0%, ${activeProfile.color}cc 100%)` : 'linear-gradient(135deg, #a855f7 0%, #3b82f6 100%)'
            }}
        >
            {(activeProfile?.name?.[0] || 'U').toUpperCase()}
        </div>
        <span className="max-w-[100px] truncate text-base">{activeProfile?.name || 'Perfil'}</span>
        <ChevronDown className="h-4 w-4 text-white/70" />
      </button>

      {isOpen && (
        <Portal>
            <>
                <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} aria-hidden="true" />
                <div 
                    ref={menuRef}
                    className="fixed z-50 min-w-[220px] rounded-2xl border border-white/10 bg-white/5 backdrop-blur-2xl p-1.5 shadow-xl ring-1 ring-white/10 animate-in fade-in zoom-in-95 duration-100 text-white"
                    style={{
                        top: menuPos.top,
                        left: menuPos.left
                    }}
                >
                    <div className="px-2 py-1.5 text-xs font-semibold text-white/70 flex justify-between items-center">
                        <span>Cambiar perfil</span>
                        {limits && (
                            <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded-full border border-white/10">
                                {limits.current} / {limits.max}
                            </span>
                        )}
                    </div>
                    
                    <div className="space-y-0.5">
                        {profiles.map(profile => (
                            <div 
                                key={profile.id} 
                                className={`group flex items-center justify-between rounded-xl px-2 py-1.5 text-sm transition-colors ${
                                    profile.id === activeProfileId 
                                        ? 'bg-white/20 text-white' 
                                        : 'hover:bg-white/10 text-white/90'
                                }`}
                            >
                                <button
                                    onClick={() => handleSwitch(profile.id)}
                                    disabled={switching}
                                    className="flex flex-1 items-center gap-2 text-left"
                                >
                                    <div 
                                        className="flex h-6 w-6 items-center justify-center rounded-full text-xs text-white shrink-0 shadow-inner"
                                        style={{ 
                                            background: profile.color ? `linear-gradient(135deg, ${profile.color} 0%, ${profile.color}cc 100%)` : 'linear-gradient(135deg, #a855f7 0%, #3b82f6 100%)'
                                        }}
                                    >
                                        {(profile.name?.[0] || 'U').toUpperCase()}
                                    </div>
                                    <span className="truncate max-w-[110px]">{profile.name}</span>
                                    {profile.id === activeProfileId && <Check className="h-4 w-4 shrink-0" />}
                                </button>
                                
                                {!profile.isDefault && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(profile.id);
                                        }}
                                        disabled={switching}
                                        className="ml-2 p-1 text-white/50 hover:text-red-400 hover:bg-red-400/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all focus:opacity-100"
                                        title="Eliminar perfil"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="my-1.5 h-px bg-white/10" />

                    {limits?.canCreate && (
                        <button
                            onClick={() => {
                                setIsOpen(false);
                                setShowCreateModal(true);
                            }}
                            disabled={switching}
                            className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                        >
                            <div className="flex h-6 w-6 items-center justify-center rounded-lg border border-dashed border-white/30">
                                <UserPlus className="h-4 w-4" />
                            </div>
                            <span>Crear nuevo perfil</span>
                        </button>
                    )}

                    <button
                        onClick={handleBuyExtra}
                        disabled={switching}
                        className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                    >
                        <div className="flex h-6 w-6 items-center justify-center rounded-lg border border-dashed border-white/30">
                            <Plus className="h-4 w-4" />
                        </div>
                        <span>Comprar perfil extra</span>
                    </button>
                </div>
            </>
        </Portal>
      )}
      
      {showCreateModal && (
          <Portal>
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                  <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 backdrop-blur-2xl p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200 text-white">
                      <div className="flex items-center justify-between mb-4">
                          <h2 className="text-lg font-playfair font-semibold">Crear nuevo perfil</h2>
                          <button onClick={() => setShowCreateModal(false)} className="text-white/50 hover:text-white transition-colors">
                              <X className="h-5 w-5" />
                          </button>
                      </div>
                      
                      <form onSubmit={handleCreateProfile} className="space-y-4">
                          <div>
                              <label htmlFor="profileName" className="block text-sm font-medium mb-1.5 text-white/80">
                                  Nombre del perfil
                              </label>
                              <input
                                  id="profileName"
                                  type="text"
                                  value={newProfileName}
                                  onChange={(e) => setNewProfileName(e.target.value)}
                                  placeholder="Ej. Negocio Personal, Startup..."
                                  className="flex h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all"
                                  autoFocus
                              />
                          </div>
                          
                          <div className="flex justify-end gap-3 pt-2">
                              <button
                                  type="button"
                                  onClick={() => setShowCreateModal(false)}
                                  className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-white hover:bg-white/5 transition-colors focus:outline-none"
                              >
                                  Cancelar
                              </button>
                              <button
                                  type="submit"
                                  disabled={creating || !newProfileName.trim()}
                                  className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90 transition-colors focus:outline-none disabled:pointer-events-none disabled:opacity-50"
                              >
                                  {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                  Crear Perfil
                              </button>
                          </div>
                      </form>
                  </div>
              </div>
          </Portal>
      )}

      {switching && (
          <div className="fixed inset-0 z-[60] bg-background/50 backdrop-blur-sm flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
      )}

      <UpgradePromptDialog open={showUpgradePrompt} onOpenChange={setShowUpgradePrompt} />
    </div>
  );
}
