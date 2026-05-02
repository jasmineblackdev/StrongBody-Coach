import { ReactNode } from 'react';
import { Sparkles, AlertTriangle, TrendingUp, ArrowDownRight, ArrowUpRight } from 'lucide-react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="h2">{title}</h2>
        {subtitle && <p className="muted text-sm mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  unit,
  delta,
  hint,
}: {
  label: string;
  value: string | number;
  unit?: string;
  delta?: { value: number; positiveIsGood?: boolean };
  hint?: string;
}) {
  const positive = delta && (delta.positiveIsGood ?? true) === delta.value > 0;
  return (
    <div className="card">
      <div className="text-xs uppercase tracking-wider text-zinc-400">{label}</div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="font-display text-3xl font-semibold tracking-tight">{value}</span>
        {unit && <span className="text-sm text-zinc-400">{unit}</span>}
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs">
        {delta && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
              positive ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'
            }`}
          >
            {delta.value > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(delta.value)}
          </span>
        )}
        {hint && <span className="text-zinc-400">{hint}</span>}
      </div>
    </div>
  );
}

export function ProgressBar({
  value,
  max,
  tone = 'accent',
  label,
  rightLabel,
}: {
  value: number;
  max: number;
  tone?: 'accent' | 'success' | 'warning' | 'danger';
  label?: string;
  rightLabel?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  const toneClass =
    tone === 'success'
      ? 'bg-success'
      : tone === 'warning'
      ? 'bg-warning'
      : tone === 'danger'
      ? 'bg-danger'
      : 'bg-accent';
  return (
    <div>
      {(label || rightLabel) && (
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-zinc-300 font-medium">{label}</span>
          <span className="text-zinc-400">{rightLabel}</span>
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-ink-800">
        <div className={`h-full ${toneClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function CoachMessage({
  tone = 'accent',
  title,
  children,
  icon,
}: {
  tone?: 'accent' | 'warning' | 'danger' | 'success';
  title?: string;
  children: ReactNode;
  icon?: ReactNode;
}) {
  const map = {
    accent: 'border-accent/30 bg-accent/10 text-rose-glow',
    warning: 'border-warning/30 bg-warning/10 text-warning',
    danger: 'border-danger/30 bg-danger/10 text-danger',
    success: 'border-success/30 bg-success/10 text-success',
  } as const;
  const Icon =
    tone === 'warning' ? AlertTriangle : tone === 'success' ? TrendingUp : Sparkles;
  return (
    <div className={`rounded-2xl border p-4 ${map[tone]}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0 opacity-90">{icon ?? <Icon size={18} />}</div>
        <div className="text-sm leading-relaxed text-zinc-100">
          {title && <div className="font-semibold mb-0.5 text-white">{title}</div>}
          <div className="text-zinc-200/90">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function Pill({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'accent' | 'success' | 'warning' | 'danger' }) {
  const tones = {
    default: 'border-ink-700 bg-ink-850 text-zinc-300',
    accent: 'border-accent/40 bg-accent/15 text-rose-glow',
    success: 'border-success/40 bg-success/15 text-success',
    warning: 'border-warning/40 bg-warning/15 text-warning',
    danger: 'border-danger/40 bg-danger/15 text-danger',
  } as const;
  return <span className={`pill ${tones[tone]}`}>{children}</span>;
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="card text-center py-10">
      <div className="font-display text-lg font-semibold">{title}</div>
      <p className="muted mt-1 text-sm max-w-md mx-auto">{body}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
