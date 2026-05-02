import type { DailyMealPlan, MealItem, Profile } from '../types';

interface PlanContext {
  profile: Profile;
  isTrainingDay: boolean;
  hungerLevel?: number; // 1-10 (today)
  workoutTime?: 'morning' | 'midday' | 'evening';
}

// Mifflin-St Jeor for women
function bmrFemale(p: Profile) {
  const kg = p.weightLbs * 0.4536;
  const cm = p.heightInches * 2.54;
  return 10 * kg + 6.25 * cm - 5 * p.age - 161;
}

function targetCalories(p: Profile, isTrainingDay: boolean, hungerLevel = 5) {
  const bmr = bmrFemale(p);
  const activity = isTrainingDay ? 1.5 : 1.35;
  let tdee = bmr * activity;

  // Goal-based deficit/surplus
  if (p.goal === 'fat_loss') tdee -= 450;
  else if (p.goal === 'recomp') tdee -= 250;
  else if (p.goal === 'meet_prep') tdee += 50;
  // strength: maintenance

  // Wegovy adjustment: if appetite is low, allow a softer floor
  if (p.onWegovy && hungerLevel <= 3) tdee -= 100;
  if (hungerLevel >= 8) tdee += 150;

  // Floor for a 5'2" lifter
  return Math.max(1450, Math.round(tdee / 10) * 10);
}

function macros(p: Profile, calories: number, isTrainingDay: boolean) {
  const proteinG = Math.max(p.proteinTargetG ?? 0, Math.round(p.weightLbs * 0.9));
  const proteinCals = proteinG * 4;
  // Carbs: more on training days, especially around workout
  const carbsG = Math.round(((isTrainingDay ? 0.42 : 0.32) * calories) / 4);
  const carbCals = carbsG * 4;
  const fatCals = Math.max(0, calories - proteinCals - carbCals);
  const fatG = Math.max(40, Math.round(fatCals / 9));
  return { proteinG, carbsG, fatG };
}

function dislikeFilter(p: Profile, ing: string): boolean {
  const all = [...p.foodDislikes, ...p.foodSensitivities].map((s) => s.toLowerCase());
  return !all.some((bad) => ing.toLowerCase().includes(bad.replace(/\(.*\)/, '').trim()));
}

interface MealTemplate {
  name: string;
  proteinG: number;
  carbsG: number;
  fatG: number;
  ingredients: string[];
  swap?: string;
  tags?: string[]; // 'training', 'rest', 'low-bloat', 'pre', 'post'
}

const TEMPLATES: MealTemplate[] = [
  {
    name: 'Greek-Style Egg Bowl',
    proteinG: 38,
    carbsG: 30,
    fatG: 14,
    ingredients: ['3 whole eggs', '1/2 cup egg whites', '1 cup spinach', '1/2 cup cherry tomatoes', '1/2 cup oats with berries'],
    swap: 'Sub turkey bacon for 1 whole egg if cutting fat further.',
    tags: ['low-bloat'],
  },
  {
    name: 'Protein Oats + Berries',
    proteinG: 35,
    carbsG: 50,
    fatG: 7,
    ingredients: ['1/2 cup oats', '1 scoop whey isolate', '1 cup blueberries', '1 tbsp almond butter'],
    swap: 'Use lactose-free protein or pea protein.',
    tags: ['training', 'pre', 'low-bloat'],
  },
  {
    name: 'Chicken & Jasmine Rice Bowl',
    proteinG: 45,
    carbsG: 55,
    fatG: 9,
    ingredients: ['6 oz grilled chicken', '3/4 cup jasmine rice', '1 cup roasted zucchini', 'lemon, salt, olive oil 1 tsp'],
    swap: 'Sub white fish or 99% lean turkey.',
    tags: ['training', 'post', 'low-bloat'],
  },
  {
    name: 'Sirloin & Sweet Potato',
    proteinG: 42,
    carbsG: 45,
    fatG: 12,
    ingredients: ['5 oz top sirloin', '1 medium sweet potato', '2 cups arugula', 'balsamic'],
    swap: 'Bison or 93% lean beef.',
    tags: ['training', 'post'],
  },
  {
    name: 'Salmon, Quinoa, Greens',
    proteinG: 38,
    carbsG: 35,
    fatG: 18,
    ingredients: ['5 oz salmon', '2/3 cup quinoa', '1.5 cups roasted broccoli', 'lemon'],
    swap: 'Cod + a tbsp olive oil if salmon is out.',
    tags: ['rest', 'low-bloat'],
  },
  {
    name: 'Turkey Lettuce Wraps',
    proteinG: 40,
    carbsG: 18,
    fatG: 12,
    ingredients: ['6 oz 99% lean ground turkey', 'butter lettuce', 'bell pepper', 'cucumber', 'tamari + ginger'],
    swap: 'Ground chicken breast.',
    tags: ['rest', 'low-bloat'],
  },
  {
    name: 'Greek Yogurt Protein Parfait',
    proteinG: 30,
    carbsG: 28,
    fatG: 4,
    ingredients: ['1.5 cups non-fat Greek yogurt (lactose-free)', '1/2 cup raspberries', '2 tbsp granola', 'cinnamon'],
    swap: 'Coconut yogurt + scoop protein if avoiding dairy fully.',
    tags: ['low-bloat'],
  },
  {
    name: 'Cottage-Free Protein Shake + Rice Cakes',
    proteinG: 32,
    carbsG: 30,
    fatG: 5,
    ingredients: ['1 scoop whey isolate', '1 cup almond milk', '2 rice cakes', '1 tbsp PB powder', 'banana'],
    swap: 'Use oat milk if avoiding nuts.',
    tags: ['training', 'pre', 'low-bloat'],
  },
  {
    name: 'Shrimp Stir-Fry (low-FODMAP)',
    proteinG: 38,
    carbsG: 40,
    fatG: 9,
    ingredients: ['6 oz shrimp', '3/4 cup jasmine rice', 'bok choy', 'carrot', 'ginger', 'garlic-infused oil'],
    swap: 'Chicken thigh works too.',
    tags: ['training', 'post', 'low-bloat'],
  },
];

function pickMeals(p: Profile, isTrainingDay: boolean, count: number): MealItem[] {
  const filtered = TEMPLATES.filter((t) =>
    t.ingredients.every((i) => dislikeFilter(p, i)),
  );
  const trainingFirst = filtered.sort((a, b) => {
    const score = (t: MealTemplate) =>
      (t.tags?.includes(isTrainingDay ? 'training' : 'rest') ? -2 : 0) +
      (t.tags?.includes('low-bloat') ? -1 : 0);
    return score(a) - score(b);
  });

  // Build the day, ensuring breakfast/lunch/dinner/snack variety
  const out: MealItem[] = [];
  for (let i = 0; i < count && i < trainingFirst.length; i++) {
    const t = trainingFirst[i];
    out.push({
      name: t.name,
      calories: t.proteinG * 4 + t.carbsG * 4 + t.fatG * 9,
      proteinG: t.proteinG,
      carbsG: t.carbsG,
      fatG: t.fatG,
      ingredients: t.ingredients,
      swap: t.swap,
    });
  }
  return out;
}

export function buildDailyPlan(ctx: PlanContext): DailyMealPlan {
  const { profile, isTrainingDay, hungerLevel = 5 } = ctx;
  const calorieTarget = targetCalories(profile, isTrainingDay, hungerLevel);
  const m = macros(profile, calorieTarget, isTrainingDay);

  const meals = pickMeals(profile, isTrainingDay, profile.mealCount || 4);

  // Re-scale meals so totals roughly match target macros
  const totalP = meals.reduce((a, b) => a + b.proteinG, 0);
  const totalC = meals.reduce((a, b) => a + b.carbsG, 0);
  const totalF = meals.reduce((a, b) => a + b.fatG, 0);
  const sP = totalP > 0 ? m.proteinG / totalP : 1;
  const sC = totalC > 0 ? m.carbsG / totalC : 1;
  const sF = totalF > 0 ? m.fatG / totalF : 1;
  const scaled = meals.map((meal) => {
    const proteinG = Math.round(meal.proteinG * sP);
    const carbsG = Math.round(meal.carbsG * sC);
    const fatG = Math.round(meal.fatG * sF);
    return {
      ...meal,
      proteinG,
      carbsG,
      fatG,
      calories: proteinG * 4 + carbsG * 4 + fatG * 9,
    };
  });

  const totals = {
    calories: scaled.reduce((a, b) => a + b.calories, 0),
    proteinG: scaled.reduce((a, b) => a + b.proteinG, 0),
    carbsG: scaled.reduce((a, b) => a + b.carbsG, 0),
    fatG: scaled.reduce((a, b) => a + b.fatG, 0),
  };

  const grocery = Array.from(
    new Set(scaled.flatMap((meal) => meal.ingredients.map((s) => s.replace(/^\d+(\.\d+)?\s*[a-zA-Z]+\s*/, '').trim()))),
  ).slice(0, 30);

  let coachNote = isTrainingDay
    ? 'Training day. Push 30–45g carbs in the meal before your lift and 40–50g after. That is your performance and recovery food.'
    : 'Rest day. Lower carbs, hold protein, prioritize veggies and whole foods. Walk after meals to ease bloating.';
  if (profile.onWegovy) {
    coachNote +=
      ' Wegovy note: appetite often dips midday and rebounds at night. Front-load protein at breakfast and lunch so dinner is easy when hunger spikes.';
  }
  if (hungerLevel >= 8) {
    coachNote += ` You logged hunger ${hungerLevel}/10 — added ~150 kcal as a post-workout carb bump.`;
  }
  if (hungerLevel <= 3 && profile.onWegovy) {
    coachNote += ` Hunger is low (${hungerLevel}/10) — aim to hit at least 80% of protein even if you skip a meal. Liquid protein is your friend.`;
  }

  return {
    dayLabel: isTrainingDay ? 'Training Day' : 'Rest Day',
    isTrainingDay,
    totals,
    meals: scaled,
    groceryList: grocery,
    coachNote,
  };
}
