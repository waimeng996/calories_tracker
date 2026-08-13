const COLORS = {
  amber: { track: '#FAEEDA', fill: '#EF9F27' },
  teal: { track: '#E1F5EE', fill: '#1D9E75' },
  coral: { track: '#FAECE7', fill: '#D85A30' },
} as const;

interface MacroBarProps {
  label: string;
  consumed: number;
  target: number;
  color: keyof typeof COLORS;
}

export default function MacroBar({ label, consumed, target, color }: MacroBarProps) {
  const pct = target > 0 ? Math.min(100, Math.round((consumed / target) * 100)) : 0;
  const { track, fill } = COLORS[color];
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-gray-500">{label}</span>
        <span className="font-medium">{Math.round(consumed)} / {Math.round(target)}g</span>
      </div>
      <div className="h-1.5 rounded-full" style={{ background: track }}>
        <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: fill }} />
      </div>
    </div>
  );
}
