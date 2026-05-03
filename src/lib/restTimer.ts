// Rest period calculator + per-exercise persistence.
//
// Pure-function logic for the timer is here; UI lives in
// src/components/RestTimer.tsx.
//
// Base intent (from common evidence-based programming):
//   - Heavy compounds: 2–3 min between working sets
//   - Accessories:    1–1.5 min
//   - Core / abs:     30–60 sec
//
// Adjustments stack on top of the base:
//   RPE ≥ 9          → +30 sec
//   missed reps      → +60 sec
//   phase = deload   → ×0.7
//   goal = fat_loss  → −15 sec on accessory/core only (compounds need full
//                       recovery regardless of goal)

import type { ExercisePrescription, Goal, TrainingPhase } from '../types';
import { matchesMainLift } from './strengthEngine';

export type ExerciseCategory = 'main_lift' | 'accessory' | 'core';

export interface RestTimerInput {
  exerciseName: string;
  /** Tags from the prescription (e.g., 'main','accessory','core','glute'). */
  tags?: string[];
  /** Most recent set's RPE — used for the high-RPE bump. */
  lastSetRpe?: number;
  /** Whether the most recent set missed reps. */
  lastSetMissed?: boolean;
  phase?: TrainingPhase;
  goal?: Goal;
}

export interface RestTimerOutput {
  /** Final recommended rest in seconds, clamped to 30..360. */
  seconds: number;
  category: ExerciseCategory;
  /** Per-step explanation of how we got there. */
  breakdown: string[];
}

const STORAGE_KEY = 'sbc:restTimerOverrides';
const FLOOR_SEC = 30;
const CEIL_SEC = 360;

/**
 * Classify the exercise into one of three rest-time buckets. The order
 * matters — main lifts win over accessory tags so a "Main, Accessory"
 * tagged movement still gets the long rest.
 */
export function classifyExercise(input: {
  exerciseName: string;
  tags?: string[];
}): ExerciseCategory {
  const name = input.exerciseName.trim();
  const tags = (input.tags ?? []).map((t) => t.toLowerCase());

  if (
    tags.includes('main') ||
    matchesMainLift(name, 'squat') ||
    matchesMainLift(name, 'bench') ||
    matchesMainLift(name, 'deadlift')
  ) {
    return 'main_lift';
  }
  if (tags.includes('core') || /\b(plank|hollow|crunch|dead.?bug|ab\s|bracing)\b/i.test(name)) {
    return 'core';
  }
  return 'accessory';
}

const BASE_REST: Record<ExerciseCategory, number> = {
  main_lift: 150, // 2:30 — middle of the 120–180 sec band
  accessory: 75,  // 1:15 — middle of 60–90
  core: 45,       // middle of 30–60
};

export function computeRestTime(input: RestTimerInput): RestTimerOutput {
  const category = classifyExercise(input);
  const breakdown: string[] = [];

  let seconds = BASE_REST[category];
  breakdown.push(`Base ${category.replace('_', ' ')}: ${seconds}s`);

  // High RPE
  if (typeof input.lastSetRpe === 'number' && input.lastSetRpe >= 9) {
    seconds += 30;
    breakdown.push(`RPE ${input.lastSetRpe} → +30s`);
  }

  // Missed reps
  if (input.lastSetMissed) {
    seconds += 60;
    breakdown.push('Missed reps → +60s');
  }

  // Deload phase — body is supposed to recover faster so we keep sessions
  // brisk. ×0.7 across the board.
  if (input.phase === 'deload') {
    const before = seconds;
    seconds = Math.round(seconds * 0.7);
    breakdown.push(`Deload phase → ${before}s × 0.7 = ${seconds}s`);
  }

  // Fat-loss goal — keep accessories/core moving to keep heart rate up.
  // Main lifts still need full recovery regardless.
  if (input.goal === 'fat_loss' && category !== 'main_lift') {
    seconds -= 15;
    breakdown.push('Fat-loss goal → −15s (accessory/core)');
  }

  // Clamp to sane bounds.
  if (seconds < FLOOR_SEC) {
    breakdown.push(`Floor at ${FLOOR_SEC}s`);
    seconds = FLOOR_SEC;
  }
  if (seconds > CEIL_SEC) {
    breakdown.push(`Ceiling at ${CEIL_SEC}s`);
    seconds = CEIL_SEC;
  }

  return { seconds, category, breakdown };
}

// ─── Per-exercise overrides (gentle personalization) ───────────────────────
//
// When the user manually adjusts a rest time with +15 / −15 buttons, we
// remember the delta against the computed base for next time. This is a
// soft learning signal — we cap the cumulative override at ±60 seconds so
// a few accidental taps don't permanently warp the recommendation.

interface OverrideMap {
  [exerciseName: string]: number; // signed seconds offset
}

function readOverrides(): OverrideMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as OverrideMap) : {};
  } catch {
    return {};
  }
}

function writeOverrides(map: OverrideMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* localStorage full — silently ignore, the timer still works */
  }
}

/**
 * Returns the user's personalized override delta for an exercise (signed
 * seconds; can be negative for "I always rest less than the rec").
 */
export function getRestOverride(exerciseName: string): number {
  return readOverrides()[exerciseName] ?? 0;
}

/**
 * Records that the user manually adjusted today's rest by `deltaSec`.
 * We move the persisted override toward the new value at a slow rate so
 * one outlier session doesn't dominate.
 */
export function bumpRestOverride(exerciseName: string, deltaSec: number): void {
  const map = readOverrides();
  const prior = map[exerciseName] ?? 0;
  const learnRate = 0.5; // half-step toward the user's adjustment
  let next = Math.round(prior + deltaSec * learnRate);
  // Cap cumulative drift.
  next = Math.max(-60, Math.min(60, next));
  if (next === 0) {
    delete map[exerciseName];
  } else {
    map[exerciseName] = next;
  }
  writeOverrides(map);
}

export function clearRestOverride(exerciseName: string): void {
  const map = readOverrides();
  if (exerciseName in map) {
    delete map[exerciseName];
    writeOverrides(map);
  }
}

// ─── High-level helper (UI uses this) ───────────────────────────────────────

export function recommendRest(
  prescription: ExercisePrescription,
  context: {
    lastSetRpe?: number;
    lastSetMissed?: boolean;
    phase?: TrainingPhase;
    goal?: Goal;
  },
): { seconds: number; baseSeconds: number; override: number; category: ExerciseCategory } {
  const base = computeRestTime({
    exerciseName: prescription.name,
    tags: prescription.tags,
    lastSetRpe: context.lastSetRpe,
    lastSetMissed: context.lastSetMissed,
    phase: context.phase,
    goal: context.goal,
  });
  const override = getRestOverride(prescription.name);
  const total = Math.max(FLOOR_SEC, Math.min(CEIL_SEC, base.seconds + override));
  return {
    seconds: total,
    baseSeconds: base.seconds,
    override,
    category: base.category,
  };
}
