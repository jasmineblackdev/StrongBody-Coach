// Rule-based natural-language coach summary. Composes 3–5 sentences from
// the existing engine outputs. No LLM, no APIs — deterministic templates
// driven by signal flags.

import type { Profile, WeeklyCheckIn } from '../../types';
import type { FatLossAnalysis } from '../fatLossEngine';
import type { ReadinessReport } from '../recoveryEngine';
import type { LiftEstimate, LiftKey, StrengthTrend } from '../strengthEngine';
import type { WeightTrendReport } from '../weightTrendEngine';

export interface CoachSummaryInput {
  profile: Profile;
  weight: WeightTrendReport;
  recovery: ReadinessReport;
  lifts: Record<LiftKey, LiftEstimate>;
  fatLoss: FatLossAnalysis;
  lastCheckIn?: WeeklyCheckIn;
}

export interface CoachSummary {
  sentences: string[];
  tone: 'success' | 'warning' | 'danger' | 'accent';
}

function aggregateLifts(
  lifts: Record<LiftKey, LiftEstimate>,
): StrengthTrend {
  const trends = [lifts.squat.trend, lifts.bench.trend, lifts.deadlift.trend];
  if (trends.every((t) => t === 'unknown')) return 'unknown';
  if (trends.filter((t) => t === 'regressing').length >= 2) return 'regressing';
  if (trends.filter((t) => t === 'improving').length >= 2) return 'improving';
  return 'flat';
}

export function generateCoachSummary(input: CoachSummaryInput): CoachSummary {
  const { profile, weight, recovery, lifts, fatLoss } = input;
  const sentences: string[] = [];

  // 1) Weight read
  if (weight.confidence === 'low') {
    sentences.push(
      "I don't have enough weight data yet to read your trend — log daily for a week and the picture gets honest.",
    );
  } else if (weight.trend === 'losing') {
    const rate = Math.abs(weight.weeklyChange);
    if (rate >= 1 && rate <= 2) {
      sentences.push(
        `You're trending down ${rate.toFixed(1)} lb/wk — exactly the pace we want.`,
      );
    } else if (rate > 2) {
      sentences.push(
        `Trending down ${rate.toFixed(1)} lb/wk is fast — protect muscle by holding protein high (${Math.round(profile.weightLbs * 0.9)}g+).`,
      );
    } else {
      sentences.push(
        `Slow downtrend (${rate.toFixed(1)} lb/wk). Fine if recovery and energy are holding.`,
      );
    }
  } else if (weight.trend === 'stable') {
    sentences.push(
      "Weight has been stable for a week+. Tighten adherence first; if that's clean, we adjust the plan.",
    );
  } else if (weight.trend === 'gaining' && profile.goal === 'fat_loss') {
    sentences.push(
      'Trending up on a fat-loss block. Recheck calories and weekend swings before changing the plan.',
    );
  }

  // 2) Training / recovery
  if (recovery.suggestion === 'deload') {
    sentences.push(
      `Recovery is in the red (${recovery.score}/100) — deload before anything else. Sleep and food are the lever.`,
    );
  } else if (recovery.suggestion === 'reduce') {
    sentences.push(
      'Recovery is dragging. Cut training volume ~15% this week before tightening the diet.',
    );
  } else if (recovery.suggestion === 'maintain') {
    sentences.push(
      'Training is well-managed. Hold loads steady — quality reps over PRs this week.',
    );
  } else {
    sentences.push(
      `Recovery looks strong (${recovery.score}/100). You can push the prescribed loads.`,
    );
  }

  // 3) Strength signal
  const strengthDirection = aggregateLifts(lifts);
  if (strengthDirection === 'improving') {
    sentences.push('Strength is improving across the big 3 — keep the prescribed loads.');
  } else if (strengthDirection === 'regressing') {
    sentences.push(
      'Strength is regressing — usually fueling, not training. Add 30–50g carbs around lifts before any further calorie cut.',
    );
  } else if (strengthDirection === 'flat') {
    sentences.push(
      'Strength is holding flat — normal during a cut. Watch for plateaus across 2+ weeks.',
    );
  }

  // 4) This week's primary action
  sentences.push(`This week's priority: ${fatLoss.primary.headline.toLowerCase()}.`);

  // 5) Optional: check-in nudge
  if (fatLoss.daysSinceLastCheckIn === null) {
    sentences.push('Run your first weekly check-in to give the engine more to work with.');
  } else if (fatLoss.daysSinceLastCheckIn >= 7) {
    sentences.push(
      `Last check-in was ${fatLoss.daysSinceLastCheckIn} days ago — due for a fresh one.`,
    );
  }

  // Tone selection
  let tone: CoachSummary['tone'] = 'accent';
  if (recovery.suggestion === 'deload' || strengthDirection === 'regressing') {
    tone = 'danger';
  } else if (
    recovery.suggestion === 'reduce' ||
    (weight.trend === 'gaining' && profile.goal === 'fat_loss')
  ) {
    tone = 'warning';
  } else if (
    weight.trend === 'losing' ||
    strengthDirection === 'improving'
  ) {
    tone = 'success';
  }

  return { sentences: sentences.slice(0, 5), tone };
}
