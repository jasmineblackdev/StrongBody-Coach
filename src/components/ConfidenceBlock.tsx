import { ShieldAlert, ThumbsUp, HelpCircle } from 'lucide-react';
import { Pill } from './ui';
import {
  CONFIDENCE_LABEL,
  CONFIDENCE_TONE,
  type ConfidenceReport,
} from '../lib/confidenceScoreEngine';
import { voiceForConfidence } from '../lib/coachVoice';

interface Props {
  report: ConfidenceReport;
  /**
   * When true, render the long-form "Why I'm confident / What would
   * improve this" panels. False = pill + one-line voice only (used in
   * compact dashboard cards).
   */
  showDetails?: boolean;
}

/**
 * Reusable confidence read for any card. Pill + one-sentence coach voice
 * + (optional) reasons / missing-data lists. Always shows a safety note
 * when injuries / pain are flagging.
 */
export default function ConfidenceBlock({ report, showDetails = true }: Props) {
  const voice = voiceForConfidence(report.level, report.safetyOverride);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={CONFIDENCE_TONE[report.level]}>
          <ThumbsUp size={12} /> {CONFIDENCE_LABEL[report.level]} ({report.score}/100)
        </Pill>
        {report.safetyOverride && (
          <Pill tone="danger">
            <ShieldAlert size={12} /> Safety override
          </Pill>
        )}
      </div>

      <p className="text-xs text-zinc-300 leading-relaxed">{voice}</p>

      {report.safetyOverride && report.safetyNote && (
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-2.5 text-xs text-zinc-100">
          {report.safetyNote}
        </div>
      )}

      {showDetails && (
        <details className="group rounded-xl border border-ink-800 bg-ink-900/40 px-3 py-2">
          <summary className="flex cursor-pointer list-none items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            <span className="inline-flex items-center gap-1.5">
              <HelpCircle size={11} /> Why I&apos;m confident · what would improve this
            </span>
            <span className="text-[10px] text-zinc-500 group-open:hidden">Show</span>
            <span className="hidden text-[10px] text-zinc-500 group-open:inline">Hide</span>
          </summary>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <div className="rounded-lg border border-success/30 bg-success/5 p-2.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-success">
                What I&apos;ve got
              </div>
              {report.reasons.length === 0 ? (
                <p className="mt-1 text-xs text-zinc-500">
                  Not much yet — log a few days of weight + a check-in.
                </p>
              ) : (
                <ul className="mt-1 space-y-0.5 text-xs text-zinc-200">
                  {report.reasons.map((r, i) => (
                    <li key={i}>• {r}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-2.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-warning">
                What would improve this
              </div>
              {report.missingData.length === 0 ? (
                <p className="mt-1 text-xs text-zinc-500">
                  Nothing critical — keep logging.
                </p>
              ) : (
                <ul className="mt-1 space-y-0.5 text-xs text-zinc-200">
                  {report.missingData.map((m, i) => (
                    <li key={i}>• {m}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </details>
      )}
    </div>
  );
}
