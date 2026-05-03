import { useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Check, HelpCircle } from 'lucide-react';
import { Card, CoachMessage, Pill, SectionHeader } from './ui';
import { store } from '../lib/storage';
import { useStoreVersion } from '../hooks/useStore';
import { buildWeeklyPlan } from '../lib/workoutPlan';
import {
  TREND_LABEL,
  estimateAllLifts,
  type LiftEstimate,
  type LiftKey,
  type StrengthTrend,
} from '../lib/strengthEngine';
import type { Profile } from '../types';

const PROFILE_KEY: Record<LiftKey, 'squat1RM' | 'bench1RM' | 'deadlift1RM'> = {
  squat: 'squat1RM',
  bench: 'bench1RM',
  deadlift: 'deadlift1RM',
};

const LABEL: Record<LiftKey, string> = {
  squat: 'Squat',
  bench: 'Bench',
  deadlift: 'Deadlift',
};

const TREND_TONE: Record<StrengthTrend, 'success' | 'warning' | 'danger' | 'default'> = {
  improving: 'success',
  flat: 'default',
  regressing: 'danger',
  unknown: 'default',
};

function TrendIcon({ trend }: { trend: StrengthTrend }) {
  if (trend === 'improving') return <TrendingUp size={12} />;
  if (trend === 'regressing') return <TrendingDown size={12} />;
  if (trend === 'flat') return <Minus size={12} />;
  return <HelpCircle size={12} />;
}

export default function OneRMSuggestionPanel() {
  useStoreVersion(); // re-render on any store change
  const profile = store.getProfile()!;
  const logs = store.getLogs();
  const estimates = useMemo(
    () =>
      estimateAllLifts(logs, {
        baselines: {
          squat: profile.squat1RM,
          bench: profile.bench1RM,
          deadlift: profile.deadlift1RM,
        },
      }),
    [logs, profile.squat1RM, profile.bench1RM, profile.deadlift1RM],
  );
  const [savedAll, setSavedAll] = useState(false);
  const [pending, setPending] = useState<LiftKey | null>(null);
  const lifts: LiftKey[] = ['squat', 'bench', 'deadlift'];

  function applyAndRebuild(updates: Partial<Profile>) {
    const next: Profile = { ...profile, ...updates };
    store.setProfile(next);
    const phase = store.getPlan()?.phase ?? 'hypertrophy';
    store.setPlan(buildWeeklyPlan(next, store.getWeekNumber(), phase));
  }

  function applyOne(lift: LiftKey, value: number) {
    applyAndRebuild({ [PROFILE_KEY[lift]]: value } as Partial<Profile>);
    setSavedAll(false);
    setPending(null);
  }

  function applyAll() {
    const updates: Partial<Profile> = {};
    for (const lift of lifts) {
      const e = estimates[lift];
      // Skip low-confidence estimates — only apply when the engine is sure.
      if (e.estimated1RM > 0 && e.confidence !== 'low') {
        updates[PROFILE_KEY[lift]] = e.estimated1RM;
      }
    }
    if (Object.keys(updates).length === 0) return;
    applyAndRebuild(updates);
    setSavedAll(true);
  }

  const anyEstimate = lifts.some((l) => estimates[l].estimated1RM > 0);
  const anyApplyable = lifts.some(
    (l) => estimates[l].estimated1RM > 0 && estimates[l].confidence !== 'low',
  );

  return (
    <Card>
      <SectionHeader
        title="1RM calibration"
        subtitle="Live estimates from your workout logs (adjusted Epley with RPE → reps in reserve)."
        action={
          <button
            onClick={applyAll}
            disabled={!anyApplyable}
            className="btn-primary"
          >
            <TrendingUp size={16} /> Apply all
          </button>
        }
      />

      {!anyEstimate && (
        <div className="rounded-xl border border-ink-800 bg-ink-850 p-4 text-sm text-zinc-300">
          No usable evidence in your logs yet. Log a working set on Squat / Bench / Deadlift
          (with RPE) and an estimate will appear here automatically.
        </div>
      )}

      {anyEstimate && (
        <div className="space-y-2">
          {lifts.map((lift) => (
            <LiftRow
              key={lift}
              lift={lift}
              label={LABEL[lift]}
              current={profile[PROFILE_KEY[lift]] as number}
              estimate={estimates[lift]}
              onApply={() => {
                if (pending === lift) {
                  applyOne(lift, estimates[lift].estimated1RM);
                } else {
                  setPending(lift);
                }
              }}
              onCancel={() => setPending(null)}
              isPending={pending === lift}
            />
          ))}
        </div>
      )}

      {savedAll && (
        <div className="mt-4">
          <CoachMessage tone="success" title="1RMs updated">
            All available estimates applied. Your weekly plan rebuilt at the new percentages.
          </CoachMessage>
        </div>
      )}

      <p className="mt-3 text-xs text-zinc-500">
        Manual values are never overwritten without the explicit Apply step. Rebuilding the plan
        replaces accepted modifications from previous proposals; logs are untouched.
      </p>
    </Card>
  );
}

function LiftRow({
  lift,
  label,
  current,
  estimate,
  isPending,
  onApply,
  onCancel,
}: {
  lift: LiftKey;
  label: string;
  current: number;
  estimate: LiftEstimate;
  isPending: boolean;
  onApply: () => void;
  onCancel: () => void;
}) {
  void lift;
  const value = estimate.estimated1RM;
  const hasEstimate = value > 0;
  const isApplied = hasEstimate && current === value;
  const delta = hasEstimate ? value - current : 0;
  const ev = estimate.evidence;
  // Low-confidence estimates (few sessions / high variance / big drop vs
  // manual) are reported as "engine signal" and hide the Apply button.
  const lowConfidence = estimate.confidence === 'low';
  const showApply = hasEstimate && !isApplied && !lowConfidence;

  return (
    <div className="rounded-xl border border-ink-800 bg-ink-850 p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-zinc-100">{label}</span>

            {!hasEstimate ? (
              <Pill>not enough data</Pill>
            ) : isApplied ? (
              <Pill tone="success">
                <Check size={12} /> matched
              </Pill>
            ) : lowConfidence ? (
              <Pill tone="warning">
                low confidence ({delta > 0 ? '+' : ''}
                {delta} lb signal)
              </Pill>
            ) : (
              <Pill tone="accent">
                {delta > 0 ? '+' : ''}
                {delta} lb suggested
              </Pill>
            )}

            {hasEstimate && estimate.trend !== 'unknown' && (
              <Pill tone={TREND_TONE[estimate.trend]}>
                <TrendIcon trend={estimate.trend} /> {TREND_LABEL[estimate.trend]}
              </Pill>
            )}
          </div>

          {hasEstimate && (
            <div className="mt-1 text-sm">
              <span className="text-zinc-500">{current} lb (current)</span>
              <span className="mx-2 text-zinc-500">→</span>
              <span className="font-semibold text-zinc-100">{value} lb</span>
            </div>
          )}

          {ev && (
            <div className="mt-1 text-xs text-zinc-400">
              From{' '}
              <span className="text-zinc-300">
                {ev.reps} × {ev.weight} lb{ev.rpe ? ` @ RPE ${ev.rpe}` : ''}
              </span>{' '}
              ({ev.prescriptionName} on {ev.date.slice(0, 10)}) · {estimate.sessionsAnalyzed}{' '}
              session{estimate.sessionsAnalyzed === 1 ? '' : 's'} analyzed
            </div>
          )}
        </div>

        <div className="flex shrink-0 gap-1.5">
          {showApply &&
            (isPending ? (
              <>
                <button onClick={onCancel} className="btn-outline">
                  Cancel
                </button>
                <button onClick={onApply} className="btn-primary">
                  <Check size={14} /> Confirm overwrite
                </button>
              </>
            ) : (
              <button onClick={onApply} className="btn-outline">
                <Check size={14} /> Apply
              </button>
            ))}
        </div>
      </div>

      {isPending && (
        <div className="mt-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          This will overwrite your manual {label} 1RM ({current} lb) with the engine's estimate
          ({value} lb) and rebuild your weekly plan.
        </div>
      )}

      {hasEstimate && lowConfidence && (
        <div className="mt-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          Engine signal only — too few sessions, too much variance, or estimate dropped sharply
          vs your manual baseline. Log a couple more sessions before treating this as a real
          regression.
        </div>
      )}
    </div>
  );
}
