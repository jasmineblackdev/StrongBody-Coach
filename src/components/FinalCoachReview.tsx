import { useMemo, useState, useSyncExternalStore } from 'react';
import {
  Check,
  X,
  Sparkles,
  ListChecks,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Activity,
  Target,
} from 'lucide-react';
import { Card, CoachMessage, Pill, SectionHeader } from './ui';
import ConfidenceBlock from './ConfidenceBlock';
import {
  DECISION_LABEL,
  DECISION_TONE,
  applyCoachDecision,
  rejectCoachDecision,
} from '../lib/weeklyDecisionEngine';
import { computeWeightTrend } from '../lib/weightTrendEngine';
import { computeReadiness } from '../lib/recoveryEngine';
import { estimateAllLifts } from '../lib/strengthEngine';
import { assessInjuryRisk } from '../lib/ml/injuryRisk';
import { analyzeFemaleFatLoss } from '../lib/femaleFatLossEngine';
import { computeConfidence } from '../lib/confidenceScoreEngine';
import { generatePredictions } from '../lib/predictionEngine';
import { voiceForDecision } from '../lib/coachVoice';
import {
  getPhotoSets,
  getPhotoVersion,
  subscribePhotos,
} from '../lib/photoStorage';
import { store } from '../lib/storage';
import { useStoreVersion } from '../hooks/useStore';

/**
 * Final Coach Review — the unified weekly card. Shows:
 *   1. What happened this week (data delta)
 *   2. What's likely next week (predictions)
 *   3. What's holding progress back (female engine + form risk + missing data)
 *   4. One recommended action with Accept / Reject
 *
 * Reads the latest pending CoachDecision from storage. When there is no
 * pending decision (e.g., the user hasn't run a /check-in yet), hides
 * itself by default — the dashboard already has a banner pushing them
 * toward the check-in.
 */
export default function FinalCoachReview({ hideIfEmpty = true }: { hideIfEmpty?: boolean }) {
  useStoreVersion();
  useSyncExternalStore(subscribePhotos, () => {
    void getPhotoVersion();
    return null;
  });

  const decisions = useMemo(() => store.getCoachDecisions(), []);
  const decision = decisions[0] ?? null;

  const context = useMemo(() => {
    const profile = store.getProfile();
    if (!profile) return null;
    const metrics = store.getMetrics();
    const logs = store.getLogs();
    const checkIns = store.getCheckIns();
    const trend = computeWeightTrend(metrics, profile);
    const recovery = computeReadiness(logs);
    const lifts = estimateAllLifts(logs, {
      baselines: {
        squat: profile.squat1RM,
        bench: profile.bench1RM,
        deadlift: profile.deadlift1RM,
      },
    });
    const injury = assessInjuryRisk(logs);
    const female = analyzeFemaleFatLoss({ metrics, recentLogs: logs, checkIns });
    const confidence = computeConfidence({
      metrics,
      recentLogs: logs,
      checkIns,
      photoSets: getPhotoSets(),
      femaleReport: female,
      injuryRisk: injury,
    });
    const predictions = generatePredictions({
      profile,
      metrics,
      recentLogs: logs,
      recoveryScore: recovery.score,
      confidence,
    });
    return {
      profile,
      metrics,
      logs,
      checkIns,
      trend,
      recovery,
      lifts,
      injury,
      female,
      confidence,
      predictions,
    };
  }, [decisions]);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState('');

  if (!decision || !context) {
    if (hideIfEmpty) return null;
    return (
      <Card>
        <div className="text-sm text-zinc-400">
          No coach review yet. Run a /check-in to generate this week's review.
        </div>
      </Card>
    );
  }

  const tone = DECISION_TONE[decision.decision];
  const isPending = decision.status === 'pending';

  // What happened this week — derived from store state
  const lastCheckIn = context.checkIns[0];
  const trend = context.trend;
  const female = context.female;
  const predictions = context.predictions;

  function accept() {
    applyCoachDecision(decision!);
  }
  function reject() {
    if (!rejectOpen) {
      setRejectOpen(true);
      return;
    }
    rejectCoachDecision(decision!.id, rejectNote.trim() || undefined);
    setRejectOpen(false);
  }

  return (
    <Card className={isPending ? 'border-accent/30' : ''}>
      <SectionHeader
        title="Weekly Coach Review"
        subtitle={`Generated ${decision.generatedAt.slice(0, 10)} · week ${decision.weekNumber}`}
        action={
          <div className="flex flex-wrap items-center gap-1.5">
            <Pill tone={tone}>{DECISION_LABEL[decision.decision]}</Pill>
            {decision.status === 'accepted' && <Pill tone="success">accepted</Pill>}
            {decision.status === 'rejected' && <Pill tone="warning">rejected</Pill>}
            {decision.status === 'pending' && <Pill tone="accent">pending</Pill>}
          </div>
        }
      />

      {/* Section 1 — What happened this week */}
      <div className="rounded-2xl border border-ink-800 bg-ink-850 p-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-300">
          <Activity size={12} /> What happened this week
        </div>
        <ul className="mt-2 space-y-1 text-sm text-zinc-200">
          <li>
            • Weight: 7-day avg {trend.sevenDayAvg.toFixed(1)} lb
            {trend.weeklyChange !== 0 && (
              <span className="ml-1 text-zinc-400">
                ({trend.weeklyChange > 0 ? '+' : ''}
                {trend.weeklyChange.toFixed(1)} lb vs prior week)
              </span>
            )}
          </li>
          {lastCheckIn && (
            <li>
              • Hunger {lastCheckIn.hungerLevel}/10 · Bloat {lastCheckIn.bloatingLevel}/10 · Energy {lastCheckIn.energyRecovery}/10
            </li>
          )}
          {context.logs.length > 0 && (
            <li>
              • {context.logs.filter((l) => Date.now() - new Date(l.date).getTime() < 7 * 86400000).length} workouts logged in the last 7 days
            </li>
          )}
        </ul>
      </div>

      {/* Section 2 — What's likely next week */}
      <div className="mt-3 rounded-2xl border border-ink-800 bg-ink-850 p-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-300">
          <Target size={12} /> What's likely next week
        </div>
        <p className="mt-2 text-sm text-zinc-200">{predictions.oneLineRead}</p>
        {predictions.weightForecast && (
          <p className="mt-1 text-[11px] text-zinc-500">
            Forecast band: {predictions.weightForecast.band.low}–{predictions.weightForecast.band.high} lb · R²{' '}
            {predictions.weightForecast.rSquared} · {predictions.weightForecast.confidence}
          </p>
        )}
        {predictions.plateauForecast.status === 'approaching_plateau' && (
          <p className="mt-1 text-[11px] text-warning">
            Plateau approaching: {predictions.plateauForecast.headline}
          </p>
        )}
      </div>

      {/* Section 3 — What's holding progress back */}
      <div className="mt-3 rounded-2xl border border-ink-800 bg-ink-850 p-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-300">
          <ShieldAlert size={12} /> What's holding progress back
        </div>
        <ul className="mt-2 space-y-1 text-sm text-zinc-200">
          {female.state !== 'on_track' && female.state !== 'insufficient_data' && (
            <li>
              • Female layer: {female.headline}
            </li>
          )}
          {context.injury.level !== 'low' && (
            <li>• Injury risk {context.injury.level} — {context.injury.flags[0] ?? ''}</li>
          )}
          {decision.observations.whatHeldBack.slice(0, 3).map((s, i) => (
            <li key={`hb-${i}`}>• {s}</li>
          ))}
          {predictions.missingData.slice(0, 2).map((s, i) => (
            <li key={`md-${i}`} className="text-zinc-400">• Missing: {s}</li>
          ))}
          {female.state === 'on_track' &&
            context.injury.level === 'low' &&
            decision.observations.whatHeldBack.length === 0 && (
              <li className="text-success">• Nothing flagged — keep stacking.</li>
            )}
        </ul>
      </div>

      {/* Section 4 — One recommended action */}
      <CoachMessage tone={tone} title={decision.headline} icon={<Sparkles size={18} />}>
        <p>{decision.reason}</p>
        <p className="mt-2 italic text-zinc-200/90">
          {voiceForDecision(decision.decision, context.confidence.level)}
        </p>
      </CoachMessage>

      <div className="mt-3">
        <ConfidenceBlock report={context.confidence} />
      </div>

      {decision.suggestedChanges.length > 0 && (
        <div className="mt-3 rounded-2xl border border-ink-800 bg-ink-850 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-300">
            <ListChecks size={12} /> What changes if accepted
          </div>
          <ul className="mt-2 space-y-1 text-sm text-zinc-200">
            {decision.suggestedChanges.map((c, i) => (
              <li key={i}>
                <span className="text-rose-glow">→</span> {c.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      {decision.safetyNotes.length > 0 && (
        <div className="mt-3 rounded-2xl border border-warning/20 bg-warning/5 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-warning">
            <ShieldAlert size={12} /> Safety notes
          </div>
          <ul className="mt-2 space-y-1 text-xs text-zinc-300">
            {decision.safetyNotes.map((s, i) => (
              <li key={i}>• {s}</li>
            ))}
          </ul>
        </div>
      )}

      {isPending && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={accept} className="btn-primary">
            <Check size={16} /> Accept and apply
          </button>
          <button onClick={reject} className="btn-outline">
            <X size={16} /> {rejectOpen ? 'Confirm reject' : 'Reject'}
          </button>
          {rejectOpen && (
            <input
              className="input flex-1 min-w-[180px]"
              placeholder="Optional: why? (so future weeks learn)"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
            />
          )}
        </div>
      )}
    </Card>
  );
}

void TrendingDown;
void TrendingUp;
