// Food Response Learning.
//
// Pattern detector across logged MealFeedback entries. NEVER flags a
// food on a single bad day — requires repeated occurrences with
// consistently poor signal to call something a possible trigger.
//
// Pure deterministic — no ML. Each ingredient token is treated as a
// candidate; a candidate becomes a "possible trigger" only when:
//
//   - It appears in ≥ 3 meals
//   - Bloating-after for those meals averages ≥ 6
//   - The bloat is meaningfully WORSE than meals without that ingredient
//     (Δ ≥ 1.5/10 vs the user's per-day baseline)
//
// "Best tolerated" works the inverse way: ingredient appears in ≥ 3
// meals with consistently low bloating + high digestion + neutral or
// good energy.

import type { MealFeedback } from '../types';

export interface FoodResponseReport {
  /** Total meals logged — short-circuit when too few. */
  totalMealsLogged: number;
  /** Distinct ingredient tokens across all logged meals. */
  totalIngredientsTracked: number;
  /** True when there isn't enough data to call patterns yet. */
  needsMoreData: boolean;
  /** Ingredients with consistently good response. */
  bestTolerated: ToleratedFood[];
  /** Ingredients flagged as possible triggers — with evidence + swap suggestions. */
  possibleTriggers: TriggerFood[];
}

export interface ToleratedFood {
  food: string;
  occurrences: number;
  avgBloating: number;
  avgEnergy: number;
  avgDigestion: number;
  note: string;
}

export interface TriggerFood {
  food: string;
  occurrences: number;
  avgBloating: number;
  baselineBloating: number;
  delta: number;
  pattern: string;
  recommendation: string;
}

const MIN_OCCURRENCES = 3;
const TRIGGER_BLOAT_FLOOR = 6;
const TRIGGER_DELTA_FLOOR = 1.5;
const TOLERATED_BLOAT_CEIL = 4;
const TOLERATED_DIGESTION_FLOOR = 7;

// Common swap suggestions for known sensitivities — local lookup, no API.
// Conservative wording, no medical claims.
const SWAP_SUGGESTIONS: Record<string, string> = {
  milk: 'Try lactose-free milk or unsweetened almond/oat as a swap and see if bloating drops.',
  cheese: 'Hard aged cheeses (parmesan, aged cheddar) carry less lactose than soft cheeses.',
  yogurt: 'Greek yogurt or lactose-free yogurt usually sits cleaner than regular.',
  cottage_cheese: 'Lactose-free cottage cheese exists; or swap to Greek yogurt.',
  whey: 'Try whey isolate (lower in lactose than concentrate) or a plant-based protein.',
  onion: 'Try the green tops of scallions or use garlic-infused oil for the flavor without the FODMAP load.',
  garlic: 'Garlic-infused olive oil delivers flavor without the FODMAP molecule.',
  beans: 'Smaller portions + soaking, or swap to firm tofu / tempeh which are lower-FODMAP.',
  lentils: 'Canned + rinsed lentils have less FODMAP than dry-cooked. Half-cup portions only.',
  apple: 'Stone fruit (peach, plum, cherries small portion) or oranges/berries are lower FODMAP.',
  wheat: 'Try oats, rice, quinoa, or sourdough (lower FODMAP than regular bread).',
  bread: 'Sourdough, gluten-free, or sprouted breads are usually better tolerated.',
  pasta: 'Gluten-free pasta or rice noodles for a 7-day test.',
  cabbage: 'Cooked greens (spinach, bok choy, zucchini) sit easier than cabbage family.',
  broccoli: 'Smaller portions or swap to green beans / zucchini.',
  cauliflower: 'Smaller portions or swap to white potato / parsnip.',
};

const GENERIC_SWAP =
  'Test by removing it for 7 days. If bloating drops, reintroduce in a small portion to confirm — never run two changes at once.';

// ─── Token helpers ─────────────────────────────────────────────────────────

/**
 * Normalize an ingredient string for grouping. Lowercases, trims,
 * collapses whitespace, replaces internal spaces with underscores so
 * "cottage cheese" matches the swap-suggestion lookup.
 */
export function normalizeIngredient(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return +(nums.reduce((s, n) => s + n, 0) / nums.length).toFixed(1);
}

function pretty(token: string): string {
  return token.replace(/_/g, ' ');
}

// ─── Main entry ────────────────────────────────────────────────────────────

export function analyzeFoodResponse(
  feedback: MealFeedback[],
): FoodResponseReport {
  const totalMealsLogged = feedback.length;

  if (totalMealsLogged < MIN_OCCURRENCES) {
    return {
      totalMealsLogged,
      totalIngredientsTracked: 0,
      needsMoreData: true,
      bestTolerated: [],
      possibleTriggers: [],
    };
  }

  // Build a lookup: token → list of feedback rows where it appeared.
  const occurrences = new Map<string, MealFeedback[]>();
  feedback.forEach((f) => {
    const seen = new Set<string>();
    f.ingredients.forEach((raw) => {
      const tok = normalizeIngredient(raw);
      if (!tok || seen.has(tok)) return;
      seen.add(tok);
      const list = occurrences.get(tok) ?? [];
      list.push(f);
      occurrences.set(tok, list);
    });
  });

  const totalIngredientsTracked = occurrences.size;

  // Compute the user's overall baseline bloating across all logged
  // meals — a token is only flagged when it's significantly WORSE than
  // their personal baseline.
  const baselineBloating = avg(feedback.map((f) => f.bloatingAfter));

  const bestTolerated: ToleratedFood[] = [];
  const possibleTriggers: TriggerFood[] = [];

  for (const [token, rows] of occurrences) {
    if (rows.length < MIN_OCCURRENCES) continue;

    const avgBloat = avg(rows.map((r) => r.bloatingAfter));
    const avgEnergy = avg(rows.map((r) => r.energyAfter));
    const avgDigestion = avg(rows.map((r) => r.digestionAfter));

    // Possible trigger
    if (
      avgBloat >= TRIGGER_BLOAT_FLOOR &&
      avgBloat - baselineBloating >= TRIGGER_DELTA_FLOOR
    ) {
      const swap = SWAP_SUGGESTIONS[token] ?? GENERIC_SWAP;
      possibleTriggers.push({
        food: pretty(token),
        occurrences: rows.length,
        avgBloating: avgBloat,
        baselineBloating,
        delta: +(avgBloat - baselineBloating).toFixed(1),
        pattern: `${rows.length} meals with ${pretty(token)} → bloating averages ${avgBloat}/10 (your overall baseline is ${baselineBloating}/10).`,
        recommendation: swap,
      });
      continue;
    }

    // Best tolerated
    if (
      avgBloat <= TOLERATED_BLOAT_CEIL &&
      avgDigestion >= TOLERATED_DIGESTION_FLOOR
    ) {
      bestTolerated.push({
        food: pretty(token),
        occurrences: rows.length,
        avgBloating: avgBloat,
        avgEnergy,
        avgDigestion,
        note: `${rows.length} meals · bloat ${avgBloat}/10 · digestion ${avgDigestion}/10 · energy ${avgEnergy}/10`,
      });
    }
  }

  // Sort: triggers worst-first, tolerated best-first
  possibleTriggers.sort((a, b) => b.delta - a.delta);
  bestTolerated.sort((a, b) => {
    const score = (x: ToleratedFood) =>
      x.avgDigestion + x.avgEnergy - x.avgBloating;
    return score(b) - score(a);
  });

  return {
    totalMealsLogged,
    totalIngredientsTracked,
    needsMoreData: false,
    bestTolerated: bestTolerated.slice(0, 10),
    possibleTriggers: possibleTriggers.slice(0, 5),
  };
}
