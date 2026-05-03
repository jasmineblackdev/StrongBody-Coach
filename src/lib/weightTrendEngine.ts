// Rolling 7-day weight trend with ETA. Built for fat-loss tracking — uses
// averages instead of single-day weight so daily fluctuations don't drive
// decisions.

import type { BodyMetric, Profile } from '../types';

export type WeightDirection = 'losing' | 'stable' | 'gaining' | 'unknown';
export type WeightConfidence = 'low' | 'medium' | 'high';

export interface WeightTrendReport {
  /** Most recent recorded weight (lb). Falls back to profile.weightLbs. */
  current: number;
  /** Mean of metrics from the last 0–7 days. */
  sevenDayAvg: number;
  /** Mean of metrics from the prior 7–14 days. */
  priorSevenDayAvg: number;
  /** sevenDayAvg − priorSevenDayAvg in lb. Negative = losing. */
  weeklyChange: number;
  /** current − goalWeightLbs (positive when above goal). */
  remaining: number;
  /** Pounds lost since the oldest logged metric (or profile baseline). */
  totalLostFromStart: number;
  /** Estimated weeks to goal at current trend; null if not losing or no goal gap. */
  weeksToGoal: number | null;
  /** Estimated date (YYYY-MM-DD) of reaching goal; null if no ETA. */
  goalDate: string | null;
  trend: WeightDirection;
  confidence: WeightConfidence;
  notes: string[];
}

function mean(nums: number[]): number {
  return nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : 0;
}

function avgInWindow(
  metrics: BodyMetric[],
  startDaysAgo: number,
  endDaysAgo: number,
): number | null {
  const now = Date.now();
  // window covers (now - endDaysAgo*86400000)  through  (now - startDaysAgo*86400000)
  const newer = now - startDaysAgo * 86400000;
  const older = now - endDaysAgo * 86400000;
  const inWindow = metrics
    .filter((m) => typeof m.weightLbs === 'number')
    .filter((m) => {
      const t = new Date(m.date).getTime();
      return t >= older && t <= newer;
    })
    .map((m) => m.weightLbs as number);
  return inWindow.length ? mean(inWindow) : null;
}

export function computeWeightTrend(
  metrics: BodyMetric[],
  profile: Profile,
): WeightTrendReport {
  const sortedDesc = [...metrics]
    .filter((m) => typeof m.weightLbs === 'number')
    .sort((a, b) => b.date.localeCompare(a.date));

  const current = sortedDesc[0]?.weightLbs ?? profile.weightLbs;
  const goal = profile.goalWeightLbs;

  const sevenDayAvg = avgInWindow(sortedDesc, 0, 7) ?? current;
  const priorSevenDayAvg =
    avgInWindow(sortedDesc, 7, 14) ?? sevenDayAvg;
  const weeklyChange = +(sevenDayAvg - priorSevenDayAvg).toFixed(2);

  const remaining = +(current - goal).toFixed(1);

  // totalLostFromStart: oldest metric → current (or profile.weightLbs as fallback baseline)
  const oldest = sortedDesc[sortedDesc.length - 1]?.weightLbs;
  const baseline = oldest ?? profile.weightLbs;
  const totalLostFromStart = +Math.max(0, baseline - current).toFixed(1);

  let trend: WeightDirection = 'unknown';
  if (sortedDesc.length >= 2) {
    if (weeklyChange <= -0.4) trend = 'losing';
    else if (weeklyChange >= 0.4) trend = 'gaining';
    else trend = 'stable';
  }

  let weeksToGoal: number | null = null;
  let goalDate: string | null = null;
  if (trend === 'losing' && weeklyChange < 0 && remaining > 0) {
    weeksToGoal = +(remaining / Math.abs(weeklyChange)).toFixed(1);
    const days = Math.round(weeksToGoal * 7);
    const d = new Date();
    d.setDate(d.getDate() + days);
    goalDate = d.toISOString().slice(0, 10);
  }

  let confidence: WeightConfidence = 'low';
  if (sortedDesc.length >= 7) confidence = 'medium';
  if (sortedDesc.length >= 14) confidence = 'high';

  const notes: string[] = [];
  if (sortedDesc.length === 0) {
    notes.push('No weight entries yet — log daily for a couple weeks to get a real trend.');
  } else if (sortedDesc.length < 7) {
    notes.push(
      `Only ${sortedDesc.length} weight entr${
        sortedDesc.length === 1 ? 'y' : 'ies'
      } — log daily for a couple weeks before changing the plan.`,
    );
  }
  if (trend === 'losing' && Math.abs(weeklyChange) > 2) {
    notes.push(
      `Losing ${Math.abs(weeklyChange)} lb/wk is fast — protect muscle by holding protein high (${Math.round(
        profile.weightLbs * 0.9,
      )}g+) and don't cut more.`,
    );
  }
  if (trend === 'stable' && sortedDesc.length >= 7 && profile.goal === 'fat_loss') {
    notes.push(
      'Weight is stable on a fat-loss block — adherence first, then we tighten calories or add steps.',
    );
  }
  if (trend === 'gaining' && sortedDesc.length >= 7 && profile.goal === 'fat_loss') {
    notes.push(
      'Trending up on a fat-loss block. Recheck adherence (calories, alcohol, weekend swing) before changing the plan.',
    );
  }

  return {
    current: +current.toFixed(1),
    sevenDayAvg: +sevenDayAvg.toFixed(1),
    priorSevenDayAvg: +priorSevenDayAvg.toFixed(1),
    weeklyChange,
    remaining,
    totalLostFromStart,
    weeksToGoal,
    goalDate,
    trend,
    confidence,
    notes,
  };
}
