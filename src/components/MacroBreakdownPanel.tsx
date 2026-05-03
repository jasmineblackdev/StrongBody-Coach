import { useMemo } from 'react';
import { Calculator } from 'lucide-react';
import { Card, Pill, SectionHeader } from './ui';
import { computeMacroBreakdown } from '../lib/macroEngine';
import type { Profile } from '../types';

/**
 * "Show your work" macro card. Renders the live calculation derived from
 * the user's profile — like a nutritionist's worksheet.
 *
 * Reads `profile` from props (not the store) so the Profile page can pass in
 * the in-progress draft as the user edits, before they hit Save.
 */
export default function MacroBreakdownPanel({ profile }: { profile: Profile }) {
  const b = useMemo(() => computeMacroBreakdown(profile), [profile]);
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
        <Stat
          label="Active days"
          value={Number.isInteger(b.activeDays) ? b.activeDays : b.activeDays.toFixed(1)}
          unit="/wk"
        />
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
            label="Active days/week"
            value={`${
              Number.isInteger(b.activeDays) ? b.activeDays : b.activeDays.toFixed(1)
            }`}
            note={`${profile.trainingDaysPerWeek} strength + ${
              profile.cardioPref === 'high'
                ? 4
                : profile.cardioPref === 'moderate'
                ? '2.5'
                : profile.cardioPref === 'low'
                ? 1
                : 0
            } from cardio`}
          />
          <Row
            label="Activity multiplier"
            value={b.weeklyMultiplier.toFixed(2)}
            note="Mifflin brackets: ≤1 day = 1.2, 2–3 = 1.4, 4–5 = 1.55, 6+ = 1.7"
          />
          <Row
            label="Training-day TDEE"
            value={`${b.trainingDayTdee} kcal`}
            note={`BMR × ${(b.weeklyMultiplier + 0.05).toFixed(2)}`}
          />
          <Row
            label="Rest-day TDEE"
            value={`${b.restDayTdee} kcal`}
            note={`BMR × ${(b.weeklyMultiplier - 0.05).toFixed(2)}`}
          />
          <Row
            label={`Goal: ${goalLabel[profile.goal]}`}
            value={`${b.goalDeficit > 0 ? '+' : ''}${b.goalDeficit} kcal`}
            note={
              profile.goal === 'fat_loss'
                ? '~1 lb/wk fat loss'
                : profile.goal === 'recomp'
                ? 'small deficit + high protein'
                : profile.goal === 'meet_prep'
                ? 'slight surplus for performance'
                : 'maintenance'
            }
          />
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
