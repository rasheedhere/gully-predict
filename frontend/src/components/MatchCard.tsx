import { Link } from 'react-router-dom';
import CountdownTimer from './CountdownTimer';
import { MapPin, CheckCircle2, AlertCircle } from 'lucide-react';
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
}

export default function MatchCard({ id, team1, team2, venue, tossTime, status, has_predicted }: MatchCardProps) {
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
    <div className={`glass-panel p-6 relative flex flex-col justify-between group overflow-hidden transition-all duration-500 border-2 ${status === 'upcoming' && !user?.is_guest && !isLocked
        ? has_predicted
          ? 'border-green-500/30 hover:border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.05)]'
          : 'border-ipl-gold/20 hover:border-ipl-gold shadow-[0_0_20px_rgba(255,215,0,0.05)]'
        : 'border-white/5 hover:border-white/20'
      }`}>
      {status === 'live' && (
        <div className="absolute top-0 right-0 bg-ipl-live text-white font-display text-xs tracking-widest px-3 py-1 shadow-[0_0_10px_#E84040] animate-pulse z-20">
          LIVE
        </div>
      )}

      {status === 'upcoming' && !user?.is_guest && !isLocked && (
        <div className={`absolute top-0 right-0 font-display text-[10px] tracking-widest px-3 py-1 z-20 flex items-center gap-1.5 shadow-lg ${has_predicted
            ? 'bg-green-500 text-white shadow-green-500/20'
            : 'bg-ipl-gold text-black shadow-ipl-gold/20'
          }`}>
          {has_predicted ? (
            <>
              <CheckCircle2 className="w-3 h-3" />
              PREDICTED
            </>
          ) : (
            <>
              <AlertCircle className="w-3 h-3 animate-pulse" />
              PENDING
            </>
          )}
        </div>
      )}

      <div className="flex justify-between items-center mb-8 relative z-10 w-full gap-4">
        <div className="flex flex-col items-center flex-1 gap-3 min-w-0">
          <div 
            className="w-20 h-20 rounded-2xl flex items-center justify-center border-2 shadow-lg overflow-hidden p-2.5 bg-black/40 group-hover:scale-105 transition-transform duration-500 shrink-0"
            style={{ borderColor: `${t1Color}40`, boxShadow: `0 0 20px ${t1Color}20`, backgroundColor: `${t1Color}10` }}
          >
            {t1Logo ? (
              <img src={t1Logo} alt={team1} className="w-full h-full object-contain" />
            ) : (
              <span className="text-xl font-bold text-white font-display">{t1Short}</span>
            )}
          </div>
          <span className="text-lg font-display text-center leading-tight transition-colors group-hover:text-ipl-gold truncate w-full" style={{ color: t1Color }}>
            {team1}
          </span>
        </div>

        <div className="text-gray-600 font-display text-base italic flex flex-col items-center shrink-0">
          <span className="tracking-[0.3em] opacity-30">VS</span>
          <div className="w-[1px] h-12 bg-gradient-to-b from-transparent via-white/10 to-transparent mt-2" />
        </div>

        <div className="flex flex-col items-center flex-1 gap-3 min-w-0">
          <div 
            className="w-20 h-20 rounded-2xl flex items-center justify-center border-2 shadow-lg overflow-hidden p-2.5 bg-black/40 group-hover:scale-105 transition-transform duration-500 shrink-0"
            style={{ borderColor: `${t2Color}40`, boxShadow: `0 0 20px ${t2Color}20`, backgroundColor: `${t2Color}10` }}
          >
            {t2Logo ? (
              <img src={t2Logo} alt={team2} className="w-full h-full object-contain" />
            ) : (
              <span className="text-xl font-bold text-white font-display">{t2Short}</span>
            )}
          </div>
          <span className="text-lg font-display text-center leading-tight transition-colors group-hover:text-ipl-gold truncate w-full" style={{ color: t2Color }}>
            {team2}
          </span>
        </div>
      </div>

      <div className="mb-6 space-y-2 relative z-10">
        <div className="flex items-center gap-3">
          {matchNumber && (
            <span className="text-[10px] bg-white/10 border border-white/5 text-white/70 font-mono px-2 py-0.5 rounded tracking-widest uppercase">
              Match {matchNumber}
            </span>
          )}
          <p className="text-sm text-gray-400 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-white/40" />
            {venue}
          </p>
        </div>
        {status !== 'completed' && <CountdownTimer targetDate={tossTime} />}
      </div>

      <Link
        to={`/match/${id}`}
        className={`w-full text-center font-display uppercase tracking-widest py-3 border transition-all z-10 relative ${status === 'upcoming' && !user?.is_guest && !isLocked
            ? has_predicted
              ? 'bg-green-500/10 hover:bg-green-500 text-green-400 hover:text-white border-green-500/30'
              : 'bg-ipl-gold/10 hover:bg-ipl-gold text-ipl-gold hover:text-black border-ipl-gold/30'
            : 'bg-white/5 hover:bg-white hover:text-black text-white border-white/20'
          }`}
      >
        {status === 'upcoming' && !isLocked
          ? (user?.is_guest ? 'View Match' : (has_predicted ? 'Update Prediction' : 'Submit Prediction'))
          : 'View Match'}
      </Link>
    </div>
  );
}
