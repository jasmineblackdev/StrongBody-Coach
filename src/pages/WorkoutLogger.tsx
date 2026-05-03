import { useMemo, useState } from 'react';
import { Save, Plus, Trash2, ClipboardCheck, Timer } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CoachMessage, Pill, SectionHeader } from '../components/ui';
import RestTimer from '../components/RestTimer';
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

  // Rest timer state — armed (with a fresh ID) when the user logs a set.
  // Bumping armedAt to a new value resets and auto-starts the timer.
  const [restArmedAt, setRestArmedAt] = useState<number | null>(null);
  const [restExerciseIdx, setRestExerciseIdx] = useState<number | null>(null);
  const [restRecommendedSec, setRestRecommendedSec] = useState<number>(90);

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
            return (
              <div key={pres.name} className="rounded-2xl border border-ink-800 bg-ink-850 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <div className="font-semibold text-zinc-100">{pres.name}</div>
                    <div className="text-xs text-zinc-400">
                      target {pres.sets} × {pres.reps}
                      {pres.loadLbs ? ` @ ${pres.loadLbs} lb` : ''}
                      {pres.rpeTarget ? ` · RPE ${pres.rpeTarget}` : ''}
                    </div>
                  </div>
                  <button onClick={() => addSet(exIdx)} className="btn-outline">
                    <Plus size={14} /> set
                  </button>
                </div>

                {/* Header row — desktop only; mobile uses inline labels per input */}
                <div className="mt-3 hidden grid-cols-12 gap-2 text-xs uppercase tracking-wider text-zinc-500 sm:grid">
                  <div className="col-span-1">#</div>
                  <div className="col-span-3">Reps</div>
                  <div className="col-span-3">Weight</div>
                  <div className="col-span-2">RPE</div>
                  <div className="col-span-2">Missed</div>
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
                          className="input col-span-1 sm:col-span-3"
                          value={s.reps || ''}
                          onChange={(e) => setSetField(exIdx, setIdx, 'reps', Number(e.target.value))}
                          placeholder={pres.reps}
                        />
                        <input
                          type="number"
                          inputMode="decimal"
                          className="input col-span-1 sm:col-span-3"
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
                        <label className="col-span-1 inline-flex items-center gap-2 text-xs text-zinc-300 sm:col-span-2 sm:text-zinc-400">
                          <input
                            type="checkbox"
                            checked={!!s.missed}
                            onChange={(e) =>
                              setSetField(exIdx, setIdx, 'missed', e.target.checked)
                            }
                            className="h-4 w-4 accent-pink-500"
                          />
                          Missed
                        </label>
                      </div>

                      {/* Set-done + remove buttons. The Done button arms the
                          rest timer with a recommendation tailored to this
                          set. Big enough to thumb-tap mid-session. */}
                      <div className="mt-2 flex items-center gap-2 sm:col-span-1 sm:mt-0">
                        <button
                          onClick={() => logSetDone(exIdx, setIdx)}
                          disabled={!s.weight && !s.reps}
                          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-accent/40 bg-accent/10 px-2 py-2 text-xs font-semibold text-rose-glow hover:bg-accent/20 active:scale-95 disabled:opacity-40 sm:flex-none sm:px-2 sm:py-1.5"
                          aria-label="Set done — start rest timer"
                        >
                          <Timer size={12} />
                          Done
                        </button>
                        <button
                          onClick={() => removeSet(exIdx, setIdx)}
                          className="hidden sm:inline-flex sm:items-center sm:justify-center sm:rounded-lg sm:border sm:border-ink-700 sm:p-1.5 sm:text-zinc-400 sm:hover:bg-ink-800"
                          aria-label="Remove set"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
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

        <div className="mt-4 flex justify-end">
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
