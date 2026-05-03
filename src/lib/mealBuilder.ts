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
  | 'lunch-ok'
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
}

// ─── Ingredient database ─────────────────────────────────────────────────────
// Macros are USDA-ballpark averages for the cooked/edible form.

export const INGREDIENTS: Ingredient[] = [
  // Lean proteins
  { name: 'Grilled chicken breast', category: 'lean_protein', per100g: { p: 31, c: 0, f: 3.6 }, defaultServingG: 170, displayUnit: 'oz', tags: ['low-bloat', 'training-friendly', 'rest-friendly', 'lunch-ok', 'dinner-ok'] },
  { name: '99% lean ground turkey', category: 'lean_protein', per100g: { p: 27, c: 0, f: 1, },  defaultServingG: 150, displayUnit: 'oz', tags: ['low-bloat', 'rest-friendly', 'lunch-ok', 'dinner-ok'] },
  { name: 'White fish (cod, tilapia)', category: 'lean_protein', per100g: { p: 24, c: 0, f: 1.5 }, defaultServingG: 170, displayUnit: 'oz', tags: ['low-bloat', 'rest-friendly', 'lunch-ok', 'dinner-ok'] },
  { name: 'Top sirloin (lean)', category: 'lean_protein', per100g: { p: 29, c: 0, f: 8 }, defaultServingG: 140, displayUnit: 'oz', tags: ['training-friendly', 'lunch-ok', 'dinner-ok'] },
  { name: 'Shrimp', category: 'lean_protein', per100g: { p: 24, c: 0, f: 1 }, defaultServingG: 170, displayUnit: 'oz', tags: ['low-bloat', 'training-friendly', 'rest-friendly', 'lunch-ok', 'dinner-ok'] },
  { name: 'Egg whites', category: 'lean_protein', per100g: { p: 11, c: 0.7, f: 0.2 }, defaultServingG: 150, displayUnit: 'cup', tags: ['low-bloat', 'breakfast-ok'] },

  // Fattier proteins (use sparingly)
  { name: 'Salmon', category: 'fatty_protein', per100g: { p: 25, c: 0, f: 13 }, defaultServingG: 140, displayUnit: 'oz', tags: ['rest-friendly', 'lunch-ok', 'dinner-ok'] },
  { name: 'Whole eggs', category: 'fatty_protein', per100g: { p: 13, c: 1.1, f: 11 }, defaultServingG: 100, displayUnit: 'piece', tags: ['low-bloat', 'breakfast-ok', 'wegovy-easy'] },

  // Plant proteins
  { name: 'Tofu (firm)', category: 'plant_protein', per100g: { p: 17, c: 2, f: 9 }, defaultServingG: 150, displayUnit: 'oz', tags: ['rest-friendly', 'lunch-ok', 'dinner-ok'] },

  // Dairy proteins
  { name: 'Non-fat Greek yogurt (lactose-free)', category: 'dairy_protein', per100g: { p: 10, c: 4, f: 0 }, defaultServingG: 200, displayUnit: 'cup', tags: ['low-bloat', 'breakfast-ok', 'snack-ok', 'wegovy-easy'], contains: ['dairy'] },
  { name: 'Whey isolate', category: 'dairy_protein', per100g: { p: 90, c: 2, f: 1 }, defaultServingG: 30, displayUnit: 'g', tags: ['low-bloat', 'wegovy-easy', 'breakfast-ok', 'snack-ok'], contains: ['whey'] },

  // Starchy carbs
  { name: 'Jasmine rice (cooked)', category: 'starchy_carb', per100g: { p: 2.7, c: 28, f: 0.3 }, defaultServingG: 150, displayUnit: 'cup', tags: ['low-bloat', 'training-friendly', 'lunch-ok', 'dinner-ok'] },
  { name: 'Sweet potato (roasted)', category: 'starchy_carb', per100g: { p: 1.6, c: 20, f: 0.1 }, defaultServingG: 200, displayUnit: 'cup', tags: ['training-friendly', 'lunch-ok', 'dinner-ok'] },
  { name: 'Quinoa (cooked)', category: 'starchy_carb', per100g: { p: 4.4, c: 21, f: 1.9 }, defaultServingG: 150, displayUnit: 'cup', tags: ['training-friendly', 'rest-friendly', 'lunch-ok'] },
  { name: 'Rolled oats (dry)', category: 'starchy_carb', per100g: { p: 13, c: 67, f: 7 }, defaultServingG: 50, displayUnit: 'cup', tags: ['breakfast-ok', 'training-friendly'] },
  { name: 'Rice cakes', category: 'starchy_carb', per100g: { p: 8, c: 82, f: 3 }, defaultServingG: 30, displayUnit: 'piece', tags: ['snack-ok', 'training-friendly', 'low-bloat'] },

  // Fruits
  { name: 'Banana', category: 'fruit', per100g: { p: 1.1, c: 23, f: 0.3 }, defaultServingG: 120, displayUnit: 'piece', tags: ['training-friendly', 'snack-ok', 'breakfast-ok'] },
  { name: 'Blueberries', category: 'fruit', per100g: { p: 0.7, c: 14, f: 0.3 }, defaultServingG: 120, displayUnit: 'cup', tags: ['low-bloat', 'breakfast-ok', 'snack-ok'] },
  { name: 'Raspberries', category: 'fruit', per100g: { p: 1.2, c: 12, f: 0.7 }, defaultServingG: 120, displayUnit: 'cup', tags: ['low-bloat', 'breakfast-ok', 'snack-ok'] },

  // Vegetables
  { name: 'Spinach', category: 'leafy_green', per100g: { p: 2.9, c: 3.6, f: 0.4 }, defaultServingG: 100, displayUnit: 'cup', tags: ['low-bloat', 'rest-friendly', 'lunch-ok', 'dinner-ok', 'breakfast-ok'] },
  { name: 'Arugula', category: 'leafy_green', per100g: { p: 2.6, c: 3.7, f: 0.7 }, defaultServingG: 80, displayUnit: 'cup', tags: ['low-bloat', 'rest-friendly', 'lunch-ok', 'dinner-ok'] },
  { name: 'Roasted broccoli', category: 'cruciferous', per100g: { p: 2.8, c: 7, f: 0.4 }, defaultServingG: 150, displayUnit: 'cup', tags: ['rest-friendly', 'dinner-ok'] },
  { name: 'Zucchini (sautéed)', category: 'low_fodmap_veg', per100g: { p: 1.2, c: 3.1, f: 0.3 }, defaultServingG: 150, displayUnit: 'cup', tags: ['low-bloat', 'lunch-ok', 'dinner-ok'] },
  { name: 'Bell pepper', category: 'low_fodmap_veg', per100g: { p: 1, c: 6, f: 0.3 }, defaultServingG: 100, displayUnit: 'cup', tags: ['low-bloat', 'lunch-ok'] },
  { name: 'Cucumber', category: 'low_fodmap_veg', per100g: { p: 0.7, c: 3.6, f: 0.1 }, defaultServingG: 100, displayUnit: 'cup', tags: ['low-bloat', 'lunch-ok', 'snack-ok'] },
  { name: 'Bok choy', category: 'low_fodmap_veg', per100g: { p: 1.5, c: 2.2, f: 0.2 }, defaultServingG: 150, displayUnit: 'cup', tags: ['low-bloat', 'dinner-ok'] },

  // Healthy fats
  { name: 'Avocado', category: 'healthy_fat', per100g: { p: 2, c: 9, f: 15 }, defaultServingG: 50, displayUnit: 'piece', tags: ['low-bloat', 'rest-friendly', 'breakfast-ok', 'lunch-ok'] },
  { name: 'Almond butter', category: 'healthy_fat', per100g: { p: 21, c: 19, f: 56 }, defaultServingG: 16, displayUnit: 'tbsp', tags: ['breakfast-ok', 'snack-ok'] },
  { name: 'Olive oil', category: 'healthy_fat', per100g: { p: 0, c: 0, f: 100 }, defaultServingG: 5, displayUnit: 'tbsp', tags: ['lunch-ok', 'dinner-ok', 'rest-friendly'] },

  // Light condiments (mostly free macros)
  { name: 'Lemon', category: 'condiment', per100g: { p: 0, c: 1, f: 0 }, defaultServingG: 10, displayUnit: 'piece', tags: ['low-bloat'] },
  { name: 'Tamari (gluten-free)', category: 'condiment', per100g: { p: 9, c: 8, f: 0 }, defaultServingG: 10, displayUnit: 'tbsp', tags: ['low-bloat', 'lunch-ok', 'dinner-ok'] },
  { name: 'Garlic-infused olive oil', category: 'condiment', per100g: { p: 0, c: 0, f: 100 }, defaultServingG: 5, displayUnit: 'tbsp', tags: ['low-bloat', 'lunch-ok', 'dinner-ok'] },
];

// ─── Slot specifications ─────────────────────────────────────────────────────

export type Slot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

interface SlotSpec {
  slot: Slot;
  /** Pull from these categories in order; first non-empty match wins. */
  proteinCategories: FoodCategory[];
  carbCategories?: FoodCategory[];
  vegCategories?: FoodCategory[];
  fatCategories?: FoodCategory[];
  /** Each slot gets this share of the day's macros. Sum should ≤ 1.0. */
  share: number;
  /** Title prefix used to compose the meal name. */
  namePrefix: string;
}

const SLOT_SPECS: Record<Slot, SlotSpec> = {
  breakfast: {
    slot: 'breakfast',
    proteinCategories: ['dairy_protein', 'fatty_protein', 'lean_protein'],
    carbCategories: ['starchy_carb', 'fruit'],
    fatCategories: ['healthy_fat'],
    share: 0.25,
    namePrefix: 'Breakfast',
  },
  lunch: {
    slot: 'lunch',
    proteinCategories: ['lean_protein', 'plant_protein'],
    carbCategories: ['starchy_carb'],
    vegCategories: ['leafy_green', 'low_fodmap_veg'],
    fatCategories: ['healthy_fat'],
    share: 0.3,
    namePrefix: 'Lunch',
  },
  dinner: {
    slot: 'dinner',
    proteinCategories: ['lean_protein', 'fatty_protein', 'plant_protein'],
    carbCategories: ['starchy_carb'],
    vegCategories: ['cruciferous', 'leafy_green', 'low_fodmap_veg'],
    fatCategories: ['healthy_fat'],
    share: 0.3,
    namePrefix: 'Dinner',
  },
  snack: {
    slot: 'snack',
    proteinCategories: ['dairy_protein', 'lean_protein'],
    carbCategories: ['fruit', 'starchy_carb'],
    share: 0.15,
    namePrefix: 'Snack',
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

function pickByCategory(
  pool: Ingredient[],
  categories: FoodCategory[],
  slot: Slot,
  daySeed: number,
  slotIndex: number,
): Ingredient | null {
  const slotTag = `${slot}-ok` as FoodTag;
  for (const cat of categories) {
    // Strict slot filter: only foods explicitly tagged for this slot are
    // eligible, so we can't end up with rice cakes for lunch or sweet potato
    // for breakfast. Foods without ANY slot tag are treated as universal.
    const candidates = pool.filter((f) => {
      if (f.category !== cat) return false;
      const hasAnySlotTag = f.tags.some((t) =>
        ['breakfast-ok', 'lunch-ok', 'dinner-ok', 'snack-ok'].includes(t),
      );
      if (!hasAnySlotTag) return true; // universal (e.g., olive oil)
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

  const allowed = INGREDIENTS.filter((f) => passesSensitivities(f, profile));
  const dayContext: FoodTag = isTrainingDay ? 'training-friendly' : 'rest-friendly';

  // Filter for context: low-bloat always preferred, day-context softly preferred.
  // Don't strictly require the tag — many ingredients fit both contexts.
  const pool = allowed.filter((f) => {
    // Soft filter: include if it has the day tag OR no day tag at all
    const hasOpposite = f.tags.includes(isTrainingDay ? 'rest-friendly' : 'training-friendly');
    const hasDay = f.tags.includes(dayContext);
    if (hasOpposite && !hasDay) return false;
    return true;
  });

  const slots: Slot[] =
    mealCount >= 5
      ? ['breakfast', 'snack', 'lunch', 'snack', 'dinner']
      : mealCount === 4
      ? ['breakfast', 'lunch', 'snack', 'dinner']
      : ['breakfast', 'lunch', 'dinner'];

  const totalShare = slots.reduce((s, slot) => s + SLOT_SPECS[slot].share, 0);
  const meals: MealItem[] = [];

  slots.forEach((slot, slotIndex) => {
    const spec = SLOT_SPECS[slot];
    const share = spec.share / totalShare;
    const slotProtein = targets.proteinG * share;
    const slotCarbs = targets.carbsG * share;
    const slotFat = targets.fatG * share;

    const items: ItemPortion[] = [];

    // Protein anchor — scale to hit slot's protein share, capped at a
    // realistic single-serving ceiling so we don't end up prescribing 54 g
    // of whey isolate (2+ scoops) in one meal.
    const protein = pickByCategory(pool, spec.proteinCategories, slot, daySeed, slotIndex);
    if (protein) {
      // For ultra-concentrated proteins (whey, very lean meats), keep the
      // serving close to the default and accept a protein shortfall rather
      // than over-scaling. The composer's other items + protein anchors in
      // other meals close the daily target.
      const isConcentrated = protein.per100g.p >= 30;
      const maxMultiplier = isConcentrated ? 1.2 : 1.6;
      items.push(
        scaleByProtein(
          protein,
          slotProtein,
          Math.round(protein.defaultServingG * 0.5),
          Math.round(protein.defaultServingG * maxMultiplier),
        ),
      );
    }

    // Carb source — scale to hit slot's carb share, but cap at a realistic
    // serving so we don't prescribe "2.5 cup sweet potato".
    if (spec.carbCategories) {
      const carb = pickByCategory(pool, spec.carbCategories, slot, daySeed + 1, slotIndex);
      if (carb) {
        items.push(
          scaleByCarbs(
            carb,
            slotCarbs,
            Math.round(carb.defaultServingG * 0.6),
            Math.round(carb.defaultServingG * 1.4),
          ),
        );
      }
    }

    // Veg — fixed serving (mostly free macros)
    if (spec.vegCategories) {
      const veg = pickByCategory(pool, spec.vegCategories, slot, daySeed + 2, slotIndex);
      if (veg) items.push(fixedPortion(veg));
    }

    // Fat — only if slot's fat share isn't already covered by other items
    const accumulatedFat = items.reduce((s, i) => s + i.fatG, 0);
    if (spec.fatCategories && accumulatedFat < slotFat * 0.7) {
      const fat = pickByCategory(pool, spec.fatCategories, slot, daySeed + 3, slotIndex);
      if (fat) items.push(fixedPortion(fat));
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
