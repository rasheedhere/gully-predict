import React, { useState } from 'react';
import MatchCard from '../components/MatchCard';
import { useMatches, useMyPredictionStatus } from '../api/hooks/useMatches';
import { useAuthStore } from '../store/auth';
import { useTournamentStore } from '../store/tournament';
import { Sparkles } from 'lucide-react';

export default function MatchCenter() {
  const { user } = useAuthStore();
  const { activeTournamentId } = useTournamentStore();
  const { data: matches, isLoading, error } = useMatches(activeTournamentId || undefined);
  const { data: predictedMatchIds } = useMyPredictionStatus();

  // Scroll index tracking for iOS-style pagination indicators
  const [activeTodayIdx, setActiveTodayIdx] = useState(0);
  const [activeFutureIdx, setActiveFutureIdx] = useState(0);

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
    // Must not be today, and must be in the future
    return d.toDateString() !== now.toDateString() && d > now;
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

  const handleFutureScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    if (futureMatches.length === 0) return;
    const scrollPosition = container.scrollLeft;
    const itemWidth = container.scrollWidth / futureMatches.length;
    const index = Math.min(
      Math.max(0, Math.round(scrollPosition / itemWidth)),
      futureMatches.length - 1
    );
    setActiveFutureIdx(index);
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

      {/* Today's Matches */}
      <section className="space-y-4">
        <div className="flex items-center gap-3 border-l-4 border-ipl-live pl-3">
          <div className="w-2 h-2 rounded-full bg-ipl-live animate-pulse" />
          <h2 className="text-lg font-display text-white tracking-wider uppercase">Match Day</h2>
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
            todayMatches.map((match: any) => (
              <div key={match.id} className="max-md:snap-start max-md:shrink-0 max-md:w-[85%] max-md:max-w-[320px]">
                <MatchCard
                  {...match}
                  has_predicted={predictedMatchIds?.includes(match.id)}
                />
              </div>
            ))
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

      {/* Upcoming Matches */}
      <section className="space-y-4">
        <div className="flex items-center gap-3 border-l-4 border-white/20 pl-3">
          <h2 className="text-lg font-display text-gray-400 tracking-wider uppercase">Upcoming Matches</h2>
        </div>

        <div 
          onScroll={handleFutureScroll}
          className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-md:flex max-md:overflow-x-auto max-md:snap-x max-md:snap-mandatory max-md:scrollbar-hide max-md:-mx-4 max-md:px-4 max-md:pb-4 max-md:w-[calc(100%+2rem)]"
        >
          {futureMatches.length === 0 ? (
            <p className="text-gray-400 col-span-full italic text-xs px-4 md:px-0">No further matches synced for this window.</p>
          ) : (
            futureMatches.map((match: any) => (
              <div key={match.id} className="max-md:snap-start max-md:shrink-0 max-md:w-[85%] max-md:max-w-[320px]">
                <MatchCard
                  {...match}
                  has_predicted={predictedMatchIds?.includes(match.id)}
                />
              </div>
            ))
          )}
        </div>

        {/* Dynamic Carousel dot indicators on mobile */}
        {futureMatches.length > 1 && (
          <div className="flex justify-center gap-1.5 mt-2 md:hidden select-none">
            {futureMatches.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  activeFutureIdx === idx 
                    ? 'w-4 bg-ipl-gold' 
                    : 'w-1.5 bg-white/20'
                }`}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
