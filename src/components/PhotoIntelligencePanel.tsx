import { useMemo, useSyncExternalStore } from 'react';
import {
  Eye,
  ListChecks,
  ShieldAlert,
  Sparkles,
  Activity,
} from 'lucide-react';
import { Card, CoachMessage, Pill, SectionHeader } from './ui';
import {
  analyzePhotoIntelligence,
  CONFIDENCE_LABEL,
  TREND_LABEL,
  TREND_TONE,
} from '../lib/photoIntelligenceEngine';
import { analyzeFemaleFatLoss } from '../lib/femaleFatLossEngine';
import { computeConfidence } from '../lib/confidenceScoreEngine';
import { assessInjuryRisk } from '../lib/ml/injuryRisk';
import ConfidenceBlock from './ConfidenceBlock';
import {
  getPhotoSets,
  getPhotoVersion,
  subscribePhotos,
} from '../lib/photoStorage';
import { store } from '../lib/storage';
import { useStoreVersion } from '../hooks/useStore';

export default function PhotoIntelligencePanel() {
  useStoreVersion();
  const photoSets = useSyncExternalStore(subscribePhotos, () => {
    void getPhotoVersion();
    return getPhotoSets();
  });

  const metrics = store.getMetrics();
  const checkIns = store.getCheckIns();
  const logs = store.getLogs();

  const { report, confidence } = useMemo(() => {
    const femaleReport = analyzeFemaleFatLoss({
      metrics,
      recentLogs: logs,
      checkIns,
    });
    const photoReport = analyzePhotoIntelligence({
      photoSets,
      metrics,
      checkIns,
      femaleReport,
    });
    const conf = computeConfidence({
      metrics,
      recentLogs: logs,
      checkIns,
      photoSets,
      femaleReport,
      injuryRisk: assessInjuryRisk(logs),
    });
    return { report: photoReport, confidence: conf };
  }, [photoSets, metrics, checkIns, logs]);

  const tone = TREND_TONE[report.visualTrend];

  return (
    <Card>
      <SectionHeader
        title="Photo Intelligence"
        subtitle={
          report.latestSetDate && report.previousSetDate
            ? `${report.previousSetDate} → ${report.latestSetDate} · ${report.daysBetween} days`
            : 'Supportive evidence — never the primary signal'
        }
        action={
          <div className="flex flex-wrap items-center gap-1.5">
            <Pill tone={tone}>{TREND_LABEL[report.visualTrend]}</Pill>
            <Pill>{CONFIDENCE_LABEL[report.confidence]}</Pill>
            {report.waterRetentionFlagged && (
              <Pill tone="warning">water retention</Pill>
            )}
          </div>
        }
      />

      <CoachMessage tone={tone} title={report.shortHeadline} icon={<Sparkles size={18} />}>
        <p>{report.recommendation}</p>
      </CoachMessage>

      <div className="mt-3">
        <ConfidenceBlock report={confidence} showDetails={false} />
      </div>

      {/* Measurement deltas — anchored on data, not on the photos */}
      {(report.weightDeltaLbs !== null || report.waistDeltaIn !== null) && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-ink-800 bg-ink-850 p-3">
            <div className="text-[11px] uppercase tracking-wider text-zinc-500">
              Weight delta
            </div>
            <div className="mt-1 font-display text-lg font-semibold text-zinc-100">
              {report.weightDeltaLbs === null
                ? '—'
                : `${report.weightDeltaLbs > 0 ? '+' : ''}${report.weightDeltaLbs.toFixed(1)} lb`}
            </div>
          </div>
          <div className="rounded-xl border border-ink-800 bg-ink-850 p-3">
            <div className="text-[11px] uppercase tracking-wider text-zinc-500">
              Waist delta
            </div>
            <div className="mt-1 font-display text-lg font-semibold text-zinc-100">
              {report.waistDeltaIn === null
                ? '—'
                : `${report.waistDeltaIn > 0 ? '+' : ''}${report.waistDeltaIn.toFixed(2)} in`}
            </div>
          </div>
        </div>
      )}

      {/* Observations */}
      {report.observations.length > 0 && (
        <div className="mt-3 rounded-2xl border border-ink-800 bg-ink-850 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-300">
            <Eye size={12} /> Observations
          </div>
          <ul className="mt-2 space-y-1 text-sm text-zinc-200">
            {report.observations.map((s, i) => (
              <li key={i}>• {s}</li>
            ))}
          </ul>
        </div>
      )}

      {/* What to do */}
      <div className="mt-3 rounded-2xl border border-accent/30 bg-accent/5 p-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-rose-glow">
          <ListChecks size={12} /> Recommended action
        </div>
        <p className="mt-1.5 text-sm text-zinc-200">{report.recommendation}</p>
      </div>

      {/* Cross-engine signals */}
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-ink-800 bg-ink-900/40 p-3 text-xs text-zinc-300">
          <div className="flex items-center gap-1.5 font-semibold uppercase tracking-wider text-zinc-300">
            <Activity size={12} /> Female layer
          </div>
          <p className="mt-1 text-zinc-400">
            {report.waterRetentionFlagged
              ? 'Water retention currently flagged — photos that look heavier are likely masked, not real.'
              : 'No water-retention flag right now. Photo signal is not being masked by hormonal noise.'}
          </p>
        </div>
        <div className="rounded-xl border border-ink-800 bg-ink-900/40 p-3 text-xs text-zinc-300">
          <div className="flex items-center gap-1.5 font-semibold uppercase tracking-wider text-zinc-300">
            <Eye size={12} /> Self-reported
          </div>
          <p className="mt-1 text-zinc-400">
            {report.selfReportedSignal
              ? `On your last check-in: ${report.selfReportedSignal.replace(/_/g, ' ')}.`
              : 'No self-report on this week\'s photos. Add it on the next /check-in for a stronger read.'}
          </p>
        </div>
      </div>

      {/* Safety — always present */}
      <div className="mt-3 rounded-2xl border border-ink-800 bg-ink-900 p-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-300">
          <ShieldAlert size={12} /> Safety
        </div>
        <p className="mt-1.5 text-xs text-zinc-400">{report.safetyNote}</p>
      </div>
    </Card>
  );
}
