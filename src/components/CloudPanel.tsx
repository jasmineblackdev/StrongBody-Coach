import { useState } from 'react';
import { Cloud, CloudOff, LogIn, LogOut, ArrowDownToLine, ArrowUpToLine, Mail } from 'lucide-react';
import { Card, CoachMessage, Pill, SectionHeader } from './ui';
import { sendMagicLink, signOut, useSession } from '../lib/auth';
import { hasSupabase } from '../lib/supabase';
import { pullAll, pushAll, type SyncResult } from '../lib/cloudSync';

export default function CloudPanel() {
  const { user, loading } = useSession();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<'push' | 'pull' | null>(null);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);

  if (!hasSupabase) {
    return (
      <Card>
        <SectionHeader title="Cloud sync" subtitle="Not configured" />
        <CoachMessage tone="warning" title="Add your Supabase project to enable cloud sync">
          Set <code className="font-mono text-xs">VITE_SUPABASE_URL</code> and{' '}
          <code className="font-mono text-xs">VITE_SUPABASE_PUBLISHABLE_KEY</code> in <code>.env</code>, then restart the dev server.
        </CoachMessage>
      </Card>
    );
  }

  async function onSendLink(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    setSending(true);
    const err = await sendMagicLink(email.trim());
    setSending(false);
    if (err) setAuthError(err);
    else setLinkSent(true);
  }

  async function onPush() {
    setSyncing('push');
    const r = await pushAll();
    setLastResult(r);
    setSyncing(null);
  }
  async function onPull() {
    setSyncing('pull');
    const r = await pullAll();
    setLastResult(r);
    setSyncing(null);
    if (r.pulledProfile || r.pulledLogs || r.pulledMetrics) {
      setTimeout(() => location.reload(), 600);
    }
  }

  if (loading) {
    return (
      <Card>
        <SectionHeader title="Cloud sync" subtitle="Checking session…" />
      </Card>
    );
  }

  if (!user) {
    return (
      <Card>
        <SectionHeader
          title="Cloud sync"
          subtitle="Sign in to your isolated sbc_ tables"
          action={<Pill tone="warning"><CloudOff size={12} /> offline-only</Pill>}
        />
        {linkSent ? (
          <CoachMessage tone="success" title="Magic link sent">
            Check <span className="text-white">{email}</span> and click the link to sign in. The app will pick up your session automatically.
          </CoachMessage>
        ) : (
          <form onSubmit={onSendLink} className="space-y-3">
            <div>
              <span className="label">Email</span>
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
              />
            </div>
            {authError && <div className="text-xs text-danger">{authError}</div>}
            <button type="submit" disabled={sending} className="btn-primary w-full">
              <Mail size={16} /> {sending ? 'Sending…' : 'Send magic link'}
            </button>
            <p className="text-xs text-zinc-500">
              You'll only see your own rows in <code>sbc_*</code> tables — RLS is enforced via <code>auth.uid()</code>.
            </p>
          </form>
        )}
      </Card>
    );
  }

  return (
    <Card>
      <SectionHeader
        title="Cloud sync"
        subtitle={user.email ?? 'Signed in'}
        action={
          <Pill tone="success">
            <Cloud size={12} /> linked to sbc_ tables
          </Pill>
        }
      />

      <div className="grid gap-2 md:grid-cols-2">
        <button onClick={onPush} disabled={!!syncing} className="btn-primary">
          <ArrowUpToLine size={16} />
          {syncing === 'push' ? 'Pushing…' : 'Push local → cloud'}
        </button>
        <button onClick={onPull} disabled={!!syncing} className="btn-outline">
          <ArrowDownToLine size={16} />
          {syncing === 'pull' ? 'Pulling…' : 'Pull cloud → local'}
        </button>
      </div>

      {lastResult && (
        <div className="mt-4 space-y-2">
          {lastResult.errors.length > 0 ? (
            <CoachMessage tone="danger" title="Sync issues">
              <ul className="list-disc pl-5 space-y-0.5">
                {lastResult.errors.map((e, i) => (
                  <li key={i} className="text-xs">{e}</li>
                ))}
              </ul>
            </CoachMessage>
          ) : (
            <CoachMessage tone="success" title="Sync complete">
              {lastResult.pushedProfile && <div>Pushed profile.</div>}
              {lastResult.pushedPlans > 0 && <div>Pushed {lastResult.pushedPlans} weekly plan(s).</div>}
              {lastResult.pushedLogs > 0 && <div>Pushed {lastResult.pushedLogs} workout log(s).</div>}
              {lastResult.pushedMetrics > 0 && <div>Pushed {lastResult.pushedMetrics} body metric(s).</div>}
              {lastResult.pulledProfile && <div>Pulled profile.</div>}
              {lastResult.pulledLogs > 0 && <div>Pulled {lastResult.pulledLogs} workout log(s).</div>}
              {lastResult.pulledMetrics > 0 && <div>Pulled {lastResult.pulledMetrics} body metric(s).</div>}
            </CoachMessage>
          )}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-xs text-zinc-500">
        <span>User id: <code className="font-mono">{user.id.slice(0, 8)}…</code></span>
        <button onClick={signOut} className="inline-flex items-center gap-1 text-zinc-300 hover:text-white">
          <LogOut size={12} /> Sign out
        </button>
      </div>
    </Card>
  );
}
