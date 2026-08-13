create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'cleanup-old-meal-photos-daily',
  '0 3 * * *', -- 03:00 UTC daily
  $$
  select net.http_post(
    url := '<your-project-ref>.functions.supabase.co/cleanup-old-photos',
    headers := jsonb_build_object('Authorization', 'Bearer <the-CLEANUP_FUNCTION_SECRET-value>'),
    body := '{}'::jsonb
  );
  $$
);
