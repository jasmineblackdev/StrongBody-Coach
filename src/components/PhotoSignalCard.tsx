import { useMemo, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { Camera } from 'lucide-react';
import { Pill } from './ui';
import {
  analyzePhotoIntelligence,
  CONFIDENCE_LABEL,
  TREND_TONE,
} from '../lib/photoIntelligenceEngine';
import { analyzeFemaleFatLoss } from '../lib/femaleFatLossEngine';
import {
  getPhotoSets,
  getPhotoVersion,
  subscribePhotos,
} from '../lib/photoStorage';
import { store } from '../lib/storage';
import { useStoreVersion } from '../hooks/useStore';

/**
 * Compact "Photo signal" card for the Dashboard. One-line read + Progress
 * page link. Hides itself when the user has no photos yet so the dashboard
 * isn't cluttered with "log a photo" prompts forever.
 */
export default function PhotoSignalCard() {
  useStoreVersion();
  const photoSets = useSyncExternalStore(subscribePhotos, () => {
    void getPhotoVersion();
    return getPhotoSets();
  });

  const report = useMemo(() => {
    const femaleReport = analyzeFemaleFatLoss({
      metrics: store.getMetrics(),
      recentLogs: store.getLogs(),
      checkIns: store.getCheckIns(),
    });
    return analyzePhotoIntelligence({
      photoSets,
      metrics: store.getMetrics(),
      checkIns: store.getCheckIns(),
      femaleReport,
    });
  }, [photoSets]);

  if (!photoSets.length) return null;

  const tone = TREND_TONE[report.visualTrend];

  return (
    <Link
      to="/progress"
      className="block rounded-2xl border border-ink-800 bg-ink-850 p-3 text-sm transition hover:border-accent/40"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-rose-glow">
            <Camera size={14} />
          </span>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Photo signal
            </div>
            <div className="truncate text-sm font-semibold text-zinc-100">
              {report.shortHeadline}
            </div>
          </div>
        </div>
        <Pill tone={tone}>{CONFIDENCE_LABEL[report.confidence]}</Pill>
      </div>
    </Link>
  );
}
