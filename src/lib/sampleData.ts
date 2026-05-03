import type { BodyMetric, Profile, WorkoutLog } from '../types';

export const sampleProfile: Profile = {
  id: 'local-jasmine',
  name: 'Jasmine',
  sex: 'female',
  age: 36,
  birthDate: '1989-10-13',
  heightInches: 62,
  weightLbs: 227,
  goalWeightLbs: 165,
  trainingDaysPerWeek: 4,
  goal: 'fat_loss',
  squat1RM: 185,
  bench1RM: 105,
  deadlift1RM: 235,
  problemAreas: ['core', 'glutes', 'lower_back', 'grip', 'belly_bloat'],
  foodDislikes: ['cottage cheese', 'liver'],
  foodSensitivities: ['dairy (lactose)', 'high-FODMAP onions'],
  mealCount: 5,
  cardioPref: 'moderate',
  onWegovy: true,
  // proteinTargetG intentionally left undefined — macroEngine computes it
  // adaptively from goal + bodyweight + goal weight. Set this only as an
  // explicit override.
  proteinTargetG: undefined,
  // Meal + workout schedule drives time-aware macro distribution.
  mealTimes: ['07:30', '10:30', '13:00', '15:30', '20:00'],
  workoutTime: '18:00',
  createdAt: new Date().toISOString(),
};

const today = new Date();
const daysAgo = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

// 14 days of weight data so the weight-trend engine has 7-day rolling avg AND
// prior 7-day window to compare against. Loosely simulates the start of a
// fat-loss block trending down ~1.2 lb/wk from 227.
export const sampleMetrics: BodyMetric[] = [
  { date: daysAgo(14), weightLbs: 229.0, waistIn: 41.5 },
  { date: daysAgo(13), weightLbs: 228.8 },
  { date: daysAgo(12), weightLbs: 228.4 },
  { date: daysAgo(11), weightLbs: 228.6 },
  { date: daysAgo(10), weightLbs: 228.2 },
  { date: daysAgo(9), weightLbs: 228.0 },
  { date: daysAgo(8), weightLbs: 227.9, waistIn: 41.25 },
  { date: daysAgo(7), weightLbs: 227.5 },
  { date: daysAgo(6), weightLbs: 227.6 },
  { date: daysAgo(5), weightLbs: 227.2 },
  { date: daysAgo(4), weightLbs: 227.0 },
  { date: daysAgo(3), weightLbs: 227.3 },
  { date: daysAgo(2), weightLbs: 226.8 },
  { date: daysAgo(1), weightLbs: 227.0, waistIn: 41.0 },
];

export const sampleLogs: WorkoutLog[] = [
  {
    id: 'log-1',
    sessionId: 'squat-w1',
    date: daysAgo(2),
    day: 'squat',
    weekNumber: 1,
    bodyWeightLbs: 168,
    sorenessAreas: ['lower_back'],
    recoveryScore: 6,
    hungerAfter: 8,
    exercises: [
      {
        prescriptionName: 'Back Squat',
        sets: [
          { reps: 5, weight: 145, rpe: 7 },
          { reps: 5, weight: 145, rpe: 7 },
          { reps: 5, weight: 145, rpe: 8 },
          { reps: 4, weight: 145, rpe: 9, missed: true },
        ],
        painNotes: 'Mild low back tightness on last set',
      },
      {
        prescriptionName: 'Romanian Deadlift',
        sets: [
          { reps: 8, weight: 135, rpe: 7 },
          { reps: 8, weight: 135, rpe: 7 },
          { reps: 8, weight: 135, rpe: 8 },
        ],
      },
    ],
    notes: 'Hungry post-workout. Rough sleep last night.',
  },
  {
    id: 'log-2',
    sessionId: 'bench-w1',
    date: daysAgo(4),
    day: 'bench',
    weekNumber: 1,
    bodyWeightLbs: 169,
    recoveryScore: 7,
    hungerAfter: 6,
    exercises: [
      {
        prescriptionName: 'Bench Press',
        sets: [
          { reps: 5, weight: 80, rpe: 7 },
          { reps: 5, weight: 80, rpe: 7 },
          { reps: 5, weight: 80, rpe: 7 },
        ],
      },
    ],
  },
  {
    id: 'log-3',
    sessionId: 'deadlift-w1',
    date: daysAgo(6),
    day: 'deadlift',
    weekNumber: 1,
    bodyWeightLbs: 169,
    recoveryScore: 7,
    exercises: [
      {
        prescriptionName: 'Conventional Deadlift',
        sets: [
          { reps: 5, weight: 185, rpe: 7 },
          { reps: 5, weight: 185, rpe: 8 },
          { reps: 3, weight: 185, rpe: 10, missed: true },
        ],
        painNotes: 'Grip slipped on last set',
      },
    ],
  },
];
