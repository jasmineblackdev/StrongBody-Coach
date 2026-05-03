// Per-lift session-target prediction. Builds on the existing strengthEngine
// estimates, then projects a working set target with a confidence band.
//
// Reverse-Epley: working_weight = 1RM / (1 + reps/30), so a 5-rep working
// set is roughly 86% of estimated 1RM.

import type { WorkoutLog } from '../../types';
import {
  estimateLift,
  type EstimateConfidence,
  type LiftKey,
} from '../strengthEngine';

export interface StrengthForecast {
  lift: LiftKey;
  /** Recommended target weight for the next working set (lb), rounded to 5. */
  nextSessionTarget: number;
  /** Working rep count this target is calibrated for. */
  forReps: number;
  confidenceBand: { low: number; high: number };
  sessionsAnalyzed: number;
  confidence: EstimateConfidence;
}

function variance(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((s, n) => s + n, 0) / arr.length;
  return arr.reduce((s, n) => s + (n - mean) ** 2, 0) / arr.length;
}

function round5(n: number): number {
  return Math.max(0, Math.round(n / 5) * 5);
}

export function forecastLift(
  logs: WorkoutLog[],
  lift: LiftKey,
  forReps = 5,
): StrengthForecast | null {
  const estimate = estimateLift(logs, lift);
  if (estimate.estimated1RM <= 0 || estimate.sessionsAnalyzed === 0) return null;

  // Reverse Epley: weight ≈ 1RM / (1 + reps/30)
  const targetWeight = round5(estimate.estimated1RM / (1 + forReps / 30));

  // Build a band from session-to-session variance — noisier history = wider band.
  const stddev = Math.sqrt(variance(estimate.history.map((h) => h.estimate)));
  const bandLb = Math.max(5, round5(stddev));

  return {
    lift,
    nextSessionTarget: targetWeight,
    forReps,
    confidenceBand: {
      low: Math.max(0, targetWeight - bandLb),
      high: targetWeight + bandLb,
    },
    sessionsAnalyzed: estimate.sessionsAnalyzed,
    confidence: estimate.confidence,
  };
}

export function forecastAllLifts(
  logs: WorkoutLog[],
  forReps = 5,
): Record<LiftKey, StrengthForecast | null> {
  return {
    squat: forecastLift(logs, 'squat', forReps),
    bench: forecastLift(logs, 'bench', forReps),
    deadlift: forecastLift(logs, 'deadlift', forReps),
  };
}
