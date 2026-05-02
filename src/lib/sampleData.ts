import type { BodyMetric, Profile, WorkoutLog } from '../types';

export const sampleProfile: Profile = {
  id: 'local-jasmine',
  name: 'Jasmine',
  sex: 'female',
  age: 30,
  heightInches: 62,
  weightLbs: 168,
  goalWeightLbs: 145,
  trainingDaysPerWeek: 4,
  goal: 'recomp',
  squat1RM: 185,
  bench1RM: 105,
  deadlift1RM: 235,
  problemAreas: ['core', 'glutes', 'lower_back', 'grip', 'belly_bloat'],
  foodDislikes: ['cottage cheese', 'liver'],
  foodSensitivities: ['dairy (lactose)', 'high-FODMAP onions'],
  mealCount: 4,
  cardioPref: 'low',
  onWegovy: true,
  proteinTargetG: 150,
  createdAt: new Date().toISOString(),
};

const today = new Date();
const daysAgo = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

export const sampleMetrics: BodyMetric[] = [
  { date: daysAgo(28), weightLbs: 174, waistIn: 33.5 },
  { date: daysAgo(21), weightLbs: 172, waistIn: 33.0 },
  { date: daysAgo(14), weightLbs: 170, waistIn: 32.5 },
  { date: daysAgo(7), weightLbs: 169, waistIn: 32.25 },
  { date: daysAgo(1), weightLbs: 168, waistIn: 32.0 },
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
