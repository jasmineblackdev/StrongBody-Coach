// Coach Brain — weekly decision engine.
//
// Fuses every existing rule engine into ONE decision for the week. Pure
// function; no side effects. Side effects (macro offset, phase change,
// step target) live in `applyCoachDecision` below and only fire when the
// user accepts the decision in the UI.
//
// Priority order is explicit and ordered most-safety-critical first:
//   1. Pain / high injury risk             → adjust_exercises or deload
//   2. Strength regressing + recovery low  → reduce_training_volume
//   3. Insufficient data                   → log_more_data
//   4. Losing too fast (>2 lb/wk)          → increase_recovery (food back)
//   5. Bloating high                       → stay_course + food review note
//   6. Stable / gaining + low adherence    → improve_adherence
//   7. Stable / gaining + high hunger      → increase_steps
//   8. Stable / gaining + manageable       → reduce_calories
//   9. Losing in sweet spot + stable lifts → stay_course
//
// Existing engines are the source of truth for their domain — we just
// orchestrate. No automatic mutation.

import type {
  CoachDecision,
  CoachDecisionConfidence,
  CoachDecisionKind,
  Profile,
  SuggestedChange,
  TrainingPhase,
  WeeklyCheckIn,
  WorkoutLog,
} from '../types';
import type { WeightTrendReport } from './weightTrendEngine';
import type { ReadinessReport } from './recoveryEngine';
import type { LiftEstimate, LiftKey } from './strengthEngine';
import type { InjuryRiskReport } from './ml/injuryRisk';
import type { FemaleFatLossReport } from './femaleFatLossEngine';
import type { ConfidenceReport } from './confidenceScoreEngine';
import { computeAdherence } from './adherenceEngine';
import { store } from './storage';
import { buildWeeklyPlan } from './workoutPlan';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WeeklyDecisionInput {
  profile: Profile;
  weekNumber: number;
  weightTrend: WeightTrendReport;
  recovery: ReadinessReport;
  lifts: Record<LiftKey, LiftEstimate>;
  injuryRisk: InjuryRiskReport;
  recentLogs: WorkoutLog[];
  lastCheckIn?: WeeklyCheckIn;
  /**
   * Optional female-aware report. When provided, the Coach Brain consults
   * it BEFORE running its own decision tree:
   *   - If `overrideDecision === true` and a forcedDecision is set, the
   *     Coach Brain emits that forced decision with the female report's
   *     reason copy.
   *   - Even when overrideDecision is false, blockedActions are honored —
   *     the brain won't recommend reduce_calories if the female layer is
   *     blocking it (water retention, false plateau, hormonal hunger, etc.).
   */
  femaleReport?: FemaleFatLossReport;
  /**
   * Confidence read of the underlying data. When level === 'low', the
   * Coach Brain refuses to recommend reduce_calories or shift_carbs and
   * routes to log_more_data instead — calorie cuts on thin data is the
   * most common preventable failure mode.
   *
   * Pain/injury already short-circuits the decision tree before this
   * gate (mechanical signals beat data-quality signals). The confidence
   * gate only kicks in for the food-side recommendations.
   */
  confidence?: ConfidenceReport;
}

interface DecisionContext extends WeeklyDecisionInput {
  hunger: number;
  bloating: number;
  energy: number;
  adherenceScore: number;
  hasAdherence: boolean;
  regressingLifts: LiftKey[];
  losingRate: number; // positive = losing lb/wk
  weightConfidence: WeightTrendReport['confidence'];
}

function isBlocked(
  ctx: DecisionContext,
  kind: CoachDecisionKind,
): boolean {
  const blocked = ctx.femaleReport?.blockedActions ?? [];
  if (
    kind === 'reduce_calories' &&
    blocked.includes('reduce_calories')
  )
    return true;
  if (kind === 'shift_carbs' && blocked.includes('shift_carbs')) return true;
  if (kind === 'increase_steps' && blocked.includes('increase_steps')) return true;
  return false;
}

// ─── Decision logic ────────────────────────────────────────────────────────

export function decideThisWeek(input: WeeklyDecisionInput): CoachDecision {
  const ctx = buildContext(input);

  // Pain — most safety-critical. Lower-back gets a swap recommendation;
  // anything else high-risk gets a deload. These bypass the female layer
  // because pain has nothing to do with cycle/water — it's a hard stop.
  const painLowerBack = hasPain(ctx.recentLogs, /low.?back|lumbar/i);
  const painShoulder = hasPain(ctx.recentLogs, /shoulder|rotator|delt/i);
  const painKnee = hasPain(ctx.recentLogs, /knee|patell/i);

  if (painLowerBack) return adjustExercisesForBack(ctx);
  if (ctx.injuryRisk.level === 'high' || painShoulder || painKnee) {
    return deload(ctx, ctx.injuryRisk.flags.slice(0, 2));
  }

  // Strength regressing + recovery struggling → drop volume before deloading.
  // Also bypasses the female layer for the same reason — strength regression
  // is mechanical fatigue, not hormonal noise.
  if (ctx.recovery.score < 60 && ctx.regressingLifts.length >= 1) {
    return reduceTrainingVolume(ctx);
  }

  // Female fat-loss override — only fires AFTER pain/injury checks. When
  // the female layer says water retention / false plateau / hormonal
  // hunger / mid-cycle caution, we emit its forced decision and stop.
  if (ctx.femaleReport?.overrideDecision && ctx.femaleReport.forcedDecision) {
    return forcedFromFemaleReport(ctx);
  }

  // Not enough data — be honest about it instead of guessing
  if (
    ctx.weightConfidence === 'low' &&
    !ctx.hasAdherence &&
    ctx.recentLogs.length < 3
  ) {
    return logMoreData(ctx);
  }

  // Losing too fast — protect muscle, add food back
  if (ctx.weightTrend.trend === 'losing' && ctx.losingRate > 2) {
    return increaseRecovery(ctx);
  }

  // Stable / gaining branches
  if (
    ctx.weightTrend.trend === 'stable' ||
    ctx.weightTrend.trend === 'gaining'
  ) {
    // Bloating gate — same intent as the female layer's water_retention
    // detector but kept here for users without an active femaleReport.
    if (ctx.bloating >= 7 && !isBlocked(ctx, 'shift_carbs')) {
      return reviewFoodTriggers(ctx);
    }

    if (ctx.hasAdherence && ctx.adherenceScore < 0.8) {
      return improveAdherence(ctx);
    }

    if (ctx.hunger >= 7 && !isBlocked(ctx, 'increase_steps')) {
      return increaseSteps(ctx);
    }

    // Reduce calories is the LAST resort here — blockable by the female
    // layer (water/bloat/hormones) AND by low confidence (thin data).
    if (!isBlocked(ctx, 'reduce_calories')) {
      if (ctx.confidence && ctx.confidence.level === 'low') {
        return logMoreDataLowConfidence(ctx);
      }
      return reduceCalories(ctx);
    }
    // Female layer is blocking the cut but didn't override — fall through
    // to stay_course with the female reasoning attached.
    return stayCourseWithFemaleNote(ctx);
  }

  // Losing in the sweet spot — keep going, reset any prior offset
  if (
    ctx.weightTrend.trend === 'losing' &&
    ctx.losingRate >= 0.8 &&
    ctx.losingRate <= 2
  ) {
    return stayCourse(ctx);
  }

  // Fallback (trend unknown but some data)
  return logMoreData(ctx);
}

// ─── Context builder ───────────────────────────────────────────────────────

function buildContext(input: WeeklyDecisionInput): DecisionContext {
  const adherence = computeAdherence(input.lastCheckIn);
  const regressingLifts = (Object.keys(input.lifts) as LiftKey[]).filter(
    (k) => input.lifts[k].trend === 'regressing',
  );
  const hungerFromCheckIn = input.lastCheckIn?.hungerLevel ?? 0;
  const hungerFromLogs = avgRecentHunger(input.recentLogs);
  const hunger = Math.max(hungerFromCheckIn, hungerFromLogs);
  const bloating = input.lastCheckIn?.bloatingLevel ?? 0;
  const energy = input.lastCheckIn?.energyRecovery ?? 0;

  return {
    ...input,
    hunger,
    bloating,
    energy,
    adherenceScore: adherence.score,
    hasAdherence: adherence.hasCheckIn,
    regressingLifts,
    losingRate: -input.weightTrend.weeklyChange,
    weightConfidence: input.weightTrend.confidence,
  };
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

function hasPain(logs: WorkoutLog[], re: RegExp): boolean {
  return logs.slice(0, 7).some((l) =>
    l.exercises.some((e) => re.test(e.painNotes ?? '')),
  );
}

// ─── Confidence model ──────────────────────────────────────────────────────

function decisionConfidence(ctx: DecisionContext): CoachDecisionConfidence {
  let score = 0;
  if (ctx.weightConfidence === 'high') score += 2;
  else if (ctx.weightConfidence === 'medium') score += 1;
  if (ctx.hasAdherence) score += 1;
  if (ctx.recentLogs.length >= 5) score += 1;
  if (score >= 3) return 'high';
  if (score >= 2) return 'medium';
  return 'low';
}

// ─── Observations (shared across all decisions) ────────────────────────────

function buildObservations(
  ctx: DecisionContext,
): { whatWorked: string[]; whatHeldBack: string[] } {
  const whatWorked: string[] = [];
  const whatHeldBack: string[] = [];

  if (ctx.weightTrend.trend === 'losing' && ctx.losingRate <= 2) {
    whatWorked.push(
      `Trending down ${ctx.losingRate.toFixed(1)} lb/wk — that's the sweet spot.`,
    );
  }
  if (ctx.adherenceScore >= 0.9) {
    whatWorked.push(
      `Adherence at ${Math.round(ctx.adherenceScore * 100)}% — calories and protein are landing.`,
    );
  }
  if (ctx.recovery.score >= 80) {
    whatWorked.push('Recovery is strong — body is bouncing back between sessions.');
  }
  const improving = (Object.keys(ctx.lifts) as LiftKey[]).filter(
    (k) => ctx.lifts[k].trend === 'improving',
  );
  if (improving.length) {
    whatWorked.push(
      `${improving.map(capitalize).join(', ')} ${improving.length === 1 ? 'is' : 'are'} climbing.`,
    );
  }
  if (ctx.lastCheckIn?.whatWorked) {
    whatWorked.push(`You said: "${ctx.lastCheckIn.whatWorked.trim()}"`);
  }

  if (ctx.hasAdherence && ctx.adherenceScore < 0.8) {
    whatHeldBack.push(
      `Adherence at ${Math.round(ctx.adherenceScore * 100)}% — there's a leak in calories, protein, or sessions.`,
    );
  }
  if (ctx.hunger >= 7) {
    whatHeldBack.push(`Hunger averaging ${ctx.hunger.toFixed(1)}/10 — fuel is on the edge.`);
  }
  if (ctx.bloating >= 7) {
    whatHeldBack.push(
      `Bloating at ${ctx.bloating}/10 — could be food response, not body fat.`,
    );
  }
  if (ctx.recovery.score < 60) {
    whatHeldBack.push(
      `Recovery score ${ctx.recovery.score}/100 — body isn't fully bouncing back.`,
    );
  }
  if (ctx.regressingLifts.length) {
    whatHeldBack.push(
      `${ctx.regressingLifts.map(capitalize).join(', ')} ${
        ctx.regressingLifts.length === 1 ? 'is' : 'are'
      } regressing.`,
    );
  }
  if (ctx.injuryRisk.level !== 'low') {
    whatHeldBack.push(...ctx.injuryRisk.flags.slice(0, 2));
  }
  if (ctx.lastCheckIn?.whatNeedsAdjustment) {
    whatHeldBack.push(`You flagged: "${ctx.lastCheckIn.whatNeedsAdjustment.trim()}"`);
  }

  return { whatWorked, whatHeldBack };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Decision factories ────────────────────────────────────────────────────

function base(
  ctx: DecisionContext,
  decision: CoachDecisionKind,
  headline: string,
  reason: string,
  suggestedChanges: SuggestedChange[],
  safetyNotes: string[],
): CoachDecision {
  return {
    id: cryptoRandomId(),
    weekNumber: ctx.weekNumber,
    generatedAt: new Date().toISOString(),
    decision,
    headline,
    reason,
    confidence: decisionConfidence(ctx),
    status: 'pending',
    suggestedChanges,
    safetyNotes,
    observations: buildObservations(ctx),
  };
}

function cryptoRandomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `cd_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Emit a decision the female layer forced — water retention, false plateau,
 * hormonal hunger, mid-cycle caution. The Coach Brain trusts the female
 * report's reason copy and just attaches the right kind + safety notes.
 */
function forcedFromFemaleReport(ctx: DecisionContext): CoachDecision {
  const fr = ctx.femaleReport!;
  const forced = fr.forcedDecision!;
  if (forced.kind === 'increase_steps') {
    const decision = increaseSteps(ctx);
    return {
      ...decision,
      headline: fr.headline,
      reason: forced.reason,
      safetyNotes: [
        'Female fat-loss layer flagged this week as hormonal — never cut food into a hunger spike.',
        ...decision.safetyNotes.filter(
          (s) => !/hunger.+spike|food.+hunger/i.test(s),
        ),
      ],
    };
  }
  // stay_course path — water retention, false plateau, mid-cycle caution.
  const offset = ctx.profile.calorieOffsetKcal ?? 0;
  const changes: SuggestedChange[] = [];
  if (offset !== 0) {
    changes.push({
      kind: 'macro_adjust',
      description: `Reset prior coach offset (currently ${offset > 0 ? '+' : ''}${offset} kcal) back to 0 — let the body settle.`,
      payload: { calorieOffsetKcal: 0 },
    });
  }
  changes.push({
    kind: 'behavior',
    description: fr.recommendedAction,
  });
  return base(
    ctx,
    'stay_course',
    fr.headline,
    forced.reason,
    changes,
    [
      'Female fat-loss layer is blocking calorie cuts this week — water + hormonal noise should not drive subtraction.',
      'Re-check in 5–7 days; the smoothed trend is what we trust.',
    ],
  );
}

/**
 * Used when the female layer has blocked reduce_calories without
 * forcing an explicit decision (rare edge case — e.g., flat trend with
 * a non-override blockedActions list). We stay_course with the female
 * explanation attached.
 */
function stayCourseWithFemaleNote(ctx: DecisionContext): CoachDecision {
  const fr = ctx.femaleReport;
  const note =
    fr?.explanation ??
    'Female layer is blocking a calorie cut this week. Hold targets and re-check next week.';
  const changes: SuggestedChange[] = [
    {
      kind: 'behavior',
      description: fr?.recommendedAction ?? 'Hold targets steady. Re-check next week.',
    },
  ];
  return base(
    ctx,
    'stay_course',
    fr?.headline ?? 'Stay the course',
    note,
    changes,
    ['Hormonal / water-retention noise should not drive a calorie cut.'],
  );
}

function stayCourse(ctx: DecisionContext): CoachDecision {
  const offset = ctx.profile.calorieOffsetKcal ?? 0;
  const changes: SuggestedChange[] = [];
  if (offset !== 0) {
    changes.push({
      kind: 'macro_adjust',
      description: `Reset prior coach offset (currently ${offset > 0 ? '+' : ''}${offset} kcal) back to 0.`,
      payload: { calorieOffsetKcal: 0 },
    });
  }
  changes.push({
    kind: 'behavior',
    description: 'Hold targets steady. Re-check next week — don\'t change anything for 7 days.',
  });
  return base(
    ctx,
    'stay_course',
    'Stay the course',
    `7-day avg trending down ${ctx.losingRate.toFixed(1)} lb/wk and lifts are stable. The plan is working — let it work.`,
    changes,
    ['Don\'t cut more food when the trend is already moving.'],
  );
}

function reduceCalories(ctx: DecisionContext): CoachDecision {
  return base(
    ctx,
    'reduce_calories',
    'Reduce calories by 100–150',
    'Weight stable for 7+ days, hunger manageable, adherence on track. Drop 100–150 kcal — one carb portion or one fat serving — and reassess in 7 days.',
    [
      {
        kind: 'macro_adjust',
        description: 'Apply −125 kcal to your daily target.',
        payload: { calorieOffsetKcal: -125 },
      },
    ],
    [
      'Never cut more than 150 kcal at a time on a fat-loss block.',
      'If hunger spikes above 7/10 next week, reverse this and try steps instead.',
    ],
  );
}

function increaseSteps(ctx: DecisionContext): CoachDecision {
  return base(
    ctx,
    'increase_steps',
    'Add 2,000 steps/day',
    `Weight stable + hunger averaging ${ctx.hunger.toFixed(1)}/10. Burn more without making hunger worse — add 2,000 steps/day (~1 mile) before cutting food.`,
    [
      {
        kind: 'steps_target',
        description: 'Set a daily step target of 10,000.',
        payload: { dailyStepsTarget: 10_000 },
      },
    ],
    ['Walk before/after meals to also help with bloating and digestion.'],
  );
}

function reviewFoodTriggers(ctx: DecisionContext): CoachDecision {
  return base(
    ctx,
    'shift_carbs',
    'Review food triggers before cutting',
    `Bloating at ${ctx.bloating}/10 — that's GI signal, not necessarily fat. Don't cut calories yet. Track lactose, FODMAPs, weekend swings, alcohol for 7 days first.`,
    [
      {
        kind: 'food_review',
        description: 'Log meals + bloating in detail this week. No macro changes.',
      },
    ],
    [
      'Cutting calories on top of bloating risks under-fueling without fixing the actual cause.',
      'Re-check in 7 days; if bloating drops and weight is still flat, *then* we cut.',
    ],
  );
}

function increaseRecovery(ctx: DecisionContext): CoachDecision {
  const offset = ctx.profile.calorieOffsetKcal ?? 0;
  return base(
    ctx,
    'increase_recovery',
    "You're losing too fast — add food back",
    `Losing ${ctx.losingRate.toFixed(1)} lb/wk is too aggressive — you'll lose muscle on top of fat. Add 100–150 kcal back (one carb portion) and reassess in 7 days.`,
    [
      {
        kind: 'macro_adjust',
        description: 'Apply +125 kcal to protect muscle.',
        payload: { calorieOffsetKcal: Math.max(125, offset + 125) },
      },
    ],
    [
      'Never recommend crash dieting. Losing >2 lb/wk costs muscle and is hard to reverse.',
      'Sleep 7+ hrs and keep protein at target.',
    ],
  );
}

function improveAdherence(ctx: DecisionContext): CoachDecision {
  const ci = ctx.lastCheckIn;
  const calLabel = ci ? labelAdherence(ci.caloriesAdherence) : '';
  const proLabel = ci ? labelAdherence(ci.proteinAdherence) : '';
  const sessions = ci ? `${ci.workoutsCompleted}/${ci.workoutsPlanned}` : '';
  return base(
    ctx,
    'improve_adherence',
    'Fix adherence first',
    `Adherence at ${Math.round(ctx.adherenceScore * 100)}% — calories ${calLabel}, protein ${proLabel}, workouts ${sessions}. Hit current targets cleanly for 7 days before changing the plan — this isn't a plateau, it's a leak.`,
    [
      {
        kind: 'behavior',
        description: 'No macro/plan changes this week. Hit targets clean.',
      },
    ],
    [
      'Don\'t cut food when the current target hasn\'t actually been hit.',
      'A clean 7 days is the cheapest intervention you have.',
    ],
  );
}

function reduceTrainingVolume(ctx: DecisionContext): CoachDecision {
  return base(
    ctx,
    'reduce_training_volume',
    'Reduce volume ~15%',
    `Recovery score ${ctx.recovery.score}/100 with ${ctx.regressingLifts.map(capitalize).join(', ')} regressing. Drop top-set volume ~15% next week and back off RPE — bar speed is the test, not max weight.`,
    [
      {
        kind: 'volume_decrease',
        description: 'Cut working-set count by ~15% next week.',
        payload: { volumeDeltaPct: -15 },
      },
    ],
    [
      'No PR attempts this week.',
      'If recovery doesn\'t recover in 7 days, deload next.',
    ],
  );
}

function deload(ctx: DecisionContext, riskFlags: string[]): CoachDecision {
  return base(
    ctx,
    'deload',
    'Deload week',
    `Injury risk is high${
      riskFlags.length ? ` (${riskFlags.join('; ')})` : ''
    }. Drop loads to ~60%, RPE 6 cap, volume −30%. Sleep, food, walks. Coming back fresh > grinding.`,
    [
      {
        kind: 'phase_change',
        description: 'Switch next week to a deload phase.',
        payload: { targetPhase: 'deload' satisfies TrainingPhase },
      },
    ],
    [
      'Never increase load when pain or missed-rep ratio is high.',
      'A deload is not a setback — it\'s how the next PR happens.',
    ],
  );
}

function adjustExercisesForBack(ctx: DecisionContext): CoachDecision {
  return base(
    ctx,
    'adjust_exercises',
    'Swap to back-friendly variations',
    'Lower-back pain reported in your last sessions. Pull spinal load down: front squat or goblet squat instead of back squat, RDL or block pulls instead of conventional, no max attempts.',
    [
      {
        kind: 'exercise_swap',
        description: 'Front squat for back squat; RDL or block pulls for deadlift.',
      },
      {
        kind: 'phase_change',
        description: 'Drop intensity to a deload-equivalent week.',
        payload: { targetPhase: 'deload' satisfies TrainingPhase },
      },
    ],
    [
      'No max attempts on squat or deadlift this week.',
      'If pain persists 5+ days or radiates, see a clinician — this engine doesn\'t diagnose.',
    ],
  );
}

/**
 * Specialised log_more_data that fires when the data is too thin to
 * justify a calorie cut. Distinct from the generic logMoreData (which
 * fires when there's barely any data at all) because here the user has
 * SOME data but not enough to trust a subtraction.
 */
function logMoreDataLowConfidence(ctx: DecisionContext): CoachDecision {
  const missingTop = ctx.confidence?.missingData?.slice(0, 2) ?? [];
  return base(
    ctx,
    'log_more_data',
    'Hold — confidence is too low to cut food',
    `The trend is flat but the data behind it is thin. Cutting calories on low confidence is the most common preventable failure mode.${
      missingTop.length ? ` Top gaps: ${missingTop.join(' / ')}` : ''
    }`,
    [
      {
        kind: 'behavior',
        description:
          'Hold targets. Tighten weigh-ins, run a fresh check-in, and re-check next week.',
      },
    ],
    [
      'Never cut food when the data is unclear — the wrong adjustment costs more than a held week.',
      'Confidence is a guardrail, not a delay tactic. It will move with logging.',
    ],
  );
}

function logMoreData(ctx: DecisionContext): CoachDecision {
  return base(
    ctx,
    'log_more_data',
    'Need more signal before changing anything',
    'Not enough data to make a confident call. Daily weigh-ins for 7+ days and a weekly check-in are the cheapest tools for clarity.',
    [
      {
        kind: 'behavior',
        description: 'Log daily weight + complete a weekly check-in. No plan changes.',
      },
    ],
    ['When in doubt, hold. The wrong adjustment costs more than the missed week.'],
  );
}

function labelAdherence(level: 'yes' | 'mostly' | 'no'): string {
  return level === 'yes' ? 'on target' : level === 'mostly' ? 'mostly' : 'off';
}

// ─── Apply / revert ────────────────────────────────────────────────────────
//
// Side-effect helpers — only invoked by the UI when the user clicks Accept
// on a CoachDecisionCard. Keep these idempotent: re-applying the same
// decision should land the same end state.

export function applyCoachDecision(decision: CoachDecision): void {
  const profile = store.getProfile();
  if (!profile) return;
  const next: typeof profile = { ...profile };

  for (const change of decision.suggestedChanges) {
    if (change.kind === 'macro_adjust') {
      // For stay_course: payload sets offset to 0. For reduce/increase: it
      // sets a specific signed offset. Replace, don't accumulate.
      if (change.payload?.calorieOffsetKcal !== undefined) {
        next.calorieOffsetKcal = change.payload.calorieOffsetKcal;
      }
    } else if (change.kind === 'steps_target') {
      if (change.payload?.dailyStepsTarget !== undefined) {
        next.dailyStepsTarget = change.payload.dailyStepsTarget;
      }
    } else if (change.kind === 'phase_change') {
      const targetPhase = change.payload?.targetPhase;
      if (targetPhase) {
        const week = store.getWeekNumber();
        store.setPlan(buildWeeklyPlan(profile, week, targetPhase));
      }
    }
    // volume_decrease, food_review, exercise_swap, cardio_increase, behavior
    // are descriptive — no automated state change. They show in the
    // CoachDecisionCard's "what changes" section so the user can act.
  }

  // Snapshot the body state at acceptance time so we can compare
  // predicted vs actual after 7 days. Cheap and local-only.
  const metrics = store.getMetrics();
  const sortedDesc = [...metrics]
    .filter((m) => typeof m.weightLbs === 'number')
    .sort((a, b) => b.date.localeCompare(a.date));
  const cutoff = Date.now() - 7 * 86400000;
  const recent7 = sortedDesc
    .filter((m) => new Date(m.date).getTime() >= cutoff)
    .map((m) => m.weightLbs as number);
  const sevenDayAvg = recent7.length
    ? +(recent7.reduce((s, n) => s + n, 0) / recent7.length).toFixed(1)
    : null;

  // Derive the trend at acceptance from prior-week vs this-week 7-day
  // averages, when both windows have data.
  const priorCutoff = Date.now() - 14 * 86400000;
  const prior7 = sortedDesc
    .filter((m) => {
      const t = new Date(m.date).getTime();
      return t >= priorCutoff && t < cutoff;
    })
    .map((m) => m.weightLbs as number);
  const priorAvg = prior7.length
    ? prior7.reduce((s, n) => s + n, 0) / prior7.length
    : null;
  const weeklyChangeAtAcceptance =
    sevenDayAvg !== null && priorAvg !== null
      ? +(sevenDayAvg - priorAvg).toFixed(2)
      : null;

  store.setProfile(next);
  store.updateCoachDecision(decision.id, {
    status: 'accepted',
    acceptedAt: new Date().toISOString(),
    appliedSnapshot: {
      sevenDayAvgWeightLb: sevenDayAvg,
      weeklyChangeAtAcceptance,
    },
  });
}

export function rejectCoachDecision(
  decisionId: string,
  rejectionReason?: string,
): void {
  store.updateCoachDecision(decisionId, {
    status: 'rejected',
    rejectedAt: new Date().toISOString(),
    rejectionReason,
  });
}

// ─── UI helpers ────────────────────────────────────────────────────────────

export const DECISION_TONE: Record<
  CoachDecisionKind,
  'success' | 'warning' | 'danger' | 'accent'
> = {
  stay_course: 'success',
  reduce_calories: 'accent',
  increase_steps: 'accent',
  shift_carbs: 'warning',
  deload: 'warning',
  reduce_training_volume: 'warning',
  increase_recovery: 'danger',
  adjust_exercises: 'danger',
  improve_adherence: 'warning',
  log_more_data: 'warning',
};

export const DECISION_LABEL: Record<CoachDecisionKind, string> = {
  stay_course: 'Stay course',
  reduce_calories: 'Reduce calories',
  increase_steps: 'Increase steps',
  shift_carbs: 'Review food triggers',
  deload: 'Deload',
  reduce_training_volume: 'Reduce volume',
  increase_recovery: 'Increase recovery',
  adjust_exercises: 'Swap exercises',
  improve_adherence: 'Fix adherence',
  log_more_data: 'Log more data',
};
