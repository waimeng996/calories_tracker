interface CalorieRingProps {
  consumed: number;
  target: number;
}

export default function CalorieRing({ consumed, target }: CalorieRingProps) {
  const remaining = Math.round(target - consumed);
  const pct = target > 0 ? Math.min(100, Math.round((consumed / target) * 100)) : 0;
  return (
    <div
      className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(#7F77DD 0% ${pct}%, #EEEDFE ${pct}% 100%)` }}
    >
      <div className="flex h-[76px] w-[76px] flex-col items-center justify-center rounded-full bg-white">
        <span className="text-xl font-medium">{remaining}</span>
        <span className="text-[10px] text-gray-400">kcal 剩低</span>
      </div>
    </div>
  );
}
