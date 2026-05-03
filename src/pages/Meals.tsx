import { useMemo, useState } from 'react';
import { RefreshCw, Salad } from 'lucide-react';
import { Card, CoachMessage, Pill, ProgressBar, SectionHeader } from '../components/ui';
import { store } from '../lib/storage';
import { useStoreVersion } from '../hooks/useStore';
import { buildDailyPlan } from '../lib/mealPlan';
import { computeProteinTargetG } from '../lib/macroEngine';
import { generateMealNarrative } from '../lib/ai/mealAi';
import FoodResponsePanel from '../components/FoodResponsePanel';

/**
 * M5 fix: derive default "is today a training day" from day-of-week +
 * the user's training frequency, instead of always assuming Yes. Matches
 * the same heuristic used elsewhere (rest days = Sunday + Wednesday for
 * the typical 4–5 day split).
 */
function defaultTrainingDay(): boolean {
  // Lift Mon–Thu, Home (Core + Cardio) Fri–Sun.
  const dow = new Date().getDay();
  return ![5, 6, 0].includes(dow);
}

export default function MealsPage() {
  useStoreVersion();
  const profile = store.getProfile()!;
  const metrics = store.getMetrics();
  const logs = store.getLogs();
  const [isTrainingDay, setIsTrainingDay] = useState<boolean>(defaultTrainingDay);
  const [hunger, setHunger] = useState(5);
  const plan = useMemo(
    () =>
      buildDailyPlan({
        profile,
        isTrainingDay,
        hungerLevel: hunger,
        metrics,
        recentLogs: logs,
      }),
    [profile, isTrainingDay, hunger, metrics, logs],
  );
  const proteinTarget = computeProteinTargetG(profile);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="h1">Meals</h1>
        <p className="muted text-sm mt-1">
          High protein, low bloat, training/rest aware. Adjusts to hunger and Wegovy patterns.
        </p>
      </header>

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <span className="label">Today is</span>
            <div className="flex gap-2">
              <button
                onClick={() => setIsTrainingDay(true)}
                className={`btn ${isTrainingDay ? 'btn-primary' : 'btn-outline'}`}
              >
                Training day
              </button>
              <button
                onClick={() => setIsTrainingDay(false)}
                className={`btn ${!isTrainingDay ? 'btn-primary' : 'btn-outline'}`}
              >
                Rest day
              </button>
            </div>
          </div>
          <div className="grow min-w-[200px]">
            <span className="label">Hunger right now: {hunger}/10</span>
            <input
              type="range"
              min={1}
              max={10}
              value={hunger}
              onChange={(e) => setHunger(Number(e.target.value))}
              className="w-full accent-pink-500"
            />
          </div>
          <button onClick={() => setHunger((h) => h)} className="btn-ghost">
            <RefreshCw size={16} /> Regenerate
          </button>
        </div>
      </Card>

      <CoachMessage title="Today's plan">
        <p className="font-semibold text-white">
          {generateMealNarrative(plan, profile, isTrainingDay)}
        </p>
        <p className="mt-2 text-sm">{plan.coachNote}</p>
      </CoachMessage>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <SectionHeader
            title="Today's targets"
            subtitle={`${plan.totals.calories} kcal · ${plan.dayLabel}`}
          />
          <div className="space-y-3">
            <ProgressBar label="Protein" rightLabel={`${plan.totals.proteinG} / ${proteinTarget} g`} value={plan.totals.proteinG} max={proteinTarget} tone="accent" />
            <ProgressBar label="Carbs" rightLabel={`${plan.totals.carbsG} g`} value={plan.totals.carbsG} max={Math.round(plan.totals.calories * 0.45 / 4)} tone="success" />
            <ProgressBar label="Fat" rightLabel={`${plan.totals.fatG} g`} value={plan.totals.fatG} max={Math.max(60, Math.round(plan.totals.calories * 0.3 / 9))} tone="warning" />
          </div>
          <div className="divider my-4" />
          <div className="flex flex-wrap gap-2">
            <Pill tone="accent"><Salad size={12} /> {profile.mealCount} meals</Pill>
            {profile.onWegovy && <Pill>Wegovy-aware</Pill>}
            {profile.foodSensitivities.slice(0, 2).map((s) => (
              <Pill key={s} tone="warning">avoiding {s}</Pill>
            ))}
          </div>
        </Card>

        <Card className="md:col-span-2">
          <SectionHeader
            title="What to eat today"
            subtitle="Tap a meal for ingredients + macros"
          />
          <div className="space-y-2">
            {plan.meals.map((m, i) => (
              <details
                key={i}
                className="group rounded-2xl border border-ink-800 bg-ink-850 transition open:border-accent/30"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                      {m.name.split(' · ')[0]}
                    </div>
                    <div className="truncate text-sm font-bold text-zinc-100">
                      {m.name.split(' · ').slice(1).join(' · ') || m.name}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-right">
                      <span className="block text-sm font-semibold text-zinc-100">
                        {m.calories} kcal
                      </span>
                      <span className="block text-[10px] text-zinc-500">
                        P{m.proteinG} g
                      </span>
                    </span>
                    {m.swap && <Pill tone="accent">swap</Pill>}
                  </div>
                </summary>
                <div className="border-t border-ink-800 px-3 py-3 text-sm">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    Ingredients
                  </div>
                  <ul className="mt-1 grid grid-cols-1 gap-y-0.5 text-zinc-200 sm:grid-cols-2">
                    {m.ingredients.map((ing) => (
                      <li key={ing}>• {ing}</li>
                    ))}
                  </ul>
                  <div className="mt-2 rounded-lg border border-ink-800 bg-ink-900/40 px-2 py-1.5 text-xs text-zinc-300">
                    Full macros: P {m.proteinG} g · C {m.carbsG} g · F {m.fatG} g
                  </div>
                  {m.swap && (
                    <div className="mt-2 rounded-lg border border-accent/30 bg-accent/5 px-2 py-1.5 text-xs text-rose-glow">
                      Swap: {m.swap}
                    </div>
                  )}
                </div>
              </details>
            ))}
          </div>
        </Card>

        <div className="md:col-span-3">
          <FoodResponsePanel />
        </div>

        <Card className="md:col-span-3">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
              <div>
                <h2 className="h2">Grocery list</h2>
                <p className="muted text-sm mt-0.5">{plan.groceryList.length} items · generated from your meals</p>
              </div>
              <span className="text-xs text-zinc-500 group-open:hidden">Show</span>
              <span className="hidden text-xs text-zinc-500 group-open:inline">Hide</span>
            </summary>
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm text-zinc-300 sm:grid-cols-3 md:grid-cols-4">
            {plan.groceryList.map((g) => (
              <label key={g} className="inline-flex items-start gap-2">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-pink-500" />
                <span>{g}</span>
              </label>
            ))}
            </div>
          </details>
        </Card>
      </div>
    </div>
  );
}
