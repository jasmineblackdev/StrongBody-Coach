import { useMemo } from 'react';
import { Calendar, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card, CoachMessage, Pill, SectionHeader } from './ui';
import {
  buildFatLossTimeline,
  PHASE_TONE,
  type TimelinePhase,
} from '../lib/fatLossTimeline';
import { computeWeightTrend } from '../lib/weightTrendEngine';
import { computeAdherence } from '../lib/adherenceEngine';
import { store } from '../lib/storage';
import { useStoreVersion } from '../hooks/useStore';

/**
 * Your Progress Timeline — 4 phases with current highlighted. Built for
 * "when can I expect visible change?" without hyping or claiming a precise
 * week. All language is range-based.
 *
 * Hides itself when goal !== fat_loss (other goals don't follow this
 * timeline shape). Hides in goal phase too once user is near maintenance.
 */
export default function FatLossTimelineCard() {
  useStoreVersion();
  const profile = store.getProfile();
  const report = useMemo(() => {
    if (!profile) return null;
    const metrics = store.getMetrics();
    const checkIns = store.getCheckIns();
    const trend = computeWeightTrend(metrics, profile);
    const adherence = computeAdherence(checkIns[0]).score;
    return buildFatLossTimeline({
      profile,
      metrics,
      weeklyTrendLbs: trend.weeklyChange,
      adherenceScore: adherence,
      lastCheckIn: checkIns[0],
    });
  }, [profile]);

  if (!profile || profile.goal !== 'fat_loss' || !report) return null;

  return (
    <Card className="border-accent/20">
      <SectionHeader
        title="Your Progress Timeline"
        subtitle="What to expect — based on your weight, goal, and adherence"
        action={
          <Pill tone={PHASE_TONE[report.currentPhase]}>
            <Calendar size={12} /> Week {report.weeksIn}
          </Pill>
        }
      />

      <CoachMessage tone={PHASE_TONE[report.currentPhase]}>
        {report.headline}
      </CoachMessage>

      {/* Four phase tiles */}
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {report.phases.map((p) => (
          <PhaseTile key={p.phase} info={p} />
        ))}
      </div>

      {/* Headline numbers */}
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl border border-ink-800 bg-ink-850 p-3">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">
            Lost so far
          </div>
          <div className="mt-1 font-display text-lg font-semibold text-zinc-100">
            {report.totalLostLbs > 0 ? `−${report.totalLostLbs}` : '0'} lb
          </div>
        </div>
        <div className="rounded-xl border border-ink-800 bg-ink-850 p-3">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">
            To goal
          </div>
          <div className="mt-1 font-display text-lg font-semibold text-zinc-100">
            {report.remainingLbs} lb
          </div>
        </div>
        <div className="rounded-xl border border-ink-800 bg-ink-850 p-3">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">
            Trend
          </div>
          <div
            className={`mt-1 font-display text-lg font-semibold ${
              report.weeklyTrendLbs < 0 ? 'text-success' : 'text-zinc-300'
            }`}
          >
            {report.weeklyTrendLbs > 0 ? '+' : ''}
            {report.weeklyTrendLbs.toFixed(1)} lb/wk
          </div>
        </div>
      </div>

      {/* Warnings — only when present */}
      {report.warnings.length > 0 && (
        <div className="mt-3 rounded-xl border border-warning/30 bg-warning/10 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-warning">
            <AlertTriangle size={12} /> Heads up
          </div>
          <ul className="mt-1.5 space-y-0.5 text-xs text-zinc-200">
            {report.warnings.map((w, i) => (
              <li key={i}>• {w}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 text-[11px] text-zinc-500">
        Female fat loss is non-linear. These ranges are realistic, not
        promises — bloating, cycle phase, and water weight all move the
        scale around real fat changes.
      </p>
    </Card>
  );
}

function PhaseTile({ info }: { info: ReturnType<typeof buildFatLossTimeline>['phases'][number] }) {
  const tone =
    info.isCurrent
      ? 'border-accent/50 bg-accent/15'
      : info.isComplete
      ? 'border-success/30 bg-success/5'
      : 'border-ink-800 bg-ink-850 opacity-70';
  const headerTone =
    info.isCurrent ? 'text-rose-glow' : info.isComplete ? 'text-success' : 'text-zinc-400';
  const Icon = info.isComplete ? CheckCircle2 : null;
  return (
    <div className={`rounded-xl border p-3 transition ${tone}`}>
      <div className={`flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider ${headerTone}`}>
        <span>{info.label}</span>
        {Icon && <Icon size={12} className="text-success" />}
      </div>
      <div className="mt-1 text-sm font-bold text-zinc-100">{info.weekRange}</div>
      <div className="mt-0.5 text-[11px] text-zinc-300">
        Expected: {info.expectedLossRange}
      </div>
      <div className="mt-1.5 text-[11px] text-zinc-300 leading-snug">
        {info.visualChanges}
      </div>
      <div className="mt-1.5 text-[11px] italic text-zinc-400 leading-snug">
        {info.coachingNote}
      </div>
    </div>
  );
}

// Suppress unused export warning for the type — used by consumers.
export type { TimelinePhase };
