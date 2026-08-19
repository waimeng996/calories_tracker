import Link from 'next/link';
import { createServerSupabase } from '@/lib/supabase/server';
import CalorieRing from '@/components/CalorieRing';
import MacroBar from '@/components/MacroBar';
import MealCard from '@/components/MealCard';
import WeightSection from '@/components/WeightSection';
import DateStrip from '@/components/DateStrip';
import { redirect } from 'next/navigation';
import { dayRangeInTimezone, toMalaysiaLocal } from '@/lib/date';

const MEAL_SECTIONS = [
  { type: 'breakfast', label: '早餐', color: '#7F77DD' },
  { type: 'lunch', label: '午餐', color: '#1D9E75' },
  { type: 'dinner', label: '晚餐', color: '#D85A30' },
  { type: 'snack', label: '小食', color: '#D4537E' },
] as const;

const STRIP_DAYS = 60;

// Ascending date keys from (todayKey - STRIP_DAYS + 1) to todayKey. Pure calendar-date
// arithmetic on the key itself — no timezone offset needed here, dateKey is already
// a Malaysia-local calendar day. Selecting an older date via the calendar picker still
// works even though it falls outside this strip — the dashboard query isn't range-limited.
function recentDateKeys(todayKey: string): string[] {
  const today = new Date(`${todayKey}T00:00:00.000Z`);
  return Array.from({ length: STRIP_DAYS }, (_, i) => {
    const day = new Date(today);
    day.setUTCDate(today.getUTCDate() - (STRIP_DAYS - 1 - i));
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

  const thirtyDaysAgoKey = new Date(new Date(`${todayKey}T00:00:00.000Z`).getTime() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const { data: weightLogs } = await supabase
    .from('weight_logs')
    .select('date, weight_kg')
    .eq('user_id', user.id)
    .gte('date', thirtyDaysAgoKey)
    .order('date', { ascending: true });

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

      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <DateStrip dateKeys={recentDateKeys(todayKey)} selectedDate={selectedDate} />
        </div>
        <Link
          href="/report"
          aria-label="Summary report"
          className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full"
          style={{ background: '#CECBF6', color: '#26215C' }}
        >
          📊
        </Link>
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

      <WeightSection
        todayKey={todayKey}
        heightCm={Number(profile.height_cm)}
        logs={(weightLogs ?? []).map((w) => ({ date: w.date, weightKg: Number(w.weight_kg) }))}
      />

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
                    carbsG={Number(m.carbs_g)}
                    proteinG={Number(m.protein_g)}
                    fatG={Number(m.fat_g)}
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
