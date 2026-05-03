import { useEffect, useState, useSyncExternalStore } from 'react';
import { Camera, Trash2, Calendar } from 'lucide-react';
import { Card, Pill, SectionHeader } from './ui';
import {
  compressImageToDataUrl,
  deletePhoto,
  deleteSet,
  getPhotoSets,
  getPhotoVersion,
  setPhotoNotes,
  subscribePhotos,
  upsertPhoto,
  type PhotoSet,
  type PhotoSlot,
} from '../lib/photoStorage';
import { store } from '../lib/storage';
import { useStoreVersion } from '../hooks/useStore';

const SLOTS: { key: PhotoSlot; label: string }[] = [
  { key: 'front', label: 'Front' },
  { key: 'side', label: 'Side' },
  { key: 'back', label: 'Back' },
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function usePhotoSets(): PhotoSet[] {
  // Reactive subscription so uploads/deletes from anywhere re-render.
  return useSyncExternalStore(subscribePhotos, () => {
    void getPhotoVersion();
    return getPhotoSets();
  });
}

export default function ProgressPhotoPanel() {
  useStoreVersion();
  const sets = usePhotoSets();
  const [activeDate, setActiveDate] = useState<string>(() => sets[0]?.date ?? todayIso());
  const [busy, setBusy] = useState<PhotoSlot | null>(null);

  // Keep the active date pointing at a real set when sets change underneath us.
  useEffect(() => {
    if (!sets.find((s) => s.date === activeDate) && sets[0]) {
      setActiveDate(sets[0].date);
    }
  }, [sets, activeDate]);

  const activeSet = sets.find((s) => s.date === activeDate);

  async function handleUpload(slot: PhotoSlot, file: File | null) {
    if (!file) return;
    setBusy(slot);
    try {
      const dataUrl = await compressImageToDataUrl(file);
      // Snapshot today's weight at the moment of upload so we can anchor
      // the analysis even if the user changes weight later.
      const latestWeight = store.getMetrics()[0]?.weightLbs ?? store.getProfile()?.weightLbs;
      upsertPhoto(activeDate, slot, dataUrl, latestWeight);
    } finally {
      setBusy(null);
    }
  }

  function handleDelete(slot: PhotoSlot) {
    deletePhoto(activeDate, slot);
  }

  function handleDeleteSet(id: string) {
    if (!confirm('Delete this whole photo set?')) return;
    deleteSet(id);
  }

  return (
    <Card>
      <SectionHeader
        title="Progress photos"
        subtitle="Local-only · front / side / back · stored on this device, never uploaded"
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
          const dataUrl = activeSet?.[slot.key];
          return (
            <div
              key={slot.key}
              className="rounded-2xl border border-ink-800 bg-ink-850 p-3"
            >
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                  {slot.label}
                </div>
                {dataUrl && (
                  <button
                    onClick={() => handleDelete(slot.key)}
                    className="text-zinc-500 hover:text-danger"
                    aria-label={`Delete ${slot.label} photo`}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              <label className="mt-2 block aspect-[3/4] cursor-pointer overflow-hidden rounded-xl border border-dashed border-ink-700 bg-ink-900">
                {dataUrl ? (
                  <img
                    src={dataUrl}
                    alt={`${slot.label} on ${activeDate}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-zinc-500">
                    <Camera size={20} />
                    <span className="text-xs">
                      {busy === slot.key ? 'Compressing…' : 'Add photo'}
                    </span>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) =>
                    handleUpload(slot.key, e.target.files?.[0] ?? null)
                  }
                />
              </label>

              {dataUrl && (
                <label className="mt-2 block cursor-pointer text-center text-xs text-accent-soft hover:text-accent">
                  Replace
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) =>
                      handleUpload(slot.key, e.target.files?.[0] ?? null)
                    }
                  />
                </label>
              )}
            </div>
          );
        })}
      </div>

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

      <div className="mt-4 text-xs text-zinc-500">
        Photos live in this browser only. Use Export / Import on Profile to back
        up everything (including photos in the JSON).
      </div>
    </Card>
  );
}
