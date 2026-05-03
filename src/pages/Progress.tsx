import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Card, CoachMessage, Pill, SectionHeader, StatCard } from '../components/ui';
import { BigThreeChart, BodyWeightChart, ComplianceChart, MacroStackedBar } from '../components/charts';
import { store } from '../lib/storage';
import { useStoreVersion } from '../hooks/useStore';
import { detectWeakPoints } from '../lib/weakPoints';
import { buildDailyPlan } from '../lib/mealPlan';
import { matchesMainLift } from '../lib/strengthEngine';
import ProgressPhotoPanel from '../components/ProgressPhotoPanel';
import PhotoAnalysisPanel from '../components/PhotoAnalysisPanel';
import type { BodyMetric } from '../types';

export default function ProgressPage() {
  useStoreVersion();
  const profile = store.getProfile()!;
  const metrics = store.getMetrics();
  const logs = store.getLogs();
  const weakPoints = useMemo(() => detectWeakPoints(logs), [logs]);

  const sorted = [...metrics].sort((a, b) => a.date.localeCompare(b.date));
  const liftHistory = useMemo(() => {
    // M8 fix: same strict main-lift matching as strengthEngine, so the chart
    // doesn't draw Front Squat / Paused Squat / Bulgarian Split Squat as
    // "Squat" data points (which would look like a regression during a
    // variation block).
    const series = logs
      .slice()
      .reverse()
      .map((l) => {
        const top = (lift: 'squat' | 'bench' | 'deadlift') => {
          const ex = l.exercises.find((e) =>
            matchesMainLift(e.prescriptionName, lift),
          );
          return ex ? Math.max(0, ...ex.sets.map((s) => s.weight)) : null;
        };
        return {
          date: l.date.slice(5, 10),
          squat: top('squat'),
          bench: top('bench'),
          deadlift: top('deadlift'),
        };
      });
    return series;
  }, [logs]);

  const macroWeek = useMemo(() => {
    const today = new Date();
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      const dow = d.getDay(); // 0=Sun
      const isTrainingDay = ![0, 3].includes(dow);
      const plan = buildDailyPlan({ profile, isTrainingDay });
      return {
        day: labels[(dow + 6) % 7],
        protein: plan.totals.proteinG,
        carbs: plan.totals.carbsG,
        fat: plan.totals.fatG,
      };
    });
  }, [profile]);

  const compliance = useMemo(() => {
    const weeks: Record<number, number> = {};
    logs.forEach((l) => {
      weeks[l.weekNumber] = (weeks[l.weekNumber] ?? 0) + 1;
    });
    return Object.entries(weeks)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([wk, count]) => ({ week: `W${wk}`, sessions: count }));
  }, [logs]);

  const last = sorted[sorted.length - 1];
  const first = sorted[0];

  const [newMetric, setNewMetric] = useState<BodyMetric>({
    date: new Date().toISOString().slice(0, 10),
    weightLbs: last?.weightLbs ?? profile.weightLbs,
    waistIn: last?.waistIn,
    notes: '',
  });

  function logMetric() {
    if (!newMetric.weightLbs && !newMetric.waistIn) return;
    // M7 fix: dedup by date — logging twice on the same day replaces the
    // existing entry instead of stacking duplicates that would skew the
    // 7-day average and trend math.
    const existing = store.getMetrics();
    const idx = existing.findIndex((m) => m.date === newMetric.date);
    if (idx >= 0) {
      const next = [...existing];
      next[idx] = { ...next[idx], ...newMetric };
      store.setMetrics(next);
    } else {
      store.addMetric(newMetric);
    }
    setNewMetric({ ...newMetric, notes: '' });
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="h1">Progress</h1>
        <p className="muted text-sm mt-1">Body, lifts, compliance, and the weak points your logs are flagging.</p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Weight"
          value={(last?.weightLbs ?? profile.weightLbs).toFixed(1)}
          unit="lb"
          delta={
            first && last
              ? { value: +(last.weightLbs! - first.weightLbs!).toFixed(1), positiveIsGood: false }
              : undefined
          }
        />
        <StatCard label="Waist" value={last?.waistIn?.toFixed(2) ?? '—'} unit="in" />
        <StatCard label="Logs" value={logs.length} hint="total sessions" />
        <StatCard
          label="Recovery (last 5)"
          value={
            (
              logs
                .map((l) => l.recoveryScore ?? 0)
                .filter(Boolean)
                .slice(0, 5)
                .reduce((a, b) => a + b, 0) /
              Math.max(1, Math.min(5, logs.filter((l) => l.recoveryScore).length))
            ).toFixed(1) || '—'
          }
          unit="/10"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionHeader title="Body weight & waist" />
          <div className="h-64">
            <BodyWeightChart
              data={sorted.map((m) => ({ date: m.date.slice(5), weight: m.weightLbs, waist: m.waistIn }))}
            />
          </div>
        </Card>

        <Card>
          <SectionHeader title="Add measurement" />
          <div className="space-y-3">
            <Field label="Date">
              <input
                type="date"
                className="input"
                value={newMetric.date}
                onChange={(e) => setNewMetric({ ...newMetric, date: e.target.value })}
              />
            </Field>
            <Field label="Weight (lb)">
              <input
                type="number"
                className="input"
                value={newMetric.weightLbs ?? ''}
                onChange={(e) => setNewMetric({ ...newMetric, weightLbs: Number(e.target.value) })}
              />
            </Field>
            <Field label="Waist (in)">
              <input
                type="number"
                step="0.1"
                className="input"
                value={newMetric.waistIn ?? ''}
                onChange={(e) => setNewMetric({ ...newMetric, waistIn: Number(e.target.value) })}
              />
            </Field>
            <Field label="Notes">
              <input
                className="input"
                value={newMetric.notes ?? ''}
                onChange={(e) => setNewMetric({ ...newMetric, notes: e.target.value })}
              />
            </Field>
            <button onClick={logMetric} className="btn-primary w-full">
              <Plus size={16} /> Save measurement
            </button>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <SectionHeader title="Big 3 top sets over time" />
          <div className="h-64">
            <BigThreeChart data={liftHistory} />
          </div>
        </Card>

        <Card>
          <SectionHeader title="Weekly compliance" />
          <div className="h-64">
            <ComplianceChart data={compliance} />
          </div>
        </Card>

        <Card className="lg:col-span-3">
          <SectionHeader
            title="Macro tracking"
            subtitle="Calories from each macro across the last 7 days"
          />
          <div className="h-64">
            <MacroStackedBar days={macroWeek} />
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-400">
            <span><span className="inline-block h-2 w-2 rounded-full bg-accent mr-1.5" />Protein</span>
            <span><span className="inline-block h-2 w-2 rounded-full bg-success mr-1.5" />Carbs</span>
            <span><span className="inline-block h-2 w-2 rounded-full bg-warning mr-1.5" />Fat</span>
          </div>
        </Card>

        <Card className="lg:col-span-3">
          <SectionHeader
            title="Weak point report"
            subtitle="Detected from your last sessions"
            action={<Pill tone={weakPoints.length ? 'warning' : 'success'}>{weakPoints.length} flagged</Pill>}
          />
          {!weakPoints.length ? (
            <CoachMessage tone="success">
              Nothing flagged. Stay consistent with logs and the engine will catch the next stall before you do.
            </CoachMessage>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {weakPoints.map((w) => (
                <div key={w.key} className="rounded-2xl border border-ink-800 bg-ink-850 p-4">
                  <div className="flex items-center gap-2">
                    <Pill tone="accent">{w.key.replace(/_/g, ' ')}</Pill>
                  </div>
                  <div className="mt-2 font-semibold">{w.title}</div>
                  <div className="mt-1 text-xs text-zinc-400">{w.evidence}</div>
                  <div className="mt-2 text-sm text-zinc-200">{w.recommendation}</div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="lg:col-span-3">
          <ProgressPhotoPanel />
        </div>

        <div className="lg:col-span-3">
          <PhotoAnalysisPanel />
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
