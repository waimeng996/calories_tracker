import { createServerSupabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

// Server process TZ may not match the user's TZ (e.g. UTC on serverless hosts),
// so each row's calendar day is bucketed in fixed Malaysia local time, not
// server local time (mirrors the offset math in app/(app)/page.tsx).
const MALAYSIA_UTC_OFFSET_HOURS = 8; // Asia/Kuala_Lumpur, UTC+8, no DST

function toMalaysiaLocal(isoString: string) {
  const offsetMs = MALAYSIA_UTC_OFFSET_HOURS * 60 * 60 * 1000;
  const shifted = new Date(new Date(isoString).getTime() + offsetMs); // wall-clock time in that TZ, expressed as if UTC
  const y = shifted.getUTCFullYear();
  const mo = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  const hh = String(shifted.getUTCHours()).padStart(2, '0');
  const mm = String(shifted.getUTCMinutes()).padStart(2, '0');
  return { dateKey: `${y}-${mo}-${d}`, timeStr: `${hh}:${mm}` };
}

interface DayGroup {
  date: string;
  meals: Array<{ id: string; time: string; description: string; calories: number; photoUrl: string | null }>;
  insulin: Array<{ id: string; time: string; units: number }>;
}

export default async function HistoryPage() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: meals } = await supabase
    .from('meal_logs')
    .select('*')
    .eq('user_id', user.id)
    .order('logged_at', { ascending: false })
    .limit(200);

  const { data: insulinDoses } = await supabase
    .from('insulin_logs')
    .select('*')
    .eq('user_id', user.id)
    .order('logged_at', { ascending: false })
    .limit(200);

  const groups = new Map<string, DayGroup>();

  for (const m of meals ?? []) {
    const { dateKey, timeStr } = toMalaysiaLocal(m.logged_at);
    if (!groups.has(dateKey)) groups.set(dateKey, { date: dateKey, meals: [], insulin: [] });
    let photoUrl: string | null = null;
    if (m.photo_url) {
      const { data: signed } = await supabase.storage.from('meal-photos').createSignedUrl(m.photo_url, 3600);
      photoUrl = signed?.signedUrl ?? null;
    }
    groups.get(dateKey)!.meals.push({
      id: m.id,
      time: timeStr,
      description: m.ai_raw_description || '未命名',
      calories: Number(m.calories),
      photoUrl,
    });
  }

  for (const i of insulinDoses ?? []) {
    const { dateKey, timeStr } = toMalaysiaLocal(i.logged_at);
    if (!groups.has(dateKey)) groups.set(dateKey, { date: dateKey, meals: [], insulin: [] });
    groups.get(dateKey)!.insulin.push({
      id: i.id,
      time: timeStr,
      units: Number(i.units),
    });
  }

  const sortedGroups = Array.from(groups.values()).sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <main className="mx-auto max-w-md space-y-6 p-6">
      <h1 className="text-xl font-semibold">历史</h1>
      {sortedGroups.map((g) => (
        <section key={g.date} className="space-y-2">
          <h2 className="font-semibold">{g.date}</h2>
          {g.meals.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded border p-2 text-sm">
              {m.photoUrl && <img src={m.photoUrl} alt={m.description} className="h-12 w-12 rounded object-cover" />}
              <span>{m.time} — {m.description} — {m.calories} kcal</span>
            </div>
          ))}
          {g.insulin.map((i) => (
            <div key={i.id} className="rounded border p-2 text-sm">
              {i.time} — 胰岛素 {i.units} units
            </div>
          ))}
        </section>
      ))}
      {sortedGroups.length === 0 && <p className="text-sm text-gray-500">未有历史记录</p>}
    </main>
  );
}
