import { useEffect } from 'react';
import {
  X,
  Target,
  Wrench,
  ListOrdered,
  AlertTriangle,
  Sparkles,
  PlayCircle,
} from 'lucide-react';
import { Pill } from './ui';
import { findExercise } from '../lib/exerciseLibrary';

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
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-8 backdrop-blur-sm md:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="exercise-modal-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-2xl border border-ink-700 bg-ink-900 shadow-card"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 rounded-t-2xl border-b border-ink-800 bg-ink-900/95 px-5 py-4 backdrop-blur">
          <div className="min-w-0">
            <h2
              id="exercise-modal-title"
              className="font-display text-xl font-semibold tracking-tight text-zinc-100"
            >
              {entry?.name ?? exerciseName}
            </h2>
            {entry ? (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Pill tone="accent">
                  <Target size={12} /> {entry.primaryMuscle}
                </Pill>
                {entry.secondaryMuscles.map((m) => (
                  <Pill key={m}>{m}</Pill>
                ))}
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

        <div className="space-y-5 px-5 py-5">
          {/* Video placeholder */}
          <VideoBlock url={entry?.videoUrl} imageUrl={entry?.imageUrl} />

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
              <Section title="Setup" icon={<Wrench size={14} />}>
                <ul className="space-y-1.5 text-sm text-zinc-200">
                  {entry.setupCues.map((c, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-rose-glow" />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </Section>

              <Section title="Form (step by step)" icon={<ListOrdered size={14} />}>
                <ol className="space-y-2 text-sm text-zinc-200">
                  {entry.formCues.map((c, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[11px] font-semibold text-rose-glow">
                        {i + 1}
                      </span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ol>
              </Section>

              <Section title="Common mistakes" icon={<AlertTriangle size={14} />} tone="warning">
                <ul className="space-y-1.5 text-sm text-zinc-200">
                  {entry.commonMistakes.map((m, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-warning" />
                      <span>{m}</span>
                    </li>
                  ))}
                </ul>
              </Section>

              <Section
                title="What you should feel"
                icon={<Sparkles size={14} />}
                tone="accent"
              >
                <p className="text-sm leading-relaxed text-zinc-100">
                  {entry.whatYouShouldFeel}
                </p>
              </Section>
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

function VideoBlock({ url, imageUrl }: { url?: string; imageUrl?: string }) {
  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="group block aspect-video w-full overflow-hidden rounded-xl border border-ink-800 bg-ink-850"
      >
        <div className="relative flex h-full w-full items-center justify-center">
          {imageUrl ? (
            <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80 group-hover:opacity-100" />
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

  return (
    <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-dashed border-ink-700 bg-ink-850 text-zinc-500">
      <div className="text-center">
        <PlayCircle size={28} className="mx-auto mb-1.5 text-zinc-600" />
        <div className="text-xs">Video demo coming soon</div>
        <div className="mt-0.5 text-[10px] text-zinc-600">
          Add a videoUrl to this exercise in the library to enable.
        </div>
      </div>
    </div>
  );
}
