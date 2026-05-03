import { useMemo } from 'react';
import { Sparkles, ChevronRight } from 'lucide-react';
import { Pill } from './ui';
import { store } from '../lib/storage';
import { useStoreVersion } from '../hooks/useStore';
import {
  DECISION_LABEL,
  DECISION_TONE,
} from '../lib/weeklyDecisionEngine';
import {
  analyzeFemaleFatLoss,
  FAT_LOSS_STATE_LABEL,
} from '../lib/femaleFatLossEngine';

/**
 * One-line "what should I do this week" chip — Today screen anchor.
 *
 * Priority:
 *   1. Pending Coach Decision (one tap → review + accept/reject)
 *   2. Female fat-loss state (when actionable)
 *   3. "Stay course" default
 *
 * Tap expands a `<details>` with the full reasoning so the chip stays
 * short on first read.
 */
export default function TodayCoachAction() {
  useStoreVersion();
  const profile = store.getProfile();
  const data = useMemo(() => {
    if (!profile) return null;
    const decisions = store.getCoachDecisions();
    const pending = decisions.find((d) => d.status === 'pending');
    const female = analyzeFemaleFatLoss({
      metrics: store.getMetrics(),
      recentLogs: store.getLogs(),
      checkIns: store.getCheckIns(),
    });
    return { pending, latest: decisions[0] ?? null, female };
  }, [profile]);

  if (!data) return null;

  // What's the headline + tone?
  let headline: string;
  let tone: 'success' | 'accent' | 'warning' | 'danger';
  let reason: string;
  let actionLabel: string;

  if (data.pending) {
    headline = data.pending.headline;
    tone = DECISION_TONE[data.pending.decision];
    reason = data.pending.reason;
    actionLabel = `${DECISION_LABEL[data.pending.decision]}`;
  } else if (
    data.female.state === 'water_retention' ||
    data.female.state === 'false_plateau' ||
    data.female.state === 'mid_cycle_caution' ||
    data.female.state === 'hunger_hormonal' ||
    data.female.state === 'losing_too_fast'
  ) {
    headline = data.female.headline;
    tone = data.female.tone;
    reason = data.female.explanation;
    actionLabel = FAT_LOSS_STATE_LABEL[data.female.state];
  } else if (data.latest && data.latest.status === 'accepted') {
    headline = `Accepted: ${data.latest.headline}`;
    tone = 'success';
    reason = data.latest.reason;
    actionLabel = `Last decision: ${DECISION_LABEL[data.latest.decision]}`;
  } else {
    headline = 'Stay the course';
    tone = 'success';
    reason =
      'No pending coach decision. Run a weekly /check-in to refresh — the engine drafts your next move from the data.';
    actionLabel = 'Stay course';
  }

  return (
    <details className="group rounded-2xl border border-ink-800 bg-ink-850 transition open:border-accent/30">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-rose-glow">
            <Sparkles size={16} />
          </span>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              This week's coach action
            </div>
            <div className="truncate text-sm font-bold text-zinc-100">
              {headline}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Pill tone={tone}>{actionLabel}</Pill>
          <ChevronRight
            size={16}
            className="text-zinc-500 transition group-open:rotate-90"
          />
        </div>
      </summary>
      <div className="border-t border-ink-800 px-3 py-3 text-sm text-zinc-200">
        <p className="leading-relaxed">{reason}</p>
        {data.pending && (
          <p className="mt-2 text-[11px] text-zinc-500">
            Tap "Coach Insights" below to review + accept/reject this decision.
          </p>
        )}
      </div>
    </details>
  );
}
