import { createServerSupabase } from '@/lib/supabase/server';
import DailyRing from '@/components/DailyRing';
import { redirect } from 'next/navigation';

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

export default async function DashboardPage() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (!profile) redirect('/onboarding');

  const { start, end } = todayRange();
  const { data: meals } = await supabase
    .from('meal_logs')
    .select('*')
    .eq('user_id', user.id)
    .gte('logged_at', start)
    .lte('logged_at', end)
    .order('logged_at', { ascending: false });

  const { data: insulinDoses } = await supabase
    .from('insulin_logs')
    .select('*')
    .eq('user_id', user.id)
    .gte('logged_at', start)
    .lte('logged_at', end)
    .order('logged_at', { ascending: false });

  const consumed = (meals ?? []).reduce(
    (acc, m) => ({
      calories: acc.calories + Number(m.calories),
      carbs: acc.carbs + Number(m.carbs_g),
      protein: acc.protein + Number(m.protein_g),
      fat: acc.fat + Number(m.fat_g),
    }),
    { calories: 0, carbs: 0, protein: 0, fat: 0 }
  );

  return (
    <main className="mx-auto max-w-md space-y-4 p-6">
      <h1 className="text-xl font-semibold">今日</h1>
      <DailyRing label="Calories" consumed={consumed.calories} target={Number(profile.daily_calories)} unit="kcal" />
      <DailyRing label="Carbs" consumed={consumed.carbs} target={Number(profile.daily_carbs_g)} unit="g" />
      <DailyRing label="Protein" consumed={consumed.protein} target={Number(profile.daily_protein_g)} unit="g" />
      <DailyRing label="Fat" consumed={consumed.fat} target={Number(profile.daily_fat_g)} unit="g" />

      <section>
        <h2 className="font-semibold">今日餐记录</h2>
        <ul className="mt-2 space-y-2">
          {(meals ?? []).map((m) => (
            <li key={m.id} className="rounded border p-2 text-sm">
              {new Date(m.logged_at).toLocaleTimeString()} — {m.ai_raw_description || '未命名'} — {m.calories} kcal
            </li>
          ))}
          {(meals ?? []).length === 0 && <li className="text-sm text-gray-500">未有记录</li>}
        </ul>
      </section>

      <section>
        <h2 className="font-semibold">今日胰岛素</h2>
        <ul className="mt-2 space-y-2">
          {(insulinDoses ?? []).map((i) => (
            <li key={i.id} className="rounded border p-2 text-sm">
              {new Date(i.logged_at).toLocaleTimeString()} — {i.units} units {i.note ? `(${i.note})` : ''}
            </li>
          ))}
          {(insulinDoses ?? []).length === 0 && <li className="text-sm text-gray-500">未有记录</li>}
        </ul>
      </section>
    </main>
  );
}
