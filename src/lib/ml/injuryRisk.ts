// Composite injury-risk score from RPE × missed reps × pain notes ×
// soreness frequency. Pure functions over recent logs.

import type { WorkoutLog } from '../../types';

export type RiskLevel = 'low' | 'moderate' | 'high';

export interface InjuryRiskReport {
  level: RiskLevel;
  /** 0–100 score; higher = more risk. */
  score: number;
  flags: string[];
  recommendation: string;
}

const LOW: InjuryRiskReport = {
  level: 'low',
  score: 0,
  flags: [],
  recommendation:
    'Risk is low. Stay honest with form and you can push the prescribed loads.',
};

export function assessInjuryRisk(
  logs: WorkoutLog[],
  lookback = 7,
): InjuryRiskReport {
  const recent = [...logs]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, lookback);

  if (!recent.length) {
    return {
      ...LOW,
      recommendation:
        'Log a few sessions to enable injury-risk assessment.',
    };
  }

  let score = 0;
  const flags: string[] = [];

  const allSets = recent.flatMap((l) => l.exercises.flatMap((e) => e.sets));
  const totalSets = Math.max(1, allSets.length);
  const highRpeRatio =
    allSets.filter((s) => (s.rpe ?? 0) >= 9).length / totalSets;
  const missedRatio = allSets.filter((s) => s.missed).length / totalSets;

  if (highRpeRatio >= 0.4) {
    score += 30;
    flags.push(
      `${Math.round(highRpeRatio * 100)}% of sets at RPE ≥ 9 — running near max every session.`,
    );
  } else if (highRpeRatio >= 0.25) {
    score += 15;
    flags.push('High RPE creeping in.');
  }

  if (missedRatio >= 0.15) {
    score += 25;
    flags.push(
      `${Math.round(missedRatio * 100)}% of sets missed — load is outpacing recovery.`,
    );
  } else if (missedRatio >= 0.08) {
    score += 12;
    flags.push('Some missed reps appearing.');
  }

  // Pain notes — joint-specific
  const painLowerBack = recent.some((l) =>
    l.exercises.some((e) => /low.?back|lumbar/i.test(e.painNotes ?? '')),
  );
  const painShoulder = recent.some((l) =>
    l.exercises.some((e) => /shoulder|rotator|delt/i.test(e.painNotes ?? '')),
  );
  const painKnee = recent.some((l) =>
    l.exercises.some((e) => /knee|patell/i.test(e.painNotes ?? '')),
  );
  const painWristElbow = recent.some((l) =>
    l.exercises.some((e) => /wrist|elbow/i.test(e.painNotes ?? '')),
  );

  if (painLowerBack) {
    score += 30;
    flags.push('Lower-back pain reported.');
  }
  if (painShoulder) {
    score += 25;
    flags.push('Shoulder pain reported.');
  }
  if (painKnee) {
    score += 25;
    flags.push('Knee pain reported.');
  }
  if (painWristElbow) {
    score += 15;
    flags.push('Wrist/elbow pain reported.');
  }

  // Soreness frequency
  const sorenessCount = recent.filter(
    (l) => (l.sorenessAreas ?? []).length > 0,
  ).length;
  if (sorenessCount / recent.length >= 0.6) {
    score += 12;
    flags.push('Soreness flagged in most recent sessions.');
  }

  score = Math.min(100, score);

  let level: RiskLevel;
  let recommendation: string;
  if (score >= 50) {
    level = 'high';
    recommendation =
      'High risk. Reduce intensity ~20% next session, swap to safer variations (front squat, RDL), and prioritize recovery before adding load.';
  } else if (score >= 25) {
    level = 'moderate';
    recommendation =
      'Risk is creeping up. Watch RPE closely on the next session and back off if anything tweaks. No new PR attempts this week.';
  } else {
    level = 'low';
    recommendation = LOW.recommendation;
  }

  return { level, score, flags, recommendation };
}

export const RISK_TONE: Record<RiskLevel, 'success' | 'warning' | 'danger'> = {
  low: 'success',
  moderate: 'warning',
  high: 'danger',
};
