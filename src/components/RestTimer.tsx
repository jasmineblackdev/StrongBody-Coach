import { useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipForward, Plus, Minus, X } from 'lucide-react';
import { Pill } from './ui';
import { bumpRestOverride } from '../lib/restTimer';

interface Props {
  /** Display label, e.g. "Resting — Back Squat". */
  label: string;
  /** The exercise name used to persist a personalized override. */
  exerciseName: string;
  /** Recommended rest in seconds when the timer first arms. */
  recommendedSeconds: number;
  /**
   * The starting timestamp ID — when this changes, the timer resets and
   * auto-starts. Set this to a fresh value (e.g., Date.now()) every time
   * a new set is logged so the timer rearms without stale state.
   */
  armedAt: number | null;
  onSkip?: () => void;
  onComplete?: () => void;
  /** Hide the panel. */
  onDismiss?: () => void;
}

function formatMmSs(sec: number): string {
  const m = Math.max(0, Math.floor(sec / 60));
  const s = Math.max(0, sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function vibrate(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* not available — fail silent */
    }
  }
}

/**
 * Subtle two-tone beep using WebAudio. No imported audio files. Browsers
 * gate audio start on user gesture — this fires inside a setInterval that
 * ran from a user-initiated state change, so it usually clears the gate.
 */
function beep(): void {
  if (typeof window === 'undefined') return;
  const W = window as Window & {
    webkitAudioContext?: typeof AudioContext;
  };
  const Ctx = window.AudioContext ?? W.webkitAudioContext;
  if (!Ctx) return;
  try {
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 880;
    g.gain.value = 0.0001;
    o.connect(g);
    g.connect(ctx.destination);
    const now = ctx.currentTime;
    g.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    o.start(now);
    o.stop(now + 0.5);
    o.onended = () => ctx.close().catch(() => undefined);
  } catch {
    /* audio init failed — silent */
  }
}

export default function RestTimer({
  label,
  exerciseName,
  recommendedSeconds,
  armedAt,
  onSkip,
  onComplete,
  onDismiss,
}: Props) {
  const [target, setTarget] = useState(recommendedSeconds);
  const [remaining, setRemaining] = useState(recommendedSeconds);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [skippedEarly, setSkippedEarly] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const completedRef = useRef(false);

  // Track manual adjustments vs the recommendation so we can persist a
  // per-exercise override when the timer eventually completes.
  const adjustmentRef = useRef(0);

  // Re-arm whenever a new set is logged (armedAt bumps).
  useEffect(() => {
    if (armedAt === null) return;
    setTarget(recommendedSeconds);
    setRemaining(recommendedSeconds);
    setDone(false);
    setSkippedEarly(false);
    setRunning(true);
    completedRef.current = false;
    adjustmentRef.current = 0;
  }, [armedAt, recommendedSeconds]);

  // Tick.
  useEffect(() => {
    if (!running) return;
    intervalRef.current = window.setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          if (!completedRef.current) {
            completedRef.current = true;
            vibrate([180, 80, 180]);
            beep();
            // Persist a small override so future timers learn from how the
            // user adjusted today.
            if (adjustmentRef.current !== 0) {
              bumpRestOverride(exerciseName, adjustmentRef.current);
            }
            onComplete?.();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [running, exerciseName, onComplete]);

  // Stop ticking when we've hit zero.
  useEffect(() => {
    if (remaining === 0 && running) {
      setRunning(false);
      setDone(true);
    }
  }, [remaining, running]);

  function adjust(delta: number) {
    setRemaining((prev) => Math.max(5, prev + delta));
    setTarget((prev) => Math.max(5, prev + delta));
    adjustmentRef.current += delta;
  }

  function toggle() {
    setRunning((r) => !r);
  }

  function skip() {
    if (remaining > 0) {
      setSkippedEarly(true);
    }
    setRunning(false);
    setRemaining(0);
    setDone(true);
    onSkip?.();
  }

  if (armedAt === null) return null;

  const pct = target > 0 ? (1 - remaining / target) * 100 : 100;

  return (
    <div
      className="sticky z-40 mx-auto w-full max-w-md rounded-2xl border-2 border-accent/40 bg-ink-900/95 p-4 shadow-glow backdrop-blur bottom-20 md:bottom-2"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-rose-glow">
            {done && skippedEarly ? 'Timer skipped early' : done ? 'Ready for next set' : 'Resting'}
          </div>
          <div className="truncate text-sm font-semibold text-zinc-100">{label}</div>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            aria-label="Dismiss timer"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-ink-700 text-zinc-400 hover:bg-ink-800"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Big readable countdown — designed for arm's-length glance */}
      <div className="mt-2 flex items-baseline justify-center gap-2">
        <span
          className={`font-display text-5xl font-bold tabular-nums tracking-tight ${
            done ? 'text-success' : 'text-zinc-100'
          }`}
        >
          {formatMmSs(remaining)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-800">
        <div
          className={`h-full transition-all ${done ? 'bg-success' : 'bg-accent'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Controls — large finger-targets for gym use */}
      <div className="mt-3 grid grid-cols-5 gap-2">
        <button
          onClick={() => adjust(-15)}
          className="inline-flex items-center justify-center rounded-xl border border-ink-700 bg-ink-850 px-2 py-3 text-sm font-semibold text-zinc-200 hover:bg-ink-800 active:scale-95"
          aria-label="Subtract 15 seconds"
        >
          <Minus size={14} className="mr-1" />
          15
        </button>
        <button
          onClick={toggle}
          className={`inline-flex items-center justify-center rounded-xl px-2 py-3 text-sm font-semibold col-span-2 active:scale-95 ${
            running
              ? 'border border-warning/40 bg-warning/15 text-warning'
              : 'bg-accent text-white shadow-glow'
          }`}
        >
          {running ? <Pause size={16} /> : <Play size={16} />}
          <span className="ml-1.5">{running ? 'Pause' : done ? 'Restart' : 'Start'}</span>
        </button>
        <button
          onClick={() => adjust(15)}
          className="inline-flex items-center justify-center rounded-xl border border-ink-700 bg-ink-850 px-2 py-3 text-sm font-semibold text-zinc-200 hover:bg-ink-800 active:scale-95"
          aria-label="Add 15 seconds"
        >
          <Plus size={14} className="mr-1" />
          15
        </button>
        <button
          onClick={skip}
          className="inline-flex items-center justify-center rounded-xl border border-ink-700 bg-ink-850 px-2 py-3 text-sm font-semibold text-zinc-200 hover:bg-ink-800 active:scale-95"
          aria-label="Skip rest"
        >
          <SkipForward size={14} className="mr-1" />
          Skip
        </button>
      </div>

      {done && skippedEarly && (
        <div className="mt-2 rounded-lg border border-warning/30 bg-warning/10 p-2 text-xs text-warning">
          You may not be fully recovered. Bar speed will tell you the truth on the next set.
        </div>
      )}

      <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
        <span>Recommended {formatMmSs(target)}</span>
        <Pill>{adjustmentRef.current === 0 ? 'auto' : `${adjustmentRef.current > 0 ? '+' : ''}${adjustmentRef.current}s`}</Pill>
      </div>
    </div>
  );
}
