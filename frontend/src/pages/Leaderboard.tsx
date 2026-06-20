import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { useMyLeagues } from '../api/hooks/useMatches';
import LeaderboardSection from '../components/LeaderboardSection';
import LocalTournamentSelector from '../components/LocalTournamentSelector';

export default function Leaderboard() {
  const { data: leagues } = useMyLeagues();
  const [searchParams] = useSearchParams();
  const activeTournamentId = searchParams.get('tournament');
  const [activeLeagueId, setActiveLeagueId] = useState<string | null>(null);

  const globalLeagueId = `${activeTournamentId}-global`;

  // Filter leagues for the active tournament
  const activeLeagues = leagues?.filter((l: any) => l.tournament_id === activeTournamentId) || [];

  const hasGlobal = activeLeagues.some((l: any) => l.id === globalLeagueId);
  const displayLeagues = [...activeLeagues];

  if (!hasGlobal && activeTournamentId) {
    displayLeagues.push({
      id: globalLeagueId,
      name: 'Global Leaderboard',
      tournament_id: activeTournamentId,
      tournament_name: '',
    });
  }

  // Sort leagues: private league boards first (alphabetically), then global board last
  const sortedLeagues = displayLeagues.sort((a: any, b: any) => {
    if (a.id === globalLeagueId) return 1;
    if (b.id === globalLeagueId) return -1;
    return a.name.localeCompare(b.name);
  });

  // Set default active tab/pill on load or switch tournament
  useEffect(() => {
    if (sortedLeagues.length > 0) {
      // If current active league is not in the list (e.g. tournament switched), reset
      const hasActive = sortedLeagues.some(l => l.id === activeLeagueId);
      if (!hasActive) {
        setActiveLeagueId(sortedLeagues[0].id);
      }
    }
  }, [sortedLeagues, activeLeagueId]);

  return (
    <div className="space-y-6">
      {/* Tournament Selector */}
      <LocalTournamentSelector />

      {/* Tab Pills Navigation (Leaderboards selector) */}
      {activeTournamentId && sortedLeagues.length > 1 && (
        <div className="flex gap-2.5 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 w-[calc(100%+2rem)] select-none">
          {sortedLeagues.map((league: any) => {
            const isActive = activeLeagueId === league.id;
            const displayName = league.id === globalLeagueId ? 'Global League' : league.name;
            return (
              <button
                key={league.id}
                onClick={() => setActiveLeagueId(league.id)}
                className={`px-5 py-2.5 rounded-full text-xs font-display uppercase tracking-wider font-extrabold transition-all duration-200 shrink-0 ${isActive
                    ? 'bg-ipl-gold text-ipl-navy shadow-[0_0_15px_rgba(244,196,48,0.2)]'
                    : 'bg-[#141822] text-[#8e9aa8] border border-white/5 hover:text-white'
                  }`}
              >
                {displayName}
              </button>
            );
          })}
        </div>
      )}

      {/* Render Active Leaderboard Section */}
      {activeTournamentId && sortedLeagues.map((league: any) => {
        if (league.id !== activeLeagueId) return null;
        return (
          <LeaderboardSection
            key={league.id}
            leagueId={league.id}
            leagueName={league.name || (league.id === globalLeagueId ? 'Global Leaderboard' : 'League Leaderboard')}
            tournamentName={league.tournament_name || ''}
          />
        );
      })}

      {!activeTournamentId && (
        <div className="flex flex-col items-center justify-center py-16 gap-5 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <Trophy className="w-8 h-8 text-ipl-gold/40" />
          </div>
          <div>
            <p className="text-white font-display text-sm uppercase tracking-widest font-bold">Select a Tournament</p>
            <p className="text-gray-500 text-xs mt-2 max-w-[220px] mx-auto leading-relaxed">
              Choose a tournament above to view the standings and league leaderboards.
            </p>
          </div>
          <div className="flex items-center gap-1 text-ipl-gold/60 text-xs font-display uppercase tracking-widest animate-bounce">
            ↑ Pick one above
          </div>
        </div>
      )}
    </div>
  );
}
