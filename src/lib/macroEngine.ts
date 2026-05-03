// Rule-based macro target calculator. Pure function over profile + context.
// No APIs, no ML.
//
// Architecture (rewritten 2026-05 — see commit log for the rationale):
//
//   daily TDEE = BMR × lifestyleMult + workoutCredit(today)
//
// Lifestyle multiplier is NEAT only. Lifting and cardio are credited as
// per-session calorie burn ON TOP of the lifestyle baseline. The old
// design rolled lifts + cardio INTO the lifestyle multiplier, which gave
// a 4-day-lifter + 2-3 cardio user a 1.7+ multiplier (heavy-laborer
// territory) and overstated her TDEE by ~400 kcal. That's why a 227-lb
// female targeting fat loss was being prescribed ~2480 kcal training
// days and stalling.
//
// The Coach Brain (weeklyDecisionEngine) is the single source of truth for
// trend-based weekly adjustments. macroEngine no longer auto-cuts calories
// on a "stable for 7 days" signal — that's now a Coach Decision the user
// accepts, which writes a signed offset to `profile.calorieOffsetKcal`.

import type {
  BodyMetric,
  FatLossMode,
  LifestyleActivity,
  Profile,
  WorkoutLog,
} from '../types';

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
  /** Body metric history — used for legacy trend reporting only. */
  metrics?: BodyMetric[];
  /** Recent workout logs — used for hunger-after pattern. */
  recentLogs?: WorkoutLog[];
}

// ─── Lifestyle (NEAT) multiplier ───────────────────────────────────────────
//
// These are deliberately conservative compared to the Mifflin "exercise
// 4-5 days" brackets — those brackets DOUBLE-COUNT workouts because the
// engine credits each session separately below.

export const LIFESTYLE_MULTIPLIER: Record<LifestyleActivity, number> = {
  sedentary: 1.2,         // desk job, minimal walking, drives everywhere
  lightly_active: 1.3,    // ← DEFAULT. Some standing/walking, no step goal yet.
  moderately_active: 1.45, // on feet most of the day (retail, nursing, parent of toddlers)
  very_active: 1.6,       // physical labor (construction, moving, landscaping)
};

export function getLifestyleMultiplier(p: Profile): number {
  return LIFESTYLE_MULTIPLIER[p.lifestyleActivity ?? 'lightly_active'];
}

// ─── Per-session workout credits ───────────────────────────────────────────
//
// Approximate calorie burn per session. Scales loosely with bodyweight
// (≈1 kcal/lb for 60 min strength; slightly more for moderate cardio).

const LIFT_KCAL_PER_LB = 1.0;
const CARDIO_KCAL_PER_LB = 1.1;

function liftKcal(p: Profile): number {
  return Math.round(p.weightLbs * LIFT_KCAL_PER_LB);
}

function cardioKcal(p: Profile): number {
  return Math.round(p.weightLbs * CARDIO_KCAL_PER_LB);
}

function cardioSessionsPerWeek(p: Profile): number {
  switch (p.cardioPref) {
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

// ─── Fat-loss mode deficits ────────────────────────────────────────────────
//
// Deficit applied to the WEEKLY AVERAGE maintenance — not stacked on top of
// every day's TDEE. Translates to roughly:
//   conservative ≈ 0.6 lb/wk (good for recomp-leaning users + meet-cut)
//   standard     ≈ 1.0 lb/wk (the default, sweet spot)
//   performance  ≈ 1.2 lb/wk (only for users with significant fat to lose)

export const FAT_LOSS_DEFICIT: Record<FatLossMode, number> = {
  conservative: -300,
  standard: -450,
  performance: -550,
};

// ─── Heavy-bodyweight cap ───────────────────────────────────────────────────
//
// For users above 200 lb pursuing fat loss, the engine's TDEE estimate is
// often optimistic (sedentary jobs + Wegovy reduce NEAT below model
// expectations). Cap the per-day target so we never overshoot the realistic
// fat-loss zone. Acts as a CEILING only — if the math says lower, we leave
// it (subject to the hard floor below).

const HEAVY_FATLOSS_CAP_TRAIN = 2150;
const HEAVY_FATLOSS_CAP_REST = 1950;
const HEAVY_THRESHOLD_LB = 200;

// ─── Protein ────────────────────────────────────────────────────────────────

/**
 * Adaptive protein target in grams. Adjusts to goal + bodyweight + goal weight.
 *
 * Rules (per ISSA / common evidence-based fat-loss programming):
 *   - fat_loss / recomp: when current weight is well above goal weight,
 *     blindly using bodyLb × 1.0 over-prescribes protein (e.g., 227 g for a
 *     227-lb lifter). Adjusted body weight smooths this:
 *       adjusted = goalLb + 0.3 × (currentLb − goalLb)
 *       protein  = adjusted × 1.0  (rounded to nearest 5 g)
 *     For 227 lb → 165 lb goal: adjusted = 183.6 → 185 g protein.
 *     If currentLb ≤ goalLb (already at goal), use currentLb × 1.0.
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
    case 'recomp': {
      if (p.weightLbs <= p.goalWeightLbs) {
        return Math.round(p.weightLbs * 1.0);
      }
      const adjusted = p.goalWeightLbs + 0.3 * (p.weightLbs - p.goalWeightLbs);
      return Math.max(5, Math.round(adjusted / 5) * 5);
    }
    case 'strength':
    case 'meet_prep':
      return Math.round(p.weightLbs * 1.0);
    default:
      return Math.round(p.weightLbs * 0.8);
  }
}

/**
 * Plain-language formula description so the UI can explain the protein
 * number without re-implementing the rules.
 */
export function proteinFormulaDescription(p: Profile): string {
  if (p.proteinTargetG && p.proteinTargetG > 0) {
    return `manual override (${p.proteinTargetG} g)`;
  }
  if (
    (p.goal === 'fat_loss' || p.goal === 'recomp') &&
    p.weightLbs > p.goalWeightLbs
  ) {
    return `adjusted body weight: ${p.goalWeightLbs} lb + 0.3 × (${p.weightLbs} − ${p.goalWeightLbs}) lb`;
  }
  if (p.goal === 'fat_loss' || p.goal === 'recomp') {
    return `${p.weightLbs} lb × 1.0 g/lb (already at or below goal)`;
  }
  if (p.goal === 'strength' || p.goal === 'meet_prep') {
    return `${p.weightLbs} lb × 1.0 g/lb`;
  }
  return `${p.weightLbs} lb × 0.8 g/lb`;
}

// ─── Age + BMR ──────────────────────────────────────────────────────────────

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

// ─── Per-day TDEE ──────────────────────────────────────────────────────────

/**
 * Daily TDEE for a SPECIFIC day. Lifestyle baseline + workout credit if
 * the day matches.
 *
 * Cardio is amortized across the rest days for simplicity. We don't ask
 * the user "did you do cardio today", we trust the weekly average.
 */
function dailyTDEE(p: Profile, isTrainingDay: boolean): number {
  const bmr = bmrFemale(p);
  const lifestyleBase = bmr * getLifestyleMultiplier(p);
  const lift = isTrainingDay ? liftKcal(p) : 0;
  // Cardio is averaged across non-training days when the user has more
  // than zero cardio sessions but ≤ training days; otherwise spread across
  // the whole week. This avoids over-crediting any single day.
  const cardioSessions = cardioSessionsPerWeek(p);
  const trainDays = Math.min(7, Math.max(0, p.trainingDaysPerWeek ?? 0));
  const restDays = Math.max(1, 7 - trainDays);
  const cardioOnRest =
    cardioSessions <= restDays
      ? (isTrainingDay ? 0 : (cardioSessions / restDays) * cardioKcal(p))
      : (cardioSessions / 7) * cardioKcal(p);
  return lifestyleBase + lift + cardioOnRest;
}

/**
 * Weekly average TDEE — useful for the breakdown panel.
 */
function weeklyAvgTDEE(p: Profile): number {
  const trainDays = Math.min(7, Math.max(0, p.trainingDaysPerWeek ?? 0));
  const restDays = Math.max(0, 7 - trainDays);
  const train = dailyTDEE(p, true) * trainDays;
  const rest = dailyTDEE(p, false) * restDays;
  return (train + rest) / 7;
}

// ─── Trend (legacy reporting; not used to auto-adjust calories anymore) ────

/**
 * Compute lb/week change over a body-metrics window. Filters to the last
 * `weeks` weeks; falls back to the available metrics if not enough.
 *
 * Kept exported because the Meals page still reads this for hunger /
 * messaging context. The Coach Brain owns the actual weekly adjustment.
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

// ─── Helpers ────────────────────────────────────────────────────────────────

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

// ─── Goal deficit ──────────────────────────────────────────────────────────

function goalDeficitKcal(p: Profile): { kcal: number; note: string } {
  if (p.goal === 'fat_loss') {
    const mode: FatLossMode = p.fatLossMode ?? 'standard';
    const deficit = FAT_LOSS_DEFICIT[mode];
    return {
      kcal: deficit,
      note: `Fat-loss ${mode} mode: ${deficit} kcal/day vs maintenance.`,
    };
  }
  if (p.goal === 'recomp') {
    return {
      kcal: -250,
      note: 'Recomp: small deficit, high protein, training drives the build.',
    };
  }
  if (p.goal === 'strength') {
    return {
      kcal: 0,
      note: 'Strength: maintenance baseline. Slight surplus only if weight is trending down.',
    };
  }
  if (p.goal === 'meet_prep') {
    return {
      kcal: 50,
      note: 'Meet prep: slight surplus to support performance — adjust closer to meet.',
    };
  }
  return { kcal: 0, note: 'Maintenance baseline.' };
}

// ─── Main entry: per-day macro targets ──────────────────────────────────────

export function computeMacroTargets(input: MacroInput): MacroTargets {
  const { profile, isTrainingDay, hungerLevel, metrics, recentLogs } = input;
  const notes: string[] = [];

  // 1. Daily TDEE = lifestyle baseline + workout credit
  const tdee = dailyTDEE(profile, isTrainingDay);
  let calories = tdee;
  notes.push(
    `Lifestyle (${profile.lifestyleActivity ?? 'lightly_active'}) × BMR + ${
      isTrainingDay
        ? `lift session (${liftKcal(profile)} kcal)`
        : 'no lift today'
    }`,
  );

  // 2. Goal deficit
  const goal = goalDeficitKcal(profile);
  calories += goal.kcal;
  notes.push(goal.note);

  // 3. Heavy-bodyweight fat-loss cap — prevents overstating TDEE for users
  // above 200 lb on fat-loss. Override only when the user has explicitly
  // bumped lifestyleActivity above the default.
  const isDefaultLifestyle =
    !profile.lifestyleActivity || profile.lifestyleActivity === 'lightly_active';
  if (
    profile.goal === 'fat_loss' &&
    profile.weightLbs >= HEAVY_THRESHOLD_LB &&
    isDefaultLifestyle
  ) {
    const cap = isTrainingDay ? HEAVY_FATLOSS_CAP_TRAIN : HEAVY_FATLOSS_CAP_REST;
    if (calories > cap) {
      notes.push(
        `Heavy-bodyweight cap: ${cap} kcal — prevents activity overcrediting at ${profile.weightLbs} lb on fat-loss. Bump Lifestyle to "moderately active" if step data supports it.`,
      );
      calories = cap;
    }
  }

  // 4. Coach Brain offset (accepted weekly decisions)
  if (profile.calorieOffsetKcal && profile.calorieOffsetKcal !== 0) {
    calories += profile.calorieOffsetKcal;
    const sign = profile.calorieOffsetKcal > 0 ? '+' : '';
    notes.push(
      `Coach decision: ${sign}${profile.calorieOffsetKcal} kcal applied from your accepted weekly review.`,
    );
  }

  // 5. Wegovy / hunger modulation (real-time, daily signals)
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

  let extraCarbsG = 0;
  if (typeof hungerLevel === 'number' && hungerLevel >= 8) {
    calories += 150;
    extraCarbsG += 30;
    notes.push(`Hunger ${hungerLevel}/10 today — +150 kcal post-workout carbs.`);
  }

  const avgHunger = recentAvgHunger(recentLogs);
  if (avgHunger >= 7) {
    notes.push(
      `Avg hunger after recent training is ${avgHunger.toFixed(1)}/10 — keeping carbs around the workout window.`,
    );
  }

  // 6. Workout-time context note
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

  // 7. Hard floor — never crash diet
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

  // 8. Macros
  const proteinG = computeProteinTargetG(profile);
  const proteinCals = proteinG * 4;

  const carbsRatio = isTrainingDay ? 0.45 : 0.32;
  let carbsG = Math.round((carbsRatio * calories) / 4) + extraCarbsG;
  let fatCals = Math.max(0, calories - proteinCals - carbsG * 4);
  let fatG = Math.round(fatCals / 9);

  const FAT_FLOOR_G = 40;
  if (fatG < FAT_FLOOR_G) {
    const carbsMaxCals = Math.max(0, calories - proteinCals - FAT_FLOOR_G * 9);
    carbsG = Math.max(0, Math.floor(carbsMaxCals / 4));
    fatCals = Math.max(0, calories - proteinCals - carbsG * 4);
    fatG = Math.max(FAT_FLOOR_G, Math.round(fatCals / 9));
  }

  // Trend reporting (no longer drives calorie changes — Coach Brain does)
  const trend = weeklyWeightTrend(metrics);

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
//
// "Show your work" for the macro UI — like a nutritionist's worksheet so the
// user can see exactly how the numbers were derived from their stats.

export interface MacroBreakdown {
  age: number;
  bmr: number;
  lifestyle: LifestyleActivity;
  lifestyleMultiplier: number;
  liftSessionsPerWeek: number;
  liftKcalPerSession: number;
  cardioSessionsPerWeek: number;
  cardioKcalPerSession: number;
  weeklyMaintenanceTDEE: number;
  dailyAvgMaintenanceTDEE: number;
  trainingDayTdee: number;
  restDayTdee: number;
  goalDeficit: number;
  goalDeficitNote: string;
  fatLossMode: FatLossMode | null;
  trainingDayTarget: number;
  restDayTarget: number;
  hardFloor: number;
  heavyCapApplied: { train?: boolean; rest?: boolean };
  coachOffsetKcal: number;
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
  const lifestyle: LifestyleActivity = profile.lifestyleActivity ?? 'lightly_active';
  const lifestyleMultiplier = LIFESTYLE_MULTIPLIER[lifestyle];

  const liftSessions = Math.min(7, Math.max(0, profile.trainingDaysPerWeek ?? 0));
  const cardioSessions = cardioSessionsPerWeek(profile);
  const liftKcalPer = liftKcal(profile);
  const cardioKcalPer = cardioKcal(profile);

  const trainingDayTdee = Math.round(dailyTDEE(profile, true));
  const restDayTdee = Math.round(dailyTDEE(profile, false));
  const weeklyMaintenanceTDEE = Math.round(weeklyAvgTDEE(profile) * 7);
  const dailyAvgMaintenanceTDEE = Math.round(weeklyMaintenanceTDEE / 7);

  const goal = goalDeficitKcal(profile);
  const goalDeficit = goal.kcal;
  const fatLossMode: FatLossMode | null =
    profile.goal === 'fat_loss' ? profile.fatLossMode ?? 'standard' : null;

  const coachOffsetKcal = profile.calorieOffsetKcal ?? 0;

  const hardFloor = Math.max(
    1500,
    Math.round(profile.weightLbs * 8),
    Math.round(bmr * 0.85),
  );

  // Apply heavy-bodyweight cap separately for train/rest so the breakdown
  // can show whether each was clamped.
  let trainingDayTargetRaw = trainingDayTdee + goalDeficit + coachOffsetKcal;
  let restDayTargetRaw = restDayTdee + goalDeficit + coachOffsetKcal;
  const isDefaultLifestyle = lifestyle === 'lightly_active';
  const heavyCapApplies =
    profile.goal === 'fat_loss' &&
    profile.weightLbs >= HEAVY_THRESHOLD_LB &&
    isDefaultLifestyle;
  const heavyCapApplied: { train?: boolean; rest?: boolean } = {};
  if (heavyCapApplies) {
    if (trainingDayTargetRaw > HEAVY_FATLOSS_CAP_TRAIN) {
      trainingDayTargetRaw = HEAVY_FATLOSS_CAP_TRAIN;
      heavyCapApplied.train = true;
    }
    if (restDayTargetRaw > HEAVY_FATLOSS_CAP_REST) {
      restDayTargetRaw = HEAVY_FATLOSS_CAP_REST;
      heavyCapApplied.rest = true;
    }
  }

  const trainingDayTarget = Math.max(hardFloor, Math.round(trainingDayTargetRaw / 10) * 10);
  const restDayTarget = Math.max(hardFloor, Math.round(restDayTargetRaw / 10) * 10);

  const proteinG = computeProteinTargetG(profile);
  const proteinFormula = proteinFormulaDescription(profile);

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
    lifestyle,
    lifestyleMultiplier,
    liftSessionsPerWeek: liftSessions,
    liftKcalPerSession: liftKcalPer,
    cardioSessionsPerWeek: cardioSessions,
    cardioKcalPerSession: cardioKcalPer,
    weeklyMaintenanceTDEE,
    dailyAvgMaintenanceTDEE,
    trainingDayTdee,
    restDayTdee,
    goalDeficit,
    goalDeficitNote: goal.note,
    fatLossMode,
    trainingDayTarget,
    restDayTarget,
    hardFloor,
    heavyCapApplied,
    coachOffsetKcal,
    proteinG,
    proteinFormula,
    carbsTrainingG,
    carbsRestG,
    fatTrainingG,
    fatRestG,
  };
}
