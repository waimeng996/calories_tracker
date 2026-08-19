import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

interface MealPatchBody {
  description?: string;
  calories?: number;
  carbsG?: number;
  proteinG?: number;
  fatG?: number;
  insulinUnits?: number | null;
}

function isValidNonNegativeNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: MealPatchBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (body.description !== undefined) update.ai_raw_description = body.description || null;
  for (const [key, column] of [
    ['calories', 'calories'],
    ['carbsG', 'carbs_g'],
    ['proteinG', 'protein_g'],
    ['fatG', 'fat_g'],
  ] as const) {
    if (body[key] !== undefined) {
      if (!isValidNonNegativeNumber(body[key])) {
        return NextResponse.json({ error: `Invalid ${key}` }, { status: 400 });
      }
      update[column] = body[key];
    }
  }
  if (body.insulinUnits !== undefined) {
    if (body.insulinUnits !== null && !isValidNonNegativeNumber(body.insulinUnits)) {
      return NextResponse.json({ error: 'Invalid insulinUnits' }, { status: 400 });
    }
    update.insulin_units = body.insulinUnits;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data: updated, error: updateError } = await supabase
    .from('meal_logs')
    .update(update)
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select()
    .maybeSingle();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, meal: updated });
}

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
