import { useEffect, useMemo, useState } from 'react';
import { X, Search, Check, Replace, Eye } from 'lucide-react';
import { Pill } from './ui';
import { exerciseLibrary, findExercise } from '../lib/exerciseLibrary';
import { explainPrescription } from '../lib/trainerPrescription';
import { detectWeakPoints } from '../lib/weakPoints';
import { store } from '../lib/storage';
import type { ExercisePrescription, TrainingPhase } from '../types';

interface Props {
  /** The current prescription being swapped out. */
  current: ExercisePrescription;
  phase: TrainingPhase;
  onClose: () => void;
  /** Replace the current prescription with a new exercise name. */
  onSelect: (newName: string) => void;
}

/**
 * Swap modal — search the exercise library + tap a row to replace the
 * current exercise in the active workout log.
 *
 * Three sections, top to bottom:
 *   1. Smart alternates  (3–4 contextual swaps from trainerPrescription)
 *   2. Search input      (filters the library by name + muscle)
 *   3. Browse list       (full library, deduped + sorted by primary muscle)
 *
 * Tap any row → onSelect(name) → modal closes → caller updates the
 * exercise in its local prescriptions state. The plan in storage stays
 * unchanged; the swap only affects this session's log.
 */
export default function SwapExerciseModal({
  current,
  phase,
  onClose,
  onSelect,
}: Props) {
  const [query, setQuery] = useState('');

  // Close on Escape + lock body scroll
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  // Smart alternates from the trainer rationale
  const alternates = useMemo(() => {
    const profile = store.getProfile();
    if (!profile) return [];
    const weakPoints = detectWeakPoints(store.getLogs());
    const rationale = explainPrescription(current, { profile, phase, weakPoints });
    return rationale.alternates;
  }, [current, phase]);

  // Muscle-overlap filter so the swap list only shows exercises that
  // train the same muscles as the one being swapped out. Without this
  // filter, swapping Back Squat surfaced Bench Press / Pallof Press /
  // Dead Bug — irrelevant for someone who needs a squat alternative.
  //
  // Strategy: take the current exercise's PRIMARY muscles (lowercased)
  // and match candidates whose primary OR secondary muscles include
  // any of those tokens. When the current exercise isn't in the
  // library (e.g., a custom or already-swapped name), fall back to
  // showing all exercises so the user isn't dead-ended.
  const targetMuscles = useMemo(() => {
    const entry = findExercise(current.name);
    if (!entry) return null;
    return new Set(entry.primaryMuscles.map((m) => m.toLowerCase()));
  }, [current.name]);

  // Library list — exclude the current exercise + filter by muscle
  // overlap + filter by query
  const libraryRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exerciseLibrary
      .filter((e) => e.name !== current.name)
      .filter((e) => {
        // Muscle filter — skip when the current exercise isn't in the
        // library (no muscles to compare against). Otherwise require at
        // least one shared primary muscle.
        if (!targetMuscles) return true;
        const candidateMuscles = [
          ...e.primaryMuscles,
          ...e.secondaryMuscles,
        ].map((m) => m.toLowerCase());
        return candidateMuscles.some((m) => targetMuscles.has(m));
      })
      .filter((e) => {
        if (!q) return true;
        if (e.name.toLowerCase().includes(q)) return true;
        if (e.aliases?.some((a) => a.toLowerCase().includes(q))) return true;
        if (e.primaryMuscles.some((m) => m.toLowerCase().includes(q))) return true;
        if (e.secondaryMuscles.some((m) => m.toLowerCase().includes(q))) return true;
        return false;
      })
      .slice(0, 50);
  }, [current.name, query, targetMuscles]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/70 px-0 py-0 backdrop-blur-sm md:items-center md:px-4 md:py-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="swap-modal-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-xl flex-col overflow-hidden border border-ink-700 bg-ink-900 shadow-card md:h-auto md:max-h-[90vh] md:rounded-2xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-ink-800 bg-ink-900/95 px-5 py-4">
          <div className="min-w-0">
            <h2
              id="swap-modal-title"
              className="font-display text-lg font-bold tracking-tight text-zinc-100"
            >
              Swap exercise
            </h2>
            <p className="mt-1 text-xs text-zinc-400">
              Replacing <span className="text-zinc-200 font-semibold">{current.name}</span> in this session.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-ink-700 text-zinc-300 hover:bg-ink-800"
          >
            <X size={16} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {/* Smart alternates */}
          {alternates.length > 0 && (
            <section className="mb-5">
              <div className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-rose-glow">
                <Replace size={12} /> Trainer suggestions
              </div>
              <ul className="space-y-2">
                {alternates.slice(0, 4).map((a) => (
                  <li key={a.name}>
                    <button
                      onClick={() => {
                        onSelect(a.name);
                        onClose();
                      }}
                      className="block w-full rounded-xl border border-accent/30 bg-accent/5 p-3 text-left transition active:scale-[0.99] hover:bg-accent/10"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-zinc-100">{a.name}</span>
                        <Check size={14} className="text-rose-glow" />
                      </div>
                      <p className="mt-1 text-xs text-zinc-300 leading-snug">{a.reason}</p>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Search */}
          <section>
            <div className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-300">
              <Eye size={12} /> Same muscle group
            </div>
            {targetMuscles && (
              <div className="mb-2 flex flex-wrap gap-1">
                {Array.from(targetMuscles).map((m) => (
                  <Pill key={m} tone="accent">
                    {m}
                  </Pill>
                ))}
              </div>
            )}
            <label className="relative mb-3 block">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search within these muscles"
                className="input pl-9"
                autoFocus
              />
            </label>

            {libraryRows.length === 0 ? (
              <p className="rounded-xl border border-ink-800 bg-ink-850 p-4 text-center text-xs text-zinc-500">
                {query
                  ? `No matches for "${query}" within the same muscle group.`
                  : "No matching alternatives in the library yet — try the trainer suggestions above."}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {libraryRows.map((e) => (
                  <li key={e.name}>
                    <button
                      onClick={() => {
                        onSelect(e.name);
                        onClose();
                      }}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-ink-800 bg-ink-850 px-3 py-2.5 text-left transition active:scale-[0.99] hover:border-accent/40 hover:bg-ink-800"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-zinc-100">
                          {e.name}
                        </div>
                        <div className="truncate text-[11px] text-zinc-400">
                          {e.primaryMuscles.join(' · ')}
                        </div>
                      </div>
                      <Pill
                        tone={
                          e.difficultyLevel === 'advanced'
                            ? 'danger'
                            : e.difficultyLevel === 'intermediate'
                            ? 'warning'
                            : 'success'
                        }
                      >
                        {e.difficultyLevel}
                      </Pill>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-3 text-[11px] text-zinc-500">
              The swap only changes this session's log. Your weekly plan is untouched —
              edit on /plan if you want a permanent change.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
