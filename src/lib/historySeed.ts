import type { WorkoutLog } from '../types';

// 3 representative workouts pulled from real Trainerize history (Feb–Apr 2026).
// Exercise names normalized to match this app's plan prescriptions so the
// auto-adjustment engine can match them.
//
// All marked weekNumber=1 so the engine treats them as current-week logs for
// testing. Real dates kept so the Progress charts read correctly.
//
// Why these three:
//  1. Squat 9 Mar 2026 — clean session at 3×5 @ 185 RPE 7 → triggers INCREASE
//  2. Bench 28 Apr 2026 — 3×3 @ 165 RPE 8, top single 185 → triggers REPEAT
//  3. Deadlift 4 Feb 2026 — heavy 3×3 @ 245, missed final triple, low-back
//     tight, grip slipped → triggers REDUCE WEIGHT + SWAP back squat for front
//     squat + ADD Pallof/Dead Bug to every session + ADD grip accessories.

const id = () => crypto.randomUUID();

export function buildHistoryLogs(): WorkoutLog[] {
  return [
    // ── Successful squat day ────────────────────────────────────────────────
    {
      id: id(),
      sessionId: 'squat-w1',
      date: '2026-03-09T19:00:00.000Z',
      day: 'squat',
      weekNumber: 1,
      bodyWeightLbs: 168,
      sorenessAreas: [],
      recoveryScore: 7,
      hungerAfter: 6,
      exercises: [
        {
          prescriptionName: 'Back Squat',
          sets: [
            { reps: 5, weight: 185, rpe: 7 },
            { reps: 5, weight: 185, rpe: 7 },
            { reps: 5, weight: 185, rpe: 7 },
          ],
        },
        {
          prescriptionName: 'Romanian Deadlift',
          sets: [
            { reps: 8, weight: 135, rpe: 7 },
            { reps: 8, weight: 135, rpe: 7 },
            { reps: 8, weight: 135, rpe: 7 },
          ],
        },
      ],
      notes: 'Worked up to 5×185 cleanly, bar speed sharp. Hack squat + leg ext after.',
    },

    // ── Successful bench day with PR singles ────────────────────────────────
    {
      id: id(),
      sessionId: 'bench-w1',
      date: '2026-04-28T17:58:00.000Z',
      day: 'bench',
      weekNumber: 1,
      bodyWeightLbs: 168,
      sorenessAreas: [],
      recoveryScore: 8,
      hungerAfter: 5,
      exercises: [
        {
          prescriptionName: 'Bench Press',
          sets: [
            { reps: 3, weight: 165, rpe: 8 },
            { reps: 3, weight: 165, rpe: 8 },
            { reps: 3, weight: 165, rpe: 8 },
          ],
        },
        {
          prescriptionName: 'Tricep Pushdown',
          sets: [
            { reps: 15, weight: 20, rpe: 6 },
            { reps: 12, weight: 20, rpe: 7 },
            { reps: 15, weight: 20, rpe: 7 },
          ],
        },
      ],
      notes:
        '3×3 at 165 went up clean, ended with 175×1 then 185×1. Top single felt heavy but locked out.',
    },

    // ── Struggle deadlift: missed reps + low-back + grip slip ───────────────
    {
      id: id(),
      sessionId: 'deadlift-w1',
      date: '2026-02-04T19:00:00.000Z',
      day: 'deadlift',
      weekNumber: 1,
      bodyWeightLbs: 168,
      sorenessAreas: ['lower_back'],
      recoveryScore: 5,
      hungerAfter: 7,
      exercises: [
        {
          prescriptionName: 'Conventional Deadlift',
          sets: [
            { reps: 3, weight: 245, rpe: 9 },
            { reps: 3, weight: 245, rpe: 9 },
            { reps: 3, weight: 245, rpe: 10 },
            { reps: 1, weight: 245, rpe: 10, missed: true },
          ],
          painNotes: 'Lower back tight on last attempt and grip slipped — bar speed died.',
        },
        {
          prescriptionName: 'Barbell Row',
          sets: [
            { reps: 15, weight: 180, rpe: 7 },
            { reps: 8, weight: 230, rpe: 8 },
            { reps: 8, weight: 230, rpe: 9 },
          ],
        },
      ],
      notes:
        'Heavy triples at 245 — last set ground out 1 then racked. Felt smoked, lower back tight, grip done.',
    },
  ];
}
