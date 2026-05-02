import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

// Register once
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

// ─── Theme ───────────────────────────────────────────────────────────────────

const COLOR = {
  accent: '#f43f7a',
  accentSoft: 'rgba(244, 63, 122, 0.18)',
  success: '#3fd07a',
  successSoft: 'rgba(63, 208, 122, 0.20)',
  warning: '#ffb547',
  warningSoft: 'rgba(255, 181, 71, 0.20)',
  ink700: '#26262e',
  ink400: '#71717a',
  text: '#e4e4e7',
  textMuted: '#a1a1aa',
};

ChartJS.defaults.color = COLOR.textMuted;
ChartJS.defaults.font.family = 'Inter, system-ui, sans-serif';
ChartJS.defaults.font.size = 11;
ChartJS.defaults.borderColor = COLOR.ink700;

const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: COLOR.text, usePointStyle: true, boxHeight: 6 } },
    tooltip: {
      backgroundColor: '#15151a',
      borderColor: COLOR.ink700,
      borderWidth: 1,
      titleColor: '#fafafa',
      bodyColor: '#e4e4e7',
      padding: 10,
      cornerRadius: 12,
    },
  },
} as const;

// ─── Charts ──────────────────────────────────────────────────────────────────

export function BodyWeightChart({ data }: { data: { date: string; weight?: number; waist?: number }[] }) {
  return (
    <Line
      data={{
        labels: data.map((d) => d.date),
        datasets: [
          {
            label: 'Weight (lb)',
            data: data.map((d) => d.weight ?? null),
            borderColor: COLOR.accent,
            backgroundColor: COLOR.accentSoft,
            borderWidth: 2.5,
            pointRadius: 3,
            pointHoverRadius: 5,
            pointBackgroundColor: COLOR.accent,
            tension: 0.35,
            fill: true,
            spanGaps: true,
            yAxisID: 'y',
          },
          {
            label: 'Waist (in)',
            data: data.map((d) => d.waist ?? null),
            borderColor: COLOR.warning,
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 2,
            tension: 0.35,
            spanGaps: true,
            yAxisID: 'y1',
          },
        ],
      }}
      options={{
        ...(baseOptions as any),
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { grid: { color: COLOR.ink700 }, ticks: { color: COLOR.textMuted } },
          y: {
            position: 'left',
            grid: { color: COLOR.ink700 },
            ticks: { color: COLOR.textMuted, callback: (v) => `${v}` },
          },
          y1: {
            position: 'right',
            grid: { display: false },
            ticks: { color: COLOR.textMuted },
          },
        },
      }}
    />
  );
}

export function BigThreeChart({ data }: { data: { date: string; squat: number | null; bench: number | null; deadlift: number | null }[] }) {
  const series = [
    { key: 'squat' as const, label: 'Squat', color: COLOR.accent },
    { key: 'bench' as const, label: 'Bench', color: COLOR.success },
    { key: 'deadlift' as const, label: 'Deadlift', color: COLOR.warning },
  ];
  return (
    <Line
      data={{
        labels: data.map((d) => d.date),
        datasets: series.map((s) => ({
          label: s.label,
          data: data.map((d) => d[s.key]),
          borderColor: s.color,
          backgroundColor: 'transparent',
          borderWidth: 2.5,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: s.color,
          tension: 0.3,
          spanGaps: true,
        })),
      }}
      options={{
        ...(baseOptions as any),
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { grid: { color: COLOR.ink700 }, ticks: { color: COLOR.textMuted } },
          y: {
            grid: { color: COLOR.ink700 },
            ticks: { color: COLOR.textMuted, callback: (v) => `${v} lb` },
          },
        },
      }}
    />
  );
}

export function ComplianceChart({ data }: { data: { week: string; sessions: number }[] }) {
  return (
    <Bar
      data={{
        labels: data.map((d) => d.week),
        datasets: [
          {
            label: 'Sessions',
            data: data.map((d) => d.sessions),
            backgroundColor: COLOR.accent,
            hoverBackgroundColor: COLOR.accentSoft,
            borderRadius: 8,
            maxBarThickness: 36,
          },
        ],
      }}
      options={{
        ...(baseOptions as any),
        plugins: { ...(baseOptions as any).plugins, legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: COLOR.textMuted } },
          y: {
            beginAtZero: true,
            grid: { color: COLOR.ink700 },
            ticks: { color: COLOR.textMuted, stepSize: 1 },
          },
        },
      }}
    />
  );
}

export function MacroDoughnut({
  protein,
  carbs,
  fat,
}: {
  protein: number;
  carbs: number;
  fat: number;
}) {
  const proteinCal = protein * 4;
  const carbsCal = carbs * 4;
  const fatCal = fat * 9;
  const total = proteinCal + carbsCal + fatCal;
  return (
    <div className="relative h-full">
      <Doughnut
        data={{
          labels: ['Protein', 'Carbs', 'Fat'],
          datasets: [
            {
              data: [proteinCal, carbsCal, fatCal],
              backgroundColor: [COLOR.accent, COLOR.success, COLOR.warning],
              borderColor: '#101013',
              borderWidth: 3,
              hoverOffset: 6,
            },
          ],
        }}
        options={{
          ...(baseOptions as any),
          cutout: '68%',
          plugins: {
            ...(baseOptions as any).plugins,
            legend: { position: 'bottom', labels: { color: COLOR.text, usePointStyle: true } },
            tooltip: {
              ...(baseOptions as any).plugins?.tooltip,
              callbacks: {
                label: (ctx: any) => {
                  const val = ctx.parsed as number;
                  const pct = total ? Math.round((val / total) * 100) : 0;
                  const grams = ctx.dataIndex === 0 ? protein : ctx.dataIndex === 1 ? carbs : fat;
                  return `${ctx.label}: ${grams} g · ${val} kcal · ${pct}%`;
                },
              },
            },
          },
        }}
      />
      {/* Center label */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-12">
        <div className="font-display text-2xl font-semibold text-zinc-100">{total}</div>
        <div className="text-[10px] uppercase tracking-widest text-zinc-500">kcal</div>
      </div>
    </div>
  );
}

export function MacroStackedBar({
  days,
}: {
  days: { day: string; protein: number; carbs: number; fat: number }[];
}) {
  return (
    <Bar
      data={{
        labels: days.map((d) => d.day),
        datasets: [
          {
            label: 'Protein',
            data: days.map((d) => d.protein * 4),
            backgroundColor: COLOR.accent,
            stack: 'macros',
            borderRadius: 4,
          },
          {
            label: 'Carbs',
            data: days.map((d) => d.carbs * 4),
            backgroundColor: COLOR.success,
            stack: 'macros',
            borderRadius: 4,
          },
          {
            label: 'Fat',
            data: days.map((d) => d.fat * 9),
            backgroundColor: COLOR.warning,
            stack: 'macros',
            borderRadius: 4,
          },
        ],
      }}
      options={{
        ...(baseOptions as any),
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { color: COLOR.textMuted } },
          y: {
            stacked: true,
            grid: { color: COLOR.ink700 },
            ticks: { color: COLOR.textMuted, callback: (v: any) => `${v}` },
          },
        },
      }}
    />
  );
}
