CREATE OR REPLACE FUNCTION public.dispatch_vectorize_workers()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  job_record RECORD;
  func_url TEXT := 'https://fhcscsczogemcbhkardz.supabase.co/functions/v1/vectorize-worker';
  queue_url TEXT := 'https://fhcscsczogemcbhkardz.supabase.co/functions/v1/queue-worker';
  service_key TEXT := current_setting('supabase.service_role_key', true);
  released INT;
BEGIN
  SELECT public.release_stale_claims(5) INTO released;
  IF released > 0 THEN
    RAISE NOTICE 'Released % stale claims', released;
  END IF;

  -- Re-dispatch queue-worker for jobs stuck in initializing
  FOR job_record IN
    SELECT id, project_id, user_id, total_chunks FROM public.vectorization_jobs
    WHERE status = 'initializing'
    AND updated_at < now() - interval '2 minutes'
    ORDER BY created_at ASC
    LIMIT 3
  LOOP
    PERFORM net.http_post(
      url := queue_url,
      body := jsonb_build_object(
        'job_id', job_record.id,
        'project_id', job_record.project_id,
        'user_id', job_record.user_id,
        'total_pending', job_record.total_chunks,
        'last_id', NULL,
        'queued_so_far', 0
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      )
    );
  END LOOP;

  -- Dispatch vectorize-workers for pending/processing jobs
  FOR job_record IN
    SELECT id FROM public.vectorization_jobs
    WHERE status IN ('pending', 'processing')
    ORDER BY created_at ASC
    LIMIT 5
  LOOP
    FOR i IN 1..3 LOOP
      PERFORM net.http_post(
        url := func_url,
        body := jsonb_build_object('job_id', job_record.id),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_key
        )
      );
    END LOOP;
  END LOOP;
END;
$function$;