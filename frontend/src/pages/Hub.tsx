import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, ChevronRight, Sparkles } from 'lucide-react';
import { useTournaments } from '../api/hooks/useTournaments';
import { useMyLeagues } from '../api/hooks/useMatches';
import { useTournamentStore } from '../store/tournament';

export default function Hub() {
  const navigate = useNavigate();
  const { data: tournaments, isLoading: loadingTournaments } = useTournaments();
  const { data: leagues, isLoading: loadingLeagues } = useMyLeagues();
  const { setActiveTournamentId } = useTournamentStore();

  // Auto-redirect if only 1 tournament exists in total
  useEffect(() => {
    if (!loadingTournaments && tournaments && tournaments.length === 1) {
      setActiveTournamentId(tournaments[0].id);
      navigate('/matchcenter', { replace: true });
    }
  }, [tournaments, loadingTournaments, navigate, setActiveTournamentId]);

  if (loadingTournaments || loadingLeagues) {
    return <div className="text-white text-center font-display tracking-widest animate-pulse mt-20">LOADING HUB...</div>;
  }

  // Group leagues by tournament
  const activeTournaments = new Set<string>();
  if (leagues) {
    leagues.forEach((l: any) => {
      if (l.tournament_id) {
        activeTournaments.add(l.tournament_id);
      }
    });
  }

  const myTournaments = tournaments?.filter(t => activeTournaments.has(t.id)) || [];
  const otherTournaments = tournaments?.filter(t => !activeTournaments.has(t.id) && t.status !== 'completed') || [];

  const handleEnterContext = (tournamentId: string, path: string = '/matchcenter') => {
    setActiveTournamentId(tournamentId);
    navigate(path);
  };

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="text-center space-y-4">
        <div className="inline-flex items-center justify-center p-3 bg-ipl-gold/10 rounded-full mb-4 ring-1 ring-ipl-gold/20 shadow-[0_0_30px_rgba(255,215,0,0.15)]">
          <Trophy className="w-10 h-10 text-ipl-gold" />
        </div>
        <h1 className="text-4xl md:text-5xl font-display text-white tracking-widest uppercase text-shadow-glow">
          Tournament Hub
        </h1>
        <p className="text-gray-400 font-display tracking-wider text-sm md:text-base max-w-xl mx-auto">
          Select a tournament to enter the arena. Your global stats and match centers are scoped to your active tournament.
        </p>
      </header>

      {myTournaments.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center gap-3 border-l-4 border-ipl-gold pl-4">
            <h2 className="text-2xl font-display text-white tracking-widest uppercase">My Tournaments</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {myTournaments.map(t => (
              <button
                key={t.id}
                onClick={() => handleEnterContext(t.id)}
                className="glass-panel p-6 flex flex-col items-start gap-6 group hover:border-ipl-gold/50 transition-all text-left relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-ipl-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <div className="space-y-2 relative z-10 w-full">
                  <div className="flex justify-between items-start">
                    <h3 className="text-xl font-display text-white tracking-wider font-bold group-hover:text-ipl-gold transition-colors">{t.name}</h3>
                    <div className="bg-ipl-gold/20 text-ipl-gold text-[10px] font-mono px-2 py-1 rounded font-bold uppercase tracking-widest">
                      ACTIVE
                    </div>
                  </div>
                  <p className="text-gray-400 text-sm font-display">
                    {leagues?.filter((l: any) => l.tournament_id === t.id).length} Active Leagues
                  </p>
                </div>

                <div className="flex items-center justify-between w-full relative z-10 pt-4 border-t border-white/5 group-hover:border-ipl-gold/20">
                  <span className="text-sm font-display text-gray-300 tracking-wider">Enter Arena</span>
                  <ChevronRight className="w-5 h-5 text-ipl-gold transform group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {otherTournaments.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center gap-3 border-l-4 border-white/20 pl-4">
            <h2 className="text-xl font-display text-gray-400 tracking-widest uppercase">Available Tournaments</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {otherTournaments.map(t => (
              <button
                key={t.id}
                onClick={() => handleEnterContext(t.id, '/leagues')}
                className="glass-panel p-6 flex flex-col items-start gap-4 group hover:border-white/20 transition-all text-left"
              >
                <div className="space-y-2 w-full">
                  <h3 className="text-lg font-display text-white tracking-wider">{t.name}</h3>
                  <p className="text-gray-500 text-xs font-display">
                    Join a league to participate in this tournament.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-display text-ipl-gold tracking-wider uppercase mt-2">
                  <Sparkles className="w-3 h-3" />
                  Explore Leagues
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {myTournaments.length === 0 && otherTournaments.length === 0 && (
        <div className="glass-panel p-12 text-center border-dashed border-2 border-white/10 opacity-50">
          <p className="text-gray-500 font-display uppercase tracking-[0.2em]">No active tournaments found</p>
        </div>
      )}
    </div>
  );
}
