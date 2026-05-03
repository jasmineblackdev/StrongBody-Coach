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

export type EstimateConfidence = 'low' | 'medium' | 'high';

export interface LiftEstimate {
  lift: LiftKey;
  /**
   * Smoothed 1RM estimate (lb): mean of the last 3 sessions' best estimates,
   * not just the newest session. 0 when no usable evidence exists.
   */
  estimated1RM: number;
  trend: StrengthTrend;
  /** The specific set that produced the most recent session's best estimate. */
  evidence: SetEvidence | null;
  /** Per-session best estimates, oldest → newest, last 5. */
  history: { date: string; estimate: number }[];
  sessionsAnalyzed: number;
  /**
   * How much to trust the estimate:
   * - 'low'  — too few sessions, high variance, or large drop vs manual baseline
   * - 'medium' — 2 sessions, no big drop
   * - 'high' — 3+ stable sessions
   * UI uses this to decide whether to surface an Apply button.
   */
  confidence: EstimateConfidence;
}

// H3 + M8 fix: strict whitelist of canonical main-lift names. Variations
// like Front Squat, Paused Squat, Bulgarian Split Squat, Goblet Squat,
// Box Squat, Hack Squat, Front Foot Elevated Squat, Close-Grip Bench,
// Paused Bench (2s), Larsen / Spoto / Feet-Up / DB / Incline / Decline /
// Overhead presses, Romanian / Deficit / Pause / Stiff-Leg / Snatch-Grip
// deadlifts — all of these are deliberately LIGHTER than the main lift
// or use a different bar path. Tracking them as "squat 1RM" pollutes the
// trend (e.g., Front Squat days look like "regressing" against a Back
// Squat baseline).
const MAIN_LIFT_PATTERNS: Record<LiftKey, RegExp[]> = {
  squat: [
    /^(barbell\s+)?back\s+squat$/i,
    /^(barbell\s+)?(low|high)[\s-]bar\s+squat$/i,
    /^(barbell\s+)?squat$/i,
  ],
  bench: [
    /^(barbell\s+)?(flat\s+)?bench(\s+press)?$/i,
  ],
  deadlift: [
    /^(barbell\s+)?conventional\s+deadlift$/i,
    /^(barbell\s+)?deadlift$/i,
    /^trap[\s-]bar\s+deadlift$/i,
    /^sumo\s+deadlift$/i,
  ],
};

/**
 * True only when the prescription name is the canonical main lift, not a
 * lighter / different-bar-path variation. Used by the strength engine and
 * the Progress page big-3 chart so variation blocks don't pollute the
 * 1RM trend line.
 */
export function matchesMainLift(name: string, lift: LiftKey): boolean {
  const trimmed = name.trim();
  return MAIN_LIFT_PATTERNS[lift].some((re) => re.test(trimmed));
}

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
  // Require 3+ sessions before we'll classify a direction. Two sessions is
  // not enough signal — one bad/great day flips the result.
  if (estimatesNewestFirst.length < 3) return 'unknown';
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

/** Mean of the last `window` session estimates (newest first). */
function smoothedEstimate(estimatesNewestFirst: number[], window = 3): number {
  if (!estimatesNewestFirst.length) return 0;
  const slice = estimatesNewestFirst.slice(0, window);
  const sum = slice.reduce((s, n) => s + n, 0);
  return Math.round(sum / slice.length);
}

function computeConfidence(
  estimatesNewestFirst: number[],
  manualBaseline?: number,
): EstimateConfidence {
  const n = estimatesNewestFirst.length;
  if (n === 0) return 'low';
  if (n === 1) return 'low';

  // Variance check: if the spread between max/min in the last 3 is >15%,
  // the lift is too noisy to trust.
  const recent = estimatesNewestFirst.slice(0, 3);
  if (recent.length >= 2) {
    const max = Math.max(...recent);
    const min = Math.min(...recent);
    if (max > 0 && (max - min) / max > 0.15) return 'low';
  }

  // Drop check: if the smoothed estimate is more than 15% below the manual
  // baseline, treat as low confidence — likely a one-off bad block, not a
  // genuine 50-lb regression we want to confidently apply.
  const smoothed = smoothedEstimate(estimatesNewestFirst);
  if (manualBaseline && manualBaseline > 0 && smoothed > 0) {
    const drop = (manualBaseline - smoothed) / manualBaseline;
    if (drop > 0.15) return 'low';
  }

  if (n === 2) return 'medium';
  return 'high';
}

export interface EstimateOptions {
  /** Max sessions to analyze (newest first). Default 5. */
  sessionLimit?: number;
  /**
   * The manually-set 1RM from profile, used to gauge confidence when the
   * engine's estimate is much lower than what the user has been training at.
   */
  manualBaseline?: number;
}

export function estimateLift(
  logs: WorkoutLog[],
  lift: LiftKey,
  opts: EstimateOptions = {},
): LiftEstimate {
  const sessionLimit = opts.sessionLimit ?? 5;
  const sortedLogs = [...logs].sort((a, b) => b.date.localeCompare(a.date));

  const evidence: SetEvidence[] = [];
  for (const log of sortedLogs) {
    const matches = log.exercises.filter((e) =>
      matchesMainLift(e.prescriptionName, lift),
    );
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
  const estimatesNewestFirst = evidence.map((e) => e.estimate);
  const trend = computeTrend(estimatesNewestFirst);
  const smoothed = smoothedEstimate(estimatesNewestFirst);
  const confidence = computeConfidence(estimatesNewestFirst, opts.manualBaseline);
  const history = evidence
    .map((e) => ({ date: e.date, estimate: e.estimate }))
    .reverse(); // oldest → newest for chart-friendliness

  return {
    lift,
    estimated1RM: smoothed,
    trend,
    evidence: newest,
    history,
    sessionsAnalyzed: evidence.length,
    confidence,
  };
}

export interface EstimateAllOptions {
  /**
   * Optional manual baselines per lift. When provided, the engine factors them
   * into the confidence calculation (large drops reduce confidence).
   */
  baselines?: Partial<Record<LiftKey, number>>;
}

export function estimateAllLifts(
  logs: WorkoutLog[],
  options: EstimateAllOptions = {},
): Record<LiftKey, LiftEstimate> {
  const { baselines = {} } = options;
  return {
    squat: estimateLift(logs, 'squat', { manualBaseline: baselines.squat }),
    bench: estimateLift(logs, 'bench', { manualBaseline: baselines.bench }),
    deadlift: estimateLift(logs, 'deadlift', { manualBaseline: baselines.deadlift }),
  };
}

export const TREND_LABEL: Record<StrengthTrend, string> = {
  improving: 'Improving',
  flat: 'Flat',
  regressing: 'Regressing',
  unknown: 'Not enough data',
};
