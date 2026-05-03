// Fat Loss Timeline Engine.
//
// Four phases with realistic expectations for a fat-loss block. Anchors
// "weeks in" on the user's earliest body metric (or profile.createdAt
// fallback) so the timeline reflects how long they've actually been at it.
//
// Adjusts for adherence + flags muscle-loss risk. Never claims a precise
// week-by-week number — visible body changes are non-linear and
// hormonally noisy. The engine talks in ranges and "what to expect."
//
// Pure deterministic — no APIs, no ML.

import type { BodyMetric, Profile, WeeklyCheckIn } from '../types';

export type TimelinePhase =
  | 'early'
  | 'visible_change'
  | 'transformation'
  | 'goal';

export interface TimelinePhaseInfo {
  phase: TimelinePhase;
  label: string;
  weekRange: string;
  expectedLossRange: string;
  visualChanges: string;
  coachingNote: string;
  isCurrent: boolean;
  isComplete: boolean;
}

export interface FatLossTimelineReport {
  /** Weeks since the user started logging. */
  weeksIn: number;
  currentPhase: TimelinePhase;
  phases: TimelinePhaseInfo[];
  totalLostLbs: number;
  remainingLbs: number;
  /** Smoothed lb/wk from existing weight trend, when available. */
  weeklyTrendLbs: number;
  warnings: string[];
  /**
   * 1.0 = on schedule. > 1 = slower than baseline (low adherence,
   * plateau). The Dashboard surfaces this as a sub-line.
   */
  adjustedFactor: number;
  /** Plain-English read for the headline. */
  headline: string;
}

export interface FatLossTimelineInput {
  profile: Profile;
  metrics: BodyMetric[];
  /** Smoothed lb/wk change from weightTrendEngine or femaleFatLossEngine. */
  weeklyTrendLbs: number;
  /** Adherence 0..1 from the latest check-in (0 when none). */
  adherenceScore: number;
  lastCheckIn?: WeeklyCheckIn;
}

const PHASE_ORDER: TimelinePhase[] = [
  'early',
  'visible_change',
  'transformation',
  'goal',
];

const PHASE_META: Record<
  TimelinePhase,
  Omit<TimelinePhaseInfo, 'isCurrent' | 'isComplete'>
> = {
  early: {
    phase: 'early',
    label: 'Early',
    weekRange: 'Weeks 0–4',
    expectedLossRange: '4–8 lb',
    visualChanges:
      'Mostly water + glycogen. Face starts to look less puffy. Scale moves fastest in this phase.',
    coachingNote:
      "Don't change anything yet. Build the daily habits — weigh-ins, protein, training — and let the body settle.",
  },
  visible_change: {
    phase: 'visible_change',
    label: 'Visible change',
    weekRange: 'Weeks 5–8',
    expectedLossRange: '3–5 lb (cumulative 7–13 lb)',
    visualChanges:
      'Waist starts shrinking on the tape. Clothes fit looser. First "did you lose weight?" comments around week 7.',
    coachingNote:
      "Keep adherence clean. Weight trend slows here — that's normal, not a stall.",
  },
  transformation: {
    phase: 'transformation',
    label: 'Transformation',
    weekRange: 'Weeks 9–16',
    expectedLossRange: '5–8 lb (cumulative 12–21 lb)',
    visualChanges:
      'Visible muscle definition appears as fat thins out. Photos start to look meaningfully different. Stomach looks flatter in the morning.',
    coachingNote:
      'This is where the work compounds. Stay patient — adjust slowly when the trend genuinely flattens for 14+ days.',
  },
  goal: {
    phase: 'goal',
    label: 'Goal phase',
    weekRange: 'Weeks 17+',
    expectedLossRange: 'final 5–10 lb',
    visualChanges:
      'Final body composition refinement. Scale moves slow but the mirror keeps changing.',
    coachingNote:
      "When you're within 5 lb of goal: hold the cut for 2 more weeks then transition to maintenance with a small calorie reset.",
  },
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function weeksSince(iso: string): number {
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / (7 * 86400000)),
  );
}

function totalLostFromMetrics(metrics: BodyMetric[], profile: Profile): number {
  const sortedAsc = metrics
    .filter((m) => typeof m.weightLbs === 'number')
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!sortedAsc.length) return 0;
  const baseline = sortedAsc[0].weightLbs as number;
  const newest =
    (sortedAsc[sortedAsc.length - 1].weightLbs as number) ?? baseline;
  return Math.max(0, +(baseline - newest).toFixed(1));
}

// ─── Main entry ────────────────────────────────────────────────────────────

export function buildFatLossTimeline(
  input: FatLossTimelineInput,
): FatLossTimelineReport {
  const { profile, metrics, weeklyTrendLbs, adherenceScore, lastCheckIn } =
    input;

  // Anchor "weeks in" on the earliest body metric (best signal for "when
  // did you start logging") with profile.createdAt as the fallback.
  const sortedAsc = metrics
    .filter((m) => typeof m.weightLbs === 'number')
    .sort((a, b) => a.date.localeCompare(b.date));
  const startIso = sortedAsc[0]?.date ?? profile.createdAt;
  const weeksIn = weeksSince(startIso);

  const totalLostLbs = totalLostFromMetrics(metrics, profile);
  const currentWeight =
    sortedAsc[sortedAsc.length - 1]?.weightLbs ?? profile.weightLbs;
  const remainingLbs = +Math.max(0, currentWeight - profile.goalWeightLbs).toFixed(1);

  // Determine current phase. Goal phase short-circuits when within 5 lb.
  let currentPhase: TimelinePhase;
  if (remainingLbs <= 5) currentPhase = 'goal';
  else if (weeksIn <= 4) currentPhase = 'early';
  else if (weeksIn <= 8) currentPhase = 'visible_change';
  else if (weeksIn <= 16) currentPhase = 'transformation';
  else currentPhase = 'goal';

  // Adjusted factor — surfaced in headline, not used to redraw timeline
  // ranges. Conservative: low adherence slows by 30–50%, plateau by 20%.
  let adjustedFactor = 1.0;
  const warnings: string[] = [];
  if (adherenceScore > 0 && adherenceScore < 0.8) {
    adjustedFactor = 1 + (0.8 - adherenceScore) * 2; // 0.6 → 1.4, 0.7 → 1.2
    warnings.push(
      `Adherence at ${Math.round(adherenceScore * 100)}% — timeline will run ${Math.round((adjustedFactor - 1) * 100)}% slower until that lands closer to 90%.`,
    );
  }
  if (weeklyTrendLbs < -2) {
    warnings.push(
      `Losing ${Math.abs(weeklyTrendLbs).toFixed(1)} lb/wk — that's into muscle-loss territory. Add 100–150 kcal back to protect strength.`,
    );
  }
  if (
    weeklyTrendLbs >= -0.4 &&
    weeklyTrendLbs <= 0.4 &&
    weeksIn >= 5 &&
    currentPhase !== 'goal'
  ) {
    warnings.push(
      'Trend is flat — timeline extends until movement returns. Run a /check-in to surface what changed.',
    );
    adjustedFactor = Math.max(adjustedFactor, 1.2);
  }
  if (lastCheckIn?.bloatingLevel && lastCheckIn.bloatingLevel >= 7) {
    warnings.push(
      'Bloating high this week — trust waist measurements + photos over the scale until it settles.',
    );
  }

  // Build phase tiles
  const phases: TimelinePhaseInfo[] = PHASE_ORDER.map((p, i) => {
    const meta = PHASE_META[p];
    const currentIndex = PHASE_ORDER.indexOf(currentPhase);
    return {
      ...meta,
      isCurrent: p === currentPhase,
      isComplete: i < currentIndex,
    };
  });

  // Headline — what to tell the user in one line
  const headline = buildHeadline(currentPhase, weeksIn, totalLostLbs, remainingLbs);

  return {
    weeksIn,
    currentPhase,
    phases,
    totalLostLbs,
    remainingLbs,
    weeklyTrendLbs,
    warnings,
    adjustedFactor,
    headline,
  };
}

function buildHeadline(
  phase: TimelinePhase,
  weeksIn: number,
  totalLost: number,
  remaining: number,
): string {
  if (phase === 'goal' && remaining <= 5) {
    return `Goal phase — ${remaining.toFixed(1)} lb to go. The mirror will keep changing even when the scale doesn't.`;
  }
  if (phase === 'early') {
    return `Week ${weeksIn} — early phase. The scale moves fast right now; that's water + glycogen, not all fat.`;
  }
  if (phase === 'visible_change') {
    return `Week ${weeksIn} — visible-change phase. ${totalLost > 0 ? `${totalLost} lb lost so far. ` : ''}Waist + photos start mattering more than the scale.`;
  }
  if (phase === 'transformation') {
    return `Week ${weeksIn} — transformation phase. ${totalLost > 0 ? `${totalLost} lb in. ` : ''}This is where the work compounds.`;
  }
  return `Week ${weeksIn}.`;
}

// ─── UI tokens ─────────────────────────────────────────────────────────────

export const PHASE_TONE: Record<TimelinePhase, 'success' | 'accent' | 'warning' | 'danger'> = {
  early: 'accent',
  visible_change: 'accent',
  transformation: 'success',
  goal: 'success',
};
