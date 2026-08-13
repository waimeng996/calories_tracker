import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data: meal, error: fetchError } = await supabase
    .from('meal_logs')
    .select('id, user_id, photo_url')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!meal) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (meal.photo_url) {
    // Best-effort: a failed storage delete shouldn't block removing the row.
    await supabase.storage.from('meal-photos').remove([meal.photo_url]);
  }

  const { error: deleteError } = await supabase
    .from('meal_logs')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
