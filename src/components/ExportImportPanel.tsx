import { useRef, useState } from 'react';
import { Download, Upload, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card, CoachMessage, SectionHeader } from './ui';
import { store } from '../lib/storage';
import type {
  BodyMetric,
  PlanProposal,
  Profile,
  WeeklyCheckIn,
  WeeklyPlan,
  WorkoutLog,
} from '../types';

const BACKUP_VERSION = 1;

interface BackupShape {
  version: number;
  exportedAt: string;
  profile: Profile | null;
  plan: WeeklyPlan | null;
  weekNumber: number;
  logs: WorkoutLog[];
  metrics: BodyMetric[];
  checkIns: WeeklyCheckIn[];
  proposal: PlanProposal | null;
}

function snapshot(): BackupShape {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    profile: store.getProfile(),
    plan: store.getPlan(),
    weekNumber: store.getWeekNumber(),
    logs: store.getLogs(),
    metrics: store.getMetrics(),
    checkIns: store.getCheckIns(),
    proposal: store.getProposal(),
  };
}

function isBackupShape(v: unknown): v is BackupShape {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.version === 'number' &&
    Array.isArray(o.logs) &&
    Array.isArray(o.metrics)
  );
}

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke on next tick so the click has time to start the download
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function ExportImportPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<BackupShape | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function onExport() {
    setError(null);
    setSuccess(null);
    const data = snapshot();
    const stamp = new Date().toISOString().slice(0, 10);
    downloadJson(data, `strongbody-coach-${stamp}.json`);
    const counts = `${data.logs.length} logs · ${data.metrics.length} metrics · ${data.checkIns.length} check-ins`;
    setSuccess(`Exported snapshot: ${counts}.`);
  }

  function onImportClick() {
    setError(null);
    setSuccess(null);
    fileInputRef.current?.click();
  }

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result;
        if (typeof text !== 'string') throw new Error('File could not be read.');
        const parsed = JSON.parse(text);
        if (!isBackupShape(parsed)) {
          throw new Error(
            'This does not look like a StrongBody Coach backup. Expected fields: version, logs, metrics.',
          );
        }
        if (parsed.version !== BACKUP_VERSION) {
          throw new Error(
            `Unsupported backup version (${parsed.version}). Current is ${BACKUP_VERSION}.`,
          );
        }
        setPendingImport(parsed);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(`Import failed: ${msg}`);
      }
    };
    reader.onerror = () => setError('Could not read file.');
    reader.readAsText(file);
  }

  function commitImport() {
    if (!pendingImport) return;
    if (pendingImport.profile) store.setProfile(pendingImport.profile);
    if (pendingImport.plan) store.setPlan(pendingImport.plan);
    if (typeof pendingImport.weekNumber === 'number')
      store.setWeekNumber(pendingImport.weekNumber);
    store.setLogs(pendingImport.logs);
    store.setMetrics(pendingImport.metrics);
    store.setCheckIns(pendingImport.checkIns ?? []);
    if (pendingImport.proposal) store.setProposal(pendingImport.proposal);
    else store.clearProposal();

    const counts = `${pendingImport.logs.length} logs · ${pendingImport.metrics.length} metrics · ${(pendingImport.checkIns ?? []).length} check-ins`;
    setSuccess(`Imported successfully: ${counts}.`);
    setPendingImport(null);
  }

  function cancelImport() {
    setPendingImport(null);
  }

  return (
    <Card>
      <SectionHeader
        title="Backup"
        subtitle="Manual export / import. Local-only — no cloud, no sign-in needed."
      />
      <div className="flex flex-wrap gap-2">
        <button onClick={onExport} className="btn-primary">
          <Download size={16} /> Export JSON
        </button>
        <button onClick={onImportClick} className="btn-outline">
          <Upload size={16} /> Import JSON
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={onFileSelected}
        />
      </div>

      {error && (
        <div className="mt-4">
          <CoachMessage tone="danger" title="Couldn't import" icon={<AlertTriangle size={18} />}>
            {error}
          </CoachMessage>
        </div>
      )}

      {success && !pendingImport && (
        <div className="mt-4">
          <CoachMessage tone="success" title="Done" icon={<CheckCircle2 size={18} />}>
            {success}
          </CoachMessage>
        </div>
      )}

      {pendingImport && (
        <div className="mt-4 rounded-2xl border border-warning/40 bg-warning/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" />
            <div className="flex-1">
              <div className="font-semibold text-zinc-100">Confirm import</div>
              <div className="mt-1 text-sm text-zinc-300">
                This will <span className="text-white font-semibold">replace</span> your current
                local data with the backup snapshot exported on{' '}
                <span className="text-white">{pendingImport.exportedAt.slice(0, 19)}</span>.
              </div>
              <ul className="mt-2 text-xs text-zinc-400 space-y-0.5">
                <li>· Profile: {pendingImport.profile ? '1' : '0'}</li>
                <li>· Workout logs: {pendingImport.logs.length}</li>
                <li>· Body metrics: {pendingImport.metrics.length}</li>
                <li>· Check-ins: {(pendingImport.checkIns ?? []).length}</li>
                <li>· Weekly plan: {pendingImport.plan ? `week ${pendingImport.plan.weekNumber}` : 'none'}</li>
                <li>· Pending proposal: {pendingImport.proposal ? 'yes' : 'none'}</li>
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={commitImport} className="btn-primary">
                  Replace local data
                </button>
                <button onClick={cancelImport} className="btn-outline">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <p className="mt-3 text-xs text-zinc-500">
        Save the JSON file to iCloud / Dropbox / Drive for cross-device backup. Cloud Sync is the
        automated alternative — it's still set up if you want it later.
      </p>
    </Card>
  );
}
