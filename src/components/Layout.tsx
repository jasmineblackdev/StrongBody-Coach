import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  User2,
  Dumbbell,
  ClipboardList,
  Salad,
  LineChart,
  Flame,
  Menu,
  X,
  ClipboardCheck,
} from 'lucide-react';
import { useState } from 'react';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/profile', label: 'Profile', icon: User2 },
  { to: '/plan', label: 'Workout Plan', icon: Dumbbell },
  { to: '/log', label: 'Log Workout', icon: ClipboardList },
  { to: '/check-in', label: 'Weekly Check-In', icon: ClipboardCheck },
  { to: '/meals', label: 'Meals', icon: Salad },
  { to: '/progress', label: 'Progress', icon: LineChart },
];

function NavItems({ onClick }: { onClick?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.end}
          onClick={onClick}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              isActive
                ? 'bg-accent/15 text-white ring-accent-soft'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-ink-800'
            }`
          }
        >
          <n.icon size={18} />
          <span>{n.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent shadow-glow">
        <Flame size={18} className="text-white" />
      </div>
      <div className="leading-tight">
        <div className="font-display text-sm font-bold tracking-wide">STRONGBODY</div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">Coach</div>
      </div>
    </div>
  );
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-full">
      {/* Top bar (mobile) */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between border-b border-ink-800/80 bg-ink-950/80 px-4 py-3 backdrop-blur">
        <Brand />
        <button
          aria-label="Open menu"
          onClick={() => setOpen(true)}
          className="rounded-lg border border-ink-700 p-2 text-zinc-200 hover:bg-ink-800"
        >
          <Menu size={18} />
        </button>
      </header>

      <div className="md:flex">
        {/* Sidebar (desktop) */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-ink-800/80 bg-ink-950/60 px-4 py-6 md:block">
          <div className="mb-6">
            <Brand />
          </div>
          <NavItems />
          <div className="mt-8 rounded-2xl border border-ink-800 bg-ink-900 p-4 text-xs text-zinc-400">
            <div className="text-zinc-200 font-semibold mb-1">Coach voice</div>
            "Bracing first, depth second. Let the bar move you when you need to grind — not a day before."
          </div>
        </aside>

        {/* Mobile drawer */}
        {open && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
            <div className="absolute left-0 top-0 h-full w-72 bg-ink-900 border-r border-ink-800 p-4">
              <div className="flex items-center justify-between mb-6">
                <Brand />
                <button onClick={() => setOpen(false)} className="rounded-lg border border-ink-700 p-2">
                  <X size={18} />
                </button>
              </div>
              <NavItems onClick={() => setOpen(false)} />
            </div>
          </div>
        )}

        {/* Main */}
        <main className="min-w-0 flex-1 px-3 py-5 sm:px-4 sm:py-6 md:px-8 md:py-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
