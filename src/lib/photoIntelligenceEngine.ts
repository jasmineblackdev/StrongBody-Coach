// Photo Intelligence — supportive interpretation layer for progress photos.
//
// Hard rules baked in everywhere:
//   - No body shaming language
//   - No body-fat-percentage estimates (anywhere, ever)
//   - No diagnosis or medical claims
//   - Photos cannot drive macro / workout / phase changes alone
//
// What this engine actually does: cross-reference photo set dates with
// measured deltas (weight, waist) and the female fat-loss layer's read
// (water retention, false plateau, etc.) to produce a visual trend
// classification + confidence + recommended action.
//
// Future-ready: the input/output surface is API-agnostic. A vision model
// could later supply a richer "visualDelta" hint to the engine without
// changing the consuming UI. We do NOT call any vision API today.

import type {
  BodyMetric,
  PhotoVisualSignal,
  WeeklyCheckIn,
} from '../types';
import type { PhotoSet } from './photoStorage';
import type { FemaleFatLossReport } from './femaleFatLossEngine';

export type VisualTrend = 'improving' | 'stable' | 'unclear';
export type PhotoConfidence = 'low' | 'medium' | 'high';

export interface PhotoIntelligenceReport {
  visualTrend: VisualTrend;
  confidence: PhotoConfidence;
  /**
   * Short single-sentence read for the Dashboard mini-card.
   * Examples: "Waist down, weight flat — possible recomposition",
   * "Bloating high — photo changes may be masked".
   */
  shortHeadline: string;
  /** Plain-English observations the panel renders as bullet points. */
  observations: string[];
  /** What the user should actually do this week. */
  recommendation: string;
  /** Always rendered; never softened. */
  safetyNote: string;
  /** Comparison meta — null when there's no anchor pair. */
  latestSetDate: string | null;
  previousSetDate: string | null;
  daysBetween: number;
  /** Net deltas drawn from BodyMetric near the photo dates, NOT the photos. */
  weightDeltaLbs: number | null;
  waistDeltaIn: number | null;
  /** True when the female layer says water retention is masking the read. */
  waterRetentionFlagged: boolean;
  /** What the user said on the last check-in, if anything. */
  selfReportedSignal?: PhotoVisualSignal;
}

export interface PhotoIntelligenceInput {
  photoSets: PhotoSet[];
  metrics: BodyMetric[];
  checkIns: WeeklyCheckIn[];
  /**
   * Output of the female fat-loss engine. When water_retention is the
   * current state, Photo Intelligence won't call a "weight up" reading
   * concerning — it will explicitly flag it as masked.
   */
  femaleReport?: FemaleFatLossReport;
}

const SAFETY_NOTE =
  'Photos support coaching decisions but do not replace measurements, logs, or check-ins. No body-fat percentage is estimated here.';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Match a body metric to a photo date. Returns null if the closest metric
 * is more than 7 days from the photo (too noisy to anchor).
 */
function metricNear(
  metrics: BodyMetric[],
  date: string,
  field: 'weightLbs' | 'waistIn',
): number | null {
  if (!metrics.length) return null;
  const target = new Date(date).getTime();
  let best: BodyMetric | null = null;
  let bestDelta = Infinity;
  for (const m of metrics) {
    const v = m[field];
    if (typeof v !== 'number') continue;
    const delta = Math.abs(new Date(m.date).getTime() - target);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = m;
    }
  }
  if (!best || bestDelta > 7 * 86400000) return null;
  return (best[field] as number) ?? null;
}

function spacingClassification(daysBetween: number): {
  ok: boolean;
  label: string;
} {
  if (daysBetween < 5) {
    return {
      ok: false,
      label: `Sets are ${daysBetween} days apart — too close to read change reliably`,
    };
  }
  if (daysBetween > 60) {
    return {
      ok: false,
      label: `Sets are ${daysBetween} days apart — wide gap, lighting/posture drift will dominate`,
    };
  }
  return { ok: true, label: '' };
}

function setHasAllAngles(s: PhotoSet | null | undefined): boolean {
  return !!s?.front && !!s?.side && !!s?.back;
}

// ─── Main entry ────────────────────────────────────────────────────────────

export function analyzePhotoIntelligence(
  input: PhotoIntelligenceInput,
): PhotoIntelligenceReport {
  const { photoSets, metrics, checkIns, femaleReport } = input;
  const lastCheckIn = checkIns[0];
  const selfReported = lastCheckIn?.photoVisualSignal;
  const waterRetentionFlagged = femaleReport?.state === 'water_retention';

  // Sort newest → oldest so [0] is current.
  const sortedDesc = [...photoSets].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  const current = sortedDesc[0] ?? null;
  const previous = sortedDesc[1] ?? null;

  // Empty state — no photos at all.
  if (!current) {
    return {
      visualTrend: 'unclear',
      confidence: 'low',
      shortHeadline: 'Need a first photo set',
      observations: [
        'No photo sets logged yet. Photos lag the scale by 2–4 weeks, so the first set just becomes a baseline.',
      ],
      recommendation:
        'Upload a front / side / back set on the Progress page. Take it morning + fasted + same lighting; that\'s what makes the next comparison meaningful.',
      safetyNote: SAFETY_NOTE,
      latestSetDate: null,
      previousSetDate: null,
      daysBetween: 0,
      weightDeltaLbs: null,
      waistDeltaIn: null,
      waterRetentionFlagged,
      selfReportedSignal: selfReported,
    };
  }

  // One photo set — baseline only.
  if (!previous) {
    return {
      visualTrend: 'unclear',
      confidence: 'low',
      shortHeadline: 'Baseline set logged — need another for comparison',
      observations: [
        `Only one photo set so far (${current.date}). Visual change requires at least two anchors.`,
      ],
      recommendation:
        'Log a second set in 2–4 weeks. Same time of day, same lighting, same angle — consistency is what makes the read trustworthy.',
      safetyNote: SAFETY_NOTE,
      latestSetDate: current.date,
      previousSetDate: null,
      daysBetween: 0,
      weightDeltaLbs: null,
      waistDeltaIn: null,
      waterRetentionFlagged,
      selfReportedSignal: selfReported,
    };
  }

  // Two+ photo sets — actual comparison.
  const daysBetween = Math.max(
    0,
    Math.round(
      (new Date(current.date).getTime() - new Date(previous.date).getTime()) /
        86400000,
    ),
  );

  // Anchor measurements at the photo dates.
  const weightCurrent =
    current.weightLbs ?? metricNear(metrics, current.date, 'weightLbs');
  const weightPrev =
    previous.weightLbs ?? metricNear(metrics, previous.date, 'weightLbs');
  const waistCurrent = metricNear(metrics, current.date, 'waistIn');
  const waistPrev = metricNear(metrics, previous.date, 'waistIn');

  const weightDeltaLbs =
    typeof weightCurrent === 'number' && typeof weightPrev === 'number'
      ? +(weightCurrent - weightPrev).toFixed(1)
      : null;
  const waistDeltaIn =
    typeof waistCurrent === 'number' && typeof waistPrev === 'number'
      ? +(waistCurrent - waistPrev).toFixed(2)
      : null;

  const observations: string[] = [];
  const spacing = spacingClassification(daysBetween);
  if (!spacing.ok) observations.push(spacing.label);

  // Build the read.
  const weightDirection: 'down' | 'flat' | 'up' | 'unknown' =
    weightDeltaLbs === null
      ? 'unknown'
      : weightDeltaLbs <= -1
      ? 'down'
      : weightDeltaLbs >= 1
      ? 'up'
      : 'flat';
  const waistDirection: 'down' | 'flat' | 'up' | 'unknown' =
    waistDeltaIn === null
      ? 'unknown'
      : waistDeltaIn <= -0.25
      ? 'down'
      : waistDeltaIn >= 0.25
      ? 'up'
      : 'flat';

  let visualTrend: VisualTrend = 'unclear';
  let shortHeadline = 'Comparison logged — read below';
  let recommendation = 'Compare again next week. Same lighting, same time of day.';

  // ─── Decision tree ──────────────────────────────────────────────────────

  // 1. Water retention masks any "weight up" read entirely.
  if (waterRetentionFlagged && weightDirection === 'up') {
    visualTrend = 'unclear';
    shortHeadline = 'Bloating high — photo changes may be masked';
    recommendation =
      'Hold the plan. Weight is up but the female layer flagged water retention; let it settle 5–7 days, then re-take photos same time of day.';
    observations.push(
      `Weight up ${weightDeltaLbs?.toFixed(1)} lb between sets, but the female layer says this is water retention — not fat gain.`,
    );
  }
  // 2. Waist down + weight flat → recomposition.
  else if (waistDirection === 'down' && weightDirection === 'flat') {
    visualTrend = 'improving';
    shortHeadline = 'Waist down, weight flat — possible recomposition';
    recommendation =
      'Hold the plan. Recomposition is exactly what the photos + waist line up for. Don\'t chase scale movement when the tape is doing the work.';
    observations.push(
      `Waist down ${Math.abs(waistDeltaIn ?? 0).toFixed(2)} in over ${daysBetween} days while weight stayed within ±1 lb. That's the recomp signal.`,
    );
  }
  // 3. Both weight and waist down → fat loss on track.
  else if (weightDirection === 'down' && waistDirection === 'down') {
    visualTrend = 'improving';
    shortHeadline = 'Weight + waist both down — fat loss on track';
    recommendation =
      'Stay consistent. The plan is working — let it work without changes for another week.';
    observations.push(
      `Weight ${Math.abs(weightDeltaLbs ?? 0).toFixed(1)} lb down + waist ${Math.abs(waistDeltaIn ?? 0).toFixed(2)} in down over ${daysBetween} days.`,
    );
  }
  // 4. Weight down, no waist data → improving but lower confidence.
  else if (weightDirection === 'down' && waistDirection === 'unknown') {
    visualTrend = 'improving';
    shortHeadline = 'Weight down — add waist measurement for stronger signal';
    recommendation =
      'Add a waist measurement on photo days. Without it, we can\'t tell fat loss from water/glycogen drop.';
    observations.push(
      `Weight ${Math.abs(weightDeltaLbs ?? 0).toFixed(1)} lb down between sets, no waist measurement on either anchor date.`,
    );
  }
  // 5. Weight up + bloating high (without water retention flag triggered) →
  //    still mask the read.
  else if (
    weightDirection === 'up' &&
    (lastCheckIn?.bloatingLevel ?? 0) >= 6
  ) {
    visualTrend = 'unclear';
    shortHeadline = 'Bloating high — photo changes may be masked';
    recommendation =
      'Don\'t overreact. Bloating at this level can add 1–4 lb of water on the scale that drops the week after.';
    observations.push(
      `Weight up ${weightDeltaLbs?.toFixed(1)} lb with bloating ${lastCheckIn?.bloatingLevel}/10. Could be water + GI.`,
    );
  }
  // 6. Both flat → stable.
  else if (weightDirection === 'flat' && waistDirection === 'flat') {
    visualTrend = 'stable';
    shortHeadline = 'No measurable change between sets';
    recommendation =
      'Hold the plan. Two-week windows are short for visible change — keep stacking sessions and macros.';
    observations.push(
      `Weight within ±1 lb and waist within ±0.25 in between ${previous.date} and ${current.date}.`,
    );
  }
  // 7. Photos exist, no measurement anchors at all → low-confidence visual only.
  else if (
    weightDeltaLbs === null &&
    waistDeltaIn === null
  ) {
    visualTrend = 'unclear';
    shortHeadline = 'Visual tracking only — measurements not anchored';
    recommendation =
      'Log a weight and waist measurement on the same days as your photos. Without those, the photo read is opinion, not data.';
    observations.push(
      'No weight or waist measurement within 7 days of either photo set. Photos by themselves cannot drive plan changes.',
    );
  } else {
    // Generic fallback — compose what we know.
    visualTrend = 'unclear';
    shortHeadline = 'Mixed signals between weight, waist, and photos';
    recommendation =
      'Hold the plan. Compare again next week with consistent timing and a waist measurement.';
    if (weightDeltaLbs !== null) {
      observations.push(
        `Weight ${weightDeltaLbs > 0 ? '+' : ''}${weightDeltaLbs.toFixed(1)} lb between sets.`,
      );
    }
    if (waistDeltaIn !== null) {
      observations.push(
        `Waist ${waistDeltaIn > 0 ? '+' : ''}${waistDeltaIn.toFixed(2)} in between sets.`,
      );
    }
  }

  // Self-reported signal observation
  if (selfReported) {
    const labels: Record<PhotoVisualSignal, string> = {
      tighter_waist: 'You said: waist looks tighter — supports the measurements.',
      less_bloated: 'You said: less bloated — useful context for any weight spike.',
      no_change: 'You said: no visible change.',
      unsure: 'You said: unsure — the data has to do the work this week.',
    };
    observations.push(labels[selfReported]);
  }

  // Posture / consistency context
  if (setHasAllAngles(current) && setHasAllAngles(previous)) {
    observations.push(
      'Both sets have all three angles (front / side / back) — the comparison is comparing apples to apples.',
    );
  } else if (setHasAllAngles(current) && !setHasAllAngles(previous)) {
    observations.push(
      'Previous set is missing at least one angle. The comparison is partial; fill the missing slot next time.',
    );
  } else if (!setHasAllAngles(current)) {
    observations.push(
      'Current set is missing at least one angle. Add the missing slot to make the next comparison stronger.',
    );
  }

  // Confidence model
  let confidence: PhotoConfidence;
  const hasAnyWaist = waistDeltaIn !== null;
  const enoughSpacing = spacing.ok;
  const lowBloating = (lastCheckIn?.bloatingLevel ?? 0) > 0 && (lastCheckIn?.bloatingLevel ?? 0) < 6;

  if (
    enoughSpacing &&
    hasAnyWaist &&
    setHasAllAngles(current) &&
    setHasAllAngles(previous) &&
    lowBloating &&
    !waterRetentionFlagged
  ) {
    confidence = 'high';
  } else if (enoughSpacing && (hasAnyWaist || setHasAllAngles(current))) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  return {
    visualTrend,
    confidence,
    shortHeadline,
    observations,
    recommendation,
    safetyNote: SAFETY_NOTE,
    latestSetDate: current.date,
    previousSetDate: previous.date,
    daysBetween,
    weightDeltaLbs,
    waistDeltaIn,
    waterRetentionFlagged,
    selfReportedSignal: selfReported,
  };
}

// ─── UI tokens ─────────────────────────────────────────────────────────────

export const TREND_TONE: Record<VisualTrend, 'success' | 'accent' | 'warning'> = {
  improving: 'success',
  stable: 'accent',
  unclear: 'warning',
};

export const TREND_LABEL: Record<VisualTrend, string> = {
  improving: 'Improving',
  stable: 'Stable',
  unclear: 'Unclear',
};

export const CONFIDENCE_LABEL: Record<PhotoConfidence, string> = {
  low: 'low confidence',
  medium: 'medium confidence',
  high: 'high confidence',
};
