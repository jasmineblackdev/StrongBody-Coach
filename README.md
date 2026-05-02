# StrongBody Coach

Personalized powerlifting + body recomp coaching app. React + TypeScript + Tailwind, Chart.js charts, Supabase-ready (with isolated `sbc_` schema), runs offline on localStorage with seeded sample data so you can use it immediately.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5173.

On first load it seeds your profile, sample logs, and sample body-weight data — so every page is populated from the start. Edit anything in **Profile** to rebuild the plan.

## Cloud sync (Supabase) — isolated from any other project

This app keeps every backend object behind a `sbc_` prefix so it can share a Supabase project with other apps without collision.

1. Open Supabase → **SQL editor** → paste and run `supabase/migrations/0001_sbc_init.sql`.
   - Creates: `sbc_profiles`, `sbc_weekly_plans`, `sbc_workout_logs`, `sbc_body_metrics`, `sbc_meal_plans`, the `sbc_progress_photos` storage bucket, all `sbc_*` policies/enums/triggers.
   - Touches **nothing else** — safe alongside existing tables.
   - Idempotent: re-running the migration is a no-op.
2. In **Authentication → Providers**, make sure Email is enabled (magic link is on by default).
3. `cp .env.example .env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (or the legacy `VITE_SUPABASE_ANON_KEY`).
4. Restart `npm run dev`. Open **Profile → Cloud sync**, send a magic link to your email, click it, then **Push local → cloud**.

The app still works fully offline on localStorage. Cloud sync is an explicit one-button push/pull on top — nothing writes to Supabase automatically.

## What's inside

- `src/pages/Dashboard.tsx` — today's workout, body-weight trend (Chart.js line), big 3, macros (Chart.js doughnut), weak points.
- `src/pages/Profile.tsx` — body, goals, lifts, problem areas, food sensitivities, Cloud sync panel.
- `src/pages/WorkoutPlan.tsx` — weekly plan generator (squat / bench / deadlift / upper / lower-glute), phases.
- `src/pages/WorkoutLogger.tsx` — log sets/reps/weight/RPE/missed/pain → emits coaching decisions.
- `src/pages/Meals.tsx` — high-protein, low-bloat, training-day-aware meal plan + grocery list.
- `src/pages/Progress.tsx` — body weight + waist + lift trends + compliance + macro tracking + weak points + photo placeholder.
- `src/components/charts.tsx` — Chart.js wrappers (line, multi-line, bar, doughnut, stacked bar) with shared dark theme.
- `src/lib/workoutPlan.ts` — generates 4–5 day powerlifting plan with 8–9 exercises/session.
- `src/lib/autoAdjust.ts` — RPE/missed-rep/pain rules → increase / repeat / reduce / swap / deload.
- `src/lib/weakPoints.ts` — squat/bench/deadlift stall detection, grip, lower-back, glute, recovery.
- `src/lib/mealPlan.ts` — Mifflin-St Jeor + goal-based deficit, hunger and Wegovy-aware adjustments.
- `src/lib/cloudSync.ts` — explicit push/pull between localStorage and `sbc_*` tables.
- `supabase/migrations/0001_sbc_init.sql` — single isolated migration with RLS, enums, triggers, and a private storage bucket.

## Test first

1. Open `/` (Dashboard). Coach message, KPIs, today's workout, body-weight Chart.js line, big-3 cards, macros doughnut.
2. Open `/log`. Pick "Squat Day". Fill 3 sets, RPE 7, all reps in → **Save** → expect "Crushed it at RPE 7… add 10 lb next session".
3. Mark a main-lift set as **Missed** → expect **Reduce weight**.
4. Set **Recovery** = 3/10 → expect **Deload**.
5. Open `/meals`. Toggle Training day vs Rest day, slide hunger to 9 → coach note adds the carb bump.
6. Open `/progress`. Add a weight measurement; the body-weight + waist chart updates. Macro stacked bar shows 7 days.

## Coaching tone (built-in)

- "Add 10 lb next session."
- "Repeat this weight — RPE was a 9."
- "Bench is stalling. Add Paused Bench 3x5 + Close-Grip Bench 3x6."
- "Your squat is stalling because your bracing/core work needs attention."
- "You reported hunger after training, so add carbs post-workout — about 40–50g within 60 min."
- "Wegovy note: front-load protein at breakfast and lunch so dinner is easy when hunger spikes."

## What's expandable next

- Photos to Supabase Storage (`sbc_progress_photos` bucket already exists, RLS is wired).
- Push the auto-adjustment results back into the next week's plan automatically.
- Per-exercise PR detection and 1RM auto-update from heavy singles.
- USDA FoodData Central and wger exercise library integrations.
