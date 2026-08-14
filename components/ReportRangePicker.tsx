'use client';

import { useRouter } from 'next/navigation';
import { addDaysToKey } from '@/lib/date';

interface ReportRangePickerProps {
  todayKey: string;
  from: string;
  to: string;
}

const PRESETS = [
  { label: '7日', days: 7 },
  { label: '30日', days: 30 },
  { label: '90日', days: 90 },
] as const;

export default function ReportRangePicker({ todayKey, from, to }: ReportRangePickerProps) {
  const router = useRouter();

  function goTo(newFrom: string, newTo: string) {
    router.push(`/report?from=${newFrom}&to=${newTo}`);
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {PRESETS.map((p) => {
        const presetFrom = addDaysToKey(todayKey, -(p.days - 1));
        const isActive = presetFrom === from && todayKey === to;
        return (
          <button
            key={p.label}
            onClick={() => goTo(presetFrom, todayKey)}
            className="rounded-full px-3 py-1 text-xs"
            style={isActive ? { background: '#7F77DD', color: '#fff' } : { background: '#EAF3FC', color: '#26215C' }}
          >
            {p.label}
          </button>
        );
      })}
      <input
        type="date"
        value={from}
        max={to}
        onChange={(e) => e.target.value && goTo(e.target.value, to)}
        className="rounded border border-gray-200 px-2 py-1 text-xs"
      />
      <span className="text-xs text-gray-400">至</span>
      <input
        type="date"
        value={to}
        max={todayKey}
        onChange={(e) => e.target.value && goTo(from, e.target.value)}
        className="rounded border border-gray-200 px-2 py-1 text-xs"
      />
    </div>
  );
}
