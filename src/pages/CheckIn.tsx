import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  ClipboardList,
  Scale,
  Save,
  Sparkles,
} from 'lucide-react';
import { Card, CoachMessage, Pill, SectionHeader } from '../components/ui';
import { store } from '../lib/storage';
import { useStoreVersion } from '../hooks/useStore';
import { analyzeFatLoss, recommendationTone } from '../lib/fatLossEngine';
import { analyzeAdherenceAndPlateau, plateauTone } from '../lib/adherenceEngine';
import { computeWeightTrend } from '../lib/weightTrendEngine';
import { computeReadiness } from '../lib/recoveryEngine';
import { estimateAllLifts } from '../lib/strengthEngine';
import { assessInjuryRisk } from '../lib/ml/injuryRisk';
import { decideThisWeek } from '../lib/weeklyDecisionEngine';
import CoachDecisionCard from '../components/CoachDecisionCard';
import type { AdherenceLevel, CoachDecision, WeeklyCheckIn } from '../types';

const ADHERENCE: AdherenceLevel[] = ['yes', 'mostly', 'no'];
const ADHERENCE_LABEL: Record<AdherenceLevel, string> = {
  yes: 'Yes',
  mostly: 'Mostly',
  no: 'No',
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function CheckInPage() {
  useStoreVersion();
  const profile = store.getProfile()!;
  const metrics = store.getMetrics();
  const logs = store.getLogs();
  const checkIns = store.getCheckIns();

  const weightTrend = useMemo(() => computeWeightTrend(metrics, profile), [metrics, profile]);

  const [submitted, setSubmitted] = useState<WeeklyCheckIn | null>(null);
  const [coachDecision, setCoachDecision] = useState<CoachDecision | null>(null);
  const [draft, setDraft] = useState<Omit<WeeklyCheckIn, 'id'>>({
    date: todayIso(),
    weightAvg7d: weightTrend.sevenDayAvg,
    caloriesAdherence: 'mostly',
    proteinAdherence: 'mostly',
    workoutsCompleted: logs.filter((l) => {
      const d = new Date(l.date).getTime();
      return d >= Date.now() - 7 * 86400000;
    }).length,
    workoutsPlanned: profile.trainingDaysPerWeek,
    hungerLevel: 5,
    bloatingLevel: 5,
    bowelNotes: '',
    energyRecovery: 6,
    whatWorked: '',
    whatNeedsAdjustment: '',
  });

  function update<K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function submit() {
    const entry: WeeklyCheckIn = {
      ...draft,
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
    };
    store.addCheckIn(entry);

    // Generate a fresh weekly coach decision using the just-submitted
    // check-in. Persist it as pending — it stays pending until the user
    // accepts or rejects via the CoachDecisionCard.
    const freshTrend = computeWeightTrend(metrics, profile);
    const decision = decideThisWeek({
      profile,
      weekNumber: store.getWeekNumber(),
      weightTrend: freshTrend,
      recovery: computeReadiness(logs),
      lifts: estimateAllLifts(logs, {
        baselines: {
          squat: profile.squat1RM,
          bench: profile.bench1RM,
          deadlift: profile.deadlift1RM,
        },
      }),
      injuryRisk: assessInjuryRisk(logs),
      recentLogs: logs,
      lastCheckIn: entry,
    });
    store.addCoachDecision(decision);
    setCoachDecision(decision);
    setSubmitted(entry);
  }

  // After submission: re-run the analysis with the new check-in included.
  const analysis = useMemo(
    () =>
      analyzeFatLoss({
        profile,
        metrics,
        logs,
        checkIns: submitted ? [submitted, ...checkIns] : checkIns,
      }),
    [profile, metrics, logs, checkIns, submitted],
  );

  // Adherence + plateau diagnostic — answers "why isn't this working?"
  const plateau = useMemo(
    () =>
      analyzeAdherenceAndPlateau({
        weightTrend,
        lastCheckIn: submitted ?? checkIns[0],
        recentLogs: logs,
      }),
    [weightTrend, submitted, checkIns, logs],
  );

  if (submitted) {
    const tone = recommendationTone(analysis.primary.kind);
    return (
      <div className="space-y-6">
        <header>
          <h1 className="h1">Check-in saved.</h1>
          <p className="muted text-sm mt-1">
            Logged {submitted.date.slice(0, 10)} · the engine ran a fresh analysis below.
          </p>
        </header>

        {coachDecision && (
          <CoachDecisionCard
            mode="draft"
            decision={coachDecision}
            onResolved={(status) => {
              // After accept/reject, the store entry is updated by the card.
              // Refresh the local copy so the UI reflects the new status.
              const fresh = store
                .getCoachDecisions()
                .find((d) => d.id === coachDecision.id);
              if (fresh) setCoachDecision(fresh);
              if (status === 'accepted') {
                // Profile may have changed (calorie offset, steps target),
                // so re-render once. The store emit already covers most of
                // this, but explicit no-op state poke keeps things tidy.
              }
            }}
          />
        )}

        <Card className="border-accent/20">
          <SectionHeader
            title={
              plateau.primaryAction === 'stay_course'
                ? 'Plateau check: clear'
                : plateau.primaryAction === 'increase_calories'
                ? "You're losing too fast"
                : plateau.primaryAction === 'log_more_data'
                ? "Why you can't tell yet"
                : "Why you're not losing weight"
            }
            subtitle="Adherence + plateau diagnostic"
            action={<Pill tone={plateauTone(plateau.primaryAction)}>{plateau.confidence} confidence</Pill>}
          />
          <CoachMessage tone={plateauTone(plateau.primaryAction)} title={plateau.headline}>
            {plateau.reason}
          </CoachMessage>
          {plateau.adherence.hasCheckIn && (
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border border-ink-800 bg-ink-850 p-3">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">Calories</div>
                <div className="mt-1 font-display text-lg font-semibold">
                  {Math.round(plateau.adherence.components.calories * 100)}%
                </div>
              </div>
              <div className="rounded-xl border border-ink-800 bg-ink-850 p-3">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">Protein</div>
                <div className="mt-1 font-display text-lg font-semibold">
                  {Math.round(plateau.adherence.components.protein * 100)}%
                </div>
              </div>
              <div className="rounded-xl border border-ink-800 bg-ink-850 p-3">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">Workouts</div>
                <div className="mt-1 font-display text-lg font-semibold">
                  {Math.round(plateau.adherence.components.workouts * 100)}%
                </div>
              </div>
            </div>
          )}
        </Card>

        <Card>
          <SectionHeader
            title="Coach recommendation"
            subtitle="Primary action for the next 7 days"
            action={<Pill tone={tone}>{analysis.primary.kind.replace(/_/g, ' ')}</Pill>}
          />
          <CoachMessage tone={tone} title={analysis.primary.headline} icon={<Sparkles size={18} />}>
            {analysis.primary.body}
          </CoachMessage>

          {analysis.recommendations.length > 1 && (
            <div className="mt-4 space-y-2">
              <div className="text-xs uppercase tracking-wider text-zinc-400">
                Other observations
              </div>
              {analysis.recommendations.slice(1).map((r, i) => (
                <div key={i} className="rounded-xl border border-ink-800 bg-ink-850 p-3">
                  <div className="text-sm font-semibold text-zinc-100">{r.headline}</div>
                  <div className="mt-0.5 text-xs text-zinc-400">{r.body}</div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="flex flex-wrap gap-2">
          <Link to="/" className="btn-primary">
            Back to Dashboard
          </Link>
          <button onClick={() => setSubmitted(null)} className="btn-outline">
            Edit check-in
          </button>
        </div>

        <Card>
          <SectionHeader title="Past check-ins" subtitle={`${checkIns.length + 1} total`} />
          <CheckInHistory entries={[submitted, ...checkIns]} />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="h1">Weekly check-in</h1>
        <p className="muted text-sm mt-1">
          Run this every 7 days. Honest answers → useful coaching. The engine adjusts only when
          there's enough signal.
        </p>
      </header>

      <CoachMessage title="Why this matters" icon={<ClipboardList size={18} />}>
        Single-day weight swings don't drive decisions — your honest 7-day average and adherence
        do. Skip the temptation to round up adherence; it'll just slow you down.
      </CoachMessage>

      <Card>
        <SectionHeader
          title="Body"
          subtitle="7-day average weight + the trend behind it"
          action={
            <Pill tone="accent">
              <Scale size={12} /> {weightTrend.sevenDayAvg.toFixed(1)} lb avg
            </Pill>
          }
        />
        <Field label="Average weight this week (lb)">
          <input
            type="number"
            step="0.1"
            className="input"
            value={draft.weightAvg7d ?? ''}
            onChange={(e) =>
              update('weightAvg7d', e.target.value ? Number(e.target.value) : undefined)
            }
          />
        </Field>
      </Card>

      <Card>
        <SectionHeader title="Nutrition" />
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Did you hit calories?">
            <SegmentedControl
              value={draft.caloriesAdherence}
              options={ADHERENCE}
              labels={ADHERENCE_LABEL}
              onChange={(v) => update('caloriesAdherence', v)}
            />
          </Field>
          <Field label="Did you hit protein?">
            <SegmentedControl
              value={draft.proteinAdherence}
              options={ADHERENCE}
              labels={ADHERENCE_LABEL}
              onChange={(v) => update('proteinAdherence', v)}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionHeader title="Training" />
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Workouts completed">
            <input
              type="number"
              min={0}
              className="input"
              value={draft.workoutsCompleted}
              onChange={(e) => update('workoutsCompleted', Number(e.target.value))}
            />
          </Field>
          <Field label="Workouts planned">
            <input
              type="number"
              min={1}
              className="input"
              value={draft.workoutsPlanned}
              onChange={(e) => update('workoutsPlanned', Number(e.target.value))}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionHeader title="How your body's running" />
        <div className="space-y-4">
          <Field label={`Hunger this week: ${draft.hungerLevel}/10`}>
            <input
              type="range"
              min={1}
              max={10}
              value={draft.hungerLevel}
              onChange={(e) => update('hungerLevel', Number(e.target.value))}
              className="w-full accent-pink-500"
            />
          </Field>
          <Field label={`Bloating: ${draft.bloatingLevel}/10`}>
            <input
              type="range"
              min={1}
              max={10}
              value={draft.bloatingLevel}
              onChange={(e) => update('bloatingLevel', Number(e.target.value))}
              className="w-full accent-pink-500"
            />
          </Field>
          <Field label={`Energy / recovery: ${draft.energyRecovery}/10`}>
            <input
              type="range"
              min={1}
              max={10}
              value={draft.energyRecovery}
              onChange={(e) => update('energyRecovery', Number(e.target.value))}
              className="w-full accent-pink-500"
            />
          </Field>
          <Field label="Bowel / constipation notes">
            <input
              className="input"
              placeholder="e.g., regular but harder than usual; bloated 2/7 days"
              value={draft.bowelNotes}
              onChange={(e) => update('bowelNotes', e.target.value)}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionHeader title="Reflection" subtitle="Two short answers — they show up in the engine's read." />
        <div className="space-y-4">
          <Field label="What worked this week?">
            <textarea
              className="input min-h-[80px]"
              placeholder="e.g., front squat felt strong; prepping lunches kept protein on track"
              value={draft.whatWorked}
              onChange={(e) => update('whatWorked', e.target.value)}
            />
          </Field>
          <Field label="What needs adjustment?">
            <textarea
              className="input min-h-[80px]"
              placeholder="e.g., hungry every night; deadlifts felt slow; bloating after weekends"
              value={draft.whatNeedsAdjustment}
              onChange={(e) => update('whatNeedsAdjustment', e.target.value)}
            />
          </Field>
        </div>
      </Card>

      <div className="flex justify-end">
        <button onClick={submit} className="btn-primary">
          <Save size={16} /> Save check-in & get coaching
        </button>
      </div>

      {checkIns.length > 0 && (
        <Card>
          <SectionHeader title="Past check-ins" subtitle={`${checkIns.length} total`} />
          <CheckInHistory entries={checkIns} />
        </Card>
      )}
    </div>
  );
}

function Field({
  label,
  children,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

function SegmentedControl<T extends string>({
  value,
  options,
  labels,
  onChange,
}: {
  value: T;
  options: T[];
  labels: Record<T, string>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`btn ${value === o ? 'btn-primary' : 'btn-outline'}`}
        >
          {labels[o]}
        </button>
      ))}
    </div>
  );
}

function CheckInHistory({ entries }: { entries: WeeklyCheckIn[] }) {
  if (!entries.length) return <div className="muted text-sm">No check-ins yet.</div>;
  return (
    <div className="space-y-2">
      {entries.slice(0, 6).map((e) => (
        <div key={e.id} className="rounded-xl border border-ink-800 bg-ink-850 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <CheckCircle2 size={14} className="text-success" />
            <span className="font-semibold text-zinc-100">{e.date.slice(0, 10)}</span>
            {e.weightAvg7d && <Pill>{e.weightAvg7d.toFixed(1)} lb avg</Pill>}
            <Pill>cal: {e.caloriesAdherence}</Pill>
            <Pill>protein: {e.proteinAdherence}</Pill>
            <Pill>
              workouts: {e.workoutsCompleted}/{e.workoutsPlanned}
            </Pill>
          </div>
          <div className="mt-1.5 text-xs text-zinc-400">
            Hunger {e.hungerLevel}/10 · Bloat {e.bloatingLevel}/10 · Energy {e.energyRecovery}/10
          </div>
          {e.whatWorked && (
            <div className="mt-1 text-xs">
              <span className="text-success">✓</span>{' '}
              <span className="text-zinc-300">{e.whatWorked}</span>
            </div>
          )}
          {e.whatNeedsAdjustment && (
            <div className="text-xs">
              <span className="text-warning">✎</span>{' '}
              <span className="text-zinc-300">{e.whatNeedsAdjustment}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
