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

      if (hours > 0) {
        setTimeLeft(`${hours}h ${String(minutes).padStart(2, '0')}m`);
      } else {
        setTimeLeft(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
      }
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

  if (isLocked) return null;

  return (
    <div className={`flex items-center gap-1.5 font-display tracking-wider text-sm font-bold
      ${urgent ? 'text-ipl-live animate-pulse' : 'text-ipl-gold/80'}`}
    >
      <Clock className="w-3.5 h-3.5 shrink-0" />
      <span>LOCKS IN: {timeLeft}</span>
    </div>
  );
}
