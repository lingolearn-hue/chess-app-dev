import { useEffect, useRef } from 'react';

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`;
}

interface ClockProps {
  label: string;
  seconds: number;
  active: boolean;
  flipped?: boolean;
  paused: boolean;
  onPauseToggle: () => void;
  onHintToggle: () => void;
  hintActive: boolean;
  hintDisabled: boolean;
}

export function ClockDisplay({
  label,
  seconds,
  active,
  flipped,
  paused,
  onPauseToggle,
  onHintToggle,
  hintActive,
  hintDisabled,
}: ClockProps) {
  const low = seconds <= 30;
  return (
    <div className={`clock ${active ? 'active' : ''} ${low ? 'low' : ''} ${flipped ? 'flipped' : ''}`} aria-label={label}>
      <span className="clock-time">{formatTime(seconds)}</span>
      <button
        className={`hint-btn ${hintActive ? 'hint-btn-active' : ''}`}
        onClick={onHintToggle}
        disabled={hintDisabled}
        aria-label="Hint"
      >
        💡
      </button>
      <button className="pause-btn" onClick={onPauseToggle} aria-label={paused ? 'Resume' : 'Pause'}>
        {paused ? '▶' : '⏸'}
      </button>
    </div>
  );
}

interface UseClockArgs {
  active: 'white' | 'black' | null;
  paused: boolean;
  // Called once per second; returns the color that just ran out, or null.
  onTick: () => 'white' | 'black' | null;
  onFlagFall: (color: 'white' | 'black') => void;
}

// Drives the ticking of whichever clock is active, once per second.
export function useClockTicker({ active, paused, onTick, onFlagFall }: UseClockArgs) {
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (!active || paused) return;

    intervalRef.current = window.setInterval(() => {
      const flagged = onTick();
      if (flagged) onFlagFall(flagged);
    }, 1000);

    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, paused]);
}
