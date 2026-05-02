import type {
  AdjustmentDecision,
  ExercisePrescription,
  PlanChange,
  PlanOp,
  PlanProposal,
  Profile,
  WeeklyPlan,
  WorkoutDay,
  WorkoutLog,
  WorkoutSession,
} from '../types';
import { adjustExercise, sessionLevelDecisions } from './autoAdjust';
import { buildWeeklyPlan } from './workoutPlan';

// ─── helpers ─────────────────────────────────────────────────────────────────

function deepClonePlan(plan: WeeklyPlan): WeeklyPlan {
  return JSON.parse(JSON.stringify(plan));
}

function bumpWeek(plan: WeeklyPlan, toWeek: number): WeeklyPlan {
  plan.weekNumber = toWeek;
  plan.sessions = plan.sessions.map((s) => ({
    ...s,
    weekNumber: toWeek,
    id: s.id.replace(/w\d+$/i, `w${toWeek}`),
  }));
  return plan;
}

function findSession(plan: WeeklyPlan, day: WorkoutDay): WorkoutSession | undefined {
  return plan.sessions.find((s) => s.day === day);
}

function hasExercise(session: WorkoutSession, name: string): boolean {
  return session.prescriptions.some((p) => p.name.toLowerCase() === name.toLowerCase());
}

let _idCounter = 0;
function nextId(prefix: string): string {
  _idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${_idCounter}`;
}

// ─── op application (used by applyChanges) ──────────────────────────────────

function applyOp(plan: WeeklyPlan, op: PlanOp): void {
  if (op.kind === 'phase_change') return; // handled at applyChanges level
  const session = plan.sessions.find((s) => s.day === op.day);
  if (!session) return;
  switch (op.kind) {
    case 'load_set': {
      const p = session.prescriptions.find((x) => x.name === op.exercise);
      if (p) p.loadLbs = op.loadLbs;
      break;
    }
    case 'sets_set': {
      const p = session.prescriptions.find((x) => x.name === op.exercise);
      if (p) p.sets = op.sets;
      break;
    }
    case 'add_exercise': {
      if (!hasExercise(session, op.prescription.name)) {
        session.prescriptions.push(op.prescription);
      }
      break;
    }
    case 'swap_exercise': {
      const idx = session.prescriptions.findIndex(
        (x) => x.name.toLowerCase() === op.fromName.toLowerCase(),
      );
      if (idx >= 0) session.prescriptions[idx] = op.to;
      break;
    }
  }
}

/**
 * Given a base plan and a set of accepted changes, produce the resulting next-week plan.
 * - Phase change short-circuits to a freshly built plan in the new phase.
 * - Otherwise mutates a clone of fromPlan with each accepted change's ops.
 */
export function applyChanges(args: {
  fromPlan: WeeklyPlan;
  profile: Profile;
  toWeek: number;
  changes: PlanChange[];
}): WeeklyPlan {
  const { fromPlan, profile, toWeek, changes } = args;

  const phaseChange = changes.find((c) => c.kind === 'phase_change');
  if (phaseChange) {
    const phaseOp = phaseChange.ops.find(
      (o): o is Extract<PlanOp, { kind: 'phase_change' }> => o.kind === 'phase_change',
    );
    if (phaseOp) return buildWeeklyPlan(profile, toWeek, phaseOp.phase);
  }

  const plan = bumpWeek(deepClonePlan(fromPlan), toWeek);
  for (const change of changes) {
    for (const op of change.ops) applyOp(plan, op);
  }
  return plan;
}

// ─── builders that emit (mutation, change) pairs ─────────────────────────────

interface MutationContext {
  toPlan: WeeklyPlan; // mutated in place to compute the "all accepted" preview
  changes: PlanChange[];
}

function emitAddToSession(
  ctx: MutationContext,
  session: WorkoutSession,
  prescription: ExercisePrescription,
  reason: string,
): void {
  if (hasExercise(session, prescription.name)) return;
  session.prescriptions.push(prescription);
  ctx.changes.push({
    id: nextId('chg'),
    day: session.day,
    exercise: prescription.name,
    kind: 'add_exercise',
    after: `${prescription.sets} × ${prescription.reps}`,
    reason,
    ops: [{ kind: 'add_exercise', day: session.day, prescription }],
  });
}

function emitAddToAllSessions(
  ctx: MutationContext,
  prescription: ExercisePrescription,
  reason: string,
): void {
  const ops: PlanOp[] = [];
  for (const s of ctx.toPlan.sessions) {
    if (!hasExercise(s, prescription.name)) {
      s.prescriptions.push(prescription);
      ops.push({ kind: 'add_exercise', day: s.day, prescription });
    }
  }
  if (!ops.length) return;
  ctx.changes.push({
    id: nextId('chg'),
    day: 'all',
    exercise: prescription.name,
    kind: 'add_exercise',
    after: `${prescription.sets} × ${prescription.reps} on every session`,
    reason,
    ops,
  });
}

function emitSwap(
  ctx: MutationContext,
  session: WorkoutSession,
  fromPattern: RegExp,
  to: ExercisePrescription,
  reason: string,
): void {
  const idx = session.prescriptions.findIndex((p) => fromPattern.test(p.name));
  if (idx < 0) return;
  const fromName = session.prescriptions[idx].name;
  session.prescriptions[idx] = to;
  ctx.changes.push({
    id: nextId('chg'),
    day: session.day,
    exercise: to.name,
    kind: 'swap_exercise',
    before: fromName,
    after: to.name,
    reason,
    ops: [{ kind: 'swap_exercise', day: session.day, fromName, to }],
  });
}

function emitVolumeDecrease(
  ctx: MutationContext,
  session: WorkoutSession,
  pres: ExercisePrescription,
  reason: string,
): void {
  if (pres.sets <= 1) return;
  const before = `${pres.sets} × ${pres.reps}`;
  const newSets = pres.sets - 1;
  pres.sets = newSets;
  ctx.changes.push({
    id: nextId('chg'),
    day: session.day,
    exercise: pres.name,
    kind: 'volume_decrease',
    before,
    after: `${newSets} × ${pres.reps}`,
    reason,
    ops: [{ kind: 'sets_set', day: session.day, exercise: pres.name, sets: newSets }],
  });
}

function emitLoadDelta(
  ctx: MutationContext,
  session: WorkoutSession,
  pres: ExercisePrescription,
  delta: number,
  kind: 'load_increase' | 'load_decrease',
  reason: string,
): void {
  if (!pres.loadLbs || !delta) return;
  const before = `${pres.loadLbs} lb`;
  const newLoad = Math.max(0, pres.loadLbs + delta);
  pres.loadLbs = newLoad;
  ctx.changes.push({
    id: nextId('chg'),
    day: session.day,
    exercise: pres.name,
    kind,
    before,
    after: `${newLoad} lb`,
    reason,
    ops: [{ kind: 'load_set', day: session.day, exercise: pres.name, loadLbs: newLoad }],
  });
}

// ─── core engine ─────────────────────────────────────────────────────────────

export interface GenerateInput {
  currentPlan: WeeklyPlan;
  profile: Profile;
  recentLogs: WorkoutLog[]; // logs from current week (or recent enough to be relevant)
}

export function generateProposal({
  currentPlan,
  profile,
  recentLogs,
}: GenerateInput): PlanProposal | null {
  if (!recentLogs.length) return null;

  const fromWeek = currentPlan.weekNumber;
  const toWeek = fromWeek + 1;

  // 1. Whole-week deload short-circuit
  const fatigueLog = recentLogs.find((l) => (l.recoveryScore ?? 10) <= 4);
  if (fatigueLog) {
    const reason =
      `Recovery is at ${fatigueLog.recoveryScore}/10. Deload week — 60% loads, RPE 6 cap, ` +
      `volume cut by a third. Sleep, protein, walks.`;
    return {
      fromWeek,
      toWeek,
      fromPhase: currentPlan.phase,
      toPhase: 'deload',
      fromPlan: currentPlan,
      changes: [
        {
          id: nextId('chg'),
          day: 'all',
          exercise: '(whole plan)',
          kind: 'phase_change',
          before: currentPlan.phase,
          after: 'deload',
          reason,
          ops: [{ kind: 'phase_change', phase: 'deload' }],
        },
      ],
      generatedAt: new Date().toISOString(),
      sourceLogIds: recentLogs.map((l) => l.id),
    };
  }

  const ctx: MutationContext = {
    toPlan: bumpWeek(deepClonePlan(currentPlan), toWeek),
    changes: [],
  };

  // 2. Per-exercise adjustments
  for (const log of recentLogs) {
    const sourceSession = findSession(currentPlan, log.day);
    const targetSession = findSession(ctx.toPlan, log.day);
    if (!sourceSession || !targetSession) continue;

    for (const exLog of log.exercises) {
      const sourcePres = sourceSession.prescriptions.find(
        (p) => p.name === exLog.prescriptionName,
      );
      const targetPres = targetSession.prescriptions.find(
        (p) => p.name === exLog.prescriptionName,
      );
      if (!sourcePres || !targetPres) continue;

      const decision = adjustExercise({
        prescription: sourcePres,
        log: exLog,
        recovery: log.recoveryScore,
        fatigueHigh: false,
      });

      switch (decision.action) {
        case 'increase':
          emitLoadDelta(
            ctx,
            targetSession,
            targetPres,
            decision.suggestedLbsDelta ?? 0,
            'load_increase',
            decision.message,
          );
          break;
        case 'reduce_weight':
          emitLoadDelta(
            ctx,
            targetSession,
            targetPres,
            decision.suggestedLbsDelta ?? 0,
            'load_decrease',
            decision.message,
          );
          break;
        case 'reduce_volume':
          emitVolumeDecrease(ctx, targetSession, targetPres, decision.message);
          break;
        case 'repeat':
        default:
          break;
      }
    }
  }

  // 3. Session-level decisions
  for (const log of recentLogs) {
    const decisions = sessionLevelDecisions(log).filter((d) => d.action !== 'deload');
    for (const d of decisions) {
      applySessionLevelDecision(ctx, d);
    }
  }

  if (!ctx.changes.length) return null;

  return {
    fromWeek,
    toWeek,
    fromPhase: currentPlan.phase,
    toPhase: ctx.toPlan.phase,
    fromPlan: currentPlan,
    changes: ctx.changes,
    generatedAt: new Date().toISOString(),
    sourceLogIds: recentLogs.map((l) => l.id),
  };
}

function applySessionLevelDecision(ctx: MutationContext, d: AdjustmentDecision): void {
  const reason = d.message;

  // Lower-back pain
  if (d.action === 'swap' && /squat\s*\/\s*deadlift/i.test(d.exercise)) {
    const squatSession = findSession(ctx.toPlan, 'squat');
    if (squatSession) {
      emitSwap(
        ctx,
        squatSession,
        /^Back Squat$/i,
        {
          name: 'Front Squat',
          sets: 3,
          reps: '5',
          loadLbs: undefined,
          restSec: 180,
          rpeTarget: 7,
          notes: 'Upright torso. Cleans up bracing and protects the low back.',
          tags: ['main'],
        },
        reason,
      );
    }
    const dlSession = findSession(ctx.toPlan, 'deadlift');
    if (dlSession) {
      const dl = dlSession.prescriptions.find((p) => /conventional deadlift/i.test(p.name));
      if (dl) emitVolumeDecrease(ctx, dlSession, dl, reason);
    }
    emitAddToAllSessions(
      ctx,
      { name: 'Pallof Press', sets: 3, reps: '10/side', restSec: 60, tags: ['core'] },
      reason,
    );
    emitAddToAllSessions(
      ctx,
      { name: 'Dead Bug', sets: 3, reps: '8/side', restSec: 45, tags: ['core'] },
      reason,
    );
    return;
  }

  // Grip on deadlift
  if (d.action === 'add_accessory' && /deadlift/i.test(d.exercise) && /grip/i.test(reason)) {
    const dlSession = findSession(ctx.toPlan, 'deadlift');
    if (!dlSession) return;
    emitAddToSession(
      ctx,
      dlSession,
      { name: 'Farmer Carry', sets: 3, reps: '40 yds', restSec: 90, tags: ['grip', 'core'] },
      reason,
    );
    emitAddToSession(
      ctx,
      dlSession,
      { name: 'Plate Pinch Hold', sets: 3, reps: '30s', restSec: 60, tags: ['grip'] },
      reason,
    );
    emitAddToSession(
      ctx,
      dlSession,
      { name: 'Dead Hang', sets: 3, reps: 'max', restSec: 60, tags: ['grip'] },
      reason,
    );
    return;
  }

  // Bench stall
  if (d.action === 'add_accessory' && /^bench$/i.test(d.exercise)) {
    const session = findSession(ctx.toPlan, 'bench');
    if (!session) return;
    emitAddToSession(
      ctx,
      session,
      { name: 'Paused Bench (2s)', sets: 3, reps: '5', restSec: 120, tags: ['accessory'] },
      reason,
    );
    emitAddToSession(
      ctx,
      session,
      { name: 'Close-Grip Bench', sets: 3, reps: '6-8', restSec: 120, tags: ['triceps'] },
      reason,
    );
    emitAddToSession(
      ctx,
      session,
      { name: 'Tricep Pushdown', sets: 3, reps: '10-12', restSec: 60, tags: ['triceps'] },
      reason,
    );
    return;
  }

  // Squat stall
  if (d.action === 'add_accessory' && /^squat$/i.test(d.exercise)) {
    const session = findSession(ctx.toPlan, 'squat');
    if (!session) return;
    emitAddToSession(
      ctx,
      session,
      { name: 'Paused Squat', sets: 3, reps: '5', restSec: 150, tags: ['accessory'] },
      reason,
    );
    emitAddToSession(
      ctx,
      session,
      { name: 'Tempo Squat (3s down)', sets: 3, reps: '4', restSec: 150, tags: ['accessory'] },
      reason,
    );
    emitAddToSession(
      ctx,
      session,
      { name: 'Pallof Press', sets: 3, reps: '10/side', restSec: 60, tags: ['core'] },
      reason,
    );
    emitAddToSession(
      ctx,
      session,
      { name: 'Hip Thrust', sets: 3, reps: '8-10', restSec: 90, tags: ['glute'] },
      reason,
    );
    return;
  }

  // Nutrition decisions don't modify the plan; surfaced in WorkoutLogger only.
}
