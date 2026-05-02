import type {
  ExercisePrescription,
  Profile,
  TrainingPhase,
  WeeklyPlan,
  WorkoutDay,
  WorkoutSession,
} from '../types';

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
  const sessions: WorkoutSession[] = [
    squatDay(args),
    benchDay(args),
    deadliftDay(args),
    upperAccessoryDay(args),
  ];
  if (profile.trainingDaysPerWeek >= 5) {
    sessions.push(lowerGluteDay(args));
  }
  return { weekNumber, phase, sessions };
}

export const dayLabel: Record<WorkoutDay, string> = {
  squat: 'Squat Day',
  bench: 'Bench Day',
  deadlift: 'Deadlift Day',
  upper_accessory: 'Upper Accessory',
  lower_glute: 'Lower / Glute',
};
