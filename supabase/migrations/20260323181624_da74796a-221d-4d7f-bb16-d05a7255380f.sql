
-- Table to track async vectorization jobs
CREATE TABLE public.vectorization_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  total_chunks integer NOT NULL DEFAULT 0,
  processed_chunks integer NOT NULL DEFAULT 0,
  failed_chunks integer NOT NULL DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vectorization_jobs ENABLE ROW LEVEL SECURITY;

-- Users can view their own jobs
CREATE POLICY "Users can view own vectorization jobs"
  ON public.vectorization_jobs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Users can create their own jobs
CREATE POLICY "Users can insert own vectorization jobs"
  ON public.vectorization_jobs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Service role full access (for worker updates)
CREATE POLICY "Service role full access on vectorization_jobs"
  ON public.vectorization_jobs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Auto-update updated_at
CREATE TRIGGER update_vectorization_jobs_updated_at
  BEFORE UPDATE ON public.vectorization_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable pg_net for HTTP calls from pg_cron
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Enable pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
