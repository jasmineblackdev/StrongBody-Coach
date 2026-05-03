import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Flame, Dumbbell, Trophy, HeartPulse, Salad, Target, TrendingUp, TrendingDown, Minus, HelpCircle, Sparkles, BellRing } from 'lucide-react';
import { Card, CoachMessage, ProgressBar, SectionHeader, StatCard, Pill } from '../components/ui';
import { BodyWeightChart, MacroDoughnut } from '../components/charts';
import { useStoreVersion } from '../hooks/useStore';
import { computeReadiness, READINESS_TONE, SUGGESTION_COPY } from '../lib/recoveryEngine';
import { estimateAllLifts, TREND_LABEL, type StrengthTrend } from '../lib/strengthEngine';
import { computeWeightTrend } from '../lib/weightTrendEngine';
import { analyzeFatLoss, recommendationTone } from '../lib/fatLossEngine';
import { analyzeAdherenceAndPlateau, plateauTone } from '../lib/adherenceEngine';
import { computeProteinTargetG } from '../lib/macroEngine';
import { generateCoachSummary } from '../lib/ai/coachSummary';
import { forecastWeight } from '../lib/ml/weightForecaster';
import {
  forecastAllLifts,
  RECOMMENDATION_LABEL,
  RECOMMENDATION_TONE,
} from '../lib/ml/strengthForecaster';
import { assessInjuryRisk, RISK_TONE } from '../lib/ml/injuryRisk';
import { store } from '../lib/storage';
import { detectWeakPoints } from '../lib/weakPoints';
import { buildDailyPlan } from '../lib/mealPlan';
import { dayLabel } from '../lib/workoutPlan';
import CoachDecisionCard from '../components/CoachDecisionCard';
import FatLossInsightCard from '../components/FatLossInsightCard';
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
  useStoreVersion();
  const profile = store.getProfile();
  const metrics = store.getMetrics();
  const logs = store.getLogs();
  const weekNumber = store.getWeekNumber();
  const plan = store.getPlan();

  const todays = todayWorkout(weekNumber);
  const weakPoints = useMemo(() => detectWeakPoints(logs), [logs]);
  const readiness = useMemo(() => computeReadiness(logs), [logs]);
  const liftEstimates = useMemo(
    () =>
      estimateAllLifts(logs, {
        baselines: {
          squat: profile?.squat1RM,
          bench: profile?.bench1RM,
          deadlift: profile?.deadlift1RM,
        },
      }),
    [logs, profile?.squat1RM, profile?.bench1RM, profile?.deadlift1RM],
  );
  const weightTrend = useMemo(
    () => (profile ? computeWeightTrend(metrics, profile) : null),
    [metrics, profile],
  );
  const fatLoss = useMemo(
    () =>
      profile
        ? analyzeFatLoss({
            profile,
            metrics,
            logs,
            checkIns: store.getCheckIns(),
          })
        : null,
    [profile, metrics, logs],
  );
  const coachSummary = useMemo(
    () =>
      profile && weightTrend && fatLoss
        ? generateCoachSummary({
            profile,
            weight: weightTrend,
            recovery: readiness,
            lifts: liftEstimates,
            fatLoss,
            lastCheckIn: store.getCheckIns()[0],
          })
        : null,
    [profile, weightTrend, readiness, liftEstimates, fatLoss],
  );
  const weightForecast = useMemo(() => forecastWeight(metrics), [metrics]);
  const liftForecasts = useMemo(
    () => forecastAllLifts(logs, 5, { recoveryScore: readiness.score }),
    [logs, readiness.score],
  );
  const injuryRisk = useMemo(() => assessInjuryRisk(logs), [logs]);
  const plateau = useMemo(
    () =>
      weightTrend
        ? analyzeAdherenceAndPlateau({
            weightTrend,
            lastCheckIn: store.getCheckIns()[0],
            recentLogs: logs,
          })
        : null,
    [weightTrend, logs],
  );

  if (!profile || !plan || !weightTrend || !fatLoss || !coachSummary) return null;

  const sortedMetrics = [...metrics].sort((a, b) => a.date.localeCompare(b.date));
  // Profile + weightTrendEngine drive the headline weight values now.
  // sortedMetrics is kept for the body weight trend chart.

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
    metrics,
    recentLogs: logs,
  });

  // Auto-Coach weekly nudge: when the toggle is on AND the last check-in is
  // 7+ days old (or none exists), show the banner. No external scheduling
  // required — this is a pure read of local state on every Dashboard render.
  const checkIns = store.getCheckIns();
  const lastCheckInDate = checkIns[0]?.date;
  const daysSinceLastCheckIn = lastCheckInDate
    ? Math.floor((Date.now() - new Date(lastCheckInDate).getTime()) / 86400000)
    : null;
  const coachNudgeDue =
    profile.autoCoach === true &&
    (daysSinceLastCheckIn === null || daysSinceLastCheckIn >= 7);

  return (
    <div className="space-y-6">
      {coachNudgeDue && (
        <div className="rounded-2xl border-2 border-accent/40 bg-accent/10 p-4 shadow-glow">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/25 text-rose-glow">
                <BellRing size={18} />
              </span>
              <div>
                <div className="font-display text-base font-semibold text-zinc-100">
                  Time for your weekly coach review
                </div>
                <div className="mt-0.5 text-xs text-zinc-300">
                  {daysSinceLastCheckIn === null
                    ? 'Auto-Coach is on. Run your first check-in to start drafting weekly decisions.'
                    : `It's been ${daysSinceLastCheckIn} days since your last check-in. Run a fresh one and the engine will draft this week's decision.`}
                </div>
              </div>
            </div>
            <Link to="/check-in" className="btn-primary">
              <Sparkles size={14} /> Start check-in
            </Link>
          </div>
        </div>
      )}

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

      {/* Goal banner — the headline of fat-loss progress */}
      <Card className="border-accent/20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-zinc-400">
              Goal · {profile.weightLbs} lb → {profile.goalWeightLbs} lb
            </div>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="font-display text-3xl font-semibold tracking-tight">
                {weightTrend.sevenDayAvg.toFixed(1)}
              </span>
              <span className="text-sm text-zinc-400">7-day avg lb</span>
              {weightTrend.weeklyChange !== 0 && (
                <span
                  className={`text-sm font-semibold ${
                    weightTrend.weeklyChange < 0 ? 'text-success' : 'text-warning'
                  }`}
                >
                  {weightTrend.weeklyChange > 0 ? '+' : ''}
                  {weightTrend.weeklyChange.toFixed(1)} lb / wk
                </span>
              )}
            </div>
            <div className="mt-2 text-xs text-zinc-400">
              {weightTrend.totalLostFromStart > 0
                ? `${weightTrend.totalLostFromStart.toFixed(1)} lb lost · `
                : ''}
              {weightTrend.remaining > 0
                ? `${weightTrend.remaining.toFixed(1)} lb to goal`
                : 'at goal weight'}
              {weightTrend.weeksToGoal != null && (
                <>
                  {' '}
                  · ETA <span className="text-zinc-200">{weightTrend.weeksToGoal} weeks</span>
                  {weightTrend.goalDate ? ` (~${weightTrend.goalDate})` : ''}
                </>
              )}
            </div>
          </div>
          <div className="min-w-[180px] flex-1">
            <ProgressBar
              value={Math.max(0, weightTrend.totalLostFromStart)}
              max={Math.max(
                1,
                profile.weightLbs - profile.goalWeightLbs +
                  Math.max(0, weightTrend.totalLostFromStart),
              )}
              tone="success"
              label="Progress"
              rightLabel={`${weightTrend.totalLostFromStart.toFixed(1)} / ${(
                profile.weightLbs - profile.goalWeightLbs +
                Math.max(0, weightTrend.totalLostFromStart)
              ).toFixed(1)} lb`}
            />
            <div className="mt-2">
              <Link to="/check-in" className="btn-outline w-full">
                <Sparkles size={14} /> Run weekly check-in
              </Link>
            </div>
          </div>
        </div>
      </Card>

      {/* AI coach summary — weekly read in 3–5 sentences */}
      <CoachMessage tone={coachSummary.tone} title="Coach's read this week">
        <div className="space-y-1.5">
          {coachSummary.sentences.map((s, i) => (
            <p key={i}>{s}</p>
          ))}
        </div>
        {fatLoss.daysSinceLastCheckIn != null && (
          <div className="mt-2 text-xs opacity-80">
            Last check-in {fatLoss.daysSinceLastCheckIn} day
            {fatLoss.daysSinceLastCheckIn === 1 ? '' : 's'} ago
            {fatLoss.shouldRunNow ? ' — due for a fresh one.' : '.'}
          </div>
        )}
      </CoachMessage>

      {/* Female-aware fat-loss interpretation — sits ABOVE the Coach
          Decision so the user sees the trend read before the action. */}
      <FatLossInsightCard />

      {/* Coach Brain weekly decision — pending decisions surface here as
          Accept / Reject. Hides itself when there is no decision yet. */}
      <CoachDecisionCard mode="stored" />

      {/* Adherence + plateau card — answers "why isn't this working?" */}
      {plateau && (
        <Card className="border-accent/20">
          <SectionHeader
            title={
              plateau.primaryAction === 'stay_course'
                ? 'Plateau check: clear'
                : plateau.primaryAction === 'increase_calories'
                ? 'You\'re losing too fast'
                : plateau.primaryAction === 'log_more_data'
                ? 'Why you can\'t tell yet'
                : "Why you're not losing weight"
            }
            subtitle="Adherence + plateau diagnostic"
            action={
              <Pill tone={plateauTone(plateau.primaryAction)}>
                {plateau.confidence} confidence
              </Pill>
            }
          />
          <CoachMessage tone={plateauTone(plateau.primaryAction)} title={plateau.headline}>
            {plateau.reason}
          </CoachMessage>
          {plateau.adherence.hasCheckIn && (
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border border-ink-800 bg-ink-850 p-3">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">Calories</div>
                <div className="mt-1 font-display text-lg font-semibold">
                  {Math.round(plateau.adherence.components.calories * 100)}%
                </div>
              </div>
              <div className="rounded-xl border border-ink-800 bg-ink-850 p-3">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">Protein</div>
                <div className="mt-1 font-display text-lg font-semibold">
                  {Math.round(plateau.adherence.components.protein * 100)}%
                </div>
              </div>
              <div className="rounded-xl border border-ink-800 bg-ink-850 p-3">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">Workouts</div>
                <div className="mt-1 font-display text-lg font-semibold">
                  {Math.round(plateau.adherence.components.workouts * 100)}%
                </div>
              </div>
            </div>
          )}
          {!plateau.adherence.hasCheckIn && (
            <div className="mt-3 text-xs text-zinc-500">
              No recent check-in. <Link to="/check-in" className="text-rose-glow hover:underline">Run one</Link> to feed adherence into this diagnostic.
            </div>
          )}
        </Card>
      )}

      {/* Predictions card — ML-lite forecasts */}
      <Card>
        <SectionHeader
          title="Predictions"
          subtitle="ML-lite forecasts from your last 4–6 weeks of data"
          action={
            injuryRisk.level !== 'low' && (
              <Pill tone={RISK_TONE[injuryRisk.level]}>
                injury risk: {injuryRisk.level}
              </Pill>
            )
          }
        />
        <div className="grid gap-3 md:grid-cols-2">
          {/* Weight forecast */}
          <div className="rounded-xl border border-ink-800 bg-ink-850 p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-400">
              Next-week weight
            </div>
            {weightForecast ? (
              <>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-display text-2xl font-semibold">
                    {weightForecast.predictedNextWeekWeight} lb
                  </span>
                  <span
                    className={`text-sm font-semibold ${
                      weightForecast.predictedWeeklyChange < 0
                        ? 'text-success'
                        : weightForecast.predictedWeeklyChange > 0
                        ? 'text-warning'
                        : 'text-zinc-400'
                    }`}
                  >
                    {weightForecast.predictedWeeklyChange > 0 ? '+' : ''}
                    {weightForecast.predictedWeeklyChange.toFixed(1)} lb
                  </span>
                </div>
                <div className="mt-1 text-xs text-zinc-400">
                  range {weightForecast.band.low}–{weightForecast.band.high} lb · R²{' '}
                  {weightForecast.rSquared} · {weightForecast.confidence} confidence
                </div>
              </>
            ) : (
              <div className="mt-2 text-sm text-zinc-400">
                Need 7+ days of weight data to forecast.
              </div>
            )}
          </div>

          {/* Big 3 next-session targets — safety-gated */}
          <div className="rounded-xl border border-ink-800 bg-ink-850 p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-400">
              Next-session working sets (5 reps)
            </div>
            <div className="mt-2 space-y-1.5 text-sm">
              {(['squat', 'bench', 'deadlift'] as const).map((lift) => {
                const f = liftForecasts[lift];
                if (!f) {
                  return (
                    <div key={lift} className="flex items-center justify-between">
                      <span className="capitalize text-zinc-300">{lift}</span>
                      <span className="text-xs text-zinc-500">—</span>
                    </div>
                  );
                }
                const flagged = f.safetyFlags.length > 0 || f.recommendation !== 'increase';
                return (
                  <div key={lift}>
                    <div className="flex items-center justify-between">
                      <span className="capitalize text-zinc-300">{lift}</span>
                      <span className="flex items-center gap-2 text-zinc-100">
                        <span className="font-semibold">{f.nextSessionTarget} lb</span>
                        <Pill tone={RECOMMENDATION_TONE[f.recommendation]}>
                          {RECOMMENDATION_LABEL[f.recommendation]}
                        </Pill>
                      </span>
                    </div>
                    {flagged && (
                      <div className="mt-0.5 text-[11px] leading-tight text-zinc-400">
                        {f.rationale}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {injuryRisk.level !== 'low' && (
          <div className="mt-3 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-zinc-100">
            <div className="font-semibold">Injury risk: {injuryRisk.level}</div>
            <div className="mt-1 text-xs text-zinc-300">
              {injuryRisk.recommendation}
            </div>
            {injuryRisk.flags.length > 0 && (
              <ul className="mt-1.5 list-disc pl-4 text-xs text-zinc-400">
                {injuryRisk.flags.slice(0, 3).map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>

      {/* Specific fat-loss action card kept as a focused secondary read */}
      <CoachMessage
        tone={recommendationTone(fatLoss.primary.kind)}
        title={`This week: ${fatLoss.primary.headline}`}
      >
        {fatLoss.primary.body}
      </CoachMessage>

      {(() => {
        const pending = store.getProposal();
        if (!pending) return null;
        return (
          <CoachMessage tone="accent" title={`Next week proposal: ${pending.changes.length} changes ready`}>
            Coach drafted Week {pending.toWeek} based on your last sessions.{' '}
            <Link to="/plan" className="underline font-semibold text-white">
              Review on Workout Plan →
            </Link>
          </CoachMessage>
        );
      })()}

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="7-day avg"
          value={weightTrend.sevenDayAvg.toFixed(1)}
          unit="lb"
          delta={{
            value: +weightTrend.weeklyChange.toFixed(1),
            positiveIsGood: false,
          }}
          hint={`current ${weightTrend.current.toFixed(1)} lb`}
        />
        <StatCard
          label="To goal"
          value={weightTrend.remaining > 0 ? weightTrend.remaining.toFixed(1) : '0'}
          unit="lb"
          hint={
            weightTrend.weeksToGoal != null
              ? `~${weightTrend.weeksToGoal} weeks`
              : 'log daily for ETA'
          }
        />
        <StatCard
          label="Compliance"
          value={`${completedThisWeek}/${weeklyTarget}`}
          hint="sessions this week"
        />
        <StatCard
          label={`Recovery · ${SUGGESTION_COPY[readiness.suggestion].headline}`}
          value={recoveryAvg ? recoveryAvg.toFixed(1) : '—'}
          unit="/10"
          hint={`readiness ${readiness.score}/100 (${readiness.readiness})`}
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

        {/* Big 3 with live trend from logs */}
        <Card>
          <SectionHeader title="Big 3" subtitle="Current 1RM · live trend from logs" />
          <div className="space-y-4">
            <Lift
              label="Squat"
              value={profile.squat1RM}
              icon={<Dumbbell size={16} />}
              trend={liftEstimates.squat.trend}
            />
            <Lift
              label="Bench"
              value={profile.bench1RM}
              icon={<Trophy size={16} />}
              trend={liftEstimates.bench.trend}
            />
            <Lift
              label="Deadlift"
              value={profile.deadlift1RM}
              icon={<Target size={16} />}
              trend={liftEstimates.deadlift.trend}
            />
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
              max={computeProteinTargetG(profile)}
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

function Lift({
  label,
  value,
  icon,
  trend,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  trend: StrengthTrend;
}) {
  const TrendIcon =
    trend === 'improving'
      ? TrendingUp
      : trend === 'regressing'
      ? TrendingDown
      : trend === 'flat'
      ? Minus
      : HelpCircle;
  const trendClass =
    trend === 'improving'
      ? 'text-success'
      : trend === 'regressing'
      ? 'text-danger'
      : trend === 'flat'
      ? 'text-zinc-400'
      : 'text-zinc-500';
  return (
    <div className="flex items-center justify-between rounded-xl border border-ink-800 bg-ink-850 px-3 py-2.5">
      <div className="flex items-center gap-2 text-zinc-300">
        <span className="text-accent-soft">{icon}</span>
        <span className="text-sm font-semibold">{label}</span>
        <span className={`inline-flex items-center gap-1 text-[11px] ${trendClass}`}>
          <TrendIcon size={12} /> {TREND_LABEL[trend]}
        </span>
      </div>
      <div className="font-display text-xl font-semibold text-zinc-100">
        {value} <span className="text-xs font-normal text-zinc-500">lb 1RM</span>
      </div>
    </div>
  );
}
