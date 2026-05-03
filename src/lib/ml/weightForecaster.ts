// Linear regression over recent body metrics to predict next-week weight.
// Pure stats — no ML library, no API. Returns null when there isn't enough
// data to be meaningful.

import type { BodyMetric } from '../../types';

export interface WeightForecast {
  /** Predicted weight 7 days from the latest data point (lb). */
  predictedNextWeekWeight: number;
  /** Linear-regression slope expressed as lb / week. */
  predictedWeeklyChange: number;
  /** Lower / upper bounds at ~1 stddev (lb). */
  band: { low: number; high: number };
  /** Goodness of fit, 0–1. */
  rSquared: number;
  confidence: 'low' | 'medium' | 'high';
  daysOfData: number;
  samples: number;
}

export function forecastWeight(metrics: BodyMetric[]): WeightForecast | null {
  const sorted = [...metrics]
    .filter((m) => typeof m.weightLbs === 'number')
    .sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 7) return null;

  // Use last 42 days for the regression — long enough to see a real trend,
  // short enough to ignore stale data.
  const cutoff = Date.now() - 42 * 86400000;
  const window = sorted.filter((m) => new Date(m.date).getTime() >= cutoff);
  if (window.length < 7) return null;

  const baseTime = new Date(window[0].date).getTime();
  const points = window.map((m) => ({
    days: (new Date(m.date).getTime() - baseTime) / 86400000,
    weight: m.weightLbs as number,
  }));

  // Linear regression: y = a*x + b
  const n = points.length;
  const sumX = points.reduce((s, p) => s + p.days, 0);
  const sumY = points.reduce((s, p) => s + p.weight, 0);
  const sumXY = points.reduce((s, p) => s + p.days * p.weight, 0);
  const sumXX = points.reduce((s, p) => s + p.days * p.days, 0);
  const meanY = sumY / n;

  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;

  const slopePerDay = (n * sumXY - sumX * sumY) / denom; // lb per day
  const intercept = (sumY - slopePerDay * sumX) / n;

  // R²
  let ssRes = 0;
  let ssTot = 0;
  for (const p of points) {
    const predicted = slopePerDay * p.days + intercept;
    ssRes += (p.weight - predicted) ** 2;
    ssTot += (p.weight - meanY) ** 2;
  }
  const rSquared = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;

  // Project next-week weight
  const lastDay = points[points.length - 1].days;
  const projectionDay = lastDay + 7;
  const predictedNextWeekWeight = +(
    slopePerDay * projectionDay +
    intercept
  ).toFixed(1);
  const predictedWeeklyChange = +(slopePerDay * 7).toFixed(2);

  // 1-stddev band from residuals
  const stddev = Math.sqrt(ssRes / Math.max(1, n - 2));
  const bandWidth = +stddev.toFixed(1);
  const band = {
    low: +(predictedNextWeekWeight - bandWidth).toFixed(1),
    high: +(predictedNextWeekWeight + bandWidth).toFixed(1),
  };

  const daysOfData = Math.round(lastDay) + 1;
  let confidence: WeightForecast['confidence'] = 'low';
  if (daysOfData >= 14 && rSquared >= 0.4) confidence = 'medium';
  if (daysOfData >= 21 && rSquared >= 0.6) confidence = 'high';

  return {
    predictedNextWeekWeight,
    predictedWeeklyChange,
    band,
    rSquared: +rSquared.toFixed(2),
    confidence,
    daysOfData,
    samples: n,
  };
}
