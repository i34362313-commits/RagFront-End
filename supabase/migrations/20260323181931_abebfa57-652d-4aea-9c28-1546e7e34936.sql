
-- Create a function that dispatches vectorize-worker calls for active jobs
CREATE OR REPLACE FUNCTION public.dispatch_vectorize_workers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $fn$
DECLARE
  job_record RECORD;
  func_url TEXT := 'https://fhcscsczogemcbhkardz.supabase.co/functions/v1/vectorize-worker';
  service_key TEXT := current_setting('supabase.service_role_key', true);
BEGIN
  FOR job_record IN
    SELECT id FROM public.vectorization_jobs
    WHERE status IN ('pending', 'processing')
    ORDER BY created_at ASC
    LIMIT 3
  LOOP
    PERFORM net.http_post(
      url := func_url,
      body := jsonb_build_object('job_id', job_record.id),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoY3Njc2N6b2dlbWNiaGthcmR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMjkyNzIsImV4cCI6MjA4NTkwNTI3Mn0.VipnLhYUyXspMNnhTJ6GlNNhf4EfrsCxhbWQLJDnLUY'
      )
    );
  END LOOP;
END;
$fn$;

-- Schedule: run every 10 seconds
SELECT cron.schedule(
  'vectorize-worker-dispatcher',
  '10 seconds',
  'SELECT public.dispatch_vectorize_workers()'
);
