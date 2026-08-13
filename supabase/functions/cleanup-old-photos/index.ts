import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${Deno.env.get('CLEANUP_FUNCTION_SECRET')}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const { data: oldMeals, error: fetchError } = await supabase
    .from('meal_logs')
    .select('id, photo_url')
    .not('photo_url', 'is', null)
    .lt('logged_at', sixMonthsAgo.toISOString());

  if (fetchError) {
    return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 });
  }

  let deletedCount = 0;
  for (const meal of oldMeals ?? []) {
    if (!meal.photo_url) continue;
    const { error: removeError } = await supabase.storage.from('meal-photos').remove([meal.photo_url]);
    if (removeError) continue;
    await supabase.from('meal_logs').update({ photo_url: null }).eq('id', meal.id);
    deletedCount += 1;
  }

  return new Response(JSON.stringify({ deletedCount }), { status: 200 });
});
