// Trainer Prescription Engine — explains why each exercise is on the
// plan, in a way that ties back to the user's goal, problem areas, and
// the current training phase.
//
// Pure function over the prescription + profile + session metadata.
// No external data; reads tags + name + the exercise library entry.

import type {
  ExercisePrescription,
  Goal,
  ProblemArea,
  Profile,
  TrainingPhase,
  WeakPoint,
} from '../types';
import { findExercise } from './exerciseLibrary';
import { matchesMainLift } from './strengthEngine';

export type ExerciseRole =
  | 'main_lift'
  | 'main_variation'
  | 'glute_builder'
  | 'back_strength'
  | 'triceps_lockout'
  | 'core_brace'
  | 'grip'
  | 'mobility'
  | 'general_accessory';

export interface PrescriptionRationale {
  /** One-line headline. */
  headline: string;
  /** Coach's read in 2–4 sentences, plain English. */
  whyChosen: string;
  /** What this targets (muscle groups + functional role). */
  whatItTargets: string[];
  /** Why this exercise belongs in the CURRENT phase. */
  whyNow: string;
  /** Suggested alternates — safer or harder swaps. */
  alternates: { name: string; reason: string }[];
  /** Specific pitfalls to watch for. */
  watchOutFor: string[];
  role: ExerciseRole;
}

// ─── Role inference ─────────────────────────────────────────────────────────

function inferRole(prescription: ExercisePrescription): ExerciseRole {
  const tags = (prescription.tags ?? []).map((t) => t.toLowerCase());
  const name = prescription.name;

  if (
    tags.includes('main') ||
    matchesMainLift(name, 'squat') ||
    matchesMainLift(name, 'bench') ||
    matchesMainLift(name, 'deadlift')
  ) {
    return 'main_lift';
  }

  // Variation of a main lift — Paused Squat, Front Squat, Close-Grip Bench…
  if (
    /\b(paus(ed|e)|front|tempo|deficit|close.?grip|incline|decline|spoto|larsen|feet.?up|board|pin)\b/i.test(name)
  ) {
    return 'main_variation';
  }

  if (tags.includes('glute')) return 'glute_builder';
  if (tags.includes('back')) return 'back_strength';
  if (tags.includes('triceps')) return 'triceps_lockout';
  if (tags.includes('core')) return 'core_brace';
  if (tags.includes('grip')) return 'grip';
  if (/\b(mobility|hip\s|ankle|stretch|rotation)\b/i.test(name)) return 'mobility';
  return 'general_accessory';
}

// ─── Phase phrasing ─────────────────────────────────────────────────────────

function phaseRationale(role: ExerciseRole, phase: TrainingPhase): string {
  if (phase === 'deload') {
    return role === 'main_lift'
      ? "Deload week — main lifts run light to drain fatigue without losing the groove."
      : "Deload week — keep accessories light and fast. The goal is recovery, not stimulus.";
  }
  if (phase === 'peak') {
    return role === 'main_lift'
      ? 'Peak block — heavy main work near max so the central nervous system is primed for a test.'
      : 'Peak block — accessories drop in volume so all energy goes to the main lifts.';
  }
  if (phase === 'strength') {
    if (role === 'main_lift') return 'Strength block — moderate-heavy loads at low rep ranges build the actual lift.';
    if (role === 'main_variation') return 'Variation work fixes a weak link in the main lift while keeping the bar path.';
    if (role === 'glute_builder') return "Glute work runs heavier here so it actually contributes to squat / deadlift strength.";
    if (role === 'back_strength') return "Strong upper back is the platform every press and squat sits on.";
    if (role === 'triceps_lockout') return 'Heavier triceps work directly transfers to bench lockout strength.';
    if (role === 'core_brace') return 'Heavy bracing is what protects your spine when the main lifts go up.';
    if (role === 'grip') return "Grip is often the deadlift bottleneck. Train it directly, don't rely on straps.";
    return 'Accessories support the main lifts and target weak links in the strength block.';
  }
  // hypertrophy
  if (role === 'main_lift') return 'Hypertrophy block — submaximal main lifts at higher rep ranges build the muscle that produces strength.';
  if (role === 'main_variation') return 'Variation work bridges the gap between hypertrophy volume and main-lift specificity.';
  if (role === 'glute_builder') return "Hypertrophy phase — this is where glutes actually grow if the food is there.";
  if (role === 'back_strength') return 'Volume on the back here transfers directly to a bigger bench and squat down the road.';
  if (role === 'triceps_lockout') return 'Triceps grow on volume, not intensity — this rep range is the sweet spot.';
  if (role === 'core_brace') return 'Anti-rotation + anti-extension work builds the trunk that holds up under heavier loads later.';
  if (role === 'grip') return 'Grip work prevents the deadlift from being limited by your hands.';
  return 'Accessories chase volume in the hypertrophy block — that volume is what becomes strength later.';
}

// ─── Goal phrasing ──────────────────────────────────────────────────────────

function goalNote(role: ExerciseRole, goal: Goal): string | null {
  if (goal === 'fat_loss') {
    if (role === 'main_lift') {
      return "On a fat-loss block, main lifts protect muscle while the deficit takes the fat. Don't skip them.";
    }
    if (role === 'glute_builder') {
      return 'Glute building is what makes the photo at the goal weight look the way you want it to. This is the most important accessory on a cut.';
    }
    if (role === 'core_brace') {
      return 'A flat midsection comes from core training + deficit, not crunches.';
    }
  }
  return null;
}

// ─── Problem-area + weak-point links ────────────────────────────────────────

function problemAreaLinks(
  role: ExerciseRole,
  problemAreas: ProblemArea[],
): string[] {
  const out: string[] = [];
  if (problemAreas.includes('lower_back') && (role === 'core_brace' || role === 'glute_builder')) {
    out.push("Targets your `lower back` problem area — strong glutes + bracing offload spinal stress.");
  }
  if (problemAreas.includes('glutes') && role === 'glute_builder') {
    out.push("Direct hit on the `glutes` problem area you flagged on Profile.");
  }
  if (problemAreas.includes('core') && role === 'core_brace') {
    out.push("Direct work on the `core` problem area — anti-rotation and bracing carry over to every lift.");
  }
  if (problemAreas.includes('grip') && role === 'grip') {
    out.push("Targeted grip work — addresses the bottleneck on heavier deadlifts.");
  }
  if (problemAreas.includes('shoulders') && role === 'back_strength') {
    out.push('Strong upper back keeps shoulders in a healthy position under load.');
  }
  return out;
}

function weakPointLinks(role: ExerciseRole, weakPoints: WeakPoint[]): string[] {
  const out: string[] = [];
  for (const wp of weakPoints) {
    if (wp.key === 'glute_weakness' && role === 'glute_builder') {
      out.push(`Engine flagged glute weakness — this exercise is part of the fix.`);
    }
    if (wp.key === 'core_bracing' && role === 'core_brace') {
      out.push(`Engine flagged a bracing weakness — direct training.`);
    }
    if (wp.key === 'grip_failure' && role === 'grip') {
      out.push(`Engine flagged grip failure on a recent deadlift — this is the fix.`);
    }
    if (wp.key === 'lower_back_pain' && (role === 'core_brace' || role === 'glute_builder')) {
      out.push(`Engine flagged lower-back pain history — building support is the path back to safe heavy lifting.`);
    }
  }
  return out;
}

// ─── Alternates ─────────────────────────────────────────────────────────────

const ALTERNATES: Record<ExerciseRole, { name: string; reason: string }[]> = {
  main_lift: [
    { name: 'Front Squat', reason: 'Less spinal load when the back is tight or recovering.' },
    { name: 'Goblet Squat', reason: 'Easier bracing pattern; great for re-grooving the movement.' },
  ],
  main_variation: [
    { name: 'Tempo Squat (3-1-1)', reason: 'Slow eccentric exposes positional weaknesses.' },
    { name: 'Pause Squat', reason: 'Hole-strength + bracing under tension.' },
  ],
  glute_builder: [
    { name: 'Hip Thrust', reason: 'The most direct glute loader — pause at top, ribs down.' },
    { name: 'Bulgarian Split Squat', reason: 'Long stride for glute bias; trains balance.' },
    { name: 'Romanian Deadlift', reason: 'Hamstring + glute hinge; teaches hip drive.' },
  ],
  back_strength: [
    { name: 'Chest-Supported Row', reason: 'Upper-back work without taxing the lower back.' },
    { name: 'Lat Pulldown', reason: 'Easier bracing alternative for vertical pulling.' },
  ],
  triceps_lockout: [
    { name: 'Close-Grip Bench', reason: 'Compound triceps with crossover to bench.' },
    { name: 'Tricep Pushdown', reason: 'Isolation; lets the lockout fail without taxing pressing.' },
  ],
  core_brace: [
    { name: 'Pallof Press', reason: 'Anti-rotation — what your spine actually needs under load.' },
    { name: 'Dead Bug', reason: 'Anti-extension — re-grooves the lower-back position.' },
    { name: 'Plank with Shoulder Tap', reason: 'Anti-rotation under fatigue.' },
  ],
  grip: [
    { name: 'Farmer Carry', reason: 'Loaded carry — full-body grip + posture work.' },
    { name: 'Hanging from a Bar (timed)', reason: 'Cheapest grip stim there is.' },
  ],
  mobility: [
    { name: '90/90 Hip Switch', reason: 'Hip rotation drill — opens up squat depth.' },
    { name: 'Couch Stretch', reason: 'Hip flexor mobility — improves squat lockout.' },
  ],
  general_accessory: [
    { name: 'Same exercise, lighter', reason: 'When fatigue is high, the swap is the load, not the movement.' },
  ],
};

// ─── Watch out fors ─────────────────────────────────────────────────────────

const WATCH_OUTS: Record<ExerciseRole, string[]> = {
  main_lift: [
    'Form breakdown on the last 1–2 reps is when injuries happen — rack it before then.',
    'Don\'t reuse air across reps. New brace, every rep.',
  ],
  main_variation: [
    'Variations expose your weak link — don\'t treat them like full-effort main lifts.',
  ],
  glute_builder: [
    'Drive through the heels and squeeze hard at the top — feel the glute, not the lower back.',
  ],
  back_strength: [
    'Pull with the elbows, not the hands — wrists relaxed, lats engaged.',
  ],
  triceps_lockout: [
    'Elbow path stays controlled — flaring puts stress on the elbow joint.',
  ],
  core_brace: [
    'Quality > duration. A 30-second tight plank beats 60 seconds of sagging.',
  ],
  grip: [
    'Crush grip vs. hook grip vs. mixed — pick one strategy per session and stick with it.',
  ],
  mobility: [
    'Mobility is a skill — slow, controlled, with intent. Not a stretch.',
  ],
  general_accessory: [
    'Check tag relevance — accessories should map to a weak link, not just fill space.',
  ],
};

// ─── Main entry point ──────────────────────────────────────────────────────

export interface PrescriptionContext {
  profile: Profile;
  phase: TrainingPhase;
  weakPoints?: WeakPoint[];
}

export function explainPrescription(
  prescription: ExercisePrescription,
  ctx: PrescriptionContext,
): PrescriptionRationale {
  const role = inferRole(prescription);
  const entry = findExercise(prescription.name);

  // Headline
  const headline = headlineForRole(role, prescription.name);

  // What it targets
  const targets: string[] = [];
  if (entry) {
    entry.primaryMuscles.forEach((m) => targets.push(`Primary: ${m}`));
    entry.secondaryMuscles.forEach((m) => targets.push(`Synergist: ${m}`));
  }
  if (!targets.length) {
    // Fallback: derive from tags / name when there's no library entry
    if (role === 'glute_builder') targets.push('Primary: Glutes');
    if (role === 'core_brace') targets.push('Primary: Trunk / abs');
    if (role === 'back_strength') targets.push('Primary: Mid + upper back');
    if (role === 'triceps_lockout') targets.push('Primary: Triceps');
    if (role === 'grip') targets.push('Primary: Forearms / grip');
  }

  // Why chosen — assembled from problem areas, weak points, and goal
  const reasons: string[] = [];
  reasons.push(roleBlurb(role));
  const goal = goalNote(role, ctx.profile.goal);
  if (goal) reasons.push(goal);
  reasons.push(...problemAreaLinks(role, ctx.profile.problemAreas));
  reasons.push(...weakPointLinks(role, ctx.weakPoints ?? []));

  return {
    headline,
    whyChosen: reasons.join(' '),
    whatItTargets: targets,
    whyNow: phaseRationale(role, ctx.phase),
    alternates: ALTERNATES[role],
    watchOutFor: WATCH_OUTS[role],
    role,
  };
}

function headlineForRole(role: ExerciseRole, name: string): string {
  switch (role) {
    case 'main_lift':
      return `${name} — main lift. The whole plan revolves around moving this number up safely.`;
    case 'main_variation':
      return `${name} — variation work. Built to expose and fix the weakness in the main lift.`;
    case 'glute_builder':
      return `${name} — glute builder. Key on this body, this goal.`;
    case 'back_strength':
      return `${name} — back strength. The platform every other lift sits on.`;
    case 'triceps_lockout':
      return `${name} — triceps lockout. Direct carryover to bench top-end.`;
    case 'core_brace':
      return `${name} — bracing work. What keeps the heavy lifts safe.`;
    case 'grip':
      return `${name} — grip. Removes the bottleneck on deadlifts.`;
    case 'mobility':
      return `${name} — mobility. Earns range of motion you can use under load.`;
    case 'general_accessory':
      return `${name} — accessory. Chases volume that becomes strength later.`;
  }
}

function roleBlurb(role: ExerciseRole): string {
  switch (role) {
    case 'main_lift':
      return 'This is the lift the whole program is built around — the rest of the session is supporting cast.';
    case 'main_variation':
      return 'Variations of the main lift fix a specific weak link without risking the bar path.';
    case 'glute_builder':
      return 'Glute work is the highest-leverage accessory for both performance and aesthetics on this body type and goal.';
    case 'back_strength':
      return 'Pulling volume and back strength carry over to every press and squat — and to posture under load.';
    case 'triceps_lockout':
      return 'Triceps determine where the bench actually finishes. Direct work means lockout strength shows up under the bar.';
    case 'core_brace':
      return 'Anti-rotation and anti-extension are what protect the spine when the main lifts get heavy.';
    case 'grip':
      return "Grip is often the deadlift bottleneck — train it directly, don't rely on straps.";
    case 'mobility':
      return 'Mobility unlocks positions you can produce force from. It pays dividends across the whole plan.';
    case 'general_accessory':
      return 'Accessories chase volume and address weak links — they become strength later in the block.';
  }
}
