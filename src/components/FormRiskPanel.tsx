import { useMemo } from 'react';
import { ShieldAlert, Activity } from 'lucide-react';
import { Card, Pill, SectionHeader } from './ui';
import {
  assessFormRisk,
  FORM_RECOMMENDATION_LABEL,
  FORM_RISK_TONE,
} from '../lib/formRiskEngine';
import { store } from '../lib/storage';
import { useStoreVersion } from '../hooks/useStore';

/**
 * Per-exercise form/fatigue risk read. Mounted on the Workout Logger so
 * the user sees what to watch for BEFORE they start the next session.
 *
 * Hides itself when there are zero logs in storage so it doesn't add
 * noise on day 1.
 */
export default function FormRiskPanel() {
  useStoreVersion();
  const logs = useMemo(() => store.getLogs(), []);
  const report = useMemo(() => assessFormRisk(logs), [logs]);

  if (!logs.length || !report.byExercise.length) return null;

  const flagged = report.byExercise.filter((r) => r.level !== 'low');

  return (
    <Card>
      <SectionHeader
        title="Form risk read"
        subtitle="Per-exercise pattern across your last 5 sessions of each lift"
        action={
          <Pill
            tone={
              report.topConcern
                ? FORM_RISK_TONE[report.topConcern.level]
                : flagged.length
                ? 'warning'
                : 'success'
            }
          >
            {flagged.length === 0
              ? 'all clear'
              : `${flagged.length} flagged`}
          </Pill>
        }
      />

      <p className="text-sm text-zinc-300">{report.summary}</p>

      {flagged.length === 0 ? (
        <div className="mt-3 rounded-xl border border-success/30 bg-success/5 p-3 text-xs text-zinc-300">
          <Activity size={12} className="inline mr-1 text-success" />
          Keep going. Soreness, RPE, and missed reps are all in safe territory.
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {flagged.map((r) => (
            <div
              key={r.exerciseName}
              className={`rounded-xl border p-3 ${
                r.level === 'high'
                  ? 'border-danger/40 bg-danger/5'
                  : 'border-warning/40 bg-warning/5'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldAlert
                    size={14}
                    className={r.level === 'high' ? 'text-danger' : 'text-warning'}
                  />
                  <span className="text-sm font-semibold text-zinc-100">
                    {r.exerciseName}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Pill tone={FORM_RISK_TONE[r.level]}>{r.level}</Pill>
                  <Pill>{FORM_RECOMMENDATION_LABEL[r.recommendation]}</Pill>
                </div>
              </div>
              <p className="mt-1.5 text-xs text-zinc-200">{r.rationale}</p>
              {r.flags.length > 0 && (
                <ul className="mt-1.5 space-y-0.5 text-[11px] text-zinc-400">
                  {r.flags.slice(0, 3).map((f, i) => (
                    <li key={i}>• {f}</li>
                  ))}
                </ul>
              )}
              <div className="mt-1.5 text-[10px] text-zinc-500">
                {r.sessionsAnalyzed} sessions · {r.totalWorkingSets} working sets · avg RPE{' '}
                {r.avgRpe || '—'}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
