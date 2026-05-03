// Rule-based meal composer. Builds meals from an ingredient database to hit
// macro targets, deterministically rotated by day-of-week. No APIs, no ML —
// but variety per day and macro-aware portion sizing.
//
// Design:
//   1. INGREDIENTS = small typed database with macros per 100g + tags
//   2. MealSlot specifies what categories of food the slot wants
//   3. Composer picks foods (rotated by daySeed) and scales portions to hit
//      the slot's share of the day's macro target
//   4. Sensitivity / dislike filter runs at the ingredient level

import type { MealItem, Profile } from '../types';

export type FoodCategory =
  | 'lean_protein'
  | 'fatty_protein'
  | 'plant_protein'
  | 'starchy_carb'
  | 'fruit'
  | 'leafy_green'
  | 'cruciferous'
  | 'low_fodmap_veg'
  | 'healthy_fat'
  | 'dairy_protein'
  | 'condiment';

export type FoodTag =
  | 'low-bloat'
  | 'training-friendly'
  | 'rest-friendly'
  | 'breakfast-ok'
  | 'mid-morning-ok'
  | 'lunch-ok'
  | 'pre-workout-ok'
  | 'post-workout-ok'
  | 'dinner-ok'
  | 'snack-ok'
  | 'wegovy-easy';

export interface Ingredient {
  name: string;
  category: FoodCategory;
  /** Macros per 100g (or per typical unit when stated). */
  per100g: { p: number; c: number; f: number };
  /** Default serving size in grams used to label the meal item. */
  defaultServingG: number;
  /** Display unit for natural copy: "6 oz" / "1 cup" etc. — used in ingredient lines. */
  displayUnit: 'oz' | 'g' | 'cup' | 'tbsp' | 'piece';
  /** Tags surface in slot matching and filtering. */
  tags: FoodTag[];
  /** Sensitivity keywords this food is off-limits if matched. */
  contains?: string[];
  /**
   * Max times this ingredient can appear in a single day's plan. Used to
   * prevent supplements (whey, etc.) from dominating the daily meal mix
   * — preference is whole-food sources, supplement once if hunger
   * control needs it.
   */
  maxPerDay?: number;
}

// ─── Ingredient database ─────────────────────────────────────────────────────
// Macros are USDA-ballpark averages for the cooked/edible form.

export const INGREDIENTS: Ingredient[] = [
  // Lean proteins
  { name: 'Grilled chicken breast', category: 'lean_protein', per100g: { p: 31, c: 0, f: 3.6 }, defaultServingG: 170, displayUnit: 'oz', tags: ['low-bloat', 'training-friendly', 'rest-friendly', 'lunch-ok', 'dinner-ok', 'post-workout-ok'] },
  { name: '99% lean ground turkey', category: 'lean_protein', per100g: { p: 27, c: 0, f: 1, },  defaultServingG: 150, displayUnit: 'oz', tags: ['low-bloat', 'rest-friendly', 'lunch-ok', 'dinner-ok', 'post-workout-ok'] },
  { name: 'White fish (cod, tilapia)', category: 'lean_protein', per100g: { p: 24, c: 0, f: 1.5 }, defaultServingG: 170, displayUnit: 'oz', tags: ['low-bloat', 'rest-friendly', 'lunch-ok', 'dinner-ok', 'post-workout-ok'] },
  { name: 'Top sirloin (lean)', category: 'lean_protein', per100g: { p: 29, c: 0, f: 8 }, defaultServingG: 140, displayUnit: 'oz', tags: ['training-friendly', 'lunch-ok', 'dinner-ok', 'post-workout-ok'] },
  { name: 'Shrimp', category: 'lean_protein', per100g: { p: 24, c: 0, f: 1 }, defaultServingG: 170, displayUnit: 'oz', tags: ['low-bloat', 'training-friendly', 'rest-friendly', 'lunch-ok', 'dinner-ok', 'post-workout-ok'] },
  { name: 'Egg whites', category: 'lean_protein', per100g: { p: 11, c: 0.7, f: 0.2 }, defaultServingG: 150, displayUnit: 'cup', tags: ['low-bloat', 'breakfast-ok', 'pre-workout-ok'] },

  // Fattier proteins (use sparingly — too rich for pre-workout)
  { name: 'Salmon', category: 'fatty_protein', per100g: { p: 25, c: 0, f: 13 }, defaultServingG: 140, displayUnit: 'oz', tags: ['rest-friendly', 'lunch-ok', 'dinner-ok'] },
  { name: 'Whole eggs', category: 'fatty_protein', per100g: { p: 13, c: 1.1, f: 11 }, defaultServingG: 100, displayUnit: 'piece', tags: ['low-bloat', 'breakfast-ok', 'wegovy-easy'] },

  // Plant proteins
  { name: 'Tofu (firm)', category: 'plant_protein', per100g: { p: 17, c: 2, f: 9 }, defaultServingG: 150, displayUnit: 'oz', tags: ['rest-friendly', 'lunch-ok', 'dinner-ok'] },
  { name: 'Edamame (shelled)', category: 'plant_protein', per100g: { p: 11, c: 9, f: 5 }, defaultServingG: 150, displayUnit: 'cup', tags: ['low-bloat', 'snack-ok', 'mid-morning-ok'] },

  // Whole-food snack proteins — preferred over whey for everyday meals.
  // Whey is capped at 1/day via the maxPerDay field below.
  { name: 'Hard-boiled eggs', category: 'fatty_protein', per100g: { p: 13, c: 1.1, f: 11 }, defaultServingG: 100, displayUnit: 'piece', tags: ['low-bloat', 'snack-ok', 'mid-morning-ok', 'breakfast-ok', 'wegovy-easy'] },
  { name: 'Tuna (canned in water)', category: 'lean_protein', per100g: { p: 26, c: 0, f: 1 }, defaultServingG: 140, displayUnit: 'oz', tags: ['low-bloat', 'snack-ok', 'mid-morning-ok', 'lunch-ok', 'post-workout-ok'] },
  { name: 'Deli turkey (low-sodium)', category: 'lean_protein', per100g: { p: 18, c: 1, f: 1 }, defaultServingG: 100, displayUnit: 'oz', tags: ['low-bloat', 'snack-ok', 'mid-morning-ok', 'lunch-ok', 'wegovy-easy'] },
  { name: 'Rotisserie chicken (skinless)', category: 'lean_protein', per100g: { p: 28, c: 0, f: 4 }, defaultServingG: 120, displayUnit: 'oz', tags: ['low-bloat', 'snack-ok', 'lunch-ok', 'dinner-ok', 'post-workout-ok'] },

  // Dairy proteins
  { name: 'Non-fat Greek yogurt (lactose-free)', category: 'dairy_protein', per100g: { p: 10, c: 4, f: 0 }, defaultServingG: 200, displayUnit: 'cup', tags: ['low-bloat', 'breakfast-ok', 'mid-morning-ok', 'snack-ok', 'wegovy-easy'], contains: ['dairy'] },
  // Whey isolate — capped at 1/day (maxPerDay). Use it as the hunger-
  // control lever in the slot most prone to cravings (post-workout or
  // late-afternoon snack), not as the default snack protein.
  { name: 'Whey isolate', category: 'dairy_protein', per100g: { p: 90, c: 2, f: 1 }, defaultServingG: 30, displayUnit: 'g', tags: ['low-bloat', 'wegovy-easy', 'pre-workout-ok', 'post-workout-ok', 'snack-ok'], contains: ['whey'], maxPerDay: 1 },

  // Starchy carbs
  { name: 'Jasmine rice (cooked)', category: 'starchy_carb', per100g: { p: 2.7, c: 28, f: 0.3 }, defaultServingG: 150, displayUnit: 'cup', tags: ['low-bloat', 'training-friendly', 'lunch-ok', 'dinner-ok', 'pre-workout-ok', 'post-workout-ok'] },
  { name: 'Sweet potato (roasted)', category: 'starchy_carb', per100g: { p: 1.6, c: 20, f: 0.1 }, defaultServingG: 200, displayUnit: 'cup', tags: ['training-friendly', 'lunch-ok', 'dinner-ok', 'pre-workout-ok', 'post-workout-ok'] },
  { name: 'Quinoa (cooked)', category: 'starchy_carb', per100g: { p: 4.4, c: 21, f: 1.9 }, defaultServingG: 150, displayUnit: 'cup', tags: ['training-friendly', 'rest-friendly', 'lunch-ok', 'post-workout-ok'] },
  { name: 'Rolled oats (dry)', category: 'starchy_carb', per100g: { p: 13, c: 67, f: 7 }, defaultServingG: 50, displayUnit: 'cup', tags: ['breakfast-ok', 'training-friendly', 'pre-workout-ok'] },
  { name: 'Rice cakes', category: 'starchy_carb', per100g: { p: 8, c: 82, f: 3 }, defaultServingG: 30, displayUnit: 'piece', tags: ['snack-ok', 'training-friendly', 'low-bloat', 'pre-workout-ok'] },

  // Fruits
  { name: 'Banana', category: 'fruit', per100g: { p: 1.1, c: 23, f: 0.3 }, defaultServingG: 120, displayUnit: 'piece', tags: ['training-friendly', 'snack-ok', 'breakfast-ok', 'mid-morning-ok', 'pre-workout-ok', 'post-workout-ok'] },
  { name: 'Blueberries', category: 'fruit', per100g: { p: 0.7, c: 14, f: 0.3 }, defaultServingG: 120, displayUnit: 'cup', tags: ['low-bloat', 'breakfast-ok', 'mid-morning-ok', 'snack-ok', 'post-workout-ok'] },
  { name: 'Raspberries', category: 'fruit', per100g: { p: 1.2, c: 12, f: 0.7 }, defaultServingG: 120, displayUnit: 'cup', tags: ['low-bloat', 'breakfast-ok', 'mid-morning-ok', 'snack-ok'] },

  // Vegetables
  { name: 'Spinach', category: 'leafy_green', per100g: { p: 2.9, c: 3.6, f: 0.4 }, defaultServingG: 100, displayUnit: 'cup', tags: ['low-bloat', 'rest-friendly', 'lunch-ok', 'dinner-ok', 'breakfast-ok', 'post-workout-ok'] },
  { name: 'Arugula', category: 'leafy_green', per100g: { p: 2.6, c: 3.7, f: 0.7 }, defaultServingG: 80, displayUnit: 'cup', tags: ['low-bloat', 'rest-friendly', 'lunch-ok', 'dinner-ok'] },
  { name: 'Roasted broccoli', category: 'cruciferous', per100g: { p: 2.8, c: 7, f: 0.4 }, defaultServingG: 150, displayUnit: 'cup', tags: ['rest-friendly', 'dinner-ok'] },
  { name: 'Zucchini (sautéed)', category: 'low_fodmap_veg', per100g: { p: 1.2, c: 3.1, f: 0.3 }, defaultServingG: 150, displayUnit: 'cup', tags: ['low-bloat', 'lunch-ok', 'dinner-ok'] },
  { name: 'Bell pepper', category: 'low_fodmap_veg', per100g: { p: 1, c: 6, f: 0.3 }, defaultServingG: 100, displayUnit: 'cup', tags: ['low-bloat', 'lunch-ok'] },
  { name: 'Cucumber', category: 'low_fodmap_veg', per100g: { p: 0.7, c: 3.6, f: 0.1 }, defaultServingG: 100, displayUnit: 'cup', tags: ['low-bloat', 'lunch-ok', 'snack-ok'] },
  { name: 'Bok choy', category: 'low_fodmap_veg', per100g: { p: 1.5, c: 2.2, f: 0.2 }, defaultServingG: 150, displayUnit: 'cup', tags: ['low-bloat', 'dinner-ok'] },

  // Healthy fats
  { name: 'Avocado', category: 'healthy_fat', per100g: { p: 2, c: 9, f: 15 }, defaultServingG: 50, displayUnit: 'piece', tags: ['low-bloat', 'rest-friendly', 'breakfast-ok', 'lunch-ok'] },
  { name: 'Almond butter', category: 'healthy_fat', per100g: { p: 21, c: 19, f: 56 }, defaultServingG: 16, displayUnit: 'tbsp', tags: ['breakfast-ok', 'mid-morning-ok', 'snack-ok'] },
  { name: 'Olive oil', category: 'healthy_fat', per100g: { p: 0, c: 0, f: 100 }, defaultServingG: 5, displayUnit: 'tbsp', tags: ['lunch-ok', 'dinner-ok', 'rest-friendly'] },

  // Light condiments (mostly free macros)
  { name: 'Lemon', category: 'condiment', per100g: { p: 0, c: 1, f: 0 }, defaultServingG: 10, displayUnit: 'piece', tags: ['low-bloat'] },
  { name: 'Tamari (gluten-free)', category: 'condiment', per100g: { p: 9, c: 8, f: 0 }, defaultServingG: 10, displayUnit: 'tbsp', tags: ['low-bloat', 'lunch-ok', 'dinner-ok'] },
  { name: 'Garlic-infused olive oil', category: 'condiment', per100g: { p: 0, c: 0, f: 100 }, defaultServingG: 5, displayUnit: 'tbsp', tags: ['low-bloat', 'lunch-ok', 'dinner-ok'] },
];

// ─── Slot specifications ─────────────────────────────────────────────────────

export type Slot =
  | 'breakfast'
  | 'mid_morning'
  | 'lunch'
  | 'pre_workout'
  | 'post_workout'
  | 'snack'
  | 'dinner';

interface SlotSpec {
  slot: Slot;
  /** Pull from these categories in order; first non-empty match wins. */
  proteinCategories: FoodCategory[];
  carbCategories?: FoodCategory[];
  vegCategories?: FoodCategory[];
  fatCategories?: FoodCategory[];
  /**
   * Macro shape — relative weighting per macro across the day. The composer
   * normalizes these to per-slot shares (so daily totals stay equal to the
   * macroEngine's targets regardless of slot mix).
   */
  shape: { kcal: number; protein: number; carbs: number; fat: number };
  /** Title prefix used to compose the meal name. */
  namePrefix: string;
  /** Tag string used by the slot-strict food filter. */
  slotTag: FoodTag;
}

const SLOT_SPECS: Record<Slot, SlotSpec> = {
  breakfast: {
    slot: 'breakfast',
    proteinCategories: ['dairy_protein', 'fatty_protein', 'lean_protein'],
    carbCategories: ['starchy_carb', 'fruit'],
    fatCategories: ['healthy_fat'],
    shape: { kcal: 1.0, protein: 1.1, carbs: 1.0, fat: 1.3 },
    namePrefix: 'Breakfast',
    slotTag: 'breakfast-ok',
  },
  mid_morning: {
    slot: 'mid_morning',
    proteinCategories: ['dairy_protein', 'lean_protein'],
    carbCategories: ['fruit', 'starchy_carb'],
    fatCategories: ['healthy_fat'],
    shape: { kcal: 0.7, protein: 0.8, carbs: 0.6, fat: 1.0 },
    namePrefix: 'Mid-morning',
    slotTag: 'mid-morning-ok',
  },
  lunch: {
    slot: 'lunch',
    proteinCategories: ['lean_protein', 'plant_protein'],
    carbCategories: ['starchy_carb'],
    vegCategories: ['leafy_green', 'low_fodmap_veg'],
    fatCategories: ['healthy_fat'],
    shape: { kcal: 1.1, protein: 1.1, carbs: 1.0, fat: 1.4 },
    namePrefix: 'Lunch',
    slotTag: 'lunch-ok',
  },
  pre_workout: {
    slot: 'pre_workout',
    // Lean / dairy proteins only — no fatty proteins (slow digestion before
    // training). Carbs are the star: rice, oats, banana, rice cakes.
    proteinCategories: ['dairy_protein', 'lean_protein'],
    carbCategories: ['starchy_carb', 'fruit'],
    // No vegCategories — keep stomach light. No fatCategories — fat slows
    // gastric emptying right before a lift.
    shape: { kcal: 0.9, protein: 0.6, carbs: 1.4, fat: 0.2 },
    namePrefix: 'Pre-workout',
    slotTag: 'pre-workout-ok',
  },
  post_workout: {
    slot: 'post_workout',
    // Highest-protein meal of the day. Carbs around training restock glycogen.
    // Light veg ok; fat kept low.
    proteinCategories: ['lean_protein', 'dairy_protein'],
    carbCategories: ['starchy_carb'],
    vegCategories: ['low_fodmap_veg', 'leafy_green'],
    shape: { kcal: 1.3, protein: 1.5, carbs: 1.3, fat: 0.6 },
    namePrefix: 'Post-workout',
    slotTag: 'post-workout-ok',
  },
  snack: {
    slot: 'snack',
    proteinCategories: ['dairy_protein', 'lean_protein'],
    carbCategories: ['fruit', 'starchy_carb'],
    shape: { kcal: 0.7, protein: 0.8, carbs: 0.7, fat: 0.5 },
    namePrefix: 'Snack',
    slotTag: 'snack-ok',
  },
  dinner: {
    slot: 'dinner',
    proteinCategories: ['lean_protein', 'fatty_protein', 'plant_protein'],
    carbCategories: ['starchy_carb'],
    vegCategories: ['cruciferous', 'leafy_green', 'low_fodmap_veg'],
    fatCategories: ['healthy_fat'],
    shape: { kcal: 1.2, protein: 1.2, carbs: 1.0, fat: 1.4 },
    namePrefix: 'Dinner',
    slotTag: 'dinner-ok',
  },
};

// ─── Filtering ───────────────────────────────────────────────────────────────

function passesSensitivities(food: Ingredient, profile: Profile): boolean {
  const blacklist = [...profile.foodDislikes, ...profile.foodSensitivities].map(
    (s) => s.toLowerCase().replace(/\(.*?\)/g, '').trim(),
  );
  const haystack = [food.name.toLowerCase(), ...(food.contains ?? []).map((s) => s.toLowerCase())];
  for (const bad of blacklist) {
    if (!bad) continue;
    if (haystack.some((h) => h.includes(bad))) return false;
  }
  return true;
}

const ALL_SLOT_TAGS: FoodTag[] = [
  'breakfast-ok',
  'mid-morning-ok',
  'lunch-ok',
  'pre-workout-ok',
  'post-workout-ok',
  'snack-ok',
  'dinner-ok',
];

function pickByCategory(
  pool: Ingredient[],
  categories: FoodCategory[],
  slot: Slot,
  daySeed: number,
  slotIndex: number,
  usageCounts?: Map<string, number>,
): Ingredient | null {
  const slotTag = SLOT_SPECS[slot].slotTag;
  for (const cat of categories) {
    // Strict slot filter: only foods explicitly tagged for this slot are
    // eligible. Foods without ANY slot tag are treated as universal
    // (e.g., olive oil, lemon, condiments).
    const candidates = pool.filter((f) => {
      if (f.category !== cat) return false;
      // Daily-cap filter: skip foods that have hit their maxPerDay quota.
      if (typeof f.maxPerDay === 'number') {
        const used = usageCounts?.get(f.name) ?? 0;
        if (used >= f.maxPerDay) return false;
      }
      const hasAnySlotTag = f.tags.some((t) =>
        ALL_SLOT_TAGS.includes(t as FoodTag),
      );
      if (!hasAnySlotTag) return true;
      return f.tags.includes(slotTag);
    });
    if (candidates.length === 0) continue;
    // Deterministic rotation: shift by daySeed and slotIndex so meals vary
    // day to day but stay reproducible for any given (day, slot, category).
    const idx = (daySeed * 7 + slotIndex * 3) % candidates.length;
    return candidates[idx];
  }
  return null;
}

// ─── Slot inference from meal/workout times ─────────────────────────────────

function toMinutes(time: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function defaultSlots(count: number): Slot[] {
  if (count >= 5) return ['breakfast', 'mid_morning', 'lunch', 'snack', 'dinner'];
  if (count === 4) return ['breakfast', 'lunch', 'snack', 'dinner'];
  return ['breakfast', 'lunch', 'dinner'];
}

/**
 * Given the user's meal times and (optional) workout time, classify each
 * meal into a contextual slot. Pre-workout = 1–3 hours before workoutTime.
 * Post-workout = 0–3 hours after workoutTime. Otherwise classified by
 * time of day.
 */
export function inferSlots(
  mealTimes: string[] | undefined,
  workoutTime: string | undefined,
  count: number,
): Slot[] {
  if (!mealTimes || mealTimes.length === 0) return defaultSlots(count);

  const times = [...mealTimes]
    .map((t) => ({ raw: t, mins: toMinutes(t) }))
    .filter((x): x is { raw: string; mins: number } => x.mins !== null)
    .sort((a, b) => a.mins - b.mins)
    .slice(0, count);
  if (!times.length) return defaultSlots(count);

  const wkt = workoutTime ? toMinutes(workoutTime) : null;

  return times.map(({ mins }, i) => {
    if (wkt !== null) {
      const offset = mins - wkt;
      // Pre-workout: 45 minutes to 3 hours before
      if (offset >= -180 && offset <= -45) return 'pre_workout';
      // Post-workout: 0 to 3 hours after
      if (offset > 0 && offset <= 180) return 'post_workout';
    }
    if (i === 0) return 'breakfast';
    if (mins < 11 * 60) return 'mid_morning';
    if (mins < 14 * 60) return 'lunch';
    if (mins < 17 * 60) return 'snack';
    return 'dinner';
  });
}

// ─── Portion scaling ─────────────────────────────────────────────────────────

interface ItemPortion {
  food: Ingredient;
  servingG: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

function scaleByProtein(food: Ingredient, targetProteinG: number, minG: number, maxG: number): ItemPortion {
  const ppg = food.per100g.p / 100;
  let servingG = ppg > 0 ? targetProteinG / ppg : food.defaultServingG;
  servingG = Math.max(minG, Math.min(maxG, servingG));
  return computePortion(food, servingG);
}

function scaleByCarbs(food: Ingredient, targetCarbsG: number, minG: number, maxG: number): ItemPortion {
  const cpg = food.per100g.c / 100;
  let servingG = cpg > 0 ? targetCarbsG / cpg : food.defaultServingG;
  servingG = Math.max(minG, Math.min(maxG, servingG));
  return computePortion(food, servingG);
}

function fixedPortion(food: Ingredient): ItemPortion {
  return computePortion(food, food.defaultServingG);
}

function computePortion(food: Ingredient, servingG: number): ItemPortion {
  const proteinG = (food.per100g.p / 100) * servingG;
  const carbsG = (food.per100g.c / 100) * servingG;
  const fatG = (food.per100g.f / 100) * servingG;
  return { food, servingG: Math.round(servingG), proteinG, carbsG, fatG };
}

// ─── Display formatting ──────────────────────────────────────────────────────

function describeServing(food: Ingredient, servingG: number): string {
  switch (food.displayUnit) {
    case 'oz': {
      const oz = Math.round((servingG / 28.35) * 2) / 2; // nearest 0.5 oz
      return `${oz} oz ${food.name}`;
    }
    case 'cup': {
      const cup = Math.round((servingG / 120) * 4) / 4; // nearest 1/4 cup
      return `${cup} cup ${food.name}`;
    }
    case 'tbsp': {
      const tbsp = Math.max(1, Math.round(servingG / 14));
      return `${tbsp} tbsp ${food.name}`;
    }
    case 'piece': {
      const pieces = Math.max(1, Math.round(servingG / food.defaultServingG));
      return pieces === 1 ? `1 ${food.name.toLowerCase()}` : `${pieces} × ${food.name}`;
    }
    case 'g':
    default:
      return `${Math.round(servingG)} g ${food.name}`;
  }
}

// ─── Composer ────────────────────────────────────────────────────────────────

export interface ComposeArgs {
  profile: Profile;
  isTrainingDay: boolean;
  /** Sum target — slots split this proportionally. */
  targets: { calories: number; proteinG: number; carbsG: number; fatG: number };
  /** Day-of-week seed; same seed → same plan. */
  daySeed: number;
  /** Number of meals (3–5). */
  mealCount: number;
}

export function composeMeals(args: ComposeArgs): MealItem[] {
  const { profile, isTrainingDay, targets, daySeed, mealCount } = args;

  // Sensitivity filter is the only hard exclusion. The slot tags
  // (breakfast-ok / lunch-ok / pre-workout-ok / etc.) already provide enough
  // contextual constraint, and macro shaping handles the training-vs-rest
  // calorie/carb difference. Without this, staples like rice and sweet
  // potato would get incorrectly dropped on rest days because they're
  // tagged "training-friendly".
  const pool = INGREDIENTS.filter((f) => passesSensitivities(f, profile));

  // Time-aware slot inference. On rest days we deliberately drop workoutTime
  // so the composer doesn't classify any meal as pre/post-workout — carbs
  // get spread evenly across breakfast / mid_morning / lunch / snack / dinner.
  const slots: Slot[] = inferSlots(
    profile.mealTimes,
    isTrainingDay ? profile.workoutTime : undefined,
    mealCount,
  );

  // Per-macro shape totals for normalization. Each slot's share of a given
  // macro is its shape weight divided by the sum across all selected slots.
  // This keeps daily macro totals exactly equal to `targets` regardless of
  // which slots are in play.
  const totals = slots.reduce(
    (acc, s) => {
      const sh = SLOT_SPECS[s].shape;
      acc.kcal += sh.kcal;
      acc.protein += sh.protein;
      acc.carbs += sh.carbs;
      acc.fat += sh.fat;
      return acc;
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );

  const meals: MealItem[] = [];

  // Per-day ingredient usage counter — drives the maxPerDay cap so
  // capped foods (e.g., whey isolate) appear at most N times across
  // the day's meals.
  const usageCounts = new Map<string, number>();
  function bump(food: Ingredient): void {
    if (typeof food.maxPerDay === 'number') {
      usageCounts.set(food.name, (usageCounts.get(food.name) ?? 0) + 1);
    }
  }

  slots.forEach((slot, slotIndex) => {
    const spec = SLOT_SPECS[slot];
    const sh = spec.shape;
    const slotProtein = targets.proteinG * (sh.protein / totals.protein);
    const slotCarbs = targets.carbsG * (sh.carbs / totals.carbs);
    const slotFat = targets.fatG * (sh.fat / totals.fat);

    const items: ItemPortion[] = [];

    // Order: secondaries (carb / veg / fat) first so we can subtract
    // their incidental protein from the primary protein's scaling target.
    // The previous order picked primary protein first at full slotProtein,
    // then added carb + veg + fat — each of which carries 1–10 g of
    // incidental protein. Across 5 meals that compounded to ~25–30 g
    // overshoot vs the daily target. Picking secondaries first lets the
    // primary protein fill only the REMAINING gap.

    // Carb source — scale to hit slot's carb share, but cap at a realistic
    // serving so we don't prescribe "2.5 cup sweet potato".
    if (spec.carbCategories) {
      const carb = pickByCategory(pool, spec.carbCategories, slot, daySeed + 1, slotIndex, usageCounts);
      if (carb) {
        items.push(
          scaleByCarbs(
            carb,
            slotCarbs,
            Math.round(carb.defaultServingG * 0.6),
            Math.round(carb.defaultServingG * 1.4),
          ),
        );
        bump(carb);
      }
    }

    // Veg — fixed serving (mostly free macros)
    if (spec.vegCategories) {
      const veg = pickByCategory(pool, spec.vegCategories, slot, daySeed + 2, slotIndex, usageCounts);
      if (veg) {
        items.push(fixedPortion(veg));
        bump(veg);
      }
    }

    // Fat — only if slot's fat share isn't already covered by other items
    const accumulatedFat = items.reduce((s, i) => s + i.fatG, 0);
    if (spec.fatCategories && accumulatedFat < slotFat * 0.7) {
      const fat = pickByCategory(pool, spec.fatCategories, slot, daySeed + 3, slotIndex, usageCounts);
      if (fat) {
        items.push(fixedPortion(fat));
        bump(fat);
      }
    }

    // Primary protein — scale to fill the gap between slotProtein and
    // what we've already collected from the secondaries. unshift() so
    // the meal name still shows the protein first.
    const incidentalProtein = items.reduce((s, i) => s + i.proteinG, 0);
    const proteinGap = Math.max(5, slotProtein - incidentalProtein);
    const protein = pickByCategory(pool, spec.proteinCategories, slot, daySeed, slotIndex, usageCounts);
    if (protein) {
      bump(protein);
      // For ultra-concentrated proteins (whey, very lean meats), keep the
      // serving close to the default and accept a protein shortfall rather
      // than over-scaling. The composer's other items + protein anchors in
      // other meals close the daily target.
      const isConcentrated = protein.per100g.p >= 30;
      const maxMultiplier = isConcentrated ? 1.2 : 1.6;
      items.unshift(
        scaleByProtein(
          protein,
          proteinGap,
          Math.round(protein.defaultServingG * 0.5),
          Math.round(protein.defaultServingG * maxMultiplier),
        ),
      );
    }

    const proteinG = Math.round(items.reduce((s, i) => s + i.proteinG, 0));
    const carbsG = Math.round(items.reduce((s, i) => s + i.carbsG, 0));
    const fatG = Math.round(items.reduce((s, i) => s + i.fatG, 0));
    const calories = proteinG * 4 + carbsG * 4 + fatG * 9;

    const proteinAnchor = items[0]?.food.name ?? 'meal';
    const carbAnchor = items[1]?.food.name ?? '';
    const mealName = carbAnchor
      ? `${spec.namePrefix} · ${proteinAnchor} + ${carbAnchor.toLowerCase()}`
      : `${spec.namePrefix} · ${proteinAnchor}`;

    meals.push({
      name: mealName,
      calories,
      proteinG,
      carbsG,
      fatG,
      ingredients: items.map((i) => describeServing(i.food, i.servingG)),
      swap: items[0]
        ? `Swap ${items[0].food.name.toLowerCase()} for any other lean protein you have on hand.`
        : undefined,
    });
  });

  return meals;
}
