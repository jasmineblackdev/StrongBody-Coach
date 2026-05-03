import { useMemo } from 'react';
import { Heart, Activity, ChevronRight } from 'lucide-react';
import { Pill } from './ui';
import { getAllHomeSessions, HOME_DAY_LABEL } from '../lib/coreCardioPlan';
import { store } from '../lib/storage';
import { useStoreVersion } from '../hooks/useStore';

const DAY_LABEL_BY_KIND: Record<string, string> = {
  home_a_upper: 'Friday',
  home_b_lower: 'Saturday',
  home_c_stability: 'Sunday',
};

/**
 * Compact "Coming up this week" list for the Today screen. Shows the
 * three Core + Cardio home days with their weekday labels so the user
 * always knows what's on Fri / Sat / Sun without leaving the dashboard.
 *
 * On lift days: shows the upcoming home days.
 * On home days: still renders the same 3-row block — useful for "what's
 *               next?" planning even mid-rotation.
 */
export default function WeekAheadCard() {
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

  // All sessions share the cycle week; pull from the first.
  const cycleLabel = sessions[0].cycleLabel;
  const cycleWeek = sessions[0].cycleWeek;

  return (
    <div className="rounded-2xl border border-ink-800 bg-ink-850 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Core + Cardio · Fri / Sat / Sun
          </div>
          <div className="text-sm font-bold text-zinc-100">Coming up this week</div>
        </div>
        <Pill tone="accent">
          Cycle Wk {cycleWeek} · {cycleLabel}
        </Pill>
      </div>

      <ul className="mt-3 divide-y divide-ink-800/70">
        {sessions.map((s) => {
          const dayLabel = DAY_LABEL_BY_KIND[s.day] ?? '';
          const headline = s.title.replace(/^Home . · /, '');
          return (
            <li
              key={s.day}
              className="flex items-center justify-between gap-2 py-2 text-sm"
            >
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  {dayLabel} · {HOME_DAY_LABEL[s.day]}
                </div>
                <div className="truncate text-zinc-100">{headline}</div>
              </div>
              <div className="shrink-0 text-right text-[11px] text-zinc-400">
                <span className="inline-flex items-center gap-1">
                  <Heart size={11} /> {s.totalMinutes - s.coreMinutes} m
                </span>
                <span className="ml-2 inline-flex items-center gap-1">
                  <Activity size={11} /> {s.coreMinutes} m
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-2 flex items-center justify-end gap-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        Open from /plan
        <ChevronRight size={12} />
      </div>
    </div>
  );
}
