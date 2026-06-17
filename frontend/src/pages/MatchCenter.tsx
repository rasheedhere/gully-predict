import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMatches, useMyPredictionStatus } from '../api/hooks/useMatches';
import { useAuthStore } from '../store/auth';
import { Sparkles, BarChart3 } from 'lucide-react';
import { getTeamColor, getTeamShortName } from '../utils/teamColors';
import { getTeamLogo } from '../utils/teamLogos';
import CountdownTimer from '../components/CountdownTimer';

// Helper to generate realistic deterministic cricket margins for completed matches

// Helper to format match times exactly like reference image (Tomorrow, 19:30 or 12 Apr, 19:30)
const formatMatchTime = (isoString: string) => {
  const d = new Date(isoString);
  const now = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(now.getDate() + 1);

  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

  if (d.toDateString() === now.toDateString()) {
    return `Today, ${timeStr}`;
  } else if (d.toDateString() === tomorrow.toDateString()) {
    return `Tomorrow, ${timeStr}`;
  } else {
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    const dateStr = d.toLocaleDateString('en-US', options);
    return `${dateStr}, ${timeStr}`;
  }
};

export default function MatchCenter() {
  const { user } = useAuthStore();
  const { data: matches, isLoading, error } = useMatches(); // Fetch ALL matches
  const { data: predictionStatus } = useMyPredictionStatus();

  const [activeFilter, setActiveFilter] = useState<string>('all');

  // Scroll index tracking for iOS-style pagination indicators
  const [activeTodayIdx, setActiveTodayIdx] = useState(0);

  if (isLoading) return <div className="text-white text-center font-display tracking-widest animate-pulse mt-20">LOADING ARENA...</div>;
  if (error) return <div className="text-ipl-live text-center font-display tracking-widest mt-20">FAILED TO LOAD MATCHES</div>;

  // Calculate tournament filters
  const filterCounts: Record<string, { name: string, count: number }> = {};
  matches?.forEach(m => {
    if (m.tournament) {
      if (!filterCounts[m.tournament.id]) {
        filterCounts[m.tournament.id] = { name: m.tournament.name, count: 0 };
      }
      filterCounts[m.tournament.id].count++;
    }
  });

  const filteredMatches = activeFilter === 'all'
    ? matches || []
    : matches?.filter(m => m.tournament?.id === activeFilter) || [];

  const todayMatches = filteredMatches.filter(m => {
    const d = new Date(m.tossTime);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });

  const futureMatches = filteredMatches.filter(m => {
    const d = new Date(m.tossTime);
    const now = new Date();
    return d.toDateString() !== now.toDateString() && d > now;
  });

  const pastMatches = filteredMatches.filter(m => {
    const d = new Date(m.tossTime);
    const now = new Date();
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(now.getDate() - 2);
    twoDaysAgo.setHours(0, 0, 0, 0);
    return d < now && d.toDateString() !== now.toDateString() && d >= twoDaysAgo;
  });

  const handleTodayScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    if (todayMatches.length === 0) return;
    const scrollPosition = container.scrollLeft;
    const itemWidth = container.scrollWidth / todayMatches.length;
    const index = Math.min(
      Math.max(0, Math.round(scrollPosition / itemWidth)),
      todayMatches.length - 1
    );
    setActiveTodayIdx(index);
  };

  return (
    <div className="space-y-8 md:space-y-12">
      <header className="hidden md:block">
        <h1 className="text-3xl font-display text-white border-b-2 border-white/10 pb-4">
          MATCH CENTER
        </h1>
      </header>

      {/* Filters */}
      <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-hide snap-x">
        <button
          onClick={() => setActiveFilter('all')}
          className={`shrink-0 snap-start px-4 py-2 rounded-full font-display uppercase tracking-widest text-xs transition-colors duration-200 border ${
            activeFilter === 'all'
              ? 'bg-ipl-gold text-black font-extrabold border-ipl-gold shadow-[0_0_10px_rgba(244,196,48,0.2)]'
              : 'bg-white/5 text-gray-400 font-semibold border-white/10 hover:bg-white/10 hover:text-white'
          }`}
        >
          Matches ({matches?.length || 0})
        </button>

        {Object.entries(filterCounts).map(([id, info]) => (
          <button
            key={id}
            onClick={() => setActiveFilter(id)}
            className={`shrink-0 snap-start px-4 py-2 rounded-full font-display uppercase tracking-widest text-xs transition-colors duration-200 border ${
              activeFilter === id
                ? 'bg-ipl-gold text-black font-extrabold border-ipl-gold shadow-[0_0_10px_rgba(244,196,48,0.2)]'
                : 'bg-white/5 text-gray-400 font-semibold border-white/10 hover:bg-white/10 hover:text-white'
            }`}
          >
            {info.name} ({info.count})
          </button>
        ))}
      </div>

      {user?.is_guest && (
        <div className="glass-panel border-l-4 border-l-ipl-gold p-5 bg-ipl-gold/5 flex items-start gap-4 animate-in fade-in slide-in-from-left-4 duration-700 rounded-2xl">
          <div className="p-2 bg-ipl-gold/10 rounded-lg shrink-0">
            <Sparkles className="w-5 h-5 text-ipl-gold" />
          </div>
          <div className="space-y-1">
            <h3 className="text-white font-display uppercase text-xs tracking-wider">Welcome to the Guest Arena</h3>
            <p className="text-gray-400 text-[11px] leading-relaxed">
              You're currently exploring as a <span className="text-ipl-gold font-bold">GUEST</span>. Feel free to view live matches, check the leaderboard, and see community predictions. Note that guests cannot submit predictions.
            </p>
          </div>
        </div>
      )}

      {/* Today's Matches / Match Day */}
      <section className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-display text-white tracking-wider uppercase font-extrabold">Match Day</h2>
            <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-[#E84040]/30 bg-[#E84040]/10 text-[#E84040] text-[10px] font-display uppercase tracking-widest font-extrabold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E84040]" />
              Live
            </div>
          </div>
          <div className="text-xs font-display text-gray-400 tracking-widest uppercase bg-white/5 px-3 py-1 rounded-full border border-white/10 ml-auto md:ml-0">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </div>

        <div
          onScroll={handleTodayScroll}
          className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-md:flex max-md:overflow-x-auto max-md:snap-x max-md:snap-mandatory max-md:scrollbar-hide max-md:-mx-4 max-md:px-4 max-md:pb-4 max-md:w-[calc(100%+2rem)]"
        >
          {todayMatches.length === 0 ? (
            <div className="glass-panel p-8 text-center border-dashed border-2 border-white/5 opacity-50 col-span-full w-full rounded-2xl">
              <p className="text-gray-500 font-display text-xs uppercase tracking-[0.2em]">No matches scheduled for today</p>
            </div>
          ) : (
            todayMatches.map((match: any) => {
              const matchNoMatch = match.id.match(/ipl-\d{4}-(\d+)/);
              const matchNumber = matchNoMatch ? matchNoMatch[1] : null;
              const t1Color = getTeamColor(match.team1, match.team2);
              const t2Color = getTeamColor(match.team2, match.team1);
              const t1Logo = getTeamLogo(match.team1);
              const t2Logo = getTeamLogo(match.team2);
              const t1Short = getTeamShortName(match.team1);
              const t2Short = getTeamShortName(match.team2);
              const hasPredicted = predictionStatus ? (match.id in predictionStatus) : false;
              const isLive = match.status === 'live';

              return (
                <div key={match.id} className="max-md:snap-start max-md:shrink-0 max-md:w-[88%] max-md:max-w-[340px] w-full">
                  <Link
                    to={`/match/${match.id}`}
                    className="block w-full bg-[#171a24] border border-white/5 rounded-[2rem] p-6 relative group transition-all duration-300 hover:border-ipl-gold/20 shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
                    style={{
                      boxShadow: isLive ? '0 0 25px rgba(244, 196, 48, 0.06)' : undefined
                    }}
                  >
                    {/* Card Top Header */}
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex flex-col">
                        {match.tournament && (
                          <span className="text-[10px] md:text-[11px] font-display font-bold text-ipl-gold mb-1 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded border border-ipl-gold/20 self-start">
                            {match.tournament.name}
                          </span>
                        )}
                        <span className="text-[10px] md:text-xs font-display tracking-[0.2em] uppercase text-gray-400 font-semibold mt-1">
                          Match {matchNumber} • {match.venue}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {match.status === 'completed' ? (
                          <span className="text-[9px] font-display uppercase tracking-widest px-2.5 py-0.5 rounded-full border border-green-500/30 bg-green-500/5 text-green-500 font-bold">
                            CONCLUDED
                          </span>
                        ) : hasPredicted ? (
                          <span className="text-[9px] font-display uppercase tracking-widest px-2.5 py-0.5 rounded-full border border-ipl-gold/30 bg-ipl-gold/5 text-ipl-gold font-bold">
                            PREDICTED
                          </span>
                        ) : (
                          <span className="text-[9px] font-display uppercase tracking-widest px-2.5 py-0.5 rounded-full border-dashed border border-white/10 bg-white/5 text-gray-400">
                            PENDING
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Center Layout: Teams */}
                    <div className="flex items-center justify-center gap-4 my-3 w-full">
                      {/* Team 1 */}
                      <div className="flex flex-col items-center gap-3 flex-1">
                        <div
                          className="w-18 h-18 rounded-full flex items-center justify-center border-2 bg-black/30 p-2.5 transition-transform duration-300 group-hover:scale-105"
                          style={{
                            borderColor: isLive ? '#F4C430' : `${t1Color}40`,
                            boxShadow: isLive ? '0 0 15px rgba(244,196,48,0.4)' : undefined,
                            backgroundColor: `${t1Color}08`
                          }}
                        >
                          {t1Logo ? (
                            <img src={t1Logo} alt={match.team1} className="w-full h-full object-contain" />
                          ) : (
                            <span className="text-lg font-display text-white">{t1Short}</span>
                          )}
                        </div>
                        <span className="text-base font-display font-extrabold text-white uppercase tracking-wider">{t1Short}</span>
                      </div>

                      {/* VS Indicator */}
                      <div className="flex flex-col items-center justify-center px-1">
                        <span className="text-[9px] font-display italic tracking-[0.4em] text-white/20 mb-1">VS</span>
                        <div className="w-[1px] h-8 bg-gradient-to-b from-transparent via-white/10 to-transparent" />
                      </div>

                      {/* Team 2 */}
                      <div className="flex flex-col items-center gap-3 flex-1">
                        <div
                          className="w-18 h-18 rounded-full flex items-center justify-center border-2 bg-black/30 p-2.5 transition-transform duration-300 group-hover:scale-105"
                          style={{
                            borderColor: `${t2Color}20`,
                            backgroundColor: `${t2Color}05`
                          }}
                        >
                          {t2Logo ? (
                            <img src={t2Logo} alt={match.team2} className="w-full h-full object-contain" />
                          ) : (
                            <span className="text-lg font-display text-white">{t2Short}</span>
                          )}
                        </div>
                        <span className="text-base font-display font-extrabold text-white uppercase tracking-wider">{t2Short}</span>
                      </div>
                    </div>

                    {/* Countdown Timer / Locks Status */}
                    {match.status !== 'completed' && new Date() < new Date(new Date(match.tossTime).getTime() - 30 * 60000) && (
                      <div className="flex justify-center mt-5 text-[10px] font-mono tracking-widest w-full">
                        <CountdownTimer targetDate={match.tossTime} />
                      </div>
                    )}

                    {/* Bottom Button */}
                    <div className="w-full mt-6">
                      <div className="w-full py-3 rounded-full border border-white/10 hover:bg-white/5 flex items-center justify-center gap-2 text-[10px] font-display uppercase tracking-widest text-white/90 font-bold transition-colors">
                        VIEW MATCH
                        <BarChart3 className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })
          )}
        </div>

        {/* Dynamic Carousel dot indicators on mobile */}
        {todayMatches.length > 1 && (
          <div className="flex justify-center gap-1.5 mt-2 md:hidden select-none">
            {todayMatches.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-300 ${activeTodayIdx === idx
                  ? 'w-4 bg-ipl-gold'
                  : 'w-1.5 bg-white/20'
                  }`}
              />
            ))}
          </div>
        )}
      </section>

      {/* Upcoming Fixtures */}
      <section className="space-y-4">
        <h2 className="text-xl font-display text-white tracking-wider uppercase font-extrabold">Upcoming Fixtures</h2>

        <div className="flex flex-col gap-3 md:grid md:grid-cols-2 lg:grid-cols-3">
          {futureMatches.length === 0 ? (
            <p className="text-gray-400 italic text-xs px-4 md:px-0">No further matches synced for this window.</p>
          ) : (
            futureMatches.slice(0, 4).map((match: any) => {
              const t1Short = getTeamShortName(match.team1);
              const t2Short = getTeamShortName(match.team2);
              const t1Logo = getTeamLogo(match.team1);
              const t2Logo = getTeamLogo(match.team2);
              const timeFormatted = formatMatchTime(match.tossTime);
              return (
                <Link
                  to={`/match/${match.id}`}
                  key={match.id}
                  className="flex items-center justify-between p-4 bg-[#141822]/80 border border-white/5 rounded-2xl hover:bg-white/[0.02] hover:border-white/10 transition-all duration-200"
                >
                  {/* Left side: Teams */}
                  <div className="flex items-center">
                    <div className="text-center min-w-[44px]">
                      <div className="flex items-center gap-1.5 justify-center">
                        {t1Logo && <img src={t1Logo} alt={match.team1} className="w-3.5 h-3.5 object-contain" />}
                        <span className="text-sm md:text-base font-display font-extrabold text-white tracking-wide block leading-none">{t1Short}</span>
                      </div>
                      <span className="text-[8px] font-display uppercase tracking-widest text-gray-500 mt-1 block">HOME</span>
                    </div>

                    <div className="w-[1px] h-6 bg-white/10 mx-3.5" />

                    <div className="text-center min-w-[44px]">
                      <div className="flex items-center gap-1.5 justify-center">
                        {t2Logo && <img src={t2Logo} alt={match.team2} className="w-3.5 h-3.5 object-contain" />}
                        <span className="text-sm md:text-base font-display font-extrabold text-white tracking-wide block leading-none">{t2Short}</span>
                      </div>
                      <span className="text-[8px] font-display uppercase tracking-widest text-gray-500 mt-1 block">AWAY</span>
                    </div>
                  </div>

                  {/* Right side: Time and Venue */}
                  <div className="text-right">
                    {match.tournament && <span className="text-[8px] font-display font-bold text-ipl-gold uppercase tracking-widest block mb-0.5">{match.tournament.name}</span>}
                    <span className="text-[11px] font-display font-bold text-white tracking-wider block">{timeFormatted}</span>
                    <span className="text-[9px] font-body text-gray-400 mt-0.5 block truncate max-w-[120px]">{match.venue}</span>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </section>

      {/* Recent Results */}
      {pastMatches.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-display text-white tracking-wider uppercase font-extrabold">Recent Results</h2>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pastMatches.slice(0, 4).map((match: any) => {
              const matchNoMatch = match.id.match(/ipl-\d{4}-(\d+)/);
              const matchNumber = matchNoMatch ? matchNoMatch[1] : null;
              const t1Short = getTeamShortName(match.team1);
              const t2Short = getTeamShortName(match.team2);
              const t1Logo = getTeamLogo(match.team1);
              const t2Logo = getTeamLogo(match.team2);
              const winnerShort = match.winner ? getTeamShortName(match.winner) : null;

              // If winner is set, highlight winner in white and loser in faded gray
              const resolvedWinner = winnerShort || t1Short;
              const isT1Winner = resolvedWinner === t1Short;
              const isT2Winner = resolvedWinner === t2Short;
              const hasPredicted = predictionStatus ? (match.id in predictionStatus) : false;
              const pointsWon = predictionStatus?.[match.id];

              return (
                <Link
                  to={`/match/${match.id}`}
                  key={match.id}
                  className="relative bg-[#141822]/80 border border-white/5 rounded-2xl p-4 hover:bg-white/[0.02] transition-all duration-200 overflow-hidden flex flex-col justify-between min-h-[130px] shadow-sm"
                >
                  {/* Top Row: Match Number & Win Badge */}
                  <div className="flex justify-between items-start w-full">
                    <div className="flex flex-col">
                      {match.tournament && <span className="text-[8px] font-display font-bold text-ipl-gold uppercase tracking-widest mb-0.5">{match.tournament.name}</span>}
                      <span className="text-[9px] font-display uppercase tracking-widest text-gray-500 font-semibold">
                        Match {matchNumber}
                      </span>
                    </div>

                    {hasPredicted && typeof pointsWon === 'number' && (
                      <span className="bg-ipl-gold text-ipl-navy text-[7px] font-display font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded select-none">
                        WON {pointsWon >= 0 ? `+${pointsWon}` : pointsWon}PTS
                      </span>
                    )}
                  </div>

                  {/* Middle Row: Teams (e.g. PBKS vs SRH) */}
                  <div className="flex items-center justify-center gap-2 my-3">
                    <div className="flex items-center gap-1.5">
                      {t1Logo && <img src={t1Logo} alt={match.team1} className="w-3.5 h-3.5 object-contain" />}
                      <span className={`text-sm md:text-base font-display font-extrabold uppercase tracking-wider ${isT1Winner ? 'text-white' : 'text-gray-600'}`}>{t1Short}</span>
                    </div>
                    <span className="text-[8px] text-white/20 italic font-body lowercase tracking-normal">vs</span>
                    <div className="flex items-center gap-1.5">
                      {t2Logo && <img src={t2Logo} alt={match.team2} className="w-3.5 h-3.5 object-contain" />}
                      <span className={`text-sm md:text-base font-display font-extrabold uppercase tracking-wider ${isT2Winner ? 'text-white' : 'text-gray-600'}`}>{t2Short}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
