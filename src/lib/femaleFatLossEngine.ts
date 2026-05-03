// Female-aware fat-loss interpretation layer.
//
// Sits between weightTrendEngine and weeklyDecisionEngine. Reads the same
// inputs the Coach Brain reads, plus check-in bloating/hunger/cyclePhase,
// and produces a state classification + override flags. The Coach Brain
// consumes this report before its own decision tree runs.
//
// The point: female fat loss is non-linear. A 1.5-lb scale jump during
// luteal is water + bloat, not fat gain. Cutting calories on top of that
// signal is how plateaus turn into stalls turn into binges. This layer
// stops that.
//
// Pure function, deterministic, no ML. macroEngine is not touched.

import type {
  BodyMetric,
  CyclePhase,
  WeeklyCheckIn,
  WorkoutLog,
} from '../types';

export type FatLossState =
  | 'on_track'
  | 'water_retention'
  | 'false_plateau'
  | 'true_plateau'
  | 'mid_cycle_caution'
  | 'hunger_hormonal'
  | 'losing_too_fast'
  | 'insufficient_data';

/** Decision kinds the female layer can BLOCK from being recommended. */
export type BlockedDecisionKind =
  | 'reduce_calories'
  | 'shift_carbs'
  | 'increase_steps';

export type FatLossTone = 'success' | 'accent' | 'warning' | 'danger';

export interface FemaleFatLossReport {
  state: FatLossState;
  tone: FatLossTone;
  /** One-line headline shown on the Dashboard insight card. */
  headline: string;
  /** 1–2 sentence plain-English explanation. */
  explanation: string;
  /** What the user should actually do this week. */
  recommendedAction: string;
  /**
   * When true, the Coach Brain should respect the override below instead
   * of running its own decision tree.
   */
  overrideDecision: boolean;
  /**
   * Decisions the female layer is blocking — even if Coach Brain would
   * otherwise pick them. The CoachBrain consults this list before
   * settling on a recommendation.
   */
  blockedActions: BlockedDecisionKind[];
  /**
   * Explicit recommended decision when overrideDecision is true. Coach
   * Brain emits this kind with the headline/explanation as the reason.
   */
  forcedDecision?:
    | { kind: 'stay_course'; reason: string }
    | { kind: 'increase_steps'; reason: string };
  /** Smoothed weight trend, robust to single-day spikes. */
  smoothed: {
    /** Smoothed lb/week change. Negative = losing. */
    rate: number;
    direction: 'losing' | 'stable' | 'gaining' | 'unknown';
    /**
     * Number of days the smoothed trend has been "stable" (|rate| ≤ 0.4 lb/wk).
     * 0 when actively losing or gaining; up to the analysis window when flat.
     */
    stableDays: number;
    /** Number of weight metrics inside the 14-day window. */
    sampleCount: number;
  };
  /**
   * Inferred or self-reported cycle phase. Only populated when the user
   * supplied it on a recent check-in or when bloating patterns are
   * unmistakable; otherwise undefined.
   */
  cyclePhase?: CyclePhase;
  /** Was the cycle phase self-reported (true) or inferred (false)? */
  cyclePhaseSource?: 'self_reported' | 'inferred';
}

export interface FemaleFatLossInput {
  metrics: BodyMetric[];
  recentLogs: WorkoutLog[];
  checkIns: WeeklyCheckIn[];
}

// ─── Smoothing helpers ─────────────────────────────────────────────────────

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function metricsInWindow(metrics: BodyMetric[], days: number): BodyMetric[] {
  const cutoff = Date.now() - days * 86400000;
  return metrics
    .filter((m) => typeof m.weightLbs === 'number')
    .filter((m) => new Date(m.date).getTime() >= cutoff)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Smoothed weekly change using median-of-first-half vs median-of-second-half
 * over the last 14 days. Medians ignore single-day spikes (water retention,
 * post-carb meal weight) so the trend is robust without manual outlier
 * removal.
 */
function smoothedWeeklyChange(metrics: BodyMetric[]): {
  rate: number;
  direction: 'losing' | 'stable' | 'gaining' | 'unknown';
  sampleCount: number;
} {
  const window = metricsInWindow(metrics, 14);
  const sampleCount = window.length;
  if (sampleCount < 7) {
    return { rate: 0, direction: 'unknown', sampleCount };
  }
  const half = Math.floor(sampleCount / 2);
  const firstHalf = window.slice(0, half).map((m) => m.weightLbs as number);
  const secondHalf = window.slice(-half).map((m) => m.weightLbs as number);
  const m1 = median(firstHalf);
  const m2 = median(secondHalf);
  const days =
    (new Date(window[window.length - 1].date).getTime() -
      new Date(window[0].date).getTime()) /
    86400000;
  const safeDays = Math.max(1, days);
  const rate = +(((m2 - m1) / safeDays) * 7).toFixed(2);
  let direction: 'losing' | 'stable' | 'gaining' | 'unknown' = 'stable';
  if (rate <= -0.4) direction = 'losing';
  else if (rate >= 0.4) direction = 'gaining';
  return { rate, direction, sampleCount };
}

/**
 * "Stable days" = how long the smoothed trend has been hovering. We count
 * back from the newest entry while each rolling 7-day median stays within
 * ±0.4 lb of the centered window's overall median. Capped at the
 * window length.
 */
function computeStableDays(
  metrics: BodyMetric[],
  smoothedRate: number,
): number {
  if (Math.abs(smoothedRate) > 0.4) return 0;
  const window = metricsInWindow(metrics, 14);
  if (window.length < 7) return window.length;
  // Walk back from newest, find earliest day still within stable band.
  const overallMedian = median(window.map((m) => m.weightLbs as number));
  let firstStableDate: string | null = null;
  for (let i = 0; i < window.length; i++) {
    const w = window[i].weightLbs as number;
    if (Math.abs(w - overallMedian) <= 1.5) {
      firstStableDate = window[i].date;
      break;
    }
  }
  if (!firstStableDate) return 0;
  const days = Math.round(
    (Date.now() - new Date(firstStableDate).getTime()) / 86400000,
  );
  return Math.min(14, Math.max(0, days));
}

// ─── Water retention spike detection ───────────────────────────────────────

interface SpikeAnalysis {
  recentSpikeLbs: number; // positive = up, negative = down
  hadEnoughData: boolean;
}

function recentSpike(metrics: BodyMetric[]): SpikeAnalysis {
  // Compare median of last 3 readings vs median of the prior 3 readings.
  // Robust to a single weird day.
  const sorted = metrics
    .filter((m) => typeof m.weightLbs === 'number')
    .sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 6) return { recentSpikeLbs: 0, hadEnoughData: false };
  const recent3 = sorted.slice(-3).map((m) => m.weightLbs as number);
  const prior3 = sorted.slice(-6, -3).map((m) => m.weightLbs as number);
  const delta = +(median(recent3) - median(prior3)).toFixed(1);
  return { recentSpikeLbs: delta, hadEnoughData: true };
}

// ─── Adherence helper ──────────────────────────────────────────────────────

const ADHERENCE_VAL = { yes: 1.0, mostly: 0.8, no: 0.5 } as const;

function adherenceScore(checkIn?: WeeklyCheckIn): number {
  if (!checkIn) return 0;
  const cal = ADHERENCE_VAL[checkIn.caloriesAdherence];
  const pro = ADHERENCE_VAL[checkIn.proteinAdherence];
  const work =
    checkIn.workoutsPlanned > 0
      ? Math.min(1, checkIn.workoutsCompleted / checkIn.workoutsPlanned)
      : 0;
  return +((cal + pro + work) / 3).toFixed(2);
}

// ─── Cycle phase inference ─────────────────────────────────────────────────

function inferCyclePhase(
  checkIns: WeeklyCheckIn[],
): { phase: CyclePhase | undefined; source: 'self_reported' | 'inferred' | undefined } {
  // Self-reported wins if present.
  const last = checkIns[0];
  if (last?.cyclePhase) {
    return { phase: last.cyclePhase, source: 'self_reported' };
  }
  // Light inference: if the last 1–2 check-ins both show high bloating
  // (≥6) AND the user hasn't reported menstrual recently, lean toward
  // luteal as a soft tag. Keep this conservative — false confidence here
  // is worse than no signal.
  const last2 = checkIns.slice(0, 2);
  if (last2.length >= 2 && last2.every((c) => c.bloatingLevel >= 6)) {
    return { phase: 'luteal', source: 'inferred' };
  }
  return { phase: undefined, source: undefined };
}

// ─── Main entry ────────────────────────────────────────────────────────────

export function analyzeFemaleFatLoss(
  input: FemaleFatLossInput,
): FemaleFatLossReport {
  const { metrics, checkIns } = input;
  const lastCheckIn = checkIns[0];

  // Smoothed trend
  const smoothedTrend = smoothedWeeklyChange(metrics);
  const stableDays = computeStableDays(metrics, smoothedTrend.rate);
  const smoothed = { ...smoothedTrend, stableDays };

  // Cycle phase
  const cycle = inferCyclePhase(checkIns);

  // Insufficient data
  if (smoothed.sampleCount < 7) {
    return {
      state: 'insufficient_data',
      tone: 'warning',
      headline: 'Need more weight data',
      explanation:
        'Less than 7 days of weight readings inside the last 2 weeks — too noisy to interpret. Daily morning weigh-ins are the cheapest tool you have.',
      recommendedAction:
        'Log your weight every morning for 7+ days, then re-check this card.',
      overrideDecision: false,
      blockedActions: [],
      smoothed,
      cyclePhase: cycle.phase,
      cyclePhaseSource: cycle.source,
    };
  }

  // Water retention phase: recent spike + bloating + adherence still good
  const spike = recentSpike(metrics);
  const bloating = lastCheckIn?.bloatingLevel ?? 0;
  const hunger = lastCheckIn?.hungerLevel ?? 0;
  const adh = adherenceScore(lastCheckIn);
  const hasCheckIn = !!lastCheckIn;

  if (
    spike.hadEnoughData &&
    spike.recentSpikeLbs >= 1 &&
    spike.recentSpikeLbs <= 3 &&
    bloating >= 6 &&
    (!hasCheckIn || adh >= 0.8)
  ) {
    return {
      state: 'water_retention',
      tone: 'accent',
      headline: 'Likely water retention — not fat gain',
      explanation: `Scale jumped ${spike.recentSpikeLbs.toFixed(1)} lb in the last few days while bloating is at ${bloating}/10. Adherence is on track. This is water + inflammation, not fat.`,
      recommendedAction:
        'Hold your current calories. Bump water 16–24 oz, keep sodium and carbs steady (avoid weekend swings), and recheck the scale in 3–5 days.',
      overrideDecision: true,
      blockedActions: ['reduce_calories', 'shift_carbs'],
      forcedDecision: {
        kind: 'stay_course',
        reason: `Water retention pattern detected: +${spike.recentSpikeLbs.toFixed(1)} lb spike with bloating ${bloating}/10 and clean adherence. Don't cut food into a water signal.`,
      },
      smoothed,
      cyclePhase: cycle.phase,
      cyclePhaseSource: cycle.source,
    };
  }

  // Mid-cycle caution: explicit luteal/menstrual phase = don't cut food
  // even if other signals look like a plateau.
  if (cycle.phase === 'luteal' || cycle.phase === 'menstrual') {
    if (smoothed.direction === 'stable' || smoothed.direction === 'gaining') {
      return {
        state: 'mid_cycle_caution',
        tone: 'warning',
        headline: `Hormonal week (${cycle.phase}) — hold the plan`,
        explanation: `You're in your ${cycle.phase} phase. Water retention and inflammation routinely add 1–4 lb on the scale that drops the week after. Don't cut calories on a hormonal signal.`,
        recommendedAction:
          'Hold targets. Sleep, water, protein. Re-evaluate next week when you cycle back to follicular.',
        overrideDecision: true,
        blockedActions: ['reduce_calories'],
        forcedDecision: {
          kind: 'stay_course',
          reason: `Mid-cycle caution: ${cycle.phase} phase typically masks fat loss with water. Re-check next week.`,
        },
        smoothed,
        cyclePhase: cycle.phase,
        cyclePhaseSource: cycle.source,
      };
    }
  }

  // Hunger + hormonal interpretation
  if (
    hunger >= 7 &&
    (smoothed.direction === 'stable' || smoothed.direction === 'losing') &&
    (!hasCheckIn || adh >= 0.8)
  ) {
    return {
      state: 'hunger_hormonal',
      tone: 'warning',
      headline: 'High hunger — do not cut food',
      explanation: `Hunger at ${hunger}/10 with weight ${
        smoothed.direction === 'losing' ? 'still trending down' : 'holding steady'
      } and adherence on track. This is usually hormonal, not a calorie issue.`,
      recommendedAction:
        'Add 2,000 steps/day and shift carbs around your workout (more pre/post) before touching calories. If the hunger is luteal, ride it out — it usually drops the week after.',
      overrideDecision: true,
      blockedActions: ['reduce_calories', 'shift_carbs'],
      forcedDecision: {
        kind: 'increase_steps',
        reason: `Hunger ${hunger}/10 + ${smoothed.direction === 'losing' ? 'still losing' : 'holding'} + clean adherence. Hormonal signal — never cut food into a hunger spike.`,
      },
      smoothed,
      cyclePhase: cycle.phase,
      cyclePhaseSource: cycle.source,
    };
  }

  // Losing too fast — flag but don't override (Coach Brain handles this)
  if (smoothed.direction === 'losing' && Math.abs(smoothed.rate) > 2) {
    return {
      state: 'losing_too_fast',
      tone: 'danger',
      headline: 'Losing too fast — protect muscle',
      explanation: `Smoothed trend at ${smoothed.rate.toFixed(1)} lb/wk. That rate eats muscle on top of fat and is hard to sustain on Wegovy.`,
      recommendedAction:
        'Add 100–150 kcal back, hit protein hard, and reassess next week.',
      overrideDecision: false,
      blockedActions: [],
      smoothed,
      cyclePhase: cycle.phase,
      cyclePhaseSource: cycle.source,
    };
  }

  // True plateau gate: needs ≥14 stable days + low bloating + good adherence
  if (smoothed.direction === 'stable') {
    const lowBloat = bloating > 0 && bloating < 6;
    const cleanAdherence = adh >= 0.8;
    const enoughStableDays = stableDays >= 14;

    if (enoughStableDays && lowBloat && cleanAdherence) {
      return {
        state: 'true_plateau',
        tone: 'warning',
        headline: 'Real plateau — small adjustment justified',
        explanation: `Smoothed trend has held for ${stableDays} days with low bloating (${bloating}/10) and clean adherence (${Math.round(adh * 100)}%). This isn't water — it's a real plateau.`,
        recommendedAction:
          'Coach Brain can recommend a 100–150 kcal cut OR a 2,000-step bump — pick whichever fits your week.',
        overrideDecision: false,
        blockedActions: [],
        smoothed,
        cyclePhase: cycle.phase,
        cyclePhaseSource: cycle.source,
      };
    }

    // Not enough conditions met → false plateau
    const reasons: string[] = [];
    if (!enoughStableDays) {
      reasons.push(
        `only ${stableDays} stable days (need ≥ 14)`,
      );
    }
    if (!lowBloat && bloating > 0) {
      reasons.push(`bloating at ${bloating}/10`);
    }
    if (hasCheckIn && !cleanAdherence) {
      reasons.push(`adherence at ${Math.round(adh * 100)}%`);
    }
    return {
      state: 'false_plateau',
      tone: 'accent',
      headline: 'False plateau — do not cut yet',
      explanation: `The flat scale is not a real plateau yet — ${reasons.join(', ')}. Cutting food into this signal is how stalls turn into burnout.`,
      recommendedAction:
        'Hold targets. Hit current macros clean for 7 more days. If you must move something, add steps, not subtract food.',
      overrideDecision: true,
      blockedActions: ['reduce_calories'],
      forcedDecision: {
        kind: 'stay_course',
        reason: `False plateau: ${reasons.join(' / ')}. Stay the course — consistency before subtraction.`,
      },
      smoothed,
      cyclePhase: cycle.phase,
      cyclePhaseSource: cycle.source,
    };
  }

  // Default: on track
  if (smoothed.direction === 'losing') {
    return {
      state: 'on_track',
      tone: 'success',
      headline: 'Fat loss is on track',
      explanation: `Smoothed trend at ${smoothed.rate.toFixed(1)} lb/wk — exactly where it should be. Female fat loss is non-linear; this is the linear-enough.`,
      recommendedAction:
        'Don\'t change anything. Run another check-in in 7 days; the system will tell you when an adjustment makes sense.',
      overrideDecision: false,
      blockedActions: [],
      smoothed,
      cyclePhase: cycle.phase,
      cyclePhaseSource: cycle.source,
    };
  }

  // Gaining without a hormonal explanation — fall through to Coach Brain.
  return {
    state: 'on_track',
    tone: 'accent',
    headline: 'Trend is unclear',
    explanation:
      'Not enough movement in either direction to call this a stall or progress. Stay consistent and the picture will clarify.',
    recommendedAction:
      'Hit current targets clean for 7 more days. Coach Brain will not auto-cut on noise.',
    overrideDecision: false,
    blockedActions: [],
    smoothed,
    cyclePhase: cycle.phase,
    cyclePhaseSource: cycle.source,
  };
}

// ─── UI tokens ─────────────────────────────────────────────────────────────

export const FAT_LOSS_STATE_LABEL: Record<FatLossState, string> = {
  on_track: 'On track',
  water_retention: 'Water retention',
  false_plateau: 'False plateau',
  true_plateau: 'True plateau',
  mid_cycle_caution: 'Mid-cycle caution',
  hunger_hormonal: 'Hormonal hunger',
  losing_too_fast: 'Losing too fast',
  insufficient_data: 'Insufficient data',
};
