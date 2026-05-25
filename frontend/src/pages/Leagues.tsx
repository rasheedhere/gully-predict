import React, { useState } from 'react';
import { useMyLeagues, useJoinLeague } from '../api/hooks/useLeagues';
import { useNavigate } from 'react-router-dom';
import { Trophy, Plus, Sparkles, ShieldCheck, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTournamentStore } from '../store/tournament';

export default function Leagues() {
  const { data: allLeagues, isLoading } = useMyLeagues();
  const { activeTournamentId } = useTournamentStore();
  const joinLeague = useJoinLeague();
  const navigate = useNavigate();

  const leagues = allLeagues?.filter((l: any) => l.tournament_id === activeTournamentId) || [];

  const [joinCode, setJoinCode] = useState('');

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode) return;
    try {
      await joinLeague.mutateAsync(joinCode);
      toast.success('Welcome to the Battleground!');
      setJoinCode('');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to join league');
    }
  };

  if (isLoading) {
    return <div className="text-white text-center font-display tracking-widest animate-pulse mt-20">SYNCING ARENAS...</div>;
  }

  const isFirstTime = !leagues || leagues.length === 0;

  return (
    <div className="w-full max-w-full mx-auto space-y-12 pb-20">
      {/* Header Section */}
      <header className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-white/10 pb-8">
        <div>
          <h1 className="text-4xl font-display text-white italic uppercase tracking-tighter flex items-center gap-4">
            <Trophy className="w-10 h-10 text-ipl-gold drop-shadow-[0_0_15px_rgba(244,196,48,0.4)]" />
            My Battlegrounds
          </h1>
          <p className="text-gray-400 mt-2 font-display uppercase tracking-widest text-xs opacity-60">Compete in the Global League or join a Private Arena</p>
        </div>
      </header>

      <div className="grid lg:grid-cols-[1fr_2fr] gap-12 items-start">
        {/* Left: Join Sidebar */}
        <aside className="space-y-8">
          <div className="glass-panel p-8 border-t-4 border-ipl-gold relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Plus className="w-32 h-32 text-ipl-gold" />
            </div>

            <h2 className="text-xl font-display text-white mb-6 flex items-center gap-3 uppercase italic">
              <ShieldCheck className="w-5 h-5 text-ipl-gold" /> Join Arena
            </h2>

            <form onSubmit={handleJoin} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-[10px] font-display uppercase tracking-[0.2em] text-gray-500">Invite Code</label>
                <input
                  type="text"
                  placeholder="e.g. C9920984"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="w-full bg-black/40 border-2 border-white/10 rounded-xl px-4 py-4 text-white font-display tracking-widest focus:outline-none focus:border-ipl-gold transition-all text-center placeholder:opacity-30"
                />
              </div>
              <button
                disabled={joinLeague.isPending || !joinCode}
                type="submit"
                className="w-full bg-ipl-gold text-ipl-navy py-4 rounded-xl font-display text-[10px] tracking-[0.3em] font-bold uppercase transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-30 shadow-[0_10px_20px_rgba(244,196,48,0.2)]"
              >
                {joinLeague.isPending ? 'DEPLOYING...' : 'JOIN BATTLEGROUND'}
              </button>
            </form>

            <p className="mt-6 text-gray-500 font-display text-[9px] uppercase tracking-[0.2em] leading-relaxed">
              Ask your league manager for their unique 8-character invite code to enter a private arena.
            </p>
          </div>

          {isFirstTime && (
            <div className="glass-panel p-6 border-l-4 border-ipl-live bg-ipl-live/5 animate-pulse">
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
        <main className="space-y-6">
          <div className="flex items-center justify-between mb-4 px-2">
            <h2 className="text-sm font-display text-gray-500 uppercase tracking-[0.3em] font-bold">Active Arenas</h2>
            <span className="text-[10px] text-gray-600 font-display uppercase tracking-widest">{leagues?.length || 0} Joined</span>
          </div>

          <div className="grid gap-4">
            {leagues?.map((league) => (
              <div
                key={league.id}
                onClick={() => navigate(`/leagues/${league.id}`)}
                className="group relative"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent rounded-2xl -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <div className="bg-white/5 border border-white/10 hover:border-white/20 p-5 rounded-2xl transition-all cursor-pointer flex items-center justify-between group shadow-sm hover:shadow-xl hover:shadow-black/40">
                  <div className="flex items-center gap-6">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-display font-bold shadow-2xl transition-transform group-hover:scale-110 border-2
                      ${league.id === 'global-league'
                        ? 'bg-gradient-to-br from-ipl-gold to-yellow-600 text-ipl-navy border-white/20'
                        : 'bg-black/40 text-ipl-gold border-white/10 group-hover:border-ipl-gold/50'}
                    `}>
                      {league.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-xl font-display font-bold text-white flex items-center gap-3 group-hover:text-ipl-gold transition-colors italic uppercase tracking-tight">
                        {league.name}
                        {league.is_admin && (
                          <span className="p-1 bg-ipl-gold/10 rounded-lg">
                            <ShieldCheck className="w-3.5 h-3.5 text-ipl-gold" />
                          </span>
                        )}
                      </h3>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-[10px] font-display uppercase tracking-widest text-gray-500 font-bold">
                          {league.id === 'global-league' ? 'Official Arena' : 'Private Group'}
                        </span>
                        <div className="w-1 h-1 bg-gray-700 rounded-full" />
                        <span className="text-[10px] font-display uppercase tracking-widest text-gray-600">
                          Match Day Performance
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-gray-600 group-hover:text-ipl-gold transition-all">
                    <span className="text-[9px] font-display uppercase tracking-[0.2em] opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0 font-bold">Enter Arena</span>
                    <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
