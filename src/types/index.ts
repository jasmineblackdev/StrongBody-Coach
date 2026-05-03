// Core domain types for StrongBody Coach

export type Goal = 'fat_loss' | 'strength' | 'recomp' | 'meet_prep';
export type CardioPref = 'none' | 'low' | 'moderate' | 'high';
export type LifestyleActivity =
  | 'sedentary'
  | 'lightly_active'
  | 'moderately_active'
  | 'very_active';
export type FatLossMode = 'conservative' | 'standard' | 'performance';

/**
 * How much volume the user wants per lift day. Smaller days = better
 * recovery + consistency on a fat-loss block; larger days = more
 * stimulus when recovery + adherence are both high.
 *
 *   compact   ≈ 5–6 exercises  (default for fat_loss)
 *   standard  ≈ 7–8 exercises
 *   high      ≈ 8–9 exercises  (legacy / hypertrophy block)
 */
export type WorkoutVolumePreference = 'compact' | 'standard' | 'high';
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
  /**
   * Optional ISO birth date (YYYY-MM-DD). When set, macroEngine derives age
   * from this so the calculation auto-updates each year. Falls back to `age`
   * when not provided.
   */
  birthDate?: string;
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
  /**
   * Lifestyle activity level — non-exercise daily movement (NEAT). Used to
   * pick the BMR multiplier independently of the workout schedule. The
   * macroEngine credits lifting and cardio as ADDITIONAL calorie burn on
   * top of this; it does NOT roll workouts into the lifestyle multiplier.
   *
   * Default: 'lightly_active' (≈1.3) — covers a desk job with normal
   * walking but no formal step tracking. Don't bump this without step
   * data; over-crediting NEAT is the #1 reason fat loss stalls.
   */
  lifestyleActivity?: LifestyleActivity;
  /**
   * How aggressive the fat-loss deficit is when `goal === 'fat_loss'`.
   * Default: 'standard' (~1 lb/wk). 'conservative' protects strength on
   * recomp-leaning users; 'performance' is for users with significant
   * fat to lose who can sustain a deeper cut.
   */
  fatLossMode?: FatLossMode;
  onWegovy: boolean;
  proteinTargetG?: number;
  /**
   * Meal times in 24-hour HH:MM, ordered. Used by the meal composer to assign
   * each meal a contextual slot (breakfast / mid_morning / pre_workout / etc.)
   * and to time-shift carbs around the workout window.
   */
  mealTimes?: string[];
  /**
   * Workout time in 24-hour HH:MM. Drives pre/post-workout meal shaping.
   */
  workoutTime?: string;
  /**
   * Auto-Coach Mode. When ON, the app reviews logs weekly and drafts a single
   * decision for approval. Default OFF — drafts are still generated on demand
   * from the weekly check-in, this just controls whether the dashboard
   * surfaces a "review this week's decision" prompt.
   */
  autoCoach?: boolean;
  /**
   * Gym Mode. When ON, the dashboard hides heavy AI cards (Fat Loss Insight,
   * Photo Signal, Final Coach Review, Decision History, Predictions) and
   * promotes Today's Workout + macros to the top. The bottom mobile nav
   * always shows; this just streamlines what's visible mid-session.
   */
  gymMode?: boolean;
  /**
   * Workout volume preference. Drives how many exercises buildWeeklyPlan
   * keeps per lift day and whether core work stays on lift days. Defaults
   * to 'compact' when goal === 'fat_loss', otherwise 'standard'.
   */
  workoutVolumePreference?: WorkoutVolumePreference;
  /**
   * Signed kcal offset applied AFTER the macro engine's own goal/trend
   * adjustments. The Coach Brain writes here when the user accepts a
   * `reduce_calories` (negative) or `increase_recovery` (positive) decision.
   * Reset to 0 by accepting a `stay_course` decision.
   */
  calorieOffsetKcal?: number;
  /**
   * Daily step target the user accepted from a coach decision. Display-only —
   * the app doesn't track step counts itself.
   */
  dailyStepsTarget?: number;
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

export type AdherenceLevel = 'yes' | 'mostly' | 'no';

export type CyclePhase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal';

/**
 * Per-meal feedback the user logs from the Meals page. Feeds the food
 * response engine, which detects repeated trigger patterns. Lightweight
 * structure so the Quick-log form stays fast.
 */
export interface MealFeedback {
  id: string;
  /** ISO timestamp when the meal happened. */
  date: string;
  /** Free-form label, e.g. "Breakfast", "Pre-workout". */
  mealName: string;
  /** Lower-cased ingredient tokens. The engine pattern-matches on these. */
  ingredients: string[];
  hungerAfter: number; // 1-10 (10 = ravenous)
  bloatingAfter: number; // 1-10 (10 = severe bloat)
  energyAfter: number; // 1-10 (10 = sharp / clean energy)
  digestionAfter: number; // 1-10 (10 = comfortable)
  /** Optional free-text — "felt heavy on squats", "clean run". */
  workoutPerfNote?: string;
}

/**
 * Self-reported answer to "did your progress photos look different this
 * week?" — feeds the Photo Intelligence engine alongside measured data
 * (weight, waist) without ever driving plan changes alone.
 */
export type PhotoVisualSignal =
  | 'tighter_waist'
  | 'less_bloated'
  | 'no_change'
  | 'unsure';

export interface WeeklyCheckIn {
  id: string;
  /** ISO date string (YYYY-MM-DD or full ISO). */
  date: string;
  /** 7-day average weight you logged this week (lb). */
  weightAvg7d?: number;
  caloriesAdherence: AdherenceLevel;
  proteinAdherence: AdherenceLevel;
  workoutsCompleted: number;
  workoutsPlanned: number;
  hungerLevel: number; // 1–10
  bloatingLevel: number; // 1–10
  bowelNotes: string;
  energyRecovery: number; // 1–10
  whatWorked: string;
  whatNeedsAdjustment: string;
  /**
   * Optional self-reported menstrual cycle phase. Lets the female fat-loss
   * engine apply caution during luteal/menstrual weeks instead of
   * mislabeling water retention as a plateau.
   */
  cyclePhase?: CyclePhase;
  /**
   * Optional user-reported visual signal from progress photos this week.
   * Feeds Photo Intelligence as supportive evidence — never drives plan
   * changes on its own.
   */
  photoVisualSignal?: PhotoVisualSignal;
}

// ─── Coach Brain (weekly decision engine) ──────────────────────────────────

export type CoachDecisionKind =
  | 'stay_course'
  | 'reduce_calories'
  | 'increase_steps'
  | 'shift_carbs'
  | 'deload'
  | 'reduce_training_volume'
  | 'increase_recovery'
  | 'adjust_exercises'
  | 'improve_adherence'
  | 'log_more_data';

export type CoachDecisionStatus = 'pending' | 'accepted' | 'rejected';

export type CoachDecisionConfidence = 'low' | 'medium' | 'high';

export type SuggestedChangeKind =
  | 'macro_adjust'
  | 'phase_change'
  | 'steps_target'
  | 'volume_decrease'
  | 'cardio_increase'
  | 'food_review'
  | 'exercise_swap'
  | 'behavior';

export interface SuggestedChange {
  kind: SuggestedChangeKind;
  description: string;
  /**
   * Optional payload the apply step uses to mutate state. Pure-data only —
   * no functions, so it stays JSON-serializable for localStorage.
   */
  payload?: {
    calorieOffsetKcal?: number;
    dailyStepsTarget?: number;
    targetPhase?: TrainingPhase;
    volumeDeltaPct?: number;
  };
}

export type DecisionOutcomeVerdict =
  | 'worked'
  | 'didnt_move'
  | 'wrong_direction'
  | 'not_enough_data';

export interface CoachDecisionOutcome {
  /** When the outcome was computed. */
  measuredAt: string;
  /** Days between acceptance and measurement. */
  daysElapsed: number;
  /** What the decision predicted (in lb/wk for fat-loss decisions; null otherwise). */
  predictedWeeklyChange: number | null;
  /** Actual smoothed weekly change in the days since acceptance. */
  actualWeeklyChange: number | null;
  /** Adherence the user maintained since the decision (0..1). */
  adherenceScore: number | null;
  workoutsCompleted: number;
  workoutsPlanned: number;
  verdict: DecisionOutcomeVerdict;
  /** Plain-English read on whether the decision worked. */
  note: string;
}

export interface CoachDecision {
  id: string;
  weekNumber: number;
  /** ISO timestamp the decision was generated. */
  generatedAt: string;
  decision: CoachDecisionKind;
  /** Short headline like "Stay the course". */
  headline: string;
  /** 1–2 sentence reason the engine landed on this decision. */
  reason: string;
  confidence: CoachDecisionConfidence;
  status: CoachDecisionStatus;
  suggestedChanges: SuggestedChange[];
  /** Safety guardrails — always shown, even when status is accepted. */
  safetyNotes: string[];
  observations: {
    whatWorked: string[];
    whatHeldBack: string[];
  };
  /** Free-text the user can leave when rejecting (optional). */
  rejectionReason?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  /**
   * Snapshot of body state at acceptance time so we can compare predicted
   * vs actual after 7 days. Recorded by applyCoachDecision.
   */
  appliedSnapshot?: {
    sevenDayAvgWeightLb: number | null;
    weeklyChangeAtAcceptance: number | null;
  };
  /**
   * Outcome read computed once the decision is at least 7 days old.
   * Drives the "Did this decision work?" view in DecisionHistoryPanel.
   */
  outcome?: CoachDecisionOutcome;
}
