import { useMemo, useState } from 'react';
import {
  Save,
  Plus,
  Trash2,
  ClipboardCheck,
  Timer,
  Eye,
  Replace,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CoachMessage, Pill, SectionHeader } from '../components/ui';
import RestTimer from '../components/RestTimer';
import FormRiskPanel from '../components/FormRiskPanel';
import ExerciseDetailsModal from '../components/ExerciseDetailsModal';
import SwapExerciseModal from '../components/SwapExerciseModal';
import { explainPrescription } from '../lib/trainerPrescription';
import { detectWeakPoints } from '../lib/weakPoints';
import { store } from '../lib/storage';
import { useStoreVersion } from '../hooks/useStore';
import { dayLabel } from '../lib/workoutPlan';
import { decisionsForLog } from '../lib/autoAdjust';
import { generateProposal } from '../lib/applyAdjustments';
import { recommendRest } from '../lib/restTimer';
import type {
  ExerciseLog,
  ProblemArea,
  SetLog,
  WorkoutDay,
  WorkoutLog,
  WorkoutSession,
} from '../types';

// Quick pain/issue flag chips. Tapping a chip:
//   1. appends the flag text to the exercise's painNotes
//   2. surfaces a warning under the exercise card
// Form Risk Engine reads painNotes already, so this drives the
// per-exercise risk read on the next page render.
const PAIN_FLAGS = [
  { key: 'too_heavy', label: 'Too heavy', tone: 'warning' as const },
  { key: 'lower_back', label: 'Lower back', tone: 'danger' as const },
  { key: 'knee', label: 'Knee', tone: 'danger' as const },
  { key: 'shoulder', label: 'Shoulder', tone: 'danger' as const },
  { key: 'wrist_elbow', label: 'Wrist/elbow', tone: 'warning' as const },
  { key: 'grip', label: 'Grip', tone: 'warning' as const },
];

const PAIN_FLAG_TEXT: Record<string, string> = {
  too_heavy: 'too heavy',
  lower_back: 'low back',
  knee: 'knee',
  shoulder: 'shoulder',
  wrist_elbow: 'wrist/elbow',
  grip: 'grip',
};

const SORENESS: { key: ProblemArea; label: string }[] = [
  { key: 'lower_back', label: 'Lower back' },
  { key: 'core', label: 'Core' },
  { key: 'glutes', label: 'Glutes' },
  { key: 'hamstrings', label: 'Hamstrings' },
  { key: 'shoulders', label: 'Shoulders' },
  { key: 'grip', label: 'Grip' },
];

function emptyExerciseLog(name: string, sets = 3): ExerciseLog {
  return {
    prescriptionName: name,
    sets: Array.from({ length: sets }, () => ({ reps: 0, weight: 0 } as SetLog)),
    painNotes: '',
  };
}

export default function WorkoutLoggerPage() {
  useStoreVersion();
  const profile = store.getProfile()!;
  const plan = store.getPlan()!;
  const [sessionId, setSessionId] = useState(plan.sessions[0].id);
  const session: WorkoutSession = useMemo(
    () => plan.sessions.find((s) => s.id === sessionId) ?? plan.sessions[0],
    [plan, sessionId],
  );

  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>(() =>
    session.prescriptions.map((p) => emptyExerciseLog(p.name, p.sets)),
  );
  const [bodyWeight, setBodyWeight] = useState<number | ''>(profile.weightLbs);
  const [recoveryScore, setRecoveryScore] = useState<number>(7);
  const [hungerAfter, setHungerAfter] = useState<number>(5);
  const [soreness, setSoreness] = useState<ProblemArea[]>([]);
  const [notes, setNotes] = useState('');
  const [savedLog, setSavedLog] = useState<WorkoutLog | null>(null);
  const [proposalChangeCount, setProposalChangeCount] = useState<number | null>(null);

  // Last-time-you-did-this-exercise lookup. Reads logs once per render
  // and indexes by prescription name so each exercise card can show
  // "Last time: 5 × 145 lb · RPE 8" as a ghost above the inputs.
  const lastTimeByExercise = useMemo(() => {
    const allLogs = store.getLogs();
    const map = new Map<
      string,
      { date: string; topReps: number; topWeight: number; topRpe?: number }
    >();
    for (const log of allLogs) {
      for (const ex of log.exercises) {
        if (map.has(ex.prescriptionName)) continue; // newest wins, logs are newest-first
        const heaviest = ex.sets.reduce<typeof ex.sets[number] | null>(
          (acc, s) => (!acc || s.weight > acc.weight ? s : acc),
          null,
        );
        if (heaviest && heaviest.weight > 0) {
          map.set(ex.prescriptionName, {
            date: log.date,
            topReps: heaviest.reps,
            topWeight: heaviest.weight,
            topRpe: heaviest.rpe,
          });
        }
      }
    }
    return map;
  }, []);

  // Rest timer state — armed (with a fresh ID) when the user logs a set.
  // Bumping armedAt to a new value resets and auto-starts the timer.
  const [restArmedAt, setRestArmedAt] = useState<number | null>(null);
  const [restExerciseIdx, setRestExerciseIdx] = useState<number | null>(null);
  const [restRecommendedSec, setRestRecommendedSec] = useState<number>(90);

  // Form modal — opens with the exercise the user tapped.
  const [formExercise, setFormExercise] = useState<string | null>(null);

  // Swap modal — set to an exercise index when Swap pill is tapped.
  // Swaps are session-local: mutate exerciseLogs[i].prescriptionName so
  // both the display + the saved log reflect the swap. The plan in
  // storage stays untouched.
  const [swapExIdx, setSwapExIdx] = useState<number | null>(null);

  function applySwap(exIdx: number, newName: string) {
    setExerciseLogs((prev) => {
      const next = structuredClone(prev);
      next[exIdx].prescriptionName = newName;
      return next;
    });
  }

  // Per-exercise quick-flag state. Toggling a chip appends its label to
  // painNotes and shows a warning. UI shows which flags have been tapped
  // for the current session.
  const [activeFlags, setActiveFlags] = useState<Record<number, Set<string>>>({});

  const gymMode = profile.gymMode === true;

  // "Current exercise" for the sticky Gym Mode bar = whichever exercise
  // the user just logged a set on (via Done). Falls back to the first
  // exercise in the session before any set is logged.
  const currentExercise =
    restExerciseIdx !== null
      ? session.prescriptions[restExerciseIdx]?.name
      : session.prescriptions[0]?.name;

  function changeSession(id: string) {
    setSessionId(id);
    const s = plan.sessions.find((x) => x.id === id) ?? plan.sessions[0];
    setExerciseLogs(s.prescriptions.map((p) => emptyExerciseLog(p.name, p.sets)));
    setSavedLog(null);
  }

  function setSetField(exIdx: number, setIdx: number, field: keyof SetLog, value: number | boolean) {
    setExerciseLogs((prev) => {
      const next = structuredClone(prev);
      (next[exIdx].sets[setIdx] as any)[field] = value;
      return next;
    });
  }

  function addSet(exIdx: number) {
    setExerciseLogs((prev) => {
      const next = structuredClone(prev);
      next[exIdx].sets.push({ reps: 0, weight: 0 });
      return next;
    });
  }
  function removeSet(exIdx: number, setIdx: number) {
    setExerciseLogs((prev) => {
      const next = structuredClone(prev);
      next[exIdx].sets.splice(setIdx, 1);
      return next;
    });
  }

  function toggleSoreness(area: ProblemArea) {
    setSoreness((prev) => (prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]));
  }

  /**
   * Toggle a quick pain/issue flag for an exercise. When a flag is added,
   * append its text to the exercise's painNotes (so the Form Risk engine
   * picks it up). When removed, strip the text out.
   */
  function toggleFlag(exIdx: number, flagKey: string) {
    const current = activeFlags[exIdx] ?? new Set<string>();
    const next = new Set(current);
    const text = PAIN_FLAG_TEXT[flagKey];
    if (next.has(flagKey)) {
      next.delete(flagKey);
    } else {
      next.add(flagKey);
    }
    setActiveFlags({ ...activeFlags, [exIdx]: next });

    setExerciseLogs((prev) => {
      const out = structuredClone(prev);
      const existingNotes = out[exIdx].painNotes ?? '';
      // Rebuild notes from the active flag set so we don't accumulate
      // duplicates across toggles. Preserve any free-text the user typed
      // by keeping non-flag content.
      const flagTexts = Array.from(next)
        .map((k) => PAIN_FLAG_TEXT[k])
        .filter(Boolean);
      const allFlagTexts = Object.values(PAIN_FLAG_TEXT);
      const nonFlagText = existingNotes
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter((s) => s && !allFlagTexts.includes(s))
        .join(', ');
      const flagText = flagTexts.join(', ');
      out[exIdx].painNotes = [nonFlagText, flagText].filter(Boolean).join(', ');
      void text;
      return out;
    });
  }

  /**
   * Mark a set as done — arms the rest timer with a recommendation tailored
   * to this exercise + the just-logged set's RPE / missed signals. Pure
   * client-side; nothing is saved until the full session save() runs.
   */
  function logSetDone(exIdx: number, setIdx: number) {
    const pres = session.prescriptions[exIdx];
    const set = exerciseLogs[exIdx]?.sets[setIdx];
    if (!pres || !set) return;
    const rec = recommendRest(pres, {
      lastSetRpe: set.rpe,
      lastSetMissed: !!set.missed,
      phase: session.phase,
      goal: profile.goal,
    });
    setRestRecommendedSec(rec.seconds);
    setRestExerciseIdx(exIdx);
    setRestArmedAt(Date.now());
  }

  function save() {
    const log: WorkoutLog = {
      id: `log-${Date.now()}`,
      sessionId: session.id,
      date: new Date().toISOString(),
      day: session.day as WorkoutDay,
      weekNumber: session.weekNumber,
      bodyWeightLbs: typeof bodyWeight === 'number' ? bodyWeight : undefined,
      sorenessAreas: soreness,
      recoveryScore,
      hungerAfter,
      exercises: exerciseLogs.filter((ex) => ex.sets.some((s) => s.weight > 0 || s.reps > 0)),
      notes,
    };
    store.addLog(log);
    setSavedLog(log);

    // Auto-generate next-week proposal from logs in this plan's week.
    // Saved to localStorage; only applied when the user accepts on the Workout Plan page.
    const sameWeekLogs = store
      .getLogs()
      .filter((l) => l.weekNumber === plan.weekNumber);
    const proposal = generateProposal({
      currentPlan: plan,
      profile,
      recentLogs: sameWeekLogs,
    });
    if (proposal) {
      store.setProposal(proposal);
      setProposalChangeCount(proposal.changes.length);
    } else {
      store.clearProposal();
      setProposalChangeCount(0);
    }
  }

  const decisions = savedLog ? decisionsForLog(savedLog, session.prescriptions) : [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="h1">Log workout</h1>
        <p className="muted text-sm mt-1">Be honest with RPE and pain — the engine adjusts your next session.</p>
      </header>

      <FormRiskPanel />

      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <span className="label !mb-0 mr-2">Session</span>
          {plan.sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => changeSession(s.id)}
              className={`btn ${sessionId === s.id ? 'btn-primary' : 'btn-outline'}`}
            >
              {dayLabel[s.day]}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <SectionHeader title={dayLabel[session.day]} subtitle={`Week ${session.weekNumber} · ${session.phase}`} />
        <div className="space-y-4">
          {session.prescriptions.map((pres, exIdx) => {
            const exLog = exerciseLogs[exIdx];
            // Display name reflects swaps — exerciseLogs[i].prescriptionName
            // is the source of truth so display + saved log stay in sync.
            const displayName = exLog?.prescriptionName ?? pres.name;
            const wasSwapped = displayName !== pres.name;
            return (
              <div key={pres.name} className="rounded-2xl border border-ink-800 bg-ink-850 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    {/* Bigger exercise name — readable arm's-length in dim
                        gym lighting. */}
                    <div className="font-display text-xl font-bold text-zinc-100">
                      {displayName}
                    </div>
                    {wasSwapped && (
                      <div className="mt-0.5 text-[10px] uppercase tracking-wider text-rose-glow">
                        swapped from {pres.name}
                      </div>
                    )}
                    <div className="mt-0.5 text-sm text-zinc-300">
                      target <span className="font-semibold text-zinc-100">{pres.sets} × {pres.reps}</span>
                      {pres.loadLbs ? <> · <span className="font-semibold text-zinc-100">{pres.loadLbs} lb</span></> : null}
                      {pres.rpeTarget ? ` · RPE ${pres.rpeTarget}` : ''}
                    </div>
                    {(() => {
                      const last = lastTimeByExercise.get(displayName);
                      if (!last) return null;
                      const dateLabel = last.date.slice(0, 10);
                      return (
                        <div className="mt-0.5 text-xs text-zinc-500">
                          Last time ({dateLabel}):{' '}
                          <span className="font-semibold text-zinc-300">
                            {last.topReps} × {last.topWeight} lb
                          </span>
                          {last.topRpe ? ` · RPE ${last.topRpe}` : ''}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setFormExercise(displayName)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-semibold text-rose-glow active:scale-95"
                      aria-label={`View form cues for ${displayName}`}
                    >
                      <Eye size={14} /> Form
                    </button>
                    <button
                      onClick={() => setSwapExIdx(exIdx)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-ink-700 bg-ink-850 px-3 py-2 text-xs font-semibold text-zinc-200 active:scale-95"
                      aria-label="Swap exercise"
                    >
                      <Replace size={14} /> Swap
                    </button>
                    <button
                      onClick={() => addSet(exIdx)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-ink-700 bg-ink-850 px-3 py-2 text-xs font-semibold text-zinc-200 active:scale-95"
                    >
                      <Plus size={14} /> set
                    </button>
                  </div>
                </div>

                {/* Quick pain/issue flags. Tapping appends to painNotes
                    (Form Risk engine reads it) and surfaces a warning. */}
                <div className="mt-3">
                  <div className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1.5">
                    Quick flag
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {PAIN_FLAGS.map((f) => {
                      const active = activeFlags[exIdx]?.has(f.key) ?? false;
                      const toneOn =
                        f.tone === 'danger'
                          ? 'border-danger/40 bg-danger/15 text-danger'
                          : 'border-warning/40 bg-warning/15 text-warning';
                      return (
                        <button
                          key={f.key}
                          onClick={() => toggleFlag(exIdx, f.key)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold active:scale-95 ${
                            active
                              ? toneOn
                              : 'border-ink-700 bg-ink-900/40 text-zinc-300 hover:bg-ink-800'
                          }`}
                        >
                          {f.label}
                        </button>
                      );
                    })}
                  </div>
                  {(activeFlags[exIdx]?.size ?? 0) > 0 && (() => {
                    const rationale = explainPrescription(pres, {
                      profile,
                      phase: session.phase,
                      weakPoints: detectWeakPoints(store.getLogs()),
                    });
                    const topSwap = rationale.alternates[0];
                    return (
                      <div className="mt-2 rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-zinc-100">
                        <div>
                          <AlertTriangle size={12} className="inline mr-1 text-danger" />
                          <span className="font-semibold">Do not increase load.</span>{' '}
                          Use a safer variation. The next session's coach decision
                          will see this flag and gate strength forecasts.
                        </div>
                        {topSwap && (
                          <div className="mt-2 rounded-lg border border-warning/30 bg-warning/10 p-2">
                            <div className="text-[11px] font-semibold uppercase tracking-wider text-warning">
                              Suggested swap
                            </div>
                            <div className="mt-0.5 text-zinc-100">
                              <span className="font-semibold">{topSwap.name}</span>
                              <span className="text-zinc-300"> — {topSwap.reason}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Header row — desktop only; mobile uses inline labels per input */}
                <div className="mt-3 hidden grid-cols-12 gap-2 text-xs uppercase tracking-wider text-zinc-500 sm:grid">
                  <div className="col-span-1">#</div>
                  <div className="col-span-2">Reps</div>
                  <div className="col-span-2">Weight</div>
                  <div className="col-span-2">RPE</div>
                  <div className="col-span-1">Missed</div>
                  <div className="col-span-3">Done</div>
                  <div className="col-span-1"></div>
                </div>
                <div className="space-y-2 sm:space-y-1.5">
                  {exLog.sets.map((s, setIdx) => (
                    <div
                      key={setIdx}
                      className="rounded-xl border border-ink-800 bg-ink-900/40 p-2 sm:grid sm:grid-cols-12 sm:items-center sm:gap-2 sm:rounded-none sm:border-none sm:bg-transparent sm:p-0"
                    >
                      {/* Set number — inline header on mobile, single col on desktop */}
                      <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wider text-zinc-400 sm:col-span-1 sm:mb-0 sm:text-sm">
                        <span>Set {setIdx + 1}</span>
                        <button
                          onClick={() => removeSet(exIdx, setIdx)}
                          className="inline-flex items-center justify-center rounded-lg border border-ink-700 p-1 text-zinc-400 hover:bg-ink-800 sm:hidden"
                          aria-label="Remove set"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>

                      {/* Reps + Weight — side by side on mobile, individual cols on desktop */}
                      <div className="grid grid-cols-2 gap-2 sm:contents">
                        <label className="text-xs text-zinc-400 sm:hidden">Reps</label>
                        <label className="text-xs text-zinc-400 sm:hidden">Weight</label>
                        <input
                          type="number"
                          inputMode="numeric"
                          className="input col-span-1 sm:col-span-2"
                          value={s.reps || ''}
                          onChange={(e) => setSetField(exIdx, setIdx, 'reps', Number(e.target.value))}
                          placeholder={pres.reps}
                        />
                        <input
                          type="number"
                          inputMode="decimal"
                          className="input col-span-1 sm:col-span-2"
                          value={s.weight || ''}
                          onChange={(e) => setSetField(exIdx, setIdx, 'weight', Number(e.target.value))}
                          placeholder={`${pres.loadLbs ?? ''}`}
                        />
                      </div>

                      {/* RPE + Missed — side by side on mobile */}
                      <div className="mt-2 grid grid-cols-2 gap-2 sm:contents sm:mt-0">
                        <label className="text-xs text-zinc-400 sm:hidden">RPE</label>
                        <span className="sm:hidden" />
                        <input
                          type="number"
                          inputMode="numeric"
                          className="input col-span-1 sm:col-span-2"
                          value={s.rpe || ''}
                          min={1}
                          max={10}
                          onChange={(e) => setSetField(exIdx, setIdx, 'rpe', Number(e.target.value))}
                          placeholder="RPE"
                        />
                        <label className="col-span-1 inline-flex items-center gap-2 text-xs text-zinc-300 sm:col-span-1 sm:text-zinc-400">
                          <input
                            type="checkbox"
                            checked={!!s.missed}
                            onChange={(e) =>
                              setSetField(exIdx, setIdx, 'missed', e.target.checked)
                            }
                            className="h-4 w-4 accent-pink-500"
                          />
                          <span className="sm:sr-only">Missed</span>
                        </label>
                      </div>

                      {/* Set-done + remove buttons. The Done button arms the
                          rest timer with a recommendation tailored to this
                          set. Now wider on desktop (col-span-3) so the icon
                          + label aren't cramped. */}
                      <div className="mt-2 flex items-center gap-2 sm:col-span-3 sm:mt-0">
                        <button
                          onClick={() => logSetDone(exIdx, setIdx)}
                          disabled={!s.weight && !s.reps}
                          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent px-3 py-3 text-sm font-bold text-white shadow-glow active:scale-95 disabled:opacity-40 disabled:shadow-none sm:py-2"
                          aria-label="Set done — start rest timer"
                        >
                          <Timer size={14} />
                          Done
                        </button>
                      </div>
                      <button
                        onClick={() => removeSet(exIdx, setIdx)}
                        className="hidden sm:col-span-1 sm:inline-flex sm:items-center sm:justify-center sm:rounded-lg sm:border sm:border-ink-700 sm:p-1.5 sm:text-zinc-400 sm:hover:bg-ink-800"
                        aria-label="Remove set"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-3">
                  <span className="label">Pain / soreness notes (optional)</span>
                  <input
                    className="input"
                    placeholder="e.g., low back tight on last set, grip slipped"
                    value={exLog.painNotes}
                    onChange={(e) =>
                      setExerciseLogs((prev) => {
                        const next = structuredClone(prev);
                        next[exIdx].painNotes = e.target.value;
                        return next;
                      })
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <SectionHeader title="How was it?" />
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Bodyweight (lb)">
            <input
              type="number"
              className="input"
              value={bodyWeight}
              onChange={(e) => setBodyWeight(e.target.value ? Number(e.target.value) : '')}
            />
          </Field>
          <Field label={`Recovery score: ${recoveryScore}/10`}>
            <input
              type="range"
              min={1}
              max={10}
              value={recoveryScore}
              onChange={(e) => setRecoveryScore(Number(e.target.value))}
              className="w-full accent-pink-500"
            />
          </Field>
          <Field label={`Hunger after: ${hungerAfter}/10`}>
            <input
              type="range"
              min={1}
              max={10}
              value={hungerAfter}
              onChange={(e) => setHungerAfter(Number(e.target.value))}
              className="w-full accent-pink-500"
            />
          </Field>
        </div>

        <div className="mt-4">
          <span className="label">Soreness areas</span>
          <div className="flex flex-wrap gap-2">
            {SORENESS.map((s) => (
              <button
                key={s.key}
                onClick={() => toggleSoreness(s.key)}
                className={`btn ${soreness.includes(s.key) ? 'btn-primary' : 'btn-outline'}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <span className="label">Notes</span>
          <textarea
            className="input min-h-[80px]"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Sleep, mood, anything off?"
          />
        </div>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            onClick={() => {
              if (
                !confirm(
                  'Reset this workout? All sets, RPE, flags, and notes for this session will be cleared. Saved logs are not affected.',
                )
              ) {
                return;
              }
              // Re-init exercise logs from the current session prescriptions
              setExerciseLogs(
                session.prescriptions.map((p) => emptyExerciseLog(p.name, p.sets)),
              );
              setBodyWeight(profile.weightLbs);
              setRecoveryScore(7);
              setHungerAfter(5);
              setSoreness([]);
              setNotes('');
              setActiveFlags({});
              setRestArmedAt(null);
              setRestExerciseIdx(null);
              setSavedLog(null);
              setProposalChangeCount(null);
            }}
            className="btn-outline"
            title="Clear this session's inputs (saved logs are untouched)"
          >
            <RotateCcw size={14} /> Reset
          </button>
          <button onClick={save} className="btn-primary">
            <Save size={16} /> Save log & get coaching
          </button>
        </div>
      </Card>

      {savedLog && proposalChangeCount !== null && (
        <CoachMessage
          tone={proposalChangeCount > 0 ? 'accent' : 'success'}
          title={
            proposalChangeCount > 0
              ? `Next week's plan: ${proposalChangeCount} proposed change${proposalChangeCount === 1 ? '' : 's'}`
              : 'Nothing to change for next week'
          }
          icon={<ClipboardCheck size={18} />}
        >
          {proposalChangeCount > 0 ? (
            <>
              The coach drafted next week's plan based on this session.{' '}
              <Link to="/plan" className="underline font-semibold text-white">
                Review on Workout Plan →
              </Link>{' '}
              You can accept or reject before anything changes. Nothing is pushed to the cloud
              until you click Push.
            </>
          ) : (
            "You're on track. Repeat the prescription as written next week."
          )}
        </CoachMessage>
      )}

      {savedLog && (
        <Card>
          <SectionHeader
            title="Coach's read"
            subtitle="Auto-adjustments for your next session"
            action={<Pill tone="accent">{decisions.length} decisions</Pill>}
          />
          {decisions.length === 0 ? (
            <CoachMessage tone="success">
              Solid execution. Repeat the prescription next session — keep stacking.
            </CoachMessage>
          ) : (
            <div className="space-y-3">
              {decisions.map((d, i) => (
                <CoachMessage key={i} tone={toneFor(d.action)} title={`${d.exercise}: ${labelFor(d.action)}`}>
                  {d.message}
                  {d.suggestedLbsDelta ? (
                    <div className="mt-1 text-xs text-zinc-300">
                      Suggested load change: {d.suggestedLbsDelta > 0 ? '+' : ''}
                      {d.suggestedLbsDelta} lb
                    </div>
                  ) : null}
                </CoachMessage>
              ))}
            </div>
          )}
        </Card>
      )}

      {restArmedAt !== null && restExerciseIdx !== null && (
        <RestTimer
          armedAt={restArmedAt}
          recommendedSeconds={restRecommendedSec}
          exerciseName={session.prescriptions[restExerciseIdx]?.name ?? 'Rest'}
          label={`Resting — ${session.prescriptions[restExerciseIdx]?.name ?? ''}`}
          onDismiss={() => setRestArmedAt(null)}
        />
      )}

      {formExercise && (
        <ExerciseDetailsModal
          exerciseName={formExercise}
          prescription={session.prescriptions.find((p) => p.name === formExercise)}
          phase={session.phase}
          onClose={() => setFormExercise(null)}
        />
      )}

      {swapExIdx !== null && session.prescriptions[swapExIdx] && (
        <SwapExerciseModal
          current={{
            ...session.prescriptions[swapExIdx],
            name: exerciseLogs[swapExIdx]?.prescriptionName ?? session.prescriptions[swapExIdx].name,
          }}
          phase={session.phase}
          onClose={() => setSwapExIdx(null)}
          onSelect={(newName) => applySwap(swapExIdx, newName)}
        />
      )}

      {/* Sticky Gym Mode bottom bar — only when Gym Mode is on AND we haven't
          finished saving. Shows current exercise + rest summary + Finish.
          Stacks above bottom mobile nav (which sits at bottom-0). */}
      {gymMode && !savedLog && (
        <div
          className="fixed left-0 right-0 z-30 border-t-2 border-accent/40 bg-ink-900/95 px-3 py-3 shadow-glow backdrop-blur md:left-64"
          style={{
            bottom: 'calc(env(safe-area-inset-bottom) + 64px)',
          }}
        >
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-rose-glow">
                {restArmedAt !== null ? 'Resting' : 'Current'}
              </div>
              <div className="truncate text-sm font-bold text-zinc-100">
                {currentExercise ?? '—'}
              </div>
            </div>
            <button
              onClick={save}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white shadow-glow active:scale-95"
              aria-label="Finish workout and save"
            >
              <Save size={14} /> Finish
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

function toneFor(action: string): 'accent' | 'warning' | 'danger' | 'success' {
  switch (action) {
    case 'increase':
      return 'success';
    case 'reduce_weight':
    case 'deload':
      return 'danger';
    case 'reduce_volume':
    case 'swap':
    case 'add_accessory':
      return 'warning';
    default:
      return 'accent';
  }
}

function labelFor(action: string): string {
  return (
    {
      increase: 'Increase next week',
      repeat: 'Repeat this weight',
      reduce_weight: 'Reduce weight',
      reduce_volume: 'Reduce volume',
      swap: 'Swap exercise',
      add_accessory: 'Add accessory',
      deload: 'Deload',
    } as Record<string, string>
  )[action] ?? action;
}
