// Coach Voice — consistent tone across cards.
//
// Direct, supportive, no body shaming, no panic decisions, clear next
// action. Each function takes a structured context and returns a single
// short phrase the UI can drop in next to existing copy. The decision
// engines stay the source of truth for WHAT to do; this file only
// shapes HOW it sounds.

import type { ConfidenceLevel } from './confidenceScoreEngine';
import type { FatLossState } from './femaleFatLossEngine';
import type { CoachDecisionKind } from '../types';

/**
 * Voice for the confidence pill itself — one short sentence summarising
 * the read for the user. Surfaced under the pill on every card.
 */
export function voiceForConfidence(
  level: ConfidenceLevel,
  safetyOverride: boolean,
): string {
  if (safetyOverride) {
    return 'Safety first. The data could be perfect and I still wouldn\'t push load with pain in the picture.';
  }
  switch (level) {
    case 'high':
      return 'The data is solid — when I make a call here, you can act on it.';
    case 'medium':
      return 'I have enough to read the trend, but a couple of pieces would tighten this up.';
    case 'low':
      return "I don't have enough yet to make a real call. Don't change the plan from here.";
  }
}

/**
 * Voice for a Coach Brain decision. Keeps the same tone whether the
 * recommendation is to push, hold, or pull back.
 */
export function voiceForDecision(
  kind: CoachDecisionKind,
  level: ConfidenceLevel,
): string {
  if (level === 'low' && (kind === 'reduce_calories' || kind === 'shift_carbs')) {
    return "I'm not confident enough to cut food yet. Log more data first — that's the cheapest fix.";
  }
  switch (kind) {
    case 'stay_course':
      return 'Stay the course. The trend is moving and your data is strong.';
    case 'reduce_calories':
      return "Time to tighten calories. Small cut, then we re-check in 7 days — no further than that.";
    case 'increase_steps':
      return 'Add steps before you cut food. Cheaper, less hungry, same result.';
    case 'shift_carbs':
      return "Don't cut yet. Pull on food triggers and bloating first — then we'll know.";
    case 'increase_recovery':
      return "You're losing too fast. Add food back to protect muscle — this isn't a failure.";
    case 'reduce_training_volume':
      return "Recovery is dragging. Drop a working set and the lifts will come back.";
    case 'deload':
      return 'Deload week. Coming back fresh always beats grinding through fatigue.';
    case 'adjust_exercises':
      return 'Swap to safer variations. Pain is information, not weakness.';
    case 'improve_adherence':
      return "This isn't a plateau — it's a leak. Hit the current targets clean for 7 days.";
    case 'log_more_data':
      return "Hold. I won't guess on thin data — the wrong adjustment costs more than the wait.";
  }
}

/**
 * Voice for a female fat-loss state — explains the read in trainer
 * language without medicalising or panicking.
 */
export function voiceForFemaleState(state: FatLossState): string | null {
  switch (state) {
    case 'water_retention':
      return 'This looks like water, not fat gain. Keep your plan steady — the scale will catch up.';
    case 'false_plateau':
      return "This isn't a real plateau yet. Cutting food into noise is how stalls turn into burnout.";
    case 'true_plateau':
      return "This is a real plateau — small adjustment is justified. We'll pick the lever together.";
    case 'mid_cycle_caution':
      return 'Hormonal week. We hold the plan and re-check when you cycle through.';
    case 'hunger_hormonal':
      return 'High hunger is hormonal more often than it\'s a calorie issue. Don\'t cut food into a hunger spike.';
    case 'losing_too_fast':
      return "You're moving too fast. Add a little food — protect the muscle while you finish the cut.";
    case 'on_track':
      return 'On track. Female fat loss is non-linear; this is the linear-enough.';
    case 'insufficient_data':
      return 'Not enough yet. Daily morning weigh-ins for a week and the picture clears up.';
  }
}

/**
 * Single-line recommendation phrasing for the macro card. Confidence-aware:
 * low confidence never lands on "cut more" language.
 */
export function voiceForMacroRecommendation(
  level: ConfidenceLevel,
  goal: 'fat_loss' | 'recomp' | 'strength' | 'meet_prep',
): string {
  if (level === 'low') {
    return 'Treat these targets as a starting point. Hit them clean for 2 weeks before changing anything.';
  }
  if (goal === 'fat_loss') {
    return level === 'high'
      ? 'Targets are tuned to your data. Hit them and the trend will follow.'
      : 'Targets are workable. Run them clean and the next check-in tightens them.';
  }
  if (goal === 'recomp') {
    return 'Recomp targets — protein is the lever, training is the multiplier. Calories sit close to maintenance.';
  }
  if (goal === 'strength') {
    return 'Strength targets — fed enough to perform, not enough to drift. Bar speed is the test.';
  }
  return 'Meet-prep targets — slight surplus while sharpening, drop closer to the meet.';
}
