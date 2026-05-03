// Per-lift session-target prediction, gated by safety signals.
//
// Reverse-Epley target: working_weight = 1RM / (1 + reps/30), so a 5-rep
// working set is roughly 86% of estimated 1RM. The unguarded target is
// what the math says you *could* hit — but the math doesn't know you
// missed reps last time or that your back hurts.
//
// Safety gates check the most recent sessions and override an "increase"
// recommendation with one of: repeat / reduce / reduce_volume / deload.
// This is the difference between a calculator and a coach.

import type { WorkoutLog } from '../../types';
import {
  estimateLift,
  matchesMainLift,
  type EstimateConfidence,
  type LiftKey,
} from '../strengthEngine';

export type ForecastRecommendation =
  | 'increase'
  | 'repeat'
  | 'reduce_weight'
  | 'reduce_volume'
  | 'deload';

export interface SafetyFlag {
  kind:
    | 'high_rpe'
    | 'missed_reps'
    | 'pain_reported'
    | 'low_recovery';
  message: string;
}

export interface StrengthForecast {
  lift: LiftKey;
  /**
   * Recommended target for the next working set (lb), rounded to 5.
   * Already gated by safety flags — when flags are present, this is the
   * conservative number, not the math-only ceiling.
   */
  nextSessionTarget: number;
  /** What the unguarded math suggested before safety gating. */
  unguardedTarget: number;
  /** Working rep count this target is calibrated for. */
  forReps: number;
  confidenceBand: { low: number; high: number };
  sessionsAnalyzed: number;
  confidence: EstimateConfidence;
  /**
   * Action recommendation. 'increase' is only used when there are no
   * safety flags AND the last session's working weight was below the
   * unguarded target.
   */
  recommendation: ForecastRecommendation;
  /** Safety flags that drove the recommendation. Empty when 'increase'. */
  safetyFlags: SafetyFlag[];
  /** One-line rationale shown in the UI. */
  rationale: string;
}

export interface ForecastOptions {
  /**
   * Recovery score 0–100 from recoveryEngine. When < 60 a safety flag
   * fires regardless of per-lift signals. Optional — when omitted the
   * safety check skips this gate.
   */
  recoveryScore?: number;
  /**
   * RPE threshold above which we consider a working set to be "max effort".
   * Defaults to 9 — running RPE 9+ multiple sessions in a row means we're
   * already at the ceiling and pushing more is how injuries happen.
   */
  rpeFlagThreshold?: number;
}

function variance(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((s, n) => s + n, 0) / arr.length;
  return arr.reduce((s, n) => s + (n - mean) ** 2, 0) / arr.length;
}

function round5(n: number): number {
  return Math.max(0, Math.round(n / 5) * 5);
}

/**
 * Pull every working set logged for this main lift in the last `n` sessions.
 * Working = ≥ 70% of the heaviest weight that exercise hit in that session
 * (matches the recoveryEngine convention so warmups don't dilute signal).
 */
function recentWorkingSetsFor(
  logs: WorkoutLog[],
  lift: LiftKey,
  sessionLimit = 3,
): { sets: { rpe?: number; missed?: boolean }[]; pain: boolean; sessions: number } {
  const sortedLogs = [...logs].sort((a, b) => b.date.localeCompare(a.date));
  const sets: { rpe?: number; missed?: boolean }[] = [];
  let pain = false;
  let sessions = 0;
  for (const log of sortedLogs) {
    const matches = log.exercises.filter((e) =>
      matchesMainLift(e.prescriptionName, lift),
    );
    if (!matches.length) continue;
    sessions += 1;
    for (const ex of matches) {
      const heaviest = Math.max(0, ...ex.sets.map((s) => s.weight));
      const threshold = heaviest * 0.7;
      const working = heaviest > 0 ? ex.sets.filter((s) => s.weight >= threshold) : ex.sets;
      sets.push(...working.map((s) => ({ rpe: s.rpe, missed: s.missed })));
      if (relevantPain(lift, ex.painNotes)) pain = true;
    }
    if (sessions >= sessionLimit) break;
  }
  return { sets, pain, sessions };
}

/**
 * Was the pain note relevant to this lift? Lower-back pain on a deadlift
 * day matters more than a wrist tweak from bench press.
 */
function relevantPain(lift: LiftKey, painNotes?: string): boolean {
  if (!painNotes) return false;
  const lower = painNotes.toLowerCase();
  if (!lower.trim()) return false;
  // Any pain note for the squat or deadlift is relevant — those movements
  // load the spine and hips. For bench, joint-specific.
  if (lift === 'squat' || lift === 'deadlift') {
    return /low.?back|lumbar|knee|patell|hip|si\s|sciatic/i.test(lower);
  }
  if (lift === 'bench') {
    return /shoulder|rotator|delt|wrist|elbow|pec/i.test(lower);
  }
  return false;
}

/**
 * The last working session's heaviest working set for this lift.
 * Used by the "repeat" recommendation as the safe target.
 */
function lastWorkingWeight(logs: WorkoutLog[], lift: LiftKey): number {
  const sortedLogs = [...logs].sort((a, b) => b.date.localeCompare(a.date));
  for (const log of sortedLogs) {
    for (const ex of log.exercises) {
      if (!matchesMainLift(ex.prescriptionName, lift)) continue;
      const heaviest = Math.max(0, ...ex.sets.map((s) => s.weight));
      if (heaviest > 0) return heaviest;
    }
  }
  return 0;
}

export function forecastLift(
  logs: WorkoutLog[],
  lift: LiftKey,
  forReps = 5,
  options: ForecastOptions = {},
): StrengthForecast | null {
  const estimate = estimateLift(logs, lift);
  if (estimate.estimated1RM <= 0 || estimate.sessionsAnalyzed === 0) return null;

  const rpeThreshold = options.rpeFlagThreshold ?? 9;

  // Reverse Epley: weight ≈ 1RM / (1 + reps/30)
  const unguardedTarget = round5(estimate.estimated1RM / (1 + forReps / 30));

  // Build a band from session-to-session variance — noisier history = wider band.
  const stddev = Math.sqrt(variance(estimate.history.map((h) => h.estimate)));
  const bandLb = Math.max(5, round5(stddev));

  // ─── Safety gates ──────────────────────────────────────────────────────
  const flags: SafetyFlag[] = [];
  const recent = recentWorkingSetsFor(logs, lift, 3);
  const rpeValues = recent.sets
    .map((s) => s.rpe)
    .filter((r): r is number => typeof r === 'number' && r > 0);
  const avgRpe = rpeValues.length
    ? rpeValues.reduce((s, n) => s + n, 0) / rpeValues.length
    : 0;
  const missedRatio = recent.sets.length
    ? recent.sets.filter((s) => s.missed).length / recent.sets.length
    : 0;

  if (typeof options.recoveryScore === 'number' && options.recoveryScore < 60) {
    flags.push({
      kind: 'low_recovery',
      message: `Recovery ${options.recoveryScore}/100 — body isn't bouncing back.`,
    });
  }
  if (recent.pain) {
    flags.push({
      kind: 'pain_reported',
      message: `Pain reported in a recent ${lift} session — pull intensity down.`,
    });
  }
  if (missedRatio >= 0.15) {
    flags.push({
      kind: 'missed_reps',
      message: `${Math.round(missedRatio * 100)}% of recent working sets missed — load is outpacing the body.`,
    });
  }
  if (avgRpe >= rpeThreshold) {
    flags.push({
      kind: 'high_rpe',
      message: `Avg RPE ${avgRpe.toFixed(1)} on working sets — already at the ceiling.`,
    });
  }

  // ─── Resolve recommendation ────────────────────────────────────────────
  const lastWorking = lastWorkingWeight(logs, lift);
  let recommendation: ForecastRecommendation = 'increase';
  let nextSessionTarget = unguardedTarget;
  let rationale = `Math says you can hit ${unguardedTarget} lb × ${forReps} based on recent estimates.`;

  if (flags.length) {
    // Multi-flag combinations escalate. A single pain or low-recovery flag
    // alone gets a weight cut; pain + missed reps gets a deload.
    const hasPain = flags.some((f) => f.kind === 'pain_reported');
    const hasMissed = flags.some((f) => f.kind === 'missed_reps');
    const hasLowRecovery = flags.some((f) => f.kind === 'low_recovery');
    const hasHighRpe = flags.some((f) => f.kind === 'high_rpe');

    if (hasPain && hasMissed) {
      // Worst case — a real safety event. Drop hard.
      recommendation = 'deload';
      nextSessionTarget = lastWorking
        ? round5(lastWorking * 0.6)
        : round5(unguardedTarget * 0.6);
      rationale = `Pain + missed reps both showing — deload to 60% of last working weight (${nextSessionTarget} lb), RPE 6 cap.`;
    } else if (hasLowRecovery && (hasMissed || hasHighRpe)) {
      // Body is fried.
      recommendation = 'deload';
      nextSessionTarget = lastWorking
        ? round5(lastWorking * 0.65)
        : round5(unguardedTarget * 0.65);
      rationale = `Recovery low and ${hasMissed ? 'reps are slipping' : 'RPE pegged'} — deload to ${nextSessionTarget} lb.`;
    } else if (hasPain) {
      recommendation = 'reduce_weight';
      nextSessionTarget = lastWorking
        ? round5(lastWorking * 0.85)
        : round5(unguardedTarget * 0.85);
      rationale = `Pain reported — drop to ${nextSessionTarget} lb (~85%) and re-test next session.`;
    } else if (hasMissed) {
      recommendation = 'reduce_weight';
      nextSessionTarget = lastWorking
        ? round5(lastWorking * 0.9)
        : round5(unguardedTarget * 0.9);
      rationale = `Reps slipped last session — drop to ${nextSessionTarget} lb so today's sets land clean.`;
    } else if (hasHighRpe) {
      // Same weight, less volume. The lift can hold; the body needs the off-ramp.
      recommendation = 'reduce_volume';
      nextSessionTarget = lastWorking || unguardedTarget;
      rationale = `Same ${nextSessionTarget} lb but cut a working set — RPE pegged, no point chasing more this week.`;
    } else if (hasLowRecovery) {
      recommendation = 'repeat';
      nextSessionTarget = lastWorking || unguardedTarget;
      rationale = `Recovery low — repeat ${nextSessionTarget} lb and let the body catch up before pushing.`;
    }
  } else if (lastWorking > 0 && unguardedTarget <= lastWorking) {
    // No flags, but the math says we're not actually ahead of last session.
    // Repeating is honest here — no false-positive "increase".
    recommendation = 'repeat';
    nextSessionTarget = lastWorking;
    rationale = `Repeat ${nextSessionTarget} lb — last working set already at this estimate.`;
  }

  return {
    lift,
    nextSessionTarget,
    unguardedTarget,
    forReps,
    confidenceBand: {
      low: Math.max(0, nextSessionTarget - bandLb),
      high: nextSessionTarget + bandLb,
    },
    sessionsAnalyzed: estimate.sessionsAnalyzed,
    confidence: estimate.confidence,
    recommendation,
    safetyFlags: flags,
    rationale,
  };
}

export function forecastAllLifts(
  logs: WorkoutLog[],
  forReps = 5,
  options: ForecastOptions = {},
): Record<LiftKey, StrengthForecast | null> {
  return {
    squat: forecastLift(logs, 'squat', forReps, options),
    bench: forecastLift(logs, 'bench', forReps, options),
    deadlift: forecastLift(logs, 'deadlift', forReps, options),
  };
}

export const RECOMMENDATION_LABEL: Record<ForecastRecommendation, string> = {
  increase: 'Increase',
  repeat: 'Repeat',
  reduce_weight: 'Reduce',
  reduce_volume: 'Cut a set',
  deload: 'Deload',
};

export const RECOMMENDATION_TONE: Record<
  ForecastRecommendation,
  'success' | 'accent' | 'warning' | 'danger'
> = {
  increase: 'success',
  repeat: 'accent',
  reduce_weight: 'warning',
  reduce_volume: 'warning',
  deload: 'danger',
};
