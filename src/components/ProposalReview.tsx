import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  X,
  Sparkles,
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  PlusCircle,
  MinusCircle,
  Repeat,
  Undo2,
} from 'lucide-react';
import { Card, CoachMessage, Pill, SectionHeader } from './ui';
import { dayLabel } from '../lib/workoutPlan';
import type { PlanChange, PlanProposal } from '../types';

const KIND_META: Record<
  PlanChange['kind'],
  { label: string; tone: 'success' | 'warning' | 'danger' | 'accent'; Icon: typeof Check }
> = {
  load_increase: { label: 'Load increase', tone: 'success', Icon: TrendingUp },
  load_decrease: { label: 'Load decrease', tone: 'danger', Icon: TrendingDown },
  volume_decrease: { label: 'Volume decrease', tone: 'warning', Icon: MinusCircle },
  add_exercise: { label: 'Added exercise', tone: 'accent', Icon: PlusCircle },
  swap_exercise: { label: 'Swapped exercise', tone: 'warning', Icon: ArrowLeftRight },
  phase_change: { label: 'Phase change', tone: 'danger', Icon: Repeat },
};

type Decision = 'accepted' | 'rejected';
type Decisions = Record<string, Decision>;

export interface ProposalCompleteResult {
  acceptedChanges: PlanChange[];
  rejectedChanges: PlanChange[];
}

export interface ProposalReviewProps {
  proposal: PlanProposal;
  onComplete: (result: ProposalCompleteResult) => void;
}

export default function ProposalReview({ proposal, onComplete }: ProposalReviewProps) {
  const [decisions, setDecisions] = useState<Decisions>({});

  const total = proposal.changes.length;
  const accepted = useMemo(
    () => Object.values(decisions).filter((d) => d === 'accepted').length,
    [decisions],
  );
  const rejected = useMemo(
    () => Object.values(decisions).filter((d) => d === 'rejected').length,
    [decisions],
  );
  const pending = total - accepted - rejected;

  function decide(id: string, decision: Decision) {
    setDecisions((prev) => ({ ...prev, [id]: decision }));
  }
  function undo(id: string) {
    setDecisions((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }
  function acceptAllRemaining() {
    setDecisions((prev) => {
      const next = { ...prev };
      proposal.changes.forEach((c) => {
        if (!next[c.id]) next[c.id] = 'accepted';
      });
      return next;
    });
  }
  function rejectAllRemaining() {
    setDecisions((prev) => {
      const next = { ...prev };
      proposal.changes.forEach((c) => {
        if (!next[c.id]) next[c.id] = 'rejected';
      });
      return next;
    });
  }

  // Auto-apply once every change has been decided.
  useEffect(() => {
    if (pending !== 0 || total === 0) return;
    const t = setTimeout(() => {
      onComplete({
        acceptedChanges: proposal.changes.filter((c) => decisions[c.id] === 'accepted'),
        rejectedChanges: proposal.changes.filter((c) => decisions[c.id] === 'rejected'),
      });
    }, 450);
    return () => clearTimeout(t);
  }, [pending, total, decisions, proposal.changes, onComplete]);

  const grouped = proposal.changes.reduce<Record<string, PlanChange[]>>((acc, c) => {
    (acc[c.day] ??= []).push(c);
    return acc;
  }, {});
  const dayOrder: (keyof typeof grouped)[] = [
    'all',
    'squat',
    'bench',
    'deadlift',
    'upper_accessory',
    'lower_glute',
  ];

  return (
    <Card className="border-accent/40 ring-accent-soft">
      <SectionHeader
        title={`Coach drafted Week ${proposal.toWeek}`}
        subtitle={`${total} change${total === 1 ? '' : 's'} based on your last ${
          proposal.sourceLogIds.length
        } session${proposal.sourceLogIds.length === 1 ? '' : 's'}`}
        action={
          <Pill tone="accent">
            <Sparkles size={12} /> proposal
          </Pill>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <Pill tone="success">
          <Check size={12} /> {accepted} accepted
        </Pill>
        <Pill tone="danger">
          <X size={12} /> {rejected} rejected
        </Pill>
        <Pill>{pending} pending</Pill>
      </div>

      {proposal.toPhase !== proposal.fromPhase && (
        <CoachMessage tone="danger" title={`Phase change: ${proposal.fromPhase} → ${proposal.toPhase}`}>
          Accepting this change rebuilds the whole week as a deload — other changes are not relevant.
        </CoachMessage>
      )}

      <div className="mt-4 space-y-5">
        {dayOrder
          .filter((d) => grouped[d]?.length)
          .map((d) => (
            <div key={d}>
              <div className="mb-2 flex items-center gap-2">
                <Pill>{d === 'all' ? 'Whole plan' : dayLabel[d as keyof typeof dayLabel]}</Pill>
                <span className="text-xs text-zinc-500">
                  {grouped[d].length} change{grouped[d].length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="space-y-2">
                {grouped[d].map((c) => (
                  <ChangeRow
                    key={c.id}
                    change={c}
                    decision={decisions[c.id]}
                    onAccept={() => decide(c.id, 'accepted')}
                    onReject={() => decide(c.id, 'rejected')}
                    onUndo={() => undo(c.id)}
                  />
                ))}
              </div>
            </div>
          ))}
      </div>

      <div className="divider my-5" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-zinc-500">
          Decide each change. When all are handled the plan auto-updates locally — push to cloud
          when you're ready.
        </div>
        <div className="flex gap-2">
          <button onClick={rejectAllRemaining} disabled={pending === 0} className="btn-outline">
            <X size={16} /> Reject all remaining
          </button>
          <button onClick={acceptAllRemaining} disabled={pending === 0} className="btn-primary">
            <Check size={16} /> Accept all remaining
          </button>
        </div>
      </div>
    </Card>
  );
}

function ChangeRow({
  change,
  decision,
  onAccept,
  onReject,
  onUndo,
}: {
  change: PlanChange;
  decision?: Decision;
  onAccept: () => void;
  onReject: () => void;
  onUndo: () => void;
}) {
  const meta = KIND_META[change.kind];
  const Icon = meta.Icon;
  const toneClass =
    meta.tone === 'success'
      ? 'text-success'
      : meta.tone === 'danger'
      ? 'text-danger'
      : meta.tone === 'warning'
      ? 'text-warning'
      : 'text-rose-glow';
  const cardClass =
    decision === 'accepted'
      ? 'border-success/40 bg-success/5'
      : decision === 'rejected'
      ? 'border-danger/40 bg-danger/5 opacity-70'
      : 'border-ink-800 bg-ink-850';

  return (
    <div className={`rounded-xl border p-3.5 transition ${cardClass}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 ${toneClass}`}>
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="font-semibold text-zinc-100">{change.exercise}</div>
            <span className="text-[10px] uppercase tracking-wider text-zinc-500">
              {meta.label}
            </span>
          </div>
          {(change.before || change.after) && (
            <div className="mt-1 text-sm text-zinc-300">
              {change.before && <span className="text-zinc-500 line-through">{change.before}</span>}
              {change.before && change.after && <span className="mx-2 text-zinc-500">→</span>}
              {change.after && <span className="font-semibold">{change.after}</span>}
            </div>
          )}
          <div className="mt-2 text-xs leading-relaxed text-zinc-400">
            <span className="text-zinc-300 font-medium">Coach changed this because:</span>{' '}
            {change.reason}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {decision === 'accepted' && (
              <>
                <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">
                  <Check size={12} /> Accepted
                </span>
                <button onClick={onUndo} className="text-xs text-zinc-400 hover:text-zinc-200 inline-flex items-center gap-1">
                  <Undo2 size={12} /> Undo
                </button>
              </>
            )}
            {decision === 'rejected' && (
              <>
                <span className="inline-flex items-center gap-1 rounded-full bg-danger/15 px-2 py-0.5 text-xs font-semibold text-danger">
                  <X size={12} /> Rejected
                </span>
                <button onClick={onUndo} className="text-xs text-zinc-400 hover:text-zinc-200 inline-flex items-center gap-1">
                  <Undo2 size={12} /> Undo
                </button>
              </>
            )}
            {!decision && (
              <>
                <button onClick={onAccept} className="btn-primary !py-1.5 !px-3 !text-xs">
                  <Check size={12} /> Accept
                </button>
                <button onClick={onReject} className="btn-outline !py-1.5 !px-3 !text-xs">
                  <X size={12} /> Reject
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
