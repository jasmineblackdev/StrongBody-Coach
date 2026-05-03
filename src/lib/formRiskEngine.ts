// Per-exercise form / fatigue risk read.
//
// Existing engines:
//   ml/injuryRisk.ts   — session-level summary across the whole week
//   ml/strengthForecaster.ts — main-lift specific (squat/bench/deadlift)
//
// This engine fills the gap: per-EXERCISE pattern detection across all
// logged movements, including accessories. A user benching 3× per week
// at RPE 9.5 with shoulder pain on tricep pushdown is a real form-risk
// signal that the other engines miss because tricep pushdown isn't a
// main lift and isn't aggregated at the session level alone.
//
// Pure deterministic — no ML, no APIs.

import type { ExerciseLog, SetLog, WorkoutLog } from '../types';

export type FormRiskLevel = 'low' | 'moderate' | 'high';

export type FormRecommendation =
  | 'repeat'
  | 'reduce_load'
  | 'reduce_volume'
  | 'deload'
  | 'swap_variation';

export interface ExerciseRiskReport {
  exerciseName: string;
  /** Most recent N sessions where the exercise was logged. */
  sessionsAnalyzed: number;
  totalWorkingSets: number;
  missedRatio: number; // 0..1
  avgRpe: number; // 0 when no rpe data
  highRpeRatio: number; // ratio of working sets at RPE ≥ 9
  hasPainNotes: boolean;
  /** Soreness areas reported on sessions where this exercise appeared. */
  sorenessSignal: number; // 0..1 = ratio of sessions where soreness was non-empty
  level: FormRiskLevel;
  flags: string[];
  recommendation: FormRecommendation;
  rationale: string;
}

export interface FormRiskReport {
  byExercise: ExerciseRiskReport[];
  /** The single most concerning exercise — null when nothing flagged. */
  topConcern: ExerciseRiskReport | null;
  /** Plain-English roll-up shown on the Workout Logger / Dashboard. */
  summary: string;
}

const SESSION_LIMIT = 5;
const MIN_SETS_FOR_READ = 4; // need at least 4 working sets across recent sessions

// ─── Helpers ────────────────────────────────────────────────────────────────

function workingSets(ex: ExerciseLog): SetLog[] {
  const max = Math.max(0, ...ex.sets.map((s) => s.weight));
  if (max === 0) return ex.sets;
  const threshold = max * 0.7;
  return ex.sets.filter((s) => s.weight >= threshold);
}

function relevantPain(painNotes: string | undefined): boolean {
  if (!painNotes) return false;
  return /\b(low.?back|lumbar|knee|patell|hip|shoulder|rotator|delt|wrist|elbow|pec|si\s|sciatic)\b/i.test(
    painNotes,
  );
}

// ─── Per-exercise read ─────────────────────────────────────────────────────

function analyzeExercise(
  exerciseName: string,
  logs: WorkoutLog[],
): ExerciseRiskReport | null {
  const sortedLogs = [...logs].sort((a, b) => b.date.localeCompare(a.date));
  const sessionsForThis: { log: WorkoutLog; ex: ExerciseLog }[] = [];
  for (const log of sortedLogs) {
    const matches = log.exercises.filter((e) => e.prescriptionName === exerciseName);
    for (const ex of matches) {
      sessionsForThis.push({ log, ex });
    }
    if (sessionsForThis.length >= SESSION_LIMIT) break;
  }

  if (!sessionsForThis.length) return null;

  // Aggregate working sets across these sessions
  const allWorking: SetLog[] = sessionsForThis.flatMap(({ ex }) => workingSets(ex));
  if (allWorking.length < MIN_SETS_FOR_READ) {
    return {
      exerciseName,
      sessionsAnalyzed: sessionsForThis.length,
      totalWorkingSets: allWorking.length,
      missedRatio: 0,
      avgRpe: 0,
      highRpeRatio: 0,
      hasPainNotes: sessionsForThis.some((s) => relevantPain(s.ex.painNotes)),
      sorenessSignal: 0,
      level: 'low',
      flags: [`Only ${allWorking.length} working sets logged — read is provisional.`],
      recommendation: 'repeat',
      rationale: 'Need a few more logged sets before flagging form risk.',
    };
  }

  const missed = allWorking.filter((s) => s.missed).length;
  const missedRatio = missed / allWorking.length;
  const rpeValues = allWorking
    .map((s) => s.rpe)
    .filter((n): n is number => typeof n === 'number' && n > 0);
  const avgRpe = rpeValues.length
    ? +(rpeValues.reduce((s, n) => s + n, 0) / rpeValues.length).toFixed(1)
    : 0;
  const highRpeRatio = rpeValues.length
    ? rpeValues.filter((r) => r >= 9).length / rpeValues.length
    : 0;
  const hasPainNotes = sessionsForThis.some((s) => relevantPain(s.ex.painNotes));
  const sessionsWithSoreness = sessionsForThis.filter(
    (s) => (s.log.sorenessAreas ?? []).length > 0,
  ).length;
  const sorenessSignal = sessionsWithSoreness / sessionsForThis.length;

  // Score → level + recommendation
  let score = 0;
  const flags: string[] = [];

  if (hasPainNotes) {
    score += 35;
    flags.push('Pain note logged in a recent session for this movement.');
  }
  if (missedRatio >= 0.2) {
    score += 30;
    flags.push(
      `${Math.round(missedRatio * 100)}% of working sets missed — load is outpacing the body.`,
    );
  } else if (missedRatio >= 0.1) {
    score += 12;
    flags.push(
      `Some missed reps creeping in (${Math.round(missedRatio * 100)}%).`,
    );
  }
  if (highRpeRatio >= 0.4) {
    score += 20;
    flags.push(
      `${Math.round(highRpeRatio * 100)}% of working sets at RPE ≥ 9 — running near max every session.`,
    );
  } else if (highRpeRatio >= 0.25 || avgRpe >= 8.5) {
    score += 8;
    flags.push('High RPE creeping in.');
  }
  if (sorenessSignal >= 0.6) {
    score += 10;
    flags.push('Soreness flagged on most sessions where this movement appeared.');
  }

  let level: FormRiskLevel;
  let recommendation: FormRecommendation;
  let rationale: string;

  if (hasPainNotes && missedRatio >= 0.15) {
    level = 'high';
    recommendation = 'swap_variation';
    rationale =
      'Pain + missed reps on the same movement is a clear form/fatigue signal. Swap to a safer variation this week.';
  } else if (hasPainNotes) {
    level = 'high';
    recommendation = 'reduce_load';
    rationale =
      'Pain reported during this lift. Drop 10–15% load and re-test next session — pain is information, not weakness.';
  } else if (score >= 50) {
    level = 'high';
    recommendation = 'deload';
    rationale =
      'Multiple risk flags compound. Deload this lift this week (60% load, RPE 6 cap) and let the body catch up.';
  } else if (missedRatio >= 0.2) {
    level = 'high';
    recommendation = 'reduce_load';
    rationale =
      'High missed-rep ratio means today\'s sets won\'t land clean either. Drop load 5–10% so the work is honest.';
  } else if (highRpeRatio >= 0.4 || score >= 25) {
    level = 'moderate';
    recommendation = 'reduce_volume';
    rationale =
      'Same load is fine but the volume is taxing the system. Cut a working set this week.';
  } else if (score >= 12) {
    level = 'moderate';
    recommendation = 'repeat';
    rationale =
      'Watch closely. Light flags — repeat the prescription and back off if anything tweaks.';
  } else {
    level = 'low';
    recommendation = 'repeat';
    rationale = 'Movement looks solid in the recent log window. Repeat the prescription.';
  }

  return {
    exerciseName,
    sessionsAnalyzed: sessionsForThis.length,
    totalWorkingSets: allWorking.length,
    missedRatio: +missedRatio.toFixed(2),
    avgRpe,
    highRpeRatio: +highRpeRatio.toFixed(2),
    hasPainNotes,
    sorenessSignal: +sorenessSignal.toFixed(2),
    level,
    flags,
    recommendation,
    rationale,
  };
}

// ─── Main entry ────────────────────────────────────────────────────────────

export function assessFormRisk(logs: WorkoutLog[]): FormRiskReport {
  // Find every distinct exercise name in recent logs.
  const recent = logs.slice(0, 12); // last ~12 sessions, plenty of room
  const namesSet = new Set<string>();
  recent.forEach((log) =>
    log.exercises.forEach((e) => namesSet.add(e.prescriptionName)),
  );

  const byExercise: ExerciseRiskReport[] = [];
  for (const name of namesSet) {
    const r = analyzeExercise(name, logs);
    if (r) byExercise.push(r);
  }

  // Sort: high → moderate → low, then by score (proxied by flag count)
  const levelRank: Record<FormRiskLevel, number> = { high: 0, moderate: 1, low: 2 };
  byExercise.sort((a, b) => {
    const lvl = levelRank[a.level] - levelRank[b.level];
    if (lvl !== 0) return lvl;
    return b.flags.length - a.flags.length;
  });

  const flagged = byExercise.filter((r) => r.level !== 'low');
  const topConcern = byExercise.find((r) => r.level === 'high') ?? null;

  let summary: string;
  if (!byExercise.length) {
    summary = 'Log a few sessions to enable per-exercise form risk reads.';
  } else if (!flagged.length) {
    summary = `All ${byExercise.length} tracked exercises looking clean. Keep stacking.`;
  } else if (topConcern) {
    summary = `Form risk: ${topConcern.exerciseName} is the top concern. ${flagged.length} exercise${flagged.length === 1 ? '' : 's'} flagged.`;
  } else {
    summary = `${flagged.length} exercise${flagged.length === 1 ? '' : 's'} at moderate risk — watch RPE on the next session.`;
  }

  return { byExercise, topConcern, summary };
}

// ─── UI tokens ─────────────────────────────────────────────────────────────

export const FORM_RISK_TONE: Record<FormRiskLevel, 'success' | 'warning' | 'danger'> = {
  low: 'success',
  moderate: 'warning',
  high: 'danger',
};

export const FORM_RECOMMENDATION_LABEL: Record<FormRecommendation, string> = {
  repeat: 'Repeat',
  reduce_load: 'Reduce load',
  reduce_volume: 'Cut a set',
  deload: 'Deload',
  swap_variation: 'Swap variation',
};
