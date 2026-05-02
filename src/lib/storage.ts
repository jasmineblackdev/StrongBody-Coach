import type {
  BodyMetric,
  PlanProposal,
  Profile,
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

export const store = {
  getProfile: (): Profile | null => read<Profile | null>(KEYS.profile, null),
  setProfile: (p: Profile) => write(KEYS.profile, p),

  getLogs: (): WorkoutLog[] => read<WorkoutLog[]>(KEYS.logs, []),
  addLog: (log: WorkoutLog) => {
    const logs = store.getLogs();
    logs.unshift(log);
    write(KEYS.logs, logs);
  },
  setLogs: (logs: WorkoutLog[]) => write(KEYS.logs, logs),

  getMetrics: (): BodyMetric[] => read<BodyMetric[]>(KEYS.metrics, []),
  addMetric: (m: BodyMetric) => {
    const metrics = store.getMetrics();
    metrics.unshift(m);
    write(KEYS.metrics, metrics);
  },
  setMetrics: (metrics: BodyMetric[]) => write(KEYS.metrics, metrics),

  getPlan: (): WeeklyPlan | null => read<WeeklyPlan | null>(KEYS.plan, null),
  setPlan: (plan: WeeklyPlan) => write(KEYS.plan, plan),

  getWeekNumber: (): number => read<number>(KEYS.weekNumber, 1),
  setWeekNumber: (n: number) => write(KEYS.weekNumber, n),

  getProposal: (): PlanProposal | null => {
    const p = read<PlanProposal | null>(KEYS.proposal, null);
    if (!p) return null;
    // Drop proposals from older app versions that lack the ops model
    const valid =
      Array.isArray(p.changes) &&
      p.changes.every((c) => typeof c.id === 'string' && Array.isArray(c.ops));
    if (!valid) {
      localStorage.removeItem(KEYS.proposal);
      return null;
    }
    return p;
  },
  setProposal: (p: PlanProposal) => write(KEYS.proposal, p),
  clearProposal: () => localStorage.removeItem(KEYS.proposal),

  reset: () => Object.values(KEYS).forEach((k) => localStorage.removeItem(k)),
};
