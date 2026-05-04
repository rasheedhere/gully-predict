import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLeagueDetails, useKickMember, useRefreshJoinCode } from '../api/hooks/useLeagues';
import { Trophy, Copy, RefreshCw, Trash2, ArrowLeft, ShieldCheck, Users, Zap, ExternalLink, ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { getUserDisplayName } from '../utils/userUtils';

export default function LeagueDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: league, isLoading, error } = useLeagueDetails(id!);
  const kickMember = useKickMember(id!);
  const refreshCode = useRefreshJoinCode(id!);

  if (isLoading) {
    return <div className="text-white text-center font-display tracking-widest animate-pulse mt-20">SYNCING ARENA DATA...</div>;
  }

  if (error || !league) {
    return <div className="text-red-400 text-center py-20 font-display uppercase tracking-widest">Failed to load arena data.</div>;
  }

  const copyJoinCode = () => {
    if (league.join_code) {
      navigator.clipboard.writeText(league.join_code);
      toast.success('INVITE CODE COPIED');
    }
  };

  const handleRefreshCode = async () => {
    if (window.confirm('Are you sure you want to invalidate the old join code and generate a new one?')) {
      try {
        await refreshCode.mutateAsync();
        toast.success('Join code refreshed!');
      } catch (e) {
        toast.error('Failed to refresh code');
      }
    }
  };

  const handleKick = async (userId: string, name: string) => {
    if (window.confirm(`Are you sure you want to remove ${name} from the league?`)) {
      try {
        await kickMember.mutateAsync(userId);
        toast.success('Member removed');
      } catch (e: any) {
        toast.error(e.response?.data?.detail || 'Failed to remove member');
      }
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-10 pb-20">
      <button
        onClick={() => navigate('/leagues')}
        className="group flex items-center gap-2 text-gray-500 hover:text-white transition-all font-display uppercase tracking-[0.2em] text-[10px]"
      >
        <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> 
        Back to Arenas
      </button>

      {/* League Header Card */}
      <div className="relative group">
        <div className="absolute inset-0 bg-gradient-to-br from-ipl-gold/5 via-transparent to-transparent rounded-[2rem] -z-10" />
        <div className="glass-panel p-8 md:p-10 border-t-4 border-ipl-gold rounded-[2rem] flex flex-col lg:flex-row justify-between items-start lg:items-center gap-10 shadow-2xl">
          <div className="flex items-center gap-8">
            <div className={`w-24 h-24 rounded-3xl flex items-center justify-center text-4xl font-display font-bold shadow-2xl shrink-0 border-2
              ${league.id === 'global-league' ? 'bg-gradient-to-br from-ipl-gold to-yellow-600 text-ipl-navy border-white/20' : 'bg-black/40 text-ipl-gold border-white/10'}
            `}>
              {league.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-4">
                <h1 className="text-4xl font-display font-bold text-white italic uppercase tracking-tighter">
                  {league.name}
                </h1>
                {league.is_admin && (
                  <span className="p-2 bg-ipl-gold/10 rounded-xl border border-ipl-gold/20">
                    <ShieldCheck className="w-5 h-5 text-ipl-gold" />
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-3">
                <div className="flex items-center gap-2 text-gray-400 font-display uppercase tracking-widest text-[10px]">
                  <Users className="w-3.5 h-3.5 text-ipl-gold" />
                  <span>{league.participants.length} Battle-ready Members</span>
                </div>
                <div className="w-1 h-1 bg-gray-700 rounded-full" />
                <div className="flex items-center gap-2 text-gray-400 font-display uppercase tracking-widest text-[10px]">
                  <Zap className="w-3.5 h-3.5 text-ipl-gold" />
                  <span>{league.starting_powerups} Base Powerups</span>
                </div>
              </div>
              {league.is_admin && (
                <Link
                  to={`/leagues/${league.id}/admin`}
                  className="inline-flex items-center gap-2 mt-6 px-6 py-2.5 bg-ipl-gold text-ipl-navy font-display font-bold rounded-xl transition-all hover:scale-[1.05] active:scale-95 text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-ipl-gold/20"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Manage League
                </Link>
              )}
            </div>
          </div>

          {league.is_admin && league.id !== 'global-league' && (
            <div className="w-full lg:w-auto bg-black/40 border border-white/10 rounded-3xl p-6 flex flex-col items-center min-w-[280px] shadow-inner relative overflow-hidden group/code">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-ipl-gold/50 to-transparent opacity-0 group-hover/code:opacity-100 transition-opacity" />
              <span className="text-[9px] text-gray-500 uppercase tracking-[0.3em] font-bold mb-4">Invite Code</span>
              <div className="text-3xl font-mono text-ipl-gold tracking-[0.3em] font-bold bg-white/5 border border-white/5 px-8 py-3 rounded-2xl mb-6 w-full text-center shadow-lg">
                {league.join_code}
              </div>
              <div className="flex gap-3 w-full">
                <button
                  onClick={copyJoinCode}
                  className="flex-1 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white font-display text-[9px] uppercase tracking-[0.2em] py-3 rounded-xl transition-all border border-white/10"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy
                </button>
                <button
                  onClick={handleRefreshCode}
                  disabled={refreshCode.isPending}
                  className="flex-1 flex items-center justify-center gap-2 bg-white/5 hover:bg-red-500/10 text-gray-400 hover:text-red-400 font-display text-[9px] uppercase tracking-[0.2em] py-3 rounded-xl transition-all border border-white/10"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshCode.isPending ? 'animate-spin' : ''}`} /> Reset
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Members Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-4">
          <h2 className="text-xl font-display font-bold text-white italic uppercase tracking-widest flex items-center gap-3">
            <Users className="w-5 h-5 text-ipl-gold" />
            Arena Roster
          </h2>
          <span className="text-[10px] text-gray-600 font-display uppercase tracking-widest">{league.participants.length} Players</span>
        </div>

        <div className="grid gap-3">
          {league.participants.map((p) => (
            <div key={p.id} className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent rounded-2xl -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="bg-white/5 border border-white/10 hover:border-white/20 p-5 rounded-2xl transition-all flex items-center justify-between group shadow-sm hover:shadow-xl hover:shadow-black/40">
                <div className="flex items-center gap-5">
                  <div className="relative">
                    <img 
                      src={p.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.name}`} 
                      alt={p.name} 
                      className="w-12 h-12 rounded-xl border-2 border-white/10 group-hover:border-ipl-gold transition-colors object-cover" 
                    />
                    {league.id !== 'global-league' && p.remaining_powerups > 0 && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-ipl-gold rounded-full border-2 border-ipl-navy flex items-center justify-center shadow-lg">
                        <Zap className="w-2 h-2 text-ipl-navy" />
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="font-display font-bold text-lg text-white group-hover:text-ipl-gold transition-colors italic">
                      {getUserDisplayName(p)}
                    </div>
                    <div className="text-[9px] text-gray-500 font-display uppercase tracking-[0.2em] mt-0.5">Deployed {new Date(p.joined_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <div className="text-right hidden sm:block">
                    <div className="text-lg font-display font-bold text-white group-hover:text-ipl-gold transition-colors">{p.remaining_powerups}</div>
                    <div className="text-[8px] text-gray-600 uppercase tracking-widest font-bold">Powerups Left</div>
                  </div>
                  {league.is_admin && league.id !== 'global-league' && (
                    <button
                      onClick={() => handleKick(p.id, p.name)}
                      className="p-2.5 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all border border-transparent hover:border-red-500/20"
                      title="Remove Member"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
