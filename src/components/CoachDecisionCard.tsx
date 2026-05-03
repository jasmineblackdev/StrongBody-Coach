import { useMemo, useState } from 'react';
import { Check, X, Sparkles, ShieldAlert, ListChecks } from 'lucide-react';
import { Card, CoachMessage, Pill, SectionHeader } from './ui';
import {
  DECISION_LABEL,
  DECISION_TONE,
  applyCoachDecision,
  decideThisWeek,
  rejectCoachDecision,
} from '../lib/weeklyDecisionEngine';
import { computeWeightTrend } from '../lib/weightTrendEngine';
import { computeReadiness } from '../lib/recoveryEngine';
import { estimateAllLifts } from '../lib/strengthEngine';
import { assessInjuryRisk } from '../lib/ml/injuryRisk';
import { store } from '../lib/storage';
import { useStoreVersion } from '../hooks/useStore';
import type { CoachDecision } from '../types';

interface Props {
  /**
   * Render mode. "draft" generates a fresh decision but does NOT save it —
   * used on the CheckIn confirmation page so the user can preview before
   * accepting. "stored" reads the most recent decision from storage and
   * shows it as a Dashboard card.
   */
  mode?: 'draft' | 'stored';
  /**
   * When mode === 'draft', the parent supplies the decision (typically the
   * fresh one generated immediately after a check-in submit).
   */
  decision?: CoachDecision;
  /**
   * Called when accept/reject completes. Optional — the store will already
   * be updated, so most callers don't need this.
   */
  onResolved?: (status: 'accepted' | 'rejected') => void;
  /**
   * When true, hides the card entirely if there is no decision in the
   * relevant mode. Default true.
   */
  hideIfEmpty?: boolean;
}

/**
 * Generates a CoachDecision from the current local store. Used by the
 * Dashboard to surface the latest one and by CheckIn to preview a brand-new
 * one. Pure read of state — does not write.
 */
export function buildLatestDecision(): CoachDecision | null {
  const profile = store.getProfile();
  if (!profile) return null;
  const metrics = store.getMetrics();
  const logs = store.getLogs();
  const lastCheckIn = store.getCheckIns()[0];
  const weightTrend = computeWeightTrend(metrics, profile);
  const recovery = computeReadiness(logs);
  const lifts = estimateAllLifts(logs, {
    baselines: {
      squat: profile.squat1RM,
      bench: profile.bench1RM,
      deadlift: profile.deadlift1RM,
    },
  });
  const injuryRisk = assessInjuryRisk(logs);
  return decideThisWeek({
    profile,
    weekNumber: store.getWeekNumber(),
    weightTrend,
    recovery,
    lifts,
    injuryRisk,
    recentLogs: logs,
    lastCheckIn,
  });
}

export default function CoachDecisionCard({
  mode = 'stored',
  decision: passed,
  onResolved,
  hideIfEmpty = true,
}: Props) {
  useStoreVersion();
  const stored = useMemo(() => store.getCoachDecisions(), []);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState('');

  const decision = passed ?? stored[0] ?? null;

  if (!decision) {
    if (hideIfEmpty) return null;
    return (
      <Card>
        <div className="text-sm text-zinc-400">
          No coach decision yet. Run a weekly check-in to generate one.
        </div>
      </Card>
    );
  }

  const tone = DECISION_TONE[decision.decision];
  const label = DECISION_LABEL[decision.decision];
  const isPending = decision.status === 'pending';
  const isAccepted = decision.status === 'accepted';
  const isRejected = decision.status === 'rejected';

  function accept() {
    applyCoachDecision(decision!);
    onResolved?.('accepted');
  }

  function reject() {
    if (!rejectOpen) {
      setRejectOpen(true);
      return;
    }
    rejectCoachDecision(decision!.id, rejectNote.trim() || undefined);
    setRejectOpen(false);
    onResolved?.('rejected');
  }

  return (
    <Card className={isPending ? 'border-accent/30' : ''}>
      <SectionHeader
        title="This week's coach decision"
        subtitle={
          mode === 'draft'
            ? 'Drafted from your check-in just now — review before applying.'
            : `Generated ${decision.generatedAt.slice(0, 10)} · week ${decision.weekNumber}`
        }
        action={
          <div className="flex items-center gap-2">
            <Pill tone={tone}>{label}</Pill>
            <Pill>{decision.confidence} confidence</Pill>
            {isAccepted && <Pill tone="success">accepted</Pill>}
            {isRejected && <Pill tone="warning">rejected</Pill>}
            {isPending && <Pill tone="accent">pending</Pill>}
          </div>
        }
      />

      <CoachMessage tone={tone} title={decision.headline} icon={<Sparkles size={18} />}>
        {decision.reason}
      </CoachMessage>

      {(decision.observations.whatWorked.length > 0 ||
        decision.observations.whatHeldBack.length > 0) && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {decision.observations.whatWorked.length > 0 && (
            <div className="rounded-2xl border border-success/30 bg-success/5 p-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-success">
                What worked
              </div>
              <ul className="mt-2 space-y-1 text-sm text-zinc-200">
                {decision.observations.whatWorked.map((s, i) => (
                  <li key={i}>• {s}</li>
                ))}
              </ul>
            </div>
          )}
          {decision.observations.whatHeldBack.length > 0 && (
            <div className="rounded-2xl border border-warning/30 bg-warning/5 p-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-warning">
                What held you back
              </div>
              <ul className="mt-2 space-y-1 text-sm text-zinc-200">
                {decision.observations.whatHeldBack.map((s, i) => (
                  <li key={i}>• {s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {decision.suggestedChanges.length > 0 && (
        <div className="mt-4 rounded-2xl border border-ink-800 bg-ink-850 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-300">
            <ListChecks size={14} /> What changes if accepted
          </div>
          <ul className="mt-2 space-y-1.5 text-sm text-zinc-200">
            {decision.suggestedChanges.map((c, i) => (
              <li key={i}>
                <span className="text-rose-glow">→</span> {c.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      {decision.safetyNotes.length > 0 && (
        <div className="mt-3 rounded-2xl border border-warning/20 bg-warning/5 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-warning">
            <ShieldAlert size={14} /> Safety notes
          </div>
          <ul className="mt-2 space-y-1 text-xs text-zinc-300">
            {decision.safetyNotes.map((s, i) => (
              <li key={i}>• {s}</li>
            ))}
          </ul>
        </div>
      )}

      {isPending && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={accept} className="btn-primary">
            <Check size={16} /> Accept and apply
          </button>
          <button onClick={reject} className="btn-outline">
            <X size={16} /> {rejectOpen ? 'Confirm reject' : 'Reject'}
          </button>
          {rejectOpen && (
            <input
              className="input flex-1 min-w-[180px]"
              placeholder="Optional: why? (so future weeks learn)"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
            />
          )}
        </div>
      )}

      {isRejected && decision.rejectionReason && (
        <div className="mt-3 text-xs text-zinc-500">
          You rejected this with note: "{decision.rejectionReason}"
        </div>
      )}
    </Card>
  );
}
