import { useMyLeagues } from '../api/hooks/useMatches';
import { useTournamentStore } from '../store/tournament';
import LeaderboardSection from '../components/LeaderboardSection';

export default function Leaderboard() {
  const { data: leagues } = useMyLeagues();
  const { activeTournamentId } = useTournamentStore();

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

  const sortedLeagues = displayLeagues.sort((a: any, b: any) => {
    if (a.id === globalLeagueId) return -1;
    if (b.id === globalLeagueId) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-12">

      {sortedLeagues.map((league: any) => (
        <LeaderboardSection
          key={league.id}
          leagueId={league.id}
          leagueName={league.name || (league.id === globalLeagueId ? 'Global Leaderboard' : 'League Leaderboard')}
          tournamentName={league.tournament_name || ''}
        />
      ))}

      {!sortedLeagues.length && (
        <div className="p-8 text-center text-white font-display text-xl tracking-widest">
          LOADING STANDINGS...
        </div>
      )}
    </div>
  );
}
