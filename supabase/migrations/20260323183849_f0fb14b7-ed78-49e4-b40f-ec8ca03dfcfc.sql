-- Table to track chunking jobs (mirrors vectorization_jobs)
CREATE TABLE public.chunk_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  total_documents integer NOT NULL DEFAULT 0,
  processed_documents integer NOT NULL DEFAULT 0,
  failed_documents integer NOT NULL DEFAULT 0,
  total_chunks integer NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

ALTER TABLE public.chunk_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chunk jobs" ON public.chunk_jobs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chunk jobs" ON public.chunk_jobs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access on chunk_jobs" ON public.chunk_jobs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Dispatcher function for pg_cron
CREATE OR REPLACE FUNCTION public.dispatch_chunk_workers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  job_record RECORD;
  func_url TEXT := 'https://fhcscsczogemcbhkardz.supabase.co/functions/v1/chunk-worker';
BEGIN
  FOR job_record IN
    SELECT id FROM public.chunk_jobs
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
$$;