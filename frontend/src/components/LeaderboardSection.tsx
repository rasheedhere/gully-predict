import { useLeaderboard } from '../api/hooks/useMatches';
import { useAuthStore } from '../store/auth';
import { useState, useEffect } from 'react';
import { Trophy, History, X, Info, ChevronDown, ChevronUp, Zap, Target, Check, AlertCircle } from 'lucide-react';
import { getUserDisplayName } from '../utils/userUtils';

export default function LeaderboardSection({ leagueId, leagueName, tournamentName }: { leagueId: string, leagueName: string, tournamentName: string }) {
  const { user: currentUser } = useAuthStore();
  const { data: leaderboard, isLoading } = useLeaderboard(leagueId);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);

  const podiumUsers = leaderboard?.slice(0, 3) || [];
  const listUsers = leaderboard?.slice(3) || [];

  useEffect(() => {
    if (selectedUser) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedUser]);

  const handleRowClick = (entry: any) => {
    setSelectedUser(entry);
    setExpandedMatch(null);
  };

  const renderProgressionPanel = (isMobile = false) => {
    if (!selectedUser) {
      return (
        <div className="glass-panel p-8 text-center border-dashed border-2 border-white/10 opacity-40 rounded-2xl">
          <History className="w-10 h-10 text-white/20 mx-auto mb-4" />
          <p className="text-[10px] font-display uppercase tracking-widest leading-loose">
            Select a player to view<br />match-by-match<br />progression
          </p>
        </div>
      );
    }

    return (
      <div className={`glass-panel p-5 border-t-2 border-ipl-gold rounded-2xl ${
        isMobile ? '!border-none !bg-transparent !p-0 !shadow-none' : 'animate-in fade-in slide-in-from-right-4 duration-500'
      }`}>
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-3">
            <img
              src={selectedUser.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedUser.username}`}
              className="w-10 h-10 rounded-full border border-ipl-gold/30"
              alt=""
            />
            <div>
              <h3 className="text-white font-display uppercase text-sm tracking-tight leading-none">
                {getUserDisplayName({ name: selectedUser.username, alias: selectedUser.alias, use_alias: selectedUser.use_alias })}
              </h3>
              <p className="text-ipl-gold text-[10px] font-display uppercase tracking-widest mt-1">Rank #{selectedUser.rank}</p>
            </div>
          </div>
          <button onClick={() => setSelectedUser(null)} className="text-gray-500 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-2">
            <Trophy className="w-4 h-4 text-ipl-gold opacity-50" />
            <h4 className="text-[10px] font-display text-gray-400 uppercase tracking-widest">Match History</h4>
            <span className="ml-auto text-[8px] font-mono text-gray-500 tracking-tighter opacity-60">(Latest First)</span>
          </div>

          <div className="max-h-[320px] overflow-y-auto scrollbar-hide space-y-2 pr-1">
            {selectedUser.progression?.length === 0 ? (
              <p className="text-center py-10 text-gray-600 font-display text-[10px] uppercase italic">No matches played yet</p>
            ) : (
              selectedUser.progression?.map((prog: any, idx: number) => {
                const isExpanded = expandedMatch === prog.match_number;
                return (
                  <div key={idx} className={`bg-white/5 border border-white/10 rounded-xl overflow-hidden transition-all duration-300 ${isExpanded ? 'border-ipl-gold/50 bg-ipl-gold/5' : 'hover:border-white/20'}`}>
                    <button
                      onClick={() => setExpandedMatch(isExpanded ? null : prog.match_number)}
                      className="w-full text-left p-3 flex flex-col group/row"
                    >
                      <div className="flex justify-between items-start mb-1 w-full">
                        <span className="text-[9px] font-mono text-gray-500 flex items-center gap-1">
                          MATCH {prog.match_number}
                          {prog.breakdown && (isExpanded ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5 opacity-40" />)}
                        </span>
                        <span className={`text-xs font-display font-bold ${prog.points > 0 ? 'text-green-400' : prog.points < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                          {prog.points > 0 ? '+' : ''}{prog.points}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-300 font-display uppercase tracking-tight truncate group-hover/row:text-white transition-colors">
                        {prog.teams}
                      </div>
                    </button>

                    {isExpanded && prog.breakdown && (
                      <div className="px-3 pb-3 pt-1 border-t border-white/5 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="space-y-1.5 mt-2">
                          {prog.breakdown.rules?.map((rule: any, ridx: number) => (
                            <div key={ridx} className="flex justify-between items-center text-[9px] bg-white/5 p-1.5 rounded-sm">
                              <div className="flex items-center gap-1.5">
                                {rule.status === 'correct' || rule.status === 'bingo' ? (
                                  <Check className="w-3 h-3 text-green-500 shrink-0" />
                                ) : rule.status === 'range' ? (
                                  <Target className="w-3 h-3 text-blue-400 shrink-0" />
                                ) : (
                                  <AlertCircle className="w-3 h-3 text-red-500/50 shrink-0" />
                                )}
                                <div className="flex flex-col">
                                  <span className="text-gray-300 font-display uppercase tracking-tighter">{rule.category}</span>
                                  <span className="text-[7px] text-gray-500 font-mono">
                                    P: {rule.predicted} | A: {rule.actual}
                                  </span>
                                </div>
                              </div>
                              <span className={`font-mono font-bold ${rule.points > 0 ? 'text-green-400' : rule.points < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                                {rule.points > 0 ? '+' : ''}{rule.points}
                              </span>
                            </div>
                          ))}

                          {prog.breakdown.powerup?.used && (
                            <div className="flex justify-between items-center text-[9px] bg-ipl-live/10 border border-ipl-live/20 p-1.5 rounded-sm">
                              <div className="flex items-center gap-1.5">
                                <Zap className="w-3 h-3 text-ipl-live" />
                                <span className="text-ipl-live font-display uppercase tracking-tighter">Powerup Applied (2x)</span>
                              </div>
                              <span className="text-ipl-live font-mono font-bold">
                                ×2
                              </span>
                            </div>
                          )}

                          <div className="mt-2 text-[8px] text-gray-500 font-mono text-center uppercase tracking-widest opacity-40">
                            Breakdown Log Complete
                          </div>
                        </div>
                      </div>
                    )}

                    {isExpanded && !prog.breakdown && (
                      <div className="px-3 pb-3 pt-1 text-[9px] text-gray-500 italic text-center font-display uppercase tracking-widest bg-red-500/5 mt-2 rounded border border-red-500/10">
                        {prog.points < 0 ? 'Non-participation Penalty (-5)' : 'No breakdown data available'}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {selectedUser.campaign_scores?.length > 0 && (
          <div className="space-y-3 mt-6 pt-6 border-t border-white/10">
            <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-2">
              <Trophy className="w-4 h-4 text-ipl-gold" />
              <h4 className="text-[10px] font-display text-white uppercase tracking-widest">Campaigns & Bonuses</h4>
            </div>
            
            <div className="space-y-2 pr-2">
              {selectedUser.campaign_scores.map((camp: any, idx: number) => {
                const isExpanded = expandedMatch === `camp-${idx}`;
                return (
                  <div key={idx} className={`bg-white/5 border border-white/10 rounded-xl overflow-hidden transition-all duration-300 ${isExpanded ? 'border-ipl-gold/50 bg-ipl-gold/5' : 'hover:border-white/20'}`}>
                    <button
                      onClick={() => setExpandedMatch(isExpanded ? null : `camp-${idx}`)}
                      className="w-full text-left p-3 flex flex-col group/row"
                    >
                      <div className="flex justify-between items-start mb-1 w-full">
                        <span className="text-[9px] font-mono text-ipl-gold flex items-center gap-1 uppercase tracking-widest truncate pr-2">
                          🏆 {camp.campaign_title}
                          {camp.breakdown && (isExpanded ? <ChevronUp className="w-2.5 h-2.5 shrink-0" /> : <ChevronDown className="w-2.5 h-2.5 opacity-40 shrink-0" />)}
                        </span>
                        <span className={`text-xs font-display font-bold shrink-0 ${camp.points > 0 ? 'text-green-400' : camp.points < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                          {camp.points > 0 ? '+' : ''}{camp.points}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-500 font-display uppercase tracking-tight truncate transition-colors">
                        BONUS POINTS
                      </div>
                    </button>

                    {isExpanded && camp.breakdown && (
                      <div className="px-3 pb-3 pt-1 border-t border-white/5 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="space-y-1.5 mt-2">
                          {camp.breakdown.rules?.map((rule: any, ridx: number) => (
                            <div key={ridx} className="flex justify-between items-center text-[9px] bg-white/5 p-1.5 rounded-sm">
                              <div className="flex items-center gap-1.5">
                                {rule.status === 'correct' || rule.status === 'bingo' ? (
                                  <Check className="w-3 h-3 text-green-500 shrink-0" />
                                ) : rule.status === 'range' ? (
                                  <Target className="w-3 h-3 text-blue-400 shrink-0" />
                                ) : (
                                  <AlertCircle className="w-3 h-3 text-red-500/50 shrink-0" />
                                )}
                                <div className="flex flex-col">
                                  <span className="text-gray-300 font-display uppercase tracking-tighter">{rule.category || rule.key}</span>
                                  <span className="text-[7px] text-gray-500 font-mono">
                                    P: {rule.predicted} | A: {rule.actual}
                                  </span>
                                </div>
                              </div>
                              <span className={`font-mono font-bold ${rule.points > 0 ? 'text-green-400' : rule.points < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                                {rule.points > 0 ? '+' : ''}{rule.points}
                              </span>
                            </div>
                          ))}

                          {camp.breakdown.powerup?.used && (
                            <div className="flex justify-between items-center text-[9px] bg-ipl-live/10 border border-ipl-live/20 p-1.5 rounded-sm">
                              <div className="flex items-center gap-1.5">
                                <Zap className="w-3 h-3 text-ipl-live" />
                                <span className="text-ipl-live font-display uppercase tracking-tighter">Powerup Applied (2x)</span>
                              </div>
                              <span className="text-ipl-live font-mono font-bold">
                                ×2
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {currentUser?.is_guest && (
          <div className="glass-panel p-5 border-l-4 border-l-ipl-gold bg-white/[0.02] mt-6 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-ipl-gold" />
              <h4 className="text-[10px] font-display text-white uppercase tracking-widest">Guest Standing</h4>
            </div>
            <p className="text-[10px] text-gray-500 font-display leading-relaxed">
              As a Guest, your points are not tracked in the global standings. Contact an admin to become a full expert and join the race for the top!
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Desktop Header */}
      <header className="border-b-2 border-white/10 pb-4 hidden md:block">
        <h2 className="text-2xl font-display text-white">{leagueName}</h2>
        <p className="text-gray-400 mt-1 italic tracking-widest text-xs uppercase opacity-60">
          {tournamentName} Standings
        </p>
      </header>

      {isLoading ? (
        <div className="p-8 text-center animate-pulse text-white font-display text-xl tracking-widest">LOADING STANDINGS...</div>
      ) : (
        <>
          {/* Mobile-Only Podium & Custom Rankings List */}
          <div className="md:hidden space-y-6">
            {/* Podium */}
            {podiumUsers.length > 0 && (
              <div className="flex items-end justify-center gap-6 py-6 select-none bg-gradient-to-b from-white/[0.01] to-transparent rounded-3xl p-4 border border-white/5">
                {/* Rank 2 */}
                {podiumUsers[1] && (
                  <div 
                    className="flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100 cursor-pointer"
                    onClick={() => handleRowClick(podiumUsers[1])}
                  >
                    <div className="relative mb-2">
                      <div className="w-16 h-16 rounded-full border-2 border-gray-400 overflow-hidden bg-black/40 p-0.5">
                        <img 
                          src={podiumUsers[1].avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${podiumUsers[1].username}`} 
                          alt="" 
                          className="w-full h-full rounded-full object-cover"
                        />
                      </div>
                      <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-5 bg-gray-400 text-black text-[10px] font-display font-bold rounded-full flex items-center justify-center border border-ipl-navy">
                        2
                      </div>
                    </div>
                    <span className="text-[11px] font-display font-bold text-gray-300 truncate max-w-[80px]">
                      {getUserDisplayName({ name: podiumUsers[1].username, alias: podiumUsers[1].alias, use_alias: podiumUsers[1].use_alias }).split(' ')[0]}
                    </span>
                    <span className="text-[10px] font-body text-gray-400 mt-0.5">
                      {podiumUsers[1].total_points.toLocaleString()} pts
                    </span>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      {podiumUsers[1].powerup_balances && podiumUsers[1].powerup_balances.length > 0 ? (
                        podiumUsers[1].powerup_balances.map((bal: any, bIdx: number) => (
                          <div key={bIdx} className="flex items-center gap-0.5" title={`${bal.name}: ${bal.remaining}/${bal.max} left`}>
                            <Zap className={`w-2.5 h-2.5 ${bal.type === 'global' ? 'text-ipl-live' : 'text-purple-400'}`} />
                            <span className={`text-[9px] font-mono font-bold leading-none ${bal.type === 'global' ? 'text-ipl-live' : 'text-purple-400'}`}>
                              {bal.remaining}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="flex items-center gap-0.5">
                          <Zap className="w-2.5 h-2.5 text-ipl-live" />
                          <span className="text-[9px] font-mono font-bold text-ipl-live leading-none">
                            {podiumUsers[1].remaining_powerups !== undefined ? podiumUsers[1].remaining_powerups : 10}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Rank 1 */}
                {podiumUsers[0] && (
                  <div 
                    className="flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-6 duration-700 cursor-pointer -mt-4 pb-2"
                    onClick={() => handleRowClick(podiumUsers[0])}
                  >
                    <div className="relative mb-2">
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-ipl-gold drop-shadow-[0_0_8px_rgba(244,196,48,0.6)]">
                        <Trophy className="w-5 h-5 fill-current" />
                      </div>
                      <div className="w-20 h-20 rounded-full border-2 border-ipl-gold overflow-hidden bg-black/40 p-0.5 shadow-[0_0_20px_rgba(244,196,48,0.25)]">
                        <img 
                          src={podiumUsers[0].avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${podiumUsers[0].username}`} 
                          alt="" 
                          className="w-full h-full rounded-full object-cover"
                        />
                      </div>
                      <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-5 bg-ipl-gold text-black text-[10px] font-display font-bold rounded-full flex items-center justify-center border border-ipl-navy">
                        1
                      </div>
                    </div>
                    <span className="text-xs font-display font-extrabold text-white truncate max-w-[95px]">
                      {getUserDisplayName({ name: podiumUsers[0].username, alias: podiumUsers[0].alias, use_alias: podiumUsers[0].use_alias }).split(' ')[0]}
                    </span>
                    <span className="text-[11px] font-body text-ipl-gold font-bold mt-0.5">
                      {podiumUsers[0].total_points.toLocaleString()} pts
                    </span>
                    <div className="flex items-center justify-center gap-1 mt-1 animate-pulse">
                      {podiumUsers[0].powerup_balances && podiumUsers[0].powerup_balances.length > 0 ? (
                        podiumUsers[0].powerup_balances.map((bal: any, bIdx: number) => (
                          <div key={bIdx} className="flex items-center gap-0.5" title={`${bal.name}: ${bal.remaining}/${bal.max} left`}>
                            <Zap className={`w-2.5 h-2.5 ${bal.type === 'global' ? 'text-ipl-live' : 'text-purple-400'}`} />
                            <span className={`text-[9px] font-mono font-bold leading-none ${bal.type === 'global' ? 'text-ipl-live' : 'text-purple-400'}`}>
                              {bal.remaining}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="flex items-center gap-0.5">
                          <Zap className="w-2.5 h-2.5 text-ipl-live" />
                          <span className="text-[9px] font-mono font-bold text-ipl-live leading-none">
                            {podiumUsers[0].remaining_powerups !== undefined ? podiumUsers[0].remaining_powerups : 10}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Rank 3 */}
                {podiumUsers[2] && (
                  <div 
                    className="flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200 cursor-pointer"
                    onClick={() => handleRowClick(podiumUsers[2])}
                  >
                    <div className="relative mb-2">
                      <div className="w-16 h-16 rounded-full border-2 border-amber-600 overflow-hidden bg-black/40 p-0.5">
                        <img 
                          src={podiumUsers[2].avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${podiumUsers[2].username}`} 
                          alt="" 
                          className="w-full h-full rounded-full object-cover"
                        />
                      </div>
                      <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-5 bg-amber-600 text-black text-[10px] font-display font-bold rounded-full flex items-center justify-center border border-ipl-navy">
                        3
                      </div>
                    </div>
                    <span className="text-[11px] font-display font-bold text-gray-300 truncate max-w-[80px]">
                      {getUserDisplayName({ name: podiumUsers[2].username, alias: podiumUsers[2].alias, use_alias: podiumUsers[2].use_alias }).split(' ')[0]}
                    </span>
                    <span className="text-[10px] font-body text-gray-400 mt-0.5">
                      {podiumUsers[2].total_points.toLocaleString()} pts
                    </span>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      {podiumUsers[2].powerup_balances && podiumUsers[2].powerup_balances.length > 0 ? (
                        podiumUsers[2].powerup_balances.map((bal: any, bIdx: number) => (
                          <div key={bIdx} className="flex items-center gap-0.5" title={`${bal.name}: ${bal.remaining}/${bal.max} left`}>
                            <Zap className={`w-2.5 h-2.5 ${bal.type === 'global' ? 'text-ipl-live' : 'text-purple-400'}`} />
                            <span className={`text-[9px] font-mono font-bold leading-none ${bal.type === 'global' ? 'text-ipl-live' : 'text-purple-400'}`}>
                              {bal.remaining}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="flex items-center gap-0.5">
                          <Zap className="w-2.5 h-2.5 text-ipl-live" />
                          <span className="text-[9px] font-mono font-bold text-ipl-live leading-none">
                            {podiumUsers[2].remaining_powerups !== undefined ? podiumUsers[2].remaining_powerups : 10}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Scrollable Rankings List */}
            <div className="space-y-2.5 pb-6">
              {listUsers.map((entry: any) => {
                const isCurrent = entry.username === currentUser?.name;
                const recentProg = entry.progression?.slice(0, 3) || [];
                return (
                  <div 
                    key={entry.username}
                    onClick={() => handleRowClick(entry)}
                    className={`flex items-center justify-between p-3.5 rounded-full border transition-all duration-200 cursor-pointer ${
                      isCurrent 
                        ? 'bg-ipl-gold/15 border-ipl-gold/30 shadow-[0_0_12px_rgba(244,196,48,0.06)]' 
                        : 'bg-[#141822]/80 border-white/5 hover:bg-white/[0.02]'
                    }`}
                  >
                    {/* Left: Rank, Avatar, Player Name */}
                    <div className="w-[58%] flex items-center gap-3 min-w-0 shrink-0">
                      <span className="w-5 text-center text-xs font-display text-gray-500 font-extrabold shrink-0">{entry.rank}</span>
                      <img 
                        src={entry.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${entry.username}`} 
                        alt="" 
                        className="w-8 h-8 rounded-full border border-white/10 shrink-0 object-cover"
                      />
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className={`text-xs font-display font-bold truncate ${isCurrent ? 'text-ipl-gold' : 'text-white'}`}>
                          {isCurrent ? 'You' : getUserDisplayName({ name: entry.username, alias: entry.alias, use_alias: entry.use_alias })}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[9px] text-gray-500 font-display uppercase tracking-tight">
                            M: {entry.matches_played}
                          </span>
                          <span className="text-white/10 text-[9px] select-none">•</span>
                          <div className="flex items-center gap-1">
                            {entry.powerup_balances && entry.powerup_balances.length > 0 ? (
                              entry.powerup_balances.map((bal: any, bIdx: number) => (
                                <div key={bIdx} className="flex items-center gap-0.5" title={`${bal.name}: ${bal.remaining}/${bal.max} left`}>
                                  <Zap className={`w-2.5 h-2.5 ${bal.type === 'global' ? 'text-ipl-live' : 'text-purple-400'}`} />
                                  <span className={`text-[9px] font-mono font-bold leading-none ${bal.type === 'global' ? 'text-ipl-live' : 'text-purple-400'}`}>
                                    {bal.remaining}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <div className="flex items-center gap-0.5">
                                <Zap className="w-2.5 h-2.5 text-ipl-live" />
                                <span className="text-[9px] font-mono font-bold text-ipl-live leading-none">
                                  {entry.remaining_powerups !== undefined ? entry.remaining_powerups : 10}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Center: Latest 3 Match Result Dots */}
                    <div className="w-[25%] flex items-center justify-center gap-1.5 shrink-0">
                      {recentProg.map((prog: any, idx: number) => {
                        const color = prog.points >= 25 
                          ? 'bg-[#00C896]' // Correct/green
                          : prog.points > 0 
                            ? 'bg-[#38BDF8]' // Blue
                            : prog.points < 0 
                              ? 'bg-[#E84040]' // Red/Penalty
                              : 'bg-gray-600';
                        return (
                          <span 
                            key={idx} 
                            className={`w-1.5 h-1.5 rounded-full ${color}`} 
                            title={`Earned ${prog.points} pts in Match ${prog.match_number}`}
                          />
                        );
                      })}
                      {recentProg.length === 0 && (
                        <span className="text-[7px] font-display text-gray-600 uppercase tracking-tighter">NEW</span>
                      )}
                    </div>

                    {/* Right: Points */}
                    <div className="w-[17%] flex items-center justify-end pr-2 shrink-0">
                      <span className="text-sm font-display font-extrabold text-white">{entry.total_points.toLocaleString()}</span>
                    </div>
                  </div>
                );
              })}
              {listUsers.length === 0 && podiumUsers.length === 0 && (
                <div className="p-8 text-center text-gray-500 font-display uppercase tracking-widest opacity-30 italic">NO RANKINGS AVAILABLE YET</div>
              )}
            </div>
          </div>

          {/* Desktop-Only Standings Table Grid Layout */}
          <div className="hidden md:grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
            <div className="lg:col-span-3 glass-panel overflow-hidden">
              <div className="overflow-x-auto w-full custom-scrollbar">
                <table className="w-full text-left border-collapse table-fixed whitespace-nowrap">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/10">
                      <th className="p-2 md:p-4 font-display tracking-wider text-gray-400 text-[10px] md:text-xs uppercase w-10 md:w-16 text-center">Rank</th>
                      <th className="p-2 md:p-4 font-display tracking-wider text-gray-400 text-[10px] md:text-xs uppercase w-auto">Player</th>
                      <th className="p-2 md:p-4 font-display tracking-wider text-gray-400 text-center hidden lg:table-cell lg:w-[200px]">
                        <div className="text-[10px] md:text-xs uppercase">History</div>
                        <div className="text-[8px] text-gray-500 font-mono tracking-tighter mt-0.5 opacity-60">(Latest → Oldest)</div>
                      </th>
                      <th className="p-2 md:p-4 font-display tracking-wider text-gray-400 text-[10px] md:text-xs uppercase text-right w-16 md:w-24">Points</th>
                      <th className="p-2 md:p-4 font-display tracking-wider text-gray-400 text-[10px] md:text-xs uppercase text-center w-12 md:w-20">Pwrups</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard?.map((entry: any) => (
                      <tr
                        key={entry.username}
                        onClick={() => handleRowClick(entry)}
                        className={`border-b border-white/5 transition-all group cursor-pointer ${selectedUser?.username === entry.username ? 'bg-ipl-gold/20' :
                            entry.username === currentUser?.name ? 'bg-white/5' : 'hover:bg-white/5'
                          }`}
                      >
                        <td className="p-2 md:p-4">
                          <div className="flex items-center justify-center gap-2 font-display text-sm md:text-lg">
                            {entry.rank <= 3 ? (
                              <span className={`w-6 h-6 md:w-8 md:h-8 flex items-center justify-center rounded-sm ${entry.rank === 1 ? 'bg-ipl-gold text-black' :
                                entry.rank === 2 ? 'bg-gray-300 text-black' : 'bg-[#CD7F32] text-black'
                                }`}>
                                {entry.rank}
                              </span>
                            ) : (
                              <span className="text-gray-500 font-mono text-xs md:text-base">{entry.rank}</span>
                            )}
                          </div>
                        </td>
                        <td className="p-2 md:p-4">
                          <div className="flex items-center gap-2 md:gap-4 overflow-hidden">
                            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full border border-white/10 overflow-hidden group-hover:border-ipl-gold transition-colors shrink-0">
                              <img src={entry.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${entry.username}`} alt={entry.username} />
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className={`text-xs md:text-sm font-display tracking-wide truncate w-full ${entry.rank <= 3 ? 'text-white' : 'text-gray-300'}`}>
                                {getUserDisplayName({ name: entry.username, alias: entry.alias, use_alias: entry.use_alias })}
                              </span>
                              <span className="text-[8px] md:text-[10px] text-gray-500 uppercase font-display tracking-tighter truncate w-full">
                                M: {entry.matches_played}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="p-2 md:p-4 hidden lg:table-cell">
                          <div className="flex items-center justify-start gap-1.5 overflow-x-auto custom-scrollbar pb-1 px-1">
                            {entry.progression?.slice(0, 10).map((prog: any, idx: number) => (
                              <div
                                key={idx}
                                className={`w-7 h-7 flex-shrink-0 flex items-center justify-center text-[10px] font-mono rounded-sm border ${prog.points >= 25 ? 'bg-green-500/20 border-green-500/30 text-green-400' :
                                  prog.points > 0 ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' :
                                    prog.points < 0 ? 'bg-red-500/20 border-red-500/30 text-red-400' :
                                      'bg-white/5 border-white/10 text-gray-500'
                                  }`}
                                title={`Earned ${prog.points} points in ${prog.teams}`}
                              >
                                {prog.points > 0 ? '+' : ''}{prog.points}
                              </div>
                            ))}
                            {(!entry.progression || entry.progression.length === 0) && (
                              <span className="text-gray-600 font-display text-[10px] uppercase opacity-40 italic">New Entrant</span>
                            )}
                          </div>
                        </td>
                        <td className="p-2 md:p-4 text-right">
                          <div className="flex flex-col items-end">
                            <span className="text-xl md:text-2xl font-display text-ipl-gold leading-none">{entry.total_points}</span>
                            <div className="flex items-center gap-1 mt-0.5">
                              {entry.base_points > 0 && (
                                <span className="text-[7px] md:text-[8px] px-1 bg-ipl-gold/10 border border-ipl-gold/30 text-ipl-gold rounded uppercase font-bold tracking-tighter">
                                  +{entry.base_points}
                                </span>
                              )}
                              <span className="text-[8px] md:text-[10px] text-gray-500 font-display uppercase tracking-widest leading-none">PTS</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-2 md:p-4 text-center">
                          <div className="flex items-center justify-center gap-2 md:gap-4">
                            {entry.powerup_balances && entry.powerup_balances.length > 0 ? (
                              entry.powerup_balances.map((bal: any, bIdx: number) => (
                                <div
                                  key={bIdx}
                                  className="flex flex-col items-center shrink-0 min-w-[24px] md:min-w-[32px]"
                                  title={`${bal.name}: ${bal.remaining}/${bal.max} left`}
                                >
                                  <span className={`text-xs md:text-sm font-display font-bold leading-none ${
                                    bal.type === 'global' ? 'text-ipl-live' : 'text-purple-400 font-extrabold'
                                  }`}>
                                    {bal.remaining}
                                  </span>
                                  <span className="text-[6px] md:text-[7px] text-gray-500 uppercase font-display tracking-tighter mt-0.5">
                                    {bal.type === 'global' ? 'GLB' : bal.name.slice(0, 3)}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <div className="flex flex-col items-center">
                                <span className="text-base md:text-lg font-display text-ipl-live">
                                  {entry.remaining_powerups !== undefined ? entry.remaining_powerups : 10}
                                </span>
                                <span className="text-[7px] md:text-[8px] text-gray-500 uppercase tracking-widest leading-none">Left</span>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {leaderboard?.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-gray-500 font-display uppercase tracking-widest opacity-30 italic">NO RANKINGS AVAILABLE YET</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Selected User Details Sidebar */}
            <div id={`progression-details-${leagueId}`} className="hidden lg:block lg:col-span-1 space-y-4">
              {renderProgressionPanel()}
            </div>
          </div>
        </>
      )}

      {/* Mobile iOS Bottom Sheet */}
      {selectedUser && (
        <div className="lg:hidden fixed inset-0 z-[60] flex items-end justify-center select-none">
          {/* Backdrop overlay */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setSelectedUser(null)}
          />
          {/* Bottom Sheet Panel */}
          <div className="w-full max-h-[80vh] bg-ipl-surface border-t border-white/10 rounded-t-[28px] shadow-2xl z-10 flex flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] animate-in slide-in-from-bottom duration-300">
            {/* Drag handle */}
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto my-3 shrink-0" />
            {/* Scrollable details content */}
            <div className="overflow-y-auto px-6 pb-8 pt-2 flex-1 scrollbar-hide">
              {renderProgressionPanel(true)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
