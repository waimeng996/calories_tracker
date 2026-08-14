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

function buildPolylinePoints(values: number[]): string {
  if (values.length === 0) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1; // avoid divide-by-zero when all values are equal
  const stepX = values.length > 1 ? CHART_WIDTH / (values.length - 1) : 0;
  return values
    .map((v, i) => {
      const x = i * stepX;
      const y = CHART_HEIGHT - ((v - min) / range) * CHART_HEIGHT;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export default function WeightSection({ todayKey, heightCm, logs }: WeightSectionProps) {
  const router = useRouter();
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  const todayEntry = sorted.find((e) => e.date === todayKey);
  const latest = sorted[sorted.length - 1];

  const [weightInput, setWeightInput] = useState(todayEntry ? String(todayEntry.weightKg) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      {sorted.length > 0 && (
        <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="mb-3 w-full rounded-lg" style={{ background: '#F7FAFD' }}>
          <polyline
            points={buildPolylinePoints(sorted.map((e) => e.weightKg))}
            fill="none"
            stroke="#7F77DD"
            strokeWidth="2"
          />
          <polyline
            points={buildPolylinePoints(trend.movingAvg.map((e) => e.avgKg))}
            fill="none"
            stroke="#999"
            strokeWidth="1.5"
            strokeDasharray="4,3"
          />
        </svg>
      )}

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
