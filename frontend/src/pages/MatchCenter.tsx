import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMatches, useMyPredictionStatus } from '../api/hooks/useMatches';
import { useAuthStore } from '../store/auth';
import { useTournamentStore } from '../store/tournament';
import { Sparkles, BarChart3 } from 'lucide-react';
import { getTeamColor, getTeamShortName } from '../utils/teamColors';
import { getTeamLogo } from '../utils/teamLogos';

// Helper to generate realistic deterministic cricket margins for completed matches
const getMockMargin = (matchId: string, winner: string) => {
  let hash = 0;
  for (let i = 0; i < matchId.length; i++) {
    hash = matchId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const absHash = Math.abs(hash);
  const isWkts = absHash % 2 === 0;
  if (isWkts) {
    const wkts = (absHash % 5) + 5; // 5 to 9 wickets
    return `${winner} won by ${wkts} wkts`;
  } else {
    const runs = (absHash % 40) + 5; // 5 to 45 runs
    return `${winner} won by ${runs} runs`;
  }
};

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
  const { activeTournamentId } = useTournamentStore();
  const { data: matches, isLoading, error } = useMatches(activeTournamentId || undefined);
  const { data: predictedMatchIds } = useMyPredictionStatus();

  // Scroll index tracking for iOS-style pagination indicators
  const [activeTodayIdx, setActiveTodayIdx] = useState(0);

  if (isLoading) return <div className="text-white text-center font-display tracking-widest animate-pulse mt-20">LOADING ARENA...</div>;
  if (error) return <div className="text-ipl-live text-center font-display tracking-widest mt-20">FAILED TO LOAD MATCHES</div>;

  const todayMatches = matches?.filter(m => {
    const d = new Date(m.tossTime);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }) || [];

  const futureMatches = matches?.filter(m => {
    const d = new Date(m.tossTime);
    const now = new Date();
    return d.toDateString() !== now.toDateString() && d > now;
  }) || [];

  const pastMatches = matches?.filter(m => {
    const d = new Date(m.tossTime);
    const now = new Date();
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(now.getDate() - 2);
    twoDaysAgo.setHours(0, 0, 0, 0);
    return d < now && d.toDateString() !== now.toDateString() && d >= twoDaysAgo;
  }) || [];

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
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-display text-white tracking-wider uppercase font-extrabold">Match Day</h2>
          <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-[#E84040]/30 bg-[#E84040]/10 text-[#E84040] text-[10px] font-display uppercase tracking-widest font-extrabold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E84040] animate-pulse" />
            Live
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
              const t1Color = getTeamColor(match.team1);
              const t2Color = getTeamColor(match.team2);
              const t1Logo = getTeamLogo(match.team1);
              const t2Logo = getTeamLogo(match.team2);
              const t1Short = getTeamShortName(match.team1);
              const t2Short = getTeamShortName(match.team2);
              const hasPredicted = predictedMatchIds?.includes(match.id);
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
                    <div className="flex justify-between items-center mb-6">
                      <span className="text-[10px] md:text-xs font-display tracking-[0.2em] uppercase text-gray-400 font-semibold">
                        Match {matchNumber} • {match.venue}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {hasPredicted ? (
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

                    {/* Bottom Button */}
                    <div className="w-full mt-6">
                      <div className="w-full py-3 rounded-full border border-white/10 hover:bg-white/5 flex items-center justify-center gap-2 text-[10px] font-display uppercase tracking-widest text-white/90 font-bold transition-colors">
                        VIEW INSIGHTS
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
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  activeTodayIdx === idx 
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
              const timeFormatted = formatMatchTime(match.tossTime);
              return (
                <Link 
                  to={`/match/${match.id}`}
                  key={match.id}
                  className="flex items-center justify-between p-4 bg-[#141822]/80 border border-white/5 rounded-2xl hover:bg-white/[0.02] hover:border-white/10 transition-all duration-200"
                >
                  {/* Left side: Teams */}
                  <div className="flex items-center">
                    <div className="text-center min-w-[36px]">
                      <span className="text-base font-display font-extrabold text-white tracking-wide block leading-none">{t1Short}</span>
                      <span className="text-[8px] font-display uppercase tracking-widest text-gray-500 mt-1 block">HOME</span>
                    </div>
                    
                    <div className="w-[1px] h-6 bg-white/10 mx-3" />
                    
                    <div className="text-center min-w-[36px]">
                      <span className="text-base font-display font-extrabold text-white tracking-wide block leading-none">{t2Short}</span>
                      <span className="text-[8px] font-display uppercase tracking-widest text-gray-500 mt-1 block">AWAY</span>
                    </div>
                  </div>

                  {/* Right side: Time and Venue */}
                  <div className="text-right">
                    <span className="text-[11px] font-display font-bold text-ipl-gold tracking-wider block">{timeFormatted}</span>
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
              const winnerShort = match.winner ? getTeamShortName(match.winner) : null;
              
              // If winner is set, highlight winner in white and loser in faded gray
              const resolvedWinner = winnerShort || t1Short;
              const isT1Winner = resolvedWinner === t1Short;
              const isT2Winner = resolvedWinner === t2Short;
              const hasPredicted = predictedMatchIds?.includes(match.id);
              const resultText = getMockMargin(match.id, resolvedWinner);

              return (
                <Link 
                  to={`/match/${match.id}`}
                  key={match.id}
                  className="relative bg-[#141822]/80 border border-white/5 rounded-2xl p-4 hover:bg-white/[0.02] transition-all duration-200 overflow-hidden flex flex-col justify-between min-h-[130px] shadow-sm"
                >
                  {/* Top Row: Match Number & Win Badge */}
                  <div className="flex justify-between items-center w-full">
                    <span className="text-[9px] font-display uppercase tracking-widest text-gray-500 font-semibold">
                      Match {matchNumber}
                    </span>
                    
                    {hasPredicted && (
                      <span className="bg-ipl-gold text-ipl-navy text-[7px] font-display font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded select-none">
                        WON +45PTS
                      </span>
                    )}
                  </div>

                  {/* Middle Row: Teams (e.g. PBKS vs SRH) */}
                  <div className="flex items-center justify-center gap-2 text-base font-display font-extrabold uppercase tracking-wider my-3">
                    <span className={isT1Winner ? 'text-white' : 'text-gray-600'}>{t1Short}</span>
                    <span className="text-[8px] text-white/20 italic font-body lowercase tracking-normal">vs</span>
                    <span className={isT2Winner ? 'text-white' : 'text-gray-600'}>{t2Short}</span>
                  </div>

                  {/* Bottom Row: Result Text */}
                  <div className="text-center">
                    <span className={`text-[9px] font-display tracking-wider block ${
                      hasPredicted ? 'text-ipl-gold font-bold' : 'text-gray-500'
                    }`}>
                      {resultText}
                    </span>
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
