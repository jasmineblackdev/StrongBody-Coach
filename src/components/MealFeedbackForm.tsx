import { useState } from 'react';
import { Plus, Save } from 'lucide-react';
import { Card, Pill, SectionHeader } from './ui';
import { store } from '../lib/storage';
import type { MealFeedback } from '../types';

const QUICK_MEAL_NAMES = ['Breakfast', 'Mid-morning', 'Lunch', 'Pre-workout', 'Post-workout', 'Dinner', 'Evening'];

function todayIso(): string {
  return new Date().toISOString();
}

function cryptoRandomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `mf_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Quick-log form for meal feedback. Single-screen: meal name + ingredients
 * (comma) + 4 sliders. Designed to fit a phone screen — opens collapsed.
 */
export default function MealFeedbackForm({ onSaved }: { onSaved?: () => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Omit<MealFeedback, 'id'>>({
    date: todayIso(),
    mealName: 'Lunch',
    ingredients: [],
    hungerAfter: 5,
    bloatingAfter: 4,
    energyAfter: 6,
    digestionAfter: 7,
    workoutPerfNote: '',
  });
  const [ingredientText, setIngredientText] = useState('');

  function set<K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function save() {
    const ingredients = ingredientText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!ingredients.length) {
      alert('Add at least one ingredient (comma-separated).');
      return;
    }
    const entry: MealFeedback = {
      ...draft,
      id: cryptoRandomId(),
      date: todayIso(),
      ingredients,
    };
    store.addMealFeedback(entry);
    // Reset form
    setIngredientText('');
    setDraft((prev) => ({
      ...prev,
      hungerAfter: 5,
      bloatingAfter: 4,
      energyAfter: 6,
      digestionAfter: 7,
      workoutPerfNote: '',
    }));
    setOpen(false);
    onSaved?.();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="btn-outline w-full"
      >
        <Plus size={14} /> Log meal feedback
      </button>
    );
  }

  return (
    <Card>
      <SectionHeader
        title="Log meal feedback"
        subtitle="Takes 15 seconds. Pattern detection needs 3+ meals before flagging."
        action={<Pill>quick log</Pill>}
      />

      <div className="space-y-3">
        <label>
          <span className="label">Meal</span>
          <div className="flex flex-wrap gap-2">
            {QUICK_MEAL_NAMES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => set('mealName', n)}
                className={`btn ${draft.mealName === n ? 'btn-primary' : 'btn-outline'}`}
              >
                {n}
              </button>
            ))}
          </div>
        </label>

        <label className="block">
          <span className="label">Ingredients (comma-separated)</span>
          <input
            className="input"
            placeholder="e.g., chicken, rice, broccoli, olive oil"
            value={ingredientText}
            onChange={(e) => setIngredientText(e.target.value)}
          />
          <p className="mt-1 text-[11px] text-zinc-500">
            Just key ingredients. The engine pattern-matches on these tokens.
          </p>
        </label>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Slider
            label="Hunger after"
            value={draft.hungerAfter}
            onChange={(v) => set('hungerAfter', v)}
          />
          <Slider
            label="Bloating after"
            value={draft.bloatingAfter}
            onChange={(v) => set('bloatingAfter', v)}
          />
          <Slider
            label="Energy after"
            value={draft.energyAfter}
            onChange={(v) => set('energyAfter', v)}
          />
          <Slider
            label="Digestion comfort"
            value={draft.digestionAfter}
            onChange={(v) => set('digestionAfter', v)}
          />
        </div>

        <label className="block">
          <span className="label">Workout performance note (optional)</span>
          <input
            className="input"
            placeholder="e.g., felt heavy on squats; clean run"
            value={draft.workoutPerfNote ?? ''}
            onChange={(e) => set('workoutPerfNote', e.target.value)}
          />
        </label>

        <div className="flex gap-2">
          <button onClick={save} className="btn-primary flex-1">
            <Save size={14} /> Save
          </button>
          <button onClick={() => setOpen(false)} className="btn-outline">
            Cancel
          </button>
        </div>
      </div>
    </Card>
  );
}

function Slider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="label">
        {label}: {value}/10
      </span>
      <input
        type="range"
        min={1}
        max={10}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-pink-500"
      />
    </label>
  );
}
