import { useMemo } from 'react';
import { User, Sparkles } from 'lucide-react';
import { Card, Pill, SectionHeader } from './ui';
import {
  computeAdaptiveIdentity,
  ADHERENCE_TYPE_LABEL,
  FAT_LOSS_TYPE_LABEL,
  FOOD_SENSITIVITY_LABEL,
  PREFERRED_ADJUSTMENT_LABEL,
  RECOVERY_SENSITIVITY_LABEL,
} from '../lib/adaptiveIdentityEngine';
import { store } from '../lib/storage';
import { useStoreVersion } from '../hooks/useStore';
import type { Profile } from '../types';

export default function IdentityCard({ profile }: { profile: Profile }) {
  useStoreVersion();
  const identity = useMemo(
    () =>
      computeAdaptiveIdentity({
        profile,
        metrics: store.getMetrics(),
        recentLogs: store.getLogs(),
        checkIns: store.getCheckIns(),
        decisions: store.getCoachDecisions(),
        mealFeedback: store.getMealFeedback(),
      }),
    [profile],
  );

  const maturityTone =
    identity.maturityScore >= 60
      ? 'success'
      : identity.maturityScore >= 30
      ? 'warning'
      : 'accent';

  return (
    <Card>
      <SectionHeader
        title="My Coaching Profile"
        subtitle="Patterns the engine has learned about how YOUR body responds. Updates gradually — never from one event."
        action={
          <Pill tone={maturityTone}>
            <User size={12} /> {identity.maturityScore}/100 maturity
          </Pill>
        }
      />

      <div className="grid gap-2 md:grid-cols-2">
        <Trait
          label="Fat-loss type"
          value={FAT_LOSS_TYPE_LABEL[identity.fatLossType]}
          unknown={identity.fatLossType === 'unknown'}
        />
        <Trait
          label="Preferred adjustment"
          value={PREFERRED_ADJUSTMENT_LABEL[identity.preferredAdjustment]}
          unknown={identity.preferredAdjustment === 'unknown'}
        />
        <Trait
          label="Recovery sensitivity"
          value={RECOVERY_SENSITIVITY_LABEL[identity.recoverySensitivity]}
          unknown={identity.recoverySensitivity === 'unknown'}
        />
        <Trait
          label="Food sensitivity"
          value={FOOD_SENSITIVITY_LABEL[identity.foodSensitivity]}
          unknown={identity.foodSensitivity === 'unknown'}
        />
        <Trait
          label="Adherence pattern"
          value={ADHERENCE_TYPE_LABEL[identity.adherenceType]}
          unknown={identity.adherenceType === 'unknown'}
        />
      </div>

      {identity.reasons.length > 0 && (
        <div className="mt-3 rounded-2xl border border-accent/30 bg-accent/5 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-rose-glow">
            <Sparkles size={12} /> Why these traits
          </div>
          <ul className="mt-2 space-y-1 text-xs text-zinc-200">
            {identity.reasons.map((r, i) => (
              <li key={i}>• {r}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 text-[11px] text-zinc-500">
        Coach Brain uses these traits as gentle bias — never to override
        safety. Pain, injury risk, female-layer flags, and low confidence
        all win over identity. Maturity grows as you log more weeks.
      </p>
    </Card>
  );
}

function Trait({
  label,
  value,
  unknown,
}: {
  label: string;
  value: string;
  unknown: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        unknown
          ? 'border-ink-800 bg-ink-900/40'
          : 'border-accent/30 bg-accent/5'
      }`}
    >
      <div className="text-[11px] uppercase tracking-wider text-zinc-400">
        {label}
      </div>
      <div
        className={`mt-1 text-sm font-semibold ${
          unknown ? 'text-zinc-500' : 'text-zinc-100'
        }`}
      >
        {value}
      </div>
    </div>
  );
}
