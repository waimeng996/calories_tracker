import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { addDaysToKey, dayRangeInTimezone, toMalaysiaLocal } from '@/lib/date';
import { summarizeRangeWeightChange } from '@/lib/nutrition';
import ReportRangePicker from '@/components/ReportRangePicker';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export default async function ReportPage({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (!profile) redirect('/onboarding');

  const todayKey = toMalaysiaLocal(new Date().toISOString()).dateKey;
  const to = searchParams.to ?? todayKey;
  const from = searchParams.from ?? addDaysToKey(todayKey, -29); // default: last 30 days

  const { start } = dayRangeInTimezone(from);
  const { end } = dayRangeInTimezone(to);

  const [{ data: meals }, { data: weightLogs }] = await Promise.all([
    supabase
      .from('meal_logs')
      .select('logged_at, calories, carbs_g, protein_g, fat_g, insulin_units')
      .eq('user_id', user.id)
      .gte('logged_at', start)
      .lte('logged_at', end),
    supabase
      .from('weight_logs')
      .select('date, weight_kg')
      .eq('user_id', user.id)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true }),
  ]);

  // Group meals by Malaysia-local calendar day — a day only counts as "logged" if it has
  // at least one meal row; days without any log are excluded from the calorie totals below
  // rather than treated as 0 consumed (which would fabricate a huge fake deficit).
  const byDay = new Map<string, { calories: number; carbs: number; protein: number; fat: number; insulin: number }>();
  for (const m of meals ?? []) {
    const dateKey = toMalaysiaLocal(m.logged_at).dateKey;
    const entry = byDay.get(dateKey) ?? { calories: 0, carbs: 0, protein: 0, fat: 0, insulin: 0 };
    entry.calories += Number(m.calories);
    entry.carbs += Number(m.carbs_g);
    entry.protein += Number(m.protein_g);
    entry.fat += Number(m.fat_g);
    entry.insulin += m.insulin_units ? Number(m.insulin_units) : 0;
    byDay.set(dateKey, entry);
  }

  const loggedDays = byDay.size;
  const totalDaysInRange = Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / MS_PER_DAY) + 1;

  const totals = Array.from(byDay.values()).reduce(
    (acc, d) => ({
      calories: acc.calories + d.calories,
      carbs: acc.carbs + d.carbs,
      protein: acc.protein + d.protein,
      fat: acc.fat + d.fat,
      insulin: acc.insulin + d.insulin,
    }),
    { calories: 0, carbs: 0, protein: 0, fat: 0, insulin: 0 }
  );

  const dailyTarget = Number(profile.daily_calories);
  const netDeficit = loggedDays > 0 ? dailyTarget * loggedDays - totals.calories : null;
  const avg = (total: number) => (loggedDays > 0 ? Math.round(total / loggedDays) : null);

  const weightTrend = summarizeRangeWeightChange(
    (weightLogs ?? []).map((w) => ({ date: w.date, weightKg: Number(w.weight_kg) }))
  );

  return (
    <main className="mx-auto max-w-md space-y-4 p-4" style={{ background: '#EAF3FC' }}>
      <div className="flex items-center gap-2">
        <Link href="/" aria-label="返回dashboard" className="text-sm text-gray-500">← 返回</Link>
        <h1 className="text-lg font-medium">Summary Report</h1>
      </div>

      <ReportRangePicker todayKey={todayKey} from={from} to={to} />

      <div className="rounded-2xl bg-white p-5">
        <p className="mb-3 text-sm text-gray-500">
          {from} 至 {to} · 已记录 {loggedDays} / {totalDaysInRange} 日
        </p>

        {loggedDays === 0 ? (
          <p className="text-sm text-gray-400">呢段时间冇任何记录</p>
        ) : (
          <>
            <div className="mb-4">
              <p className="text-xs text-gray-400">
                {netDeficit !== null && netDeficit >= 0 ? '总calorie deficit' : '总calorie surplus'}
              </p>
              <p className="text-xl font-medium">
                {netDeficit !== null ? Math.abs(Math.round(netDeficit)).toLocaleString() : '-'} kcal
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-400">平均每日calories</p>
                <p>{avg(totals.calories)} / {dailyTarget} kcal</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">平均碳水</p>
                <p>{avg(totals.carbs)}g</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">平均蛋白质</p>
                <p>{avg(totals.protein)}g</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">平均脂肪</p>
                <p>{avg(totals.fat)}g</p>
              </div>
            </div>

            {totals.insulin > 0 && (
              <p className="mt-4 text-sm text-gray-600">💉 总胰岛素: {totals.insulin}u</p>
            )}
          </>
        )}
      </div>

      <div className="rounded-2xl bg-white p-5">
        <h2 className="mb-3 text-sm font-medium">体重变化</h2>
        {weightTrend.changeKg === null ? (
          <p className="text-sm text-gray-400">呢段时间体重记录唔够 (至少要2个唔同日子)</p>
        ) : (
          <>
            <p className="text-sm">
              {weightTrend.startKg}kg → {weightTrend.endKg}kg
              （{weightTrend.changeKg! > 0 ? '+' : ''}{weightTrend.changeKg}kg）
            </p>
            <p className="mt-1 text-xs text-gray-600">
              {weightTrend.weeklyChangeKg! <= 0 ? '📉' : '📈'} {weightTrend.weeklyChangeKg}kg/周{' '}
              {weightTrend.isSafe ? '(安全范围内)' : '(超出安全建议速度)'}
            </p>
          </>
        )}
      </div>
    </main>
  );
}
