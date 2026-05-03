import { useEffect, useMemo } from 'react';
import { History, Check, X } from 'lucide-react';
import { Card, Pill, SectionHeader } from './ui';
import {
  computeOutcome,
  VERDICT_LABEL,
  VERDICT_TONE,
} from '../lib/decisionOutcomes';
import { DECISION_LABEL, DECISION_TONE } from '../lib/weeklyDecisionEngine';
import { store } from '../lib/storage';
import { useStoreVersion } from '../hooks/useStore';

/**
 * Past coach decisions with outcomes. Computes outcomes lazily for
 * accepted decisions ≥ 7 days old and writes them back to storage so
 * future renders are cheap. Hides itself when there's no history.
 */
export default function DecisionHistoryPanel() {
  useStoreVersion();
  const decisions = useMemo(() => store.getCoachDecisions(), []);
  const metrics = useMemo(() => store.getMetrics(), []);
  const logs = useMemo(() => store.getLogs(), []);
  const checkIns = useMemo(() => store.getCheckIns(), []);

  // Compute outcomes for accepted decisions that are 7+ days old and
  // don't yet have one. One pass per render — cheap.
  useEffect(() => {
    let dirty = false;
    const updates: { id: string; outcome: ReturnType<typeof computeOutcome> }[] = [];
    for (const d of decisions) {
      if (d.status !== 'accepted' || d.outcome) continue;
      const o = computeOutcome(d, metrics, logs, checkIns);
      if (o) {
        updates.push({ id: d.id, outcome: o });
        dirty = true;
      }
    }
    if (dirty) {
      updates.forEach((u) => {
        if (u.outcome) {
          store.updateCoachDecision(u.id, { outcome: u.outcome });
        }
      });
    }
  }, [decisions, metrics, logs, checkIns]);

  if (decisions.length === 0) return null;

  return (
    <Card>
      <SectionHeader
        title="Decision history"
        subtitle="Did past coach decisions actually move the needle?"
        action={
          <Pill>
            <History size={12} /> {decisions.length}
          </Pill>
        }
      />

      <ul className="space-y-2">
        {decisions.slice(0, 8).map((d) => {
          const tone = DECISION_TONE[d.decision];
          const verdict = d.outcome?.verdict;
          return (
            <li
              key={d.id}
              className="rounded-xl border border-ink-800 bg-ink-850 p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={tone}>{DECISION_LABEL[d.decision]}</Pill>
                  <span className="text-xs text-zinc-400">
                    {d.acceptedAt
                      ? `accepted ${d.acceptedAt.slice(0, 10)}`
                      : d.rejectedAt
                      ? `rejected ${d.rejectedAt.slice(0, 10)}`
                      : `pending ${d.generatedAt.slice(0, 10)}`}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {d.status === 'accepted' && (
                    <span className="inline-flex items-center gap-1 text-xs text-success">
                      <Check size={12} /> accepted
                    </span>
                  )}
                  {d.status === 'rejected' && (
                    <span className="inline-flex items-center gap-1 text-xs text-warning">
                      <X size={12} /> rejected
                    </span>
                  )}
                  {verdict && (
                    <Pill tone={VERDICT_TONE[verdict]}>{VERDICT_LABEL[verdict]}</Pill>
                  )}
                </div>
              </div>
              <div className="mt-1 text-sm text-zinc-200">{d.headline}</div>
              {d.outcome && (
                <div className="mt-1 text-xs text-zinc-400">
                  {d.outcome.note}
                  {d.outcome.predictedWeeklyChange !== null && d.outcome.actualWeeklyChange !== null && (
                    <span className="ml-1 text-zinc-500">
                      (predicted {d.outcome.predictedWeeklyChange} lb/wk · actual{' '}
                      {d.outcome.actualWeeklyChange} lb/wk)
                    </span>
                  )}
                </div>
              )}
              {d.status === 'accepted' && !d.outcome && (
                <div className="mt-1 text-[11px] text-zinc-500">
                  Outcome will appear after 7 days. Keep logging weight + a check-in.
                </div>
              )}
              {d.status === 'rejected' && d.rejectionReason && (
                <div className="mt-1 text-[11px] text-zinc-500">
                  Note: "{d.rejectionReason}"
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
