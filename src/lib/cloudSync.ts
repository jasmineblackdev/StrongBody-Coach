import { supabase } from './supabase';
import { store } from './storage';
import type {
  BodyMetric,
  Profile,
  WeeklyPlan,
  WorkoutLog,
} from '../types';

// ─── Mappers ─────────────────────────────────────────────────────────────────

interface DbProfile {
  user_id: string;
  name: string;
  sex: 'female' | 'male' | 'other';
  age: number;
  height_inches: number;
  weight_lbs: number;
  goal_weight_lbs: number;
  training_days_per_week: number;
  goal: Profile['goal'];
  squat_1rm: number;
  bench_1rm: number;
  deadlift_1rm: number;
  problem_areas: string[];
  food_dislikes: string[];
  food_sensitivities: string[];
  meal_count: number;
  cardio_pref: Profile['cardioPref'];
  on_wegovy: boolean;
  protein_target_g: number | null;
}

function profileToDb(p: Profile, userId: string): DbProfile {
  return {
    user_id: userId,
    name: p.name,
    sex: p.sex,
    age: p.age,
    height_inches: p.heightInches,
    weight_lbs: p.weightLbs,
    goal_weight_lbs: p.goalWeightLbs,
    training_days_per_week: p.trainingDaysPerWeek,
    goal: p.goal,
    squat_1rm: p.squat1RM,
    bench_1rm: p.bench1RM,
    deadlift_1rm: p.deadlift1RM,
    problem_areas: p.problemAreas,
    food_dislikes: p.foodDislikes,
    food_sensitivities: p.foodSensitivities,
    meal_count: p.mealCount,
    cardio_pref: p.cardioPref,
    on_wegovy: p.onWegovy,
    protein_target_g: p.proteinTargetG ?? null,
  };
}

function profileFromDb(d: DbProfile): Profile {
  return {
    id: d.user_id,
    name: d.name,
    sex: d.sex,
    age: d.age,
    heightInches: Number(d.height_inches),
    weightLbs: Number(d.weight_lbs),
    goalWeightLbs: Number(d.goal_weight_lbs),
    trainingDaysPerWeek: d.training_days_per_week,
    goal: d.goal,
    squat1RM: Number(d.squat_1rm),
    bench1RM: Number(d.bench_1rm),
    deadlift1RM: Number(d.deadlift_1rm),
    problemAreas: (d.problem_areas as Profile['problemAreas']) ?? [],
    foodDislikes: d.food_dislikes ?? [],
    foodSensitivities: d.food_sensitivities ?? [],
    mealCount: d.meal_count,
    cardioPref: d.cardio_pref,
    onWegovy: d.on_wegovy,
    proteinTargetG: d.protein_target_g ?? undefined,
    createdAt: new Date().toISOString(),
  };
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function ensureUuid(id: string): string {
  return isUuid(id) ? id : crypto.randomUUID();
}

// ─── Sync result ─────────────────────────────────────────────────────────────

export interface SyncResult {
  pushedProfile: boolean;
  pushedPlans: number;
  pushedLogs: number;
  pushedMetrics: number;
  pulledProfile: boolean;
  pulledPlans: number;
  pulledLogs: number;
  pulledMetrics: number;
  errors: string[];
}

function emptyResult(): SyncResult {
  return {
    pushedProfile: false,
    pushedPlans: 0,
    pushedLogs: 0,
    pushedMetrics: 0,
    pulledProfile: false,
    pulledPlans: 0,
    pulledLogs: 0,
    pulledMetrics: 0,
    errors: [],
  };
}

async function requireUser(): Promise<string> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Not signed in');
  return data.user.id;
}

// ─── PUSH (local → cloud) ────────────────────────────────────────────────────

export async function pushAll(): Promise<SyncResult> {
  const result = emptyResult();
  if (!supabase) {
    result.errors.push('Supabase not configured');
    return result;
  }
  let userId: string;
  try {
    userId = await requireUser();
  } catch (e: any) {
    result.errors.push(e.message);
    return result;
  }

  // Profile
  const profile = store.getProfile();
  if (profile) {
    const { error } = await supabase
      .from('sbc_profiles')
      .upsert(profileToDb(profile, userId), { onConflict: 'user_id' });
    if (error) result.errors.push(`profile: ${error.message}`);
    else result.pushedProfile = true;
  }

  // Weekly plan
  const plan = store.getPlan();
  if (plan) {
    const { error } = await supabase
      .from('sbc_weekly_plans')
      .upsert(
        {
          user_id: userId,
          week_number: plan.weekNumber,
          phase: plan.phase,
          sessions: plan.sessions,
        },
        { onConflict: 'user_id,week_number' },
      );
    if (error) result.errors.push(`plan: ${error.message}`);
    else result.pushedPlans = 1;
  }

  // Workout logs
  const logs = store.getLogs();
  if (logs.length) {
    const rows = logs.map((l) => ({
      id: ensureUuid(l.id),
      user_id: userId,
      session_id: l.sessionId,
      day: l.day,
      week_number: l.weekNumber,
      log_date: l.date.slice(0, 10),
      body_weight_lbs: l.bodyWeightLbs ?? null,
      soreness_areas: l.sorenessAreas ?? [],
      recovery_score: l.recoveryScore ?? null,
      hunger_after: l.hungerAfter ?? null,
      exercises: l.exercises,
      notes: l.notes ?? null,
    }));
    const { error } = await supabase.from('sbc_workout_logs').upsert(rows, { onConflict: 'id' });
    if (error) result.errors.push(`logs: ${error.message}`);
    else {
      result.pushedLogs = rows.length;
      // Persist canonical UUIDs back to local
      const updatedLocal = logs.map((l, i) => ({ ...l, id: rows[i].id }));
      store.setLogs(updatedLocal);
    }
  }

  // Body metrics
  const metrics = store.getMetrics();
  if (metrics.length) {
    const rows = metrics.map((m) => ({
      id: crypto.randomUUID(), // metrics carry no client id today
      user_id: userId,
      metric_date: m.date,
      weight_lbs: m.weightLbs ?? null,
      waist_in: m.waistIn ?? null,
      notes: m.notes ?? null,
    }));
    // Upsert by (user_id, metric_date) is awkward without a unique constraint.
    // For MVP, delete-then-insert this user's metrics atomically per date.
    const dates = Array.from(new Set(rows.map((r) => r.metric_date)));
    const { error: delErr } = await supabase
      .from('sbc_body_metrics')
      .delete()
      .eq('user_id', userId)
      .in('metric_date', dates);
    if (delErr) result.errors.push(`metrics-clear: ${delErr.message}`);
    const { error: insErr } = await supabase.from('sbc_body_metrics').insert(rows);
    if (insErr) result.errors.push(`metrics: ${insErr.message}`);
    else result.pushedMetrics = rows.length;
  }

  return result;
}

// ─── PULL (cloud → local) ────────────────────────────────────────────────────

export async function pullAll(): Promise<SyncResult> {
  const result = emptyResult();
  if (!supabase) {
    result.errors.push('Supabase not configured');
    return result;
  }
  let userId: string;
  try {
    userId = await requireUser();
  } catch (e: any) {
    result.errors.push(e.message);
    return result;
  }

  // Profile
  const { data: prof, error: pErr } = await supabase
    .from('sbc_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (pErr) result.errors.push(`profile: ${pErr.message}`);
  if (prof) {
    store.setProfile(profileFromDb(prof as DbProfile));
    result.pulledProfile = true;
  }

  // Most recent weekly plan
  const { data: plan, error: planErr } = await supabase
    .from('sbc_weekly_plans')
    .select('*')
    .eq('user_id', userId)
    .order('week_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (planErr) result.errors.push(`plan: ${planErr.message}`);
  if (plan) {
    const wp: WeeklyPlan = {
      weekNumber: plan.week_number,
      phase: plan.phase,
      sessions: plan.sessions,
    };
    store.setPlan(wp);
    store.setWeekNumber(plan.week_number);
    result.pulledPlans = 1;
  }

  // Workout logs
  const { data: logs, error: lErr } = await supabase
    .from('sbc_workout_logs')
    .select('*')
    .eq('user_id', userId)
    .order('log_date', { ascending: false });
  if (lErr) result.errors.push(`logs: ${lErr.message}`);
  if (logs) {
    const local: WorkoutLog[] = logs.map((r: any) => ({
      id: r.id,
      sessionId: r.session_id,
      date: r.log_date,
      day: r.day,
      weekNumber: r.week_number,
      bodyWeightLbs: r.body_weight_lbs ? Number(r.body_weight_lbs) : undefined,
      sorenessAreas: r.soreness_areas ?? [],
      recoveryScore: r.recovery_score ?? undefined,
      hungerAfter: r.hunger_after ?? undefined,
      exercises: r.exercises,
      notes: r.notes ?? undefined,
    }));
    store.setLogs(local);
    result.pulledLogs = local.length;
  }

  // Body metrics
  const { data: metrics, error: mErr } = await supabase
    .from('sbc_body_metrics')
    .select('*')
    .eq('user_id', userId)
    .order('metric_date', { ascending: false });
  if (mErr) result.errors.push(`metrics: ${mErr.message}`);
  if (metrics) {
    const local: BodyMetric[] = metrics.map((r: any) => ({
      date: r.metric_date,
      weightLbs: r.weight_lbs ? Number(r.weight_lbs) : undefined,
      waistIn: r.waist_in ? Number(r.waist_in) : undefined,
      notes: r.notes ?? undefined,
    }));
    store.setMetrics(local);
    result.pulledMetrics = local.length;
  }

  return result;
}
