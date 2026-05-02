import { useState } from 'react';
import { TrendingUp, Check, Sparkles } from 'lucide-react';
import { Card, CoachMessage, Pill, SectionHeader } from './ui';
import { store } from '../lib/storage';
import { buildWeeklyPlan } from '../lib/workoutPlan';
import type { Profile } from '../types';

interface Suggestion {
  key: 'squat1RM' | 'bench1RM' | 'deadlift1RM';
  label: string;
  value: number;
  evidence: string;
}

// Estimates derived from your Trainerize screenshots (Feb–Apr 2026):
//   Squat: 5 × 185 @ RPE 7 (Mar 9) → Epley 1RM ≈ 216 lb
//   Bench: top single 185 + 3 × 165 @ RPE 8 (Apr 28) → comfortable 1RM ≈ 190 lb
//   Deadlift: 3 × 245 @ RPE 9, missed 4th triple (Feb 4) → strength 1RM ≈ 270–280
const SUGGESTIONS: Suggestion[] = [
  {
    key: 'squat1RM',
    label: 'Squat',
    value: 215,
    evidence: '5 × 185 @ RPE 7 on Mar 9 — Epley estimate ≈ 216 lb.',
  },
  {
    key: 'bench1RM',
    label: 'Bench',
    value: 190,
    evidence: 'Top single 185 + 3 × 165 @ RPE 8 on Apr 28 — comfortable 1RM ≈ 190 lb.',
  },
  {
    key: 'deadlift1RM',
    label: 'Deadlift',
    value: 275,
    evidence: '3 × 245 @ RPE 9 on Feb 4 — Epley ≈ 270 lb, with room as fatigue clears.',
  },
];

export default function OneRMSuggestionPanel() {
  const [profile, setProfile] = useState<Profile>(() => store.getProfile()!);
  const [savedAll, setSavedAll] = useState(false);

  function applyAndRebuild(updates: Partial<Profile>) {
    const next: Profile = { ...profile, ...updates };
    store.setProfile(next);
    const phase = store.getPlan()?.phase ?? 'hypertrophy';
    store.setPlan(buildWeeklyPlan(next, store.getWeekNumber(), phase));
    setProfile(next);
  }

  function applyOne(s: Suggestion) {
    applyAndRebuild({ [s.key]: s.value } as Partial<Profile>);
    setSavedAll(false);
  }

  function applyAll() {
    applyAndRebuild({
      squat1RM: SUGGESTIONS[0].value,
      bench1RM: SUGGESTIONS[1].value,
      deadlift1RM: SUGGESTIONS[2].value,
    });
    setSavedAll(true);
  }

  return (
    <Card>
      <SectionHeader
        title="1RM calibration"
        subtitle="Suggested 1RMs from your Trainerize history. Applying rebuilds your weekly plan at the new percentages."
        action={
          <button onClick={applyAll} className="btn-primary">
            <TrendingUp size={16} /> Apply all
          </button>
        }
      />

      <div className="space-y-2">
        {SUGGESTIONS.map((s) => {
          const current = profile[s.key] as number;
          const isApplied = current === s.value;
          const delta = s.value - current;
          return (
            <div
              key={s.key}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-800 bg-ink-850 p-3.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-zinc-100">{s.label}</span>
                  {isApplied ? (
                    <Pill tone="success">
                      <Check size={12} /> matched
                    </Pill>
                  ) : (
                    <Pill tone="accent">
                      <Sparkles size={12} /> {delta > 0 ? '+' : ''}
                      {delta} lb
                    </Pill>
                  )}
                </div>
                <div className="mt-1 text-sm">
                  <span className="text-zinc-500 line-through">{current} lb</span>
                  <span className="mx-2 text-zinc-500">→</span>
                  <span className="font-semibold text-zinc-100">{s.value} lb</span>
                </div>
                <div className="mt-1 text-xs text-zinc-400">{s.evidence}</div>
              </div>
              <button
                onClick={() => applyOne(s)}
                disabled={isApplied}
                className={isApplied ? 'btn-ghost' : 'btn-outline'}
              >
                <Check size={14} /> {isApplied ? 'Applied' : 'Apply'}
              </button>
            </div>
          );
        })}
      </div>

      {savedAll && (
        <div className="mt-4">
          <CoachMessage tone="success" title="1RMs updated">
            All three 1RMs applied. Your weekly plan rebuilt at the new percentages — main-lift
            top sets in Workout Plan reflect the new loads.
          </CoachMessage>
        </div>
      )}

      <p className="mt-3 text-xs text-zinc-500">
        Rebuilding the plan replaces any accepted modifications from previous proposals (added
        accessories, swaps). Your workout logs are untouched. Push to cloud manually when ready.
      </p>
    </Card>
  );
}
