import type {
  AdjustmentDecision,
  ExerciseLog,
  ExercisePrescription,
  WorkoutLog,
} from '../types';

interface AdjustInput {
  prescription: ExercisePrescription;
  log: ExerciseLog;
  recovery?: number; // 1-10
  fatigueHigh?: boolean;
}

function avg(nums: number[]) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function repsTarget(reps: string): number {
  const m = reps.match(/(\d+)/);
  return m ? Number(m[1]) : 5;
}

/** Decide what to do with a single exercise next session. */
export function adjustExercise({ prescription, log, recovery, fatigueHigh }: AdjustInput): AdjustmentDecision {
  const target = repsTarget(prescription.reps);
  const allCompleted = log.sets.every((s) => !s.missed && s.reps >= target);
  const anyMissed = log.sets.some((s) => s.missed || s.reps < target);
  const meanRpe = avg(log.sets.map((s) => s.rpe ?? 0).filter((r) => r > 0));
  const lastWeight = log.sets[log.sets.length - 1]?.weight ?? prescription.loadLbs ?? 0;

  // Deload override
  if (fatigueHigh || (recovery !== undefined && recovery <= 4)) {
    return {
      exercise: prescription.name,
      action: 'deload',
      message: `Recovery is in the gutter. Cut load 15% and volume 30% next session — then reassess. Sleep is the program right now.`,
      suggestedLbsDelta: -Math.round(lastWeight * 0.15),
    };
  }

  if (allCompleted && meanRpe > 0 && meanRpe <= 7) {
    const isUpper = /bench|press|row|pull|curl/i.test(prescription.name);
    const delta = isUpper ? 5 : 10;
    return {
      exercise: prescription.name,
      action: 'increase',
      message: `Crushed it at RPE ${meanRpe.toFixed(1)}. Add ${delta} lb next session.`,
      suggestedLbsDelta: delta,
    };
  }

  if (allCompleted && meanRpe >= 8 && meanRpe <= 9) {
    return {
      exercise: prescription.name,
      action: 'repeat',
      message: `All reps in, but RPE ${meanRpe.toFixed(1)} — repeat this weight next week and aim for RPE 7.`,
      suggestedLbsDelta: 0,
    };
  }

  if (anyMissed) {
    const isMain = prescription.tags?.includes('main');
    if (isMain) {
      return {
        exercise: prescription.name,
        action: 'reduce_weight',
        message: `Missed reps on a main lift. Drop 5–10% and rebuild. Don\'t grind a stall — fix the pattern.`,
        suggestedLbsDelta: -Math.round(lastWeight * 0.07),
      };
    }
    return {
      exercise: prescription.name,
      action: 'reduce_volume',
      message: `Cut one set next session and hold the weight. Quality over quantity.`,
    };
  }

  return {
    exercise: prescription.name,
    action: 'repeat',
    message: 'Repeat this prescription. Build consistency before chasing weight.',
  };
}

/** Aggregate-level decisions across the whole session. */
export function sessionLevelDecisions(workout: WorkoutLog): AdjustmentDecision[] {
  const decisions: AdjustmentDecision[] = [];

  const hasLowerBackPain =
    workout.sorenessAreas?.includes('lower_back') ||
    workout.exercises.some((e) => /low back|lower back|lumbar/i.test(e.painNotes ?? ''));
  if (hasLowerBackPain) {
    decisions.push({
      exercise: 'Squat / Deadlift',
      action: 'swap',
      message:
        'Lower-back flag. Swap heavy back squats for front squats or paused squats this week, drop deadlift volume by 1 set, and add 2 extra Pallof Press + Dead Bug sets every session until pain clears.',
    });
  }

  const gripFail = workout.exercises.some((e) =>
    /grip|slipp|hand|fingers/i.test(e.painNotes ?? ''),
  );
  if (gripFail || workout.day === 'deadlift') {
    const dl = workout.exercises.find((e) => /deadlift/i.test(e.prescriptionName));
    const dropped =
      dl?.sets.some((s) => s.missed) ||
      gripFail;
    if (dropped) {
      decisions.push({
        exercise: 'Deadlift',
        action: 'add_accessory',
        message:
          'Grip is the limiter. Add Farmer Carry 3x40yd, Plate Pinch 3x30s, and Dead Hang at the end of every session. Use straps only on top sets.',
      });
    }
  }

  const benchEntry = workout.exercises.find((e) => /bench/i.test(e.prescriptionName));
  if (workout.day === 'bench' && benchEntry) {
    const stalled = benchEntry.sets.some((s) => s.missed);
    if (stalled) {
      decisions.push({
        exercise: 'Bench',
        action: 'add_accessory',
        message:
          'Bench is stalling. Add Paused Bench 3x5 + Close-Grip Bench 3x6 next bench day. Triceps and bottom-end are the fix.',
      });
    }
  }

  const squatEntry = workout.exercises.find((e) => /squat/i.test(e.prescriptionName));
  if (workout.day === 'squat' && squatEntry) {
    const stalled = squatEntry.sets.some((s) => s.missed);
    if (stalled) {
      decisions.push({
        exercise: 'Squat',
        action: 'add_accessory',
        message:
          'Your squat is stalling because your bracing/core work needs attention. Add Paused Squats 3x5, Tempo Squats (3s down) 3x4, plus Pallof Press and Hip Thrust accessories every squat day for 3 weeks.',
      });
    }
  }

  if ((workout.recoveryScore ?? 10) <= 4) {
    decisions.push({
      exercise: 'Whole week',
      action: 'deload',
      message:
        'Recovery is at ' +
        workout.recoveryScore +
        '/10. Deload this week — 60% loads, RPE 6 cap, all volume cut by a third. Sleep, protein, walks.',
    });
  }

  if ((workout.hungerAfter ?? 0) >= 7) {
    decisions.push({
      exercise: 'Nutrition',
      action: 'add_accessory',
      message:
        'You reported hunger after training, so add carbs post-workout — about 40–50g (rice, oats, fruit) within 60 min. Wegovy can blunt appetite earlier in the day; lean into it when hunger shows up.',
    });
  }

  return decisions;
}

export function decisionsForLog(log: WorkoutLog, prescriptions: ExercisePrescription[]): AdjustmentDecision[] {
  const perExercise = log.exercises
    .map((ex) => {
      const pres = prescriptions.find((p) => p.name === ex.prescriptionName);
      if (!pres) return null;
      return adjustExercise({
        prescription: pres,
        log: ex,
        recovery: log.recoveryScore,
        fatigueHigh: (log.recoveryScore ?? 10) <= 4,
      });
    })
    .filter(Boolean) as AdjustmentDecision[];

  return [...perExercise, ...sessionLevelDecisions(log)];
}
