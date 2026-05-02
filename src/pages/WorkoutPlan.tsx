import { useMemo, useState } from 'react';
import { RefreshCw, ChevronRight } from 'lucide-react';
import { Card, CoachMessage, Pill, SectionHeader } from '../components/ui';
import { store } from '../lib/storage';
import { buildWeeklyPlan, dayLabel } from '../lib/workoutPlan';
import type { TrainingPhase, WorkoutSession } from '../types';

const PHASES: TrainingPhase[] = ['hypertrophy', 'strength', 'peak', 'deload'];

export default function WorkoutPlanPage() {
  const profile = store.getProfile()!;
  const [weekNumber, setWeekNumber] = useState(store.getWeekNumber());
  const [phase, setPhase] = useState<TrainingPhase>(store.getPlan()?.phase ?? 'hypertrophy');
  const plan = useMemo(() => buildWeeklyPlan(profile, weekNumber, phase), [profile, weekNumber, phase]);
  const [openId, setOpenId] = useState<string | null>(plan.sessions[0]?.id ?? null);

  function persistAndContinue() {
    store.setPlan(plan);
    store.setWeekNumber(weekNumber);
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
          <button onClick={persistAndContinue} className="btn-primary">
            <RefreshCw size={16} /> Save plan
          </button>
        </div>
      </header>

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
          <SessionRow key={s.id} session={s} open={openId === s.id} onToggle={() => setOpenId(openId === s.id ? null : s.id)} />
        ))}
      </div>
    </div>
  );
}

function SessionRow({
  session,
  open,
  onToggle,
}: {
  session: WorkoutSession;
  open: boolean;
  onToggle: () => void;
}) {
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
          {session.prescriptions.map((p, i) => (
            <div
              key={i}
              className="grid grid-cols-12 items-center gap-3 rounded-xl border border-ink-800 bg-ink-850 px-3 py-2.5 text-sm"
            >
              <div className="col-span-12 md:col-span-4">
                <div className="font-semibold text-zinc-100">{p.name}</div>
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
              <div className="col-span-3 md:col-span-2 text-zinc-300">
                {p.sets} × {p.reps}
              </div>
              <div className="col-span-3 md:col-span-2 text-zinc-300">
                {p.loadLbs ? `${p.loadLbs} lb` : '—'}
              </div>
              <div className="col-span-3 md:col-span-1 text-zinc-300">{p.restSec}s</div>
              <div className="col-span-3 md:col-span-3 text-xs text-zinc-400">{p.notes}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
