// Confidence Score Engine
//
// Single read of "how much should we trust the next recommendation?".
// Used as a metadata layer on top of every major decision card so the
// app can be honest about uncertainty instead of pretending every
// number is high-confidence.
//
// Score is additive 0–100 with explicit reasons + missing-data list.
// Pain / injury risk overrides everything as a hard safety flag.

import type { BodyMetric, WeeklyCheckIn, WorkoutLog } from '../types';
import type { FemaleFatLossReport } from './femaleFatLossEngine';
import type { InjuryRiskReport } from './ml/injuryRisk';
import type { PhotoSet } from './photoStorage';

export type ConfidenceLevel = 'low' | 'medium' | 'high';

export interface ConfidenceReport {
  /** 0–100. Higher = the data supports a real decision. */
  score: number;
  level: ConfidenceLevel;
  /** Plain-English bullets — what the score is built on (the strong points). */
  reasons: string[];
  /** Plain-English bullets — what's missing or weak. */
  missingData: string[];
  /**
   * Hard safety override. True when pain or injury risk is the dominant
   * signal. UI must show the safety state regardless of confidence number.
   */
  safetyOverride: boolean;
  /** Plain-English safety note when safetyOverride is true; else null. */
  safetyNote: string | null;
}

export interface ConfidenceInput {
  metrics: BodyMetric[];
  checkIns: WeeklyCheckIn[];
  recentLogs: WorkoutLog[];
  photoSets?: PhotoSet[];
  femaleReport?: FemaleFatLossReport;
  injuryRisk?: InjuryRiskReport;
}

// ─── Score weights (sum to 100 before penalties) ──────────────────────────

const WEIGHT_DATA_MAX = 25;
const CHECKIN_MAX = 20;
const LOG_MAX = 15;
const WAIST_MAX = 15;
const ADHERENCE_MAX = 10;
const RECOVERY_MAX = 10;
const PHOTO_MAX = 5;

// Penalties — applied AFTER the additive score lands.
const PENALTY_BLOATING = 10;
const PENALTY_WATER_RETENTION = 10;
const PENALTY_STALE_WEIGHT = 10;

// ─── Helpers ───────────────────────────────────────────────────────────────

function daysAgo(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86400000));
}

function weightDataPoints(metrics: BodyMetric[]): {
  count14d: number;
  daysSinceLast: number | null;
} {
  const cutoff = Date.now() - 14 * 86400000;
  const recent = metrics.filter(
    (m) => typeof m.weightLbs === 'number' && new Date(m.date).getTime() >= cutoff,
  );
  const newest = metrics
    .filter((m) => typeof m.weightLbs === 'number')
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  return {
    count14d: recent.length,
    daysSinceLast: newest ? daysAgo(newest.date) : null,
  };
}

function waistMeasurementsLast30d(metrics: BodyMetric[]): number {
  const cutoff = Date.now() - 30 * 86400000;
  return metrics.filter(
    (m) => typeof m.waistIn === 'number' && new Date(m.date).getTime() >= cutoff,
  ).length;
}

function recoverySignalCount(logs: WorkoutLog[]): number {
  return logs.filter((l) => typeof l.recoveryScore === 'number').length;
}

function adherenceConsistency(checkIns: WeeklyCheckIn[]): {
  hasAny: boolean;
  consistentTier: boolean;
} {
  if (!checkIns.length) return { hasAny: false, consistentTier: false };
  if (checkIns.length === 1) return { hasAny: true, consistentTier: false };
  const last = checkIns[0];
  const prev = checkIns[1];
  const sameCal = last.caloriesAdherence === prev.caloriesAdherence;
  const sameProt = last.proteinAdherence === prev.proteinAdherence;
  return { hasAny: true, consistentTier: sameCal && sameProt };
}

function levelForScore(score: number): ConfidenceLevel {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

// ─── Main entry ────────────────────────────────────────────────────────────

export function computeConfidence(input: ConfidenceInput): ConfidenceReport {
  const reasons: string[] = [];
  const missingData: string[] = [];
  let score = 0;

  // Weight data — 0 to 25
  const wd = weightDataPoints(input.metrics);
  if (wd.count14d >= 14) {
    score += WEIGHT_DATA_MAX;
    reasons.push(`14+ daily weight readings — strong trend signal.`);
  } else if (wd.count14d >= 7) {
    score += Math.round(WEIGHT_DATA_MAX * 0.5);
    reasons.push(`${wd.count14d} weight readings in last 14 days — workable trend signal.`);
    missingData.push('More daily weigh-ins — aim for 14 to lock in trend confidence.');
  } else if (wd.count14d >= 3) {
    score += Math.round(WEIGHT_DATA_MAX * 0.25);
    missingData.push(`Only ${wd.count14d} weigh-ins in 14 days — too sparse to read a trend.`);
  } else {
    missingData.push('Daily morning weigh-ins (need at least 7 in the last 14 days).');
  }

  // Check-in completeness — 0 to 20
  const lastCheckIn = input.checkIns[0];
  if (lastCheckIn) {
    const days = daysAgo(lastCheckIn.date);
    if (days <= 7) {
      score += CHECKIN_MAX;
      reasons.push('Recent weekly check-in completed — adherence + body signals known.');
    } else if (days <= 14) {
      score += Math.round(CHECKIN_MAX * 0.5);
      reasons.push(`Last check-in ${days} days ago — somewhat fresh.`);
      missingData.push('A fresh weekly check-in (last one is more than a week old).');
    } else {
      score += Math.round(CHECKIN_MAX * 0.25);
      missingData.push(`A weekly check-in (last one is ${days} days old).`);
    }
  } else {
    missingData.push('A weekly check-in — bloating + hunger + adherence are all blind without it.');
  }

  // Workout logs — 0 to 15
  const recentLogCount = input.recentLogs.filter(
    (l) => daysAgo(l.date) <= 14,
  ).length;
  if (recentLogCount >= 6) {
    score += LOG_MAX;
    reasons.push(`${recentLogCount} workouts logged in last 2 weeks — strong training signal.`);
  } else if (recentLogCount >= 3) {
    score += Math.round(LOG_MAX * 0.66);
    reasons.push(`${recentLogCount} workouts logged in last 2 weeks.`);
    missingData.push('A couple more logged sessions to confirm the training response.');
  } else if (recentLogCount >= 1) {
    score += Math.round(LOG_MAX * 0.33);
    missingData.push('More logged sessions (the engine needs at least 3 in 2 weeks).');
  } else {
    missingData.push('Logged workouts — strength + recovery decisions need them.');
  }

  // Waist measurements — 0 to 15
  const waistCount = waistMeasurementsLast30d(input.metrics);
  if (waistCount >= 3) {
    score += WAIST_MAX;
    reasons.push(`${waistCount} waist measurements logged — body composition signal is real.`);
  } else if (waistCount >= 1) {
    score += Math.round(WAIST_MAX * 0.5);
    reasons.push(`${waistCount} waist measurement${waistCount === 1 ? '' : 's'} in last 30 days.`);
    missingData.push('More waist measurements — aim for 1 per week alongside photos.');
  } else {
    missingData.push('Waist measurements — the cleanest fat-loss signal beyond the scale.');
  }

  // Adherence consistency — 0 to 10
  const adh = adherenceConsistency(input.checkIns);
  if (adh.consistentTier) {
    score += ADHERENCE_MAX;
    reasons.push('Adherence has been consistent across the last two check-ins.');
  } else if (adh.hasAny) {
    score += Math.round(ADHERENCE_MAX * 0.5);
  }

  // Recovery signal — 0 to 10
  const rec = recoverySignalCount(input.recentLogs.slice(0, 7));
  if (rec >= 3) {
    score += RECOVERY_MAX;
    reasons.push(`Recovery scores logged on ${rec} recent sessions.`);
  } else if (rec >= 1) {
    score += Math.round(RECOVERY_MAX * 0.5);
  } else {
    missingData.push(
      'Recovery scores on logged workouts — fills the readiness signal.',
    );
  }

  // Photos — 0 to 5
  const photoCount = input.photoSets?.length ?? 0;
  if (photoCount >= 2) {
    score += PHOTO_MAX;
    reasons.push(`${photoCount} progress photo sets — supportive comparison ready.`);
  } else if (photoCount === 1) {
    missingData.push('A second photo set (you have a baseline; need a comparison anchor).');
  } else {
    missingData.push('Progress photo sets — supportive evidence beyond measurements.');
  }

  // ─── Penalties ─────────────────────────────────────────────────────────
  const bloatingHigh = (lastCheckIn?.bloatingLevel ?? 0) >= 7;
  if (bloatingHigh) {
    score -= PENALTY_BLOATING;
    missingData.push(
      `Lower bloating signal — at ${lastCheckIn?.bloatingLevel}/10, the scale and waist are partially masked.`,
    );
  }
  if (input.femaleReport?.state === 'water_retention') {
    score -= PENALTY_WATER_RETENTION;
    missingData.push(
      'A few more days for water retention to settle — the trend is unreliable right now.',
    );
  }
  if (wd.daysSinceLast !== null && wd.daysSinceLast > 3) {
    score -= PENALTY_STALE_WEIGHT;
    missingData.push(
      `A current weigh-in (last reading was ${wd.daysSinceLast} days ago).`,
    );
  }

  score = Math.max(0, Math.min(100, score));
  const level = levelForScore(score);

  // ─── Safety override ───────────────────────────────────────────────────
  let safetyOverride = false;
  let safetyNote: string | null = null;
  const painLowerBack = input.recentLogs
    .slice(0, 7)
    .some((l) =>
      l.exercises.some((e) => /low.?back|lumbar/i.test(e.painNotes ?? '')),
    );
  const painOther = input.recentLogs
    .slice(0, 7)
    .some((l) =>
      l.exercises.some((e) =>
        /knee|patell|shoulder|rotator|wrist|elbow/i.test(e.painNotes ?? ''),
      ),
    );
  if (
    input.injuryRisk?.level === 'high' ||
    painLowerBack ||
    painOther
  ) {
    safetyOverride = true;
    safetyNote =
      'Pain or injury risk reported. Confidence does not unlock plan changes when the body is signaling stress — safety beats confidence.';
  }

  return { score, level, reasons, missingData, safetyOverride, safetyNote };
}

// ─── UI tokens ─────────────────────────────────────────────────────────────

export const CONFIDENCE_TONE: Record<ConfidenceLevel, 'success' | 'warning' | 'danger'> = {
  high: 'success',
  medium: 'warning',
  low: 'danger',
};

export const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
};
