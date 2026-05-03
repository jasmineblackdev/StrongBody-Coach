// Composes a 1–2 sentence narrative on top of the macro engine's output.
// Pure rule-based: triggers driven by macro hit/miss flags.

import type { DailyMealPlan, Profile } from '../../types';

export function generateMealNarrative(
  plan: DailyMealPlan,
  profile: Profile,
  isTrainingDay: boolean,
): string {
  const proteinTarget =
    profile.proteinTargetG ?? Math.round(profile.weightLbs * 0.9);
  const proteinShortfall = Math.max(0, proteinTarget - plan.totals.proteinG);

  const opener = isTrainingDay
    ? `Training-day plan: ${plan.totals.calories} kcal, ${plan.totals.proteinG}g protein, ${plan.totals.carbsG}g carbs around your lift, ${plan.totals.fatG}g fat.`
    : `Rest-day plan: ${plan.totals.calories} kcal, ${plan.totals.proteinG}g protein held high, carbs trimmed to ${plan.totals.carbsG}g, ${plan.totals.fatG}g fat.`;

  if (proteinShortfall >= 10) {
    return `${opener} Protein lands ${proteinShortfall}g short — add a scoop of whey or another egg-white serving to close it.`;
  }

  if (isTrainingDay) {
    return `${opener} Eat the carb-anchor meal in the 90-minute window before your lift; the post-workout meal closes the day.`;
  }

  return `${opener} Walk after meals — easiest lever for bloat and Wegovy GI.`;
}
