import { useState } from 'react';
import { Save } from 'lucide-react';
import { Card, CoachMessage, SectionHeader, Pill } from '../components/ui';
import { useStoreVersion } from '../hooks/useStore';
import CloudPanel from '../components/CloudPanel';
import TestDataPanel from '../components/TestDataPanel';
import OneRMSuggestionPanel from '../components/OneRMSuggestionPanel';
import ExportImportPanel from '../components/ExportImportPanel';
import MacroBreakdownPanel from '../components/MacroBreakdownPanel';
import { store } from '../lib/storage';
import { buildWeeklyPlan } from '../lib/workoutPlan';
import { computeProteinTargetG } from '../lib/macroEngine';
import type {
  CardioPref,
  FatLossMode,
  Goal,
  LifestyleActivity,
  Profile,
  ProblemArea,
} from '../types';

const PROBLEM_AREAS: { key: ProblemArea; label: string }[] = [
  { key: 'core', label: 'Core' },
  { key: 'glutes', label: 'Glutes' },
  { key: 'lower_back', label: 'Lower back safety' },
  { key: 'grip', label: 'Grip' },
  { key: 'belly_bloat', label: 'Belly fat / bloat' },
  { key: 'shoulders', label: 'Shoulders' },
  { key: 'hamstrings', label: 'Hamstrings' },
];

const GOALS: { key: Goal; label: string }[] = [
  { key: 'fat_loss', label: 'Fat loss' },
  { key: 'recomp', label: 'Recomposition' },
  { key: 'strength', label: 'Strength' },
  { key: 'meet_prep', label: 'Meet prep' },
];

const CARDIO: { key: CardioPref; label: string }[] = [
  { key: 'none', label: 'None' },
  { key: 'low', label: 'Low (walks)' },
  { key: 'moderate', label: 'Moderate (2–3 sessions)' },
  { key: 'high', label: 'High (4+ sessions)' },
];

const LIFESTYLE: { key: LifestyleActivity; label: string; sub: string }[] = [
  { key: 'sedentary', label: 'Sedentary', sub: 'Desk job, drive everywhere, < 5k steps' },
  { key: 'lightly_active', label: 'Lightly active', sub: 'Default. Some standing/walking, no step goal' },
  { key: 'moderately_active', label: 'Moderately active', sub: 'On feet most of the day (retail, nursing, parent of toddlers)' },
  { key: 'very_active', label: 'Very active', sub: 'Manual labor (construction, moving, landscaping)' },
];

const FAT_LOSS_MODES: { key: FatLossMode; label: string; sub: string }[] = [
  { key: 'conservative', label: 'Conservative', sub: '~0.6 lb/wk · protect strength' },
  { key: 'standard', label: 'Standard', sub: '~1 lb/wk · the sweet spot' },
  { key: 'performance', label: 'Performance', sub: '~1.2 lb/wk · for users with significant fat to lose' },
];

export default function ProfilePage() {
  useStoreVersion();
  const [p, setP] = useState<Profile>(() => store.getProfile()!);
  const [saved, setSaved] = useState(false);

  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    setP((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function toggleArea(area: ProblemArea) {
    const set = new Set(p.problemAreas);
    set.has(area) ? set.delete(area) : set.add(area);
    update('problemAreas', Array.from(set));
  }

  function save() {
    const previous = store.getProfile();
    const currentPhase = store.getPlan()?.phase ?? 'hypertrophy';
    store.setProfile(p);
    // Preserve the user's current training phase — never silently force
    // hypertrophy on save. Bug fix C1.
    store.setPlan(buildWeeklyPlan(p, store.getWeekNumber(), currentPhase));

    // If body weight changed, log a body metric for today so Dashboard / Progress
    // / charts pick it up immediately. Replaces today's metric if one exists,
    // otherwise prepends a new entry.
    const weightChanged = !previous || previous.weightLbs !== p.weightLbs;
    if (weightChanged) {
      const today = new Date().toISOString().slice(0, 10);
      const existing = store.getMetrics();
      const todayIdx = existing.findIndex((m) => m.date === today);
      if (todayIdx >= 0) {
        const next = [...existing];
        next[todayIdx] = { ...next[todayIdx], weightLbs: p.weightLbs };
        store.setMetrics(next);
      } else {
        store.addMetric({ date: today, weightLbs: p.weightLbs });
      }
    }

    setSaved(true);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="h1">Profile & Goals</h1>
        <p className="muted text-sm mt-1">
          Update anything here — your workout plan, macros, and coaching messages adjust on save.
        </p>
      </header>

      <CoachMessage tone="accent" title="How I'll use this">
        Your bodyweight, training days, problem areas, and goal drive every workout, meal, and weak-point alert.
        Be honest about pain and food sensitivities — those make the biggest difference.
      </CoachMessage>

      <ExportImportPanel />

      {/* Cloud sync — collapsed by default; opt-in once, then forget. */}
      <details className="card group">
        <summary className="flex cursor-pointer items-center justify-between gap-3 list-none">
          <div>
            <div className="h2 text-base">Advanced · Cloud sync</div>
            <div className="muted text-xs mt-0.5">
              Optional. Sign in once to back up your data across devices via Supabase. Most users
              don't need this — Export / Import above covers backups offline.
            </div>
          </div>
          <span className="shrink-0 rounded-lg border border-ink-700 px-2 py-1 text-xs text-zinc-300 group-open:hidden">
            Show
          </span>
          <span className="hidden shrink-0 rounded-lg border border-ink-700 px-2 py-1 text-xs text-zinc-300 group-open:inline">
            Hide
          </span>
        </summary>
        <div className="mt-4">
          <CloudPanel />
        </div>
      </details>

      {/* TestDataPanel: dev-only — gated by import.meta.env.DEV so it's
          stripped from production builds entirely. */}
      {import.meta.env.DEV && <TestDataPanel />}

      {/* Live macro calculation worksheet — derives BMR / TDEE / targets
          from the in-progress profile draft as the user edits. */}
      <MacroBreakdownPanel profile={p} />

      <OneRMSuggestionPanel />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <SectionHeader title="You" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Name">
              <input className="input" value={p.name} onChange={(e) => update('name', e.target.value)} />
            </Field>
            <Field label="Age">
              <input
                type="number"
                className="input"
                value={p.age}
                onChange={(e) => update('age', Number(e.target.value))}
              />
            </Field>
            <Field label="Birthday (optional, auto-updates age)">
              <input
                type="date"
                className="input"
                value={p.birthDate ?? ''}
                onChange={(e) => update('birthDate', e.target.value || undefined)}
              />
            </Field>
            <Field label="Height (in)">
              <input
                type="number"
                className="input"
                value={p.heightInches}
                onChange={(e) => update('heightInches', Number(e.target.value))}
              />
            </Field>
            <Field label="Current weight (lb)">
              <input
                type="number"
                className="input"
                value={p.weightLbs}
                onChange={(e) => update('weightLbs', Number(e.target.value))}
              />
            </Field>
            <Field label="Goal weight (lb)">
              <input
                type="number"
                className="input"
                value={p.goalWeightLbs}
                onChange={(e) => update('goalWeightLbs', Number(e.target.value))}
              />
            </Field>
            <Field label="Training days / week">
              <input
                type="number"
                min={3}
                max={6}
                className="input"
                value={p.trainingDaysPerWeek}
                onChange={(e) => update('trainingDaysPerWeek', Number(e.target.value))}
              />
            </Field>
          </div>

          <div className="mt-4">
            <span className="label">Goal</span>
            <div className="flex flex-wrap gap-2">
              {GOALS.map((g) => (
                <button
                  key={g.key}
                  onClick={() => update('goal', g.key)}
                  className={`btn ${p.goal === g.key ? 'btn-primary' : 'btn-outline'}`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <span className="label">Cardio preference</span>
            <div className="flex flex-wrap gap-2">
              {CARDIO.map((c) => (
                <button
                  key={c.key}
                  onClick={() => update('cardioPref', c.key)}
                  className={`btn ${p.cardioPref === c.key ? 'btn-primary' : 'btn-outline'}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <span className="label">Lifestyle activity (NEAT)</span>
            <div className="flex flex-wrap gap-2">
              {LIFESTYLE.map((l) => {
                const active = (p.lifestyleActivity ?? 'lightly_active') === l.key;
                return (
                  <button
                    key={l.key}
                    onClick={() => update('lifestyleActivity', l.key)}
                    className={`btn flex-col items-start text-left ${active ? 'btn-primary' : 'btn-outline'}`}
                    title={l.sub}
                  >
                    <span>{l.label}</span>
                    <span className="text-[10px] font-normal opacity-80">{l.sub}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">
              Lifting + cardio are credited separately as workout calories — don't bump
              this just because you train. Default is Lightly active.
            </p>
          </div>

          {p.goal === 'fat_loss' && (
            <div className="mt-4">
              <span className="label">Fat-loss mode</span>
              <div className="flex flex-wrap gap-2">
                {FAT_LOSS_MODES.map((m) => {
                  const active = (p.fatLossMode ?? 'standard') === m.key;
                  return (
                    <button
                      key={m.key}
                      onClick={() => update('fatLossMode', m.key)}
                      className={`btn flex-col items-start text-left ${active ? 'btn-primary' : 'btn-outline'}`}
                      title={m.sub}
                    >
                      <span>{m.label}</span>
                      <span className="text-[10px] font-normal opacity-80">{m.sub}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <label className="mt-4 flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={p.onWegovy}
              onChange={(e) => update('onWegovy', e.target.checked)}
              className="h-4 w-4 accent-pink-500"
            />
            On Wegovy (adjust hunger / GI guidance)
          </label>

          <label className="mt-3 flex items-start gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={p.autoCoach ?? false}
              onChange={(e) => update('autoCoach', e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-pink-500"
            />
            <span>
              <span className="font-semibold text-zinc-100">Auto-Coach Mode</span>
              <span className="block text-xs text-zinc-400">
                When enabled, StrongBody Coach reviews your logs weekly and drafts
                changes for approval. Nothing applies until you accept.
              </span>
            </span>
          </label>
        </Card>

        <Card>
          <SectionHeader title="Lifts" subtitle="Used to prescribe loads in your plan" />
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <Field label="Squat 1RM">
              <input
                type="number"
                className="input"
                value={p.squat1RM}
                onChange={(e) => update('squat1RM', Number(e.target.value))}
              />
            </Field>
            <Field label="Bench 1RM">
              <input
                type="number"
                className="input"
                value={p.bench1RM}
                onChange={(e) => update('bench1RM', Number(e.target.value))}
              />
            </Field>
            <Field label="Deadlift 1RM">
              <input
                type="number"
                className="input"
                value={p.deadlift1RM}
                onChange={(e) => update('deadlift1RM', Number(e.target.value))}
              />
            </Field>
          </div>

          <SectionHeader title="Problem areas" subtitle="What we'll target every week" />
          <div className="flex flex-wrap gap-2">
            {PROBLEM_AREAS.map((a) => {
              const active = p.problemAreas.includes(a.key);
              return (
                <button
                  key={a.key}
                  onClick={() => toggleArea(a.key)}
                  className={`btn ${active ? 'btn-primary' : 'btn-outline'}`}
                >
                  {a.label}
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="md:col-span-2">
          <SectionHeader title="Nutrition" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Meals per day">
              <input
                type="number"
                min={3}
                max={6}
                className="input"
                value={p.mealCount}
                onChange={(e) => update('mealCount', Number(e.target.value))}
              />
            </Field>
            <Field label="Protein target (g)">
              <ProteinTargetField
                profile={p}
                onChange={(g) => update('proteinTargetG', g)}
              />
            </Field>
            <Field label="Food dislikes (comma)">
              <input
                className="input"
                value={p.foodDislikes.join(', ')}
                onChange={(e) =>
                  update(
                    'foodDislikes',
                    e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                  )
                }
              />
            </Field>
            <Field label="Food sensitivities (comma)" className="md:col-span-3">
              <input
                className="input"
                value={p.foodSensitivities.join(', ')}
                onChange={(e) =>
                  update(
                    'foodSensitivities',
                    e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                  )
                }
              />
            </Field>

            <Field label="Workout time (HH:MM, 24h)">
              <input
                type="time"
                className="input"
                value={p.workoutTime ?? ''}
                onChange={(e) => update('workoutTime', e.target.value || undefined)}
              />
            </Field>

            <Field label="Meal times (comma, 24h)" className="md:col-span-2">
              <input
                className="input"
                placeholder="07:30, 10:30, 13:00, 15:30, 20:00"
                value={(p.mealTimes ?? []).join(', ')}
                onChange={(e) =>
                  update(
                    'mealTimes',
                    e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  )
                }
              />
            </Field>
          </div>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {p.problemAreas.map((a) => (
            <Pill key={a} tone="accent">
              targeting: {a.replace('_', ' ')}
            </Pill>
          ))}
        </div>
        <button onClick={save} className="btn-primary">
          <Save size={16} /> {saved ? 'Saved' : 'Save & rebuild plan'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={className}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

/**
 * Protein input with an auto-computed readout. When the user has not set
 * a manual override, the field is empty (so they aren't tricked into
 * thinking the auto value is locked in) but a readout below the input
 * shows the computed value, e.g. "Auto: 185g". Editing the field stores
 * the value as a manual override; "Use auto" clears it back to undefined.
 */
function ProteinTargetField({
  profile,
  onChange,
}: {
  profile: Profile;
  onChange: (g: number | undefined) => void;
}) {
  const isManual = !!profile.proteinTargetG && profile.proteinTargetG > 0;
  // Build a temp profile WITHOUT the override so we can show what the
  // auto value would be even when a manual override is set.
  const autoProfile: Profile = { ...profile, proteinTargetG: undefined };
  const autoG = computeProteinTargetG(autoProfile);

  return (
    <div>
      <input
        type="number"
        className="input"
        value={profile.proteinTargetG ?? ''}
        placeholder={`${autoG} (auto)`}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
      />
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
        <span>
          {isManual ? (
            <>
              Manual override active. Auto would be{' '}
              <span className="font-semibold text-zinc-300">{autoG}g</span>.
            </>
          ) : (
            <>
              <span className="font-semibold text-zinc-300">{autoG}g</span> auto —
              calculated from goal, weight, and goal weight. Edit to override.
            </>
          )}
        </span>
        {isManual && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="rounded-md border border-ink-700 bg-ink-850 px-2 py-0.5 text-[11px] font-semibold text-zinc-200 hover:bg-ink-800"
          >
            Use auto protein
          </button>
        )}
      </div>
    </div>
  );
}
