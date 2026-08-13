import Link from 'next/link';
import { createServerSupabase } from '@/lib/supabase/server';
import CalorieRing from '@/components/CalorieRing';
import MacroBar from '@/components/MacroBar';
import MealCard from '@/components/MealCard';
import { redirect } from 'next/navigation';
import { dayRangeInTimezone, toMalaysiaLocal } from '@/lib/date';

const MEAL_SECTIONS = [
  { type: 'breakfast', label: '早餐', color: '#7F77DD' },
  { type: 'lunch', label: '午餐', color: '#1D9E75' },
  { type: 'dinner', label: '晚餐', color: '#D85A30' },
  { type: 'snack', label: '小食', color: '#D4537E' },
] as const;

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

// Monday-first week (as YYYY-MM-DD date keys) containing dateKey. Pure calendar-date
// arithmetic on the key itself — no timezone offset needed here, dateKey is already
// a Malaysia-local calendar day.
function weekDateKeys(dateKey: string): string[] {
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  const dayOfWeek = (d.getUTCDay() + 6) % 7; // 0 = Monday
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - dayOfWeek);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setUTCDate(monday.getUTCDate() + i);
    return day.toISOString().slice(0, 10);
  });
}

export default async function DashboardPage({ searchParams }: { searchParams: { date?: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (!profile) redirect('/onboarding');

  const todayKey = toMalaysiaLocal(new Date().toISOString()).dateKey;
  const selectedDate = searchParams.date ?? todayKey;
  const { start, end } = dayRangeInTimezone(selectedDate);

  const { data: meals } = await supabase
    .from('meal_logs')
    .select('*')
    .eq('user_id', user.id)
    .gte('logged_at', start)
    .lte('logged_at', end)
    .order('logged_at', { ascending: true });

  const consumed = (meals ?? []).reduce(
    (acc, m) => ({
      calories: acc.calories + Number(m.calories),
      carbs: acc.carbs + Number(m.carbs_g),
      protein: acc.protein + Number(m.protein_g),
      fat: acc.fat + Number(m.fat_g),
      insulin: acc.insulin + (m.insulin_units ? Number(m.insulin_units) : 0),
    }),
    { calories: 0, carbs: 0, protein: 0, fat: 0, insulin: 0 }
  );

  const mealsWithPhotos = await Promise.all(
    (meals ?? []).map(async (m) => {
      let photoUrl: string | null = null;
      if (m.photo_url) {
        const { data: signed } = await supabase.storage.from('meal-photos').createSignedUrl(m.photo_url, 3600);
        photoUrl = signed?.signedUrl ?? null;
      }
      return { ...m, photoUrl };
    })
  );

  return (
    <main className="mx-auto max-w-md space-y-4 p-4" style={{ background: '#EAF3FC' }}>
      {profile.goal_override_accepted && (
        <div className="rounded border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
          ⚠️ 你嘅目标速度超出安全建议, 请咨询医生
        </div>
      )}

      <div className="flex justify-between">
        {weekDateKeys(selectedDate).map((dateKey, i) => {
          const isSelected = dateKey === selectedDate;
          return (
            <Link key={dateKey} href={`/?date=${dateKey}`} className="flex flex-col items-center gap-1">
              <span className="text-xs text-gray-400">{WEEKDAY_LABELS[i]}</span>
              <span
                className="flex h-[30px] w-[30px] items-center justify-center rounded-full text-sm"
                style={
                  isSelected
                    ? { background: '#7F77DD', color: '#fff', fontWeight: 500, border: '2px solid #26215C' }
                    : { background: '#CECBF6', color: '#26215C' }
                }
              >
                {Number(dateKey.slice(8, 10))}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="rounded-2xl bg-white p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="text-center">
            <p className="mb-1 text-xs text-gray-400">已食</p>
            <p className="text-lg font-medium">{Math.round(consumed.calories)}</p>
          </div>
          <CalorieRing consumed={consumed.calories} target={Number(profile.daily_calories)} />
          <div className="text-center">
            <p className="mb-1 text-xs text-gray-400">胰岛素</p>
            <p className="text-lg font-medium">{consumed.insulin}u</p>
          </div>
        </div>
        <div className="mt-5 space-y-2.5">
          <MacroBar label="碳水" consumed={consumed.carbs} target={Number(profile.daily_carbs_g)} color="amber" />
          <MacroBar label="蛋白质" consumed={consumed.protein} target={Number(profile.daily_protein_g)} color="teal" />
          <MacroBar label="脂肪" consumed={consumed.fat} target={Number(profile.daily_fat_g)} color="coral" />
        </div>
      </div>

      {MEAL_SECTIONS.map((section) => {
        const entries = mealsWithPhotos.filter((m) => (m.meal_type ?? 'snack') === section.type);
        return (
          <section key={section.type}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-medium">{section.label}</h2>
              <Link
                href={`/log?type=${section.type}`}
                aria-label={`加食物到${section.label}`}
                className="flex h-[26px] w-[26px] items-center justify-center rounded-full text-white"
                style={{ background: section.color }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </Link>
            </div>
            {entries.length === 0 ? (
              <p className="mb-4 text-xs text-gray-400">仲未记录</p>
            ) : (
              <div className="mb-4 space-y-2">
                {entries.map((m) => (
                  <MealCard
                    key={m.id}
                    id={m.id}
                    time={toMalaysiaLocal(m.logged_at).timeStr}
                    description={m.ai_raw_description || '未命名'}
                    calories={Number(m.calories)}
                    insulinUnits={m.insulin_units ? Number(m.insulin_units) : null}
                    photoUrl={m.photoUrl}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </main>
  );
}
