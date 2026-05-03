import type {
  ExercisePrescription,
  Profile,
  TrainingPhase,
  WeeklyPlan,
  WorkoutDay,
  WorkoutSession,
  WorkoutVolumePreference,
} from '../types';
import { detectWeakPoints } from './weakPoints';
import { store } from './storage';

// Round to nearest 5 lbs (typical micro plate availability)
const round5 = (n: number) => Math.max(0, Math.round(n / 5) * 5);

function pctLoad(oneRm: number, pct: number) {
  return round5(oneRm * pct);
}

interface BuildArgs {
  profile: Profile;
  weekNumber: number;
  phase: TrainingPhase;
}

// ─── Volume filtering + rotation ───────────────────────────────────────────
//
// The day functions return their FULL accessory list. applyVolume() trims
// + rotates that list per the user's workoutVolumePreference, so each
// week shows a different slice of the pool — weak-point coverage stays
// intact over the cycle without any single day being too long.

/** Default preference per goal when the user hasn't set one. */
export function defaultVolumeFor(profile: Profile): WorkoutVolumePreference {
  if (profile.workoutVolumePreference) return profile.workoutVolumePreference;
  if (profile.goal === 'fat_loss') return 'compact';
  return 'standard';
}

/** Target total exercises per lift day (including main + secondary). */
function targetCount(pref: WorkoutVolumePreference): number {
  if (pref === 'compact') return 6;
  if (pref === 'standard') return 8;
  return 9;
}

/**
 * Should core-only exercises stay on lift days? Always YES when:
 *   - profile flags lower_back as a problem area
 *   - weakPoints engine flags core_bracing or lower_back_pain
 *
 * Otherwise — core moves off lift days for compact + standard, and
 * lives on cardio/rest days (surfaced via the Dashboard's Rest Day Plan
 * card). Core stays on every lift day for 'high' regardless.
 */
function shouldKeepCoreOnLiftDay(profile: Profile, pref: WorkoutVolumePreference): boolean {
  if (pref === 'high') return true;
  if (profile.problemAreas.includes('lower_back')) return true;
  try {
    const wp = detectWeakPoints(store.getLogs());
    if (wp.some((w) => w.key === 'core_bracing' || w.key === 'lower_back_pain')) {
      return true;
    }
  } catch {
    // If anything goes sideways reading logs, fail safely toward keeping
    // core on lift days — under-recovery costs less than under-bracing.
    return true;
  }
  return false;
}

function isCoreOnly(p: ExercisePrescription): boolean {
  const tags = (p.tags ?? []).map((t) => t.toLowerCase());
  if (!tags.includes('core')) return false;
  // Combo-tagged movements (e.g., Farmer Carry = grip + core) stay.
  return !tags.some((t) => ['main', 'accessory', 'glute', 'back', 'grip', 'biceps', 'triceps', 'shoulders'].includes(t));
}

/**
 * Pull the "secondary" accessory for a main-lift day — typically the
 * paused/deficit/pause variant of the main lift. We pin it by name
 * pattern so each day function doesn't have to add a custom tag.
 */
function isSecondaryMovement(p: ExercisePrescription, mainName: string): boolean {
  const n = p.name.toLowerCase();
  const m = mainName.toLowerCase();
  if (m.includes('squat') && /\b(paus(ed|e)|front|tempo)\b.*squat/i.test(p.name)) return true;
  if (m.includes('bench') && /\b(paus(ed|e)|larsen|spoto|board)\b.*bench/i.test(p.name)) return true;
  if (m.includes('deadlift') && /\b(deficit|pause|snatch|stiff)\b.*deadlift/i.test(p.name)) return true;
  void n;
  return false;
}

/**
 * Apply volume preference to a session's prescription list:
 *   - keep main (always first)
 *   - keep one secondary movement when present
 *   - filter core-only when not needed (per shouldKeepCoreOnLiftDay)
 *   - rotate the remaining accessories by weekNumber so each week
 *     covers a different slice of the pool
 *   - truncate to targetCount(pref)
 *
 * Pure function — same inputs always give the same output.
 */
export function applyVolume(
  prescriptions: ExercisePrescription[],
  profile: Profile,
  weekNumber: number,
): ExercisePrescription[] {
  const pref = defaultVolumeFor(profile);
  const target = targetCount(pref);

  const main = prescriptions.find((p) => (p.tags ?? []).includes('main'));
  const others = main ? prescriptions.filter((p) => p !== main) : prescriptions;

  // Core-only filter
  const keepCore = shouldKeepCoreOnLiftDay(profile, pref);
  const afterCoreFilter = keepCore
    ? others
    : others.filter((p) => !isCoreOnly(p));

  // Pull secondary movement to the front (when there's a main lift)
  let ordered = afterCoreFilter;
  if (main) {
    const secondary = afterCoreFilter.find((p) => isSecondaryMovement(p, main.name));
    if (secondary) {
      ordered = [secondary, ...afterCoreFilter.filter((p) => p !== secondary)];
    }
  }

  // Weekly rotation of the trailing accessories. We keep the first item
  // (secondary) pinned; the rotation only affects the bench accessories.
  const pinned = main ? 1 : 0;
  const rotatable = ordered.slice(pinned);
  const offset = rotatable.length > 0 ? (Math.max(0, weekNumber - 1)) % rotatable.length : 0;
  const rotated = [
    ...rotatable.slice(offset),
    ...rotatable.slice(0, offset),
  ];
  const finalOthers = [...ordered.slice(0, pinned), ...rotated];

  // Truncate
  const head = main ? [main] : [];
  const tail = main ? finalOthers : finalOthers;
  const slots = target - head.length;
  return [...head, ...tail.slice(0, slots)];
}

/** Plain-English coach note explaining the volume choice. */
function volumeCoachNote(profile: Profile): string | null {
  const pref = defaultVolumeFor(profile);
  if (pref === 'compact') {
    return 'Volume reduced to improve recovery and consistency during fat loss. Core work has moved to your cardio / rest days unless lower-back risk pulls it back in.';
  }
  if (pref === 'standard') {
    return 'Standard volume — full coverage with weekly accessory rotation. Bump to High if recovery is consistently strong; drop to Compact if sessions feel rushed.';
  }
  return null; // high — leave the day's existing coachNote alone
}

function squatDay({ profile, weekNumber, phase }: BuildArgs): WorkoutSession {
  const main: ExercisePrescription = {
    name: 'Back Squat',
    sets: phase === 'peak' ? 4 : 4,
    reps: phase === 'hypertrophy' ? '6-8' : phase === 'strength' ? '4-5' : phase === 'peak' ? '2-3' : '5',
    loadPct: phase === 'hypertrophy' ? 0.72 : phase === 'strength' ? 0.8 : phase === 'peak' ? 0.88 : 0.6,
    loadLbs: pctLoad(
      profile.squat1RM,
      phase === 'hypertrophy' ? 0.72 : phase === 'strength' ? 0.8 : phase === 'peak' ? 0.88 : 0.6,
    ),
    restSec: 180,
    rpeTarget: phase === 'deload' ? 6 : 8,
    notes: 'Brace hard. Knees track over toes. Drive hips up out of the hole.',
    tags: ['main'],
  };

  const accessories: ExercisePrescription[] = [
    { name: 'Paused Squat', sets: 3, reps: '5', loadLbs: pctLoad(profile.squat1RM, 0.6), restSec: 150, notes: '2s pause in the hole — builds bottom-end strength and bracing.', tags: ['accessory'] },
    { name: 'Romanian Deadlift', sets: 3, reps: '8-10', loadLbs: round5(profile.deadlift1RM * 0.55), restSec: 120, notes: 'Hinge, soft knees, pull hips back. Hamstrings and glutes.', tags: ['glute'] },
    { name: 'Bulgarian Split Squat', sets: 3, reps: '8/leg', restSec: 90, notes: 'Long stride for glute bias.', tags: ['glute'] },
    { name: 'Hip Thrust', sets: 3, reps: '8-10', restSec: 90, notes: 'Pause at lockout, ribs down.', tags: ['glute'] },
    { name: 'Walking Lunge', sets: 3, reps: '10/leg', restSec: 75, tags: ['glute'] },
    { name: 'Pallof Press', sets: 3, reps: '10/side', restSec: 60, notes: 'Anti-rotation. Resist twist.', tags: ['core'] },
    { name: 'Dead Bug', sets: 3, reps: '8/side', restSec: 45, notes: 'Ribs down, low back glued to floor.', tags: ['core'] },
  ];

  return {
    id: `squat-w${weekNumber}`,
    day: 'squat',
    title: 'Squat Day',
    weekNumber,
    phase,
    prescriptions: [main, ...accessories],
    coachNote:
      phase === 'deload'
        ? 'Deload week — keep bar speed crisp, RPE 5–6. Recovery is the work.'
        : 'Bracing first, depth second. If lower back lights up, drop a set and add one Pallof.',
  };
}

function benchDay({ profile, weekNumber, phase }: BuildArgs): WorkoutSession {
  const main: ExercisePrescription = {
    name: 'Bench Press',
    sets: 4,
    reps: phase === 'hypertrophy' ? '6-8' : phase === 'strength' ? '4-5' : phase === 'peak' ? '2-3' : '5',
    loadLbs: pctLoad(
      profile.bench1RM,
      phase === 'hypertrophy' ? 0.7 : phase === 'strength' ? 0.78 : phase === 'peak' ? 0.86 : 0.6,
    ),
    restSec: 180,
    rpeTarget: phase === 'deload' ? 6 : 8,
    notes: 'Tuck elbows ~45°, drive heels, big back. Touch low on chest.',
    tags: ['main'],
  };

  const accessories: ExercisePrescription[] = [
    { name: 'Paused Bench (2s)', sets: 3, reps: '5', loadLbs: pctLoad(profile.bench1RM, 0.65), restSec: 120, notes: 'Builds bottom-end power and tightness.', tags: ['accessory'] },
    { name: 'Close-Grip Bench', sets: 3, reps: '6-8', restSec: 120, notes: 'Triceps lockout. Elbows in.', tags: ['triceps'] },
    { name: 'DB Incline Press', sets: 3, reps: '8-10', restSec: 90, tags: ['accessory'] },
    { name: 'Chest-Supported Row', sets: 4, reps: '8-10', restSec: 90, notes: 'Pull to lower chest. Bench needs strong upper back.', tags: ['back'] },
    { name: 'Face Pulls', sets: 3, reps: '12-15', restSec: 60, notes: 'External rotation — shoulder health.', tags: ['back'] },
    { name: 'Tricep Pushdown', sets: 3, reps: '10-12', restSec: 60, tags: ['triceps'] },
    { name: 'Hanging Knee Raise', sets: 3, reps: '8-10', restSec: 60, tags: ['core', 'grip'] },
    { name: 'Plank w/ Shoulder Tap', sets: 3, reps: '20s', restSec: 45, tags: ['core'] },
  ];

  return {
    id: `bench-w${weekNumber}`,
    day: 'bench',
    title: 'Bench Day',
    weekNumber,
    phase,
    prescriptions: [main, ...accessories],
    coachNote: 'Upper back is your bench. Row volume is non-negotiable.',
  };
}

function deadliftDay({ profile, weekNumber, phase }: BuildArgs): WorkoutSession {
  const main: ExercisePrescription = {
    name: 'Conventional Deadlift',
    sets: phase === 'peak' ? 3 : 3,
    reps: phase === 'hypertrophy' ? '5' : phase === 'strength' ? '3' : phase === 'peak' ? '1-2' : '5',
    loadLbs: pctLoad(
      profile.deadlift1RM,
      phase === 'hypertrophy' ? 0.72 : phase === 'strength' ? 0.82 : phase === 'peak' ? 0.9 : 0.6,
    ),
    restSec: 240,
    rpeTarget: phase === 'deload' ? 6 : 8,
    notes: 'Wedge into the bar. Lats tight. Push the floor — don\'t yank.',
    tags: ['main'],
  };

  const accessories: ExercisePrescription[] = [
    { name: 'Deficit Deadlift (1")', sets: 3, reps: '5', loadLbs: round5(profile.deadlift1RM * 0.6), restSec: 180, notes: 'Off-the-floor strength.', tags: ['accessory'] },
    { name: 'Pause Deadlift below knee', sets: 3, reps: '3', loadLbs: round5(profile.deadlift1RM * 0.6), restSec: 180, notes: '2s pause to fix bar path.', tags: ['accessory'] },
    { name: 'Barbell Row', sets: 4, reps: '6-8', restSec: 90, tags: ['back'] },
    { name: 'Good Morning', sets: 3, reps: '8-10', restSec: 90, notes: 'Light. Builds spinal endurance — protects low back.', tags: ['accessory'] },
    { name: 'Single-Leg Hip Thrust', sets: 3, reps: '10/leg', restSec: 75, tags: ['glute'] },
    { name: 'Farmer Carry', sets: 3, reps: '40 yds', restSec: 90, notes: 'Heavy. Grip + core in one.', tags: ['grip', 'core'] },
    { name: 'Dead Hang', sets: 3, reps: 'max', restSec: 60, notes: 'Track time weekly — grip benchmark.', tags: ['grip'] },
    { name: 'Hollow Hold', sets: 3, reps: '20-30s', restSec: 45, tags: ['core'] },
  ];

  return {
    id: `deadlift-w${weekNumber}`,
    day: 'deadlift',
    title: 'Deadlift Day',
    weekNumber,
    phase,
    prescriptions: [main, ...accessories],
    coachNote: 'Grip and bracing make or break this day. Treat carries like a main lift.',
  };
}

function upperAccessoryDay({ profile, weekNumber, phase }: BuildArgs): WorkoutSession {
  const prescriptions: ExercisePrescription[] = [
    { name: 'Overhead Press', sets: 4, reps: '5-6', loadLbs: pctLoad(profile.bench1RM, 0.55), restSec: 150, notes: 'Glutes squeezed, ribs down.', tags: ['accessory'] },
    { name: 'Larsen Press', sets: 3, reps: '6-8', restSec: 120, notes: 'Feet up, no leg drive — pure pressing strength.', tags: ['accessory'] },
    { name: 'Pull-Up / Lat Pulldown', sets: 4, reps: '6-10', restSec: 90, tags: ['back', 'grip'] },
    { name: 'Seal Row', sets: 3, reps: '10', restSec: 90, tags: ['back'] },
    { name: 'DB Lateral Raise', sets: 4, reps: '12-15', restSec: 45, tags: ['shoulders'] },
    { name: 'Incline DB Curl', sets: 3, reps: '10-12', restSec: 60, tags: ['biceps', 'grip'] },
    { name: 'Cable Crunch', sets: 3, reps: '12-15', restSec: 45, tags: ['core'] },
    { name: 'Side Plank', sets: 3, reps: '30s/side', restSec: 30, tags: ['core'] },
    { name: 'Plate Pinch Hold', sets: 3, reps: '30s', restSec: 60, notes: 'Two 10-lb plates pinched, smooth side out — direct grip.', tags: ['grip'] },
  ];

  return {
    id: `upper-w${weekNumber}`,
    day: 'upper_accessory',
    title: 'Upper Accessory',
    weekNumber,
    phase,
    prescriptions,
    coachNote: 'Build the body around the bench. Volume on back, side delts, and grip.',
  };
}

function lowerGluteDay({ weekNumber, phase }: BuildArgs): WorkoutSession {
  const prescriptions: ExercisePrescription[] = [
    { name: 'Front Squat', sets: 4, reps: '6', restSec: 150, notes: 'Upright torso. Teaches your trunk to brace under squat.', tags: ['accessory', 'core'] },
    { name: 'Barbell Hip Thrust', sets: 4, reps: '8-10', restSec: 120, notes: 'Pause 1s at top, glutes squeezed.', tags: ['glute'] },
    { name: 'Reverse Lunge', sets: 3, reps: '10/leg', restSec: 75, tags: ['glute'] },
    { name: 'Cable Pull-Through', sets: 3, reps: '12', restSec: 60, tags: ['glute'] },
    { name: 'Hyperextension (glute bias)', sets: 3, reps: '12-15', restSec: 60, notes: 'Round upper back slightly, drive with glutes.', tags: ['glute', 'lowerback'] },
    { name: 'Standing Calf Raise', sets: 3, reps: '12-15', restSec: 45, tags: ['accessory'] },
    { name: 'Suitcase Carry', sets: 3, reps: '40 yds/side', restSec: 75, tags: ['core', 'grip'] },
    { name: 'Pallof Hold', sets: 3, reps: '20s/side', restSec: 45, tags: ['core'] },
  ];
  return {
    id: `lowerglute-w${weekNumber}`,
    day: 'lower_glute',
    title: 'Lower / Glute Day (Optional)',
    weekNumber,
    phase,
    prescriptions,
    coachNote: 'Optional 5th day. Skip if recovery score < 6 two days running.',
  };
}

export function buildWeeklyPlan(profile: Profile, weekNumber = 1, phase: TrainingPhase = 'hypertrophy'): WeeklyPlan {
  const args: BuildArgs = { profile, weekNumber, phase };
  const rawSessions: WorkoutSession[] = [
    squatDay(args),
    benchDay(args),
    deadliftDay(args),
    upperAccessoryDay(args),
  ];
  if (profile.trainingDaysPerWeek >= 5) {
    rawSessions.push(lowerGluteDay(args));
  }

  // Apply volume preference + weekly rotation per session. The day
  // functions return the FULL pool; this is where it gets trimmed.
  const volumeNote = volumeCoachNote(profile);
  const sessions: WorkoutSession[] = rawSessions.map((s) => {
    const trimmed = applyVolume(s.prescriptions, profile, weekNumber);
    return {
      ...s,
      prescriptions: trimmed,
      coachNote: volumeNote
        ? `${s.coachNote ?? ''}${s.coachNote ? ' ' : ''}${volumeNote}`
        : s.coachNote,
    };
  });

  return { weekNumber, phase, sessions };
}

export const dayLabel: Record<WorkoutDay, string> = {
  squat: 'Squat Day',
  bench: 'Bench Day',
  deadlift: 'Deadlift Day',
  upper_accessory: 'Upper Accessory',
  lower_glute: 'Lower / Glute',
};
