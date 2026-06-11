import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTournaments } from '../api/hooks/useTournaments';
import { useMatches } from '../api/hooks/useMatches';

export default function LocalTournamentSelector() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTournamentId = searchParams.get('tournament');
  const { data: tournaments, isLoading: isTournamentsLoading } = useTournaments();
  const { data: allMatches, isLoading: isMatchesLoading } = useMatches(); // Fetch all matches to find the default

  // Compute the default tournament (the one with the most recent match, or fallback to first active)
  const defaultTournamentId = useMemo(() => {
    if (!tournaments || tournaments.length === 0) return null;
    if (!allMatches || allMatches.length === 0) {
      // Fallback: first active, then upcoming, then completed
      const active = tournaments.find(t => t.status === 'active');
      if (active) return active.id;
      const upcoming = tournaments.find(t => t.status === 'upcoming');
      if (upcoming) return upcoming.id;
      return tournaments[0].id;
    }

    // Sort matches by closeness to now
    const now = new Date().getTime();
    const sortedMatches = [...allMatches].sort((a, b) => {
      const diffA = Math.abs(new Date(a.tossTime).getTime() - now);
      const diffB = Math.abs(new Date(b.tossTime).getTime() - now);
      return diffA - diffB;
    });

    const nearestMatch = sortedMatches[0];
    if (nearestMatch?.tournament?.id) {
      return nearestMatch.tournament.id;
    }

    return tournaments[0].id;
  }, [tournaments, allMatches]);

  useEffect(() => {
    if (!isTournamentsLoading && !isMatchesLoading && !currentTournamentId && defaultTournamentId) {
      // Update URL with default tournament
      setSearchParams(params => {
        params.set('tournament', defaultTournamentId);
        return params;
      }, { replace: true });
    }
  }, [isTournamentsLoading, isMatchesLoading, currentTournamentId, defaultTournamentId, setSearchParams]);

  if (isTournamentsLoading) {
    return <div className="h-10 animate-pulse bg-white/5 rounded-xl mb-6"></div>;
  }

  if (!tournaments || tournaments.length === 0) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide mb-6 pb-2">
      {tournaments.map(t => (
        <button
          key={t.id}
          onClick={() => {
            setSearchParams(params => {
              params.set('tournament', t.id);
              return params;
            });
          }}
          className={`shrink-0 px-4 py-2 rounded-xl text-xs font-display uppercase tracking-widest font-bold transition-all duration-200 border ${
            currentTournamentId === t.id
              ? 'bg-ipl-gold text-ipl-navy border-ipl-gold shadow-[0_0_15px_rgba(244,196,48,0.3)]'
              : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:text-white'
          }`}
        >
          {t.name}
        </button>
      ))}
    </div>
  );
}
