import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Flame, Dumbbell, Trophy, HeartPulse, Salad, Target } from 'lucide-react';
import { Card, CoachMessage, ProgressBar, SectionHeader, StatCard, Pill } from '../components/ui';
import { BodyWeightChart, MacroDoughnut } from '../components/charts';
import { store } from '../lib/storage';
import { detectWeakPoints } from '../lib/weakPoints';
import { buildDailyPlan } from '../lib/mealPlan';
import { dayLabel } from '../lib/workoutPlan';
import type { WorkoutDay, WorkoutSession } from '../types';

function todayWorkout(weekNumber: number): WorkoutSession | null {
  const plan = store.getPlan();
  if (!plan) return null;
  const dayOfWeek = new Date().getDay(); // 0..6
  // Map: Mon squat, Tue bench, Thu deadlift, Fri upper, Sat lower
  const map: Record<number, WorkoutDay> = {
    1: 'squat',
    2: 'bench',
    4: 'deadlift',
    5: 'upper_accessory',
    6: 'lower_glute',
  };
  const target = map[dayOfWeek];
  return (
    plan.sessions.find((s) => s.day === target) ?? plan.sessions[0]
  );
}

export default function Dashboard() {
  const profile = store.getProfile();
  const metrics = store.getMetrics();
  const logs = store.getLogs();
  const weekNumber = store.getWeekNumber();
  const plan = store.getPlan();

  const todays = todayWorkout(weekNumber);
  const weakPoints = useMemo(() => detectWeakPoints(logs), [logs]);

  if (!profile || !plan) return null;

  const sortedMetrics = [...metrics].sort((a, b) => a.date.localeCompare(b.date));
  const lastWeight = sortedMetrics[sortedMetrics.length - 1]?.weightLbs ?? profile.weightLbs;
  const firstWeight = sortedMetrics[0]?.weightLbs ?? profile.weightLbs;
  const weightDelta = +(lastWeight - firstWeight).toFixed(1);

  const weeklyTarget = profile.trainingDaysPerWeek;
  const thisWeekStart = new Date();
  thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
  const completedThisWeek = logs.filter((l) => new Date(l.date) >= thisWeekStart).length;

  const recoveryAvg =
    logs
      .map((l) => l.recoveryScore ?? 0)
      .filter(Boolean)
      .slice(0, 5)
      .reduce((a, b) => a + b, 0) / Math.max(1, Math.min(5, logs.length));

  const isTrainingDayToday = ![0, 3].includes(new Date().getDay()); // sun & wed = rest
  const meal = buildDailyPlan({
    profile,
    isTrainingDay: isTrainingDayToday,
    hungerLevel: logs[0]?.hungerAfter ?? 5,
  });

  const goalLeft = +(lastWeight - profile.goalWeightLbs).toFixed(1);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h1">Hey, {profile.name}.</h1>
          <p className="muted text-sm mt-1">
            Week {weekNumber} · {plan.phase[0].toUpperCase() + plan.phase.slice(1)} block ·{' '}
            {profile.trainingDaysPerWeek} days/wk
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Pill tone="accent"><Flame size={12} /> {profile.goal.replace('_', ' ')}</Pill>
          {profile.onWegovy && <Pill>Wegovy-aware</Pill>}
        </div>
      </header>

      {/* Coach hero */}
      <CoachMessage title="Today's coaching read">
        {weakPoints[0]
          ? `${weakPoints[0].title}. ${weakPoints[0].recommendation}`
          : 'Strong week so far. Keep RPE honest, hit your protein, and walk after dinner — Wegovy + walks is the cheat code for bloat.'}
      </CoachMessage>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Body weight"
          value={lastWeight.toFixed(1)}
          unit="lb"
          delta={{ value: weightDelta, positiveIsGood: false }}
          hint={`goal ${profile.goalWeightLbs} lb`}
        />
        <StatCard
          label="To goal"
          value={goalLeft > 0 ? goalLeft.toFixed(1) : '0'}
          unit="lb"
          hint="weekly target: −1 lb"
        />
        <StatCard
          label="Compliance"
          value={`${completedThisWeek}/${weeklyTarget}`}
          hint="sessions this week"
        />
        <StatCard
          label="Recovery"
          value={recoveryAvg ? recoveryAvg.toFixed(1) : '—'}
          unit="/10"
          hint="last 5 sessions"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Today */}
        <Card className="lg:col-span-2">
          <SectionHeader
            title="Today's workout"
            subtitle={todays ? `${dayLabel[todays.day]} · ${todays.prescriptions.length} exercises` : 'Rest day'}
            action={
              todays && (
                <Link to="/log" className="btn-primary">
                  <Dumbbell size={16} /> Log Workout
                </Link>
              )
            }
          />
          {todays ? (
            <div className="space-y-2">
              {todays.prescriptions.slice(0, 6).map((p) => (
                <div
                  key={p.name}
                  className="flex items-center justify-between rounded-xl border border-ink-800 bg-ink-850 px-3 py-2.5"
                >
                  <div>
                    <div className="text-sm font-semibold text-zinc-100">{p.name}</div>
                    <div className="text-xs text-zinc-400">
                      {p.sets} × {p.reps} · rest {p.restSec}s
                      {p.rpeTarget && ` · RPE ${p.rpeTarget}`}
                    </div>
                  </div>
                  <div className="text-right">
                    {p.loadLbs ? (
                      <div className="text-sm font-semibold text-zinc-100">
                        {p.loadLbs} lb
                      </div>
                    ) : (
                      <div className="text-xs text-zinc-400">bodyweight / DB</div>
                    )}
                    <div className="text-[10px] uppercase tracking-wide text-zinc-500">{p.tags?.[0] ?? ''}</div>
                  </div>
                </div>
              ))}
              {todays.prescriptions.length > 6 && (
                <Link to="/plan" className="text-xs text-accent-soft hover:text-accent">
                  + {todays.prescriptions.length - 6} more on the plan →
                </Link>
              )}
              {todays.coachNote && (
                <div className="mt-3 text-sm text-zinc-300 italic">"{todays.coachNote}"</div>
              )}
            </div>
          ) : (
            <div className="text-zinc-400 text-sm">Today is a rest day. Walk, hydrate, hit protein.</div>
          )}
        </Card>

        {/* Big 3 */}
        <Card>
          <SectionHeader title="Big 3" subtitle="Current 1RM estimates" />
          <div className="space-y-4">
            <Lift label="Squat" value={profile.squat1RM} icon={<Dumbbell size={16} />} />
            <Lift label="Bench" value={profile.bench1RM} icon={<Trophy size={16} />} />
            <Lift label="Deadlift" value={profile.deadlift1RM} icon={<Target size={16} />} />
          </div>
        </Card>

        {/* Body weight chart */}
        <Card className="lg:col-span-2">
          <SectionHeader title="Body weight trend" subtitle="Last 30 days" />
          <div className="h-56">
            <BodyWeightChart
              data={sortedMetrics.map((m) => ({
                date: m.date.slice(5),
                weight: m.weightLbs,
                waist: m.waistIn,
              }))}
            />
          </div>
        </Card>

        {/* Macros */}
        <Card>
          <SectionHeader
            title="Today's macros"
            subtitle={`${meal.dayLabel} · ${meal.totals.calories} kcal`}
          />
          <div className="h-44">
            <MacroDoughnut
              protein={meal.totals.proteinG}
              carbs={meal.totals.carbsG}
              fat={meal.totals.fatG}
            />
          </div>
          <div className="mt-4 space-y-2">
            <ProgressBar
              label="Protein"
              rightLabel={`${meal.totals.proteinG} g`}
              value={meal.totals.proteinG}
              max={profile.proteinTargetG ?? Math.round(profile.weightLbs * 0.9)}
              tone="accent"
            />
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-zinc-400">
            <Salad size={14} /> {meal.coachNote.slice(0, 100)}…
          </div>
          <Link to="/meals" className="mt-3 inline-block text-xs text-accent-soft hover:text-accent">
            View today's meal plan →
          </Link>
        </Card>

        {/* Weak points */}
        <Card className="lg:col-span-3">
          <SectionHeader
            title="Weak areas being targeted"
            subtitle={
              weakPoints.length
                ? `${weakPoints.length} flagged from your logs`
                : 'No flags — keep stacking sessions'
            }
            action={
              <Link to="/progress" className="btn-outline">
                <HeartPulse size={16} /> Full report
              </Link>
            }
          />
          {weakPoints.length === 0 ? (
            <div className="text-sm text-zinc-400">
              Nothing red yet. Stay honest with RPE and recovery scores so this stays useful.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {weakPoints.slice(0, 4).map((w) => (
                <div key={w.key} className="rounded-xl border border-ink-800 bg-ink-850 p-4">
                  <div className="flex items-center gap-2">
                    <Pill tone="accent">{w.key.replace(/_/g, ' ')}</Pill>
                  </div>
                  <div className="mt-2 font-semibold text-zinc-100">{w.title}</div>
                  <div className="mt-1 text-xs text-zinc-400">{w.evidence}</div>
                  <div className="mt-2 text-sm text-zinc-200">{w.recommendation}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Lift({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-ink-800 bg-ink-850 px-3 py-2.5">
      <div className="flex items-center gap-2 text-zinc-300">
        <span className="text-accent-soft">{icon}</span>
        <span className="text-sm font-semibold">{label}</span>
      </div>
      <div className="font-display text-xl font-semibold text-zinc-100">
        {value} <span className="text-xs font-normal text-zinc-500">lb 1RM</span>
      </div>
    </div>
  );
}
