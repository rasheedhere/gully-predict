import React from 'react';
import { useEvents, type SystemEvent } from '../api/hooks/useEvents';
import { useNavigate } from 'react-router-dom';
import { getUserDisplayName } from '../utils/userUtils';

const timeAgo = (date: string | Date) => {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const SocialFeed: React.FC = () => {
  const { data: events, isLoading } = useEvents(15);
  const navigate = useNavigate();

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'prediction_submitted':
        return '🎯';
      case 'match_scored':
        return '📊';
      case 'league_joined':
        return '🤝';
      case 'login':
        return '👋';
      default:
        return '📢';
    }
  };

  const handleEventClick = (event: SystemEvent) => {
    if (event.match_id) {
      navigate(`/match/${event.match_id}`);
    }
  };

  const renderTime = (timestamp: string) => {
    try {
      return timeAgo(timestamp);
    } catch (e) {
      return 'just now';
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-1 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-white/5 rounded-2xl border border-white/5" />
        ))}
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4 text-center px-6">
        <div className="text-4xl select-none">🏏</div>
        <div>
          <p className="text-white font-display text-xs uppercase tracking-widest font-bold">The Arena is Quiet</p>
          <p className="text-gray-500 text-xs mt-2 leading-relaxed max-w-[200px] mx-auto">
            Be the first to make a prediction and spark the leaderboard!
          </p>
        </div>
        <a
          href="/matchcenter"
          className="mt-1 px-5 py-2.5 rounded-full border border-ipl-gold/30 text-ipl-gold font-display text-[10px] uppercase tracking-widest hover:bg-ipl-gold/10 transition-colors"
        >
          View Matches →
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 p-1 overflow-y-auto max-h-[600px] scrollbar-hide select-none">
      {events.map((event) => (
        <div
          key={event.id}
          onClick={() => handleEventClick(event)}
          className={`
            flex gap-3.5 p-3.5 rounded-[18px] border transition-all duration-100 select-none
            ${event.match_id ? 'bg-white/5 border-white/5 active:bg-white/10 active:scale-[0.98] cursor-pointer' : 'bg-white/5 border-white/5'}
          `}
        >
          {/* Avatar and Event Icon Badge */}
          <div className="relative shrink-0 select-none">
            {event.user_avatar ? (
              <img
                src={event.user_avatar}
                alt={event.username}
                className="w-10 h-10 rounded-full border border-white/20 shadow-md object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-ipl-navy to-ipl-gold/20 flex items-center justify-center border border-white/20">
                <span className="text-sm font-bold text-ipl-gold">
                  {getUserDisplayName({ name: event.username, alias: event.alias ?? undefined, use_alias: event.use_alias }).charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#161B2E] border border-white/10 flex items-center justify-center text-[10px] shadow-sm select-none">
              {getEventIcon(event.event_type)}
            </div>
          </div>

          {/* Event description and details */}
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-bold text-white text-sm truncate leading-none">
                {getUserDisplayName({ name: event.username, alias: event.alias ?? undefined, use_alias: event.use_alias })}
              </span>
              <span className="text-[9px] text-gray-500 font-mono whitespace-nowrap shrink-0">
                {renderTime(event.timestamp)}
              </span>
            </div>
            <p className="text-xs text-gray-300 leading-snug break-words mt-1">
              {event.message.replace(event.username, getUserDisplayName({ name: event.username, alias: event.alias ?? undefined, use_alias: event.use_alias }))}
            </p>
          </div>

          {event.match_id && (
            <div className="flex items-center text-gray-500 shrink-0 self-center">
              <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-ipl-gold">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default SocialFeed;
