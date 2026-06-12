import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Megaphone, ChevronRight, Check } from 'lucide-react';
import { useAnnouncements, useMarkAnnouncementsRead } from '../api/hooks/useAnnouncements';
import { useAuthStore } from '../store/auth';

export default function Hub() {
  const navigate = useNavigate();
  const { data: announcements, isLoading } = useAnnouncements();
  const { mutate: markRead, isPending: isMarkingRead } = useMarkAnnouncementsRead();
  const { user } = useAuthStore();
  const [shouldShow, setShouldShow] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isLoading && announcements) {
      const activeAnnouncements = announcements.filter(a => a.is_active);
      if (activeAnnouncements.length === 0) {
        navigate('/matchcenter', { replace: true });
        return;
      }
      
      const latestAnnouncementTime = new Date(activeAnnouncements[0].created_at).getTime();
      const userLastReadTime = user?.last_read_announcements_at ? new Date(user.last_read_announcements_at).getTime() : 0;
      
      if (latestAnnouncementTime <= userLastReadTime) {
        navigate('/matchcenter', { replace: true });
      } else {
        setShouldShow(true);
      }
    }
  }, [announcements, isLoading, navigate, user?.last_read_announcements_at]);

  if (shouldShow === null || isLoading) {
    return <div className="text-white text-center font-display tracking-widest animate-pulse mt-20">LOADING...</div>;
  }

  const activeAnnouncements = announcements?.filter(a => a.is_active) || [];

  const handleContinue = () => {
    markRead(undefined, {
      onSuccess: () => navigate('/matchcenter')
    });
  };

  const handleAction = (url: string) => {
    markRead(undefined, {
      onSuccess: () => navigate(url)
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-2xl mx-auto pb-24">
      <header className="text-center space-y-4">
        <div className="inline-flex items-center justify-center p-3 bg-ipl-gold/10 rounded-full mb-2 ring-1 ring-ipl-gold/20 shadow-[0_0_30px_rgba(255,215,0,0.15)]">
          <Megaphone className="w-8 h-8 text-ipl-gold" />
        </div>
        <h1 className="text-3xl md:text-4xl font-display text-white tracking-widest uppercase text-shadow-glow">
          Announcements
        </h1>
      </header>

      <div className="space-y-6">
        {activeAnnouncements.map(announcement => (
          <div key={announcement.id} className="glass-panel p-6 border-l-4 border-ipl-gold relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-ipl-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10 space-y-4">
              <div className="flex justify-between items-start">
                <h3 className="text-xl font-display text-white tracking-wider font-bold">
                  {announcement.title}
                </h3>
                <span className="text-xs text-gray-500 font-mono">
                  {new Date(announcement.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="text-gray-300 font-display text-sm leading-relaxed whitespace-pre-wrap">
                {announcement.content}
              </p>
              {announcement.action_label && announcement.action_url && (
                <button
                  onClick={() => handleAction(announcement.action_url!)}
                  className="mt-4 w-full py-3 bg-ipl-gold/20 hover:bg-ipl-gold/30 text-ipl-gold border border-ipl-gold/50 rounded-xl font-display font-bold tracking-widest uppercase transition-all flex items-center justify-center gap-2"
                >
                  {announcement.action_label}
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/80 to-transparent z-50">
        <div className="max-w-2xl mx-auto pb-[env(safe-area-inset-bottom)]">
          <button
            onClick={handleContinue}
            disabled={isMarkingRead}
            className="w-full py-4 bg-white/10 hover:bg-white/20 text-white backdrop-blur-md rounded-2xl font-display font-bold tracking-widest uppercase transition-all border border-white/20 flex items-center justify-center gap-2 shadow-xl"
          >
            {isMarkingRead ? 'Processing...' : 'Skip / Continue to App'}
            {!isMarkingRead && <Check className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
