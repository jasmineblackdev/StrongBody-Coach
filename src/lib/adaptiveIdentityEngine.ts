// Adaptive Identity Engine.
//
// Learns user-specific patterns from local store data and produces a
// stable "coaching profile" the Coach Brain uses to bias decisions.
//
// Hard rules:
//   - Never overrides safety. Pain / injury / low confidence always
//     win over identity bias.
//   - Requires repeated patterns (≥ 3 signals) before flipping a trait.
//   - Updates gradually — single events don't change identity.
//   - Pure deterministic, no external APIs, no ML.
//   - When data is thin, returns 'unknown' for that trait so the brain
//     falls back to the rule-based default.

import type {
  CoachDecision,
  MealFeedback,
  Profile,
  WeeklyCheckIn,
  WorkoutLog,
} from '../types';
import type { LiftKey } from './strengthEngine';
import { estimateAllLifts } from './strengthEngine';
import { computeAdherence } from './adherenceEngine';

// ─── Trait types ───────────────────────────────────────────────────────────

export type FatLossType =
  | 'fast_responder'   // body responds quickly to small calorie changes
  | 'slow_responder'   // needs more time / harder cuts to see the scale move
  | 'adaptive'         // mixed — responds when adherence is clean, stalls otherwise
  | 'unknown';

export type PreferredAdjustment = 'steps' | 'calories' | 'mixed' | 'unknown';

export type RecoverySensitivity = 'low' | 'medium' | 'high' | 'unknown';

export type FoodSensitivity = 'low' | 'medium' | 'high' | 'unknown';

export type AdherenceType = 'consistent' | 'inconsistent' | 'unknown';

export interface AdaptiveIdentity {
  fatLossType: FatLossType;
  preferredAdjustment: PreferredAdjustment;
  recoverySensitivity: RecoverySensitivity;
  foodSensitivity: FoodSensitivity;
  adherenceType: AdherenceType;
  /**
   * 0-100 — how much data this identity is built on. Below 30 = mostly
   * defaults; above 60 = the brain can lean on it heavily.
   */
  maturityScore: number;
  /** Plain-English reasons each trait landed where it did. */
  reasons: string[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const ADHERENCE_VAL = { yes: 1.0, mostly: 0.8, no: 0.5 } as const;
const REQUIRED_SIGNALS = 3;

/** Median helper. */
function median(nums: number[]): number {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function weeksBetween(aIso: string, bIso: string): number {
  return Math.max(
    0,
    (new Date(aIso).getTime() - new Date(bIso).getTime()) / (7 * 86400000),
  );
}

// ─── Per-trait detectors ───────────────────────────────────────────────────

/**
 * Average weekly weight loss across all logged 7-day windows. Returns
 * null when fewer than 14 days of metrics are available.
 */
function averageWeeklyLoss(metrics: { date: string; weightLbs?: number }[]): number | null {
  const sorted = metrics
    .filter((m) => typeof m.weightLbs === 'number')
    .sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 14) return null;
  const start = sorted[0];
  const end = sorted[sorted.length - 1];
  const weeks = weeksBetween(end.date, start.date);
  if (weeks <= 0) return null;
  return +(((end.weightLbs as number) - (start.weightLbs as number)) / weeks).toFixed(2);
}

/**
 * Looks at accepted Coach Decisions and their outcomes. When a
 * `reduce_calories` decision worked, that's a "fast responder" signal;
 * when it `didnt_move`, it's a "slow responder" signal. Same for
 * `increase_steps` to feed the preferredAdjustment trait.
 */
function fatLossTypeFromDecisions(
  decisions: CoachDecision[],
  weeklyLoss: number | null,
): { type: FatLossType; reason: string | null } {
  const accepted = decisions.filter((d) => d.status === 'accepted');
  const calCuts = accepted.filter((d) => d.decision === 'reduce_calories');
  const stepBumps = accepted.filter((d) => d.decision === 'increase_steps');

  let workedCount = 0;
  let stalledCount = 0;
  for (const d of [...calCuts, ...stepBumps]) {
    if (!d.outcome) continue;
    if (d.outcome.verdict === 'worked') workedCount += 1;
    else if (d.outcome.verdict === 'didnt_move') stalledCount += 1;
  }

  const totalDecisionsWithOutcome = workedCount + stalledCount;
  if (totalDecisionsWithOutcome >= REQUIRED_SIGNALS) {
    if (workedCount >= 2 * stalledCount) {
      return {
        type: 'fast_responder',
        reason: `Body has responded to ${workedCount} of the last ${totalDecisionsWithOutcome} cut/step decisions — fast responder.`,
      };
    }
    if (stalledCount >= 2 * workedCount) {
      return {
        type: 'slow_responder',
        reason: `Cuts have stalled ${stalledCount}/${totalDecisionsWithOutcome} times — slow responder. Hold cuts longer; let adherence pile up first.`,
      };
    }
    return {
      type: 'adaptive',
      reason: `Mixed response across ${totalDecisionsWithOutcome} decisions — adapt to adherence quality.`,
    };
  }

  // Fallback to the average weekly loss rate when there aren't enough
  // accepted decisions yet.
  if (weeklyLoss !== null) {
    if (weeklyLoss <= -1.2) {
      return {
        type: 'fast_responder',
        reason: `Average loss rate ${weeklyLoss} lb/wk on the current plan — body responds quickly.`,
      };
    }
    if (weeklyLoss > -0.4 && weeklyLoss < 0.4) {
      return {
        type: 'slow_responder',
        reason: `Average movement ${weeklyLoss} lb/wk — body holds; cuts will need patience.`,
      };
    }
  }

  return { type: 'unknown', reason: null };
}

function preferredAdjustmentFromHistory(
  decisions: CoachDecision[],
): { type: PreferredAdjustment; reason: string | null } {
  const acceptedWithOutcome = decisions.filter(
    (d) => d.status === 'accepted' && d.outcome,
  );
  const cutsWorked = acceptedWithOutcome.filter(
    (d) => d.decision === 'reduce_calories' && d.outcome?.verdict === 'worked',
  ).length;
  const cutsStalled = acceptedWithOutcome.filter(
    (d) => d.decision === 'reduce_calories' && d.outcome?.verdict === 'didnt_move',
  ).length;
  const stepsWorked = acceptedWithOutcome.filter(
    (d) => d.decision === 'increase_steps' && d.outcome?.verdict === 'worked',
  ).length;
  const stepsStalled = acceptedWithOutcome.filter(
    (d) => d.decision === 'increase_steps' && d.outcome?.verdict === 'didnt_move',
  ).length;

  const total = cutsWorked + cutsStalled + stepsWorked + stepsStalled;
  if (total < REQUIRED_SIGNALS) return { type: 'unknown', reason: null };

  if (stepsWorked > cutsWorked && stepsWorked >= 2) {
    return {
      type: 'steps',
      reason: `Step increases worked ${stepsWorked}× vs cuts ${cutsWorked}× — prefer steps.`,
    };
  }
  if (cutsWorked > stepsWorked && cutsWorked >= 2) {
    return {
      type: 'calories',
      reason: `Calorie cuts worked ${cutsWorked}× vs steps ${stepsWorked}× — prefer calories.`,
    };
  }
  return {
    type: 'mixed',
    reason: `Both levers have worked — alternate or stack as needed.`,
  };
}

function recoverySensitivityFromLogs(
  logs: WorkoutLog[],
  checkIns: WeeklyCheckIn[],
): { type: RecoverySensitivity; reason: string | null } {
  // Read the average recovery score across recent logs and the rate at
  // which energyRecovery dips after high-volume weeks.
  const recoveryScores = logs
    .slice(0, 14)
    .map((l) => l.recoveryScore)
    .filter((n): n is number => typeof n === 'number');
  if (recoveryScores.length < REQUIRED_SIGNALS) {
    return { type: 'unknown', reason: null };
  }

  const avgRecovery =
    recoveryScores.reduce((s, n) => s + n, 0) / recoveryScores.length;

  // Post-volume sensitivity: did energyRecovery drop ≥ 2 points on
  // any of the last 3 check-ins compared to the prior?
  const recentCheckIns = checkIns.slice(0, 4);
  let bigDrops = 0;
  for (let i = 0; i < recentCheckIns.length - 1; i++) {
    const drop = recentCheckIns[i + 1].energyRecovery - recentCheckIns[i].energyRecovery;
    if (drop >= 2) bigDrops += 1;
  }

  if (avgRecovery <= 5 || bigDrops >= 2) {
    return {
      type: 'high',
      reason: `Recovery scores averaging ${avgRecovery.toFixed(1)}/10 with ${bigDrops} big drop${bigDrops === 1 ? '' : 's'} — high sensitivity. Reduce volume sooner.`,
    };
  }
  if (avgRecovery >= 8 && bigDrops === 0) {
    return {
      type: 'low',
      reason: `Recovery consistently ${avgRecovery.toFixed(1)}/10 — low sensitivity. Body absorbs volume.`,
    };
  }
  return {
    type: 'medium',
    reason: `Recovery averaging ${avgRecovery.toFixed(1)}/10 — typical sensitivity.`,
  };
}

function foodSensitivityFromFeedback(
  feedback: MealFeedback[],
  checkIns: WeeklyCheckIn[],
): { type: FoodSensitivity; reason: string | null } {
  const totalMeals = feedback.length;
  const highBloatMeals = feedback.filter((f) => f.bloatingAfter >= 7).length;
  const bloatRatio = totalMeals > 0 ? highBloatMeals / totalMeals : 0;
  const avgBloating =
    checkIns.slice(0, 4).reduce((s, c) => s + c.bloatingLevel, 0) /
    Math.max(1, Math.min(4, checkIns.length));

  if (totalMeals < REQUIRED_SIGNALS && checkIns.length < REQUIRED_SIGNALS) {
    return { type: 'unknown', reason: null };
  }

  if (bloatRatio >= 0.4 || avgBloating >= 7) {
    return {
      type: 'high',
      reason: `${Math.round(bloatRatio * 100)}% of logged meals show high bloating · weekly avg ${avgBloating.toFixed(1)}/10 — high food sensitivity. Prefer food swaps over macro cuts.`,
    };
  }
  if (bloatRatio <= 0.1 && avgBloating <= 4) {
    return {
      type: 'low',
      reason: `Bloating consistently low — minimal food-side noise. Macro changes land cleanly.`,
    };
  }
  return {
    type: 'medium',
    reason: `Some bloating signal — usual female-physiology range. Swaps + macro cuts both viable.`,
  };
}

function adherenceTypeFromHistory(
  checkIns: WeeklyCheckIn[],
): { type: AdherenceType; reason: string | null } {
  if (checkIns.length < REQUIRED_SIGNALS) {
    return { type: 'unknown', reason: null };
  }
  const recent = checkIns.slice(0, 6);
  const scores = recent.map((c) => {
    const cal = ADHERENCE_VAL[c.caloriesAdherence];
    const pro = ADHERENCE_VAL[c.proteinAdherence];
    const work =
      c.workoutsPlanned > 0
        ? Math.min(1, c.workoutsCompleted / c.workoutsPlanned)
        : 0;
    return (cal + pro + work) / 3;
  });
  const med = median(scores);
  // Variance across the last 6 check-ins
  const mean = scores.reduce((s, n) => s + n, 0) / scores.length;
  const variance =
    scores.reduce((s, n) => s + (n - mean) ** 2, 0) / scores.length;
  const stddev = Math.sqrt(variance);

  if (med >= 0.85 && stddev <= 0.1) {
    return {
      type: 'consistent',
      reason: `Adherence median ${Math.round(med * 100)}% with low swing — consistent.`,
    };
  }
  if (med < 0.7 || stddev > 0.2) {
    return {
      type: 'inconsistent',
      reason: `Adherence median ${Math.round(med * 100)}% with swing of ${(stddev * 100).toFixed(0)}% — inconsistent. Avoid aggressive plans.`,
    };
  }
  return {
    type: 'consistent',
    reason: `Adherence median ${Math.round(med * 100)}% — workable consistency.`,
  };
}

// ─── Main entry ────────────────────────────────────────────────────────────

export interface AdaptiveIdentityInput {
  profile: Profile;
  metrics: { date: string; weightLbs?: number }[];
  recentLogs: WorkoutLog[];
  checkIns: WeeklyCheckIn[];
  decisions: CoachDecision[];
  mealFeedback?: MealFeedback[];
}

export function computeAdaptiveIdentity(
  input: AdaptiveIdentityInput,
): AdaptiveIdentity {
  const reasons: string[] = [];
  void computeAdherence; // import surface for completeness
  void estimateAllLifts as unknown;
  void (null as unknown as LiftKey);

  const weeklyLoss = averageWeeklyLoss(input.metrics);
  const fatLoss = fatLossTypeFromDecisions(input.decisions, weeklyLoss);
  const adjustment = preferredAdjustmentFromHistory(input.decisions);
  const recovery = recoverySensitivityFromLogs(input.recentLogs, input.checkIns);
  const food = foodSensitivityFromFeedback(input.mealFeedback ?? [], input.checkIns);
  const adherence = adherenceTypeFromHistory(input.checkIns);

  if (fatLoss.reason) reasons.push(fatLoss.reason);
  if (adjustment.reason) reasons.push(adjustment.reason);
  if (recovery.reason) reasons.push(recovery.reason);
  if (food.reason) reasons.push(food.reason);
  if (adherence.reason) reasons.push(adherence.reason);

  // Maturity score: how many traits landed on something other than 'unknown'?
  const traitsKnown = [
    fatLoss.type !== 'unknown',
    adjustment.type !== 'unknown',
    recovery.type !== 'unknown',
    food.type !== 'unknown',
    adherence.type !== 'unknown',
  ].filter(Boolean).length;
  const maturityScore = Math.round((traitsKnown / 5) * 100);

  return {
    fatLossType: fatLoss.type,
    preferredAdjustment: adjustment.type,
    recoverySensitivity: recovery.type,
    foodSensitivity: food.type,
    adherenceType: adherence.type,
    maturityScore,
    reasons,
  };
}

// ─── UI tokens ─────────────────────────────────────────────────────────────

export const FAT_LOSS_TYPE_LABEL: Record<FatLossType, string> = {
  fast_responder: 'Fast responder',
  slow_responder: 'Slow responder',
  adaptive: 'Adaptive',
  unknown: 'Not enough data yet',
};

export const PREFERRED_ADJUSTMENT_LABEL: Record<PreferredAdjustment, string> = {
  steps: 'Steps respond best',
  calories: 'Calorie cuts respond best',
  mixed: 'Both levers work',
  unknown: 'Not enough data yet',
};

export const RECOVERY_SENSITIVITY_LABEL: Record<RecoverySensitivity, string> = {
  low: 'Low sensitivity',
  medium: 'Medium sensitivity',
  high: 'High sensitivity',
  unknown: 'Not enough data yet',
};

export const FOOD_SENSITIVITY_LABEL: Record<FoodSensitivity, string> = {
  low: 'Low food sensitivity',
  medium: 'Medium food sensitivity',
  high: 'High food sensitivity',
  unknown: 'Not enough data yet',
};

export const ADHERENCE_TYPE_LABEL: Record<AdherenceType, string> = {
  consistent: 'Consistent',
  inconsistent: 'Inconsistent — avoid aggressive plans',
  unknown: 'Not enough data yet',
};
