import { useMemo, useState } from 'react';
import { RefreshCw, ChevronRight, X, Sparkles, Info } from 'lucide-react';
import { Card, CoachMessage, Pill, SectionHeader } from '../components/ui';
import ProposalReview from '../components/ProposalReview';
import ExerciseDetailsModal from '../components/ExerciseDetailsModal';
import { store } from '../lib/storage';
import { useStoreVersion } from '../hooks/useStore';
import { applyChanges, generateProposal } from '../lib/applyAdjustments';
import { buildWeeklyPlan, dayLabel } from '../lib/workoutPlan';
import { findExercise } from '../lib/exerciseLibrary';
import { forecastAllLifts } from '../lib/ml/strengthForecaster';
import { assessInjuryRisk, RISK_TONE } from '../lib/ml/injuryRisk';
import { computeReadiness } from '../lib/recoveryEngine';
import { defaultVolumeFor } from '../lib/workoutPlan';
import GymModeToggle from '../components/GymModeToggle';
import type { PlanProposal, TrainingPhase, WorkoutSession } from '../types';

const VOLUME_LABEL = {
  compact: { label: 'Compact volume', sub: '5–6 exercises/day' },
  standard: { label: 'Standard volume', sub: '7–8 exercises/day' },
  high: { label: 'High volume', sub: '8–9 exercises/day' },
} as const;

const PHASES: TrainingPhase[] = ['hypertrophy', 'strength', 'peak', 'deload'];

export default function WorkoutPlanPage() {
  useStoreVersion();
  const profile = store.getProfile()!;
  const logs = store.getLogs();
  const readiness = useMemo(() => computeReadiness(logs), [logs]);
  const liftForecasts = useMemo(
    () => forecastAllLifts(logs, 5, { recoveryScore: readiness.score }),
    [logs, readiness.score],
  );
  const injuryRisk = useMemo(() => assessInjuryRisk(logs), [logs]);
  const [weekNumber, setWeekNumber] = useState(store.getWeekNumber());
  const [phase, setPhase] = useState<TrainingPhase>(store.getPlan()?.phase ?? 'hypertrophy');
  const [planVersion, setPlanVersion] = useState(0);
  const plan = useMemo(() => {
    const stored = store.getPlan();
    if (stored && stored.weekNumber === weekNumber && stored.phase === phase) {
      return stored;
    }
    return buildWeeklyPlan(profile, weekNumber, phase);
    // planVersion bumps force re-read after accept
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, weekNumber, phase, planVersion]);
  const [openId, setOpenId] = useState<string | null>(plan.sessions[0]?.id ?? null);
  const [activeExercise, setActiveExercise] = useState<string | null>(null);
  const [proposal, setProposal] = useState<PlanProposal | null>(() => {
    const p = store.getProposal();
    if (!p) return null;
    // Stale guard: drop proposals built from a different week than current
    const current = store.getPlan();
    if (current && p.fromWeek !== current.weekNumber) {
      store.clearProposal();
      return null;
    }
    return p;
  });

  function persistAndContinue() {
    store.setPlan(plan);
    store.setWeekNumber(weekNumber);
  }

  const [summary, setSummary] = useState<{ accepted: number; rejected: number } | null>(null);
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);

  function generateCoachPreview() {
    setSummary(null);

    const currentPlan = store.getPlan();
    if (!currentPlan) {
      setPreviewMessage('Save the plan first, then log a workout to get a preview.');
      return;
    }

    const recentLogs = store
      .getLogs()
      .filter((l) => l.weekNumber === currentPlan.weekNumber);

    if (!recentLogs.length) {
      setPreviewMessage(
        `No logs yet for week ${currentPlan.weekNumber} — log a workout first.`,
      );
      return;
    }

    const next = generateProposal({ currentPlan, profile, recentLogs });
    if (!next) {
      // Engine ran but had no actionable changes — clear any stale proposal too.
      store.clearProposal();
      setProposal(null);
      setPreviewMessage('No changes needed right now.');
      return;
    }

    store.setProposal(next);
    setProposal(next);
    setPreviewMessage(null);
  }

  function handleProposalComplete({
    acceptedChanges,
    rejectedChanges,
  }: {
    acceptedChanges: PlanProposal['changes'];
    rejectedChanges: PlanProposal['changes'];
  }) {
    if (!proposal) return;

    if (acceptedChanges.length > 0) {
      const newPlan = applyChanges({
        fromPlan: proposal.fromPlan,
        profile,
        toWeek: proposal.toWeek,
        changes: acceptedChanges,
      });
      store.setPlan(newPlan);
      store.setWeekNumber(proposal.toWeek);
      setWeekNumber(proposal.toWeek);
      setPhase(newPlan.phase);
      setPlanVersion((v) => v + 1);
    }

    store.clearProposal();
    setProposal(null);
    setSummary({ accepted: acceptedChanges.length, rejected: rejectedChanges.length });
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h1">Weekly plan</h1>
          <p className="muted text-sm mt-1">
            Powerlifting structure with bodybuilding-style accessories. 8–9 exercises per session, scaled to your 1RMs.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Pill tone="accent">Week {weekNumber}</Pill>
          <Pill>Phase: {phase}</Pill>
          {(() => {
            const pref = defaultVolumeFor(profile);
            const meta = VOLUME_LABEL[pref];
            return (
              <span
                title="Core moves to cardio/rest days unless safety logic pulls it back in."
                className="inline-flex flex-col items-start rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-[11px] font-semibold text-rose-glow"
              >
                <span>{meta.label}</span>
                <span className="text-[10px] font-normal text-zinc-300">{meta.sub}</span>
              </span>
            );
          })()}
          {injuryRisk.level !== 'low' && (
            <Pill tone={RISK_TONE[injuryRisk.level]}>
              risk: {injuryRisk.level}
            </Pill>
          )}
          <button onClick={generateCoachPreview} className="btn-outline">
            <Sparkles size={16} /> Generate coach preview
          </button>
          <button onClick={persistAndContinue} className="btn-primary">
            <RefreshCw size={16} /> Save plan
          </button>
          <GymModeToggle />
        </div>
      </header>
      <p className="-mt-3 text-[11px] text-zinc-500">
        Core moves to cardio/rest days unless safety logic pulls it back in.
        Adjust volume preference on Profile.
      </p>

      {injuryRisk.level === 'high' && (
        <CoachMessage tone="danger" title={`Injury risk: ${injuryRisk.level}`}>
          {injuryRisk.recommendation}
          {injuryRisk.flags.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-xs opacity-90">
              {injuryRisk.flags.slice(0, 3).map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          )}
        </CoachMessage>
      )}

      {previewMessage && !proposal && (
        <div className="rounded-2xl border border-ink-700 bg-ink-850 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-zinc-200">
              <Sparkles size={14} className="mr-1.5 inline-block text-rose-glow" />
              {previewMessage}
            </div>
            <button
              onClick={() => setPreviewMessage(null)}
              className="inline-flex items-center gap-1 rounded-lg border border-ink-700 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-ink-800"
            >
              <X size={12} /> Dismiss
            </button>
          </div>
        </div>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <span className="label">Week</span>
            <div className="flex items-center gap-2">
              <button className="btn-ghost" onClick={() => setWeekNumber(Math.max(1, weekNumber - 1))}>−</button>
              <div className="w-10 text-center font-display text-lg">{weekNumber}</div>
              <button className="btn-ghost" onClick={() => setWeekNumber(weekNumber + 1)}>+</button>
            </div>
          </div>
          <div>
            <span className="label">Phase</span>
            <div className="flex flex-wrap gap-2">
              {PHASES.map((ph) => (
                <button
                  key={ph}
                  onClick={() => setPhase(ph)}
                  className={`btn ${phase === ph ? 'btn-primary' : 'btn-outline'}`}
                >
                  {ph}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {proposal && (
        <ProposalReview proposal={proposal} onComplete={handleProposalComplete} />
      )}

      {summary && (
        <div className="rounded-2xl border border-success/30 bg-success/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-zinc-100">
              <span className="font-semibold text-white">Review complete.</span>{' '}
              Accepted {summary.accepted} change{summary.accepted === 1 ? '' : 's'}, rejected{' '}
              {summary.rejected} change{summary.rejected === 1 ? '' : 's'}.
              {summary.accepted > 0
                ? ` Your local plan is now Week ${store.getWeekNumber()}.`
                : ' No changes applied — staying on the current plan.'}
            </div>
            <button
              onClick={() => setSummary(null)}
              className="inline-flex items-center gap-1 rounded-lg border border-ink-700 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-ink-800"
            >
              <X size={12} /> Dismiss
            </button>
          </div>
        </div>
      )}

      <CoachMessage>
        {phase === 'deload'
          ? 'Deload week. Loads at 60%, RPE 6 cap, volume cut by a third. Recovery is the prescription.'
          : phase === 'peak'
          ? 'Peak block. Singles and doubles on mains, accessories trimmed. Sleep, food, mental focus.'
          : phase === 'strength'
          ? 'Strength block. Loads heavy, reps low, accessories targeted at your weak points.'
          : 'Hypertrophy block. Building shape and the work capacity that lets us peak hard later. Quality reps.'}
      </CoachMessage>

      <div className="space-y-3">
        {plan.sessions.map((s) => (
          <SessionRow
            key={s.id}
            session={s}
            open={openId === s.id}
            onToggle={() => setOpenId(openId === s.id ? null : s.id)}
            onSelectExercise={setActiveExercise}
            forecasts={liftForecasts}
          />
        ))}
      </div>

      {activeExercise && (
        <ExerciseDetailsModal
          exerciseName={activeExercise}
          prescription={
            plan.sessions
              .flatMap((s) => s.prescriptions)
              .find((p) => p.name === activeExercise) ?? undefined
          }
          phase={plan.phase}
          onClose={() => setActiveExercise(null)}
        />
      )}
    </div>
  );
}

function SessionRow({
  session,
  open,
  onToggle,
  onSelectExercise,
  forecasts,
}: {
  session: WorkoutSession;
  open: boolean;
  onToggle: () => void;
  onSelectExercise: (name: string) => void;
  forecasts: ReturnType<typeof forecastAllLifts>;
}) {
  // Map main-lift prescriptions to their forecast
  function forecastFor(name: string): ReturnType<typeof forecastAllLifts>[keyof ReturnType<typeof forecastAllLifts>] | null {
    if (/back\s*squat|^squat$/i.test(name)) return forecasts.squat;
    if (/bench\s*press|^bench$/i.test(name)) return forecasts.bench;
    if (/conventional\s*deadlift|^deadlift$/i.test(name)) return forecasts.deadlift;
    return null;
  }
  return (
    <div className="card overflow-hidden">
      <button onClick={onToggle} className="flex w-full items-center justify-between text-left">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-display text-lg font-semibold">{dayLabel[session.day]}</span>
            <Pill>{session.prescriptions.length} exercises</Pill>
          </div>
          <div className="muted mt-0.5 text-xs">{session.coachNote}</div>
        </div>
        <ChevronRight size={18} className={`transition ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <div className="mt-4 space-y-2">
          {session.prescriptions.map((p, i) => {
            const hasDetails = Boolean(findExercise(p.name));
            const forecast = forecastFor(p.name);
            return (
              <button
                key={i}
                type="button"
                onClick={() => onSelectExercise(p.name)}
                className="flex w-full flex-col gap-2 rounded-xl border border-ink-800 bg-ink-850 px-3 py-2.5 text-left text-sm transition hover:border-accent/40 hover:bg-ink-800 md:grid md:grid-cols-12 md:items-center md:gap-3"
                title={hasDetails ? 'View exercise details' : 'Open details'}
              >
                <div className="md:col-span-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-zinc-100">{p.name}</span>
                    {hasDetails && (
                      <Info size={12} className="shrink-0 text-rose-glow opacity-80" />
                    )}
                    {forecast && (
                      <span className="text-[10px] uppercase tracking-wide text-rose-glow">
                        · predicted {forecast.nextSessionTarget} lb
                      </span>
                    )}
                  </div>
                  {p.tags?.length ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {p.tags.slice(0, 3).map((t) => (
                        <span key={t} className="text-[10px] uppercase tracking-wide text-zinc-500">
                          #{t}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                {/* Mobile: stats row in a tight 3-up grid; Desktop: each col separately */}
                <div className="grid grid-cols-3 gap-2 text-xs text-zinc-300 md:contents md:text-sm">
                  <div className="md:col-span-2">
                    <span className="md:hidden text-[10px] uppercase tracking-wider text-zinc-500">Sets × Reps</span>
                    <div>
                      {p.sets} × {p.reps}
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <span className="md:hidden text-[10px] uppercase tracking-wider text-zinc-500">Load</span>
                    <div>{p.loadLbs ? `${p.loadLbs} lb` : '—'}</div>
                  </div>
                  <div className="md:col-span-1">
                    <span className="md:hidden text-[10px] uppercase tracking-wider text-zinc-500">Rest</span>
                    <div>{p.restSec}s</div>
                  </div>
                </div>

                {p.notes && (
                  <div className="text-xs text-zinc-400 md:col-span-3">{p.notes}</div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
