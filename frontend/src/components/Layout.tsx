import { Outlet, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { 
  Trophy, 
  LayoutDashboard, 
  Settings, 
  LogOut, 
  BarChart2, 
  Megaphone, 
  Users, 
  Activity as ActivityIcon, 
  ChevronDown, 
  ChevronLeft,
  Plus
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import ProfileModal from './ProfileModal';
import { getUserDisplayName } from '../utils/userUtils';
import { useTournaments } from '../api/hooks/useTournaments';
import { useTournamentStore } from '../store/tournament';

export default function Layout() {
  const { isAuthenticated, user, logout: storeLogout, setUser, token } = useAuthStore();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const handleLogout = () => {
    storeLogout();
    queryClient.clear();
    localStorage.removeItem('redirect_after_login');
  };

  const { activeTournamentId, setActiveTournamentId } = useTournamentStore();
  const { data: tournaments } = useTournaments();

  // Redirect to hub if trying to access a tournament-specific page without selecting one
  const isRestrictedRoute = ['/matchcenter', '/leaderboard', '/analysis', '/campaigns', '/leagues'].some(
    path => location.pathname.startsWith(path)
  );

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

  // Dynamic header page title mapping
  const getPageTitle = (pathname: string) => {
    if (pathname === '/') return 'TOURNAMENT HUB';
    if (pathname.startsWith('/matchcenter')) return 'MATCH CENTER';
    if (pathname.startsWith('/match/')) return 'MATCH DETAILS';
    if (pathname.startsWith('/leaderboard')) return 'STANDINGS';
    if (pathname.startsWith('/leagues')) {
      if (pathname.includes('/admin')) return 'LEAGUE CONTROL';
      if (pathname !== '/leagues') return 'LEAGUE DETAILS';
      return 'BATTLEGROUNDS';
    }
    if (pathname.startsWith('/analysis')) return 'ANALYTICS';
    if (pathname.startsWith('/campaigns')) {
      if (pathname !== '/campaigns') return 'CAMPAIGN ENTRY';
      return 'CAMPAIGNS';
    }
    if (pathname.startsWith('/activity')) return 'ACTIVITY';
    if (pathname.startsWith('/admin')) return 'ADMIN CONSOLE';
    if (pathname.startsWith('/more')) return 'SETTINGS';
    return 'GULLY PREDICT';
  };

  // Determine if we should show a back button instead of the tournament selector
  const isDetailRoute = ['/match/', '/leagues/', '/campaigns/', '/admin/'].some(
    prefix => location.pathname.startsWith(prefix) && location.pathname !== prefix.replace(/\/$/, '')
  );

  return (
    <div className="min-h-screen flex flex-col bg-ipl-navy">
      {/* Mobile Top Navigation Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 md:hidden bg-ipl-surface/85 backdrop-blur-xl border-b border-white/5 pt-[env(safe-area-inset-top)] select-none">
        <div className="px-4 flex items-center justify-between h-14">
          {/* Left Element: Back Button or Tournament Selector */}
          <div className="w-[30%] flex justify-start">
            {isDetailRoute ? (
              <button 
                onClick={() => navigate(-1)} 
                className="flex items-center gap-0.5 text-xs font-display uppercase tracking-widest text-gray-300 active:opacity-60"
              >
                <ChevronLeft className="w-4 h-4 text-ipl-gold shrink-0" />
                Back
              </button>
            ) : (
              activeTournamentId && tournaments && tournaments.length > 0 && (
                <div className="relative flex items-center">
                  <select 
                    value={activeTournamentId}
                    onChange={(e) => setActiveTournamentId(e.target.value)}
                    className="appearance-none bg-white/5 border border-white/10 rounded-full pl-2.5 pr-6 py-1 text-[10px] font-display uppercase tracking-widest text-white focus:outline-none cursor-pointer transition-colors"
                  >
                    {tournaments.map(t => (
                      <option key={t.id} value={t.id} className="bg-ipl-surface text-white">
                        {t.name.split(' ')[0] || t.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 w-3 h-3 text-gray-400 pointer-events-none" />
                </div>
              )
            )}
          </div>

          {/* Center Element: Current Title */}
          <div className="w-[40%] text-center">
            <span className="text-sm font-display font-bold text-white tracking-widest uppercase block truncate">
              {getPageTitle(location.pathname)}
            </span>
          </div>

          {/* Right Element: User Avatar Settings Link */}
          <div className="w-[30%] flex justify-end items-center gap-2.5">
            {location.pathname === '/leagues' && (
              <button 
                onClick={() => navigate('/leagues?join=true')}
                className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-ipl-gold active:scale-90 transition-transform shrink-0"
                title="Join Battleground"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
            {user && (
              <button onClick={() => setIsProfileOpen(true)} className="relative active:scale-95 transition-transform shrink-0">
                <img 
                  src={user.avatar || `https://ui-avatars.com/api/?name=${getUserDisplayName(user)}&background=0B0E1A&color=F4C430`} 
                  alt="avatar" 
                  className="w-7 h-7 rounded-lg border border-white/20 object-cover" 
                />
                <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-ipl-gold rounded-full border border-ipl-navy flex items-center justify-center">
                  <Settings className="w-1.5 h-1.5 text-ipl-navy" />
                </div>
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Desktop Navigation Header */}
      <nav className="hidden md:block border-b border-white/5 bg-ipl-surface/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
              <Link to="/" className="text-2xl font-display font-bold text-ipl-gold tracking-widest flex items-center gap-2">
                <Trophy className="w-6 h-6" />
                Gully Predict
              </Link>

              {activeTournamentId && (
                <div className="relative group">
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

              <div className="flex space-x-4">
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
                  </button>
                  <button onClick={() => setIsProfileOpen(true)} className="relative">
                    <img src={user.avatar || `https://ui-avatars.com/api/?name=${getUserDisplayName(user)}&background=0B0E1A&color=F4C430`} alt="avatar" className="w-9 h-9 rounded-xl border border-white/10 group-hover:border-ipl-gold transition-all shadow-lg object-cover" />
                    <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-ipl-gold rounded-full border-2 border-ipl-navy flex items-center justify-center">
                      <Settings className="w-2 h-2 text-ipl-navy" />
                    </div>
                  </button>
                  <button onClick={handleLogout} className="text-gray-400 hover:text-white transition-colors ml-2" title="Logout">
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 py-6 md:py-8 pt-[calc(4.5rem+env(safe-area-inset-top))] pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pt-8 md:pb-8">
        <Outlet />
      </main>

      {/* Mobile Fixed Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-ipl-surface/85 backdrop-blur-xl border-t border-white/5 pb-[env(safe-area-inset-bottom)] select-none">
        <div className="flex items-center justify-around h-14">
          {/* Matches Tab */}
          <Link 
            to="/matchcenter"
            className={`flex flex-col items-center justify-center w-16 h-12 transition-all duration-150 active:scale-95 ${
              location.pathname.startsWith('/matchcenter') || location.pathname.startsWith('/match/')
                ? 'text-ipl-gold' 
                : 'text-gray-500'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-[9px] font-display uppercase tracking-widest mt-1">Matches</span>
          </Link>

          {/* Standings Tab */}
          <Link 
            to="/leaderboard"
            className={`flex flex-col items-center justify-center w-16 h-12 transition-all duration-150 active:scale-95 ${
              location.pathname.startsWith('/leaderboard') ? 'text-ipl-gold' : 'text-gray-500'
            }`}
          >
            <Trophy className="w-5 h-5" />
            <span className="text-[9px] font-display uppercase tracking-widest mt-1">Standings</span>
          </Link>

          {/* Leagues Tab */}
          <Link 
            to="/leagues"
            className={`flex flex-col items-center justify-center w-16 h-12 transition-all duration-150 active:scale-95 ${
              location.pathname.startsWith('/leagues') ? 'text-ipl-gold' : 'text-gray-500'
            }`}
          >
            <Users className="w-5 h-5" />
            <span className="text-[9px] font-display uppercase tracking-widest mt-1">Leagues</span>
          </Link>

          {/* Activity Tab */}
          <Link 
            to="/activity"
            className={`flex flex-col items-center justify-center w-16 h-12 transition-all duration-150 active:scale-95 ${
              location.pathname.startsWith('/activity') ? 'text-ipl-gold' : 'text-gray-500'
            }`}
          >
            <ActivityIcon className="w-5 h-5" />
            <span className="text-[9px] font-display uppercase tracking-widest mt-1">Activity</span>
          </Link>

          {/* More Tab */}
          <Link 
            to="/more"
            className={`flex flex-col items-center justify-center w-16 h-12 transition-all duration-150 active:scale-95 ${
              location.pathname.startsWith('/more') || location.pathname.startsWith('/campaigns') || location.pathname.startsWith('/analysis') || location.pathname.startsWith('/admin')
                ? 'text-ipl-gold' 
                : 'text-gray-500'
            }`}
          >
            <Settings className="w-5 h-5" />
            <span className="text-[9px] font-display uppercase tracking-widest mt-1">More</span>
          </Link>
        </div>
      </nav>

      {/* Global Profile Editor Sheet */}
      <ProfileModal 
        isOpen={isProfileOpen} 
        onClose={() => setIsProfileOpen(false)} 
      />
    </div>
  );
}
