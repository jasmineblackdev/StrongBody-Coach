import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  Camera,
  Trash2,
  Calendar,
  Save,
  X,
  Sparkles,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Card, Pill, SectionHeader } from './ui';
import {
  compressImageToDataUrl,
  deletePhoto,
  deleteSet,
  getPhotoSets,
  getPhotoVersion,
  setPhotoNotes,
  setPhotoAnalysis,
  clearPhotoAnalysis,
  subscribePhotos,
  upsertPhoto,
  type PhotoSet,
  type PhotoSlot,
} from '../lib/photoStorage';
import { store } from '../lib/storage';
import { useStoreVersion } from '../hooks/useStore';
import { analyzePhotoSet, type PhotoAnalysis } from '../lib/photoAnalysis';
import { exerciseLibrary } from '../lib/exerciseLibrary';

const SLOTS: { key: PhotoSlot; label: string }[] = [
  { key: 'front', label: 'Front' },
  { key: 'side', label: 'Side' },
  { key: 'back', label: 'Back' },
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function usePhotoSets(): PhotoSet[] {
  return useSyncExternalStore(subscribePhotos, () => {
    void getPhotoVersion();
    return getPhotoSets();
  });
}

type Staged = Partial<Record<PhotoSlot, string>>;

export default function ProgressPhotoPanel() {
  useStoreVersion();
  const sets = usePhotoSets();
  const [activeDate, setActiveDate] = useState<string>(
    () => sets[0]?.date ?? todayIso(),
  );

  // Photos the user has picked but not yet committed to storage. Kept
  // separate from PhotoSet so the user can preview / discard / replace
  // before pressing Save.
  const [staged, setStaged] = useState<Staged>({});
  const [busySlot, setBusySlot] = useState<PhotoSlot | null>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);

  // Keep the active date pointing at a real set when sets change underneath us.
  useEffect(() => {
    if (!sets.find((s) => s.date === activeDate) && sets[0] && !hasStaged(staged)) {
      setActiveDate(sets[0].date);
    }
  }, [sets, activeDate, staged]);

  // Drop staged photos when navigating to a different date — otherwise an
  // unsaved photo silently follows the user and lands on the wrong set.
  useEffect(() => {
    setStaged({});
    setAnalyzeError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDate]);

  const activeSet = sets.find((s) => s.date === activeDate);
  const hasStagedChanges = hasStaged(staged);

  // Treat each slot's display source as: staged photo (if present) →
  // committed photo (from PhotoSet) → none.
  function sourceFor(slot: PhotoSlot): string | undefined {
    return staged[slot] ?? activeSet?.[slot];
  }

  async function handlePick(slot: PhotoSlot, file: File | null) {
    if (!file) return;
    setBusySlot(slot);
    try {
      const dataUrl = await compressImageToDataUrl(file);
      setStaged((s) => ({ ...s, [slot]: dataUrl }));
    } finally {
      setBusySlot(null);
    }
  }

  function handleDiscardStaged(slot: PhotoSlot) {
    setStaged((s) => {
      const next = { ...s };
      delete next[slot];
      return next;
    });
  }

  function handleDiscardAll() {
    setStaged({});
  }

  function handleSave() {
    const latestWeight =
      store.getMetrics()[0]?.weightLbs ?? store.getProfile()?.weightLbs;
    SLOTS.forEach(({ key }) => {
      const dataUrl = staged[key];
      if (dataUrl) {
        upsertPhoto(activeDate, key, dataUrl, latestWeight);
      }
    });
    setStaged({});
    // Saving fresh photos invalidates any prior analysis.
    if (activeSet?.analysis) clearPhotoAnalysis(activeDate);
  }

  function handleDeleteCommitted(slot: PhotoSlot) {
    deletePhoto(activeDate, slot);
  }

  function handleDeleteSet(id: string) {
    if (!confirm('Delete this whole photo set?')) return;
    deleteSet(id);
  }

  async function handleAnalyze() {
    if (!activeSet) return;
    setAnalyzeError(null);
    setAnalyzeProgress(0);
    setAnalyzing(true);
    try {
      const profile = store.getProfile();
      // Library names give the model a real menu to recommend from.
      const availableExercises = exerciseLibrary.map((e) => e.name);
      const result = await analyzePhotoSet({
        set: activeSet,
        profile,
        availableExercises,
        onProgress: (bytes) => setAnalyzeProgress(bytes),
      });
      setPhotoAnalysis(activeDate, result);
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : 'Analyze failed');
    } finally {
      setAnalyzing(false);
    }
  }

  const committedCount = useMemo(
    () =>
      activeSet
        ? SLOTS.filter((s) => Boolean(activeSet[s.key])).length
        : 0,
    [activeSet],
  );
  const canAnalyze = committedCount > 0 && !hasStagedChanges && !analyzing;

  return (
    <Card>
      <SectionHeader
        title="Progress photos"
        subtitle="Front / side / back · stored on this device · sent to AI only when you tap Analyze"
        action={
          <Pill tone="accent">
            <Camera size={12} /> {sets.length} set{sets.length === 1 ? '' : 's'}
          </Pill>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="label flex items-center gap-1.5">
            <Calendar size={12} /> Photo set date
          </span>
          <input
            type="date"
            className="input"
            value={activeDate}
            max={todayIso()}
            onChange={(e) => setActiveDate(e.target.value || todayIso())}
          />
        </label>
        {sets.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {sets.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveDate(s.date)}
                className={`btn ${
                  s.date === activeDate ? 'btn-primary' : 'btn-outline'
                }`}
              >
                {s.date}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {SLOTS.map((slot) => {
          const src = sourceFor(slot.key);
          const isStaged = Boolean(staged[slot.key]);
          const isCommitted = !isStaged && Boolean(activeSet?.[slot.key]);
          return (
            <div
              key={slot.key}
              className={`rounded-2xl border p-3 ${
                isStaged
                  ? 'border-accent/60 bg-accent/5'
                  : 'border-ink-800 bg-ink-850'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                  {slot.label}
                  {isStaged && (
                    <span className="ml-2 text-rose-glow">· unsaved</span>
                  )}
                </div>
                {isStaged && (
                  <button
                    onClick={() => handleDiscardStaged(slot.key)}
                    className="text-zinc-500 hover:text-danger"
                    aria-label={`Discard staged ${slot.label} photo`}
                  >
                    <X size={14} />
                  </button>
                )}
                {isCommitted && (
                  <button
                    onClick={() => handleDeleteCommitted(slot.key)}
                    className="text-zinc-500 hover:text-danger"
                    aria-label={`Delete ${slot.label} photo`}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              <label className="mt-2 block aspect-[3/4] cursor-pointer overflow-hidden rounded-xl border border-dashed border-ink-700 bg-ink-900">
                {src ? (
                  <img
                    src={src}
                    alt={`${slot.label} on ${activeDate}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-zinc-500">
                    <Camera size={20} />
                    <span className="text-xs">
                      {busySlot === slot.key ? 'Compressing…' : 'Add photo'}
                    </span>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) =>
                    handlePick(slot.key, e.target.files?.[0] ?? null)
                  }
                />
              </label>

              {src && (
                <label className="mt-2 block cursor-pointer text-center text-xs text-accent-soft hover:text-accent">
                  Replace
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) =>
                      handlePick(slot.key, e.target.files?.[0] ?? null)
                    }
                  />
                </label>
              )}
            </div>
          );
        })}
      </div>

      {/* Save / Discard staged photos */}
      {hasStagedChanges && (
        <div className="mt-3 flex items-center justify-between rounded-xl border border-accent/40 bg-accent/5 px-3 py-2.5">
          <div className="text-xs text-zinc-200">
            <span className="font-semibold text-rose-glow">Unsaved photos</span>
            {' · '}
            {Object.keys(staged).length} new {Object.keys(staged).length === 1 ? 'image' : 'images'}
          </div>
          <div className="flex gap-2">
            <button onClick={handleDiscardAll} className="btn btn-outline">
              <X size={14} /> Discard
            </button>
            <button onClick={handleSave} className="btn btn-primary">
              <Save size={14} /> Save photos
            </button>
          </div>
        </div>
      )}

      {activeSet && (
        <div className="mt-4">
          <label className="block">
            <span className="label">Notes (optional)</span>
            <input
              className="input"
              placeholder="e.g., morning, fasted, same lighting as last set"
              value={activeSet.notes ?? ''}
              onChange={(e) => setPhotoNotes(activeDate, e.target.value)}
            />
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            {activeSet.weightLbs && (
              <Pill>{activeSet.weightLbs.toFixed(1)} lb at upload</Pill>
            )}
            <button
              onClick={() => handleDeleteSet(activeSet.id)}
              className="text-zinc-500 hover:text-danger"
            >
              Delete this set
            </button>
          </div>
        </div>
      )}

      {/* AI analysis */}
      {activeSet && (
        <div className="mt-5 rounded-2xl border border-ink-800 bg-ink-850 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent-soft">
                <Sparkles size={12} /> AI photo analysis
              </div>
              <p className="mt-1 text-xs text-zinc-400">
                Looks at this set, identifies muscle groups to focus on, and
                recommends specific exercises. Photos are sent to the model
                once per click — never stored.
              </p>
            </div>
            <button
              onClick={handleAnalyze}
              disabled={!canAnalyze}
              className="btn btn-primary shrink-0"
              title={
                hasStagedChanges
                  ? 'Save photos first'
                  : committedCount === 0
                  ? 'Add at least one photo first'
                  : ''
              }
            >
              {analyzing ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  {analyzeProgress > 0
                    ? `Writing… ${analyzeProgress}`
                    : 'Analyzing…'}
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  {activeSet.analysis ? 'Re-analyze' : 'Analyze'}
                </>
              )}
            </button>
          </div>

          {analyzeError && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-danger/40 bg-danger/10 p-3 text-xs text-zinc-200">
              <AlertCircle size={14} className="mt-0.5 shrink-0 text-danger" />
              <div>
                <div className="font-semibold text-danger">Analyze failed</div>
                <div>{analyzeError}</div>
              </div>
            </div>
          )}

          {activeSet.analysis && (
            <PhotoAnalysisDisplay analysis={activeSet.analysis} />
          )}
        </div>
      )}

      <div className="mt-4 text-xs text-zinc-500">
        Photos live in this browser only. Analysis text is cached on the set.
        Use Export / Import on Profile to back up everything.
      </div>
    </Card>
  );
}

function PhotoAnalysisDisplay({ analysis }: { analysis: PhotoAnalysis }) {
  const sortedFocus = useMemo(() => {
    const order = { high: 0, medium: 1, low: 2 } as const;
    return [...analysis.focusAreas].sort(
      (a, b) => order[a.priority] - order[b.priority],
    );
  }, [analysis.focusAreas]);

  return (
    <div className="mt-4 space-y-4">
      {analysis.summary && (
        <p className="text-sm leading-relaxed text-zinc-100">
          {analysis.summary}
        </p>
      )}

      {analysis.whatsWorking && (
        <div className="rounded-xl border border-success/30 bg-success/5 p-3">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-success">
            What's working
          </div>
          <p className="text-sm leading-snug text-zinc-200">
            {analysis.whatsWorking}
          </p>
        </div>
      )}

      {sortedFocus.length > 0 && (
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
            Focus areas
          </div>
          <ul className="space-y-2">
            {sortedFocus.map((f, i) => (
              <li
                key={`${f.area}-${i}`}
                className="rounded-xl border border-ink-800 bg-ink-900 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-zinc-100">
                    {f.area}
                  </span>
                  <Pill
                    tone={
                      f.priority === 'high'
                        ? 'danger'
                        : f.priority === 'medium'
                        ? 'warning'
                        : 'success'
                    }
                  >
                    {f.priority}
                  </Pill>
                </div>
                {f.rationale && (
                  <p className="mt-1 text-xs leading-snug text-zinc-300">
                    {f.rationale}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {analysis.exerciseRecommendations.length > 0 && (
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
            Recommended exercises
          </div>
          <ul className="space-y-2">
            {analysis.exerciseRecommendations.map((e, i) => (
              <li
                key={`${e.name}-${i}`}
                className="rounded-xl border border-ink-800 bg-ink-900 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-zinc-100">
                    {e.name}
                  </span>
                  <span className="text-xs text-zinc-400">
                    {e.sets} × {e.reps}
                  </span>
                </div>
                {e.rationale && (
                  <p className="mt-1 text-xs leading-snug text-zinc-300">
                    {e.rationale}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {analysis.caveats && (
        <p className="text-[11px] italic leading-snug text-zinc-500">
          {analysis.caveats}
        </p>
      )}

      <p className="text-[10px] text-zinc-600">
        Analyzed {new Date(analysis.analyzedAt).toLocaleString()} · model{' '}
        {analysis.model}
      </p>
    </div>
  );
}

function hasStaged(s: Staged): boolean {
  return Boolean(s.front || s.side || s.back);
}
