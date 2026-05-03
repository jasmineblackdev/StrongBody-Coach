import { useMemo } from 'react';
import { Sparkles, AlertTriangle, ThumbsUp } from 'lucide-react';
import { Card, CoachMessage, Pill, SectionHeader } from './ui';
import MealFeedbackForm from './MealFeedbackForm';
import { analyzeFoodResponse } from '../lib/foodResponseEngine';
import { store } from '../lib/storage';
import { useStoreVersion } from '../hooks/useStore';

/**
 * Food Response panel for the Meals page. Shows possible triggers, best
 * tolerated foods, and a quick-log form. Conservative: never flags from
 * one bad meal — needs ≥ 3 occurrences with consistent pattern.
 */
export default function FoodResponsePanel() {
  useStoreVersion();
  const feedback = useMemo(() => store.getMealFeedback(), []);
  const report = useMemo(() => analyzeFoodResponse(feedback), [feedback]);

  return (
    <Card>
      <SectionHeader
        title="Food Response"
        subtitle="Pattern detection across your logged meal feedback. Needs at least 3 occurrences before flagging."
        action={
          <Pill tone="accent">
            {report.totalMealsLogged} meal{report.totalMealsLogged === 1 ? '' : 's'} logged
          </Pill>
        }
      />

      {report.needsMoreData ? (
        <CoachMessage tone="accent" title="Need more data">
          {report.totalMealsLogged === 0
            ? 'Log a few meals with feedback (hunger, bloating, energy, digestion). Pattern detection kicks in once each ingredient appears 3+ times.'
            : `${report.totalMealsLogged} logged so far — keep going. Pattern detection becomes useful at ~10–15 logged meals.`}
        </CoachMessage>
      ) : (
        <>
          {report.possibleTriggers.length > 0 && (
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-warning">
                <AlertTriangle size={12} /> Possible triggers
              </div>
              {report.possibleTriggers.map((t) => (
                <div
                  key={t.food}
                  className="rounded-2xl border border-warning/30 bg-warning/5 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-zinc-100">{t.food}</span>
                    <Pill tone="warning">
                      {t.occurrences}× · +{t.delta}/10 vs baseline
                    </Pill>
                  </div>
                  <p className="mt-1.5 text-xs text-zinc-300">{t.pattern}</p>
                  <p className="mt-1.5 text-xs text-zinc-200">
                    <span className="text-rose-glow">→</span> {t.recommendation}
                  </p>
                </div>
              ))}
              <div className="rounded-xl border border-ink-800 bg-ink-900/40 p-2.5 text-[11px] text-zinc-400">
                Possible triggers, not diagnoses. Confirm by removing for 7 days, then
                reintroducing in a small portion. Never test two foods at once.
              </div>
            </div>
          )}

          {report.bestTolerated.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-success">
                <ThumbsUp size={12} /> Best tolerated
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {report.bestTolerated.map((t) => (
                  <div
                    key={t.food}
                    className="rounded-xl border border-success/30 bg-success/5 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-zinc-100">{t.food}</span>
                      <Pill tone="success">{t.occurrences}×</Pill>
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-400">{t.note}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.possibleTriggers.length === 0 && report.bestTolerated.length === 0 && (
            <CoachMessage tone="accent" title="No clear patterns yet" icon={<Sparkles size={18} />}>
              {report.totalMealsLogged} meals logged across {report.totalIngredientsTracked} ingredients,
              but nothing has hit the threshold for a confident trigger or "best tolerated" call yet.
              Keep logging.
            </CoachMessage>
          )}
        </>
      )}

      <div className="mt-4">
        <MealFeedbackForm />
      </div>

      <p className="mt-3 text-[11px] text-zinc-500">
        Engine never flags from one bad meal. Triggers require ≥ 3 meals + bloating ≥ 6/10
        + at least 1.5/10 worse than your overall baseline.
      </p>
    </Card>
  );
}
