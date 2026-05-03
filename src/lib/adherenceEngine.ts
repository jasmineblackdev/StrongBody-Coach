// Adherence + plateau detection. Single-purpose decision tree that answers
// "why isn't fat loss happening this week?". Reads weight trend, the most
// recent weekly check-in, and recent logs — and returns a single action.
//
// Pure function, no APIs, no schema changes. Composes existing engine
// outputs (weightTrendEngine + weekly check-in data + workout logs).

import type { AdherenceLevel, WeeklyCheckIn, WorkoutLog } from '../types';
import type { WeightTrendReport } from './weightTrendEngine';

// ─── Adherence scoring ───────────────────────────────────────────────────────

const ADHERENCE_VAL: Record<AdherenceLevel, number> = {
  yes: 1.0,
  mostly: 0.8,
  no: 0.5,
};

const ADHERENCE_LABEL: Record<AdherenceLevel, string> = {
  yes: 'on target',
  mostly: 'mostly',
  no: 'off',
};

export interface AdherenceReport {
  /** 0–1 composite. Anything ≥ 0.8 counts as "good". */
  score: number;
  components: {
    calories: number;
    protein: number;
    workouts: number;
  };
  /** Were adherence inputs available? When false, score is 0. */
  hasCheckIn: boolean;
}

export function computeAdherence(
  checkIn: WeeklyCheckIn | undefined,
): AdherenceReport {
  if (!checkIn) {
    return {
      score: 0,
      components: { calories: 0, protein: 0, workouts: 0 },
      hasCheckIn: false,
    };
  }
  const cal = ADHERENCE_VAL[checkIn.caloriesAdherence];
  const pro = ADHERENCE_VAL[checkIn.proteinAdherence];
  const work =
    checkIn.workoutsPlanned > 0
      ? Math.min(1, checkIn.workoutsCompleted / checkIn.workoutsPlanned)
      : 0;
  const score = +((cal + pro + work) / 3).toFixed(2);
  return {
    score,
    components: { calories: cal, protein: pro, workouts: work },
    hasCheckIn: true,
  };
}

// ─── Plateau detection ──────────────────────────────────────────────────────

export type PlateauActionKind =
  | 'fix_adherence'
  | 'increase_steps'
  | 'reduce_calories'
  | 'stay_course'
  | 'increase_calories'
  | 'log_more_data';

export interface PlateauReport {
  primaryAction: PlateauActionKind;
  headline: string;
  reason: string;
  confidence: 'low' | 'medium' | 'high';
  adherence: AdherenceReport;
}

export interface AdherenceInput {
  weightTrend: WeightTrendReport;
  /** The most recent weekly check-in, or undefined. */
  lastCheckIn: WeeklyCheckIn | undefined;
  /** Recent workout logs — used to read post-training hunger pattern. */
  recentLogs: WorkoutLog[];
}

function avgRecentHunger(logs: WorkoutLog[], lookback = 5): number {
  const recent = [...logs]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, lookback);
  const vals = recent
    .map((l) => l.hungerAfter ?? 0)
    .filter((n) => n > 0);
  return vals.length ? vals.reduce((s, n) => s + n, 0) / vals.length : 0;
}

export function analyzeAdherenceAndPlateau(input: AdherenceInput): PlateauReport {
  const { weightTrend, lastCheckIn, recentLogs } = input;
  const adherence = computeAdherence(lastCheckIn);

  // Confidence model:
  //   high  = solid weight data + a recent check-in
  //   medium = one of the two
  //   low    = neither
  let confidence: 'low' | 'medium' | 'high' = 'low';
  if (weightTrend.confidence === 'high' && lastCheckIn) confidence = 'high';
  else if (
    (weightTrend.confidence === 'medium' && lastCheckIn) ||
    weightTrend.confidence === 'high'
  )
    confidence = 'medium';
  else if (weightTrend.confidence !== 'low' || lastCheckIn) confidence = 'medium';

  // Insufficient data
  if (weightTrend.confidence === 'low' && !lastCheckIn) {
    return {
      primaryAction: 'log_more_data',
      headline: 'Need more data to read the trend',
      reason:
        'Log daily weight for 7 days and complete a weekly check-in. Without those, "why isn\'t this working" is a guess.',
      confidence: 'low',
      adherence,
    };
  }

  const change = weightTrend.weeklyChange;
  const losingRate = -change; // positive = losing
  const hungerFromCheckIn = lastCheckIn?.hungerLevel ?? 0;
  const hungerFromLogs = avgRecentHunger(recentLogs);
  const hunger = Math.max(hungerFromCheckIn, hungerFromLogs);

  // Losing in the sweet spot (1–2 lb/wk)
  if (
    weightTrend.trend === 'losing' &&
    losingRate >= 1 &&
    losingRate <= 2
  ) {
    return {
      primaryAction: 'stay_course',
      headline: 'Stay the course',
      reason: `7-day avg trending down ${losingRate.toFixed(1)} lb/wk — that's the sweet spot. Don't change anything for at least 7 more days.`,
      confidence,
      adherence,
    };
  }

  // Losing too fast (>2 lb/wk)
  if (weightTrend.trend === 'losing' && losingRate > 2) {
    return {
      primaryAction: 'increase_calories',
      headline: 'Increase calories slightly',
      reason: `Losing ${losingRate.toFixed(1)} lb/wk is too aggressive — you'll lose muscle on top of fat. Add 100–150 kcal back (one extra carb portion) and reassess in 7 days.`,
      confidence,
      adherence,
    };
  }

  // Stable or gaining
  if (weightTrend.trend === 'stable' || weightTrend.trend === 'gaining') {
    if (adherence.hasCheckIn && adherence.score < 0.8) {
      const ci = lastCheckIn!;
      return {
        primaryAction: 'fix_adherence',
        headline: 'Fix adherence first',
        reason:
          `Adherence at ${Math.round(adherence.score * 100)}% — ` +
          `calories ${ADHERENCE_LABEL[ci.caloriesAdherence]}, ` +
          `protein ${ADHERENCE_LABEL[ci.proteinAdherence]}, ` +
          `workouts ${ci.workoutsCompleted}/${ci.workoutsPlanned}. ` +
          'Hit the current targets cleanly for 7 days before changing the plan — you\'re not in a plateau, you\'re in a leak.',
        confidence,
        adherence,
      };
    }

    if (hunger >= 7) {
      return {
        primaryAction: 'increase_steps',
        headline: 'Increase steps by 2,000/day',
        reason: `Weight stable + hunger averaging ${hunger.toFixed(1)}/10. Burn more without making hunger worse — add 2,000 steps/day (≈1 mile) before cutting food.`,
        confidence,
        adherence,
      };
    }

    return {
      primaryAction: 'reduce_calories',
      headline: 'Reduce calories by 100–150',
      reason:
        'Weight stable for 7+ days, hunger manageable, adherence on track. Cut 100–150 kcal — drop one carb portion or one fat serving — and reassess in 7 days.',
      confidence,
      adherence,
    };
  }

  // Fallback (trend === 'unknown' but we have some data)
  return {
    primaryAction: 'log_more_data',
    headline: 'Trend isn\'t clear yet',
    reason:
      'Stay consistent for 5–7 more days of daily weighing before changing anything.',
    confidence: 'low',
    adherence,
  };
}

// ─── UI helper ──────────────────────────────────────────────────────────────

export function plateauTone(
  kind: PlateauActionKind,
): 'success' | 'warning' | 'danger' | 'accent' {
  switch (kind) {
    case 'stay_course':
      return 'success';
    case 'fix_adherence':
    case 'log_more_data':
      return 'warning';
    case 'increase_calories':
      return 'danger';
    case 'increase_steps':
    case 'reduce_calories':
      return 'accent';
  }
}

export function plateauActionLabel(kind: PlateauActionKind): string {
  switch (kind) {
    case 'fix_adherence':
      return 'Fix adherence';
    case 'increase_steps':
      return 'Add steps';
    case 'reduce_calories':
      return 'Reduce calories';
    case 'stay_course':
      return 'Stay course';
    case 'increase_calories':
      return 'Increase calories';
    case 'log_more_data':
      return 'Log more';
  }
}
