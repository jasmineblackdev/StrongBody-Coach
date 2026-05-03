import { useEffect, useState } from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ProfilePage from './pages/Profile';
import WorkoutPlanPage from './pages/WorkoutPlan';
import WorkoutLoggerPage from './pages/WorkoutLogger';
import MealsPage from './pages/Meals';
import ProgressPage from './pages/Progress';
import CheckInPage from './pages/CheckIn';
import { store } from './lib/storage';
import { sampleLogs, sampleMetrics, sampleProfile } from './lib/sampleData';
import { buildWeeklyPlan } from './lib/workoutPlan';

function useFirstRunSeed() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!store.getProfile()) {
      store.setProfile(sampleProfile);
      store.setMetrics(sampleMetrics);
      store.setLogs(sampleLogs);
      store.setPlan(buildWeeklyPlan(sampleProfile, 1, 'hypertrophy'));
      store.setWeekNumber(1);
    }
    setReady(true);
  }, []);
  return ready;
}

export default function App() {
  const ready = useFirstRunSeed();
  if (!ready) return null;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="plan" element={<WorkoutPlanPage />} />
        <Route path="log" element={<WorkoutLoggerPage />} />
        <Route path="meals" element={<MealsPage />} />
        <Route path="progress" element={<ProgressPage />} />
        <Route path="check-in" element={<CheckInPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

function NotFound() {
  const nav = useNavigate();
  return (
    <div className="card text-center py-12">
      <div className="font-display text-xl font-semibold mb-2">Page not found</div>
      <button className="btn-primary mt-2" onClick={() => nav('/')}>
        Back to Dashboard
      </button>
    </div>
  );
}
