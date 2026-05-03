import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Flame, Dumbbell, Trophy, HeartPulse, Salad, Target, TrendingUp, TrendingDown, Minus, HelpCircle, Sparkles, BellRing, Play, Power } from 'lucide-react';
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
import FinalCoachReview from '../components/FinalCoachReview';
import DecisionHistoryPanel from '../components/DecisionHistoryPanel';
import FatLossInsightCard from '../components/FatLossInsightCard';
import FatLossTimelineCard from '../components/FatLossTimelineCard';
import PhotoSignalCard from '../components/PhotoSignalCard';
import HomeSessionCard from '../components/HomeSessionCard';
import TodayCoachAction from '../components/TodayCoachAction';
import TodayMealsSummary from '../components/TodayMealsSummary';
import WeekAheadCard from '../components/WeekAheadCard';
import type { WorkoutDay, WorkoutSession } from '../types';

function todayWorkout(weekNumber: number): WorkoutSession | null {
  const plan = store.getPlan();
  if (!plan) return null;
  void weekNumber;
  const dayOfWeek = new Date().getDay(); // 0..6
  // Lift Mon–Thu, Home (Core + Cardio) Fri–Sun. Returns null on home
  // days so the Dashboard surfaces the HomeSessionCard instead of the
  // Today CTA + workout.
  const map: Record<number, WorkoutDay> = {
    1: 'squat',           // Mon
    2: 'bench',            // Tue
    3: 'deadlift',         // Wed
    4: 'upper_accessory',  // Thu
  };
  const target = map[dayOfWeek];
  if (!target) return null;
  return plan.sessions.find((s) => s.day === target) ?? plan.sessions[0];
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

  const isTrainingDayToday = ![5, 6, 0].includes(new Date().getDay()); // Fri/Sat/Sun = home (core+cardio) days
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

  const gymMode = profile.gymMode === true;
  const toggleGymMode = () => {
    const current = store.getProfile();
    if (!current) return;
    store.setProfile({ ...current, gymMode: !gymMode });
  };

  return (
    <div className="space-y-6">
      {/* Today CTA — primary action above everything else. Big, high-
          contrast, finger-targeted. Always visible regardless of Gym Mode. */}
      <div className="flex flex-wrap items-stretch gap-3">
        <Link
          to="/log"
          className="flex flex-1 items-center justify-between gap-3 rounded-2xl border-2 border-accent/40 bg-accent/15 px-5 py-4 text-left shadow-glow transition active:scale-[0.99] hover:bg-accent/25"
        >
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-rose-glow">
              {todays ? 'Today' : 'Rest day'}
            </div>
            <div className="mt-0.5 truncate font-display text-xl font-bold text-zinc-100">
              {todays ? `Start ${dayLabel[todays.day]}` : 'Recover and refuel'}
            </div>
            <div className="mt-0.5 text-xs text-zinc-300">
              {todays
                ? `${todays.prescriptions.length} exercises · ${plan.phase} block`
                : `${profile.dailyStepsTarget ?? 8000} steps · protein at every meal · log weight`}
            </div>
          </div>
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-white shadow-glow">
            <Play size={22} />
          </span>
        </Link>
        <button
          onClick={toggleGymMode}
          aria-pressed={gymMode}
          className={`shrink-0 rounded-2xl border-2 px-4 py-3 text-sm font-semibold transition active:scale-95 ${
            gymMode
              ? 'border-success/40 bg-success/15 text-success'
              : 'border-ink-700 bg-ink-850 text-zinc-200 hover:bg-ink-800'
          }`}
        >
          <Power size={14} className="mr-1.5 inline-block" />
          Gym Mode {gymMode ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Home Core + Cardio — today's session when it's a rest day.
          Self-hides on lift days. Shows the day's 3-of-3 rotation
          variant, cycle week, and any safety swap (abs sore /
          lower-back). */}
      {!todays && <HomeSessionCard />}

      {/* Rest-day plan card — only when no workout today. Concrete steps /
          cardio / recovery / meal-timing reminder so the rest day still
          has structure. Sits below the home session for everyone who
          wants the lifestyle reminders. */}
      {!todays && (() => {
        const volumePref = profile.workoutVolumePreference ?? (profile.goal === 'fat_loss' ? 'compact' : 'standard');
        const showCoreCircuit = volumePref !== 'high';
        return (
        <Card>
          <SectionHeader
            title="Rest day plan"
            subtitle="Today is a recovery day — don't waste it"
            action={<Pill tone="accent">recovery</Pill>}
          />
          <div className={`grid gap-3 ${showCoreCircuit ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
            <div className="rounded-xl border border-ink-800 bg-ink-850 p-3">
              <div className="text-[11px] uppercase tracking-wider text-zinc-400">
                Movement
              </div>
              <div className="mt-1 text-sm font-semibold text-zinc-100">
                {profile.dailyStepsTarget ?? 8000} steps
              </div>
              <div className="mt-0.5 text-xs text-zinc-400">
                {profile.cardioPref === 'high'
                  ? '+ a moderate cardio session if you have it'
                  : profile.cardioPref === 'moderate'
                  ? 'optional 20–30 min low-intensity cardio'
                  : 'easy walk; let the body recover'}
              </div>
            </div>
            {showCoreCircuit && (
              <div className="rounded-xl border border-accent/30 bg-accent/5 p-3">
                <div className="text-[11px] uppercase tracking-wider text-rose-glow">
                  Core circuit (stability ball)
                </div>
                <div className="mt-1 text-sm font-semibold text-zinc-100">
                  3 rounds, 60s rest
                </div>
                <ul className="mt-0.5 space-y-0.5 text-xs text-zinc-300">
                  <li>• Stability Ball Plank · 30s</li>
                  <li>• Stability Ball Crunch · 12 reps</li>
                  <li>• Stability Ball Knee Tuck · 8 reps</li>
                </ul>
                <div className="mt-1 text-[10px] text-zinc-500">
                  Stability ball protects the low back vs floor variants.
                </div>
              </div>
            )}
            <div className="rounded-xl border border-ink-800 bg-ink-850 p-3">
              <div className="text-[11px] uppercase tracking-wider text-zinc-400">
                Nutrition
              </div>
              <div className="mt-1 text-sm font-semibold text-zinc-100">
                Protein at every meal
              </div>
              <div className="mt-0.5 text-xs text-zinc-400">
                {profile.mealTimes && profile.mealTimes.length > 0
                  ? `Hit your meal times: ${profile.mealTimes.join(', ')}`
                  : 'Spread protein evenly across 4–5 meals'}
              </div>
            </div>
            <div className="rounded-xl border border-ink-800 bg-ink-850 p-3">
              <div className="text-[11px] uppercase tracking-wider text-zinc-400">
                Recovery
              </div>
              <div className="mt-1 text-sm font-semibold text-zinc-100">
                Sleep · hydrate · log
              </div>
              <div className="mt-0.5 text-xs text-zinc-400">
                Log today's weight + waist · 7+ hrs sleep · 80–100 oz water
              </div>
            </div>
          </div>
        </Card>
        );
      })()}

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

      {/* Today's workout — top 3 by default; expand for full preview. */}
      {todays && !gymMode && (
        <details className="group rounded-2xl border border-ink-800 bg-ink-850 transition open:border-accent/30">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-3">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Top focus today
              </div>
              <div className="truncate text-sm font-bold text-zinc-100">
                {dayLabel[todays.day]} · {todays.prescriptions.length} exercises
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 group-open:hidden">
                Preview
              </span>
              <span className="hidden text-[11px] font-semibold uppercase tracking-wider text-zinc-500 group-open:inline">
                Hide
              </span>
              <Link to="/log" className="btn-primary">
                <Dumbbell size={14} /> Start
              </Link>
            </div>
          </summary>
          <div className="border-t border-ink-800 px-3 py-3">
            <ul className="space-y-2 text-sm">
              {todays.prescriptions.map((p, i) => (
                <li
                  key={p.name}
                  className="flex items-baseline justify-between gap-2 rounded-lg border border-ink-800 bg-ink-900/40 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                      {i + 1}
                    </div>
                    <div className="truncate text-zinc-100">{p.name}</div>
                  </div>
                  <div className="shrink-0 text-right text-xs text-zinc-400">
                    <div className="text-zinc-100">
                      {p.sets} × {p.reps}
                    </div>
                    <div>
                      {p.loadLbs ? `${p.loadLbs} lb` : 'bodyweight'}
                      {p.rpeTarget ? ` · RPE ${p.rpeTarget}` : ''}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {todays.coachNote && (
              <div className="mt-3 rounded-lg border border-accent/30 bg-accent/5 p-2.5 text-xs italic text-zinc-200">
                "{todays.coachNote}"
              </div>
            )}
          </div>
        </details>
      )}

      {/* Coach Insights — everything analysis-heavy collapses here so
          the Today screen stays focused on action. Default closed; user
          opens to dig into goal banner, predictions, decisions, charts,
          weak points, etc. Hidden entirely in Gym Mode. */}
      {!gymMode && (
      <details className="group rounded-2xl border border-ink-800 bg-ink-850/50">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 text-rose-glow">
              <Sparkles size={16} />
            </span>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Coach Insights
              </div>
              <div className="text-sm font-bold text-zinc-100">
                Goal · trend · forecasts · history
              </div>
            </div>
          </div>
          <span className="text-[10px] text-zinc-500 group-open:hidden">Show</span>
          <span className="hidden text-[10px] text-zinc-500 group-open:inline">Hide</span>
        </summary>

        <div className="space-y-6 border-t border-ink-800 p-4">

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

      {/* Today's coach action — single line, expandable for full reasoning. */}
      {!gymMode && <TodayCoachAction />}

      {/* Today's meals — compact summary, links to /meals for detail. */}
      {!gymMode && <TodayMealsSummary />}

      {/* Coming up this week — Core + Cardio home days listed with their
          weekday labels (Fri / Sat / Sun). */}
      {!gymMode && <WeekAheadCard />}

      {!gymMode && (
        <>
          {/* Final Coach Review — unified weekly card. Hides itself
              when there is no pending decision. */}
          <FinalCoachReview />

          {/* Decision history with outcomes (predicted vs actual after 7d).
              Hides when zero decisions have been logged. */}
          <DecisionHistoryPanel />
        </>
      )}

      {/* Adherence + plateau card — answers "why isn't this working?" */}
      {!gymMode && plateau && (
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

      {/* Predictions card — ML-lite forecasts. Hidden in Gym Mode. */}
      {!gymMode && (
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
      )}

      {/* Specific fat-loss action card kept as a focused secondary read.
          Hidden in Gym Mode. */}
      {!gymMode && (
        <CoachMessage
          tone={recommendationTone(fatLoss.primary.kind)}
          title={`This week: ${fatLoss.primary.headline}`}
        >
          {fatLoss.primary.body}
        </CoachMessage>
      )}

      {!gymMode && (() => {
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
        {/* Today's workout + Today's macros cards REMOVED — they
            duplicate the Top focus + TodayMealsSummary already shown
            on the Today screen. The doughnut version was also computing
            with hungerLevel which made calories diverge by 100–150 kcal
            from the meals page. Single source of truth now: the Today
            screen meals/workout components. */}

        {/* Big 3 with live trend from logs */}
        <Card className="lg:col-span-3">
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
        <Card className="lg:col-span-3">
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

        </div>{/* /Coach Insights inner padding */}
      </details>
      )}{/* /!gymMode Coach Insights */}
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
