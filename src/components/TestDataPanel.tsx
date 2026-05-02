import { useState } from 'react';
import { History, RefreshCcw } from 'lucide-react';
import { Card, CoachMessage, SectionHeader } from './ui';
import { store } from '../lib/storage';
import { buildHistoryLogs } from '../lib/historySeed';
import { sampleLogs, sampleMetrics, sampleProfile } from '../lib/sampleData';
import { buildWeeklyPlan } from '../lib/workoutPlan';

export default function TestDataPanel() {
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<'success' | 'accent'>('success');

  function loadHistory() {
    const logs = buildHistoryLogs();
    store.setLogs(logs);
    store.clearProposal();
    setTone('accent');
    setMessage(
      `Loaded ${logs.length} workouts from your Trainerize history. Open Workout Plan and click "Generate coach preview" to see the engine's read.`,
    );
  }

  function restoreSample() {
    const profile = store.getProfile() ?? sampleProfile;
    store.setLogs(sampleLogs);
    store.setMetrics(sampleMetrics);
    store.setPlan(buildWeeklyPlan(profile, 1, 'hypertrophy'));
    store.setWeekNumber(1);
    store.clearProposal();
    setTone('success');
    setMessage('Restored built-in sample data (3 sample logs, 5 metrics, week 1 hypertrophy plan).');
  }

  return (
    <Card>
      <SectionHeader
        title="Test data"
        subtitle="Local-only — these don't push to cloud until you click Push"
      />
      <div className="flex flex-wrap gap-2">
        <button onClick={loadHistory} className="btn-primary">
          <History size={16} /> Load my Trainerize history
        </button>
        <button onClick={restoreSample} className="btn-outline">
          <RefreshCcw size={16} /> Restore built-in sample
        </button>
      </div>
      {message && (
        <div className="mt-4">
          <CoachMessage tone={tone}>{message}</CoachMessage>
        </div>
      )}
      <p className="mt-3 text-xs text-zinc-500">
        Replaces your local <code>sbc:workoutLogs</code> and clears any pending proposal. Cloud
        rows are untouched until you click <strong>Push local → cloud</strong>.
      </p>
    </Card>
  );
}
