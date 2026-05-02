import type { WeakPoint, WorkoutLog } from '../types';

function lastN<T>(arr: T[], n: number) {
  return arr.slice(0, n);
}

function topSetWeight(log: WorkoutLog, lift: RegExp): number {
  const ex = log.exercises.find((e) => lift.test(e.prescriptionName));
  if (!ex) return 0;
  return Math.max(0, ...ex.sets.map((s) => s.weight));
}

function liftStallDetected(logs: WorkoutLog[], lift: RegExp): boolean {
  // Look at last 3 sessions of that lift; stall if top set weight didn\'t increase
  const sessions = logs.filter((l) => l.exercises.some((e) => lift.test(e.prescriptionName)));
  if (sessions.length < 3) return false;
  const recent = lastN(sessions, 3).map((l) => topSetWeight(l, lift));
  return recent[0] <= recent[2]; // newest first
}

export function detectWeakPoints(logs: WorkoutLog[]): WeakPoint[] {
  const out: WeakPoint[] = [];
  if (!logs.length) return out;

  if (liftStallDetected(logs, /squat/i)) {
    out.push({
      key: 'squat_stall',
      title: 'Squat is stalling',
      evidence: 'Top set weight has not progressed in your last 3 squat sessions.',
      recommendation:
        'Add Paused Squats 3x5 and Tempo Squats (3s down) 3x4 for 3 weeks. Layer in Hip Thrust + Pallof Press every squat day. Bracing and glutes are the fix.',
    });
  }

  if (liftStallDetected(logs, /bench/i)) {
    out.push({
      key: 'bench_stall',
      title: 'Bench is stalling',
      evidence: 'Bench top set has not progressed across your last 3 bench sessions.',
      recommendation:
        'Add Paused Bench 3x5 + Close-Grip Bench 3x6, and double back/row volume. Triceps and upper back are usually the limiter.',
    });
  }

  if (liftStallDetected(logs, /deadlift/i)) {
    out.push({
      key: 'deadlift_stall',
      title: 'Deadlift is stalling',
      evidence: 'Pull top set has been flat for 3 sessions.',
      recommendation:
        'Rotate in Deficit Deadlifts 3x5 and Pause Deadlifts (below knee) 3x3. Hammer grip — Farmer Carry + Plate Pinch every session.',
    });
  }

  const gripIssues = logs.some((l) =>
    l.exercises.some(
      (e) =>
        /grip|slipp|hand/i.test(e.painNotes ?? '') ||
        (/deadlift/i.test(e.prescriptionName) && e.sets.some((s) => s.missed)),
    ),
  );
  if (gripIssues) {
    out.push({
      key: 'grip_failure',
      title: 'Grip is the limiter on pulls',
      evidence: 'Grip slipping or missed reps reported on deadlifts.',
      recommendation:
        'Farmer Carry 3x40yd, Plate Pinch 3x30s, Dead Hang for time — every session. Strap only top sets.',
    });
  }

  const lowBack = logs.some(
    (l) =>
      l.sorenessAreas?.includes('lower_back') ||
      l.exercises.some((e) => /low.?back|lumbar/i.test(e.painNotes ?? '')),
  );
  if (lowBack) {
    out.push({
      key: 'lower_back_pain',
      title: 'Lower back is flagging',
      evidence: 'You reported lower-back soreness or pain in recent sessions.',
      recommendation:
        'Pull squat volume back 20% this week, swap conventional pulls for paused-below-knee, and add Dead Bug + Bird Dog daily. Re-test after 7 days.',
    });
  }

  const coreIssue = logs.some((l) =>
    l.exercises.some((e) => /squat/i.test(e.prescriptionName) && e.sets.some((s) => s.missed && (s.rpe ?? 0) >= 9)),
  );
  if (coreIssue) {
    out.push({
      key: 'core_bracing',
      title: 'Core / bracing is the bottleneck',
      evidence: 'Squat misses came in at very high RPE — usually a bracing failure, not a leg failure.',
      recommendation:
        'Add Pallof Press, Dead Bug, and Hollow Hold to every workout. Practice 360° belly breathing before each top set.',
    });
  }

  const glutesWeak = logs.filter((l) => l.day === 'squat' || l.day === 'deadlift').length >= 2 &&
    !logs.some((l) =>
      l.exercises.some((e) => /hip thrust|glute|bulgarian|hip thruster/i.test(e.prescriptionName)),
    );
  if (glutesWeak) {
    out.push({
      key: 'glute_weakness',
      title: 'Glute volume is missing',
      evidence: 'Multiple squat/pull days logged with no direct glute work.',
      recommendation:
        'Hip Thrust 3x10 every squat and pull day. Glute bridge or single-leg hip thrust on rest-day finishers.',
    });
  }

  const recoveryAvg =
    logs
      .map((l) => l.recoveryScore ?? 0)
      .filter((n) => n > 0)
      .slice(0, 5)
      .reduce((a, b) => a + b, 0) / Math.max(1, Math.min(5, logs.length));

  if (recoveryAvg && recoveryAvg <= 5) {
    out.push({
      key: 'poor_recovery',
      title: 'Recovery is below the line',
      evidence: `5-session recovery average: ${recoveryAvg.toFixed(1)}/10.`,
      recommendation:
        'Schedule a deload week (60% loads, RPE 6 cap, volume −30%). Prioritize 8h sleep, 150g+ protein, and 8–10k steps. Add 10 min walking after dinner — it helps Wegovy GI side effects too.',
    });
  }

  return out;
}
