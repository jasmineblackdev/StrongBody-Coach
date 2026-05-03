import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Clock,
  Heart,
  Play,
} from 'lucide-react';
import { Card, Pill, SectionHeader } from './ui';
import {
  getCoreCardioSession,
  HOME_DAY_LABEL,
} from '../lib/coreCardioPlan';
import { store } from '../lib/storage';
import { useStoreVersion } from '../hooks/useStore';

/**
 * Today's Home Core + Cardio session, when today's a rest day. Renders
 * the 3–4 core exercises + cardio block + the cycle week label. Hides
 * itself on lift days (the regular Today card handles those).
 */
export default function HomeSessionCard() {
  useStoreVersion();
  const profile = store.getProfile();
  const session = useMemo(() => {
    if (!profile) return null;
    return getCoreCardioSession({
      profile,
      dayOfWeek: new Date().getDay(),
      weekNumber: store.getWeekNumber(),
      recentLogs: store.getLogs(),
    });
  }, [profile]);

  if (!profile || !session) return null;

  return (
    <Card className="border-accent/30">
      <SectionHeader
        title={session.title}
        subtitle={`${session.totalMinutes} min total · ${session.coreMinutes} min core`}
        action={
          <div className="flex flex-wrap items-center gap-1.5">
            <Pill tone="accent">{HOME_DAY_LABEL[session.day]}</Pill>
            <Pill>
              Wk {session.cycleWeek} · {session.cycleLabel}
            </Pill>
          </div>
        }
      />

      {/* Big single-line CTA — rest day equivalent of the Today CTA */}
      <Link
        to="/log"
        className="flex items-center justify-between gap-3 rounded-2xl border-2 border-accent/40 bg-accent/15 px-4 py-3 shadow-glow transition active:scale-[0.99] hover:bg-accent/25"
      >
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-rose-glow">
            Start session
          </div>
          <div className="mt-0.5 truncate font-display text-base font-bold text-zinc-100">
            {session.corePrescriptions.length} core exercises + cardio
          </div>
        </div>
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-white shadow-glow">
          <Play size={18} />
        </span>
      </Link>

      {/* Safety notice — only when a swap fired */}
      {session.safetyOverride && session.safetyNote && (
        <div className="mt-3 rounded-xl border border-warning/30 bg-warning/10 p-2.5 text-xs text-zinc-100">
          <AlertTriangle size={12} className="inline mr-1 text-warning" />
          {session.safetyNote}
        </div>
      )}

      {/* Cardio block */}
      <div className="mt-3 rounded-2xl border border-ink-800 bg-ink-850 p-3">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
          <Heart size={12} /> Cardio
        </div>
        <p className="mt-1 text-sm text-zinc-100">{session.cardioBlock}</p>
      </div>

      {/* Core block */}
      <div className="mt-3 rounded-2xl border border-ink-800 bg-ink-850 p-3">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
          <Activity size={12} /> Core ({session.coreMinutes} min)
        </div>
        <ul className="mt-2 space-y-1.5 text-sm text-zinc-100">
          {session.corePrescriptions.map((p, i) => (
            <li key={i} className="flex flex-wrap items-baseline justify-between gap-2">
              <span>
                <span className="font-semibold">{p.name}</span>{' '}
                <span className="text-zinc-400">
                  · {p.sets} × {p.reps}
                </span>
              </span>
              {p.notes && (
                <span className="ml-6 text-[11px] text-zinc-500 sm:ml-0">{p.notes}</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Coach note (cycle context) */}
      <div className="mt-3 rounded-xl border border-ink-800 bg-ink-900/40 p-2.5 text-xs text-zinc-300">
        <Clock size={12} className="inline mr-1 text-rose-glow" />
        {session.coachNote}
      </div>

      <p className="mt-2 text-[11px] text-zinc-500">
        4-week cycle: form → volume → strength → challenge. Reps/variations
        adjust each week. Soreness or low-back risk swaps in safer moves
        automatically.
      </p>
    </Card>
  );
}
