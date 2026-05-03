import { useEffect } from 'react';
import {
  X,
  Target,
  Wrench,
  ListOrdered,
  AlertTriangle,
  Sparkles,
  PlayCircle,
  ShieldAlert,
  Wand2,
  Award,
} from 'lucide-react';
import { Pill } from './ui';
import { findExercise, hasJointWarning, type DifficultyLevel } from '../lib/exerciseLibrary';

const DIFFICULTY_LABEL: Record<DifficultyLevel, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

const DIFFICULTY_TONE: Record<DifficultyLevel, 'success' | 'warning' | 'danger'> = {
  beginner: 'success',
  intermediate: 'warning',
  advanced: 'danger',
};

interface Props {
  exerciseName: string;
  onClose: () => void;
}

export default function ExerciseDetailsModal({ exerciseName, onClose }: Props) {
  const entry = findExercise(exerciseName);

  // Close on Escape
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/70 px-0 py-0 backdrop-blur-sm md:items-center md:px-4 md:py-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="exercise-modal-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-2xl flex-col overflow-hidden border border-ink-700 bg-ink-900 shadow-card md:h-auto md:max-h-[90vh] md:rounded-2xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-ink-800 bg-ink-900/95 px-5 py-4">
          <div className="min-w-0">
            <h2
              id="exercise-modal-title"
              className="font-display text-xl font-semibold tracking-tight text-zinc-100"
            >
              {entry?.name ?? exerciseName}
            </h2>
            {entry ? (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {entry.primaryMuscles.map((m) => (
                  <Pill key={m} tone="accent">
                    <Target size={12} /> {m}
                  </Pill>
                ))}
                {entry.secondaryMuscles.map((m) => (
                  <Pill key={m}>{m}</Pill>
                ))}
                <Pill tone={DIFFICULTY_TONE[entry.difficultyLevel]}>
                  <Award size={12} /> {DIFFICULTY_LABEL[entry.difficultyLevel]}
                </Pill>
              </div>
            ) : (
              <p className="muted mt-1 text-xs">Not in the library yet.</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-ink-700 text-zinc-300 hover:bg-ink-800"
          >
            <X size={16} />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {/* Video — only when an actual URL is set; we don't show a "coming
              soon" placeholder anymore. */}
          {entry?.videoUrl && (
            <VideoBlock url={entry.videoUrl} imageUrl={entry.imageUrl} />
          )}

          {!entry ? (
            <div className="rounded-xl border border-ink-800 bg-ink-850 p-4 text-sm text-zinc-300">
              <p>
                I don't have detailed coaching content for{' '}
                <span className="font-semibold text-white">"{exerciseName}"</span> yet.
              </p>
              <p className="mt-2 text-zinc-400">
                The library currently covers main lifts (squat, bench, deadlift), key accessories,
                and core/grip work. Add this exercise to{' '}
                <code className="rounded bg-ink-800 px-1 py-0.5 text-xs">
                  src/lib/exerciseLibrary.ts
                </code>{' '}
                if you want it included.
              </p>
            </div>
          ) : (
            <>
              {/* Universal warning — surfaces for any exercise; emphasized when joints are at risk */}
              <div
                className={`rounded-xl border p-3 text-sm ${
                  hasJointWarning(entry)
                    ? 'border-danger/40 bg-danger/10 text-danger'
                    : 'border-warning/30 bg-warning/10 text-warning'
                }`}
              >
                <div className="flex items-start gap-2">
                  <ShieldAlert size={16} className="mt-0.5 shrink-0" />
                  <div className="text-zinc-100">
                    <span className="font-semibold">Stop if you feel pain outside target muscles.</span>{' '}
                    <span className="text-zinc-300">
                      This is coaching guidance, not medical advice. If something hurts, rack it.
                    </span>
                  </div>
                </div>
              </div>

              {/* Form & Muscle Engagement — the headline section */}
              <Section
                title="Form & muscle engagement"
                icon={<Sparkles size={14} />}
                tone="accent"
              >
                <div className="space-y-3">
                  <div className="rounded-xl border border-success/30 bg-success/10 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wider text-success">
                      What you should feel
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-100">{entry.feel}</p>
                  </div>
                  <div className="rounded-xl border border-danger/30 bg-danger/10 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wider text-danger">
                      What you should NOT feel
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-100">{entry.avoidFeel}</p>
                  </div>
                </div>
              </Section>

              {/* Form steps stay expanded — the active reference during a set. */}
              <Section title="Form (step by step)" icon={<ListOrdered size={14} />}>
                <ol className="space-y-1.5 text-sm text-zinc-200">
                  {entry.formSteps.map((c, i) => (
                    <li key={i} className="flex gap-2.5">
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[11px] font-semibold text-rose-glow">
                        {i + 1}
                      </span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ol>
              </Section>

              {/* Setup — collapsed by default. Mostly prep cues; not needed
                  mid-set. */}
              <CollapsibleSection
                title="Setup"
                icon={<Wrench size={14} />}
                count={entry.setupCues.length}
              >
                <ul className="space-y-1.5 text-sm text-zinc-200">
                  {entry.setupCues.map((c, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-rose-glow" />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </CollapsibleSection>

              {/* Mistakes — collapsed by default. Reach for it only when
                  something feels off. */}
              <CollapsibleSection
                title="Mistakes & quick fixes"
                icon={<AlertTriangle size={14} />}
                tone="warning"
                count={entry.commonMistakes.length}
              >
                <ul className="space-y-2 text-sm text-zinc-200">
                  {entry.commonMistakes.map((m, i) => (
                    <li key={i} className="rounded-xl border border-ink-800 bg-ink-850 p-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle
                          size={14}
                          className="mt-0.5 shrink-0 text-warning"
                        />
                        <div className="font-semibold text-zinc-100">{m}</div>
                      </div>
                      {entry.corrections[i] && (
                        <div className="mt-1.5 flex items-start gap-2 pl-6">
                          <Wand2 size={12} className="mt-1 shrink-0 text-success" />
                          <span className="text-xs text-zinc-300">
                            {entry.corrections[i]}
                          </span>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </CollapsibleSection>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  tone = 'default',
  children,
}: {
  title: string;
  icon: React.ReactNode;
  tone?: 'default' | 'warning' | 'accent';
  children: React.ReactNode;
}) {
  const headerClass =
    tone === 'warning'
      ? 'text-warning'
      : tone === 'accent'
      ? 'text-rose-glow'
      : 'text-zinc-300';
  return (
    <section>
      <h3
        className={`mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider ${headerClass}`}
      >
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * Collapsed-by-default section, native <details>. Click the summary row to
 * expand. Used for sections that are nice to have but not essential during
 * a working set.
 */
function CollapsibleSection({
  title,
  icon,
  tone = 'default',
  count,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  tone?: 'default' | 'warning' | 'accent';
  count?: number;
  children: React.ReactNode;
}) {
  const headerClass =
    tone === 'warning'
      ? 'text-warning'
      : tone === 'accent'
      ? 'text-rose-glow'
      : 'text-zinc-300';
  return (
    <details className="group rounded-xl border border-ink-800 bg-ink-900/40 px-3 py-2.5 transition open:bg-ink-900/60">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider ${headerClass}`}
        >
          {icon}
          {title}
          {typeof count === 'number' && (
            <span className="text-[10px] font-normal normal-case text-zinc-500">
              ({count})
            </span>
          )}
        </span>
        <span className="text-xs text-zinc-500 group-open:hidden">Show</span>
        <span className="hidden text-xs text-zinc-500 group-open:inline">Hide</span>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

function VideoBlock({ url, imageUrl }: { url: string; imageUrl?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="group block aspect-[16/7] w-full overflow-hidden rounded-xl border border-ink-800 bg-ink-850"
    >
      <div className="relative flex h-full w-full items-center justify-center">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-80 group-hover:opacity-100"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-ink-800 to-ink-900" />
        )}
        <div className="relative z-10 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-glow">
          <PlayCircle size={16} /> Watch demo
        </div>
      </div>
    </a>
  );
}
