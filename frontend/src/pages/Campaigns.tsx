import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Megaphone, CheckCircle, Lock, Trophy, Star, Hash } from 'lucide-react';
import { useCampaigns, type Campaign } from '../api/hooks/useCampaigns';
import { CampaignCountdown } from '../components/CampaignCountdown';
import { useTournamentStore } from '../store/tournament';

function StatusBadge({ status }: { status: Campaign['status'] }) {
  if (status === 'active') {
    return (
      <span className="flex items-center gap-1.5 text-[10px] font-display uppercase tracking-widest text-ipl-live">
        <span className="w-1.5 h-1.5 rounded-full bg-ipl-live animate-pulse" />
        Live
      </span>
    );
  }
  if (status === 'closed') {
    return (
      <span className="flex items-center gap-1.5 text-[10px] font-display uppercase tracking-widest text-gray-500">
        <Lock className="w-3 h-3" />
        Closed
      </span>
    );
  }
  return null;
}

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const navigate = useNavigate();
  const hasResponded = !!campaign.my_response;
  const isClosed = campaign.status === 'closed' || (campaign.ends_at ? new Date(campaign.ends_at) <= new Date() : false);

  return (
    <button
      onClick={() => navigate(`/campaigns/${campaign.id}`)}
      className={`glass-panel p-5 text-left w-full border-2 transition-all duration-300 group relative overflow-hidden flex flex-col h-full rounded-[22px] active:scale-[0.98] select-none ${
        hasResponded && !isClosed
          ? 'border-green-500/20 hover:border-green-500/40 shadow-[0_0_20px_rgba(34,197,94,0.05)]'
          : 'border-white/5 hover:border-white/10'
      }`}
    >
      {/* Top Section: Icon & Badges */}
      <div className="flex items-start justify-between w-full mb-4">
        <div className="p-2.5 bg-ipl-gold/10 rounded-xl group-hover:bg-ipl-gold/20 transition-colors shrink-0">
          {campaign.type === 'match' ? <Trophy className="w-4 h-4 text-ipl-gold" /> : <Star className="w-4 h-4 text-ipl-gold" />}
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          {hasResponded && (
            <span className="bg-green-500 text-white font-display text-[9px] font-bold tracking-widest px-2.5 py-1 flex items-center gap-1 rounded-bl-xl shadow-lg -mr-5 -mt-5">
              <CheckCircle className="w-3 h-3" />
              LOCKED
            </span>
          )}
          <div className={`${hasResponded ? 'mt-1' : ''}`}>
            <StatusBadge status={campaign.status} />
          </div>
        </div>
      </div>

      {/* Middle Section: Title & Info */}
      <div className="flex-1 w-full">
        <span className="text-[9px] font-display uppercase tracking-widest text-gray-500 mb-1 inline-block">
          {campaign.type}
        </span>

        <h3 className="text-white font-display text-lg mb-1.5 group-hover:text-ipl-gold transition-colors leading-tight uppercase font-bold">
          {campaign.title}
        </h3>

        {campaign.description && (
          <p className="text-gray-500 text-xs mb-4 line-clamp-2 leading-relaxed">{campaign.description}</p>
        )}
      </div>

      {/* Bottom Section: Meta Data */}
      <div className="mt-auto pt-4 border-t border-white/5 space-y-3 w-full">
        {campaign.ends_at && campaign.status === 'active' && !isClosed && (
          <div className="flex items-center justify-center gap-2 text-[9px] text-gray-400 font-display uppercase tracking-widest bg-white/[0.03] px-2.5 py-1.5 rounded-xl border border-white/5">
            <CampaignCountdown endsAt={campaign.ends_at} />
          </div>
        )}

        <div className="flex items-center justify-between text-[10px] text-gray-500 font-display uppercase tracking-widest">
          <span className="flex items-center gap-1">
            <Hash className="w-3.5 h-3.5 opacity-40 text-ipl-gold" />
            {campaign.questions.length} question{campaign.questions.length !== 1 ? 's' : ''}
          </span>
          {hasResponded && isClosed && campaign.my_response?.total_points != null && (
            <span className="text-ipl-gold font-bold">{campaign.my_response.total_points} pts</span>
          )}
        </div>
      </div>
    </button>
  );
}

export default function Campaigns() {
  const { activeTournamentId } = useTournamentStore();
  const { data: campaigns, isLoading, error } = useCampaigns(activeTournamentId || undefined);
  const [activeTab, setActiveTab] = useState<'active' | 'past'>('active');

  if (isLoading) {
    return (
      <div className="text-white text-center font-display tracking-widest animate-pulse mt-20">
        LOADING CAMPAIGNS...
      </div>
    );
  }
  if (error) {
    return (
      <div className="text-ipl-live text-center font-display tracking-widest mt-20">
        FAILED TO LOAD CAMPAIGNS
      </div>
    );
  }

  const now = new Date().getTime();

  const active = campaigns?.filter(c => {
    if (c.type === 'match') return false;
    if (c.status !== 'active') return false;
    if (c.ends_at && new Date(c.ends_at).getTime() < now) return false;
    return true;
  }) ?? [];

  const past = campaigns?.filter(c => {
    if (c.type === 'match') return false;
    if (c.status === 'closed') return true;
    if (c.ends_at && new Date(c.ends_at).getTime() < now) return true;
    return false;
  }) ?? [];

  return (
    <div className="space-y-8 md:space-y-12 w-full max-w-full mx-auto pb-20 select-none">
      {/* Header (Hidden on Mobile) */}
      <header className="hidden md:flex flex-col md:flex-row md:items-end justify-between border-b border-white/10 pb-8 gap-4">
        <div>
          <h1 className="text-4xl font-display text-white flex items-center gap-3 italic uppercase tracking-tighter">
            <Megaphone className="w-10 h-10 text-ipl-gold drop-shadow-[0_0_15px_rgba(244,196,48,0.4)]" />
            CAMPAIGNS
          </h1>
          <p className="text-gray-400 mt-2 font-display uppercase tracking-widest text-xs opacity-60">
            Predict, answer, and earn bonus points
          </p>
        </div>
      </header>

      {/* Tab Switcher (Styled as iOS Segmented Control) */}
      <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 w-full md:w-fit shrink-0 self-start md:self-end">
        <button
          onClick={() => setActiveTab('active')}
          className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase transition-all duration-200 font-display tracking-widest ${
            activeTab === 'active'
              ? 'bg-ipl-gold text-ipl-navy shadow-neon shadow-ipl-gold/10'
              : 'text-gray-500 active:text-gray-300'
          }`}
        >
          Active ({active.length})
        </button>
        <button
          onClick={() => setActiveTab('past')}
          className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase transition-all duration-200 font-display tracking-widest ${
            activeTab === 'past'
              ? 'bg-ipl-gold text-ipl-navy shadow-neon shadow-ipl-gold/10'
              : 'text-gray-500 active:text-gray-300'
          }`}
        >
          History ({past.length})
        </button>
      </div>

      {/* Content */}
      <section className="space-y-6 w-full">
        {activeTab === 'active' ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {active.length === 0 ? (
              <div className="glass-panel p-10 text-center border-dashed border-2 border-white/5 opacity-50 col-span-full rounded-2xl">
                <p className="text-gray-500 font-display text-xs uppercase tracking-[0.2em]">
                  No active campaigns right now
                </p>
              </div>
            ) : (
              active.map(c => <CampaignCard key={c.id} campaign={c} />)
            )}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {past.length === 0 ? (
              <div className="glass-panel p-10 text-center border-dashed border-2 border-white/5 opacity-50 col-span-full rounded-2xl">
                <p className="text-gray-500 font-display text-xs uppercase tracking-[0.2em]">
                  No past campaigns found
                </p>
              </div>
            ) : (
              past.map(c => <CampaignCard key={c.id} campaign={c} />)
            )}
          </div>
        )}
      </section>
    </div>
  );
}
