interface DailyRingProps {
  label: string;
  consumed: number;
  target: number;
  unit: string;
}

export default function DailyRing({ label, consumed, target, unit }: DailyRingProps) {
  const remaining = Math.round(target - consumed);
  const pct = target > 0 ? Math.min(100, Math.round((consumed / target) * 100)) : 0;
  return (
    <div className="rounded border p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-semibold">{remaining} {unit} 剩余</p>
      <div className="mt-2 h-2 w-full rounded bg-gray-200">
        <div className="h-2 rounded bg-gray-900" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs text-gray-500">{Math.round(consumed)} / {target} {unit}</p>
    </div>
  );
}
