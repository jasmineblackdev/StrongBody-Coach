import { useMemo } from 'react';
import { Droplet, ShieldAlert, TrendingDown, Activity, Eye } from 'lucide-react';
import { Card, CoachMessage, Pill, SectionHeader } from './ui';
import {
  analyzeFemaleFatLoss,
  FAT_LOSS_STATE_LABEL,
  type FatLossState,
} from '../lib/femaleFatLossEngine';
import {
  forecastPlateau,
  PLATEAU_LABEL,
  PLATEAU_TONE,
} from '../lib/plateauForecast';
import { computeConfidence } from '../lib/confidenceScoreEngine';
import { assessInjuryRisk } from '../lib/ml/injuryRisk';
import { voiceForFemaleState } from '../lib/coachVoice';
import { getPhotoSets } from '../lib/photoStorage';
import ConfidenceBlock from './ConfidenceBlock';
import { store } from '../lib/storage';
import { useStoreVersion } from '../hooks/useStore';

const STATE_ICON: Record<FatLossState, typeof Droplet> = {
  on_track: TrendingDown,
  water_retention: Droplet,
  false_plateau: ShieldAlert,
  true_plateau: Activity,
  mid_cycle_caution: ShieldAlert,
  hunger_hormonal: Activity,
  losing_too_fast: Eye,
  insufficient_data: Eye,
};

export default function FatLossInsightCard() {
  useStoreVersion();
  const report = useMemo(
    () =>
      analyzeFemaleFatLoss({
        metrics: store.getMetrics(),
        recentLogs: store.getLogs(),
        checkIns: store.getCheckIns(),
      }),
    [],
  );
  const confidence = useMemo(
    () =>
      computeConfidence({
        metrics: store.getMetrics(),
        recentLogs: store.getLogs(),
        checkIns: store.getCheckIns(),
        photoSets: getPhotoSets(),
        femaleReport: report,
        injuryRisk: assessInjuryRisk(store.getLogs()),
      }),
    [report],
  );

  const Icon = STATE_ICON[report.state];
  const voice = voiceForFemaleState(report.state);
  const plateau = useMemo(() => forecastPlateau(store.getMetrics()), []);

  return (
    <Card className={report.tone === 'success' ? 'border-success/30' : 'border-accent/30'}>
      <SectionHeader
        title="Fat Loss Insight (female-aware)"
        subtitle={`Smoothed trend: ${report.smoothed.rate >= 0 ? '+' : ''}${report.smoothed.rate.toFixed(1)} lb/wk · ${report.smoothed.sampleCount} readings in last 14 days`}
        action={
          <div className="flex flex-wrap items-center gap-1.5">
            <Pill tone={report.tone}>
              {FAT_LOSS_STATE_LABEL[report.state]}
            </Pill>
            {report.cyclePhase && (
              <Pill tone="accent">
                {report.cyclePhase}
                {report.cyclePhaseSource === 'inferred' && ' (inferred)'}
              </Pill>
            )}
          </div>
        }
      />

      <CoachMessage tone={report.tone} title={report.headline} icon={<Icon size={18} />}>
        <p>{report.explanation}</p>
        {voice && <p className="mt-2 italic text-zinc-200/90">{voice}</p>}
        <p className="mt-2 font-semibold text-white">→ {report.recommendedAction}</p>
      </CoachMessage>

      <div className="mt-3">
        <ConfidenceBlock report={confidence} />
      </div>

      {/* Plateau forecast — forward-looking advisory. Always renders so
          the user sees the forecast status even when it's "no plateau". */}
      <div className="mt-3 rounded-2xl border border-ink-800 bg-ink-900/40 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-300">
            Plateau forecast
            <Pill tone={PLATEAU_TONE[plateau.status]}>
              {PLATEAU_LABEL[plateau.status]}
            </Pill>
            <Pill>{plateau.confidence}</Pill>
          </div>
          <span className="text-[11px] text-zinc-500">
            {plateau.ratePrior14 !== 0 || plateau.rateLast14 !== 0
              ? `prior 14d ${plateau.ratePrior14 >= 0 ? '+' : ''}${plateau.ratePrior14} → last 14d ${plateau.rateLast14 >= 0 ? '+' : ''}${plateau.rateLast14} lb/wk`
              : ''}
          </span>
        </div>
        <p className="mt-1.5 text-sm font-semibold text-zinc-100">{plateau.headline}</p>
        <p className="mt-0.5 text-xs text-zinc-300">{plateau.recommendation}</p>
        <p className="mt-1.5 text-[11px] text-zinc-500">
          Advisory only — does not override Coach Brain.
        </p>
      </div>

      {report.blockedActions.length > 0 && (
        <div className="mt-3 rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs text-zinc-300">
          <div className="font-semibold uppercase tracking-wider text-warning">
            Coach Brain blocked this week
          </div>
          <ul className="mt-1.5 space-y-0.5">
            {report.blockedActions.map((b) => (
              <li key={b}>• {b.replace(/_/g, ' ')}</li>
            ))}
          </ul>
          <div className="mt-1.5 text-[11px] text-zinc-500">
            The female layer is overriding these to protect against false plateaus.
          </div>
        </div>
      )}

      <details className="mt-3 group rounded-xl border border-ink-800 bg-ink-900/40 p-3">
        <summary className="flex cursor-pointer list-none items-center justify-between text-xs uppercase tracking-wider text-zinc-400">
          <span>How this read was made</span>
          <span className="text-[10px] text-zinc-500 group-open:hidden">Show</span>
          <span className="hidden text-[10px] text-zinc-500 group-open:inline">Hide</span>
        </summary>
        <ul className="mt-3 space-y-1 text-xs text-zinc-300">
          <li>
            • Smoothed weekly change: median of last-week-half vs prior-week-half
            (robust to single-day spikes).
          </li>
          <li>
            • Stable days: {report.smoothed.stableDays} (need ≥ 14 for a true
            plateau call).
          </li>
          <li>
            • Sample count: {report.smoothed.sampleCount} readings in the last
            14 days (need ≥ 7).
          </li>
          <li>
            • Cycle phase:{' '}
            {report.cyclePhase
              ? `${report.cyclePhase} (${report.cyclePhaseSource})`
              : 'not provided — log on weekly check-in to improve the read'}
            .
          </li>
        </ul>
      </details>
    </Card>
  );
}
