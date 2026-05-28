import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/auth';
import { useUpdateProfile } from '../api/hooks/useUser';
import { X, User, Shield, Check, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const user = useAuthStore((state) => state.user);
  const updateProfile = useUpdateProfile();
  
  const [alias, setAlias] = useState(user?.alias || '');
  const [useAlias, setUseAlias] = useState(user?.use_alias || false);

  useEffect(() => {
    if (user) {
      setAlias(user.alias);
      setUseAlias(user.use_alias);
    }
  }, [user]);

  // Lock body scroll when profile settings sheet is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !user) return null;

  const handleSave = async () => {
    try {
      await updateProfile.mutateAsync({
        alias,
        use_alias: useAlias
      });
      toast.success('PROFILE UPDATED');
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Update failed');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-4 select-none md:select-text">
      {/* Backdrop overlay */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300" 
        onClick={onClose} 
      />
      
      {/* Sheet / Modal Panel */}
      <div className="relative w-full md:max-w-md bg-ipl-surface border-t border-white/10 rounded-t-[28px] md:rounded-3xl shadow-2xl z-10 flex flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-8 md:p-8 p-6 md:border-t-4 md:border-ipl-gold animate-in slide-in-from-bottom md:zoom-in-95 duration-300 max-md:max-h-[85vh]">
        {/* iOS Drag Handle */}
        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-5 shrink-0 md:hidden" />

        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors p-1 active:scale-90"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Scrollable Form Content (Important when virtual keyboard rises) */}
        <div className="overflow-y-auto scrollbar-hide flex-1 space-y-6 max-md:-mx-2 max-md:px-2 pb-2">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-ipl-gold/10 border border-ipl-gold/20 flex items-center justify-center shrink-0">
              <User className="w-7 h-7 text-ipl-gold" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-display font-bold text-white italic uppercase tracking-tight">Identity Settings</h2>
              <p className="text-gray-500 text-[9px] md:text-[10px] font-display uppercase tracking-widest">Configure your battlefield presence</p>
            </div>
          </div>

          <div className="space-y-6 text-left">
            {/* Alias Input */}
            <div className="space-y-2">
              <label className="block text-[10px] font-display uppercase tracking-[0.2em] text-gray-400">Battlefield Alias</label>
              <div className="relative">
                <input
                  type="text"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value.replace(/[^a-zA-Z0-9-]/g, ''))}
                  placeholder="Enter Alias"
                  className="w-full bg-black/40 border-2 border-white/10 rounded-2xl px-4 py-4 text-white font-display tracking-widest focus:outline-none focus:border-ipl-gold transition-all text-base md:text-sm"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[8px] text-gray-600 font-display uppercase tracking-widest pointer-events-none">
                  Unique Identity
                </div>
              </div>
              <p className="text-[9px] text-gray-500 font-display uppercase tracking-widest leading-relaxed px-1">
                Your alias must be unique. Only letters, numbers, and hyphens allowed.
              </p>
            </div>

            {/* Toggle Display */}
            <div className="space-y-3">
              <label className="block text-[10px] font-display uppercase tracking-[0.2em] text-gray-400">Display Preference</label>
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setUseAlias(false)}
                  className={`p-4 rounded-xl border-2 transition-all flex flex-col gap-2 items-center text-center active:scale-95 ${!useAlias ? 'border-ipl-gold bg-ipl-gold/5' : 'border-white/5 bg-white/5'}`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${!useAlias ? 'bg-ipl-gold text-ipl-navy' : 'bg-white/10 text-gray-500'}`}>
                    <User className="w-4 h-4" />
                  </div>
                  <span className={`text-[10px] font-display font-bold uppercase tracking-widest ${!useAlias ? 'text-ipl-gold' : 'text-gray-500'}`}>Real Name</span>
                  <span className="text-[8px] text-gray-600 font-display uppercase tracking-tighter line-clamp-1">{user.name}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setUseAlias(true)}
                  className={`p-4 rounded-xl border-2 transition-all flex flex-col gap-2 items-center text-center active:scale-95 ${useAlias ? 'border-ipl-gold bg-ipl-gold/5' : 'border-white/5 bg-white/5'}`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${useAlias ? 'bg-ipl-gold text-ipl-navy' : 'bg-white/10 text-gray-500'}`}>
                    <Shield className="w-4 h-4" />
                  </div>
                  <span className={`text-[10px] font-display font-bold uppercase tracking-widest ${useAlias ? 'text-ipl-gold' : 'text-gray-500'}`}>Alias Mode</span>
                  <span className="text-[8px] text-gray-600 font-display uppercase tracking-tighter line-clamp-1">{alias || 'No Alias'}</span>
                </button>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={updateProfile.isPending || !alias}
              className="w-full bg-ipl-gold text-ipl-navy py-4 rounded-2xl font-display text-[11px] tracking-[0.3em] font-bold uppercase transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-30 shadow-[0_10px_20px_rgba(244,196,48,0.2)] mt-4 flex items-center justify-center gap-3"
            >
              {updateProfile.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              {updateProfile.isPending ? 'SYNCING...' : 'SAVE CHANGES'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
