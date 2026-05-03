// Heuristic "AI-style" analysis of progress photo sets. Photos themselves
// are NOT processed — this engine fuses every signal we already have
// (weight trend, waist measurements, workout completion, recovery,
// problem areas) into a structured supportive read.
//
// Rules of the road:
//   - Photos cannot drive macro or workout changes alone. The CoachBrain
//     weekly decision is still the only thing that adjusts plans.
//   - No body shaming language.
//   - No body-fat-percentage estimates.
//   - No diagnosis or medical claims.
//   - Always confirm with the rest of the data, and call out what's
//     missing so the user knows the read is incomplete.

import type { BodyMetric, Profile, WeeklyCheckIn } from '../types';
import type { PhotoSet } from './photoStorage';

export type AnalysisTone = 'positive' | 'neutral' | 'caution';

export interface PhotoAnalysisReport {
  /** Latest photo set being analyzed. Null when there are no photos yet. */
  current: PhotoSet | null;
  /** Earliest photo set still kept, used as the comparison anchor. */
  baseline: PhotoSet | null;
  /** Days between baseline and current. */
  daysBetween: number;
  /** Net weight change between the two anchor sets, when available. */
  weightChangeLbs: number | null;
  /** Net waist change between the two anchor sets, when available. */
  waistChangeIn: number | null;
  tone: AnalysisTone;
  visibleChanges: string[];
  postureObservations: string[];
  areasToKeepTracking: string[];
  trainingSuggestion: string;
  nutritionSuggestion: string;
  whatDataIsStillNeeded: string[];
  safetyNotes: string[];
}

export interface PhotoAnalysisInput {
  profile: Profile;
  photoSets: PhotoSet[];
  metrics: BodyMetric[];
  lastCheckIn?: WeeklyCheckIn;
}

const SAFETY_NOTES = [
  'Photos are supportive feedback only — your weight trend, lifts, and check-ins drive the actual plan.',
  'No body-fat percentage is estimated here. Visual changes are subjective and lighting-dependent.',
  'If something on your body hurts or looks abnormal (lumps, swelling, rash), see a clinician — this engine does not diagnose.',
];

export function analyzePhotos(input: PhotoAnalysisInput): PhotoAnalysisReport {
  const { profile, photoSets, metrics, lastCheckIn } = input;

  // Sort newest → oldest so [0] is the most recent set.
  const sortedDesc = [...photoSets].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  const current = sortedDesc[0] ?? null;
  const baseline = sortedDesc.length > 1 ? sortedDesc[sortedDesc.length - 1] : null;

  // No photos at all → empty informative report.
  if (!current) {
    return {
      current: null,
      baseline: null,
      daysBetween: 0,
      weightChangeLbs: null,
      waistChangeIn: null,
      tone: 'neutral',
      visibleChanges: [],
      postureObservations: [],
      areasToKeepTracking: [
        'Upload your first front / side / back set to anchor this report.',
      ],
      trainingSuggestion:
        'Stay on your current plan. Visuals lag the scale by 2–4 weeks — first round of photos is just the baseline.',
      nutritionSuggestion:
        'Hold your current macros. Don\'t change anything for the photo report alone.',
      whatDataIsStillNeeded: [
        'At least one photo set (front, side, back).',
        '7+ days of daily weigh-ins.',
        'A recent weekly check-in.',
      ],
      safetyNotes: SAFETY_NOTES,
    };
  }

  // Baseline weight/waist at the current set's date — prefer the snapshot
  // stored on the photo set, then fall back to the closest body metric.
  const currentWeight = current.weightLbs ?? closestWeight(metrics, current.date);
  const baselineWeight =
    baseline?.weightLbs ?? (baseline ? closestWeight(metrics, baseline.date) : null);
  const currentWaist = closestWaist(metrics, current.date);
  const baselineWaist = baseline ? closestWaist(metrics, baseline.date) : null;

  const weightChangeLbs =
    typeof currentWeight === 'number' && typeof baselineWeight === 'number'
      ? +(currentWeight - baselineWeight).toFixed(1)
      : null;
  const waistChangeIn =
    typeof currentWaist === 'number' && typeof baselineWaist === 'number'
      ? +(currentWaist - baselineWaist).toFixed(2)
      : null;

  const daysBetween = baseline
    ? Math.max(
        0,
        Math.round(
          (new Date(current.date).getTime() - new Date(baseline.date).getTime()) /
            86400000,
        ),
      )
    : 0;

  const visibleChanges: string[] = [];
  const postureObservations: string[] = [];
  const areasToKeepTracking: string[] = [];
  const whatDataIsStillNeeded: string[] = [];
  let tone: AnalysisTone = 'neutral';

  if (baseline) {
    if (weightChangeLbs !== null) {
      if (weightChangeLbs <= -1) {
        tone = 'positive';
        visibleChanges.push(
          `Down ${Math.abs(weightChangeLbs)} lb between ${baseline.date} and ${current.date} (${daysBetween} days). Visible smoothing is plausible.`,
        );
      } else if (weightChangeLbs >= 1) {
        tone = 'caution';
        visibleChanges.push(
          `Up ${weightChangeLbs} lb between ${baseline.date} and ${current.date}. Could be water/glycogen/food volume — don't react on photos alone.`,
        );
      } else {
        visibleChanges.push(
          `Weight effectively flat between sets (${weightChangeLbs >= 0 ? '+' : ''}${weightChangeLbs} lb). Visible recomp is what to watch for.`,
        );
      }
    }
    if (waistChangeIn !== null) {
      if (waistChangeIn <= -0.25) {
        tone = tone === 'caution' ? 'neutral' : 'positive';
        visibleChanges.push(
          `Waist down ${Math.abs(waistChangeIn)} in — that's the cleaner fat-loss signal than the scale.`,
        );
      } else if (waistChangeIn >= 0.25) {
        visibleChanges.push(
          `Waist up ${waistChangeIn} in — could be bloat or digestion. Cross-check with your bloating score this week.`,
        );
      }
    }
  } else {
    visibleChanges.push(
      'First photo set logged — this becomes your baseline. The next set is what unlocks comparison.',
    );
  }

  // Posture observations: generic, conservative, anchored to user's
  // problem areas + injury-relevant pain history. We don't actually look
  // at the photos — we tell the user what to watch for in the mirror.
  if (profile.problemAreas.includes('lower_back')) {
    postureObservations.push(
      'Side photo: check rib stack — if the front rib cage flares forward of the pelvis, breathing/bracing drills will help low-back load.',
    );
  }
  if (profile.problemAreas.includes('glutes')) {
    postureObservations.push(
      'Back photo: glute fullness across the upper third is what hip thrusts and Bulgarian split squats build over months, not weeks.',
    );
  }
  if (profile.problemAreas.includes('shoulders')) {
    postureObservations.push(
      'Front photo: rounded shoulder position usually softens with row volume + face pulls. Track over sets, not days.',
    );
  }
  if (profile.problemAreas.includes('core')) {
    postureObservations.push(
      'Side photo: a flatter midsection with a small lower-belly pad is normal mid-cut for women — that area drops last.',
    );
  }
  if (profile.problemAreas.includes('belly_bloat')) {
    postureObservations.push(
      'Take photos at the same time of day (morning, fasted, post-bathroom) so bloat fluctuation doesn\'t swing the read.',
    );
  }

  // Areas to keep tracking
  areasToKeepTracking.push('Same lighting, same angle, same time of day.');
  areasToKeepTracking.push('Waist measurement on the same day as the photo set — fat changes beat the scale here.');
  if (sortedDesc.length < 3) {
    areasToKeepTracking.push(
      `Only ${sortedDesc.length} photo set${sortedDesc.length === 1 ? '' : 's'} so far — consistency over 4–6 weeks is what makes the read useful.`,
    );
  }

  // What's missing
  if (!current.front) whatDataIsStillNeeded.push('Front-on photo for the current set.');
  if (!current.side) whatDataIsStillNeeded.push('Side photo for the current set.');
  if (!current.back) whatDataIsStillNeeded.push('Back photo for the current set.');
  if (typeof currentWeight !== 'number') {
    whatDataIsStillNeeded.push('Weight on the same day as the current photo.');
  }
  if (typeof currentWaist !== 'number') {
    whatDataIsStillNeeded.push('Waist measurement (in) on the same day as the current photo.');
  }
  if (!lastCheckIn) {
    whatDataIsStillNeeded.push('A weekly check-in to anchor adherence + hunger + bloating.');
  }

  // Training + nutrition suggestions — defer to the rest of the data, never
  // change the plan because of a photo alone.
  const trainingSuggestion = (() => {
    if (profile.problemAreas.includes('glutes') && (profile.goal === 'fat_loss' || profile.goal === 'recomp')) {
      return 'Hold your current strength block. Glute recomp shows up in photos over months — keep hip thrust, RDL, and Bulgarian split squat volume consistent.';
    }
    if (profile.problemAreas.includes('lower_back')) {
      return 'Don\'t change the plan from photos. If the side photo or actual movement shows a heavy rib flare, add 2 short bracing/dead-bug sets per workout.';
    }
    return 'Keep your current strength block. Visual changes lag training input by 4–8 weeks.';
  })();

  const nutritionSuggestion = (() => {
    if (lastCheckIn && lastCheckIn.bloatingLevel >= 7) {
      return 'Don\'t cut calories from a photo. Bloating is high — review food triggers (lactose, FODMAPs, weekend swing) before any macro change.';
    }
    if (weightChangeLbs !== null && weightChangeLbs >= 1 && profile.goal === 'fat_loss') {
      return 'Photos suggest scale crept up — but check water/sodium/hormones/cycle first. If your weekly coach decision says "Reduce calories," act on that, not on the photos.';
    }
    if (weightChangeLbs !== null && weightChangeLbs <= -1) {
      return 'You\'re losing — keep protein at target and don\'t cut more on the strength of the photo. Let the weekly coach decision do the dieting.';
    }
    return 'Hold your current macros. Use the weekly check-in + coach decision to steer macros, not photos.';
  })();

  return {
    current,
    baseline,
    daysBetween,
    weightChangeLbs,
    waistChangeIn,
    tone,
    visibleChanges,
    postureObservations,
    areasToKeepTracking,
    trainingSuggestion,
    nutritionSuggestion,
    whatDataIsStillNeeded,
    safetyNotes: SAFETY_NOTES,
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function closestWeight(metrics: BodyMetric[], date: string): number | null {
  return closestField(metrics, date, 'weightLbs');
}

function closestWaist(metrics: BodyMetric[], date: string): number | null {
  return closestField(metrics, date, 'waistIn');
}

function closestField(
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
  // Reject matches > 7 days from the photo date — too noisy to anchor.
  if (!best || bestDelta > 7 * 86400000) return null;
  return (best[field] as number) ?? null;
}
