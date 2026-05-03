import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Salad, ChevronRight } from 'lucide-react';
import { Pill } from './ui';
import { store } from '../lib/storage';
import { useStoreVersion } from '../hooks/useStore';
import { buildDailyPlan } from '../lib/mealPlan';

/**
 * Compact meals list for the Today screen. Shows meal slot + name +
 * kcal/protein only — no per-meal macro breakdown, no ingredient list.
 * Full detail lives on /meals.
 */
export default function TodayMealsSummary() {
  useStoreVersion();
  const profile = store.getProfile();
  const plan = useMemo(() => {
    if (!profile) return null;
    const isTrainingDay = ![5, 6, 0].includes(new Date().getDay()); // Fri/Sat/Sun home days
    return buildDailyPlan({
      profile,
      isTrainingDay,
      metrics: store.getMetrics(),
      recentLogs: store.getLogs(),
    });
  }, [profile]);

  if (!plan) return null;

  return (
    <Link
      to="/meals"
      className="block rounded-2xl border border-ink-800 bg-ink-850 p-3 transition active:scale-[0.99] hover:border-accent/30"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-rose-glow">
            <Salad size={16} />
          </span>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Today's meals
            </div>
            <div className="text-sm font-bold text-zinc-100">
              {plan.meals.length} meals · {plan.totals.calories} kcal · P{plan.totals.proteinG}
            </div>
          </div>
        </div>
        <Pill>{plan.dayLabel}</Pill>
      </div>

      <ul className="mt-3 divide-y divide-ink-800/70">
        {plan.meals.map((m, i) => {
          const titleParts = m.name.split(' · ');
          const slot = titleParts[0]; // "Breakfast"
          const dish = titleParts.slice(1).join(' · ') || titleParts[0];
          return (
            <li
              key={i}
              className="flex items-center justify-between gap-2 py-2 text-sm"
            >
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  {slot}
                </div>
                <div className="truncate text-zinc-100">{dish}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-zinc-100">{m.calories} kcal</div>
                <div className="text-[10px] text-zinc-500">P{m.proteinG} g</div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-2 flex items-center justify-end gap-1 text-[11px] font-semibold uppercase tracking-wider text-rose-glow">
        View meals + macros
        <ChevronRight size={12} />
      </div>
    </Link>
  );
}
