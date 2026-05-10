// Local-only progress photo storage. Photos are downscaled to ≤800px wide
// JPEG at ~0.7 quality before storing, then base64 in localStorage. Cap on
// retained sets keeps total payload well under the 5 MB localStorage budget.
//
// Photos are not uploaded for storage. The optional Analyze feature
// forwards photos to a server-side proxy (api/analyze-photos.ts) ONE TIME
// per click; results come back as text and are persisted on the set.

import type { PhotoAnalysis } from './photoAnalysis';

const KEY = 'sbc:progressPhotoSets';
const MAX_SETS = 8;
const MAX_DIMENSION = 800; // longest edge in px
const JPEG_QUALITY = 0.7;

export type PhotoSlot = 'front' | 'side' | 'back';

export interface PhotoSet {
  id: string;
  /** YYYY-MM-DD when the set was taken. */
  date: string;
  /** Optional weight at time of photo — snapshotted from latest body metric. */
  weightLbs?: number;
  /** Base64 dataURL strings for each angle (when uploaded). */
  front?: string;
  side?: string;
  back?: string;
  notes?: string;
  /** Cached AI analysis output, set when the user runs Analyze. */
  analysis?: PhotoAnalysis;
}

// Cache the parsed array so repeated callers get the SAME reference until
// notify() bumps the version. Critical for useSyncExternalStore — its
// snapshot function MUST return the same reference between calls when
// state hasn't changed, otherwise React thinks state changed every render
// and triggers an infinite re-render loop (manifested as React error #185).
let cachedSets: PhotoSet[] | null = null;

function read(): PhotoSet[] {
  if (cachedSets !== null) return cachedSets;
  try {
    const raw = localStorage.getItem(KEY);
    cachedSets = raw ? (JSON.parse(raw) as PhotoSet[]) : [];
  } catch {
    cachedSets = [];
  }
  return cachedSets;
}

function write(sets: PhotoSet[]): void {
  // Newest first, capped.
  const trimmed = sets.slice(0, MAX_SETS);
  try {
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch (err) {
    // Quota exceeded — drop the oldest set and try again. Fail silently
    // after that; the UI will show whatever did persist.
    if (trimmed.length > 1) {
      try {
        localStorage.setItem(KEY, JSON.stringify(trimmed.slice(0, -1)));
      } catch {
        /* give up — caller will see no change */
      }
    }
    void err;
  }
  notify();
}

// ─── Reactive subscribers ──────────────────────────────────────────────────
// Mirrors the reactive layer in storage.ts so the panel re-renders when a
// photo is added from anywhere.

const subscribers = new Set<() => void>();
let version = 0;

export function subscribePhotos(fn: () => void): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

export function getPhotoVersion(): number {
  return version;
}

function notify(): void {
  // Invalidate the cache so the next read() returns fresh data with a
  // new reference. Subscribers are notified after, so the new reference
  // is what they observe.
  cachedSets = null;
  version += 1;
  subscribers.forEach((fn) => fn());
}

// ─── CRUD ──────────────────────────────────────────────────────────────────

export function getPhotoSets(): PhotoSet[] {
  return read();
}

export function findSetByDate(date: string): PhotoSet | undefined {
  return read().find((s) => s.date === date);
}

export function upsertPhoto(
  date: string,
  slot: PhotoSlot,
  dataUrl: string,
  weightLbs?: number,
): void {
  const all = read();
  const idx = all.findIndex((s) => s.date === date);
  if (idx >= 0) {
    all[idx] = {
      ...all[idx],
      [slot]: dataUrl,
      weightLbs: weightLbs ?? all[idx].weightLbs,
    };
  } else {
    const set: PhotoSet = {
      id: cryptoRandomId(),
      date,
      weightLbs,
      [slot]: dataUrl,
    };
    all.unshift(set);
  }
  // Re-sort by date desc so newest is always first.
  all.sort((a, b) => b.date.localeCompare(a.date));
  write(all);
}

export function deletePhoto(date: string, slot: PhotoSlot): void {
  const all = read();
  const idx = all.findIndex((s) => s.date === date);
  if (idx < 0) return;
  const next = { ...all[idx] };
  delete next[slot];
  // If the set is now empty, drop it entirely.
  if (!next.front && !next.side && !next.back) {
    all.splice(idx, 1);
  } else {
    all[idx] = next;
  }
  write(all);
}

export function deleteSet(id: string): void {
  const all = read().filter((s) => s.id !== id);
  write(all);
}

export function setPhotoNotes(date: string, notes: string): void {
  const all = read();
  const idx = all.findIndex((s) => s.date === date);
  if (idx < 0) return;
  all[idx] = { ...all[idx], notes };
  write(all);
}

export function setPhotoAnalysis(date: string, analysis: PhotoAnalysis): void {
  const all = read();
  const idx = all.findIndex((s) => s.date === date);
  if (idx < 0) return;
  all[idx] = { ...all[idx], analysis };
  write(all);
}

export function clearPhotoAnalysis(date: string): void {
  const all = read();
  const idx = all.findIndex((s) => s.date === date);
  if (idx < 0) return;
  const next = { ...all[idx] };
  delete next.analysis;
  all[idx] = next;
  write(all);
}

function cryptoRandomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `ps_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// ─── Image compression ─────────────────────────────────────────────────────
//
// Read a File via FileReader, then draw to a downsized canvas, then
// toDataURL. Returns a base64 JPEG ≤ ~MAX_DIMENSION on the longest edge.
// Falls back to the original data URL if canvas isn't available.

export async function compressImageToDataUrl(file: File): Promise<string> {
  const original = await readAsDataUrl(file);
  try {
    const img = await loadImage(original);
    const ratio = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
    const w = Math.round(img.width * ratio);
    const h = Math.round(img.height * ratio);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return original;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  } catch {
    return original;
  }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
