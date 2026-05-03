// Plateau forecast — forward-looking complement to femaleFatLossEngine.
//
// The female engine answers "what is happening now?". This engine
// answers "is a plateau approaching?". Fires earlier so the user can
// pull adherence + steps levers BEFORE the scale stalls, not after.
//
// Pure deterministic math — median-of-week comparison across two
// 14-day windows. No external APIs, no ML.
//
// Advisory only. Does not override Coach Brain. The flag surfaces in
// the FatLossInsightCard and the Dashboard predictions card.

import type { BodyMetric } from '../types';

export type PlateauForecastStatus =
  | 'no_plateau'
  | 'approaching_plateau'
  | 'in_plateau'
  | 'insufficient_data';

export type PlateauForecastConfidence = 'low' | 'medium' | 'high';

export interface PlateauForecastReport {
  status: PlateauForecastStatus;
  /** Smoothed lb/wk rate over the most recent 14-day window. */
  rateLast14: number;
  /** Smoothed lb/wk rate over the prior 14-day window (days 14–28 ago). */
  ratePrior14: number;
  /**
   * Deceleration in lb/wk: rateLast14 − ratePrior14. Positive = slowing
   * down on a fat-loss block (i.e., trending toward plateau).
   */
  deceleration: number;
  confidence: PlateauForecastConfidence;
  /** One-line read for the UI. */
  headline: string;
  /** What the user should do — advisory, not enforced. */
  recommendation: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function metricsInWindow(
  metrics: BodyMetric[],
  startDaysAgo: number,
  endDaysAgo: number,
): BodyMetric[] {
  const now = Date.now();
  const newer = now - startDaysAgo * 86400000;
  const older = now - endDaysAgo * 86400000;
  return metrics
    .filter((m) => typeof m.weightLbs === 'number')
    .filter((m) => {
      const t = new Date(m.date).getTime();
      return t >= older && t <= newer;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Smoothed weekly rate across a sorted-asc body-metric window. Uses
 * median-of-first-half vs median-of-second-half so single-day water
 * spikes don't drive the rate.
 */
function smoothedRate(window: BodyMetric[]): number | null {
  if (window.length < 4) return null;
  const half = Math.floor(window.length / 2);
  const firstHalf = window.slice(0, half).map((m) => m.weightLbs as number);
  const secondHalf = window.slice(-half).map((m) => m.weightLbs as number);
  const m1 = median(firstHalf);
  const m2 = median(secondHalf);
  const days =
    (new Date(window[window.length - 1].date).getTime() -
      new Date(window[0].date).getTime()) /
    86400000;
  if (days <= 0) return null;
  return +(((m2 - m1) / days) * 7).toFixed(2);
}

// ─── Main entry ────────────────────────────────────────────────────────────

export function forecastPlateau(metrics: BodyMetric[]): PlateauForecastReport {
  const recent = metricsInWindow(metrics, 0, 14);
  const prior = metricsInWindow(metrics, 14, 28);

  const recentRate = smoothedRate(recent);
  const priorRate = smoothedRate(prior);

  // Need both windows populated to forecast.
  if (recentRate === null || priorRate === null) {
    return {
      status: 'insufficient_data',
      rateLast14: recentRate ?? 0,
      ratePrior14: priorRate ?? 0,
      deceleration: 0,
      confidence: 'low',
      headline: 'Not enough data to forecast a plateau yet',
      recommendation:
        'Log daily weight for 28 days. The forecast needs two 14-day windows to compare.',
    };
  }

  const deceleration = +(recentRate - priorRate).toFixed(2);

  // Confidence: how full are the two windows?
  let confidence: PlateauForecastConfidence = 'low';
  if (recent.length >= 14 && prior.length >= 14) confidence = 'high';
  else if (recent.length >= 10 && prior.length >= 10) confidence = 'medium';

  // Status logic:
  //   in_plateau     = rateLast14 within ±0.4 lb/wk (functionally flat)
  //   approaching    = decelerating toward zero on a fat-loss block
  //   no_plateau     = clean continued loss, no slowdown
  const FLAT_BAND = 0.4;
  if (Math.abs(recentRate) <= FLAT_BAND) {
    return {
      status: 'in_plateau',
      rateLast14: recentRate,
      ratePrior14: priorRate,
      deceleration,
      confidence,
      headline: `Plateau detected — last 14 days at ${recentRate >= 0 ? '+' : ''}${recentRate} lb/wk`,
      recommendation:
        priorRate < -0.5
          ? 'Trend has flattened from a steady loss. Tighten adherence + add 1,000–2,000 steps before any calorie cut.'
          : 'Trend has been flat across both windows. Run a /check-in to surface what changed.',
    };
  }

  // Decelerating: still losing but slower than before AND slowdown is ≥ 0.5 lb/wk
  if (priorRate < -0.5 && recentRate > priorRate && deceleration >= 0.5) {
    return {
      status: 'approaching_plateau',
      rateLast14: recentRate,
      ratePrior14: priorRate,
      deceleration,
      confidence,
      headline: `Loss rate slowing: ${priorRate} → ${recentRate} lb/wk`,
      recommendation:
        'Pull the cheap levers first — daily weigh-ins consistent, water up, sodium variability down. If the slowdown holds, Coach Brain will recommend the next move on your next check-in.',
    };
  }

  // Default: clean continued loss / gain — no plateau forecast.
  return {
    status: 'no_plateau',
    rateLast14: recentRate,
    ratePrior14: priorRate,
    deceleration,
    confidence,
    headline:
      recentRate < 0
        ? `Trend healthy: ${recentRate} lb/wk over last 14 days`
        : `No plateau forecast — trend at ${recentRate >= 0 ? '+' : ''}${recentRate} lb/wk`,
    recommendation:
      recentRate < 0
        ? 'Stay consistent. The forecast is clean — keep logging daily and don\'t change anything.'
        : 'Trend is moving the wrong direction but not flat. Check adherence + bloating before changing the plan.',
  };
}

// ─── UI tokens ─────────────────────────────────────────────────────────────

export const PLATEAU_TONE: Record<PlateauForecastStatus, 'success' | 'warning' | 'danger' | 'accent'> = {
  no_plateau: 'success',
  approaching_plateau: 'warning',
  in_plateau: 'danger',
  insufficient_data: 'accent',
};

export const PLATEAU_LABEL: Record<PlateauForecastStatus, string> = {
  no_plateau: 'No plateau',
  approaching_plateau: 'Approaching',
  in_plateau: 'In plateau',
  insufficient_data: 'Need more data',
};
