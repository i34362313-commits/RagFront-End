
CREATE OR REPLACE FUNCTION public.release_stale_claims(p_timeout_minutes integer DEFAULT 5)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  released integer;
BEGIN
  UPDATE embedding_queue
  SET status = 'pending', worker_id = NULL, claimed_at = NULL, retry_count = retry_count + 1
  WHERE status = 'processing'
    AND claimed_at < now() - (p_timeout_minutes || ' minutes')::interval
    AND retry_count < 10;
  GET DIAGNOSTICS released = ROW_COUNT;

  UPDATE embedding_queue
  SET status = 'failed', error_message = 'Max retries exceeded'
  WHERE status = 'processing'
    AND claimed_at < now() - (p_timeout_minutes || ' minutes')::interval
    AND retry_count >= 10;

  RETURN released;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_queue_progress(p_job_id uuid)
RETURNS TABLE(total bigint, pending bigint, processing bigint, completed bigint, failed bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE status = 'pending') AS pending,
    COUNT(*) FILTER (WHERE status = 'processing') AS processing,
    COUNT(*) FILTER (WHERE status = 'completed') AS completed,
    COUNT(*) FILTER (WHERE status = 'failed') AS failed
  FROM embedding_queue
  WHERE job_id = p_job_id;
$$;

CREATE OR REPLACE FUNCTION public.dispatch_vectorize_workers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  job_record RECORD;
  func_url TEXT := 'https://fhcscsczogemcbhkardz.supabase.co/functions/v1/vectorize-worker';
  service_key TEXT := current_setting('supabase.service_role_key', true);
  released INT;
BEGIN
  SELECT public.release_stale_claims(5) INTO released;
  IF released > 0 THEN
    RAISE NOTICE 'Released % stale claims', released;
  END IF;

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
$$;
