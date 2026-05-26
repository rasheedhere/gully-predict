import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useQueryClient } from '@tanstack/react-query';
import { BarChart2, Megaphone, Settings, LogOut, ChevronRight, User } from 'lucide-react';
import { getUserDisplayName } from '../utils/userUtils';
import ProfileModal from '../components/ProfileModal';

export default function More() {
  const { user, logout } = useAuthStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  if (!user) return null;

  const handleLogout = () => {
    logout();
    queryClient.clear();
    localStorage.removeItem('redirect_after_login');
    navigate('/login');
  };

  return (
    <div className="max-w-md mx-auto space-y-8 select-none">
      {/* Page Header */}
      <header className="px-2">
        <h1 className="text-3xl font-display font-bold text-white tracking-tight">Settings</h1>
        <p className="text-xs text-gray-500 uppercase tracking-widest font-display mt-1">Preferences & Controls</p>
      </header>

      {/* User Profile Card */}
      <button
        onClick={() => setIsProfileOpen(true)}
        className="w-full text-left bg-white/5 border border-white/10 rounded-[22px] p-4 flex items-center gap-4 active:scale-[0.98] active:bg-white/10 transition-all select-none duration-150"
      >
        <img
          src={user.avatar || `https://ui-avatars.com/api/?name=${getUserDisplayName(user)}&background=0B0E1A&color=F4C430`}
          alt="avatar"
          className="w-14 h-14 rounded-2xl border border-white/20 object-cover shrink-0"
        />
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-display font-bold text-white leading-tight truncate">
            {getUserDisplayName(user)}
          </h2>
          <p className="text-xs text-gray-400 truncate mt-0.5">{user.email}</p>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-500 shrink-0" />
      </button>

      {/* Settings Sections */}
      <div className="space-y-6">
        {/* Section 1: Gameplay & Analytics */}
        <div className="space-y-2">
          <h3 className="text-[10px] font-display text-gray-500 uppercase tracking-[0.2em] px-4">Arena Tools</h3>
          <div className="bg-white/5 border border-white/10 rounded-[22px] overflow-hidden divide-y divide-white/5">
            <button
              onClick={() => navigate('/campaigns')}
              className="w-full flex items-center gap-4 px-4 py-4 active:bg-white/10 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-ipl-gold/10 flex items-center justify-center text-ipl-gold shrink-0">
                <Megaphone className="w-4 h-4" />
              </div>
              <span className="flex-1 text-sm font-display text-white uppercase tracking-wider font-bold">Campaigns</span>
              <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
            </button>

            <button
              onClick={() => navigate('/analysis')}
              className="w-full flex items-center gap-4 px-4 py-4 active:bg-white/10 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
                <BarChart2 className="w-4 h-4" />
              </div>
              <span className="flex-1 text-sm font-display text-white uppercase tracking-wider font-bold">Analysis</span>
              <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
            </button>
          </div>
        </div>

        {/* Section 2: Management Controls (Admin only) */}
        {(user.is_admin || user.is_league_admin) && (
          <div className="space-y-2 animate-in fade-in duration-300">
            <h3 className="text-[10px] font-display text-gray-500 uppercase tracking-[0.2em] px-4">Management</h3>
            <div className="bg-white/5 border border-white/10 rounded-[22px] overflow-hidden">
              <button
                onClick={() => navigate('/admin')}
                className="w-full flex items-center gap-4 px-4 py-4 active:bg-white/10 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 shrink-0">
                  <Settings className="w-4 h-4" />
                </div>
                <span className="flex-1 text-sm font-display text-white uppercase tracking-wider font-bold">Admin Console</span>
                <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
              </button>
            </div>
          </div>
        )}

        {/* Section 3: Account & Session */}
        <div className="space-y-2">
          <h3 className="text-[10px] font-display text-gray-500 uppercase tracking-[0.2em] px-4">Account</h3>
          <div className="bg-white/5 border border-white/10 rounded-[22px] overflow-hidden divide-y divide-white/5">
            <button
              onClick={() => setIsProfileOpen(true)}
              className="w-full flex items-center gap-4 px-4 py-4 active:bg-white/10 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center text-green-400 shrink-0">
                <User className="w-4 h-4" />
              </div>
              <span className="flex-1 text-sm font-display text-white uppercase tracking-wider font-bold">Edit Profile</span>
              <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
            </button>

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-4 px-4 py-4 active:bg-red-500/10 transition-colors text-left text-red-500"
            >
              <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 shrink-0">
                <LogOut className="w-4 h-4" />
              </div>
              <span className="flex-1 text-sm font-display uppercase tracking-wider font-bold">Log Out</span>
              <ChevronRight className="w-4 h-4 text-red-500/50 shrink-0" />
            </button>
          </div>
        </div>
      </div>

      {/* App Version Info */}
      <footer className="text-center pt-4 opacity-30">
        <p className="text-[9px] font-mono tracking-widest uppercase">Gully Predict - Gully to Glory!</p>
        <p className="text-[8px] font-mono text-gray-500 mt-1">All rights reserved to Gully Predict</p>
      </footer>

      {/* Profile Edit Overlay */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />
    </div>
  );
}
