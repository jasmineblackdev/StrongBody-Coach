// Outcome tracking for accepted Coach Decisions.
//
// 7+ days after a decision is accepted, this module compares what the
// app predicted to what actually happened. The outcome attaches to the
// decision and surfaces in DecisionHistoryPanel as "Did this work?".
//
// Pure deterministic — reads the same store data the rest of the app
// uses. No external APIs.

import type {
  BodyMetric,
  CoachDecision,
  CoachDecisionOutcome,
  DecisionOutcomeVerdict,
  WeeklyCheckIn,
  WorkoutLog,
} from '../types';
import { predictedWeeklyChangeForDecision } from './predictionEngine';

const ADHERENCE_VAL = { yes: 1.0, mostly: 0.8, no: 0.5 } as const;

/** Median helper — same convention as femaleFatLossEngine. */
function median(nums: number[]): number {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Smoothed weekly weight change since the decision was accepted.
 * Median of first half (early week) vs median of second half (recent
 * days). Robust to single-day spikes.
 */
function actualWeeklyChangeSince(
  metrics: BodyMetric[],
  acceptedAt: string,
): number | null {
  const acceptedTime = new Date(acceptedAt).getTime();
  const sinceAccepted = metrics
    .filter(
      (m) =>
        typeof m.weightLbs === 'number' &&
        new Date(m.date).getTime() >= acceptedTime,
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  if (sinceAccepted.length < 4) return null;
  const half = Math.floor(sinceAccepted.length / 2);
  const firstHalf = sinceAccepted.slice(0, half).map((m) => m.weightLbs as number);
  const secondHalf = sinceAccepted
    .slice(-half)
    .map((m) => m.weightLbs as number);
  const m1 = median(firstHalf);
  const m2 = median(secondHalf);
  const days =
    (new Date(sinceAccepted[sinceAccepted.length - 1].date).getTime() -
      new Date(sinceAccepted[0].date).getTime()) /
    86400000;
  if (days <= 0) return null;
  return +(((m2 - m1) / days) * 7).toFixed(2);
}

function adherenceFromCheckIn(c: WeeklyCheckIn | undefined): number | null {
  if (!c) return null;
  const cal = ADHERENCE_VAL[c.caloriesAdherence];
  const pro = ADHERENCE_VAL[c.proteinAdherence];
  const work =
    c.workoutsPlanned > 0
      ? Math.min(1, c.workoutsCompleted / c.workoutsPlanned)
      : 0;
  return +((cal + pro + work) / 3).toFixed(2);
}

function workoutsSince(
  logs: WorkoutLog[],
  acceptedAt: string,
): { completed: number; window: number } {
  const acceptedTime = new Date(acceptedAt).getTime();
  const since = logs.filter((l) => new Date(l.date).getTime() >= acceptedTime);
  const days = Math.max(
    1,
    Math.round((Date.now() - acceptedTime) / 86400000),
  );
  return { completed: since.length, window: days };
}

/**
 * Compute the outcome for an accepted decision that's at least 7 days old.
 * Returns null when not enough time has elapsed. When time has elapsed
 * but data is too thin, returns an outcome with verdict='not_enough_data'.
 */
export function computeOutcome(
  decision: CoachDecision,
  metrics: BodyMetric[],
  logs: WorkoutLog[],
  checkIns: WeeklyCheckIn[],
  fatLossModeDeficit: number | null = null,
): CoachDecisionOutcome | null {
  if (decision.status !== 'accepted' || !decision.acceptedAt) return null;
  const elapsed = Math.floor(
    (Date.now() - new Date(decision.acceptedAt).getTime()) / 86400000,
  );
  if (elapsed < 7) return null;

  const actualWeeklyChange = actualWeeklyChangeSince(metrics, decision.acceptedAt);
  const predictedWeeklyChange = predictedWeeklyChangeForDecision(
    decision.decision,
    fatLossModeDeficit,
  );

  // Adherence: nearest check-in submitted AFTER the decision
  const acceptedTime = new Date(decision.acceptedAt).getTime();
  const postDecisionCheckIn = checkIns
    .filter((c) => new Date(c.date).getTime() >= acceptedTime)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const adherenceScore = adherenceFromCheckIn(postDecisionCheckIn);

  const work = workoutsSince(logs, decision.acceptedAt);
  const sevenDayWindow = Math.min(7, work.window);
  const sessionsExpected = Math.round(
    (sevenDayWindow / 7) * (postDecisionCheckIn?.workoutsPlanned ?? 4),
  );

  // Verdict logic
  let verdict: DecisionOutcomeVerdict = 'not_enough_data';
  let note = `Need more data to call whether this worked — log daily weight + a check-in.`;
  if (actualWeeklyChange !== null) {
    if (decision.decision === 'reduce_calories' || decision.decision === 'increase_steps') {
      // Expected to move weight DOWN
      if (actualWeeklyChange <= -0.5) {
        verdict = 'worked';
        note = `Smoothed trend at ${actualWeeklyChange} lb/wk — the decision moved the scale.`;
      } else if (actualWeeklyChange > 0.5) {
        verdict = 'wrong_direction';
        note = `Trend went the wrong way (${actualWeeklyChange > 0 ? '+' : ''}${actualWeeklyChange} lb/wk). Either the lever wasn't strong enough or another signal masked it (water, cycle, food response).`;
      } else {
        verdict = 'didnt_move';
        note = `Trend held at ${actualWeeklyChange} lb/wk — neither cut nor stair was strong enough to move it.`;
      }
    } else if (decision.decision === 'increase_recovery') {
      if (actualWeeklyChange > -1) {
        verdict = 'worked';
        note = `Trend slowed from a too-fast cut — adding food back protected muscle.`;
      } else {
        verdict = 'didnt_move';
        note = `Still losing fast (${actualWeeklyChange} lb/wk) despite the food bump. May need a bigger increase next week.`;
      }
    } else if (decision.decision === 'stay_course') {
      if (Math.abs(actualWeeklyChange) <= 0.4) {
        verdict = 'worked';
        note = `Trend held in the stable band — staying the course was the right call.`;
      } else if (actualWeeklyChange < -0.4) {
        verdict = 'worked';
        note = `Trend continued to drop ${actualWeeklyChange} lb/wk — staying the course let it work.`;
      } else {
        verdict = 'didnt_move';
        note = `Trend drifted up ${actualWeeklyChange} lb/wk while we held — re-check adherence on the next /check-in.`;
      }
    } else if (
      decision.decision === 'deload' ||
      decision.decision === 'reduce_training_volume' ||
      decision.decision === 'adjust_exercises'
    ) {
      verdict = (postDecisionCheckIn?.energyRecovery ?? 0) >= 7 ? 'worked' : 'not_enough_data';
      note =
        verdict === 'worked'
          ? `Energy recovery scored ${postDecisionCheckIn?.energyRecovery}/10 after the deload — body bounced back.`
          : 'Need a fresh check-in to see if recovery scores improved.';
    } else if (decision.decision === 'improve_adherence') {
      verdict =
        adherenceScore !== null && adherenceScore >= 0.85
          ? 'worked'
          : adherenceScore !== null
          ? 'didnt_move'
          : 'not_enough_data';
      note =
        adherenceScore !== null
          ? `Adherence landed at ${Math.round(adherenceScore * 100)}% — ${adherenceScore >= 0.85 ? 'leak fixed' : 'still leaking'}.`
          : 'Run a /check-in to confirm adherence held.';
    } else if (decision.decision === 'log_more_data') {
      verdict = actualWeeklyChange !== null ? 'worked' : 'not_enough_data';
      note =
        verdict === 'worked'
          ? `Data caught up — trend is now visible at ${actualWeeklyChange} lb/wk. Next /check-in unblocks the next decision.`
          : 'Still thin on data. Keep logging.';
    } else {
      verdict = 'not_enough_data';
    }
  }

  return {
    measuredAt: new Date().toISOString(),
    daysElapsed: elapsed,
    predictedWeeklyChange,
    actualWeeklyChange,
    adherenceScore,
    workoutsCompleted: work.completed,
    workoutsPlanned: postDecisionCheckIn?.workoutsPlanned ?? 0,
    verdict,
    note,
  };
}

export const VERDICT_TONE: Record<DecisionOutcomeVerdict, 'success' | 'warning' | 'danger' | 'accent'> = {
  worked: 'success',
  didnt_move: 'warning',
  wrong_direction: 'danger',
  not_enough_data: 'accent',
};

export const VERDICT_LABEL: Record<DecisionOutcomeVerdict, string> = {
  worked: 'Worked',
  didnt_move: "Didn't move",
  wrong_direction: 'Wrong direction',
  not_enough_data: 'Not enough data',
};
