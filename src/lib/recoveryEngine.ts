// Rule-based readiness scoring across the last N sessions.

import type { ExerciseLog, SetLog, WorkoutLog } from '../types';

export type Readiness = 'high' | 'moderate' | 'low';
export type ReadinessSuggestion = 'push' | 'maintain' | 'reduce' | 'deload';

export interface ReadinessReport {
  readiness: Readiness;
  suggestion: ReadinessSuggestion;
  /** 0–100 composite score, higher = fresher. */
  score: number;
  metrics: {
    avgRecovery: number;
    missedRepRatio: number;
    avgRpe: number;
    sorenessHitRatio: number;
    sessionsAnalyzed: number;
  };
  reasons: string[];
}

// M2 fix: with no training data we don't actually KNOW readiness — defaulting
// to "Push 100/100" was misleading. Default to "Maintain" with a clear note.
const NEUTRAL: ReadinessReport = {
  readiness: 'moderate',
  suggestion: 'maintain',
  score: 70,
  metrics: {
    avgRecovery: 0,
    missedRepRatio: 0,
    avgRpe: 0,
    sorenessHitRatio: 0,
    sessionsAnalyzed: 0,
  },
  reasons: [
    'No recent training data — log a few sessions with honest RPE so this gets useful.',
  ],
};

/**
 * M3 fix: working sets only. Filters out warmups so a session with light
 * warmups + RPE 9 working sets isn't averaged down to RPE 7. Heuristic:
 * any set at ≥70% of the heaviest weight in that exercise is "working".
 */
function workingSets(ex: ExerciseLog): SetLog[] {
  const maxWeight = Math.max(0, ...ex.sets.map((s) => s.weight));
  if (maxWeight === 0) return ex.sets;
  const threshold = maxWeight * 0.7;
  return ex.sets.filter((s) => s.weight >= threshold);
}

export function computeReadiness(logs: WorkoutLog[], lookback = 5): ReadinessReport {
  const recent = [...logs]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, lookback);

  if (!recent.length) return NEUTRAL;

  const recoveries = recent
    .map((l) => l.recoveryScore)
    .filter((n): n is number => typeof n === 'number');
  const avgRecovery = recoveries.length
    ? recoveries.reduce((s, n) => s + n, 0) / recoveries.length
    : 0;

  // M3 fix: split warmup vs working sets so RPE averaging reflects actual
  // training stress, not session-wide dilution.
  const workingSetsAcrossSessions = recent.flatMap((l) =>
    l.exercises.flatMap((e) => workingSets(e)),
  );
  const allSets = recent.flatMap((l) => l.exercises.flatMap((e) => e.sets));

  // Missed-rep ratio uses ALL sets — a missed warmup is still a real signal.
  const missedCount = allSets.filter((s) => s.missed).length;
  const missedRepRatio = allSets.length ? missedCount / allSets.length : 0;

  // RPE averaging uses working sets only.
  const rpes = workingSetsAcrossSessions
    .map((s) => s.rpe)
    .filter((n): n is number => typeof n === 'number' && n > 0);
  const avgRpe = rpes.length ? rpes.reduce((s, n) => s + n, 0) / rpes.length : 0;

  const sorenessHits = recent.filter((l) => (l.sorenessAreas ?? []).length > 0).length;
  const sorenessHitRatio = recent.length ? sorenessHits / recent.length : 0;

  let score = 100;
  const reasons: string[] = [];

  if (avgRecovery > 0) {
    if (avgRecovery <= 4) {
      score -= 50;
      reasons.push(
        `Recovery averaging ${avgRecovery.toFixed(1)}/10 across last ${recent.length} sessions — body is not bouncing back.`,
      );
    } else if (avgRecovery <= 6) {
      score -= 20;
      reasons.push(
        `Recovery middling (${avgRecovery.toFixed(1)}/10) — sleep and food are the levers.`,
      );
    }
  }

  if (missedRepRatio >= 0.2) {
    score -= 30;
    reasons.push(
      `${Math.round(missedRepRatio * 100)}% of working sets missed — load is too heavy or recovery is too low.`,
    );
  } else if (missedRepRatio >= 0.1) {
    score -= 12;
    reasons.push(`Missed reps creeping up (${Math.round(missedRepRatio * 100)}%).`);
  }

  if (avgRpe >= 9) {
    score -= 20;
    reasons.push(`Avg RPE ${avgRpe.toFixed(1)} — running near max every session.`);
  } else if (avgRpe >= 8.5) {
    score -= 10;
  }

  if (sorenessHitRatio >= 0.6) {
    score -= 15;
    reasons.push('Soreness flagged in most recent sessions — fatigue is accumulating.');
  } else if (sorenessHitRatio >= 0.4) {
    score -= 7;
  }

  score = Math.max(0, Math.min(100, score));

  let readiness: Readiness;
  let suggestion: ReadinessSuggestion;
  if (score >= 80) {
    readiness = 'high';
    suggestion = 'push';
  } else if (score >= 60) {
    readiness = 'moderate';
    suggestion = 'maintain';
  } else if (score >= 40) {
    readiness = 'low';
    suggestion = 'reduce';
  } else {
    readiness = 'low';
    suggestion = 'deload';
  }

  if (!reasons.length) reasons.push('Training is well-managed — keep stacking.');

  return {
    readiness,
    suggestion,
    score,
    metrics: {
      avgRecovery,
      missedRepRatio,
      avgRpe,
      sorenessHitRatio,
      sessionsAnalyzed: recent.length,
    },
    reasons,
  };
}

export const SUGGESTION_COPY: Record<
  ReadinessSuggestion,
  { headline: string; body: string }
> = {
  push: {
    headline: 'Push',
    body: 'Recovery is strong. Hit your prescribed loads and chase progress.',
  },
  maintain: {
    headline: 'Maintain',
    body: "Hold loads steady. Quality reps over chasing PRs this week.",
  },
  reduce: {
    headline: 'Reduce',
    body: 'Cut volume by ~15% and back off RPE. Bar speed is the test.',
  },
  deload: {
    headline: 'Deload',
    body: 'Drop loads to 60%, RPE 6 cap, volume −30%. Sleep, food, walks.',
  },
};

export const READINESS_TONE: Record<Readiness, 'success' | 'warning' | 'danger'> = {
  high: 'success',
  moderate: 'warning',
  low: 'danger',
};
