import { Link } from 'react-router-dom';
import CountdownTimer from './CountdownTimer';
import { MapPin, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { getTeamColor, getTeamShortName } from '../utils/teamColors';
import { getTeamLogo } from '../utils/teamLogos';

interface MatchCardProps {
  id: string;
  team1: string;
  team2: string;
  venue: string;
  tossTime: string;
  status: 'upcoming' | 'live' | 'completed';
  has_predicted?: boolean;
  tournament?: { id: string; name: string };
}

export default function MatchCard({ id, team1, team2, venue, tossTime, status, has_predicted, tournament }: MatchCardProps) {
  const { user } = useAuthStore();
  const t1Color = getTeamColor(team1);
  const t2Color = getTeamColor(team2);
  const t1Logo = getTeamLogo(team1);
  const t2Logo = getTeamLogo(team2);
  const t1Short = getTeamShortName(team1);
  const t2Short = getTeamShortName(team2);

  const matchNoMatch = id.match(/ipl-\d{4}-(\d+)/);
  const matchNumber = matchNoMatch ? matchNoMatch[1] : null;

  const startDate = new Date(tossTime);
  const isLocked = new Date() > new Date(startDate.getTime() - 30 * 60000);

  return (
    <Link to={`/match/${id}`} className={`block relative group overflow-hidden transition-all duration-300 rounded-[2rem] border border-white/5 glass-panel backdrop-blur-md hover:bg-white/[0.02] ${status === 'upcoming' && !user?.is_guest && !isLocked
        ? has_predicted
          ? 'hover:border-green-500/20'
          : 'hover:border-ipl-gold/20'
        : 'hover:border-white/10'
      }`}>
      
      <div className="p-6 md:p-8 flex flex-col items-center justify-between h-full min-h-[220px]">
        
        {/* Top Header */}
        <div className="w-full flex justify-center items-center mb-8 relative">
          <div className="flex flex-col items-center">
            {tournament && <span className="text-[10px] md:text-[11px] font-display font-bold text-ipl-gold mb-1 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded border border-ipl-gold/20">{tournament.name}</span>}
            {matchNumber && <span className="text-[10px] md:text-xs font-display tracking-[0.3em] uppercase text-gray-400">Match {matchNumber}</span>}
          </div>
          {status === 'live' && (
            <span className="absolute right-0 top-1/2 -translate-y-1/2 text-[9px] font-display uppercase tracking-widest px-2 py-0.5 rounded bg-[#E84040]/10 text-[#E84040] animate-pulse">LIVE</span>
          )}
          {status === 'upcoming' && !user?.is_guest && !isLocked && (
            <div className={`absolute right-0 top-1/2 -translate-y-1/2 font-mono text-[9px] uppercase tracking-widest ${has_predicted ? 'text-green-500/80' : 'text-ipl-gold/80'}`}>
              {has_predicted ? 'PREDICTED' : 'PENDING'}
            </div>
          )}
        </div>

        {/* Center Teams Layout */}
        <div className="flex items-center justify-center gap-6 md:gap-12 w-full">
           {/* Team 1 */}
           <div className="flex flex-col items-center gap-4 group-hover:scale-105 transition-transform duration-500">
              <div 
                className="w-20 h-20 md:w-24 md:h-24 rounded-2xl flex items-center justify-center border-2 shadow-lg overflow-hidden p-2 bg-black/40"
                style={{ borderColor: `${t1Color}40`, boxShadow: `0 0 20px ${t1Color}20`, backgroundColor: `${t1Color}10` }}
              >
                {t1Logo ? (
                  <img src={t1Logo} alt={team1} className="w-full h-full object-contain" />
                ) : (
                  <span className="text-2xl font-display text-white">{t1Short}</span>
                )}
              </div>
              <span className="text-xl md:text-2xl font-display font-bold tracking-tight" style={{ color: t1Color }}>{t1Short}</span>
           </div>

           {/* VS */}
           <div className="flex flex-col items-center justify-center px-2">
              <span className="text-[10px] md:text-xs font-display italic tracking-[0.4em] text-white/30 mb-2">VS</span>
              <div className="w-[1px] h-8 md:h-12 bg-gradient-to-b from-transparent via-white/20 to-transparent" />
           </div>

           {/* Team 2 */}
           <div className="flex flex-col items-center gap-4 group-hover:scale-105 transition-transform duration-500">
              <div 
                className="w-20 h-20 md:w-24 md:h-24 rounded-2xl flex items-center justify-center border-2 shadow-lg overflow-hidden p-2 bg-black/40"
                style={{ borderColor: `${t2Color}40`, boxShadow: `0 0 20px ${t2Color}20`, backgroundColor: `${t2Color}10` }}
              >
                {t2Logo ? (
                  <img src={t2Logo} alt={team2} className="w-full h-full object-contain" />
                ) : (
                  <span className="text-2xl font-display text-white">{t2Short}</span>
                )}
              </div>
              <span className="text-xl md:text-2xl font-display font-bold tracking-tight" style={{ color: t2Color }}>{t2Short}</span>
           </div>
        </div>

        {/* Footer */}
        <div className="mt-8 flex flex-col items-center gap-2 w-full relative">
          <div className="flex items-center justify-center gap-1.5 text-[10px] uppercase font-display tracking-widest text-gray-400">
             <MapPin className="w-3.5 h-3.5 text-ipl-gold/70" />
             {venue}
          </div>
          {status !== 'completed' && (
            <div className="text-[10px] text-white/50 font-mono tracking-widest mt-1 text-center w-full">
               <CountdownTimer targetDate={tossTime} />
            </div>
          )}
          
          {/* Subtle Hover Arrow */}
          <ArrowRight className="absolute right-0 bottom-0 w-4 h-4 text-white/10 group-hover:text-white/40 transition-all duration-300 group-hover:-rotate-45" />
        </div>
      </div>
    </Link>
  );
}
