CREATE TABLE public.backend_jobs (
  id UUID NOT NULL PRIMARY KEY,
  kind TEXT NOT NULL,
  project_id UUID,
  status TEXT NOT NULL DEFAULT 'pending',
  stage TEXT,
  progress INTEGER NOT NULL DEFAULT 0,
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_backend_jobs_project_id ON public.backend_jobs(project_id);
CREATE INDEX idx_backend_jobs_status ON public.backend_jobs(status);

ALTER TABLE public.backend_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all backend jobs"
ON public.backend_jobs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert backend jobs"
ON public.backend_jobs FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update backend jobs"
ON public.backend_jobs FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete backend jobs"
ON public.backend_jobs FOR DELETE TO authenticated USING (true);

CREATE POLICY "Service role full access backend jobs"
ON public.backend_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER update_backend_jobs_updated_at
BEFORE UPDATE ON public.backend_jobs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();