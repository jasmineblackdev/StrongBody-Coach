import { useMemo } from 'react';
import { Heart, Activity, ChevronDown } from 'lucide-react';
import { Card, Pill, SectionHeader } from './ui';
import {
  getAllHomeSessions,
  HOME_DAY_LABEL,
} from '../lib/coreCardioPlan';
import { store } from '../lib/storage';
import { useStoreVersion } from '../hooks/useStore';

const DOW_LABEL: Record<string, string> = {
  home_a_upper: 'Wednesday',
  home_b_lower: 'Saturday',
  home_c_stability: 'Sunday',
};

/**
 * Workout Plan section showing all three home sessions for the current
 * week. Read-only — the actual session you do each day comes from
 * HomeSessionCard on the Dashboard.
 */
export default function HomeSessionsPanel() {
  useStoreVersion();
  const profile = store.getProfile();
  const sessions = useMemo(() => {
    if (!profile) return [];
    return getAllHomeSessions({
      profile,
      weekNumber: store.getWeekNumber(),
      recentLogs: store.getLogs(),
    });
  }, [profile]);

  if (!profile || sessions.length === 0) return null;

  // All sessions share the same cycle week — pull from the first.
  const cycleWeek = sessions[0].cycleWeek;
  const cycleLabel = sessions[0].cycleLabel;

  return (
    <Card>
      <SectionHeader
        title="Home Core + Cardio (rest days)"
        subtitle="3-day rotation — runs on your non-lifting days. 30–45 min total per session."
        action={
          <Pill tone="accent">
            Cycle Wk {cycleWeek} · {cycleLabel}
          </Pill>
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        {sessions.map((s) => (
          <div
            key={s.day}
            className="rounded-2xl border border-ink-800 bg-ink-850 p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-1">
              <Pill tone="accent">{HOME_DAY_LABEL[s.day]}</Pill>
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                {DOW_LABEL[s.day]}
              </span>
            </div>
            <div className="mt-2 font-display text-sm font-bold text-zinc-100">
              {s.title.replace(/^Home . · /, '')}
            </div>
            <div className="mt-1 text-[11px] text-zinc-500">
              {s.totalMinutes} min total · {s.coreMinutes} min core
            </div>

            <details className="mt-2 group">
              <summary className="flex cursor-pointer list-none items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                <ChevronDown size={12} className="transition group-open:rotate-180" />
                What's in it
              </summary>

              <div className="mt-2 rounded-lg border border-ink-800 bg-ink-900/40 p-2">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-300">
                  <Heart size={10} /> Cardio
                </div>
                <p className="mt-1 text-xs text-zinc-200">{s.cardioBlock}</p>
              </div>

              <div className="mt-2 rounded-lg border border-ink-800 bg-ink-900/40 p-2">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-300">
                  <Activity size={10} /> Core
                </div>
                <ul className="mt-1 space-y-0.5 text-xs text-zinc-200">
                  {s.corePrescriptions.map((p, i) => (
                    <li key={i}>
                      • {p.name} · {p.sets} × {p.reps}
                    </li>
                  ))}
                </ul>
              </div>

              <p className="mt-2 text-[10px] italic leading-snug text-zinc-500">
                {s.coachNote}
              </p>
            </details>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11px] text-zinc-500">
        Soreness in the abs in your last 3 sessions automatically reroutes
        Wed / Sat to the stability day. Lower-back risk swaps the ab
        roller + crunch machine for stability ball + dead bug.
      </p>
    </Card>
  );
}
