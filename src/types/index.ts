// Core domain types for StrongBody Coach

export type Goal = 'fat_loss' | 'strength' | 'recomp' | 'meet_prep';
export type CardioPref = 'none' | 'low' | 'moderate' | 'high';
export type WorkoutDay =
  | 'squat'
  | 'bench'
  | 'deadlift'
  | 'upper_accessory'
  | 'lower_glute';

export type ProblemArea =
  | 'core'
  | 'glutes'
  | 'lower_back'
  | 'grip'
  | 'belly_bloat'
  | 'shoulders'
  | 'hamstrings';

export interface Profile {
  id: string;
  name: string;
  sex: 'female' | 'male' | 'other';
  age: number;
  heightInches: number;
  weightLbs: number;
  goalWeightLbs: number;
  trainingDaysPerWeek: number;
  goal: Goal;
  squat1RM: number;
  bench1RM: number;
  deadlift1RM: number;
  problemAreas: ProblemArea[];
  foodDislikes: string[];
  foodSensitivities: string[];
  mealCount: number;
  cardioPref: CardioPref;
  onWegovy: boolean;
  proteinTargetG?: number;
  createdAt: string;
}

export interface ExercisePrescription {
  name: string;
  sets: number;
  reps: string; // e.g. "5", "5-8", "AMRAP"
  loadPct?: number; // % of 1RM for primary lifts
  loadLbs?: number; // absolute weight if prescribed
  restSec: number;
  rpeTarget?: number;
  notes?: string;
  tags?: string[]; // ["main","accessory","core","glute","grip","triceps"]
}

export interface WorkoutSession {
  id: string;
  day: WorkoutDay;
  title: string;
  weekNumber: number;
  phase: TrainingPhase;
  prescriptions: ExercisePrescription[];
  coachNote?: string;
}

export interface WeeklyPlan {
  weekNumber: number;
  phase: TrainingPhase;
  sessions: WorkoutSession[];
}

export type TrainingPhase = 'hypertrophy' | 'strength' | 'peak' | 'deload';

export interface SetLog {
  reps: number;
  weight: number;
  rpe?: number;
  missed?: boolean;
}

export interface ExerciseLog {
  prescriptionName: string;
  sets: SetLog[];
  painNotes?: string;
}

export interface WorkoutLog {
  id: string;
  sessionId: string;
  date: string; // ISO
  day: WorkoutDay;
  weekNumber: number;
  bodyWeightLbs?: number;
  sorenessAreas?: ProblemArea[];
  recoveryScore?: number; // 1-10
  hungerAfter?: number; // 1-10
  exercises: ExerciseLog[];
  notes?: string;
}

export interface BodyMetric {
  date: string;
  weightLbs?: number;
  waistIn?: number;
  notes?: string;
}

export interface MealItem {
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  ingredients: string[];
  swap?: string;
}

export interface DailyMealPlan {
  dayLabel: string;
  isTrainingDay: boolean;
  totals: { calories: number; proteinG: number; carbsG: number; fatG: number };
  meals: MealItem[];
  groceryList: string[];
  coachNote: string;
}

export interface AdjustmentDecision {
  exercise: string;
  action: 'increase' | 'repeat' | 'reduce_weight' | 'reduce_volume' | 'swap' | 'add_accessory' | 'deload';
  message: string;
  suggestedLbsDelta?: number;
}

export interface WeakPoint {
  key:
    | 'squat_stall'
    | 'bench_stall'
    | 'deadlift_stall'
    | 'grip_failure'
    | 'core_bracing'
    | 'lower_back_pain'
    | 'glute_weakness'
    | 'poor_recovery';
  title: string;
  evidence: string;
  recommendation: string;
}

export type PlanChangeKind =
  | 'load_increase'
  | 'load_decrease'
  | 'volume_decrease'
  | 'add_exercise'
  | 'swap_exercise'
  | 'phase_change';

export type PlanOp =
  | { kind: 'load_set'; day: WorkoutDay; exercise: string; loadLbs: number }
  | { kind: 'sets_set'; day: WorkoutDay; exercise: string; sets: number }
  | { kind: 'add_exercise'; day: WorkoutDay; prescription: ExercisePrescription }
  | {
      kind: 'swap_exercise';
      day: WorkoutDay;
      fromName: string;
      to: ExercisePrescription;
    }
  | { kind: 'phase_change'; phase: TrainingPhase };

export interface PlanChange {
  id: string;
  day: WorkoutDay | 'all';
  exercise: string;
  kind: PlanChangeKind;
  before?: string;
  after?: string;
  reason: string;
  /** Ops to apply to fromPlan when this change is accepted. */
  ops: PlanOp[];
}

export interface PlanProposal {
  fromWeek: number;
  toWeek: number;
  fromPhase: TrainingPhase;
  toPhase: TrainingPhase;
  fromPlan: WeeklyPlan;
  changes: PlanChange[];
  generatedAt: string;
  // ids of source workout logs used to build the proposal — for staleness check
  sourceLogIds: string[];
}
