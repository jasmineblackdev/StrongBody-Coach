// Home Core + Cardio engine.
//
// Three rotating home sessions for rest/cardio days, with a 4-week
// progression cycle (form → volume → strength → challenge). Designed for
// fat-loss without interfering with lifting recovery — total session
// length 30–45 min, core block 10–15 min.
//
// Day routing (deliberate, not auto-detected):
//   Wed  →  home_a_upper      Upper abs + boxing HIIT
//   Sat  →  home_b_lower      Lower abs + steady-state bike
//   Sun  →  home_c_stability  Core stability + treadmill intervals
//
// Safety overrides:
//   abs sore in last 3 sessions  →  swap upper/lower → stability
//   lower_back problem area / pain note in recent logs
//                                →  remove ab roller + crunch machine,
//                                   sub stability ball / dead bug / bird dog
//
// Pure deterministic. No APIs.

import type {
  CoreCardioDay,
  CoreProgressionWeek,
  ExercisePrescription,
  Profile,
  WorkoutLog,
} from '../types';

// ─── Public types ──────────────────────────────────────────────────────────

export interface CoreCardioSession {
  day: CoreCardioDay;
  /** Display title — e.g. "Home A · Upper abs + Boxing HIIT". */
  title: string;
  /** Total expected session length, minutes. */
  totalMinutes: number;
  /** Just the core block, minutes. */
  coreMinutes: number;
  /** Plain-English cardio block: equipment + duration + intervals. */
  cardioBlock: string;
  /** 3–4 core exercises, already rep-modulated for the current week. */
  corePrescriptions: ExercisePrescription[];
  /** Per-session coach note. */
  coachNote: string;
  /** True when a safety swap fired (abs sore, lower-back flag, etc). */
  safetyOverride: boolean;
  /** Plain-English read of any active safety swap. */
  safetyNote?: string;
  /** Current week of the 4-week progression cycle. */
  cycleWeek: CoreProgressionWeek;
  /** Cycle-week label (Form / Volume / Strength / Challenge). */
  cycleLabel: string;
}

export interface CoreCardioInput {
  profile: Profile;
  /**
   * 0–6, where 0=Sun, 3=Wed, 6=Sat. Pass `new Date().getDay()` for
   * "today's session"; or any day to look up that day's session.
   */
  dayOfWeek: number;
  /**
   * Engine-wide week counter (store.getWeekNumber()). The cycle week is
   * derived from this so progression advances every Monday.
   */
  weekNumber: number;
  /** Recent workout logs — used for soreness + pain detection. */
  recentLogs: WorkoutLog[];
}

// ─── Day routing ───────────────────────────────────────────────────────────

/**
 * Map day-of-week to a home-session day. Returns null on lift days.
 *   Mon–Thu = lift days
 *   Fri      → Home A (upper abs + boxing HIIT)
 *   Sat      → Home B (lower abs + bike)
 *   Sun      → Home C (core stability + treadmill)
 *
 * Earlier iterations used Wed for the upper-abs day; moved to Fri so
 * core + cardio falls together on the back end of the week, leaving a
 * clean 4-day Mon–Thu lift block.
 */
export function homeDayForDow(dow: number): CoreCardioDay | null {
  if (dow === 5) return 'home_a_upper'; // Fri
  if (dow === 6) return 'home_b_lower'; // Sat
  if (dow === 0) return 'home_c_stability'; // Sun
  return null;
}

// ─── Progression ───────────────────────────────────────────────────────────

interface CycleProfile {
  label: string;
  /** Multiplier on rep counts (1.0 = baseline). */
  repMod: number;
  /** Tempo / intent description tacked onto coachNote. */
  intentNote: string;
  /** When true, prefer harder variations of each movement. */
  challenge: boolean;
}

const CYCLE: Record<CoreProgressionWeek, CycleProfile> = {
  1: {
    label: 'Form / Control',
    repMod: 0.8,
    intentNote: 'Slow tempo. Pause at the hardest point of each rep. Quality > volume this week.',
    challenge: false,
  },
  2: {
    label: 'Volume',
    repMod: 1.0,
    intentNote: 'Full reps + sets. Steady tempo. Earn the volume — no missed reps.',
    challenge: false,
  },
  3: {
    label: 'Strength / Tension',
    repMod: 0.9,
    intentNote: 'Add a 1–2s pause at peak contraction. Light load on weighted moves.',
    challenge: false,
  },
  4: {
    label: 'Challenge',
    repMod: 1.0,
    intentNote: 'Harder variation of each movement. Same volume, more demand.',
    challenge: true,
  },
};

export function cycleWeekFromWeekNumber(weekNumber: number): CoreProgressionWeek {
  const w = ((Math.max(1, weekNumber) - 1) % 4) + 1;
  return w as CoreProgressionWeek;
}

// ─── Safety detection ──────────────────────────────────────────────────────

function absSoreInRecentSessions(logs: WorkoutLog[]): boolean {
  // Look at last 3 sessions for explicit core soreness or ab pain notes.
  const recent = logs.slice(0, 3);
  for (const log of recent) {
    if ((log.sorenessAreas ?? []).includes('core')) return true;
    for (const ex of log.exercises) {
      if (/\babs?|stomach|midsection\b/i.test(ex.painNotes ?? '')) return true;
    }
  }
  return false;
}

function lowerBackFlagged(profile: Profile, logs: WorkoutLog[]): boolean {
  if (profile.problemAreas.includes('lower_back')) return true;
  // Pain note in last 7 sessions
  return logs.slice(0, 7).some((log) =>
    log.exercises.some((e) => /low.?back|lumbar/i.test(e.painNotes ?? '')),
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function modReps(base: string, repMod: number): string {
  // Handles "8-10", "30s", "10/side", "max", plain numbers
  if (/[a-z]/i.test(base) && !base.includes('/')) {
    // "30s" — modulate the seconds
    const m = /^(\d+)([smin]+)$/.exec(base);
    if (m) {
      const n = Math.max(5, Math.round(Number(m[1]) * repMod));
      return `${n}${m[2]}`;
    }
    // "max" or other text — leave alone
    return base;
  }
  if (base.includes('/')) {
    // "10/side" or "10/leg" — modulate the number
    const m = /^(\d+)(\/.+)$/.exec(base);
    if (m) {
      const n = Math.max(3, Math.round(Number(m[1]) * repMod));
      return `${n}${m[2]}`;
    }
    return base;
  }
  if (base.includes('-')) {
    const [lo, hi] = base.split('-').map((s) => Number(s.trim()));
    if (Number.isFinite(lo) && Number.isFinite(hi)) {
      const newLo = Math.max(3, Math.round(lo * repMod));
      const newHi = Math.max(newLo + 1, Math.round(hi * repMod));
      return `${newLo}-${newHi}`;
    }
  }
  const n = Number(base);
  if (Number.isFinite(n)) {
    return String(Math.max(3, Math.round(n * repMod)));
  }
  return base;
}

function presc(
  name: string,
  sets: number,
  reps: string,
  restSec: number,
  tags: string[],
  repMod: number,
  notes?: string,
): ExercisePrescription {
  return {
    name,
    sets,
    reps: modReps(reps, repMod),
    restSec,
    notes,
    tags,
  };
}

// ─── Day builders ──────────────────────────────────────────────────────────

function buildHomeAUpper(
  cycle: CycleProfile,
  cycleWeek: CoreProgressionWeek,
  lowerBack: boolean,
): CoreCardioSession {
  const repMod = cycle.repMod;
  const challenge = cycle.challenge;

  // Core block — upper abs primary. Ab roller present unless lower-back
  // flagged. Cycle 4 swaps toward harder variations.
  const core: ExercisePrescription[] = [];

  // 1. Cable Crunch / Ab Crunch Machine — upper abs, weighted
  core.push(
    presc(
      lowerBack ? 'Stability Ball Crunch' : 'Ab Crunch Machine',
      3,
      challenge ? '12-15' : '10-12',
      45,
      ['core', 'upper_abs'],
      repMod,
      lowerBack
        ? 'Back fully supported by the ball — no spinal compression.'
        : 'Sit tall, exhale on the crunch. Add 1–2s squeeze at peak in cycle 3.',
    ),
  );

  // 2. Medicine Ball Slam — upper abs power (skip for week 1 form work)
  if (cycleWeek !== 1) {
    core.push(
      presc(
        challenge ? 'Medicine Ball Slam (overhead)' : 'Medicine Ball Slam',
        3,
        '10',
        45,
        ['core', 'upper_abs', 'power'],
        repMod,
        'Drive from the abs, not the arms. Catch on the bounce.',
      ),
    );
  } else {
    // Week 1 — slow controlled crunch instead of slam
    core.push(
      presc(
        'Stability Ball Crunch',
        3,
        '8-10',
        45,
        ['core', 'upper_abs'],
        repMod,
        'Slow tempo: 2s up, 1s squeeze, 2s down.',
      ),
    );
  }

  // 3. Ab Roller — challenge week + no lower-back flag only
  if (!lowerBack && challenge) {
    core.push(
      presc(
        'Ab Roller (from knees)',
        3,
        '6-8',
        60,
        ['core', 'upper_abs'],
        repMod,
        'Brace BEFORE the roll-out. Stop before the lower back arches.',
      ),
    );
  } else if (!lowerBack && cycleWeek === 3) {
    core.push(
      presc(
        'Ab Roller (from knees, paused)',
        3,
        '5-6',
        60,
        ['core', 'upper_abs'],
        repMod,
        'Pause 1–2s at full extension, then return.',
      ),
    );
  } else {
    // Lower-back flagged OR not challenge week — use stability ball
    core.push(
      presc(
        'Stability Ball Knee Tuck',
        3,
        '8-10',
        45,
        ['core', 'lower_abs'],
        repMod,
        'Plank position with shins on ball. Pull knees to chest, control the eccentric.',
      ),
    );
  }

  return {
    day: 'home_a_upper',
    title: 'Home A · Upper abs + Boxing HIIT',
    totalMinutes: 35,
    coreMinutes: 12,
    cardioBlock:
      '20 min boxing / shadowboxing — 30s on / 30s off × 8 rounds. Light gloves or freestyle.',
    corePrescriptions: core,
    coachNote: `Week ${cycleWeek} — ${cycle.label}. ${cycle.intentNote}`,
    safetyOverride: lowerBack,
    safetyNote: lowerBack
      ? 'Lower back flagged — ab roller + machine swapped for stability-ball variants.'
      : undefined,
    cycleWeek,
    cycleLabel: cycle.label,
  };
}

function buildHomeBLower(
  cycle: CycleProfile,
  cycleWeek: CoreProgressionWeek,
  lowerBack: boolean,
): CoreCardioSession {
  const repMod = cycle.repMod;
  const challenge = cycle.challenge;

  const core: ExercisePrescription[] = [];

  // 1. Hanging / Lying Leg Raise — lower abs primary
  core.push(
    presc(
      challenge ? 'Hanging Leg Raise' : 'Lying Leg Raise',
      3,
      challenge ? '8-10' : '10-12',
      45,
      ['core', 'lower_abs', 'grip'],
      repMod,
      'Squeeze knees together. Exhale on the way up. No swinging.',
    ),
  );

  // 2. Stability Ball Knee Tuck — always lower-back-safe
  core.push(
    presc(
      'Stability Ball Knee Tuck',
      3,
      '10-12',
      45,
      ['core', 'lower_abs'],
      repMod,
      cycleWeek === 3 ? 'Pause 1s at full tuck.' : 'Control the eccentric back to plank.',
    ),
  );

  // 3. Reverse Crunch — lower abs floor work
  core.push(
    presc(
      challenge ? 'Reverse Crunch (med ball between knees)' : 'Reverse Crunch',
      3,
      '12-15',
      45,
      ['core', 'lower_abs'],
      repMod,
      'Hips lift, knees travel toward chest. Lower-back stays glued to the floor.',
    ),
  );

  // 4. Dead Bug — anti-extension finisher
  core.push(
    presc(
      'Dead Bug',
      3,
      '8/side',
      45,
      ['core', 'lower_abs', 'lower_back_safe'],
      repMod,
      'Ribs down, low back glued to floor. Quality > speed.',
    ),
  );

  return {
    day: 'home_b_lower',
    title: 'Home B · Lower abs + Bike',
    totalMinutes: 40,
    coreMinutes: 12,
    cardioBlock:
      '25–30 min steady-state bike — Zone 2, conversational pace. Should be able to talk in full sentences.',
    corePrescriptions: core,
    coachNote: `Week ${cycleWeek} — ${cycle.label}. ${cycle.intentNote}`,
    safetyOverride: false,
    cycleWeek,
    cycleLabel: cycle.label,
  };
}

function buildHomeCStability(
  cycle: CycleProfile,
  cycleWeek: CoreProgressionWeek,
  _lowerBack: boolean,
): CoreCardioSession {
  void _lowerBack;
  const repMod = cycle.repMod;
  const challenge = cycle.challenge;

  const core: ExercisePrescription[] = [];

  // 1. Stability Ball Plank — anchor
  core.push(
    presc(
      challenge ? 'Stability Ball Plank w/ Shoulder Tap' : 'Stability Ball Plank',
      3,
      cycleWeek === 3 ? '40s' : challenge ? '45s' : '30s',
      60,
      ['core', 'core_stability', 'lower_back_safe'],
      repMod,
      'Squeeze glutes hard. Long line head → heels.',
    ),
  );

  // 2. Pallof Press — anti-rotation
  core.push(
    presc(
      'Pallof Press',
      3,
      '10/side',
      45,
      ['core', 'core_stability', 'lower_back_safe'],
      repMod,
      'Resist the twist. Press out slow, pause, return.',
    ),
  );

  // 3. Bird Dog — anti-extension + spinal endurance
  core.push(
    presc(
      challenge ? 'Bird Dog (slow tempo, 3s pause)' : 'Bird Dog',
      3,
      '8/side',
      45,
      ['core', 'core_stability', 'lower_back_safe'],
      repMod,
      'Opposite arm + leg. Hips stay level — don\'t let one side drop.',
    ),
  );

  // 4. Suitcase Carry — loaded carry, anti-lateral-flexion
  core.push(
    presc(
      'Suitcase Carry (kettlebell)',
      3,
      '40 yds/side',
      75,
      ['core', 'core_stability', 'grip'],
      repMod,
      'Heavy on one side. Don\'t lean — stay tall and stacked.',
    ),
  );

  return {
    day: 'home_c_stability',
    title: 'Home C · Core stability + Treadmill intervals',
    totalMinutes: 38,
    coreMinutes: 13,
    cardioBlock:
      '20 min treadmill intervals (no incline) — 1 min brisk walk / 1 min recovery × 10. Flat the whole time.',
    corePrescriptions: core,
    coachNote: `Week ${cycleWeek} — ${cycle.label}. ${cycle.intentNote}`,
    safetyOverride: false,
    cycleWeek,
    cycleLabel: cycle.label,
  };
}

// ─── Main entry ────────────────────────────────────────────────────────────

export function getCoreCardioSession(
  input: CoreCardioInput,
): CoreCardioSession | null {
  const initialDay = homeDayForDow(input.dayOfWeek);
  if (!initialDay) return null;

  const cycleWeek = cycleWeekFromWeekNumber(input.weekNumber);
  const cycle = CYCLE[cycleWeek];
  const lowerBack = lowerBackFlagged(input.profile, input.recentLogs);
  const absSore = absSoreInRecentSessions(input.recentLogs);

  // Soreness override: re-route upper/lower to stability when abs are sore.
  let effectiveDay = initialDay;
  let safetyNote: string | undefined;
  if (absSore && initialDay !== 'home_c_stability') {
    effectiveDay = 'home_c_stability';
    safetyNote =
      'Abs flagged sore in your last 3 sessions — swapped to the stability day so the abs can recover.';
  }

  let session: CoreCardioSession;
  if (effectiveDay === 'home_a_upper') {
    session = buildHomeAUpper(cycle, cycleWeek, lowerBack);
  } else if (effectiveDay === 'home_b_lower') {
    session = buildHomeBLower(cycle, cycleWeek, lowerBack);
  } else {
    session = buildHomeCStability(cycle, cycleWeek, lowerBack);
  }

  // Stitch in the abs-sore note when it overrode the day.
  if (safetyNote) {
    return {
      ...session,
      safetyOverride: true,
      safetyNote: session.safetyNote
        ? `${safetyNote} ${session.safetyNote}`
        : safetyNote,
    };
  }

  return session;
}

/**
 * All three home sessions for the current week — used by the Workout
 * Plan page to surface the rotation. Bypasses the soreness override
 * (the user's looking at the schedule, not what to do today).
 */
export function getAllHomeSessions(input: Omit<CoreCardioInput, 'dayOfWeek'>): CoreCardioSession[] {
  const days: number[] = [5, 6, 0]; // Fri, Sat, Sun
  const out: CoreCardioSession[] = [];
  for (const dow of days) {
    const s = getCoreCardioSession({ ...input, dayOfWeek: dow });
    if (s) out.push(s);
  }
  return out;
}

// ─── UI tokens ─────────────────────────────────────────────────────────────

export const HOME_DAY_LABEL: Record<CoreCardioDay, string> = {
  home_a_upper: 'Home A',
  home_b_lower: 'Home B',
  home_c_stability: 'Home C',
};
