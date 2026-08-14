'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { calculateBMI, suggestWaterMl, summarizeWeightTrend, type WeightLogEntry } from '@/lib/nutrition';

interface WeightSectionProps {
  todayKey: string;
  heightCm: number;
  logs: WeightLogEntry[]; // last 30 days, any order
}

const CHART_WIDTH = 280;
const CHART_HEIGHT = 90;
// Reserve space around the plot area for axis labels.
const PAD_LEFT = 30;
const PAD_RIGHT = 6;
const PAD_TOP = 8;
const PAD_BOTTOM = 16;
const PLOT_WIDTH = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_HEIGHT = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;
// How many date labels to show along the x-axis, regardless of how many days of data.
const MAX_X_LABELS = 5;

function plotPoints(values: number[]): { x: number; y: number }[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1; // avoid divide-by-zero when all values are equal
  const stepX = values.length > 1 ? PLOT_WIDTH / (values.length - 1) : 0;
  return values.map((v, i) => ({
    x: PAD_LEFT + i * stepX,
    y: PAD_TOP + PLOT_HEIGHT - ((v - min) / range) * PLOT_HEIGHT,
  }));
}

function toPolyline(points: { x: number; y: number }[]): string {
  return points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

function formatShortDate(dateKey: string): string {
  const [, m, d] = dateKey.split('-');
  return `${m}/${d}`;
}

export default function WeightSection({ todayKey, heightCm, logs }: WeightSectionProps) {
  const router = useRouter();
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  const todayEntry = sorted.find((e) => e.date === todayKey);
  const latest = sorted[sorted.length - 1];

  const [weightInput, setWeightInput] = useState(todayEntry ? String(todayEntry.weightKg) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  async function handleSave() {
    const weightKg = Number(weightInput);
    if (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 300) {
      setError('请输入有效体重 (20-300 kg)');
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch('/api/weight-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: todayKey, weightKg }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? '保存失败, 请重试');
      setSaving(false);
      return;
    }
    setSaving(false);
    router.refresh();
  }

  const trend = summarizeWeightTrend(sorted);
  const bmi = latest ? calculateBMI(latest.weightKg, heightCm) : null;
  const waterMl = latest ? suggestWaterMl(latest.weightKg) : null;

  return (
    <div className="rounded-2xl bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-medium">今日体重</span>
        <input
          type="number"
          step="0.1"
          value={weightInput}
          onChange={(e) => setWeightInput(e.target.value)}
          placeholder="kg"
          className="w-20 rounded border border-gray-200 px-2 py-1 text-sm"
        />
        <span className="text-xs text-gray-400">kg</span>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-full px-3 py-1 text-xs text-white disabled:opacity-50"
          style={{ background: '#7F77DD' }}
        >
          保存
        </button>
      </div>
      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

      {sorted.length > 0 && (() => {
        const weights = sorted.map((e) => e.weightKg);
        const points = plotPoints(weights);
        const minKg = Math.min(...weights);
        const maxKg = Math.max(...weights);
        const xLabelStep = Math.max(1, Math.ceil(sorted.length / MAX_X_LABELS));
        const selected = selectedIndex !== null ? { entry: sorted[selectedIndex], point: points[selectedIndex] } : null;

        return (
          <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="mb-3 w-full rounded-lg" style={{ background: '#F7FAFD' }}>
            {/* y-axis kg labels */}
            <text x={2} y={PAD_TOP + 4} fontSize="7" fill="#9CA3AF">{maxKg}</text>
            <text x={2} y={PAD_TOP + PLOT_HEIGHT} fontSize="7" fill="#9CA3AF">{minKg}</text>

            {/* x-axis date labels */}
            {sorted.map((e, i) =>
              i % xLabelStep === 0 ? (
                <text key={e.date} x={points[i].x} y={CHART_HEIGHT} fontSize="7" fill="#9CA3AF" textAnchor="middle">
                  {formatShortDate(e.date)}
                </text>
              ) : null
            )}

            <polyline points={toPolyline(points)} fill="none" stroke="#7F77DD" strokeWidth="2" />
            <polyline
              points={toPolyline(plotPoints(trend.movingAvg.map((e) => e.avgKg)))}
              fill="none"
              stroke="#999"
              strokeWidth="1.5"
              strokeDasharray="4,3"
            />

            {points.map((p, i) => (
              <g key={sorted[i].date} onClick={() => setSelectedIndex(selectedIndex === i ? null : i)} style={{ cursor: 'pointer' }}>
                {/* Invisible larger hit-area — the visible dot is too small to tap reliably. */}
                <circle cx={p.x} cy={p.y} r={8} fill="transparent" />
                <circle cx={p.x} cy={p.y} r={selectedIndex === i ? 4 : 2.5} fill="#7F77DD" stroke="#fff" strokeWidth="1" />
              </g>
            ))}

            {selected && (
              <g>
                <rect
                  x={Math.min(Math.max(selected.point.x - 20, 0), CHART_WIDTH - 40)}
                  y={Math.max(selected.point.y - 20, 0)}
                  width={40}
                  height={14}
                  rx={3}
                  fill="#26215C"
                />
                <text
                  x={Math.min(Math.max(selected.point.x, 20), CHART_WIDTH - 20)}
                  y={Math.max(selected.point.y - 10, 10)}
                  fontSize="7"
                  fill="#fff"
                  textAnchor="middle"
                >
                  {selected.entry.weightKg}kg {formatShortDate(selected.entry.date)}
                </text>
              </g>
            )}
          </svg>
        );
      })()}

      {trend.weeklyChangeKg !== null && (
        <p className="text-xs text-gray-600">
          {trend.weeklyChangeKg <= 0 ? '📉' : '📈'} 过去7天: {trend.weeklyChangeKg > 0 ? '+' : ''}
          {trend.weeklyChangeKg}kg/周 {trend.isSafe ? '(安全范围内)' : '(超出安全建议速度)'}
        </p>
      )}
      {bmi && (
        <p className="text-xs text-gray-600">
          📏 BMI: {bmi.bmi} ({bmi.category})
        </p>
      )}
      {waterMl !== null && <p className="text-xs text-gray-600">💧 建议每日饮水: {waterMl.toLocaleString()} ml</p>}
    </div>
  );
}
