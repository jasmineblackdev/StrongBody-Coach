// Client wrapper for the /api/analyze-photos vision endpoint.
//
// The endpoint is a Vercel serverless function that forwards the photos +
// user context to Anthropic's Messages API. Photos never touch any
// third-party storage — they exist in the API request body for the
// duration of the call, then are released.

import type { PhotoSet, PhotoSlot } from './photoStorage';
import type { Profile } from '../types';

export interface PhotoFocusArea {
  area: string;
  rationale: string;
  priority: 'high' | 'medium' | 'low';
}

export interface PhotoExerciseRecommendation {
  name: string;
  sets: string;
  reps: string;
  rationale: string;
}

export interface PhotoAnalysis {
  /** ISO timestamp the analysis was produced. */
  analyzedAt: string;
  /** Model identifier from the API response (for transparency). */
  model: string;
  summary: string;
  whatsWorking: string;
  focusAreas: PhotoFocusArea[];
  exerciseRecommendations: PhotoExerciseRecommendation[];
  caveats: string;
}

interface AnalyzeArgs {
  set: PhotoSet;
  profile: Profile | null;
  weeksTraining?: number;
  /** Exercise library names — keeps recommendations grounded in real entries. */
  availableExercises?: string[];
}

export async function analyzePhotoSet({
  set,
  profile,
  weeksTraining,
  availableExercises,
}: AnalyzeArgs): Promise<PhotoAnalysis> {
  const slots: PhotoSlot[] = ['front', 'side', 'back'];
  const rawPhotos = slots
    .map((slot) => ({ slot, dataUrl: set[slot] }))
    .filter((p): p is { slot: PhotoSlot; dataUrl: string } => Boolean(p.dataUrl));

  if (rawPhotos.length === 0) {
    throw new Error('No photos to analyze — upload at least one angle first.');
  }

  // The stored photos are 800px JPEG for the in-app viewer. The model
  // doesn't need that resolution for a focus-area read — downscale to
  // 512px so the request payload (and Anthropic's image tokenization)
  // shrinks meaningfully, cutting end-to-end latency.
  const photos = await Promise.all(
    rawPhotos.map(async (p) => ({
      slot: p.slot,
      dataUrl: await downscaleForApi(p.dataUrl, 512),
    })),
  );

  const context = {
    sex: profile?.sex,
    age: profile?.age,
    heightInches: profile?.heightInches,
    weightLbs: set.weightLbs ?? profile?.weightLbs,
    goalWeightLbs: profile?.goalWeightLbs,
    goal: profile?.goal,
    trainingDaysPerWeek: profile?.trainingDaysPerWeek,
    problemAreas: profile?.problemAreas,
    weeksTraining,
    availableExercises,
  };

  const res = await fetch('/api/analyze-photos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ photos, context }),
  });

  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as {
      error?: string;
      detail?: string;
    };
    throw new Error(
      errBody.error ?? `Analyze failed (HTTP ${res.status})`,
    );
  }

  const data = (await res.json()) as { analysis: unknown; model: string };
  const a = (data.analysis ?? {}) as Record<string, unknown>;

  return {
    analyzedAt: new Date().toISOString(),
    model: data.model ?? 'unknown',
    summary: String(a.summary ?? ''),
    whatsWorking: String(a.whatsWorking ?? ''),
    focusAreas: Array.isArray(a.focusAreas)
      ? (a.focusAreas as PhotoFocusArea[])
      : [],
    exerciseRecommendations: Array.isArray(a.exerciseRecommendations)
      ? (a.exerciseRecommendations as PhotoExerciseRecommendation[])
      : [],
    caveats: String(a.caveats ?? ''),
  };
}

// Resize a stored JPEG dataURL down to `maxEdge` on its longest side, at
// 0.6 JPEG quality. Used right before /api/analyze-photos so the request
// body (and the model's image tokens) are as small as possible.
async function downscaleForApi(dataUrl: string, maxEdge: number): Promise<string> {
  try {
    const img = await loadImage(dataUrl);
    const longest = Math.max(img.width, img.height);
    if (longest <= maxEdge) return dataUrl;
    const ratio = maxEdge / longest;
    const w = Math.round(img.width * ratio);
    const h = Math.round(img.height * ratio);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.6);
  } catch {
    return dataUrl;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
