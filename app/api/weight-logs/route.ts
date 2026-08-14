import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const date = body?.date;
  const weightKg = Number(body?.weightKg);

  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
  }
  if (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 300) {
    return NextResponse.json({ error: 'Weight must be between 20 and 300 kg' }, { status: 400 });
  }

  const { error } = await supabase
    .from('weight_logs')
    .upsert({ user_id: user.id, date, weight_kg: weightKg }, { onConflict: 'user_id,date' });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
