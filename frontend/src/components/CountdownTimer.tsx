import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface CountdownTimerProps {
  targetDate: string; // ISO string
}

export default function CountdownTimer({ targetDate }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [urgent, setUrgent] = useState(false);

  useEffect(() => {
    if (!targetDate) {
      setTimeLeft('TBD');
      return;
    }

    const lockDate = new Date(targetDate);
    if (isNaN(lockDate.getTime())) {
      setTimeLeft('TBD');
      return;
    }

    const lockTime = lockDate.getTime() - 30 * 60 * 1000;

    const updateTimer = () => {
      const now = new Date().getTime();
      const distance = lockTime - now;

      if (distance < 0) {
        setTimeLeft('LOCKED');
        setIsLocked(true);
        setUrgent(false);
        return true;
      }

      const hours = Math.floor(distance / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      setUrgent(distance < 60 * 60 * 1000);
      return false;
    };

    // Run immediately so we don't have a 1-second blank flash
    const isAlreadyLocked = updateTimer();
    if (isAlreadyLocked) return;

    const interval = setInterval(() => {
      const locked = updateTimer();
      if (locked) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  return (
    <div className={`flex items-center gap-2 font-display tracking-widest text-sm
      ${isLocked ? 'text-ipl-live' : urgent ? 'text-ipl-live animate-pulse' : 'text-ipl-gold'}`}
    >
      <Clock className="w-4 h-4" />
      {isLocked ? 'PREDICTIONS LOCKED' : `LOCKS IN: ${timeLeft}`}
    </div>
  );
}
