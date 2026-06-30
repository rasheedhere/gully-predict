import { Outlet, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import {
  Trophy,
  LayoutDashboard,
  Settings,
  LogOut,
  BarChart2,
  BarChart3,
  Megaphone,
  Users,
  Activity as ActivityIcon,
  ChevronLeft,
  LayoutGrid,
  Plus,
  MoreHorizontal
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import ProfileModal from './ProfileModal';
import { getUserDisplayName } from '../utils/userUtils';
import { useUiStore } from '../store/ui';

export default function Layout() {
  const { isAuthenticated, user, logout: storeLogout, setUser, token } = useAuthStore();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const { headerTitle, setHeaderTitle } = useUiStore();

  useEffect(() => {
    setHeaderTitle(null);
  }, [location.pathname, setHeaderTitle]);

  const handleLogout = () => {
    storeLogout();
    queryClient.clear();
    localStorage.removeItem('redirect_after_login');
  };


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

  const isNavActive = (prefix: string) => location.pathname.startsWith(prefix);

  // Determine if we should show a back button instead of the tournament selector
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
    if (pathname.startsWith('/admin')) {
      const params = new URLSearchParams(location.search);
      if (params.has('tournamentId')) return 'MANAGE TOURNAMENT';
      if (params.has('leagueId')) return 'MANAGE LEAGUE';
      return 'ADMIN CONSOLE';
    }
    if (pathname.startsWith('/more')) return 'SETTINGS';
    return 'GULLY PREDICT';
  };

  // Determine if we should show a back button instead of the tournament selector
  const isDetailRoute = ['/match/', '/leagues/', '/campaigns/', '/admin/'].some(
    prefix => location.pathname.startsWith(prefix) && location.pathname !== prefix.replace(/\/$/, '')
  ) || new URLSearchParams(location.search).has('tournamentId') || new URLSearchParams(location.search).has('leagueId');

  return (
    <div className="h-[100dvh] flex flex-col bg-ipl-navy overflow-hidden relative w-full">
      {/* Mobile Top Navigation Header */}
      <nav className="absolute top-0 left-0 right-0 z-50 md:hidden bg-ipl-surface/85 backdrop-blur-xl border-b border-white/5 pt-[env(safe-area-inset-top)] select-none [-webkit-touch-callout:none]">
        <div className="px-4 flex items-center justify-between h-14">
          {/* Left Element: Back Button or Tournament Selector */}
          <div className="w-[30%] flex justify-start">
            {isDetailRoute ? (
              <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-0.5 text-xs font-display uppercase tracking-widest text-gray-300 active:opacity-60 p-2 -ml-2 min-h-[44px] min-w-[44px]"
              >
                <ChevronLeft className="w-4 h-4 text-ipl-gold shrink-0" />
                Back
              </button>
            ) : (
              <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 opacity-0 pointer-events-none">
                {/* Placeholder for alignment */}
              </div>
            )}
          </div>

          {/* Center Element: Brand Title */}
          <div className="w-[40%] text-center">
            <span className="text-sm font-display font-extrabold text-ipl-gold tracking-widest uppercase block truncate">
              {headerTitle || getPageTitle(location.pathname)}
            </span>
          </div>

          {/* Right Element: User Avatar Link */}
          <div className="w-[30%] flex justify-end items-center gap-2.5">
            {location.pathname === '/leagues' && (
              <button
                onClick={() => navigate('/leagues?join=true')}
                className="w-11 h-11 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-ipl-gold active:scale-90 transition-transform shrink-0"
                title="Join Battleground"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
            {user && (
              <button
                onClick={() => setIsProfileOpen(true)}
                className="relative active:scale-95 transition-transform shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-end"
              >
                <img
                  src={user.avatar || `https://ui-avatars.com/api/?name=${getUserDisplayName(user)}&background=0B0E1A&color=F4C430`}
                  alt="avatar"
                  className="w-8 h-8 rounded-full border border-white/20 object-cover"
                />
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Desktop Navigation Header */}
      <nav className="hidden md:block border-b border-white/5 bg-ipl-surface/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-2 lg:space-x-8">
              <Link to="/" className="text-xl md:text-2xl font-display font-bold text-ipl-gold tracking-widest flex items-center gap-2 shrink-0 min-w-[44px] min-h-[44px] p-2.5 -m-2.5">
                <Trophy className="w-6 h-6 shrink-0" />
                <span className="hidden lg:inline">Gully Predict</span>
              </Link>

              <div className="flex space-x-1 lg:space-x-2 xl:space-x-4">
                <Link to="/matchcenter" title="Match Center" className={`text-gray-300 hover:text-white flex items-center gap-1.5 px-2 py-1.5 text-xs lg:text-sm font-medium transition-colors rounded-lg ${isNavActive('/matchcenter') ? 'text-ipl-gold bg-white/5 font-bold' : ''}`}>
                  <LayoutDashboard className="w-4 h-4 shrink-0" />
                  <span className="hidden lg:inline">MATCH CENTER</span>
                </Link>
                <Link to="/leaderboard" title="Leaderboard" className={`text-gray-300 hover:text-white flex items-center gap-1.5 px-2 py-1.5 text-xs lg:text-sm font-medium transition-colors rounded-lg ${isNavActive('/leaderboard') ? 'text-ipl-gold bg-white/5 font-bold' : ''}`}>
                  <Trophy className="w-4 h-4 shrink-0" />
                  <span className="hidden lg:inline">LEADERBOARD</span>
                </Link>
                <Link to="/analysis" title="Analysis" className={`text-gray-300 hover:text-white flex items-center gap-1.5 px-2 py-1.5 text-xs lg:text-sm font-medium transition-colors rounded-lg ${isNavActive('/analysis') ? 'text-ipl-gold bg-white/5 font-bold' : ''}`}>
                  <BarChart2 className="w-4 h-4 shrink-0" />
                  <span className="hidden lg:inline">ANALYSIS</span>
                </Link>
                <Link to="/campaigns" title="Campaigns" className={`text-gray-300 hover:text-white flex items-center gap-1.5 px-2 py-1.5 text-xs lg:text-sm font-medium transition-colors rounded-lg ${isNavActive('/campaigns') ? 'text-ipl-gold bg-white/5 font-bold' : ''}`}>
                  <Megaphone className="w-4 h-4 shrink-0" />
                  <span className="hidden lg:inline">CAMPAIGNS</span>
                </Link>
                <Link to="/leagues" title="Leagues" className={`text-gray-300 hover:text-white flex items-center gap-1.5 px-2 py-1.5 text-xs lg:text-sm font-medium transition-colors rounded-lg ${isNavActive('/leagues') ? 'text-ipl-gold bg-white/5 font-bold' : ''}`}>
                  <Users className="w-4 h-4 shrink-0" />
                  <span className="hidden lg:inline">LEAGUES</span>
                </Link>
                <Link to="/activity" title="Activity" className={`text-gray-300 hover:text-white flex items-center gap-1.5 px-2 py-1.5 text-xs lg:text-sm font-medium transition-colors rounded-lg ${isNavActive('/activity') ? 'text-ipl-gold bg-white/5 font-bold' : ''}`}>
                  <ActivityIcon className="w-4 h-4 shrink-0" />
                  <span className="hidden lg:inline">ACTIVITY</span>
                </Link>
                {(user?.is_admin || user?.is_league_admin) && (
                  <Link to="/admin" title="Admin" className={`text-gray-300 hover:text-white flex items-center gap-1.5 px-2 py-1.5 text-xs lg:text-sm font-medium transition-colors rounded-lg ${isNavActive('/admin') ? 'text-ipl-gold bg-white/5 font-bold' : ''}`}>
                    <Settings className="w-4 h-4 shrink-0" />
                    <span className="hidden lg:inline">ADMIN</span>
                  </Link>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 lg:gap-4 shrink-0">
              {user && (
                <div className="flex items-center gap-3 group">
                  <button
                    onClick={() => setIsProfileOpen(true)}
                    className="flex items-center gap-3 hover:text-ipl-gold transition-colors text-right"
                  >
                    <span className="text-sm font-display font-bold hidden lg:block leading-none italic uppercase tracking-tight">
                      {getUserDisplayName(user)}
                    </span>
                    <div className="relative">
                      <img src={user.avatar || `https://ui-avatars.com/api/?name=${getUserDisplayName(user)}&background=0B0E1A&color=F4C430`} alt="avatar" className="w-9 h-9 rounded-xl border border-white/10 group-hover:border-ipl-gold transition-all shadow-lg object-cover" />
                      <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-ipl-gold rounded-full border-2 border-ipl-navy flex items-center justify-center">
                        <Settings className="w-2 h-2 text-ipl-navy" />
                      </div>
                    </div>
                  </button>
                  <button onClick={handleLogout} className="w-11 h-11 rounded-xl flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 transition-all ml-1" title="Logout">
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main key={location.pathname} className="flex-1 w-full max-w-[1280px] mx-auto px-4 py-6 md:py-8 pt-[calc(4.5rem+env(safe-area-inset-top))] pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pt-8 md:pb-8 overflow-y-auto custom-scrollbar animate-in fade-in duration-200">
        <Outlet />
      </main>

      {/* Mobile Fixed Bottom Tab Bar */}
      <nav className="absolute bottom-0 left-0 right-0 z-50 md:hidden bg-ipl-surface/85 backdrop-blur-xl border-t border-white/5 pb-[env(safe-area-inset-bottom)] select-none [-webkit-touch-callout:none]">
        <div className="flex items-center justify-around h-14">
          {/* Matches Tab */}
          <Link
            to="/matchcenter"
            className={`flex flex-col items-center justify-center w-16 h-16 transition-all duration-150 active:scale-95 relative ${location.pathname.startsWith('/matchcenter') || location.pathname.startsWith('/match/')
                ? 'text-ipl-gold font-bold'
                : 'text-[#5e6675]'
              }`}
          >
            <LayoutGrid className="w-5 h-5" />
            <span className="text-[9px] font-display uppercase tracking-widest mt-1">Matches</span>
            {(location.pathname.startsWith('/matchcenter') || location.pathname.startsWith('/match/')) && (
              <span className="w-1 h-1 rounded-full bg-ipl-gold absolute bottom-0.5 animate-pulse" />
            )}
          </Link>

          {/* Leagues Tab */}
          <Link
            to="/leagues"
            className={`flex flex-col items-center justify-center w-16 h-16 transition-all duration-150 active:scale-95 relative ${location.pathname.startsWith('/leagues') ? 'text-ipl-gold font-bold' : 'text-[#5e6675]'
              }`}
          >
            <Users className="w-5 h-5" />
            <span className="text-[9px] font-display uppercase tracking-widest mt-1">Leagues</span>
            {location.pathname.startsWith('/leagues') && (
              <span className="w-1 h-1 rounded-full bg-ipl-gold absolute bottom-0.5 animate-pulse" />
            )}
          </Link>

          {/* Standings Tab */}
          <Link
            to="/leaderboard"
            className={`flex flex-col items-center justify-center w-16 h-16 transition-all duration-150 active:scale-95 relative ${location.pathname.startsWith('/leaderboard') ? 'text-ipl-gold font-bold' : 'text-[#5e6675]'
              }`}
          >
            <Trophy className="w-5 h-5" />
            <span className="text-[9px] font-display uppercase tracking-widest mt-1">Standings</span>
            {location.pathname.startsWith('/leaderboard') && (
              <span className="w-1 h-1 rounded-full bg-ipl-gold absolute bottom-0.5 animate-pulse" />
            )}
          </Link>

          {/* Analysis Tab */}
          <Link
            to="/analysis"
            className={`flex flex-col items-center justify-center w-16 h-16 transition-all duration-150 active:scale-95 relative ${location.pathname.startsWith('/analysis') ? 'text-ipl-gold font-bold' : 'text-[#5e6675]'
              }`}
          >
            <BarChart3 className="w-5 h-5" />
            <span className="text-[9px] font-display uppercase tracking-widest mt-1">Analysis</span>
            {location.pathname.startsWith('/analysis') && (
              <span className="w-1 h-1 rounded-full bg-ipl-gold absolute bottom-0.5 animate-pulse" />
            )}
          </Link>

          {/* More Tab */}
          <Link
            to="/more"
            className={`flex flex-col items-center justify-center w-16 h-16 transition-all duration-150 active:scale-95 relative ${location.pathname.startsWith('/more') || location.pathname.startsWith('/campaigns') || location.pathname.startsWith('/activity') || location.pathname.startsWith('/admin')
                ? 'text-ipl-gold font-bold'
                : 'text-[#5e6675]'
              }`}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[9px] font-display uppercase tracking-widest mt-1">More</span>
            {(location.pathname.startsWith('/more') || location.pathname.startsWith('/campaigns') || location.pathname.startsWith('/activity') || location.pathname.startsWith('/admin')) && (
              <span className="w-1 h-1 rounded-full bg-ipl-gold absolute bottom-0.5 animate-pulse" />
            )}
            {!location.pathname.startsWith('/more') && !location.pathname.startsWith('/campaigns') && !location.pathname.startsWith('/activity') && !location.pathname.startsWith('/admin') && (
              <span className="absolute top-2 right-3 w-2 h-2 rounded-full bg-orange-400 border border-ipl-surface" />
            )}
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
