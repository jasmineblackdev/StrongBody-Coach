import type {
  BodyMetric,
  PlanProposal,
  Profile,
  WeeklyCheckIn,
  WorkoutLog,
  WeeklyPlan,
} from '../types';

const KEYS = {
  profile: 'sbc:profile',
  logs: 'sbc:workoutLogs',
  metrics: 'sbc:bodyMetrics',
  plan: 'sbc:weeklyPlan',
  weekNumber: 'sbc:weekNumber',
  proposal: 'sbc:planProposal',
  checkIns: 'sbc:checkIns',
} as const;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ─── Reactive layer ──────────────────────────────────────────────────────────
// Every mutation bumps storeVersion and notifies subscribers, so React
// components can re-render on changes from any source (Profile save, Logger
// save, CloudPanel pull, etc.). Read APIs stay synchronous.

let storeVersion = 0;
const subscribers = new Set<() => void>();

function emit(): void {
  storeVersion += 1;
  subscribers.forEach((fn) => fn());
}

export function subscribeStore(listener: () => void): () => void {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}

export function getStoreVersion(): number {
  return storeVersion;
}

export const store = {
  getProfile: (): Profile | null => read<Profile | null>(KEYS.profile, null),
  setProfile: (p: Profile) => {
    write(KEYS.profile, p);
    emit();
  },

  getLogs: (): WorkoutLog[] => read<WorkoutLog[]>(KEYS.logs, []),
  addLog: (log: WorkoutLog) => {
    const logs = store.getLogs();
    logs.unshift(log);
    write(KEYS.logs, logs);
    emit();
  },
  setLogs: (logs: WorkoutLog[]) => {
    write(KEYS.logs, logs);
    emit();
  },

  getMetrics: (): BodyMetric[] => read<BodyMetric[]>(KEYS.metrics, []),
  addMetric: (m: BodyMetric) => {
    const metrics = store.getMetrics();
    metrics.unshift(m);
    write(KEYS.metrics, metrics);
    emit();
  },
  setMetrics: (metrics: BodyMetric[]) => {
    write(KEYS.metrics, metrics);
    emit();
  },

  getPlan: (): WeeklyPlan | null => read<WeeklyPlan | null>(KEYS.plan, null),
  setPlan: (plan: WeeklyPlan) => {
    write(KEYS.plan, plan);
    emit();
  },

  getWeekNumber: (): number => read<number>(KEYS.weekNumber, 1),
  setWeekNumber: (n: number) => {
    write(KEYS.weekNumber, n);
    emit();
  },

  getProposal: (): PlanProposal | null => {
    const p = read<PlanProposal | null>(KEYS.proposal, null);
    if (!p) return null;
    const valid =
      Array.isArray(p.changes) &&
      p.changes.every((c) => typeof c.id === 'string' && Array.isArray(c.ops));
    if (!valid) {
      localStorage.removeItem(KEYS.proposal);
      return null;
    }
    return p;
  },
  setProposal: (p: PlanProposal) => {
    write(KEYS.proposal, p);
    emit();
  },
  clearProposal: () => {
    localStorage.removeItem(KEYS.proposal);
    emit();
  },

  getCheckIns: (): WeeklyCheckIn[] => read<WeeklyCheckIn[]>(KEYS.checkIns, []),
  addCheckIn: (c: WeeklyCheckIn) => {
    const all = store.getCheckIns();
    all.unshift(c);
    write(KEYS.checkIns, all);
    emit();
  },
  setCheckIns: (cs: WeeklyCheckIn[]) => {
    write(KEYS.checkIns, cs);
    emit();
  },

  reset: () => {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
    emit();
  },
};
