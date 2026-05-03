// Prediction Engine — orchestrator that fuses the four existing
// forecasts into a single PredictionReport.
//
// Existing engines (each kept intact):
//   ml/weightForecaster.ts    — linear regression on weight metrics
//   plateauForecast.ts        — 14d vs 14d deceleration
//   ml/strengthForecaster.ts  — reverse-Epley with safety gates
//   ml/injuryRisk.ts          — RPE × missed × pain × soreness
//
// This file does NOT re-implement any of them. It collects their
// outputs, layers a confidence read on top, and produces a single
// "what will happen next week" surface for the FinalCoachReview.
//
// Pure deterministic — no APIs, no ML, no overrides of Coach Brain.

import type { Profile, WorkoutLog, BodyMetric } from '../types';
import type { ConfidenceReport } from './confidenceScoreEngine';
import {
  forecastWeight,
  type WeightForecast,
} from './ml/weightForecaster';
import {
  forecastAllLifts,
  type StrengthForecast,
} from './ml/strengthForecaster';
import { assessInjuryRisk, type InjuryRiskReport } from './ml/injuryRisk';
import {
  forecastPlateau,
  type PlateauForecastReport,
} from './plateauForecast';
import type { LiftKey } from './strengthEngine';

export interface PredictionReport {
  weightForecast: WeightForecast | null;
  plateauForecast: PlateauForecastReport;
  strengthForecast: Record<LiftKey, StrengthForecast | null>;
  injuryRisk: InjuryRiskReport;
  /** One-line read combining all four signals. */
  oneLineRead: string;
  /** Echo of the confidence engine's level — the cards show one number. */
  confidenceLevel: ConfidenceReport['level'];
  /** What's missing, surfaced from the confidence engine. */
  missingData: string[];
}

export interface PredictionInput {
  profile: Profile;
  metrics: BodyMetric[];
  recentLogs: WorkoutLog[];
  recoveryScore: number;
  confidence: ConfidenceReport;
}

export function generatePredictions(input: PredictionInput): PredictionReport {
  const { profile, metrics, recentLogs, recoveryScore, confidence } = input;

  const weightForecast = forecastWeight(metrics);
  const plateauForecastResult = forecastPlateau(metrics);
  const strengthForecast = forecastAllLifts(recentLogs, 5, {
    recoveryScore,
  });
  const injuryRisk = assessInjuryRisk(recentLogs);

  // Build a one-line read that combines the strongest signal across
  // all four forecasts. Priority: pain/injury > plateau > weight > strength.
  let oneLineRead: string;
  if (injuryRisk.level === 'high') {
    oneLineRead = `Injury risk is ${injuryRisk.level}. Strength predictions are gated until the body recovers.`;
  } else if (plateauForecastResult.status === 'in_plateau') {
    oneLineRead = plateauForecastResult.headline;
  } else if (plateauForecastResult.status === 'approaching_plateau') {
    oneLineRead = `Heads up: ${plateauForecastResult.headline.toLowerCase()}.`;
  } else if (weightForecast) {
    const direction =
      weightForecast.predictedWeeklyChange < 0
        ? 'down'
        : weightForecast.predictedWeeklyChange > 0
        ? 'up'
        : 'flat';
    oneLineRead = `Forecast: ${weightForecast.predictedNextWeekWeight} lb next week (${direction}).`;
  } else {
    oneLineRead =
      'Not enough data for a clean forecast — log daily weight + a check-in to unlock predictions.';
  }

  // Fold pain/injury into strength forecast safety: if injury_risk is
  // high and any lift was about to suggest 'increase', the forecaster
  // already gates that. We just surface a missing-data line if the
  // confidence engine flagged data thinness.
  const missingData = confidence.missingData.slice(0, 3);

  return {
    weightForecast,
    plateauForecast: plateauForecastResult,
    strengthForecast,
    injuryRisk,
    oneLineRead,
    confidenceLevel: confidence.level,
    missingData,
  };
}

/**
 * Translate a Coach Decision kind into the predicted weekly weight
 * change it implies. Used at acceptance time to capture what we were
 * predicting, so we can compare to actual after 7 days.
 */
export function predictedWeeklyChangeForDecision(
  kind:
    | 'stay_course'
    | 'reduce_calories'
    | 'increase_steps'
    | 'shift_carbs'
    | 'deload'
    | 'reduce_training_volume'
    | 'increase_recovery'
    | 'adjust_exercises'
    | 'improve_adherence'
    | 'log_more_data',
  fatLossModeDeficit: number | null,
): number | null {
  // fatLossModeDeficit = signed kcal/day delta. ~3500 kcal = 1 lb.
  // weeklyDelta_lb = (deficit_kcal_per_day × 7) / 3500
  switch (kind) {
    case 'reduce_calories':
      return -0.25; // additional ~0.25 lb/wk on top of existing trend
    case 'increase_steps':
      return -0.4; // 2k steps ≈ 100 kcal/day ≈ 0.2 lb/wk extra
    case 'increase_recovery':
      return 0.3; // adding food back → trend slows or reverses slightly
    case 'stay_course':
    case 'shift_carbs':
    case 'deload':
    case 'reduce_training_volume':
    case 'adjust_exercises':
    case 'improve_adherence':
    case 'log_more_data':
      // No direct weight prediction; we'll measure the trend's natural
      // continuation as the baseline.
      void fatLossModeDeficit;
      return null;
  }
}
