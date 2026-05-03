import { useMemo, useSyncExternalStore } from 'react';
import { Eye, Activity, Salad, ListChecks, ShieldAlert } from 'lucide-react';
import { Card, CoachMessage, Pill, SectionHeader } from './ui';
import { analyzePhotos } from '../lib/photoAnalysis';
import {
  getPhotoSets,
  getPhotoVersion,
  subscribePhotos,
} from '../lib/photoStorage';
import { store } from '../lib/storage';
import { useStoreVersion } from '../hooks/useStore';

export default function PhotoAnalysisPanel() {
  useStoreVersion();
  const photoSets = useSyncExternalStore(subscribePhotos, () => {
    void getPhotoVersion();
    return getPhotoSets();
  });

  const profile = store.getProfile();
  const metrics = store.getMetrics();
  const lastCheckIn = store.getCheckIns()[0];

  const report = useMemo(() => {
    if (!profile) return null;
    return analyzePhotos({ profile, photoSets, metrics, lastCheckIn });
  }, [profile, photoSets, metrics, lastCheckIn]);

  if (!report) return null;

  const tone =
    report.tone === 'positive'
      ? 'success'
      : report.tone === 'caution'
      ? 'warning'
      : 'accent';

  return (
    <Card>
      <SectionHeader
        title="Photo analysis"
        subtitle="Heuristic read — supportive feedback, not the primary signal"
        action={
          report.current ? (
            <Pill tone={tone}>
              {report.baseline ? `${report.daysBetween} d vs baseline` : 'baseline set'}
            </Pill>
          ) : (
            <Pill>no photos yet</Pill>
          )
        }
      />

      <CoachMessage tone="accent" title="What this is" icon={<Eye size={18} />}>
        Photos lag the scale. This panel will not change your workouts or
        macros on its own — your weekly Coach Decision still does that. Use
        this read to make sure photos and the data agree.
      </CoachMessage>

      {report.visibleChanges.length > 0 && (
        <div className="mt-4 rounded-2xl border border-ink-800 bg-ink-850 p-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
            Visible changes
          </div>
          <ul className="mt-2 space-y-1 text-sm text-zinc-200">
            {report.visibleChanges.map((s, i) => (
              <li key={i}>• {s}</li>
            ))}
          </ul>
        </div>
      )}

      {report.postureObservations.length > 0 && (
        <div className="mt-3 rounded-2xl border border-ink-800 bg-ink-850 p-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
            Posture observations
          </div>
          <ul className="mt-2 space-y-1 text-sm text-zinc-200">
            {report.postureObservations.map((s, i) => (
              <li key={i}>• {s}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-success/30 bg-success/5 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-success">
            <Activity size={14} /> Training suggestion
          </div>
          <div className="mt-2 text-sm text-zinc-200">{report.trainingSuggestion}</div>
        </div>
        <div className="rounded-2xl border border-accent/30 bg-accent/5 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-rose-glow">
            <Salad size={14} /> Nutrition suggestion
          </div>
          <div className="mt-2 text-sm text-zinc-200">{report.nutritionSuggestion}</div>
        </div>
      </div>

      {report.areasToKeepTracking.length > 0 && (
        <div className="mt-3 rounded-2xl border border-ink-800 bg-ink-850 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-300">
            <ListChecks size={14} /> Keep tracking
          </div>
          <ul className="mt-2 space-y-1 text-sm text-zinc-200">
            {report.areasToKeepTracking.map((s, i) => (
              <li key={i}>• {s}</li>
            ))}
          </ul>
        </div>
      )}

      {report.whatDataIsStillNeeded.length > 0 && (
        <div className="mt-3 rounded-2xl border border-warning/30 bg-warning/5 p-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-warning">
            What data is still needed
          </div>
          <ul className="mt-2 space-y-1 text-sm text-zinc-200">
            {report.whatDataIsStillNeeded.map((s, i) => (
              <li key={i}>• {s}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 rounded-2xl border border-ink-800 bg-ink-900 p-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-300">
          <ShieldAlert size={14} /> Safety
        </div>
        <ul className="mt-2 space-y-1 text-xs text-zinc-400">
          {report.safetyNotes.map((s, i) => (
            <li key={i}>• {s}</li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
