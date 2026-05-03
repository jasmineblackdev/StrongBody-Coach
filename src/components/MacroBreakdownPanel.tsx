import { useMemo } from 'react';
import { Calculator, Info } from 'lucide-react';
import { Card, Pill, SectionHeader } from './ui';
import { computeMacroBreakdown } from '../lib/macroEngine';
import { computeConfidence } from '../lib/confidenceScoreEngine';
import { analyzeFemaleFatLoss } from '../lib/femaleFatLossEngine';
import { assessInjuryRisk } from '../lib/ml/injuryRisk';
import { voiceForMacroRecommendation } from '../lib/coachVoice';
import { getPhotoSets } from '../lib/photoStorage';
import { store } from '../lib/storage';
import ConfidenceBlock from './ConfidenceBlock';
import type { Profile } from '../types';

const LIFESTYLE_LABEL: Record<NonNullable<Profile['lifestyleActivity']>, string> = {
  sedentary: 'Sedentary',
  lightly_active: 'Lightly active',
  moderately_active: 'Moderately active',
  very_active: 'Very active',
};

const FATLOSS_MODE_LABEL = {
  conservative: 'Conservative (~0.6 lb/wk)',
  standard: 'Standard (~1 lb/wk)',
  performance: 'Performance (~1.2 lb/wk)',
} as const;

/**
 * "Show your work" macro card. Renders the live calculation derived from
 * the user's profile — like a nutritionist's worksheet.
 *
 * Reads `profile` from props (not the store) so the Profile page can pass in
 * the in-progress draft as the user edits, before they hit Save.
 */
export default function MacroBreakdownPanel({ profile }: { profile: Profile }) {
  const b = useMemo(() => computeMacroBreakdown(profile), [profile]);
  const confidence = useMemo(() => {
    const metrics = store.getMetrics();
    const logs = store.getLogs();
    const checkIns = store.getCheckIns();
    const femaleReport = analyzeFemaleFatLoss({
      metrics,
      recentLogs: logs,
      checkIns,
    });
    return computeConfidence({
      metrics,
      recentLogs: logs,
      checkIns,
      photoSets: getPhotoSets(),
      femaleReport,
      injuryRisk: assessInjuryRisk(logs),
    });
  }, [profile]);

  const goalLabel: Record<Profile['goal'], string> = {
    fat_loss: 'Fat loss',
    recomp: 'Recomposition',
    strength: 'Strength',
    meet_prep: 'Meet prep',
  };

  return (
    <Card>
      <SectionHeader
        title="Your computed macros"
        subtitle="Calculated from your stats — updates as you edit. No manual entry needed."
        action={
          <Pill tone="accent">
            <Calculator size={12} /> auto
          </Pill>
        }
      />

      {/* Headline numbers */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Calories (training)" value={b.trainingDayTarget} unit="kcal" highlight />
        <Stat label="Protein" value={b.proteinG} unit="g/day" highlight />
        <Stat label="Calories (rest)" value={b.restDayTarget} unit="kcal" />
        <Stat label="Weekly avg TDEE" value={b.dailyAvgMaintenanceTDEE} unit="kcal" />
      </div>

      {/* Why this target */}
      <div className="mt-4 rounded-xl border border-accent/30 bg-accent/5 p-3 text-sm text-zinc-200">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-rose-glow">
          <Info size={12} /> Why this target
        </div>
        <p className="mt-1.5 leading-relaxed">{b.goalDeficitNote}</p>
        <p className="mt-1.5 italic text-xs text-zinc-300">
          {voiceForMacroRecommendation(confidence.level, profile.goal)}
        </p>
        {b.heavyCapApplied.train && (
          <p className="mt-1 text-xs text-warning">
            Training-day target was capped at the heavy-bodyweight fat-loss ceiling
            (2,150 kcal). Bump Lifestyle activity above "Lightly active" if step
            data supports it.
          </p>
        )}
        {b.coachOffsetKcal !== 0 && (
          <p className="mt-1 text-xs text-zinc-300">
            Coach offset: {b.coachOffsetKcal > 0 ? '+' : ''}
            {b.coachOffsetKcal} kcal applied from your accepted weekly review.
          </p>
        )}
        <p className="mt-1.5 text-[11px] text-zinc-400">
          This is a starting target. Weekly trend decides future adjustments — log
          daily weight and run a /check-in once a week.
        </p>
      </div>

      <div className="mt-3">
        <ConfidenceBlock report={confidence} />
      </div>

      {/* Macros table */}
      <div className="mt-4 rounded-xl border border-ink-800 bg-ink-850 p-3">
        <div className="grid grid-cols-4 gap-2 text-xs uppercase tracking-wider text-zinc-500">
          <div></div>
          <div>Protein</div>
          <div>Carbs</div>
          <div>Fat</div>
        </div>
        <div className="mt-1.5 grid grid-cols-4 gap-2 text-sm text-zinc-200">
          <div className="text-zinc-400">Training day</div>
          <div>{b.proteinG} g</div>
          <div>{b.carbsTrainingG} g</div>
          <div>{b.fatTrainingG} g</div>
        </div>
        <div className="mt-1 grid grid-cols-4 gap-2 text-sm text-zinc-200">
          <div className="text-zinc-400">Rest day</div>
          <div>{b.proteinG} g</div>
          <div>{b.carbsRestG} g</div>
          <div>{b.fatRestG} g</div>
        </div>
      </div>

      {/* Worksheet — show the math */}
      <details className="mt-4 group">
        <summary className="flex cursor-pointer list-none items-center justify-between text-xs uppercase tracking-wider text-zinc-400">
          <span>How we calculated this</span>
          <span className="text-[10px] text-zinc-500 group-open:hidden">Show</span>
          <span className="hidden text-[10px] text-zinc-500 group-open:inline">Hide</span>
        </summary>
        <div className="mt-3 space-y-1.5 text-xs text-zinc-300">
          <Row
            label="Age"
            value={`${b.age} yr`}
            note={profile.birthDate ? `from birthDate ${profile.birthDate}` : 'from profile'}
          />
          <Row
            label="BMR (Mifflin-St Jeor, female)"
            value={`${b.bmr} kcal`}
            note={`10 × ${(profile.weightLbs * 0.4536).toFixed(1)} kg + 6.25 × ${(
              profile.heightInches * 2.54
            ).toFixed(1)} cm − 5 × ${b.age} − 161`}
          />
          <Row
            label="Lifestyle activity (NEAT)"
            value={`${LIFESTYLE_LABEL[b.lifestyle]} (×${b.lifestyleMultiplier.toFixed(2)})`}
            note="Daily non-exercise activity. Workouts are credited separately below — no double-counting."
          />
          <Row
            label="Lift sessions"
            value={`${b.liftSessionsPerWeek}/wk × ${b.liftKcalPerSession} kcal`}
            note={`Per-session credit ≈ ${b.liftKcalPerSession} kcal for a ${profile.weightLbs}-lb lifter (60-min strength)`}
          />
          <Row
            label="Cardio sessions"
            value={
              b.cardioSessionsPerWeek > 0
                ? `${b.cardioSessionsPerWeek}/wk × ${b.cardioKcalPerSession} kcal`
                : 'none'
            }
            note={
              b.cardioSessionsPerWeek > 0
                ? `Per-session credit ≈ ${b.cardioKcalPerSession} kcal (moderate intensity)`
                : 'Cardio preference is set to none'
            }
          />
          <Row
            label="Weekly maintenance TDEE"
            value={`${b.weeklyMaintenanceTDEE} kcal`}
            note={`Daily avg ≈ ${b.dailyAvgMaintenanceTDEE} kcal`}
          />
          <Row
            label="Training-day TDEE"
            value={`${b.trainingDayTdee} kcal`}
            note="BMR × lifestyle + lift session"
          />
          <Row
            label="Rest-day TDEE"
            value={`${b.restDayTdee} kcal`}
            note="BMR × lifestyle + averaged cardio"
          />
          <Row
            label={`Goal: ${goalLabel[profile.goal]}`}
            value={`${b.goalDeficit > 0 ? '+' : ''}${b.goalDeficit} kcal/day`}
            note={
              b.fatLossMode
                ? `Fat-loss mode: ${FATLOSS_MODE_LABEL[b.fatLossMode]}`
                : b.goalDeficitNote
            }
          />
          {b.coachOffsetKcal !== 0 && (
            <Row
              label="Coach decision offset"
              value={`${b.coachOffsetKcal > 0 ? '+' : ''}${b.coachOffsetKcal} kcal`}
              note="From your last accepted weekly review"
            />
          )}
          {(b.heavyCapApplied.train || b.heavyCapApplied.rest) && (
            <Row
              label="Heavy-bodyweight cap"
              value={`${b.heavyCapApplied.train ? 'training capped' : ''}${
                b.heavyCapApplied.train && b.heavyCapApplied.rest ? ' + ' : ''
              }${b.heavyCapApplied.rest ? 'rest capped' : ''}`}
              note="Above 200 lb on fat-loss with default lifestyle, ceilings: 2,150 train / 1,950 rest"
            />
          )}
          <Row
            label="Hard floor"
            value={`${b.hardFloor} kcal`}
            note="never below max(1500, weight × 8, BMR × 0.85)"
          />
          <Row
            label="Protein target"
            value={`${b.proteinG} g`}
            note={b.proteinFormula}
          />
        </div>
      </details>

      <p className="mt-3 text-xs text-zinc-500">
        These targets feed the Meals page automatically. Override any value via the inputs in
        the Nutrition section above.
      </p>
    </Card>
  );
}

function Stat({
  label,
  value,
  unit,
  highlight = false,
}: {
  label: string;
  value: number | string;
  unit: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        highlight ? 'border-accent/40 bg-accent/10' : 'border-ink-800 bg-ink-850'
      }`}
    >
      <div className="text-[10px] uppercase tracking-wider text-zinc-400">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="font-display text-xl font-semibold text-zinc-100">{value}</span>
        <span className="text-xs text-zinc-500">{unit}</span>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-zinc-400">{label}</span>
      <span className="text-right">
        <span className="font-mono text-zinc-100">{value}</span>
        {note && <span className="block text-[10px] text-zinc-500">{note}</span>}
      </span>
    </div>
  );
}
