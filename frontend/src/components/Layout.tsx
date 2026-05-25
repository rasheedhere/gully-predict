import { Outlet, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { Trophy, LayoutDashboard, Settings, LogOut, Menu, X, BarChart2, Megaphone, Users, Activity as ActivityIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import ProfileModal from './ProfileModal';
import { getUserDisplayName } from '../utils/userUtils';
import { useTournaments } from '../api/hooks/useTournaments';
import { useTournamentStore } from '../store/tournament';
import { ChevronDown } from 'lucide-react';

export default function Layout() {
  const { isAuthenticated, user, logout: storeLogout, setUser, token } = useAuthStore();
  const queryClient = useQueryClient();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const location = useLocation();
  const handleLogout = () => {
    storeLogout();
    queryClient.clear();
    localStorage.removeItem('redirect_after_login');
  };

  const { activeTournamentId, setActiveTournamentId } = useTournamentStore();
  const { data: tournaments } = useTournaments();

  // Redirect to hub if trying to access a tournament-specific page without selecting one
  const isRestrictedRoute = ['/matchcenter', '/leaderboard', '/analysis', '/campaigns', '/leagues'].some(path => location.pathname.startsWith(path));

  // Keep profile in sync
  const { data: profile } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await apiClient.get('/auth/me');
      return res.data;
    },
    enabled: isAuthenticated && !!token,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  useEffect(() => {
    if (profile && token) {
      setUser(profile, token);
    }
  }, [profile, token, setUser]);

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (isRestrictedRoute && !activeTournamentId) {
    return <Navigate to="/" replace />;
  }

  const clMenu = () => setIsMenuOpen(false);

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="border-b border-white/5 bg-ipl-surface/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
              <Link to="/" className="text-2xl font-display font-bold text-ipl-gold tracking-widest flex items-center gap-2">
                <Trophy className="w-6 h-6" />
                Gully Predict
              </Link>

              {activeTournamentId && (
                <div className="hidden md:flex relative group">
                  <select 
                    value={activeTournamentId}
                    onChange={(e) => setActiveTournamentId(e.target.value)}
                    className="appearance-none bg-white/5 border border-white/10 rounded-lg pl-3 pr-8 py-1.5 text-xs font-display text-white focus:outline-none focus:border-ipl-gold focus:ring-1 focus:ring-ipl-gold cursor-pointer transition-colors hover:bg-white/10"
                  >
                    {tournaments?.map(t => (
                      <option key={t.id} value={t.id} className="bg-ipl-surface text-white">
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover:text-white transition-colors">
                    <ChevronDown className="w-3 h-3" />
                  </div>
                </div>
              )}

              <div className="hidden md:flex space-x-4">
                <Link to="/matchcenter" className="text-gray-300 hover:text-white flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors">
                  <LayoutDashboard className="w-4 h-4" />
                  MATCH CENTER
                </Link>
                <Link to="/leaderboard" className="text-gray-300 hover:text-white flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors">
                  <Trophy className="w-4 h-4" />
                  LEADERBOARD
                </Link>
                <Link to="/analysis" className="text-gray-300 hover:text-white flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors">
                  <BarChart2 className="w-4 h-4" />
                  ANALYSIS
                </Link>
                <Link to="/campaigns" className="text-gray-300 hover:text-white flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors">
                  <Megaphone className="w-4 h-4" />
                  CAMPAIGNS
                </Link>
                <Link to="/leagues" className="text-gray-300 hover:text-white flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors">
                  <Users className="w-4 h-4" />
                  LEAGUES
                </Link>
                <Link to="/activity" className="text-gray-300 hover:text-white flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors">
                  <ActivityIcon className="w-4 h-4" />
                  ACTIVITY
                </Link>
                {(user?.is_admin || user?.is_league_admin) && (
                  <Link to="/admin" className="text-gray-300 hover:text-white flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors">
                    <Settings className="w-4 h-4" />
                    ADMIN
                  </Link>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              {user && (
                <div className="flex items-center gap-3 group">
                  <button 
                    onClick={() => setIsProfileOpen(true)}
                    className="flex flex-col items-end hover:text-ipl-gold transition-colors text-right"
                  >
                    <span className="text-sm font-display font-bold hidden sm:block leading-none italic uppercase tracking-tight">
                      {getUserDisplayName(user)}
                    </span>
                    <span className="text-[8px] text-gray-500 font-display uppercase tracking-widest mt-1 group-hover:text-ipl-gold/50 transition-colors">
                      Identity Settings
                    </span>
                  </button>
                  <button onClick={() => setIsProfileOpen(true)} className="relative">
                    <img src={user.avatar || `https://ui-avatars.com/api/?name=${user.name}&background=0B0E1A&color=F4C430`} alt="avatar" className="w-9 h-9 rounded-xl border border-white/10 group-hover:border-ipl-gold transition-all shadow-lg object-cover" />
                    <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-ipl-gold rounded-full border-2 border-ipl-navy flex items-center justify-center">
                      <Settings className="w-2 h-2 text-ipl-navy" />
                    </div>
                  </button>
                  <button onClick={handleLogout} className="hidden md:block text-gray-400 hover:text-white transition-colors ml-2" title="Logout">
                    <LogOut className="w-5 h-5" />
                  </button>
                  <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden text-gray-400 hover:text-white p-1 ml-2">
                    {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-ipl-surface border-t border-white/10 p-4 space-y-2 shadow-lg absolute w-full left-0 animate-in slide-in-from-top-2 duration-300">
            <Link to="/matchcenter" onClick={clMenu} className="block text-gray-300 hover:text-white font-medium flex items-center gap-3 px-4 py-3 bg-white/5 rounded-lg active:bg-white/10 transition-colors">
              <LayoutDashboard className="w-5 h-5 text-ipl-gold" />
              MATCH CENTER
            </Link>
            <Link to="/leaderboard" onClick={clMenu} className="block text-gray-300 hover:text-white font-medium flex items-center gap-3 px-4 py-3 bg-white/5 rounded-lg active:bg-white/10 transition-colors">
              <Trophy className="w-5 h-5 text-ipl-gold" />
              LEADERBOARD
            </Link>
            <Link to="/analysis" onClick={clMenu} className="block text-gray-300 hover:text-white font-medium flex items-center gap-3 px-4 py-3 bg-white/5 rounded-lg active:bg-white/10 transition-colors">
              <BarChart2 className="w-5 h-5 text-ipl-gold" />
              ANALYSIS
            </Link>
            <Link to="/campaigns" onClick={clMenu} className="block text-gray-300 hover:text-white font-medium flex items-center gap-3 px-4 py-3 bg-white/5 rounded-lg active:bg-white/10 transition-colors">
              <Megaphone className="w-5 h-5 text-ipl-gold" />
              CAMPAIGNS
            </Link>
            <Link to="/leagues" onClick={clMenu} className="block text-gray-300 hover:text-white font-medium flex items-center gap-3 px-4 py-3 bg-white/5 rounded-lg active:bg-white/10 transition-colors">
              <Users className="w-5 h-5 text-ipl-gold" />
              LEAGUES
            </Link>
            {(user?.is_admin || user?.is_league_admin) && (
              <Link to="/admin" onClick={clMenu} className="block text-gray-300 hover:text-white font-medium flex items-center gap-3 px-4 py-3 bg-white/5 rounded-lg active:bg-white/10 transition-colors">
                <Settings className="w-5 h-5 text-ipl-gold" />
                ADMIN
              </Link>
            )}
            <button onClick={() => { handleLogout(); clMenu(); }} className="w-full text-left text-red-500 hover:text-red-400 font-medium flex items-center gap-3 px-4 py-3 bg-red-500/10 rounded-lg active:bg-red-500/20 transition-colors mt-4">
              <LogOut className="w-5 h-5" />
              LOGOUT
            </button>
          </div>
        )}
      </nav>

      <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      <ProfileModal 
        isOpen={isProfileOpen} 
        onClose={() => setIsProfileOpen(false)} 
      />
    </div>
  );
}
