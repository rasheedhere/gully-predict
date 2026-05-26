import React from 'react';
import SocialFeed from '../components/SocialFeed';
import { Activity as ActivityIcon, ShieldAlert, Eye } from 'lucide-react';

const Activity: React.FC = () => {
  return (
    <div className="w-full max-w-xl mx-auto space-y-6 md:space-y-8 select-none">
      {/* Header (Hidden on Mobile) */}
      <div className="hidden md:flex flex-col gap-2">
        <h1 className="text-3xl font-display font-bold text-ipl-gold flex items-center gap-3 italic uppercase tracking-tighter">
          <ActivityIcon className="w-8 h-8" />
          Platform Activity
        </h1>
        <p className="text-gray-400 mt-1 uppercase text-[10px] tracking-[0.3em] font-display">
          Stay updated with predictions, league joins, and match results.
        </p>
      </div>

      {/* Social Feed Container (Borderless & Full Bleed on Mobile) */}
      <div className="bg-transparent md:bg-ipl-surface/50 md:backdrop-blur-xl md:rounded-3xl md:border md:border-white/5 overflow-hidden shadow-2xl">
        <div className="hidden md:block p-6 border-b border-white/5 bg-white/5">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Recent Events
            <span className="text-xs font-normal text-white/40 bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
              Live
            </span>
          </h2>
        </div>
        <div className="p-0 md:p-4">
          <SocialFeed />
        </div>
      </div>

      {/* Info Sections (iOS Grouped Layout panels) */}
      <div className="grid grid-cols-1 gap-4">
        <div className="p-5 bg-white/5 rounded-[22px] border border-white/10">
          <h3 className="text-sm font-display font-bold text-white mb-3 flex items-center gap-2 uppercase tracking-wider">
            <Eye className="w-4 h-4 text-ipl-gold shrink-0" />
            Visibility Settings
          </h3>
          <ul className="text-xs text-gray-400 space-y-2.5">
            <li className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-ipl-gold shrink-0 mt-1.5" />
              <span>You see your own activity across all matches.</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-ipl-gold shrink-0 mt-1.5" />
              <span>You see activity from users who share a league with you.</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-ipl-gold shrink-0 mt-1.5" />
              <span>Global match results and platform updates are public.</span>
            </li>
          </ul>
        </div>
        
        <div className="p-5 bg-white/5 rounded-[22px] border border-white/10">
          <h3 className="text-sm font-display font-bold text-white mb-3 flex items-center gap-2 uppercase tracking-wider">
            <ShieldAlert className="w-4 h-4 text-ipl-live shrink-0" />
            Privacy & Auditing
          </h3>
          <p className="text-xs text-gray-400 leading-relaxed">
            League admins have oversight of activity within their specific leagues. Global admins can view all platform telemetry for auditing and support purposes.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Activity;
