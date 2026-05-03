import { Power } from 'lucide-react';
import { store } from '../lib/storage';
import { useStoreVersion } from '../hooks/useStore';

/**
 * Reusable Gym Mode pill. Renders the same control on every page that
 * surfaces it (Dashboard + Workout Plan). Hides itself when there's no
 * profile yet (e.g., first-run before profile creation).
 */
export default function GymModeToggle({
  className = '',
}: {
  className?: string;
}) {
  useStoreVersion();
  const profile = store.getProfile();
  if (!profile) return null;
  const gymMode = profile.gymMode === true;
  return (
    <button
      onClick={() => store.setProfile({ ...profile, gymMode: !gymMode })}
      aria-pressed={gymMode}
      className={`shrink-0 rounded-2xl border-2 px-4 py-3 text-sm font-semibold transition active:scale-95 ${
        gymMode
          ? 'border-success/40 bg-success/15 text-success'
          : 'border-ink-700 bg-ink-850 text-zinc-200 hover:bg-ink-800'
      } ${className}`}
    >
      <Power size={14} className="mr-1.5 inline-block" />
      Gym Mode {gymMode ? 'ON' : 'OFF'}
    </button>
  );
}
