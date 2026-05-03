// Rule-based strength learning. No ML, no APIs. Pure functions over logs.

import type { ExerciseLog, SetLog, WorkoutLog } from '../types';

export type LiftKey = 'squat' | 'bench' | 'deadlift';
export type StrengthTrend = 'improving' | 'flat' | 'regressing' | 'unknown';

export interface SetEvidence {
  date: string;
  prescriptionName: string;
  reps: number;
  weight: number;
  rpe?: number;
  estimate: number;
}

export interface LiftEstimate {
  lift: LiftKey;
  /** Rounded 1RM estimate (lb). 0 when no usable evidence exists. */
  estimated1RM: number;
  trend: StrengthTrend;
  /** The specific set that produced the current best estimate. */
  evidence: SetEvidence | null;
  /** Per-session best estimates, oldest → newest, last 5. */
  history: { date: string; estimate: number }[];
  sessionsAnalyzed: number;
}

const PATTERNS: Record<LiftKey, RegExp> = {
  squat: /(?:^|\b)(back\s+squat|low[- ]bar\s+squat|high[- ]bar\s+squat|squat)$/i,
  bench: /(?:^|\b)(bench\s+press|bench)$/i,
  deadlift:
    /(?:^|\b)(conventional\s+deadlift|barbell\s+deadlift|trap[- ]bar\s+deadlift|sumo\s+deadlift|deadlift)$/i,
};

/**
 * Adjusted Epley with reps-in-reserve.
 *   1RM = weight × (1 + (reps + RIR) / 30)
 *   RIR = max(0, 10 − RPE) when RPE provided, else 0.
 *
 * Rounded to nearest pound.
 */
export function epley1RM(weight: number, reps: number, rpe?: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  const rir = typeof rpe === 'number' ? Math.max(0, 10 - rpe) : 0;
  const eff = reps + rir;
  if (eff <= 1) return Math.round(weight);
  return Math.round(weight * (1 + eff / 30));
}

function sessionBest(ex: ExerciseLog): { estimate: number; set: SetLog | null } {
  let best = 0;
  let bestSet: SetLog | null = null;
  for (const set of ex.sets) {
    if (set.missed) continue;
    if (set.reps <= 0 || set.weight <= 0) continue;
    const est = epley1RM(set.weight, set.reps, set.rpe);
    if (est > best) {
      best = est;
      bestSet = set;
    }
  }
  return { estimate: best, set: bestSet };
}

function computeTrend(estimatesNewestFirst: number[]): StrengthTrend {
  if (estimatesNewestFirst.length < 2) return 'unknown';
  const newest = estimatesNewestFirst[0];
  const prior = estimatesNewestFirst.slice(1);
  const priorAvg = prior.reduce((s, n) => s + n, 0) / prior.length;
  if (priorAvg === 0) return 'unknown';
  const diff = newest - priorAvg;
  const threshold = priorAvg * 0.02; // 2% noise band
  if (diff > threshold) return 'improving';
  if (diff < -threshold) return 'regressing';
  return 'flat';
}

export interface EstimateOptions {
  /** Max sessions to analyze (newest first). Default 5. */
  sessionLimit?: number;
}

export function estimateLift(
  logs: WorkoutLog[],
  lift: LiftKey,
  opts: EstimateOptions = {},
): LiftEstimate {
  const sessionLimit = opts.sessionLimit ?? 5;
  const pattern = PATTERNS[lift];
  const sortedLogs = [...logs].sort((a, b) => b.date.localeCompare(a.date));

  const evidence: SetEvidence[] = [];
  for (const log of sortedLogs) {
    const matches = log.exercises.filter((e) => pattern.test(e.prescriptionName));
    if (!matches.length) continue;

    let pickName: string | null = null;
    let pickEstimate = 0;
    let pickSet: SetLog | null = null;
    for (const ex of matches) {
      const { estimate, set } = sessionBest(ex);
      if (set && estimate > pickEstimate) {
        pickEstimate = estimate;
        pickSet = set;
        pickName = ex.prescriptionName;
      }
    }
    if (pickSet && pickName) {
      evidence.push({
        date: log.date,
        prescriptionName: pickName,
        reps: pickSet.reps,
        weight: pickSet.weight,
        rpe: pickSet.rpe,
        estimate: pickEstimate,
      });
    }
    if (evidence.length >= sessionLimit) break;
  }

  const newest = evidence[0] ?? null;
  const trend = computeTrend(evidence.map((e) => e.estimate));
  const history = evidence
    .map((e) => ({ date: e.date, estimate: e.estimate }))
    .reverse(); // oldest → newest for chart-friendliness

  return {
    lift,
    estimated1RM: newest?.estimate ?? 0,
    trend,
    evidence: newest,
    history,
    sessionsAnalyzed: evidence.length,
  };
}

export function estimateAllLifts(logs: WorkoutLog[]): Record<LiftKey, LiftEstimate> {
  return {
    squat: estimateLift(logs, 'squat'),
    bench: estimateLift(logs, 'bench'),
    deadlift: estimateLift(logs, 'deadlift'),
  };
}

export const TREND_LABEL: Record<StrengthTrend, string> = {
  improving: 'Improving',
  flat: 'Flat',
  regressing: 'Regressing',
  unknown: 'Not enough data',
};
