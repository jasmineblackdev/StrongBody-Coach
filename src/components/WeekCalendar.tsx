import { useMemo } from 'react';
import type { WorkoutSession } from '../types';
import type { CoreCardioSession } from '../lib/coreCardioPlan';
import { dayLabel } from '../lib/workoutPlan';

/**
 * Weekly calendar view — 7 day-of-week tiles, color-coded by session
 * type. Renders "schedule, not report" UI — tap a day to drill in.
 */

export type DaySessionKind = 'lower' | 'upper' | 'core' | 'rest';

export interface CalendarDay {
  /** 0=Sun, 1=Mon, ..., 6=Sat */
  dow: number;
  /** "Mon", "Tue", etc. */
  label: string;
  /** Long form: "Monday" */
  longLabel: string;
  /** Loose category for color coding. */
  kind: DaySessionKind;
  /** Lift session reference, when this is a lift day. */
  liftSession?: WorkoutSession;
  /** Home session reference, when this is a Fri/Sat/Sun home day. */
  homeSession?: CoreCardioSession;
  /** Plain-English type label: "Squat Day" / "Home A · Upper abs". */
  typeLabel: string;
  /** Number of exercises (lift) or core moves (home). 0 for rest. */
  exerciseCount: number;
  /** Estimated total minutes. */
  estimatedMinutes: number;
  /** Today flag — for highlighting. */
  isToday: boolean;
  /** Has a session at all. */
  hasSession: boolean;
}

const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

// Lift Mon-Thu, Home Fri-Sun (matches Dashboard.todayWorkout + coreCardioPlan)
const LIFT_DOW_MAP: Record<number, WorkoutSession['day']> = {
  1: 'squat',
  2: 'bench',
  3: 'deadlift',
  4: 'upper_accessory',
};

const HOME_DOW: number[] = [5, 6, 0]; // Fri, Sat, Sun

function kindFor(liftDay?: WorkoutSession['day']): DaySessionKind {
  if (!liftDay) return 'rest';
  if (liftDay === 'squat' || liftDay === 'deadlift' || liftDay === 'lower_glute') {
    return 'lower';
  }
  return 'upper';
}

/** Estimate session minutes — rough but useful for at-a-glance planning. */
function estimateLiftMinutes(session: WorkoutSession): number {
  // ~5–6 min per exercise (sets × set time + rest avg) — close enough for
  // an arrows-on-a-page schedule estimate.
  const ex = session.prescriptions.length;
  return Math.round(ex * 6 + 8); // +8 for warmup
}

export function buildCalendarDays(input: {
  liftSessions: WorkoutSession[];
  homeSessions: CoreCardioSession[];
}): CalendarDay[] {
  const todayDow = new Date().getDay();

  // Render the week starting Monday (dow=1) for a normal-feeling layout.
  const order: number[] = [1, 2, 3, 4, 5, 6, 0];

  return order.map((dow) => {
    const liftDay = LIFT_DOW_MAP[dow];
    const lift = liftDay
      ? input.liftSessions.find((s) => s.day === liftDay)
      : undefined;
    const home = HOME_DOW.includes(dow)
      ? input.homeSessions.find((s) => {
          if (dow === 5) return s.day === 'home_a_upper';
          if (dow === 6) return s.day === 'home_b_lower';
          if (dow === 0) return s.day === 'home_c_stability';
          return false;
        })
      : undefined;

    let kind: DaySessionKind;
    let typeLabel: string;
    let exerciseCount = 0;
    let estimatedMinutes = 0;
    if (lift) {
      kind = kindFor(liftDay);
      typeLabel = dayLabel[lift.day];
      exerciseCount = lift.prescriptions.length;
      estimatedMinutes = estimateLiftMinutes(lift);
    } else if (home) {
      kind = 'core';
      typeLabel = home.title.replace(/^Home . · /, '');
      exerciseCount = home.corePrescriptions.length;
      estimatedMinutes = home.totalMinutes;
    } else {
      kind = 'rest';
      typeLabel = 'Rest';
      exerciseCount = 0;
      estimatedMinutes = 0;
    }

    return {
      dow,
      label: DAY_NAMES_SHORT[dow],
      longLabel: DAY_NAMES_LONG[dow],
      kind,
      liftSession: lift,
      homeSession: home,
      typeLabel,
      exerciseCount,
      estimatedMinutes,
      isToday: dow === todayDow,
      hasSession: !!lift || !!home,
    };
  });
}

const TONE_BY_KIND: Record<
  DaySessionKind,
  { bg: string; border: string; text: string; chipBg: string; chipText: string }
> = {
  lower: {
    bg: 'bg-accent/10',
    border: 'border-accent/40',
    text: 'text-rose-glow',
    chipBg: 'bg-accent/15',
    chipText: 'text-rose-glow',
  },
  upper: {
    bg: 'bg-warning/10',
    border: 'border-warning/40',
    text: 'text-warning',
    chipBg: 'bg-warning/15',
    chipText: 'text-warning',
  },
  core: {
    bg: 'bg-success/10',
    border: 'border-success/40',
    text: 'text-success',
    chipBg: 'bg-success/15',
    chipText: 'text-success',
  },
  rest: {
    bg: 'bg-ink-850',
    border: 'border-ink-800',
    text: 'text-zinc-400',
    chipBg: 'bg-ink-800',
    chipText: 'text-zinc-400',
  },
};

interface Props {
  days: CalendarDay[];
  selectedDow: number | null;
  onSelect: (dow: number) => void;
}

/**
 * Compact horizontal calendar — 7 tiles, scrollable on narrow screens.
 * Tap a tile to select it; the parent renders the day detail elsewhere.
 */
export default function WeekCalendar({ days, selectedDow, onSelect }: Props) {
  return useMemo(
    () => (
      <div className="grid grid-cols-7 gap-2">
        {days.map((d) => {
          const tone = TONE_BY_KIND[d.kind];
          const selected = d.dow === selectedDow;
          return (
            <button
              key={d.dow}
              onClick={() => onSelect(d.dow)}
              className={`flex flex-col items-stretch rounded-xl border-2 p-2 text-left transition active:scale-95 ${
                selected
                  ? `${tone.border} ${tone.bg} shadow-glow`
                  : `${tone.border} ${tone.bg} opacity-80 hover:opacity-100`
              }`}
              aria-pressed={selected}
              aria-label={`${d.longLabel} — ${d.typeLabel}${d.exerciseCount ? ` · ${d.exerciseCount} exercises` : ''}`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wider ${tone.text}`}
                >
                  {d.label}
                </span>
                {d.isToday && (
                  <span
                    className={`inline-flex h-1.5 w-1.5 rounded-full ${
                      d.kind === 'rest' ? 'bg-zinc-400' : tone.text.replace('text-', 'bg-')
                    }`}
                    aria-hidden
                  />
                )}
              </div>
              <span
                className={`mt-1 inline-flex w-fit rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${tone.chipBg} ${tone.chipText}`}
              >
                {d.kind === 'rest' ? 'Rest' : d.kind}
              </span>
              <span className="mt-1 line-clamp-2 text-[11px] font-semibold leading-tight text-zinc-100">
                {d.kind === 'rest' ? 'Recovery' : d.typeLabel.split(' · ')[0]}
              </span>
              {d.exerciseCount > 0 && (
                <span className="mt-1 text-[9px] text-zinc-500">
                  {d.exerciseCount} ex · {d.estimatedMinutes} m
                </span>
              )}
            </button>
          );
        })}
      </div>
    ),
    [days, selectedDow, onSelect],
  );
}
