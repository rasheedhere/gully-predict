import React, { useState } from 'react';
import { useMyLeagues, useJoinLeague } from '../api/hooks/useLeagues';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Trophy, Plus, Sparkles, ShieldCheck, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTournamentStore } from '../store/tournament';

export default function Leagues() {
  const { data: allLeagues, isLoading } = useMyLeagues();
  const { activeTournamentId } = useTournamentStore();
  const joinLeague = useJoinLeague();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const showJoinModal = searchParams.get('join') === 'true';
  const leagues = allLeagues?.filter((l: any) => l.tournament_id === activeTournamentId) || [];
  const [joinCode, setJoinCode] = useState('');

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode) return;
    try {
      await joinLeague.mutateAsync(joinCode);
      toast.success('Welcome to the Battleground!');
      setJoinCode('');
      setSearchParams({}); // Close modal
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to join league');
    }
  };

  if (isLoading) {
    return <div className="text-white text-center font-display tracking-widest animate-pulse mt-20">SYNCING ARENAS...</div>;
  }

  const isFirstTime = !leagues || leagues.length === 0;

  const renderJoinForm = (isMobile = false) => {
    return (
      <div className={`glass-panel p-6 border-t-4 border-ipl-gold relative overflow-hidden rounded-[22px] ${
        isMobile ? '!border-none !bg-transparent !p-0 shadow-none' : ''
      }`}>
        <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none">
          <Plus className="w-32 h-32 text-ipl-gold" />
        </div>

        <h2 className="text-xl font-display text-white mb-6 flex items-center gap-3 uppercase italic leading-none">
          <ShieldCheck className="w-5 h-5 text-ipl-gold shrink-0" /> Join Arena
        </h2>

        <form onSubmit={handleJoin} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-[10px] font-display uppercase tracking-[0.2em] text-gray-500">Invite Code</label>
            <input
              type="text"
              placeholder="e.g. C9920984"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              className="w-full bg-black/40 border-2 border-white/10 rounded-[16px] px-4 py-4 text-white font-display tracking-widest focus:outline-none focus:border-ipl-gold transition-all text-center placeholder:opacity-30"
            />
          </div>
          <button
            disabled={joinLeague.isPending || !joinCode}
            type="submit"
            className="w-full bg-ipl-gold text-ipl-navy py-4 rounded-[16px] font-display text-[10px] tracking-[0.3em] font-bold uppercase transition-all active:scale-95 disabled:opacity-30 shadow-[0_8px_20px_rgba(244,196,48,0.2)]"
          >
            {joinLeague.isPending ? 'DEPLOYING...' : 'JOIN BATTLEGROUND'}
          </button>
        </form>

        <p className="mt-6 text-gray-500 font-display text-[9px] uppercase tracking-[0.2em] leading-relaxed">
          Ask your league manager for their invite code to enter a private arena.
        </p>
      </div>
    );
  };

  return (
    <div className="w-full max-w-full mx-auto space-y-8 md:space-y-12 select-none">
      {/* Header Section */}
      <header className="hidden md:flex justify-between items-end gap-6 border-b border-white/10 pb-8">
        <div>
          <h1 className="text-4xl font-display text-white italic uppercase tracking-tighter flex items-center gap-4">
            <Trophy className="w-10 h-10 text-ipl-gold drop-shadow-[0_0_15px_rgba(244,196,48,0.4)]" />
            My Battlegrounds
          </h1>
          <p className="text-gray-400 mt-2 font-display uppercase tracking-widest text-xs opacity-60">Compete in the Global League or join a Private Arena</p>
        </div>
      </header>

      <div className="grid lg:grid-cols-[1fr_2fr] gap-12 items-start">
        {/* Left: Join Sidebar (Hidden on Mobile) */}
        <aside className="hidden lg:block space-y-8">
          {renderJoinForm()}

          {isFirstTime && (
            <div className="glass-panel p-6 border-l-4 border-ipl-live bg-ipl-live/5 animate-pulse rounded-2xl">
              <div className="flex gap-4">
                <Sparkles className="w-5 h-5 text-ipl-live shrink-0" />
                <p className="text-[10px] font-display text-ipl-live uppercase tracking-widest leading-relaxed">
                  You haven't joined any battlegrounds yet. Enter a code to start competing!
                </p>
              </div>
            </div>
          )}
        </aside>

        {/* Right: Leagues List */}
        <main className="space-y-6 w-full">
          <div className="flex items-center justify-between mb-2 px-2">
            <h2 className="text-xs font-display text-gray-500 uppercase tracking-[0.3em] font-bold">Active Arenas</h2>
            <span className="text-[10px] text-gray-600 font-display uppercase tracking-widest">{leagues?.length || 0} Joined</span>
          </div>

          <div className="grid gap-4 w-full">
            {leagues?.map((league) => (
              <div
                key={league.id}
                onClick={() => navigate(`/leagues/${league.id}`)}
                className="w-full active:scale-[0.98] transition-transform select-none"
              >
                <div className="bg-white/5 border border-white/10 hover:border-white/20 p-4 md:p-5 rounded-[22px] transition-all cursor-pointer flex items-center justify-between group shadow-sm hover:shadow-xl">
                  <div className="flex items-center gap-4 md:gap-6 min-w-0 flex-1 mr-4">
                    <div className={`w-12 h-12 md:w-16 md:h-16 rounded-[18px] flex items-center justify-center text-xl md:text-2xl font-display font-bold shadow-2xl shrink-0 border-2
                      ${league.id === 'global-league' || league.id.endsWith('-global')
                        ? 'bg-gradient-to-br from-ipl-gold to-yellow-600 text-ipl-navy border-white/20'
                        : 'bg-black/40 text-ipl-gold border-white/10 group-hover:border-ipl-gold/50'}
                    `}>
                      {league.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg md:text-xl font-display font-bold text-white flex items-center gap-2 group-hover:text-ipl-gold transition-colors italic uppercase tracking-tight leading-tight truncate">
                        {league.name}
                        {league.is_admin && (
                          <span className="p-1 bg-ipl-gold/10 rounded-lg shrink-0">
                            <ShieldCheck className="w-3.5 h-3.5 text-ipl-gold" />
                          </span>
                        )}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 min-w-0">
                        <span className="text-[9px] font-display uppercase tracking-widest text-gray-500 font-bold shrink-0">
                          {league.id === 'global-league' || league.id.endsWith('-global') ? 'Official' : 'Private'}
                        </span>
                        <div className="w-1 h-1 bg-gray-700 rounded-full shrink-0" />
                        <span className="text-[9px] font-display uppercase tracking-widest text-gray-600 truncate">
                          Code: {league.join_code}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-gray-500 shrink-0">
                    <ChevronRight className="w-5 h-5 group-hover:text-ipl-gold transition-colors" />
                  </div>
                </div>
              </div>
            ))}
            
            {isFirstTime && (
              <div className="lg:hidden glass-panel p-8 text-center border-dashed border-2 border-white/5 opacity-50 rounded-2xl">
                <p className="text-gray-500 font-display text-xs uppercase tracking-[0.2em] leading-relaxed">
                  You haven't joined any battlegrounds yet.<br />Tap '+' in the header to join one!
                </p>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Mobile Join iOS Bottom Sheet */}
      {showJoinModal && (
        <div className="lg:hidden fixed inset-0 z-50 flex items-end justify-center select-none">
          {/* Backdrop overlay */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setSearchParams({})}
          />
          {/* Bottom Sheet Panel */}
          <div className="w-full bg-ipl-surface border-t border-white/10 rounded-t-[28px] shadow-2xl z-10 flex flex-col pb-[calc(1.5rem+env(safe-area-inset-bottom))] p-6 animate-in slide-in-from-bottom duration-300">
            {/* Drag handle */}
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-5 shrink-0" />
            {/* Scrollable details content */}
            <div className="overflow-y-auto flex-1">
              {renderJoinForm(true)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
