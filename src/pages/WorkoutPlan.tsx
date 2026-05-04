import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, X, Sparkles, Heart, Activity, Play } from 'lucide-react';
import { Card, Pill } from '../components/ui';
import ProposalReview from '../components/ProposalReview';
import ExerciseDetailsModal from '../components/ExerciseDetailsModal';
import { store } from '../lib/storage';
import { useStoreVersion } from '../hooks/useStore';
import { applyChanges, generateProposal } from '../lib/applyAdjustments';
import { buildWeeklyPlan, defaultVolumeFor } from '../lib/workoutPlan';
import { findExercise } from '../lib/exerciseLibrary';
import { assessInjuryRisk, RISK_TONE } from '../lib/ml/injuryRisk';
import { getAllHomeSessions } from '../lib/coreCardioPlan';
import GymModeToggle from '../components/GymModeToggle';
import WeekCalendar, { buildCalendarDays } from '../components/WeekCalendar';
import type { PlanProposal, TrainingPhase } from '../types';

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
  // Calendar selection — defaults to today's day-of-week so the user
  // always lands on the relevant card. -1 sentinel until first compute.
  const [selectedDow, setSelectedDow] = useState<number>(() => new Date().getDay());
  const [activeExercise, setActiveExercise] = useState<string | null>(null);

  const homeSessions = useMemo(
    () =>
      getAllHomeSessions({
        profile,
        weekNumber,
        recentLogs: logs,
      }),
    [profile, weekNumber, logs],
  );

  const calendarDays = useMemo(
    () =>
      buildCalendarDays({
        liftSessions: plan.sessions,
        homeSessions,
      }),
    [plan, homeSessions],
  );

  const selectedDay =
    calendarDays.find((d) => d.dow === selectedDow) ?? calendarDays[0];
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

  const phaseChip = phase[0].toUpperCase() + phase.slice(1);

  return (
    <div className="space-y-4">
      {/* Slim header — title + week stepper + chips, no paragraphs. */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="h1">Schedule</h1>
          <div className="flex items-center gap-1">
            <button
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ink-700 text-zinc-300 hover:bg-ink-800"
              onClick={() => setWeekNumber(Math.max(1, weekNumber - 1))}
              aria-label="Previous week"
            >
              −
            </button>
            <div className="min-w-[68px] text-center text-sm font-bold text-zinc-100">
              Week {weekNumber}
            </div>
            <button
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ink-700 text-zinc-300 hover:bg-ink-800"
              onClick={() => setWeekNumber(weekNumber + 1)}
              aria-label="Next week"
            >
              +
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={generateCoachPreview}
            className="inline-flex items-center gap-1.5 rounded-xl border border-ink-700 bg-ink-850 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-ink-800"
          >
            <Sparkles size={14} /> Preview
          </button>
          <button
            onClick={persistAndContinue}
            className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-xs font-bold text-white shadow-glow"
          >
            <RefreshCw size={14} /> Save
          </button>
          <GymModeToggle />
        </div>
      </header>

      {/* Status chips — replace the long phase + injury paragraphs.
          Each chip is one short claim; tap-to-expand panels are gone. */}
      <div className="flex flex-wrap gap-2">
        <Pill tone="accent">{phaseChip} block</Pill>
        <Pill>{VOLUME_LABEL[defaultVolumeFor(profile)].label}</Pill>
        {injuryRisk.level !== 'low' && (
          <Pill tone={RISK_TONE[injuryRisk.level]}>
            {injuryRisk.level === 'high' ? 'High Risk' : 'Watch RPE'}
          </Pill>
        )}
        {phase === 'deload' && <Pill tone="warning">Recovery focus</Pill>}
        {phase === 'peak' && <Pill tone="danger">Peak — heavy</Pill>}
        <div className="flex flex-wrap gap-2">
          {PHASES.map((ph) => (
            <button
              key={ph}
              onClick={() => setPhase(ph)}
              className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition ${
                phase === ph
                  ? 'border-accent/40 bg-accent/15 text-rose-glow'
                  : 'border-ink-700 bg-ink-850 text-zinc-400 hover:bg-ink-800'
              }`}
            >
              {ph}
            </button>
          ))}
        </div>
      </div>

      {/* Inline messages — surfaced only when active */}
      {previewMessage && !proposal && (
        <div className="rounded-xl border border-ink-700 bg-ink-850 p-3 text-sm text-zinc-200">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              <Sparkles size={14} className="mr-1.5 inline-block text-rose-glow" />
              {previewMessage}
            </span>
            <button
              onClick={() => setPreviewMessage(null)}
              className="text-xs text-zinc-400 hover:text-zinc-100"
              aria-label="Dismiss"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      {proposal && <ProposalReview proposal={proposal} onComplete={handleProposalComplete} />}

      {summary && (
        <div className="rounded-xl border border-success/30 bg-success/10 p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              Accepted {summary.accepted}, rejected {summary.rejected}.
            </span>
            <button onClick={() => setSummary(null)} className="text-xs text-zinc-300">
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      {/* The calendar — primary navigation */}
      <WeekCalendar days={calendarDays} selectedDow={selectedDow} onSelect={setSelectedDow} />

      {/* Selected day detail — single card, focused */}
      {selectedDay && (
        <Card className={selectedDay.isToday ? 'border-accent/30' : ''}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                {selectedDay.longLabel}
                {selectedDay.isToday && (
                  <span className="ml-1 text-rose-glow">· today</span>
                )}
              </div>
              <div className="mt-0.5 font-display text-xl font-bold text-zinc-100">
                {selectedDay.typeLabel}
              </div>
              {selectedDay.hasSession && (
                <div className="mt-1 text-xs text-zinc-400">
                  {selectedDay.exerciseCount} exercises · ~{selectedDay.estimatedMinutes} min
                </div>
              )}
            </div>
            {selectedDay.isToday && selectedDay.hasSession && (
              <Link
                to="/log"
                className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white shadow-glow active:scale-95"
              >
                <Play size={14} /> Start
              </Link>
            )}
          </div>

          {/* Lift session detail */}
          {selectedDay.liftSession && (
            <div className="mt-4 space-y-2">
              {selectedDay.liftSession.prescriptions.map((p) => {
                const hasDetails = !!findExercise(p.name);
                return (
                  <button
                    key={p.name}
                    onClick={() => setActiveExercise(p.name)}
                    className="flex w-full flex-col gap-1 rounded-xl border border-ink-800 bg-ink-850 px-3 py-2.5 text-left transition hover:border-accent/40 md:flex-row md:items-center md:justify-between md:gap-3"
                    title={hasDetails ? 'View form cues + alternatives' : 'Open details'}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-zinc-100">{p.name}</span>
                        {(p.tags ?? []).slice(0, 1).map((t) => (
                          <Pill key={t}>{t}</Pill>
                        ))}
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-400">
                        {p.sets} × {p.reps} · rest {p.restSec}s
                        {p.rpeTarget ? ` · RPE ${p.rpeTarget}` : ''}
                      </div>
                    </div>
                    <div className="text-right text-sm font-semibold text-zinc-100 md:shrink-0">
                      {p.loadLbs ? `${p.loadLbs} lb` : <span className="text-xs text-zinc-400">bodyweight</span>}
                    </div>
                  </button>
                );
              })}
              {selectedDay.liftSession.coachNote && (
                <div className="mt-3 rounded-xl border border-accent/20 bg-accent/5 p-3 text-xs italic text-zinc-200">
                  "{selectedDay.liftSession.coachNote}"
                </div>
              )}
            </div>
          )}

          {/* Home (core + cardio) session detail */}
          {selectedDay.homeSession &&
            (() => {
              const home = selectedDay.homeSession;
              return (
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border border-ink-800 bg-ink-850 p-3">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-300">
                      <Heart size={12} /> Cardio
                    </div>
                    <p className="mt-1 text-sm text-zinc-100">{home.cardioBlock}</p>
                  </div>
                  <div className="rounded-xl border border-ink-800 bg-ink-850 p-3">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-300">
                      <Activity size={12} /> Core ({home.coreMinutes} min)
                    </div>
                    <ul className="mt-1.5 space-y-1 text-sm text-zinc-200">
                      {home.corePrescriptions.map((p, i) => (
                        <li key={i}>
                          • {p.name} · {p.sets} × {p.reps}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {home.safetyOverride && home.safetyNote && (
                    <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-zinc-100">
                      {home.safetyNote}
                    </div>
                  )}
                </div>
              );
            })()}

          {/* Rest day */}
          {!selectedDay.hasSession && (
            <div className="mt-4 rounded-xl border border-ink-800 bg-ink-850 p-3 text-sm text-zinc-300">
              Rest day. Walk, hydrate, hit protein. The Dashboard's Rest Day card
              has the full play-by-play.
            </div>
          )}
        </Card>
      )}


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

