// Rule-based macro target calculator. Pure function over profile + context.
// No APIs, no ML.

import type { BodyMetric, Profile, WorkoutLog } from '../types';

export type WeightTrend = 'losing' | 'stable' | 'gaining' | 'unknown';

export interface MacroTargets {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** Why we ended up at this number (each adjustment leaves a note). */
  notes: string[];
  trend: WeightTrend;
  trendRateLbsPerWeek: number;
}

export interface MacroInput {
  profile: Profile;
  isTrainingDay: boolean;
  /** Today's hunger score (1–10). */
  hungerLevel?: number;
  /** Body metric history — used for weekly weight trend detection. */
  metrics?: BodyMetric[];
  /** Recent workout logs — used for hunger-after pattern. */
  recentLogs?: WorkoutLog[];
}

/**
 * Adaptive protein target in grams. Adjusts to goal + bodyweight + goal weight.
 *
 * Rules (per ISSA / common evidence-based fat-loss programming):
 *   - fat_loss / recomp: max(currentLb × 1.0, goalLb × 1.2) — preserve muscle
 *     during the cut. Higher of the two formulas wins so very heavy lifters
 *     trying to drop a lot don't accidentally undershoot.
 *   - strength / meet_prep: currentLb × 1.0
 *   - default (maintenance / unclassified): currentLb × 0.8
 *
 * If the user has explicitly set `proteinTargetG` on their profile, that
 * override always wins.
 */
export function computeProteinTargetG(p: Profile): number {
  if (p.proteinTargetG && p.proteinTargetG > 0) return p.proteinTargetG;
  switch (p.goal) {
    case 'fat_loss':
    case 'recomp':
      return Math.max(
        Math.round(p.weightLbs * 1.0),
        Math.round(p.goalWeightLbs * 1.2),
      );
    case 'strength':
    case 'meet_prep':
      return Math.round(p.weightLbs * 1.0);
    default:
      return Math.round(p.weightLbs * 0.8);
  }
}

/**
 * Returns age in whole years. Prefers `birthDate` (auto-updates every year)
 * with a graceful fallback to the `age` field on the profile.
 */
export function computeAgeYears(p: Profile): number {
  if (p.birthDate) {
    const bd = new Date(p.birthDate);
    if (!Number.isNaN(bd.getTime())) {
      const now = new Date();
      let age = now.getFullYear() - bd.getFullYear();
      const m = now.getMonth() - bd.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < bd.getDate())) age -= 1;
      if (age >= 5 && age <= 120) return age;
    }
  }
  return p.age;
}

// Mifflin-St Jeor for women.
function bmrFemale(p: Profile): number {
  const kg = p.weightLbs * 0.4536;
  const cm = p.heightInches * 2.54;
  return 10 * kg + 6.25 * cm - 5 * computeAgeYears(p) - 161;
}

/**
 * Cardio sessions implied by the user's `cardioPref`. Used by the activity
 * multiplier when combining with strength training days.
 */
function cardioDaysFromPref(pref: Profile['cardioPref']): number {
  switch (pref) {
    case 'high':
      return 4;
    case 'moderate':
      return 2.5;
    case 'low':
      return 1;
    default:
      return 0;
  }
}

/**
 * Total weekly active days = strength training days + implied cardio days.
 * Capped at 7.
 */
export function activeDaysPerWeek(p: Profile): number {
  const train = Math.min(7, Math.max(0, p.trainingDaysPerWeek ?? 0));
  return Math.min(7, train + cardioDaysFromPref(p.cardioPref));
}

/**
 * Activity multiplier mapped from total weekly active days. Standard Mifflin
 * brackets, slightly conservative at the upper end (1.7 instead of 1.725 for
 * 6+ days) to avoid overshooting maintenance for non-athletes. Training days
 * sit ~5% above the weekly average; rest days sit ~5% below.
 */
function activityMultiplier(p: Profile, isTrainingDay: boolean): number {
  const days = activeDaysPerWeek(p);
  let weeklyBase: number;
  if (days <= 1) weeklyBase = 1.2;
  else if (days <= 3) weeklyBase = 1.4;
  else if (days <= 5) weeklyBase = 1.55;
  else weeklyBase = 1.7;
  return isTrainingDay ? weeklyBase + 0.05 : weeklyBase - 0.05;
}

/**
 * Compute lb/week change over a body-metrics window. Filters to the last
 * `weeks` weeks; falls back to the available metrics if not enough.
 */
export function weeklyWeightTrend(
  metrics: BodyMetric[] | undefined,
  weeks = 4,
): { rate: number; trend: WeightTrend; samples: number } {
  if (!metrics || metrics.length < 2) {
    return { rate: 0, trend: 'unknown', samples: metrics?.length ?? 0 };
  }
  const sorted = [...metrics]
    .filter((m) => typeof m.weightLbs === 'number')
    .sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 2) return { rate: 0, trend: 'unknown', samples: sorted.length };

  const cutoff = Date.now() - weeks * 7 * 86400000;
  const window = sorted.filter((m) => new Date(m.date).getTime() >= cutoff);
  const series = window.length >= 2 ? window : sorted;

  const first = series[0];
  const last = series[series.length - 1];
  if (first.weightLbs == null || last.weightLbs == null) {
    return { rate: 0, trend: 'unknown', samples: series.length };
  }
  const days =
    (new Date(last.date).getTime() - new Date(first.date).getTime()) / 86400000 || 1;
  const lbsPerWeek = ((last.weightLbs - first.weightLbs) / days) * 7;
  const rounded = Number(lbsPerWeek.toFixed(2));

  let trend: WeightTrend = 'stable';
  if (lbsPerWeek <= -0.4) trend = 'losing';
  else if (lbsPerWeek >= 0.4) trend = 'gaining';

  return { rate: rounded, trend, samples: series.length };
}

/** "18:00" → "6 PM", "07:30" → "7:30 AM". Returns null on bad input. */
function formatTimeDisplay(time: string): string | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!m) return null;
  const h24 = Number(m[1]);
  const min = Number(m[2]);
  if (h24 < 0 || h24 > 23 || min < 0 || min > 59) return null;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  return min === 0 ? `${h12} ${period}` : `${h12}:${m[2]} ${period}`;
}

function recentAvgHunger(logs?: WorkoutLog[], lookback = 3): number {
  if (!logs?.length) return 0;
  const recent = [...logs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, lookback);
  const vals = recent
    .map((l) => l.hungerAfter)
    .filter((n): n is number => typeof n === 'number' && n > 0);
  return vals.length ? vals.reduce((s, n) => s + n, 0) / vals.length : 0;
}

export function computeMacroTargets(input: MacroInput): MacroTargets {
  const { profile, isTrainingDay, hungerLevel, metrics, recentLogs } = input;
  const notes: string[] = [];

  let calories = bmrFemale(profile) * activityMultiplier(profile, isTrainingDay);

  // ─── Goal baseline ──────────────────────────────────────────────────────
  if (profile.goal === 'fat_loss') {
    calories -= 450;
    notes.push('−450 kcal for fat-loss target.');
  } else if (profile.goal === 'recomp') {
    calories -= 250;
    notes.push('−250 kcal recomp deficit.');
  } else if (profile.goal === 'meet_prep') {
    calories += 50;
    notes.push('+50 kcal for meet prep.');
  }

  // ─── Weight trend correction ───────────────────────────────────────────
  // H1 fix: require ≥7 samples before adjusting calories on trend signal.
  // Two or three weigh-ins is just noise — cutting 100 kcal off that is
  // premature and stacks on top of the goal deficit.
  const trend = weeklyWeightTrend(metrics);
  const TREND_MIN_SAMPLES = 7;
  if (profile.goal === 'fat_loss') {
    if (trend.trend === 'stable' && trend.samples >= TREND_MIN_SAMPLES) {
      calories -= 100;
      notes.push(
        `Weight has stalled (${trend.rate} lb/wk over ${trend.samples} measurements) — dropping 100 kcal.`,
      );
    } else if (
      trend.trend === 'losing' &&
      trend.rate <= -1.5 &&
      trend.samples >= TREND_MIN_SAMPLES
    ) {
      calories += 100;
      notes.push(
        `Losing fast (${Math.abs(trend.rate)} lb/wk) — adding 100 kcal to protect muscle.`,
      );
    } else if (
      trend.trend === 'gaining' &&
      trend.samples >= TREND_MIN_SAMPLES
    ) {
      calories -= 150;
      notes.push(
        `Trending up on a fat-loss block (${trend.rate} lb/wk) — dropping 150 kcal.`,
      );
    }
  } else if (profile.goal === 'recomp') {
    if (trend.trend === 'gaining' && trend.samples >= TREND_MIN_SAMPLES) {
      calories -= 100;
      notes.push(`Recomp drifting up (${trend.rate} lb/wk) — dropping 100 kcal.`);
    }
  }

  // ─── Wegovy modulation ─────────────────────────────────────────────────
  if (profile.onWegovy) {
    if ((hungerLevel ?? 5) <= 3) {
      calories -= 100;
      notes.push(
        `Wegovy + low hunger today (${hungerLevel}/10) — soft floor adjustment of −100 kcal.`,
      );
    }
    notes.push(
      'Wegovy: front-load protein at breakfast/lunch so dinner is easy when appetite spikes.',
    );
  }

  // ─── Today's hunger correction ─────────────────────────────────────────
  let extraCarbsG = 0;
  if (typeof hungerLevel === 'number' && hungerLevel >= 8) {
    calories += 150;
    extraCarbsG += 30;
    notes.push(`Hunger ${hungerLevel}/10 today — +150 kcal post-workout carbs.`);
  }

  // ─── Cross-session hunger pattern ──────────────────────────────────────
  const avgHunger = recentAvgHunger(recentLogs);
  if (avgHunger >= 7) {
    notes.push(
      `Avg hunger after recent training is ${avgHunger.toFixed(1)}/10 — keeping carbs around the workout window.`,
    );
  }

  // ─── Time-of-workout context (training days only) ──────────────────────
  if (isTrainingDay && profile.workoutTime) {
    const display = formatTimeDisplay(profile.workoutTime);
    if (display) {
      notes.push(
        `Fueling your ${display} workout — carbs shifted to the pre-workout meal (~90 min prior).`,
      );
      notes.push(
        'Post-workout meal is the highest-protein, moderate-carb meal of the day — optimized for muscle retention.',
      );
    }
  }

  // Bodyweight-aware floor: never crash-diet. Floor scales with bodyweight so
  // a 220-lb lifter doesn't get prescribed 1450 kcal. The hard minimum is
  // 1500 kcal and we never go below ~85% of BMR.
  const bmrFloor = Math.round(bmrFemale(profile) * 0.85);
  const weightFloor = Math.round(profile.weightLbs * 8);
  const hardFloor = Math.max(1500, weightFloor, bmrFloor);
  if (calories < hardFloor) {
    notes.push(
      `Hard floor at ${hardFloor} kcal — never crash diet. Recovery and muscle need fuel.`,
    );
    calories = hardFloor;
  }
  calories = Math.round(calories / 10) * 10;

  // ─── Macros ────────────────────────────────────────────────────────────
  // Adaptive protein target — computed from goal + bodyweight + goal weight,
  // unless the user has explicitly set a manual value on their profile.
  const proteinG = computeProteinTargetG(profile);
  const proteinCals = proteinG * 4;
  const carbsRatio = isTrainingDay ? 0.45 : 0.32;
  let carbsG = Math.round((carbsRatio * calories) / 4) + extraCarbsG;
  const carbCals = carbsG * 4;
  const fatCals = Math.max(0, calories - proteinCals - carbCals);
  const fatG = Math.max(40, Math.round(fatCals / 9));

  return {
    calories,
    proteinG,
    carbsG,
    fatG,
    notes,
    trend: trend.trend,
    trendRateLbsPerWeek: trend.rate,
  };
}

// ─── Profile-side calculation breakdown ─────────────────────────────────────
// "Show your work" for the macro UI — like a nutritionist's worksheet so the
// user can see exactly how the numbers were derived from their stats.

export interface MacroBreakdown {
  age: number;
  bmr: number;
  activeDays: number;
  weeklyMultiplier: number;
  trainingDayTdee: number;
  restDayTdee: number;
  goalDeficit: number;
  trainingDayTarget: number;
  restDayTarget: number;
  hardFloor: number;
  proteinG: number;
  proteinFormula: string;
  carbsTrainingG: number;
  carbsRestG: number;
  fatTrainingG: number;
  fatRestG: number;
}

export function computeMacroBreakdown(profile: Profile): MacroBreakdown {
  const age = computeAgeYears(profile);
  const bmr = Math.round(bmrFemale(profile));
  const activeDays = activeDaysPerWeek(profile);

  const trainingMult = activityMultiplier(profile, true);
  const restMult = activityMultiplier(profile, false);
  const weeklyMultiplier = (trainingMult + restMult) / 2;

  const trainingDayTdee = Math.round(bmr * trainingMult);
  const restDayTdee = Math.round(bmr * restMult);

  const goalDeficit =
    profile.goal === 'fat_loss'
      ? -450
      : profile.goal === 'recomp'
      ? -250
      : profile.goal === 'meet_prep'
      ? 50
      : 0;

  const hardFloor = Math.max(
    1500,
    Math.round(profile.weightLbs * 8),
    Math.round(bmr * 0.85),
  );
  const trainingDayTarget = Math.max(hardFloor, trainingDayTdee + goalDeficit);
  const restDayTarget = Math.max(hardFloor, restDayTdee + goalDeficit);

  const proteinG = computeProteinTargetG(profile);
  let proteinFormula: string;
  if (profile.proteinTargetG && profile.proteinTargetG > 0) {
    proteinFormula = `manual override (${profile.proteinTargetG} g)`;
  } else if (profile.goal === 'fat_loss' || profile.goal === 'recomp') {
    proteinFormula = `max(${profile.weightLbs} lb × 1.0, ${profile.goalWeightLbs} lb × 1.2)`;
  } else if (profile.goal === 'strength' || profile.goal === 'meet_prep') {
    proteinFormula = `${profile.weightLbs} lb × 1.0 g/lb`;
  } else {
    proteinFormula = `${profile.weightLbs} lb × 0.8 g/lb`;
  }

  // Carbs / fat split mirrors computeMacroTargets — 0.45 ratio on training,
  // 0.32 on rest, 40 g fat floor.
  const carbsTrainingG = Math.round((0.45 * trainingDayTarget) / 4);
  const carbsRestG = Math.round((0.32 * restDayTarget) / 4);
  const fatTrainingG = Math.max(
    40,
    Math.round((trainingDayTarget - proteinG * 4 - carbsTrainingG * 4) / 9),
  );
  const fatRestG = Math.max(
    40,
    Math.round((restDayTarget - proteinG * 4 - carbsRestG * 4) / 9),
  );

  return {
    age,
    bmr,
    activeDays,
    weeklyMultiplier,
    trainingDayTdee,
    restDayTdee,
    goalDeficit,
    trainingDayTarget,
    restDayTarget,
    hardFloor,
    proteinG,
    proteinFormula,
    carbsTrainingG,
    carbsRestG,
    fatTrainingG,
    fatRestG,
  };
}
