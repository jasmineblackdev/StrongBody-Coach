// Fat loss adjustment engine. Runs on a 7–14 day cadence and composes
// signals from weight, recovery, strength, hunger, and the latest weekly
// check-in into a single primary recommendation plus a list of secondary
// observations.
//
// Design principles (from the user spec):
//   - Don't overreact to single-day weight changes
//   - Don't crash diet — recovery and strength get protected first
//   - Adjust at most every 7 days unless a serious flag fires

import type { BodyMetric, Profile, WeeklyCheckIn, WorkoutLog } from '../types';
import { computeProteinTargetG } from './macroEngine';
import { computeReadiness, type ReadinessReport } from './recoveryEngine';
import { estimateAllLifts, type LiftEstimate, type StrengthTrend } from './strengthEngine';
import { computeWeightTrend, type WeightTrendReport } from './weightTrendEngine';

export type RecommendationKind =
  | 'keep_plan'
  | 'reduce_calories'
  | 'add_steps'
  | 'shift_carbs_post_workout'
  | 'add_carbs_around_training'
  | 'flag_bloating'
  | 'reduce_volume'
  | 'deload'
  | 'add_protein'
  | 'log_more_data';

export interface Recommendation {
  kind: RecommendationKind;
  headline: string;
  body: string;
  /** Magnitude when applicable (e.g. -125 kcal, +2000 steps). */
  delta?: number;
}

export interface FatLossAnalysis {
  /** Should the engine emit a fresh recommendation right now? */
  shouldRunNow: boolean;
  /** Days since last check-in; null if none. */
  daysSinceLastCheckIn: number | null;
  weight: WeightTrendReport;
  recovery: ReadinessReport;
  strengthOverall: StrengthTrend;
  recommendations: Recommendation[];
  primary: Recommendation;
}

export interface AnalysisInput {
  profile: Profile;
  metrics: BodyMetric[];
  logs: WorkoutLog[];
  checkIns: WeeklyCheckIn[];
}

const KEEP: Recommendation = {
  kind: 'keep_plan',
  headline: 'Keep the plan',
  body: 'Nothing strong enough to act on yet. Stay consistent and check in again in 7 days.',
};

export function analyzeFatLoss(input: AnalysisInput): FatLossAnalysis {
  const { profile, metrics, logs, checkIns } = input;

  const weight = computeWeightTrend(metrics, profile);
  const recovery = computeReadiness(logs);
  const lifts = estimateAllLifts(logs, {
    baselines: {
      squat: profile.squat1RM,
      bench: profile.bench1RM,
      deadlift: profile.deadlift1RM,
    },
  });
  const strengthOverall = aggregateStrengthTrend(lifts);

  const lastCheckIn = [...checkIns].sort((a, b) =>
    b.date.localeCompare(a.date),
  )[0];
  const daysSinceLastCheckIn = lastCheckIn
    ? Math.floor(
        (Date.now() - new Date(lastCheckIn.date).getTime()) / 86400000,
      )
    : null;
  const shouldRunNow =
    daysSinceLastCheckIn === null || daysSinceLastCheckIn >= 7;

  const recs: Recommendation[] = [];

  // Not enough data to do anything intelligent
  if (metrics.length < 3 && logs.length < 3) {
    recs.push({
      kind: 'log_more_data',
      headline: 'Log a week first',
      body:
        'I need 7–10 days of weight and a few workouts before I can make a real call. Daily weigh-in + log the next 3 sessions and I can read the signal.',
    });
    return finalize(recs, weight, recovery, strengthOverall, daysSinceLastCheckIn, shouldRunNow);
  }

  // ── Recovery dominates: never cut food when readiness is in the red ──
  if (recovery.suggestion === 'deload') {
    recs.push({
      kind: 'deload',
      headline: 'Deload first, food second',
      body:
        `Readiness is ${recovery.score}/100 over your last ${recovery.metrics.sessionsAnalyzed} sessions. ` +
        'Pull volume back 30–40% this week. Don\'t cut calories on top of a recovery hole — that\'s how injuries happen.',
    });
    return finalize(recs, weight, recovery, strengthOverall, daysSinceLastCheckIn, shouldRunNow);
  }

  if (recovery.suggestion === 'reduce') {
    recs.push({
      kind: 'reduce_volume',
      headline: 'Reduce training volume before food',
      body:
        'Recovery is dragging. Cut training volume ~15% this week before tightening the diet — fat loss without recovery stalls fast.',
    });
  }

  // ── Strength regressing on a cut → add carbs around training, don't cut more ──
  if (strengthOverall === 'regressing' && profile.goal === 'fat_loss') {
    recs.push({
      kind: 'add_carbs_around_training',
      headline: 'Add carbs around training',
      body:
        'Strength is regressing on a fat-loss block. Move 30–50g of carbs into the meals immediately before AND after training before any further calorie cut.',
    });
  }

  // ── High hunger → shift carbs, not slash calories ──
  const hunger = avgRecentHunger(logs);
  if (hunger >= 7) {
    recs.push({
      kind: 'shift_carbs_post_workout',
      headline: 'Shift carbs to post-workout',
      body: `Avg hunger after training is ${hunger.toFixed(1)}/10. Don't cut food — move 30–40g of your existing daily carbs into the post-workout meal first.`,
    });
  }

  // ── Weight trend rules ──
  if (weight.confidence === 'low' && metrics.length < 7) {
    recs.push({
      kind: 'log_more_data',
      headline: 'Daily weigh-in for 7+ days',
      body:
        `Only ${metrics.length} weight entr${metrics.length === 1 ? 'y' : 'ies'} — I can't separate water swings from real loss yet. Daily weigh-in for a week and the trend gets honest.`,
    });
  } else if (weight.trend === 'losing') {
    const rate = Math.abs(weight.weeklyChange);
    if (rate >= 1 && rate <= 2) {
      recs.push({
        kind: 'keep_plan',
        headline: 'Keep the plan — you\'re in the zone',
        body: `7-day avg trending down ${rate.toFixed(1)} lb/wk. That's the sweet spot. Don't change anything for at least 7 more days.`,
      });
    } else if (rate > 2) {
      recs.push({
        kind: 'add_protein',
        headline: 'Slow it down — too fast',
        body: `Losing ${rate.toFixed(1)} lb/wk is too aggressive — you'll lose muscle. Hold protein at ${computeProteinTargetG(
          profile,
        )}g+ and add 100 kcal back if hunger is climbing.`,
        delta: 100,
      });
    }
  } else if (
    weight.trend === 'stable' &&
    weight.confidence !== 'low' &&
    profile.goal === 'fat_loss'
  ) {
    // Choose between calorie cut and steps based on hunger and recovery
    const adherenceGood =
      lastCheckIn?.caloriesAdherence === 'yes' &&
      lastCheckIn?.proteinAdherence !== 'no';
    if (!adherenceGood && lastCheckIn) {
      recs.push({
        kind: 'keep_plan',
        headline: 'Tighten adherence before tightening calories',
        body:
          'Weight is stable but adherence wasn\'t fully there. Hit the current targets cleanly for 7 days before we cut anything.',
      });
    } else if (hunger >= 6) {
      recs.push({
        kind: 'add_steps',
        headline: 'Add 2000 steps/day',
        body:
          'Weight has been flat for 7+ days at your current intake. Hunger is moderate, so let\'s add 2000 steps/day before cutting food.',
        delta: 2000,
      });
    } else {
      recs.push({
        kind: 'reduce_calories',
        headline: 'Reduce calories 100–150',
        body:
          'Weight has been flat for 7+ days and recovery looks fine. Cut 100–150 kcal (one carb portion or a fat serving) and reassess in 7 days.',
        delta: -125,
      });
    }
  }

  // ── Bloating from check-in ──
  if (lastCheckIn && lastCheckIn.bloatingLevel >= 7) {
    recs.push({
      kind: 'flag_bloating',
      headline: 'Flag your bloat triggers',
      body:
        'Bloating is high. For the next 3 days, track sodium, fiber, and water carefully. Common culprits: cruciferous veg + sugar alcohols + low water + late dinners.',
    });
  }

  // ── Default if nothing fired ──
  if (!recs.length) {
    recs.push(KEEP);
  }

  return finalize(recs, weight, recovery, strengthOverall, daysSinceLastCheckIn, shouldRunNow);
}

// ─── helpers ────────────────────────────────────────────────────────────────

function aggregateStrengthTrend(
  lifts: Record<'squat' | 'bench' | 'deadlift', LiftEstimate>,
): StrengthTrend {
  const trends = [lifts.squat.trend, lifts.bench.trend, lifts.deadlift.trend];
  if (trends.every((t) => t === 'unknown')) return 'unknown';
  if (trends.filter((t) => t === 'regressing').length >= 2) return 'regressing';
  if (trends.filter((t) => t === 'improving').length >= 2) return 'improving';
  return 'flat';
}

function avgRecentHunger(logs: WorkoutLog[], lookback = 5): number {
  const recent = [...logs]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, lookback);
  const vals = recent
    .map((l) => l.hungerAfter ?? 0)
    .filter((n) => n > 0);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

function finalize(
  recs: Recommendation[],
  weight: WeightTrendReport,
  recovery: ReadinessReport,
  strengthOverall: StrengthTrend,
  daysSinceLastCheckIn: number | null,
  shouldRunNow: boolean,
): FatLossAnalysis {
  return {
    shouldRunNow,
    daysSinceLastCheckIn,
    weight,
    recovery,
    strengthOverall,
    recommendations: recs,
    primary: recs[0],
  };
}

// ─── UI helper ──────────────────────────────────────────────────────────────

export function recommendationTone(
  kind: RecommendationKind,
): 'success' | 'warning' | 'danger' | 'accent' {
  switch (kind) {
    case 'keep_plan':
      return 'success';
    case 'reduce_calories':
    case 'add_steps':
    case 'shift_carbs_post_workout':
    case 'add_carbs_around_training':
    case 'flag_bloating':
      return 'accent';
    case 'reduce_volume':
    case 'add_protein':
    case 'log_more_data':
      return 'warning';
    case 'deload':
      return 'danger';
  }
}
