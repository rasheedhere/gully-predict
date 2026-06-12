import React, { useState, useEffect } from 'react';
import { Users, ShieldCheck, Mail, Trash2, Cpu, Plus, Trophy, RefreshCw, Calendar, MapPin, Sword, Star, Pencil, X, List, ChevronLeft, Search, ChevronDown, Megaphone } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { Navigate, useSearchParams } from 'react-router-dom';
import {
  useAllowlist,
  useAddAllowlist,
  useDeleteAllowlist,
  useAllUsers,
  useUpdateBasePoints,
  useTriggerAIPredictions,
  useTournaments,
  useAllLeagues,
  useCreateTournament,
  useCreateMatch,
  useUpdateMatch,
  useAddLeagueMember,
  useBulkImportMatches,
  useTournamentQuestionBank,
  useAddTournamentQuestion,
  useUpdateTournamentQuestion,
  useDeleteTournamentQuestion,
  useTournamentMatchAnswers,
  useUpdateTournamentMatchAnswers,
  useUpdateTournamentStatus
} from '../api/hooks/useAdmin';
import { getUserDisplayName } from '../utils/userUtils';
import { useMatches } from '../api/hooks/useMatches';
import { useCreateLeague, useLeagueDetails, useToggleLeagueAdmin, useKickMember } from '../api/hooks/useLeagues';
import { teamColors, getTeamColor, getTeamShortName } from '../utils/teamColors';
import { getTeamLogo } from '../utils/teamLogos';
import { useAdminCampaigns } from '../api/hooks/useCampaigns';
import { useAdminAnnouncements, useCreateAnnouncement, useUpdateAnnouncement, useDeleteAnnouncement } from '../api/hooks/useAnnouncements';
import toast from 'react-hot-toast';
import { useUiStore } from '../store/ui';

export default function Admin() {
  const { user } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') as 'tournaments' | 'leagues' | 'users' | 'campaigns' | 'system' | 'announcements' || (user?.is_admin ? 'tournaments' : 'leagues');
  const managingTournamentId = searchParams.get('tournamentId');
  const managingLeagueId = searchParams.get('leagueId');

  const { setHeaderTitle } = useUiStore();

  useEffect(() => {
    if (!managingTournamentId && !managingLeagueId) {
      const tabLabels: Record<string, string> = {
        tournaments: 'TOURNAMENTS',
        leagues: 'LEAGUES',
        users: 'USERS',
        campaigns: 'CAMPAIGNS',
        announcements: 'ANNOUNCEMENTS',
        system: 'SYSTEM',
      };
      setHeaderTitle(tabLabels[activeTab] || 'ADMIN CONSOLE');
    }
  }, [activeTab, managingTournamentId, managingLeagueId, setHeaderTitle]);

  const setActiveTab = (tab: string) => {
    setSearchParams(prev => {
      prev.set('tab', tab);
      prev.delete('tournamentId');
      prev.delete('leagueId');
      prev.delete('subtab');
      return prev;
    }, { replace: true });
  };

  const setManagingTournamentId = (id: string | null) => {
    setSearchParams(prev => {
      if (id) {
        prev.set('tournamentId', id);
        if (!prev.has('subtab')) prev.set('subtab', 'schedule');
      } else {
        prev.delete('tournamentId');
        prev.delete('subtab');
      }
      return prev;
    });
  };

  const setManagingLeagueId = (id: string | null) => {
    setSearchParams(prev => {
      if (id) prev.set('leagueId', id);
      else prev.delete('leagueId');
      return prev;
    });
  };

  if (!user?.is_admin && !user?.is_league_admin) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleManageMatches = (tournamentId: string) => {
    setManagingTournamentId(tournamentId);
  };

  return (
    <div className="space-y-8 w-full max-w-full mx-auto pb-[calc(5rem+env(safe-area-inset-bottom))] relative pt-2 md:pt-0 px-4 md:px-0">
      {/* Internal Header: Hidden on mobile since Layout.tsx renders standard sticky header */}
      <header className="hidden md:flex justify-between items-end border-b-2 border-white/10 pb-4">
        <div>
          <h1 className="text-3xl font-display text-ipl-gold flex items-center gap-3 italic uppercase tracking-tighter">
            <ShieldCheck className="w-8 h-8" />
            Global Control Center
          </h1>
          <p className="text-gray-400 mt-1 uppercase text-[10px] tracking-[0.3em] font-display">Multi-Tenant Management & Scoring Engine</p>
        </div>
      </header>

      {/* Tab Navigation: Swipable on Mobile */}
      {!managingTournamentId && !managingLeagueId && (
        <nav className="flex gap-1 bg-white/5 p-1 rounded-2xl border border-white/10 w-full overflow-x-auto scrollbar-hide flex-nowrap md:w-fit select-none">
          {[
            ...(user?.is_admin ? [{ id: 'tournaments', label: 'Tournaments', icon: ShieldCheck }] : []),
            { id: 'leagues', label: 'Leagues', icon: Trophy },
            ...(user?.is_admin ? [{ id: 'users', label: 'Users', icon: Users }] : []),
            { id: 'campaigns', label: 'Campaigns', icon: ShieldCheck },
            ...(user?.is_admin ? [{ id: 'announcements', label: 'Announcements', icon: Megaphone }] : []),
            ...(user?.is_admin ? [{ id: 'system', label: 'System', icon: Cpu }] : []),
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-display text-[10px] uppercase tracking-widest transition-all shrink-0 flex-shrink-0 whitespace-nowrap active:scale-95 ${activeTab === tab.id
                ? 'bg-ipl-gold text-ipl-navy shadow-neon shadow-ipl-gold/20 font-bold'
                : 'text-gray-400 hover:text-white active:bg-white/5'
                }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </nav>
      )}

      <main key={activeTab} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        {activeTab === 'tournaments' && (
          managingTournamentId
            ? <TournamentMatchManager tournamentId={managingTournamentId} onBack={() => setManagingTournamentId(null)} />
            : <TournamentRegistry onManageMatches={handleManageMatches} />
        )}
        {activeTab === 'leagues' && (
          managingLeagueId
            ? <LeagueUserManager leagueId={managingLeagueId} onBack={() => setManagingLeagueId(null)} />
            : <LeagueManagement onManageUsers={(id) => setManagingLeagueId(id)} />
        )}
        {activeTab === 'users' && <UserManagement />}
        {activeTab === 'campaigns' && <CampaignManagement />}
        {activeTab === 'announcements' && <AnnouncementManagement />}
        {activeTab === 'system' && <SystemManagement />}
      </main>
    </div>
  );
}

function LeagueManagement({ onManageUsers }: { onManageUsers: (id: string) => void }) {
  const { user } = useAuthStore();
  const { data: leagues, isLoading: isLeaguesLoading } = useAllLeagues();
  const { data: tournaments } = useTournaments();
  const createLeague = useCreateLeague();

  const [newName, setNewName] = useState('');
  const [selectedTournament, setSelectedTournament] = useState('');
  const [powerups, setPowerups] = useState(10);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !selectedTournament) return;
    try {
      const res = await createLeague.mutateAsync({
        name: newName,
        tournament_id: selectedTournament,
        starting_powerups: powerups
      });
      setCreatedCode(res.join_code);
      toast.success('League created successfully!');
      setNewName('');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to create league');
    }
  };

  return (
    <div className="grid lg:grid-cols-3 gap-8">
      {/* Create Section - Only for Global Admins */}
      {user?.is_admin && (
        <section className="glass-panel p-6 border-t-2 border-ipl-gold/50 h-fit rounded-3xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-ipl-gold/10 rounded-xl">
              <Plus className="w-6 h-6 text-ipl-gold" />
            </div>
            <h2 className="text-xl font-display text-white italic uppercase tracking-tight">Provision New League</h2>
          </div>

          {createdCode ? (
            <div className="bg-ipl-green/10 border border-ipl-green/30 p-6 rounded-2xl animate-in zoom-in duration-300">
              <p className="text-[10px] font-display text-ipl-green uppercase tracking-widest mb-2 font-bold">League Created Successfully!</p>
              <div className="flex flex-col items-center gap-4 py-4">
                <span className="text-4xl font-display text-white tracking-[0.2em] font-bold underline decoration-ipl-green underline-offset-8">
                  {createdCode}
                </span>
                <p className="text-[10px] text-gray-500 text-center font-display uppercase tracking-widest">Share this join code with the league admin</p>
              </div>
              <button
                onClick={() => setCreatedCode(null)}
                className="w-full mt-4 py-3.5 border border-white/10 rounded-2xl text-white font-display text-[10px] uppercase tracking-[0.2em] active:bg-white/5 active:scale-95 transition-all"
              >
                Provision Another
              </button>
            </div>
          ) : (
            <form onSubmit={handleCreate} className="space-y-6">
              <div>
                <label className="block text-[10px] font-display uppercase tracking-widest text-gray-500 mb-2">Internal League Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-black/40 border-2 border-white/10 p-3.5 rounded-2xl text-white font-display focus:border-ipl-gold focus:outline-none transition-all text-sm"
                  placeholder="e.g. Corporate Challenge"
                />
              </div>
              <div>
                <label className="block text-[10px] font-display uppercase tracking-widest text-gray-500 mb-2">Tournament Base</label>
                <select
                  value={selectedTournament}
                  onChange={(e) => setSelectedTournament(e.target.value)}
                  className="w-full bg-black/40 border-2 border-white/10 p-3.5 rounded-2xl text-white font-display focus:border-ipl-gold focus:outline-none transition-all text-sm"
                >
                  <option value="" className="bg-ipl-navy">Select Tournament...</option>
                  {tournaments?.map(t => (
                    <option key={t.id} value={t.id} className="bg-ipl-navy">{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-display uppercase tracking-widest text-gray-500 mb-2">Starting Powerups</label>
                <input
                  type="number"
                  value={powerups}
                  onChange={(e) => setPowerups(parseInt(e.target.value) || 0)}
                  className="w-full bg-black/40 border-2 border-white/10 p-3.5 rounded-2xl text-white font-display focus:border-ipl-gold focus:outline-none transition-all text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={createLeague.isPending || !newName || !selectedTournament}
                className="w-full py-4 bg-ipl-gold text-ipl-navy font-display text-[10px] uppercase tracking-[0.3em] font-bold rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30"
              >
                {createLeague.isPending ? 'PROVISIONING...' : 'PROVISION LEAGUE'}
              </button>
            </form>
          )}
        </section>
      )}

      {/* Leagues List - Full width if create section is hidden */}
      <section className={`${user?.is_admin ? 'lg:col-span-2' : 'lg:col-span-3'} glass-panel p-6 border-t-2 border-white/10 rounded-3xl`}>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6 text-ipl-gold" />
            <h2 className="text-xl font-display text-white italic uppercase tracking-tight">Active Battlegrounds</h2>
          </div>
        </div>

        {/* Desktop View */}
        <div className="hidden md:block overflow-hidden rounded-2xl border border-white/5 bg-black/20">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-[9px] uppercase tracking-[0.2em] text-gray-500 font-display">
                <th className="p-4 font-normal">League Detail</th>
                <th className="p-4 font-normal">Tournament</th>
                <th className="p-4 font-normal">Join Code</th>
                <th className="p-4 font-normal text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-display">
              {isLeaguesLoading ? (
                <tr><td colSpan={4} className="p-10 text-center text-[10px] uppercase tracking-widest text-gray-600 animate-pulse">Syncing League Registry...</td></tr>
              ) : leagues?.map(league => (
                <tr key={league.id} className="group hover:bg-white/5 transition-all">
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="text-sm text-white group-hover:text-ipl-gold transition-colors">{league.name}</span>
                      <span className="text-[9px] text-gray-600 font-mono italic tracking-tighter uppercase">{league.id}</span>
                    </div>
                  </td>
                  <td className="p-4 text-[10px] text-gray-400 uppercase tracking-widest">{league.tournament_id}</td>
                  <td className="p-4">
                    <span className="font-mono text-ipl-gold text-sm tracking-widest bg-ipl-gold/5 px-3 py-1 rounded border border-ipl-gold/10">
                      {league.join_code}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => onManageUsers(league.id)}
                      className="px-4 py-2 bg-white/5 border border-white/10 text-white hover:bg-white hover:text-ipl-navy transition-all font-display text-[10px] uppercase tracking-widest flex items-center gap-2 ml-auto rounded-lg"
                    >
                      <Users className="w-3 h-3" />
                      Manage Users
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden space-y-4">
          {isLeaguesLoading ? (
            <div className="p-10 text-center text-[10px] uppercase tracking-widest text-gray-500 animate-pulse">Syncing League Registry...</div>
          ) : leagues?.length === 0 ? (
            <div className="p-10 text-center text-[10px] uppercase tracking-widest text-gray-500">No battlegrounds found</div>
          ) : leagues?.map(league => (
            <div key={league.id} className="bg-white/5 border border-white/10 p-4 rounded-2xl flex flex-col gap-4 active:scale-[0.98] transition-all">
              <div className="flex justify-between items-start">
                <div className="flex flex-col">
                  <span className="text-base text-white font-bold font-display">{league.name}</span>
                  <span className="text-[9px] text-gray-500 font-mono tracking-widest uppercase">{league.id}</span>
                </div>
                <span className="font-mono text-ipl-gold text-xs tracking-wider bg-ipl-gold/10 px-2.5 py-1 rounded-xl border border-ipl-gold/10">
                  {league.join_code}
                </span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-white/5">
                <span className="text-[10px] text-gray-400 uppercase tracking-widest">Base: {league.tournament_id}</span>
                <button
                  onClick={() => onManageUsers(league.id)}
                  className="px-4 py-2.5 bg-white/5 border border-white/10 text-white rounded-xl active:bg-white active:text-ipl-navy transition-all font-display text-[10px] uppercase tracking-widest flex items-center gap-2"
                >
                  <Users className="w-3.5 h-3.5" />
                  Manage Users
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function UserManagement() {
  const { data: users, isLoading } = useAllUsers();
  const { mutate: updateBasePoints, isPending } = useUpdateBasePoints();
  const [localPoints, setLocalPoints] = useState<Record<string, number>>({});
  const [localPowerups, setLocalPowerups] = useState<Record<string, number>>({});
  const [localTelegram, setLocalTelegram] = useState<Record<string, boolean>>({});
  const [localTelegramUser, setLocalTelegramUser] = useState<Record<string, string>>({});

  const { data: allowlist, isLoading: isAllowlistLoading } = useAllowlist();
  const { mutate: addEmail, isPending: isAdding } = useAddAllowlist();
  const { mutate: deleteEmail } = useDeleteAllowlist();
  const [newEmail, setNewEmail] = useState('');
  const [isGuest, setIsGuest] = useState(false);

  const handleUpdate = (userId: string) => {
    const user = users?.find(u => u.id === userId);
    updateBasePoints({
      userId,
      basePoints: localPoints[userId] ?? user?.base_points ?? 0,
      basePowerups: localPowerups[userId] ?? user?.base_powerups ?? 10,
      isTelegramAdmin: localTelegram[userId] ?? user?.is_telegram_admin ?? false,
      telegramUsername: localTelegramUser[userId] ?? user?.telegram_username
    }, {
      onSuccess: () => toast.success(`Updated ${user?.name}`),
      onError: () => toast.error('Update failed')
    });
  };

  const handleAddEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    const emails = newEmail.split(',').map(e => e.trim()).filter(Boolean);
    addEmail({ emails, isGuest }, {
      onSuccess: () => {
        setNewEmail('');
        toast.success(`Successfully Whitelisted ${emails.length} Users`);
      }
    });
  };

  return (
    <div className="grid lg:grid-cols-3 gap-8">
      {/* Manual Whitelist */}
      <section className="glass-panel p-6 border-t-2 border-t-ipl-live h-fit rounded-3xl">
        <div className="flex items-center gap-3 mb-6">
          <Mail className="w-6 h-6 text-ipl-live" />
          <h2 className="text-xl font-display text-white italic uppercase tracking-tight">Manual Whitelist</h2>
        </div>
        <form onSubmit={handleAddEmail} className="space-y-6">
          <div>
            <label className="block text-[10px] font-display uppercase tracking-widest text-gray-500 mb-2">Email Addresses (Comma separated)</label>
            <textarea
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full bg-black/40 border-2 border-white/10 p-3.5 rounded-2xl text-white font-display focus:border-ipl-live focus:outline-none transition-all h-32 text-sm"
              placeholder="user1@example.com, user2@example.com"
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="guestCheck"
              checked={isGuest}
              onChange={(e) => setIsGuest(e.target.checked)}
              className="w-4 h-4 rounded border-white/10 bg-black/40 text-ipl-live focus:ring-ipl-live"
            />
            <label htmlFor="guestCheck" className="text-[10px] font-display uppercase tracking-widest text-gray-400 cursor-pointer select-none">Mark as Guest Users</label>
          </div>
          <button
            type="submit"
            disabled={isAdding || !newEmail.trim()}
            className="w-full py-4 bg-ipl-live text-white font-display text-[10px] uppercase tracking-[0.3em] font-bold rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30"
          >
            {isAdding ? 'Whitelisting...' : 'Whitelist Users'}
          </button>
        </form>

        <div className="mt-10 pt-6 border-t border-white/5">
          <h3 className="text-[10px] font-display uppercase tracking-[0.2em] text-gray-500 mb-4 font-bold">Pending Whitelist ({allowlist?.length || 0})</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
            {isAllowlistLoading ? (
              <div className="animate-pulse text-[10px] text-gray-600 font-display">Syncing...</div>
            ) : allowlist?.map(item => (
              <div key={item.email} className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5 group">
                <div className="flex flex-col">
                  <span className="text-[11px] text-gray-300 font-display">{item.email}</span>
                  {item.is_guest && <span className="text-[8px] text-ipl-gold uppercase tracking-widest font-bold mt-0.5">Guest</span>}
                </div>
                <button
                  onClick={() => deleteEmail(item.email)}
                  className="p-2 text-gray-400 hover:text-red-500 active:scale-95 transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Directory Management */}
      <section className="lg:col-span-2 glass-panel p-6 border-t-2 border-white/10 rounded-3xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-ipl-gold" />
            <h2 className="text-xl font-display text-white italic uppercase tracking-tight">User Directory</h2>
          </div>
        </div>

        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-[9px] uppercase tracking-[0.2em] text-gray-500 font-display">
                <th className="p-4 font-normal">Player</th>
                <th className="p-4 font-normal">Status</th>
                <th className="p-4 font-normal">Stats</th>
                <th className="p-4 font-normal">Telegram</th>
                <th className="p-4 font-normal text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-display text-xs text-gray-400">
              {isLoading ? (
                <tr><td colSpan={5} className="p-10 text-center animate-pulse text-[10px] uppercase tracking-widest text-gray-600">Syncing Master Records...</td></tr>
              ) : users?.map(u => (
                <tr key={u.id} className="group hover:bg-white/5 transition-all">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <img src={u.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${getUserDisplayName(u)}`} className="w-8 h-8 rounded-full border border-white/10" alt="" />
                      <div className="flex flex-col">
                        <span className="text-white group-hover:text-ipl-gold transition-colors">{getUserDisplayName(u)}</span>
                        <span className="text-[9px] text-gray-600 font-mono tracking-tighter uppercase">{u.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      {u.is_admin && <span className="px-2 py-0.5 bg-ipl-gold/10 text-ipl-gold border border-ipl-gold/20 rounded text-[8px] uppercase tracking-widest font-bold w-fit">Admin</span>}
                      {u.is_guest && <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded text-[8px] uppercase tracking-widest font-bold w-fit">Guest</span>}
                      {!u.is_admin && !u.is_guest && <span className="px-2 py-0.5 bg-white/5 text-gray-500 border border-white/10 rounded text-[8px] uppercase tracking-widest font-bold w-fit">Player</span>}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-gray-600 uppercase">Pts:</span>
                        <input
                          type="number"
                          defaultValue={u.base_points}
                          onBlur={(e) => setLocalPoints({ ...localPoints, [u.id]: parseInt(e.target.value) })}
                          className="w-16 bg-black/40 border border-white/5 px-2 py-1 text-[10px] font-mono text-white focus:border-ipl-gold outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-gray-600 uppercase">Pwr:</span>
                        <input
                          type="number"
                          defaultValue={u.base_powerups}
                          onBlur={(e) => setLocalPowerups({ ...localPowerups, [u.id]: parseInt(e.target.value) })}
                          className="w-16 bg-black/40 border border-white/5 px-2 py-1 text-[10px] font-mono text-white focus:border-ipl-gold outline-none"
                        />
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          defaultChecked={u.is_telegram_admin}
                          onChange={(e) => setLocalTelegram({ ...localTelegram, [u.id]: e.target.checked })}
                          className="w-3 h-3 rounded border-white/10 bg-black/40 text-ipl-gold focus:ring-ipl-gold"
                        />
                        <span className="text-[8px] text-gray-500 uppercase tracking-widest">Bot Admin</span>
                      </div>
                      <input
                        type="text"
                        defaultValue={u.telegram_username}
                        placeholder="@username"
                        onBlur={(e) => setLocalTelegramUser({ ...localTelegramUser, [u.id]: e.target.value })}
                        className="w-24 bg-black/40 border border-white/5 px-2 py-1 text-[10px] font-mono text-white focus:border-ipl-gold outline-none"
                      />
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => handleUpdate(u.id)}
                      disabled={isPending}
                      className="p-2 border border-white/10 text-gray-500 hover:text-ipl-gold hover:border-ipl-gold rounded-lg transition-all"
                      title="Save Changes"
                    >
                      <RefreshCw className={`w-4 h-4 ${isPending ? 'animate-spin' : ''}`} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden space-y-4">
          {isLoading ? (
            <div className="text-center py-10 text-[10px] uppercase tracking-widest text-gray-500 animate-pulse">Syncing Master Records...</div>
          ) : users?.length === 0 ? (
            <div className="text-center py-10 text-[10px] uppercase tracking-widest text-gray-500">No users found</div>
          ) : users?.map(u => (
            <div key={u.id} className="bg-white/5 border border-white/10 p-4 rounded-2xl flex flex-col gap-4">
              {/* User Info & Badge */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <img src={u.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${getUserDisplayName(u)}`} className="w-10 h-10 rounded-full border border-white/10" alt="" />
                  <div className="flex flex-col">
                    <span className="text-sm text-white font-bold font-display">{getUserDisplayName(u)}</span>
                    <span className="text-[9px] text-gray-500 font-mono tracking-tight uppercase break-all">{u.email}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {u.is_admin && <span className="px-2 py-0.5 bg-ipl-gold/10 text-ipl-gold border border-ipl-gold/20 rounded-lg text-[8px] uppercase tracking-widest font-bold">Admin</span>}
                  {u.is_guest && <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg text-[8px] uppercase tracking-widest font-bold">Guest</span>}
                  {!u.is_admin && !u.is_guest && <span className="px-2 py-0.5 bg-white/5 text-gray-500 border border-white/10 rounded-lg text-[8px] uppercase tracking-widest font-bold">Player</span>}
                </div>
              </div>

              {/* Stats Inputs & Telegram Inputs */}
              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-white/5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-gray-400 font-display uppercase tracking-wider">Points:</span>
                    <input
                      type="number"
                      defaultValue={u.base_points}
                      onBlur={(e) => setLocalPoints({ ...localPoints, [u.id]: parseInt(e.target.value) })}
                      className="w-20 bg-black/40 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white text-center focus:border-ipl-gold outline-none"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-gray-400 font-display uppercase tracking-wider">Powerups:</span>
                    <input
                      type="number"
                      defaultValue={u.base_powerups}
                      onBlur={(e) => setLocalPowerups({ ...localPowerups, [u.id]: parseInt(e.target.value) })}
                      className="w-20 bg-black/40 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white text-center focus:border-ipl-gold outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-3 border-l border-white/5 pl-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-gray-400 font-display uppercase tracking-wider">Bot Admin:</span>
                    <input
                      type="checkbox"
                      defaultChecked={u.is_telegram_admin}
                      onChange={(e) => setLocalTelegram({ ...localTelegram, [u.id]: e.target.checked })}
                      className="w-4 h-4 rounded border-white/10 bg-black/40 text-ipl-gold focus:ring-ipl-gold"
                    />
                  </div>
                  <input
                    type="text"
                    defaultValue={u.telegram_username}
                    placeholder="@username"
                    onBlur={(e) => setLocalTelegramUser({ ...localTelegramUser, [u.id]: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white focus:border-ipl-gold outline-none"
                  />
                </div>
              </div>

              {/* Save Actions */}
              <div className="flex justify-end pt-2 border-t border-white/5">
                <button
                  onClick={() => handleUpdate(u.id)}
                  disabled={isPending}
                  className="w-full py-2.5 bg-white/5 active:bg-white/10 active:scale-[0.98] text-white border border-white/10 rounded-xl font-display text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} />
                  Save User Changes
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function CampaignManagement() {
  const { user } = useAuthStore();
  const { data: campaigns, isLoading } = useAdminCampaigns();

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <section className="glass-panel p-10 border-t-2 border-ipl-gold flex flex-col items-center justify-center text-center rounded-3xl">
        <ShieldCheck className="w-16 h-16 text-ipl-gold mb-6 opacity-20" />
        <h2 className="text-2xl font-display text-white mb-2 uppercase italic tracking-tighter">
          {user?.is_admin ? 'Master Campaigns' : 'League Campaigns'}
        </h2>
        <p className="text-xs text-gray-500 mb-8 max-w-sm uppercase tracking-widest font-display">
          {user?.is_admin
            ? 'Manage global match questions for the 2026 Season'
            : 'Manage custom questions and engagement for your leagues'}
        </p>
        <a href="/admin/campaigns" className="px-10 py-4 bg-white text-ipl-navy font-display text-xs uppercase tracking-[0.3em] font-bold rounded-2xl active:scale-[0.98] hover:bg-ipl-gold transition-all">
          Launch Builder
        </a>
      </section>

      <section className="glass-panel p-6 border-t-2 border-white/10 rounded-3xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <List className="w-6 h-6 text-ipl-gold" />
            <h2 className="text-xl font-display text-white italic uppercase tracking-tight">Campaign Registry</h2>
          </div>
        </div>

        {/* Desktop View */}
        <div className="hidden md:block overflow-hidden rounded-2xl border border-white/5 bg-black/20">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-[9px] uppercase tracking-[0.2em] text-gray-500 font-display">
                <th className="p-4 font-normal">Campaign Title</th>
                <th className="p-4 font-normal">Type & Match</th>
                <th className="p-4 font-normal">Status</th>
                <th className="p-4 font-normal text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-display text-xs text-gray-400">
              {isLoading ? (
                <tr><td colSpan={4} className="p-10 text-center animate-pulse text-[10px] uppercase tracking-widest text-gray-600">Loading Campaigns...</td></tr>
              ) : campaigns?.length === 0 ? (
                <tr><td colSpan={4} className="p-10 text-center text-[10px] uppercase tracking-widest text-gray-600">No campaigns found</td></tr>
              ) : campaigns?.map(c => (
                <tr key={c.id} className="group hover:bg-white/5 transition-all">
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="text-sm text-white group-hover:text-ipl-gold transition-colors">{c.title}</span>
                      <span className="text-[9px] text-gray-600 font-mono tracking-tighter uppercase">{c.id}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] uppercase tracking-widest">{c.type}</span>
                      <span className="text-[9px] text-gray-600 font-mono italic uppercase tracking-tighter">{c.target_match_ids?.[0] || 'Global'}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 border rounded text-[8px] uppercase tracking-widest font-bold w-fit ${c.status === 'active' ? 'bg-ipl-live/10 text-ipl-live border-ipl-live/20' :
                      c.status === 'closed' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                        'bg-gray-500/10 text-gray-400 border-gray-500/20'
                      }`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <a
                      href={`/admin/campaigns/${c.id}/edit`}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white hover:bg-white hover:text-ipl-navy rounded-lg transition-all font-display text-[10px] uppercase tracking-widest ml-auto"
                    >
                      <Pencil className="w-3 h-3" />
                      Edit
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden space-y-4">
          {isLoading ? (
            <div className="text-center py-10 text-[10px] uppercase tracking-widest text-gray-500 animate-pulse">Loading Campaigns...</div>
          ) : campaigns?.length === 0 ? (
            <div className="text-center py-10 text-[10px] uppercase tracking-widest text-gray-500">No campaigns found</div>
          ) : campaigns?.map(c => (
            <div key={c.id} className="bg-white/5 border border-white/10 p-4 rounded-2xl flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div className="flex flex-col">
                  <span className="text-base text-white font-bold font-display">{c.title}</span>
                  <span className="text-[9px] text-gray-500 font-mono tracking-widest uppercase">{c.id}</span>
                </div>
                <span className={`px-2 py-0.5 border rounded-lg text-[8px] uppercase tracking-widest font-bold w-fit ${c.status === 'active' ? 'bg-ipl-live/10 text-ipl-live border-ipl-live/20' :
                  c.status === 'closed' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                    'bg-gray-500/10 text-gray-400 border-gray-500/20'
                  }`}>
                  {c.status}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-white/5">
                <div className="flex flex-col">
                  <span className="text-[9px] text-gray-400 uppercase tracking-widest">Type: {c.type}</span>
                  <span className="text-[8px] text-gray-500 font-mono uppercase mt-0.5">Match: {c.target_match_ids?.[0] || 'Global'}</span>
                </div>
                <a
                  href={`/admin/campaigns/${c.id}/edit`}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 text-white rounded-xl active:bg-white active:text-ipl-navy transition-all font-display text-[10px] uppercase tracking-widest"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SystemManagement() {
  const { mutate: triggerAI, isPending } = useTriggerAIPredictions();
  return (
    <div className="max-w-2xl mx-auto glass-panel p-10 border-t-2 border-blue-500 text-center rounded-3xl">
      <Cpu className="w-16 h-16 text-blue-500 mx-auto mb-6 opacity-20" />
      <h2 className="text-2xl font-display text-white mb-2 uppercase italic tracking-tighter">Scoring Engine Controls</h2>
      <p className="text-xs text-gray-400 mb-10 font-mono uppercase tracking-widest">Manual Override for Scoring & AI Predictions</p>

      <div className="grid gap-6">
        <button
          onClick={() => triggerAI(undefined, { onSuccess: () => toast.success('AI Assassin triggered') })}
          className="py-5 bg-gradient-to-r from-[#004BA0] to-[#7B2FF7] text-white font-display text-xs uppercase tracking-[0.4em] rounded-2xl hover:shadow-[0_0_20px_rgba(123,47,247,0.4)] active:scale-[0.98] transition-all shadow-neon shadow-[#7B2FF7]/20"
        >
          {isPending ? 'EXECUTING NEURAL NET...' : 'TRIGGER AI ASSASSIN'}
        </button>
        <div className="text-[10px] text-gray-600 font-mono uppercase tracking-widest italic">
          Last processed: {new Date().toLocaleString()}
        </div>
      </div>
    </div>
  );
}

function TournamentRegistry({ onManageMatches }: { onManageMatches: (id: string) => void }) {
  const { data: tournaments, isLoading, refetch } = useTournaments();
  const createTournament = useCreateTournament();
  const updateStatus = useUpdateTournamentStatus();

  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newId || !newName) return;
    try {
      await createTournament.mutateAsync({
        id: newId,
        name: newName,
        starts_at: startsAt || undefined,
        ends_at: endsAt || undefined
      });
      toast.success('Tournament registered successfully!');
      setNewId('');
      setNewName('');
      setStartsAt('');
      setEndsAt('');
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Registration failed');
    }
  };

  return (
    <div className="grid lg:grid-cols-3 gap-8">
      <section className="glass-panel p-6 border-t-2 border-ipl-gold/50 h-fit rounded-3xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-ipl-gold/10 rounded-xl">
            <Plus className="w-6 h-6 text-ipl-gold" />
          </div>
          <h2 className="text-xl font-display text-white italic uppercase tracking-tight">Register Tournament</h2>
        </div>

        <form onSubmit={handleCreate} className="space-y-6">
          <div>
            <label className="block text-[10px] font-display uppercase tracking-widest text-gray-500 mb-2">Unique ID (Slug)</label>
            <input
              type="text"
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              className="w-full bg-black/40 border-2 border-white/10 p-3.5 rounded-2xl text-white font-mono text-sm focus:border-ipl-gold focus:outline-none transition-all"
              placeholder="e.g. ipl-2027"
            />
          </div>
          <div>
            <label className="block text-[10px] font-display uppercase tracking-widest text-gray-500 mb-2">Display Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full bg-black/40 border-2 border-white/10 p-3.5 rounded-2xl text-white font-display text-sm focus:border-ipl-gold focus:outline-none transition-all"
              placeholder="e.g. IPL Season 2027"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-display uppercase tracking-widest text-gray-500 mb-2">Starts At</label>
              <input
                type="date"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full bg-black/40 border-2 border-white/10 p-3.5 rounded-2xl text-white font-mono text-xs focus:border-ipl-gold focus:outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-[10px] font-display uppercase tracking-widest text-gray-500 mb-2">Ends At</label>
              <input
                type="date"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="w-full bg-black/40 border-2 border-white/10 p-3.5 rounded-2xl text-white font-mono text-xs focus:border-ipl-gold focus:outline-none transition-all"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={createTournament.isPending || !newId || !newName}
            className="w-full py-4 bg-ipl-gold text-ipl-navy font-display text-[10px] uppercase tracking-[0.3em] font-bold rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30"
          >
            {createTournament.isPending ? 'Registering...' : 'Register Tournament'}
          </button>
        </form>
      </section>

      <section className="lg:col-span-2 glass-panel p-6 border-t-2 border-white/10 rounded-3xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6 text-ipl-gold" />
            <h2 className="text-xl font-display text-white italic uppercase tracking-tight">Tournament Registry</h2>
          </div>
        </div>

        {/* Desktop View */}
        <div className="hidden md:block overflow-hidden rounded-2xl border border-white/5 bg-black/20">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-[9px] uppercase tracking-[0.2em] text-gray-500 font-display">
                <th className="p-4 font-normal">Tournament</th>
                <th className="p-4 font-normal">Status</th>
                <th className="p-4 font-normal">Timeline</th>
                <th className="p-4 font-normal text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-display text-xs text-gray-400">
              {isLoading ? (
                <tr><td colSpan={4} className="p-10 text-center animate-pulse uppercase tracking-widest text-gray-600 font-display text-[10px]">Syncing Tournament Records...</td></tr>
              ) : tournaments?.map(t => (
                <tr key={t.id} className="group hover:bg-white/5 transition-all">
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="text-sm text-white group-hover:text-ipl-gold transition-colors">{t.name}</span>
                      <span className="text-[9px] text-gray-600 font-mono italic uppercase tracking-tighter">{t.id}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <select
                      value={t.status}
                      onChange={(e) => updateStatus.mutate({ tournamentId: t.id, status: e.target.value })}
                      className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[9px] uppercase tracking-widest focus:outline-none focus:border-ipl-gold transition-colors"
                      disabled={updateStatus.isPending}
                    >
                      <option value="upcoming" className="bg-ipl-navy">Upcoming</option>
                      <option value="active" className="bg-ipl-navy">Active</option>
                      <option value="completed" className="bg-ipl-navy">Completed</option>
                    </select>
                  </td>
                  <td className="p-4 font-mono text-[10px] tracking-tight">
                    {t.starts_at ? new Date(t.starts_at).toLocaleDateString() : 'N/A'} — {t.ends_at ? new Date(t.ends_at).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => onManageMatches(t.id)}
                      className="px-4 py-2 bg-white/5 border border-white/10 text-white hover:bg-white hover:text-ipl-navy rounded-lg transition-all font-display text-[10px] uppercase tracking-widest flex items-center gap-2 ml-auto"
                    >
                      <Sword className="w-3 h-3" />
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden space-y-4">
          {isLoading ? (
            <div className="text-center py-10 text-[10px] uppercase tracking-widest text-gray-500 animate-pulse">Syncing Tournament Records...</div>
          ) : tournaments?.length === 0 ? (
            <div className="text-center py-10 text-[10px] uppercase tracking-widest text-gray-500">No tournaments found</div>
          ) : tournaments?.map(t => (
            <div key={t.id} className="bg-white/5 border border-white/10 p-4 rounded-2xl flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div className="flex flex-col">
                  <span className="text-base text-white font-bold font-display">{t.name}</span>
                  <span className="text-[9px] text-gray-500 font-mono tracking-widest uppercase">{t.id}</span>
                </div>
                <select
                  value={t.status}
                  onChange={(e) => updateStatus.mutate({ tournamentId: t.id, status: e.target.value })}
                  className="px-2.5 py-0.5 bg-white/5 border border-white/10 rounded-full text-[9px] uppercase tracking-widest font-bold focus:outline-none focus:border-ipl-gold transition-colors"
                  disabled={updateStatus.isPending}
                >
                  <option value="upcoming" className="bg-ipl-navy">Upcoming</option>
                  <option value="active" className="bg-ipl-navy">Active</option>
                  <option value="completed" className="bg-ipl-navy">Completed</option>
                </select>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-white/5">
                <span className="text-[10px] font-mono text-gray-400">
                  {t.starts_at ? new Date(t.starts_at).toLocaleDateString() : 'N/A'} — {t.ends_at ? new Date(t.ends_at).toLocaleDateString() : 'N/A'}
                </span>
                <button
                  onClick={() => onManageMatches(t.id)}
                  className="px-4 py-2.5 bg-white/5 border border-white/10 text-white rounded-xl active:bg-white active:text-ipl-navy transition-all font-display text-[10px] uppercase tracking-widest flex items-center gap-2"
                >
                  <Sword className="w-3.5 h-3.5" />
                  Manage
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function TournamentMatchManager({ tournamentId, onBack }: { tournamentId: string, onBack: () => void }) {
  const { data: matches, isLoading, refetch } = useMatches(tournamentId);
  const createMatch = useCreateMatch();
  const updateMatch = useUpdateMatch();
  const bulkImport = useBulkImportMatches();

  const { setHeaderTitle } = useUiStore();

  useEffect(() => {
    setHeaderTitle(`MANAGE: ${tournamentId.toUpperCase()}`);
    return () => setHeaderTitle(null);
  }, [tournamentId, setHeaderTitle]);

  const [searchParams, setSearchParams] = useSearchParams();
  const activeSubTab = searchParams.get('subtab') as 'schedule' | 'bank' | 'grading' || 'schedule';

  const setActiveSubTab = (subtab: string) => {
    setSearchParams(prev => {
      prev.set('subtab', subtab);
      return prev;
    }, { replace: true });
  };
  const [editingMatch, setEditingMatch] = useState<any | null>(null);
  const [matchId, setMatchId] = useState('');
  const [team1, setTeam1] = useState('');
  const [team2, setTeam2] = useState('');
  const [venue, setVenue] = useState('');
  const [startTime, setStartTime] = useState('');
  const [gradingMatchId, setGradingMatchId] = useState<string | null>(null);

  const [modalMode, setModalMode] = useState<'none' | 'edit_match' | 'bulk_import'>('none');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAndReversedMatches = matches
    ? [...matches]
      .filter((m) => {
        const q = searchQuery.toLowerCase();
        return (
          m.id.toLowerCase().includes(q) ||
          m.team1.toLowerCase().includes(q) ||
          m.team2.toLowerCase().includes(q) ||
          m.venue.toLowerCase().includes(q) ||
          m.status.toLowerCase().includes(q)
        );
      })
      .reverse()
    : [];

  const handleEditMatch = (m: any) => {
    setEditingMatch(m);
    setMatchId(m.id);
    setTeam1(m.team1);
    setTeam2(m.team2);
    setVenue(m.venue);
    const date = new Date(m.start_time);
    const localDateTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setStartTime(localDateTime);
    setModalMode('edit_match');
  };

  const resetMatchForm = () => {
    setEditingMatch(null);
    setMatchId('');
    setTeam1('');
    setTeam2('');
    setVenue('');
    setStartTime('');
    setModalMode('none');
  };

  const handleSubmitMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchId || !team1 || !team2 || !venue || !startTime) {
      toast.error('Please fill all fields');
      return;
    }

    const payload = {
      id: matchId,
      team1,
      team2,
      venue,
      start_time: new Date(startTime).toISOString(),
      tournament_id: tournamentId,
      status: editingMatch ? editingMatch.status : 'upcoming'
    };

    if (editingMatch) {
      updateMatch.mutate(
        { matchId: editingMatch.id, payload },
        {
          onSuccess: () => {
            toast.success('Match updated successfully!');
            refetch();
            resetMatchForm();
          },
          onError: (err: any) => {
            toast.error(err.response?.data?.detail || 'Update failed');
          }
        }
      );
    } else {
      createMatch.mutate(
        payload,
        {
          onSuccess: () => {
            toast.success('Match scheduled successfully!');
            refetch();
            resetMatchForm();
          },
          onError: (err: any) => {
            toast.error(err.response?.data?.detail || 'Creation failed');
          }
        }
      );
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="hidden md:flex sticky top-0 z-40 backdrop-blur-xl bg-ipl-surface/90 py-3 items-center gap-4 border-b md:border-none border-white/5">
        <button onClick={onBack} className="p-3 bg-white/5 active:bg-white/10 active:scale-90 border border-white/5 rounded-full text-gray-400 hover:text-white transition-all min-w-[44px] min-h-[44px] items-center justify-center shrink-0">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h2 className="text-xl md:text-2xl font-display text-white uppercase italic tracking-tighter flex items-center gap-2 truncate">
            <Sword className="text-ipl-gold w-5 h-5 md:w-6 md:h-6 shrink-0" />
            <span className="truncate">{tournamentId}</span>
          </h2>
          <p className="text-[9px] md:text-[10px] text-gray-500 font-display uppercase tracking-widest truncate">Manage Schedule & States</p>
        </div>
      </div>

      <nav className="flex gap-1 bg-white/5 p-1 rounded-2xl border border-white/10 w-full overflow-x-auto scrollbar-hide flex-nowrap md:w-fit mb-8 select-none [-webkit-overflow-scrolling:touch] [-webkit-touch-callout:none]">
        {[
          { id: 'schedule', label: 'Match Schedule', icon: Calendar },
          { id: 'bank', label: 'Question Bank', icon: ShieldCheck },
          { id: 'grading', label: 'Grading', icon: Star },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-display text-[10px] uppercase tracking-widest transition-all shrink-0 flex-shrink-0 whitespace-nowrap active:scale-95 ${activeSubTab === tab.id
              ? 'bg-ipl-gold text-ipl-navy shadow-neon shadow-ipl-gold/20 font-bold'
              : 'text-gray-400 hover:text-white active:bg-white/5'
              }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </nav>

      {activeSubTab === 'schedule' && (
        <div key="schedule" className="w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
          <section className="glass-panel p-6 border-t-2 border-white/10 rounded-3xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-display text-white italic uppercase flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-ipl-gold" />
                  Match Schedule
                </h3>
                <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-gray-500 font-display uppercase tracking-widest">{filteredAndReversedMatches.length} Matches</span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-none">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search matches..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full sm:w-64 bg-black/40 border border-white/10 pl-9 pr-3 py-2.5 rounded-xl text-white font-display text-xs focus:border-ipl-gold focus:outline-none transition-all"
                  />
                </div>
                <button
                  onClick={() => setModalMode('bulk_import')}
                  className="p-2.5 bg-white/5 border border-white/10 text-white rounded-xl hover:bg-white hover:text-ipl-navy transition-all flex items-center justify-center"
                  title="Bulk Import"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { resetMatchForm(); setModalMode('edit_match'); }}
                  className="p-2.5 bg-ipl-gold text-ipl-navy rounded-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center font-bold"
                  title="Schedule Match"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Desktop View */}
            <div className="hidden md:grid gap-4">
              {isLoading ? (
                <div className="text-center py-20 text-[10px] uppercase tracking-widest text-gray-600 animate-pulse bg-white/5 border border-dashed border-white/10 rounded-2xl">Syncing Tournament Schedule...</div>
              ) : filteredAndReversedMatches.length === 0 ? (
                <div className="text-center py-20 bg-black/20 border border-dashed border-white/10 rounded-2xl text-[10px] uppercase tracking-widest text-gray-600">No matches found.</div>
              ) : filteredAndReversedMatches.map((match, idx) => {
                const t1Color = getTeamColor(match.team1, match.team2);
                const t2Color = getTeamColor(match.team2, match.team1);
                const t1Short = getTeamShortName(match.team1);
                const t2Short = getTeamShortName(match.team2);
                const t1Logo = getTeamLogo(match.team1);
                const t2Logo = getTeamLogo(match.team2);

                return (
                  <div key={match.id} className="group relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent rounded-2xl -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                    <button
                      onClick={() => handleEditMatch(match)}
                      className="w-full text-left bg-white/5 border border-white/10 p-4 rounded-2xl hover:border-white/20 transition-all grid grid-cols-[40px_1.5fr_140px_1.5fr_140px] items-center gap-2 sm:gap-4 group shadow-sm hover:shadow-xl hover:shadow-black/40 cursor-pointer active:scale-[0.99]"
                    >
                      <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg bg-white/5 text-[10px] font-display text-gray-500 border border-white/10">
                        {matches!.length - idx}
                      </div>

                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-14 h-14 shrink-0 rounded-xl flex items-center justify-center border-2 shadow-lg overflow-hidden p-1.5 bg-black/40 transition-transform group-hover:scale-105 duration-300"
                          style={{ borderColor: `${t1Color}40`, backgroundColor: `${t1Color}10` }}
                        >
                          {t1Logo ? (
                            <img src={t1Logo} alt={match.team1} className="w-full h-full object-contain" />
                          ) : (
                            <span className="text-[10px] font-bold text-white">{t1Short}</span>
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm sm:text-base font-display font-bold text-white leading-tight group-hover:text-ipl-gold transition-colors">{match.team1}</span>
                          <span className="text-[8px] text-gray-500 uppercase tracking-widest font-display">HOME</span>
                        </div>
                      </div>

                      <div className="flex flex-col items-center justify-center px-2 py-2 bg-black/60 rounded-xl border border-white/5 shadow-inner min-w-[120px]">
                        <span className="text-[10px] text-ipl-gold italic font-bold tracking-[0.2em] mb-1">VS</span>
                        <div className="flex flex-col items-center gap-0.5">
                          <div className="flex items-center gap-1 text-gray-400">
                            <MapPin className="w-2.5 h-2.5 shrink-0" />
                            <span className="text-[7px] font-display uppercase tracking-tighter truncate max-w-[80px]">{match.venue}</span>
                          </div>
                          <div className="flex items-center gap-1 text-gray-500">
                            <Calendar className="w-2.5 h-2.5 shrink-0" />
                            <span className="text-[7px] font-mono whitespace-nowrap">{new Date(match.start_time).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 min-w-0 justify-end">
                        <div className="flex flex-col items-end min-w-0">
                          <span className="text-sm sm:text-base font-display font-bold text-white leading-tight group-hover:text-ipl-gold transition-colors text-right">{match.team2}</span>
                          <span className="text-[8px] text-gray-500 uppercase tracking-widest font-display">AWAY</span>
                        </div>
                        <div
                          className="w-14 h-14 shrink-0 rounded-xl flex items-center justify-center border-2 shadow-lg overflow-hidden p-1.5 bg-black/40 transition-transform group-hover:scale-105 duration-300"
                          style={{ borderColor: `${t2Color}40`, backgroundColor: `${t2Color}10` }}
                        >
                          {t2Logo ? (
                            <img src={t2Logo} alt={match.team2} className="w-full h-full object-contain" />
                          ) : (
                            <span className="text-[10px] font-bold text-white">{t2Short}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 justify-end pl-3 border-l border-white/10 ml-2">
                        <span className={`px-2 py-1 rounded-md text-[8px] uppercase tracking-widest font-bold border whitespace-nowrap ${match.status === 'upcoming' ? 'bg-ipl-gold/10 text-ipl-gold border-ipl-gold/20' :
                          match.status === 'live' ? 'bg-ipl-live/10 text-ipl-live border-ipl-live/20 animate-pulse' :
                            'bg-white/5 text-gray-500 border-white/10'
                          }`}>
                          {match.status}
                        </span>
                      </div>
                    </button></div>
                );
              })}
            </div>

            {/* Mobile View */}
            <div className="md:hidden space-y-4">
              {isLoading ? (
                <div className="text-center py-10 text-[10px] uppercase tracking-widest text-gray-500 animate-pulse">Syncing Tournament Schedule...</div>
              ) : filteredAndReversedMatches.length === 0 ? (
                <div className="text-center py-10 text-[10px] uppercase tracking-widest text-gray-500">No matches found.</div>
              ) : filteredAndReversedMatches.map((match, idx) => {
                const t1Color = getTeamColor(match.team1, match.team2);
                const t2Color = getTeamColor(match.team2, match.team1);
                const t1Short = getTeamShortName(match.team1);
                const t2Short = getTeamShortName(match.team2);
                const t1Logo = getTeamLogo(match.team1);
                const t2Logo = getTeamLogo(match.team2);

                return (
                  <button key={match.id} onClick={() => handleEditMatch(match)} className="w-full text-left bg-white/5 border border-white/10 p-4 rounded-2xl flex flex-col gap-3 active:scale-[0.98] transition-all group hover:border-white/20 hover:shadow-xl hover:shadow-black/40 cursor-pointer">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-gray-500 font-display">Match #{matches!.length - idx}</span>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[8px] uppercase tracking-widest font-bold border ${match.status === 'upcoming' ? 'bg-ipl-gold/10 text-ipl-gold border-ipl-gold/20' :
                          match.status === 'live' ? 'bg-ipl-live/10 text-ipl-live border-ipl-live/20 animate-pulse' :
                            'bg-white/5 text-gray-500 border-white/10'
                          }`}>
                          {match.status}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center border p-1 bg-black/40"
                          style={{ borderColor: `${t1Color}40`, backgroundColor: `${t1Color}10` }}
                        >
                          {t1Logo ? <img src={t1Logo} className="w-full h-full object-contain" /> : <span className="text-[8px] text-white">{t1Short}</span>}
                        </div>
                        <span className="text-sm font-bold text-white font-display">{match.team1}</span>
                      </div>
                      <span className="text-xs text-ipl-gold font-bold italic font-display px-3">VS</span>
                      <div className="flex items-center gap-2 justify-end">
                        <span className="text-sm font-bold text-white font-display text-right">{match.team2}</span>
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center border p-1 bg-black/40"
                          style={{ borderColor: `${t2Color}40`, backgroundColor: `${t2Color}10` }}
                        >
                          {t2Logo ? <img src={t2Logo} className="w-full h-full object-contain" /> : <span className="text-[8px] text-white">{t2Short}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-white/5 text-[9px] text-gray-500 uppercase tracking-wider font-display">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-ipl-gold animate-bounce" />
                        <span className="truncate max-w-[120px]">{match.venue}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-ipl-gold" />
                        <span>{new Date(match.start_time).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <AdminModal
            isOpen={modalMode === 'edit_match'}
            onClose={resetMatchForm}
            title={
              <div>
                <h3 className="text-xl font-display text-white italic uppercase flex items-center gap-2 tracking-tight">
                  {editingMatch ? <Pencil className="w-5 h-5 text-ipl-gold" /> : <Plus className="w-5 h-5 text-ipl-gold" />}
                  {editingMatch ? 'Edit Match' : 'Schedule Match'}
                </h3>
                <p className="text-[10px] text-gray-500 font-display uppercase tracking-widest mt-1">Configure match details</p>
              </div>
            }
          >
            <form onSubmit={handleSubmitMatch} className="space-y-5">
              <div>
                <label className="block text-[10px] font-display uppercase tracking-[0.2em] text-gray-500 mb-2">Match ID (Slug)</label>
                <input
                  type="text"
                  value={matchId}
                  onChange={(e) => setMatchId(e.target.value)}
                  placeholder="e.g. m1-mi-csk"
                  disabled={!!editingMatch}
                  className="w-full bg-black/40 border-2 border-white/10 p-3.5 rounded-2xl text-white font-mono text-sm focus:border-ipl-gold focus:outline-none transition-all disabled:opacity-50"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-display uppercase tracking-[0.2em] text-gray-500 mb-2">Team 1</label>
                  <select
                    value={team1}
                    onChange={(e) => setTeam1(e.target.value)}
                    className="w-full bg-black/40 border-2 border-white/10 p-3.5 rounded-2xl text-white font-display text-sm focus:border-ipl-gold focus:outline-none transition-all"
                  >
                    <option value="" className="bg-ipl-navy">Select...</option>
                    {Object.keys(teamColors).map(t => <option key={t} value={t} className="bg-ipl-navy">{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-display uppercase tracking-[0.2em] text-gray-500 mb-2">Team 2</label>
                  <select
                    value={team2}
                    onChange={(e) => setTeam2(e.target.value)}
                    className="w-full bg-black/40 border-2 border-white/10 p-3.5 rounded-2xl text-white font-display text-sm focus:border-ipl-gold focus:outline-none transition-all"
                  >
                    <option value="" className="bg-ipl-navy">Select...</option>
                    {Object.keys(teamColors).map(t => <option key={t} value={t} className="bg-ipl-navy">{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-display uppercase tracking-[0.2em] text-gray-500 mb-2">Venue</label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    placeholder="e.g. Wankhede Stadium"
                    className="w-full bg-black/40 border-2 border-white/10 p-3.5 pl-11 rounded-2xl text-white font-display text-sm focus:border-ipl-gold focus:outline-none transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-display uppercase tracking-[0.2em] text-gray-500 mb-2">Start Time (Local)</label>
                <div className="relative">
                  <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-black/40 border-2 border-white/10 p-3.5 pl-11 rounded-2xl text-white font-mono text-sm focus:border-ipl-gold focus:outline-none transition-all"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={createMatch.isPending || updateMatch.isPending}
                className="w-full py-4 bg-ipl-gold text-ipl-navy font-display text-[10px] uppercase tracking-[0.3em] font-bold rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30 mt-4"
              >
                {createMatch.isPending || updateMatch.isPending ? 'PROCESSING...' : editingMatch ? 'UPDATE MATCH' : 'ADD MATCH'}
              </button>
            </form>
          </AdminModal>

          <AdminModal
            isOpen={modalMode === 'bulk_import'}
            onClose={() => setModalMode('none')}
            title={
              <div>
                <h3 className="text-xl font-display text-white italic uppercase flex items-center gap-2 tracking-tight">
                  <RefreshCw className="w-5 h-5 text-ipl-live" />
                  Bulk Import Matches
                </h3>
                <p className="text-[10px] text-gray-400 font-display mt-1 uppercase tracking-widest">Upload a CSV file to create multiple matches at once.</p>
              </div>
            }
          >
            <div className="space-y-6">
              <div className="bg-black/40 border-2 border-white/10 p-4 rounded-2xl flex items-center justify-between">
                <span className="text-[10px] font-mono text-gray-300">sample_format.csv</span>
                <button
                  onClick={() => {
                    const csvContent = "data:text/csv;charset=utf-8," + "id,team1,team2,venue,start_time\nipl-2026-01,CSK,RCB,Chennai,2026-03-22T19:30:00Z\nipl-2026-02,DC,PBKS,Mohali,2026-03-23T15:30:00Z";
                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", "sample_matches.csv");
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="text-[9px] font-display uppercase tracking-widest text-ipl-gold hover:text-white transition-all active:scale-95 border border-ipl-gold/20 px-3 py-1.5 rounded-lg bg-ipl-gold/10"
                >
                  Download Sample
                </button>
              </div>

              <div className="border-2 border-dashed border-white/20 rounded-2xl p-8 text-center hover:bg-white/5 hover:border-ipl-live/50 transition-all group">
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    bulkImport.mutate(
                      { tournamentId, file },
                      {
                        onSuccess: (data) => {
                          toast.success(data.message || 'Matches imported successfully!');
                          refetch();
                          e.target.value = '';
                          setModalMode('none');
                        },
                        onError: (err: any) => {
                          toast.error(err.response?.data?.detail || 'Import failed');
                        }
                      }
                    );
                  }}
                  className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-3 file:px-6
                  file:border-0 file:rounded-xl
                  file:text-[10px] file:font-display file:uppercase file:tracking-widest
                  file:bg-ipl-live/10 file:text-ipl-live file:font-bold
                  hover:file:bg-ipl-live hover:file:text-white transition-all cursor-pointer active:scale-95"
                />
              </div>
            </div>
          </AdminModal>
        </div>
      )}

      {activeSubTab === 'bank' && (
        <div key="bank" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <TournamentQuestionBankManager tournamentId={tournamentId} />
        </div>
      )}

      {activeSubTab === 'grading' && (
        <div key="grading" className="w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="space-y-4 max-w-3xl mx-auto">
            <div className="flex flex-col gap-4 mb-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-display text-white italic uppercase flex items-center gap-2">
                  <Star className="w-4 h-4 text-ipl-gold" />
                  Select Match to Grade
                </h3>
                <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-gray-500 font-display uppercase tracking-widest">{filteredAndReversedMatches.length} Matches</span>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search matches..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 pl-9 pr-3 py-2 rounded-xl text-white font-display text-xs focus:border-ipl-gold focus:outline-none transition-all"
                />
              </div>
            </div>
            {isLoading ? (
              <div className="text-center py-10 text-[10px] uppercase tracking-widest text-gray-600 animate-pulse">Syncing...</div>
            ) : filteredAndReversedMatches.length === 0 ? (
              <div className="text-center py-10 bg-black/20 border border-dashed border-white/10 rounded-xl text-[10px] uppercase tracking-widest text-gray-600">No matches found.</div>
            ) : filteredAndReversedMatches.map(match => {
              const t1Logo = getTeamLogo(match.team1);
              const t2Logo = getTeamLogo(match.team2);
              const t1Color = getTeamColor(match.team1, match.team2);
              const t2Color = getTeamColor(match.team2, match.team1);

              return (
                <button
                  key={match.id}
                  onClick={() => setGradingMatchId(match.id)}
                  className={`w-full text-left p-3.5 border rounded-2xl transition-all group relative overflow-hidden active:scale-[0.98] ${gradingMatchId === match.id
                    ? 'bg-ipl-gold/10 border-ipl-gold shadow-[0_0_20px_rgba(244,196,48,0.15)]'
                    : 'bg-white/5 border-white/10 hover:border-white/20'
                    }`}
                >
                  <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="flex -space-x-2">
                        <div className="w-8 h-8 rounded-lg bg-black/40 border border-white/10 p-1 flex items-center justify-center shrink-0" style={{ borderColor: `${t1Color}40` }}>
                          {t1Logo ? <img src={t1Logo} className="w-full h-full object-contain" /> : <span className="text-[8px] text-white">{getTeamShortName(match.team1)}</span>}
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-black/40 border border-white/10 p-1 flex items-center justify-center shrink-0" style={{ borderColor: `${t2Color}40` }}>
                          {t2Logo ? <img src={t2Logo} className="w-full h-full object-contain" /> : <span className="text-[8px] text-white">{getTeamShortName(match.team2)}</span>}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 text-xs text-white font-bold font-display">
                          <span className="truncate max-w-[80px]">{getTeamShortName(match.team1)}</span>
                          <span className="text-[8px] text-gray-500 italic font-normal">v</span>
                          <span className="truncate max-w-[80px]">{getTeamShortName(match.team2)}</span>
                        </div>
                        <div className="text-[8px] font-mono text-gray-500 mt-0.5">{new Date(match.start_time).toLocaleDateString([], { month: 'short', day: 'numeric' })}</div>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[7px] uppercase tracking-widest font-bold border ${match.status === 'upcoming' ? 'bg-ipl-gold/10 text-ipl-gold border-ipl-gold/20' :
                      match.status === 'live' ? 'bg-ipl-live/10 text-ipl-live border-ipl-live/20 animate-pulse' :
                        'bg-white/5 text-gray-400 border-white/10'
                      }`}>
                      {match.status}
                    </span>
                  </div>
                  {gradingMatchId === match.id && (
                    <div className="absolute inset-0 bg-gradient-to-r from-ipl-gold/5 to-transparent -z-0" />
                  )}
                </button>
              );
            })}
          </div>

          <AdminModal
            isOpen={!!gradingMatchId}
            onClose={() => setGradingMatchId(null)}
            title={null}
          >
            {gradingMatchId && <TournamentMatchGrading tournamentId={tournamentId} matchId={gradingMatchId} onClose={() => setGradingMatchId(null)} />}
          </AdminModal>
        </div>
      )}
    </div>
  );
}

function TournamentQuestionBankManager({ tournamentId }: { tournamentId: string }) {
  const { data: bank, isLoading, refetch } = useTournamentQuestionBank(tournamentId);
  const addQuestion = useAddTournamentQuestion();
  const updateQuestion = useUpdateTournamentQuestion();
  const deleteQuestion = useDeleteTournamentQuestion();

  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [key, setKey] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [questionType, setQuestionType] = useState<'toggle' | 'toggle_3way' | 'multiple_choice' | 'dropdown' | 'free_text' | 'free_number'>('toggle');
  const [optionsStr, setOptionsStr] = useState('{{Team1}}, {{Team2}}');

  const handleEdit = (q: any) => {
    setEditingQuestionId(q.id);
    setKey(q.key);
    setQuestionText(q.question_text);
    setQuestionType(q.question_type === 'toggle' && q.options?.length === 3 ? 'toggle_3way' : q.question_type);
    setOptionsStr(q.options ? q.options.join(', ') : '');
    toast(`Editing question: ${q.key}`);
  };

  const resetForm = () => {
    setEditingQuestionId(null);
    setKey('');
    setQuestionText('');
    setQuestionType('toggle');
    setOptionsStr('{{Team1}}, {{Team2}}');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key || !questionText) return;

    let options: string[] | null = null;
    const isToggle = questionType === 'toggle' || questionType === 'toggle_3way';
    if (isToggle || ['multiple_choice', 'dropdown'].includes(questionType)) {
      options = optionsStr.split(',').map(s => s.trim()).filter(Boolean);
      if (isToggle && questionType === 'toggle' && options.length !== 2) {
        toast.error('Toggle (2 options) must have exactly 2 options');
        return;
      }
      if (isToggle && questionType === 'toggle_3way' && options.length !== 3) {
        toast.error('Toggle (3 options) must have exactly 3 options');
        return;
      }
      if (options.length < 2) {
        toast.error('Please provide at least 2 options');
        return;
      }
    }

    const payload = {
      key,
      question_text: questionText,
      question_type: isToggle ? 'toggle' : questionType,
      options,
      default_scoring_rules: {
        exact_match_points: 10,
        wrong_answer_points: 0,
        within_range_points: 5
      },
      order_index: bank?.questions?.find((q: any) => q.id === editingQuestionId)?.order_index || bank?.questions?.length || 0,
      allow_powerup: true
    };

    try {
      if (editingQuestionId) {
        await updateQuestion.mutateAsync({ tournamentId, questionId: editingQuestionId, payload });
        toast.success('Question updated in bank');
      } else {
        await addQuestion.mutateAsync({ tournamentId, payload });
        toast.success('Question added to bank');
      }
      resetForm();
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to save question');
    }
  };

  return (
    <section className="w-full">
      <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-4">
        <h3 className="text-xl font-display text-white italic uppercase flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-ipl-gold" />
          Question Bank
        </h3>
        <span className="text-[10px] bg-white/5 border border-white/10 px-3 py-1 rounded-full text-gray-500 font-display uppercase tracking-[0.2em]">{bank?.questions?.length || 0} Questions</span>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Add Question Form */}
        <div className="lg:col-span-1 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[9px] font-display uppercase tracking-[0.2em] text-gray-500 mb-1.5">Question Key (Unique Identifier)</label>
              <input
                type="text"
                value={key}
                onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                placeholder="e.g. match_winner"
                className="w-full bg-black/40 border border-white/10 p-3.5 rounded-2xl text-white font-mono text-xs focus:border-ipl-gold focus:outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-[9px] font-display uppercase tracking-[0.2em] text-gray-500 mb-1.5">Question Text</label>
              <input
                type="text"
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="e.g. Who will win the match?"
                className="w-full bg-black/40 border border-white/10 p-3.5 rounded-2xl text-white font-display text-xs focus:border-ipl-gold focus:outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-[9px] font-display uppercase tracking-[0.2em] text-gray-500 mb-1.5">Type</label>
              <select
                value={questionType}
                onChange={(e) => {
                  const val = e.target.value as any;
                  setQuestionType(val);
                  if (val === 'toggle') {
                    setOptionsStr('{{Team1}}, {{Team2}}');
                  } else if (val === 'toggle_3way') {
                    setOptionsStr('{{Team1}}, {{Team2}}, Draw');
                  } else if (val === 'multiple_choice' || val === 'dropdown') {
                    setOptionsStr('');
                  }
                }}
                className="w-full bg-black/40 border border-white/10 p-3.5 rounded-2xl text-white font-display text-xs focus:border-ipl-gold focus:outline-none transition-all"
              >
                <option value="toggle" className="bg-ipl-navy">Toggle (2 options)</option>
                <option value="toggle_3way" className="bg-ipl-navy">Toggle (3 options)</option>
                <option value="multiple_choice" className="bg-ipl-navy">Multiple Choice</option>
                <option value="dropdown" className="bg-ipl-navy">Dropdown</option>
                <option value="free_text" className="bg-ipl-navy">Free Text</option>
                <option value="free_number" className="bg-ipl-navy">Free Number</option>
              </select>
            </div>
            {['toggle', 'toggle_3way', 'multiple_choice', 'dropdown'].includes(questionType) && (
              <div>
                <label className="block text-[9px] font-display uppercase tracking-[0.2em] text-gray-500 mb-1.5">Options (Comma separated)</label>
                <input
                  type="text"
                  value={optionsStr}
                  onChange={(e) => setOptionsStr(e.target.value)}
                  placeholder="e.g. {{Team1}}, {{Team2}}"
                  className="w-full bg-black/40 border border-white/10 p-3.5 rounded-2xl text-white font-display text-xs focus:border-ipl-gold focus:outline-none transition-all"
                />
                <p className="text-[9px] text-gray-500 mt-1 uppercase tracking-widest">Use {'{{Team1}}'} and {'{{Team2}}'} for dynamic match teams</p>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              {editingQuestionId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 py-3 bg-white/5 text-gray-400 border border-white/10 rounded-2xl font-display text-[10px] uppercase tracking-[0.3em] font-bold hover:bg-white/10 hover:text-white transition-all active:scale-95"
                >
                  CANCEL
                </button>
              )}
              <button
                type="submit"
                disabled={addQuestion.isPending || updateQuestion.isPending || !key || !questionText}
                className={`flex-[2] py-3 font-display text-[10px] uppercase tracking-[0.3em] font-bold rounded-2xl transition-all disabled:opacity-30 active:scale-95 ${editingQuestionId
                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/50 hover:bg-blue-500 hover:text-white'
                  : 'bg-ipl-gold/10 text-ipl-gold border border-ipl-gold/50 hover:bg-ipl-gold hover:text-ipl-navy'
                  }`}
              >
                {editingQuestionId ? (updateQuestion.isPending ? 'UPDATING...' : 'UPDATE QUESTION') : (addQuestion.isPending ? 'ADDING...' : 'ADD QUESTION TO BANK')}
              </button>
            </div>
          </form>
        </div>

        {/* Existing Questions */}
        <div className="lg:col-span-2 space-y-4">
          {isLoading ? (
            <div className="text-center py-20 text-[10px] uppercase tracking-[0.3em] text-gray-600 animate-pulse">Syncing Bank...</div>
          ) : (
            <div className="space-y-3 pr-2 custom-scrollbar">
              {bank?.questions?.length === 0 ? (
                <div className="text-center py-20 bg-white/5 border border-dashed border-white/10 rounded-2xl text-[10px] uppercase tracking-[0.3em] text-gray-600">No questions in bank yet</div>
              ) : (
                <>
                  {/* Desktop View */}
                  <div className="hidden md:block space-y-3">
                    {bank?.questions?.map((q: any) => (
                      <div key={q.id} className="group relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-ipl-gold/5 to-transparent rounded-2xl -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <div className="bg-white/5 border border-white/10 p-5 rounded-2xl hover:border-white/20 transition-all flex items-center justify-between shadow-sm hover:shadow-xl hover:shadow-black/40">
                          <div className="flex items-center gap-5 min-w-0">
                            <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-xl bg-black/40 text-[9px] font-mono font-bold text-ipl-gold border border-ipl-gold/20 group-hover:border-ipl-gold/50 transition-all uppercase px-2 text-center break-all overflow-hidden">
                              {q.key}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-lg font-display font-bold text-white leading-tight group-hover:text-ipl-gold transition-colors">{q.question_text}</h4>
                              <div className="flex items-center gap-3 mt-1.5">
                                <span className="text-[8px] bg-white/5 text-gray-500 px-2 py-0.5 rounded border border-white/10 font-bold uppercase tracking-widest">Type: {q.question_type}</span>
                                {q.options && q.options.length > 0 && (
                                  <span className="text-[8px] bg-white/5 text-gray-400 px-2 py-0.5 rounded border border-white/10 font-bold uppercase tracking-widest truncate max-w-[200px]">Options: {q.options.join(', ')}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 pl-4 border-l border-white/10 ml-4">
                            <button
                              type="button"
                              onClick={() => handleEdit(q)}
                              className="p-2.5 text-gray-400 hover:text-ipl-gold hover:bg-ipl-gold/10 rounded-xl transition-all border border-transparent hover:border-ipl-gold/20"
                              title="Edit Question"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete question '${q.key}' from the bank?`)) {
                                  deleteQuestion.mutate({ tournamentId, questionId: q.id }, {
                                    onSuccess: () => toast.success(`Question '${q.key}' deleted`),
                                    onError: (err: any) => toast.error(err.response?.data?.detail || 'Failed to delete question')
                                  });
                                }
                              }}
                              disabled={deleteQuestion.isPending}
                              className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all border border-transparent hover:border-red-500/20 disabled:opacity-30"
                              title="Delete Question"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Mobile View */}
                  <div className="md:hidden space-y-4">
                    {bank?.questions?.map((q: any) => (
                      <div key={q.id} className="bg-white/5 border border-white/10 p-4 rounded-2xl flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-lg bg-black/40 text-[8px] font-mono font-bold text-ipl-gold border border-ipl-gold/20 uppercase px-1.5 text-center break-all overflow-hidden">
                            {q.key}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-display font-bold text-white leading-tight">{q.question_text}</h4>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1.5 text-[9px] uppercase tracking-wider font-display text-gray-400">
                          <div>Type: <span className="text-white font-bold">{q.question_type}</span></div>
                          {q.options && q.options.length > 0 && (
                            <div className="truncate">Options: <span className="text-white font-bold">{q.options.join(', ')}</span></div>
                          )}
                        </div>

                        <div className="flex gap-2 pt-2 border-t border-white/5 w-full">
                          <button
                            type="button"
                            onClick={() => handleEdit(q)}
                            className="flex-1 py-2.5 bg-white/5 active:bg-white/10 text-white rounded-xl border border-white/10 font-display text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete question '${q.key}' from the bank?`)) {
                                deleteQuestion.mutate({ tournamentId, questionId: q.id }, {
                                  onSuccess: () => toast.success(`Question '${q.key}' deleted`),
                                  onError: (err: any) => toast.error(err.response?.data?.detail || 'Failed to delete question')
                                });
                              }
                            }}
                            disabled={deleteQuestion.isPending}
                            className="flex-1 py-2.5 bg-red-500/10 active:bg-red-500/20 text-red-500 rounded-xl border border-red-500/20 font-display text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function LeagueUserManager({ leagueId, onBack }: { leagueId: string, onBack: () => void }) {
  const { data: league, isLoading, refetch } = useLeagueDetails(leagueId);
  const { data: allUsers } = useAllUsers();

  const toggleAdmin = useToggleLeagueAdmin(leagueId);
  const kickMember = useKickMember(leagueId);
  const addMember = useAddLeagueMember();

  const { setHeaderTitle } = useUiStore();

  useEffect(() => {
    if (league) {
      setHeaderTitle(`ROSTER: ${league.name.toUpperCase()}`);
    } else {
      setHeaderTitle('MANAGE ROSTER');
    }
    return () => setHeaderTitle(null);
  }, [league, setHeaderTitle]);

  const [selectedUserId, setSelectedUserId] = useState('');
  const [showProvision, setShowProvision] = useState(false);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    try {
      await addMember.mutateAsync({ leagueId, userId: selectedUserId });
      toast.success('User provisioned to league');
      setSelectedUserId('');
      setShowProvision(false);
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to provision user');
    }
  };

  const availableUsers = allUsers?.filter(u => !league?.participants?.find(p => p.id === u.id)) || [];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="hidden md:flex sticky top-0 z-40 backdrop-blur-xl bg-ipl-surface/90 py-3 items-center gap-4 border-b md:border-none border-white/5">
        <button onClick={onBack} className="p-3 bg-white/5 active:bg-white/10 active:scale-90 border border-white/5 rounded-full text-gray-400 hover:text-white transition-all min-w-[44px] min-h-[44px] items-center justify-center shrink-0">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h2 className="text-xl md:text-2xl font-display text-white uppercase italic tracking-tighter flex items-center gap-2 truncate">
            <Users className="text-ipl-gold w-5 h-5 md:w-6 md:h-6 shrink-0" />
            <span className="truncate">{league?.name || 'Loading...'}</span>
          </h2>
          <p className="text-[9px] md:text-[10px] text-gray-500 font-display uppercase tracking-widest truncate">Manage Roster</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <section className={`${showProvision ? 'block' : 'hidden'} lg:block glass-panel p-6 border-t-2 border-ipl-gold/50 h-fit rounded-3xl`}>
          <h3 className="text-lg font-display text-white italic uppercase mb-6 flex items-center gap-2">
            <Plus className="w-4 h-4 text-ipl-gold" />
            Provision User
          </h3>
          <form onSubmit={handleAddMember} className="space-y-5">
            <div>
              <label className="block text-[9px] font-display uppercase tracking-[0.2em] text-gray-500 mb-1.5">Select User from Global Directory</label>
              <div className="relative">
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 p-3.5 pr-10 rounded-2xl text-white font-display text-[17px] md:text-xs focus:border-ipl-gold focus:outline-none transition-all appearance-none cursor-pointer"
                >
                  <option value="" className="bg-ipl-navy">Select user...</option>
                  {availableUsers.map(u => (
                    <option key={u.id} value={u.id} className="bg-ipl-navy">{getUserDisplayName(u)} ({u.email})</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <button
              type="submit"
              disabled={addMember.isPending || !selectedUserId}
              className="w-full py-4 bg-ipl-gold text-ipl-navy font-display text-[10px] uppercase tracking-[0.3em] font-bold rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30"
            >
              {addMember.isPending ? 'PROVISIONING...' : 'ADD USER'}
            </button>
          </form>
        </section>

        <section className="lg:col-span-2 glass-panel p-6 border-t-2 border-white/10 rounded-3xl">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-display text-white italic uppercase flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-ipl-gold" />
              Current Members
            </h3>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-gray-500 font-display uppercase tracking-widest">{league?.participants?.length || 0} Members</span>
              <button
                onClick={() => setShowProvision(!showProvision)}
                className="lg:hidden flex items-center gap-1.5 px-3.5 py-2 bg-ipl-gold text-ipl-navy rounded-xl font-display text-[9px] uppercase tracking-widest font-bold active:scale-95 transition-all"
              >
                {showProvision ? 'Close' : 'Add User'}
              </button>
            </div>
          </div>

          {/* Desktop View */}
          <div className="hidden md:block overflow-hidden rounded-2xl border border-white/5 bg-black/20">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-[9px] uppercase tracking-[0.2em] text-gray-500 font-display">
                  <th className="p-4 font-normal">Player</th>
                  <th className="p-4 font-normal text-center">League Admin</th>
                  <th className="p-4 font-normal text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-display">
                {isLoading ? (
                  <tr><td colSpan={3} className="p-10 text-center text-[10px] uppercase tracking-widest text-gray-600 animate-pulse">Syncing League Roster...</td></tr>
                ) : league?.participants?.length === 0 ? (
                  <tr><td colSpan={3} className="p-10 text-center text-[10px] uppercase tracking-widest text-gray-600 bg-black/20 border border-dashed border-white/10 rounded-xl">No members found in this league.</td></tr>
                ) : league?.participants?.map(participant => (
                  <tr key={participant.id} className="hover:bg-white/5 transition-all group">
                    <td className="p-4">
                      <div className="flex items-center gap-4">
                        <img
                          src={participant.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${getUserDisplayName(participant)}`}
                          className="w-10 h-10 rounded-full border border-white/10 group-hover:border-ipl-gold transition-colors"
                          alt=""
                        />
                        <div className="flex flex-col">
                          <span className="text-sm text-white group-hover:text-ipl-gold transition-colors">{getUserDisplayName(participant)}</span>
                          <span className="text-[9px] text-gray-600 font-mono">Joined: {new Date(participant.joined_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => toggleAdmin.mutate({ userId: participant.id, isAdmin: !participant.is_league_admin })}
                        className={`p-2 border transition-all rounded-lg ${participant.is_league_admin ? 'bg-ipl-gold/10 border-ipl-gold text-ipl-gold' : 'border-white/10 text-gray-600 hover:text-white'}`}
                        title={participant.is_league_admin ? "Remove Admin Role" : "Make League Admin"}
                      >
                        <ShieldCheck className="w-4 h-4" />
                      </button>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => {
                          if (confirm(`Are you sure you want to remove ${getUserDisplayName(participant)} from this league?`)) {
                            kickMember.mutate(participant.id);
                          }
                        }}
                        className="p-2 text-gray-600 hover:text-red-500 transition-colors ml-auto flex items-center gap-2 rounded-lg"
                        title="Remove User"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile View */}
          <div className="md:hidden space-y-4">
            {isLoading ? (
              <div className="text-center py-10 text-[10px] uppercase tracking-widest text-gray-500 animate-pulse">Syncing League Roster...</div>
            ) : league?.participants?.length === 0 ? (
              <div className="text-center py-10 text-[10px] uppercase tracking-widest text-gray-500">No members found in this league.</div>
            ) : league?.participants?.map(participant => (
              <div key={participant.id} className="bg-white/5 border border-white/10 p-4 rounded-2xl flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src={participant.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${getUserDisplayName(participant)}`}
                    className="w-10 h-10 rounded-full border border-white/10"
                    alt=""
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-white font-display">{getUserDisplayName(participant)}</span>
                    <span className="text-[9px] text-gray-500 font-mono">Joined: {new Date(participant.joined_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-white/5 w-full">
                  <button
                    onClick={() => toggleAdmin.mutate({ userId: participant.id, isAdmin: !participant.is_league_admin })}
                    className={`flex-1 py-2 rounded-xl border text-[10px] font-display uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 ${participant.is_league_admin
                      ? 'bg-ipl-gold/10 border-ipl-gold text-ipl-gold font-bold'
                      : 'border-white/10 text-gray-400 active:text-white'
                      }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {participant.is_league_admin ? 'Admin' : 'Make Admin'}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Are you sure you want to remove ${getUserDisplayName(participant)} from this league?`)) {
                        kickMember.mutate(participant.id);
                      }
                    }}
                    className="px-4 py-2 bg-red-500/10 active:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl flex items-center justify-center active:scale-95 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function TournamentMatchGrading({ tournamentId, matchId, onClose }: { tournamentId: string, matchId: string, onClose: () => void }) {
  const { data: matches } = useMatches(tournamentId);
  const currentMatch = matches?.find(m => m.id === matchId);

  const { data: questionBank } = useTournamentQuestionBank(tournamentId);
  const { data: answers, isLoading } = useTournamentMatchAnswers(tournamentId, matchId);
  const { mutate: updateAnswers, isPending } = useUpdateTournamentMatchAnswers();
  const [correctAnswers, setCorrectAnswers] = useState<Record<string, any>>({});

  React.useEffect(() => {
    if (answers?.correct_answers) {
      setCorrectAnswers(answers.correct_answers);
    } else {
      setCorrectAnswers({});
    }
  }, [answers]);

  const handleSave = () => {
    updateAnswers({
      tournamentId,
      matchId,
      correct_answers: correctAnswers
    }, {
      onSuccess: () => {
        toast.success('Grading complete. Scores triggered globally and per league!');
        onClose();
      },
      onError: () => toast.error('Failed to save results')
    });
  };

  if (isLoading) return <div className="text-center py-10 animate-pulse font-display text-gray-600 text-xs">Loading keys...</div>;
  if (!questionBank?.questions || questionBank.questions.length === 0) {
    return <div className="text-center py-10 text-gray-500 font-display text-[10px] uppercase tracking-widest">No questions in the tournament bank.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <h3 className="text-xl font-display text-white italic uppercase tracking-tight">Match Results</h3>
          <p className="text-[10px] text-gray-400 uppercase font-display tracking-widest mt-1">Set correct answers for the entire tournament for this match</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button
            onClick={onClose}
            className="flex-1 md:flex-none px-6 py-3 border border-white/10 text-gray-400 active:text-white font-display text-xs uppercase tracking-[0.2em] rounded-xl active:bg-white/5 transition-all active:scale-95 text-center"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-3 bg-ipl-gold text-black font-display text-xs uppercase tracking-[0.2em] font-bold rounded-xl hover:bg-white transition-all disabled:opacity-30 active:scale-95 shadow-[0_0_20px_rgba(244,196,48,0.2)]"
          >
            {isPending ? 'Propagating...' : 'Release Scores'}
          </button>
        </div>
      </div>

      <div className="grid gap-4 mt-6">
        {questionBank.questions.map((q: any) => {
          const replacedText = q.question_text
            .replace(/\{\{Team1\}\}/gi, currentMatch?.team1 || 'Team 1')
            .replace(/\{\{Team2\}\}/gi, currentMatch?.team2 || 'Team 2');

          const choiceTypes = ['toggle', 'multiple_choice', 'dropdown'];
          const isChoice = choiceTypes.includes(q.question_type);

          const replacedOptions = q.options?.map((opt: string) =>
            opt.replace(/\{\{Team1\}\}/gi, currentMatch?.team1 || 'Team 1')
              .replace(/\{\{Team2\}\}/gi, currentMatch?.team2 || 'Team 2')
          );

          return (
            <div key={q.id} className="p-5 border-l-4 border-white/10 hover:border-ipl-gold transition-all bg-white/5 rounded-r-2xl rounded-l-md">
              <h4 className="text-xs font-display text-white tracking-widest uppercase mb-4 leading-relaxed">{replacedText}</h4>
              {isChoice && replacedOptions ? (
                <div className="flex flex-wrap gap-2.5">
                  {replacedOptions.map((opt: string) => (
                    <button
                      key={opt}
                      onClick={() => setCorrectAnswers(prev => ({ ...prev, [q.key]: opt }))}
                      className={`px-4 py-2.5 font-display text-xs uppercase tracking-widest rounded-xl transition-all active:scale-95 ${correctAnswers[q.key] === opt
                        ? 'bg-ipl-gold text-ipl-navy font-bold'
                        : 'bg-white/5 text-gray-400 active:bg-white/10'
                        }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  type={q.question_type === 'free_number' ? 'number' : 'text'}
                  value={correctAnswers[q.key] || ''}
                  onChange={(e) => setCorrectAnswers(prev => ({ ...prev, [q.key]: e.target.value }))}
                  className="w-full bg-black/40 border border-white/10 p-3.5 rounded-2xl text-white font-display text-xs focus:border-ipl-gold focus:outline-none transition-all"
                  placeholder={`Enter correct ${q.question_type.replace('free_', '')}...`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AdminModal({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-4 select-none md:select-text">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />
      <div className="relative w-full md:max-w-2xl bg-ipl-surface border-t border-white/10 rounded-t-[28px] md:rounded-3xl shadow-2xl z-10 flex flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-8 p-6 md:p-8 md:border-t-4 md:border-ipl-gold animate-in slide-in-from-bottom md:zoom-in-95 duration-300 max-md:max-h-[90vh]">
        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-5 shrink-0 md:hidden" />
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors p-1 active:scale-90 z-20">
          <X className="w-6 h-6" />
        </button>
        {title && <div className="mb-6 pr-8">{title}</div>}
        <div className="overflow-y-auto scrollbar-hide flex-1 max-md:-mx-2 max-md:px-2 pb-2">
          {children}
        </div>
      </div>
    </div>
  );
}

function AnnouncementManagement() {
  const { data: announcements, isLoading } = useAdminAnnouncements();
  const createAnnouncement = useCreateAnnouncement();
  const updateAnnouncement = useUpdateAnnouncement();
  const deleteAnnouncement = useDeleteAnnouncement();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [actionLabel, setActionLabel] = useState('');
  const [actionUrl, setActionUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      title,
      content,
      action_label: actionLabel || undefined,
      action_url: actionUrl || undefined,
      is_active: true
    };

    if (editingId) {
      updateAnnouncement.mutate({ id: editingId, data }, {
        onSuccess: () => {
          toast.success('Announcement updated!');
          resetForm();
        }
      });
    } else {
      createAnnouncement.mutate(data, {
        onSuccess: () => {
          toast.success('Announcement created!');
          resetForm();
        }
      });
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setContent('');
    setActionLabel('');
    setActionUrl('');
  };

  const handleEditClick = (a: any) => {
    setEditingId(a.id);
    setTitle(a.title);
    setContent(a.content);
    setActionLabel(a.action_label || '');
    setActionUrl(a.action_url || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <section className="glass-panel p-6 border-t-2 border-ipl-gold rounded-3xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Megaphone className="w-6 h-6 text-ipl-gold" />
            <h2 className="text-xl font-display text-white italic uppercase tracking-tight">
              {editingId ? 'Edit Announcement' : 'Create Announcement'}
            </h2>
          </div>
          {editingId && (
            <button onClick={resetForm} className="text-[10px] text-gray-500 hover:text-white uppercase tracking-widest font-display flex items-center gap-1">
              <X className="w-3 h-3" /> Cancel
            </button>
          )}
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-display uppercase tracking-widest text-gray-500 mb-2">Title</label>
            <input required type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-black/40 border border-white/10 p-3 rounded-xl text-white font-display focus:border-ipl-gold outline-none" />
          </div>
          <div>
            <label className="block text-[10px] font-display uppercase tracking-widest text-gray-500 mb-2">Content</label>
            <textarea required value={content} onChange={(e) => setContent(e.target.value)} className="w-full bg-black/40 border border-white/10 p-3 rounded-xl text-white font-display focus:border-ipl-gold outline-none h-24" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-display uppercase tracking-widest text-gray-500 mb-2">Action Label (Optional)</label>
              <input type="text" value={actionLabel} onChange={(e) => setActionLabel(e.target.value)} className="w-full bg-black/40 border border-white/10 p-3 rounded-xl text-white font-display focus:border-ipl-gold outline-none" placeholder="e.g. View Campaigns" />
            </div>
            <div>
              <label className="block text-[10px] font-display uppercase tracking-widest text-gray-500 mb-2">Action URL (Optional)</label>
              <input type="text" value={actionUrl} onChange={(e) => setActionUrl(e.target.value)} className="w-full bg-black/40 border border-white/10 p-3 rounded-xl text-white font-display focus:border-ipl-gold outline-none" placeholder="e.g. /campaigns" />
            </div>
          </div>
          <button type="submit" disabled={(editingId ? updateAnnouncement.isPending : createAnnouncement.isPending) || !title || !content} className="w-full py-4 bg-ipl-gold text-ipl-navy font-display text-[10px] uppercase tracking-widest font-bold rounded-xl active:scale-[0.98]">
            {editingId ? (updateAnnouncement.isPending ? 'UPDATING...' : 'UPDATE ANNOUNCEMENT') : (createAnnouncement.isPending ? 'CREATING...' : 'PUBLISH ANNOUNCEMENT')}
          </button>
        </form>
      </section>

      <section className="glass-panel p-6 border-t-2 border-white/10 rounded-3xl">
        <h2 className="text-xl font-display text-white italic uppercase tracking-tight mb-6">Manage Announcements</h2>
        <div className="space-y-4">
          {isLoading ? <div className="text-center py-4 text-[10px] text-gray-500 uppercase tracking-widest animate-pulse">Loading...</div> : announcements?.map(a => (
            <div key={a.id} className={`p-4 rounded-xl border transition-all ${a.is_active ? 'bg-white/5 border-white/10' : 'bg-black/40 border-dashed border-white/5 opacity-60'}`}>
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-display text-white font-bold">{a.title}</h3>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateAnnouncement.mutate({ id: a.id, data: { is_active: !a.is_active } })} className={`px-2 py-1 text-[8px] uppercase tracking-widest font-bold rounded ${a.is_active ? 'bg-ipl-live/10 text-ipl-live' : 'bg-gray-500/20 text-gray-400'}`}>
                    {a.is_active ? 'Active' : 'Inactive'}
                  </button>
                  <button onClick={() => handleEditClick(a)} className="p-1 text-gray-400 hover:text-white transition-colors" title="Edit">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteAnnouncement.mutate(a.id)} className="p-1 text-gray-500 hover:text-red-500 transition-colors" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-400 font-display mb-3 whitespace-pre-wrap">{a.content}</p>
              {a.action_label && <div className="text-[10px] text-ipl-gold font-mono uppercase">Link: {a.action_label} ({a.action_url})</div>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
