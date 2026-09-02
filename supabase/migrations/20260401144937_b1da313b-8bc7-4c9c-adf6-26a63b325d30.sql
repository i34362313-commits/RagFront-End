
-- CLIENTS: all authenticated users can see/edit all clients
DROP POLICY IF EXISTS "Users can CRUD own clients" ON public.clients;

CREATE POLICY "Authenticated users can view all clients"
  ON public.clients FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert clients"
  ON public.clients FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update all clients"
  ON public.clients FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete all clients"
  ON public.clients FOR DELETE TO authenticated USING (true);

-- PROJECTS: all authenticated users can see/edit all projects
DROP POLICY IF EXISTS "Users can CRUD own projects" ON public.projects;

CREATE POLICY "Authenticated users can view all projects"
  ON public.projects FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert projects"
  ON public.projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update all projects"
  ON public.projects FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete all projects"
  ON public.projects FOR DELETE TO authenticated USING (true);

-- PROMPT_TEMPLATES: all authenticated users can see/edit all templates
DROP POLICY IF EXISTS "Users can CRUD own templates" ON public.prompt_templates;

CREATE POLICY "Authenticated users can view all templates"
  ON public.prompt_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert templates"
  ON public.prompt_templates FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update all templates"
  ON public.prompt_templates FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete all templates"
  ON public.prompt_templates FOR DELETE TO authenticated USING (true);

-- DOCUMENTS: all authenticated users can see/edit all documents
DROP POLICY IF EXISTS "Users can CRUD own documents" ON public.documents;

CREATE POLICY "Authenticated users can view all documents"
  ON public.documents FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert documents"
  ON public.documents FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update all documents"
  ON public.documents FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete all documents"
  ON public.documents FOR DELETE TO authenticated USING (true);

-- SUMMARIES: all authenticated users can see/edit all summaries
DROP POLICY IF EXISTS "Users can CRUD own summaries" ON public.summaries;

CREATE POLICY "Authenticated users can view all summaries"
  ON public.summaries FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert summaries"
  ON public.summaries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update all summaries"
  ON public.summaries FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete all summaries"
  ON public.summaries FOR DELETE TO authenticated USING (true);

-- DOCUMENT_EMBEDDINGS: all authenticated users can see/edit all embeddings
DROP POLICY IF EXISTS "Users can CRUD own embeddings" ON public.document_embeddings;

CREATE POLICY "Authenticated users can view all embeddings"
  ON public.document_embeddings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert embeddings"
  ON public.document_embeddings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update all embeddings"
  ON public.document_embeddings FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete all embeddings"
  ON public.document_embeddings FOR DELETE TO authenticated USING (true);

-- EXPORT_HISTORY: all authenticated users can see/edit all exports
DROP POLICY IF EXISTS "Users can CRUD own exports" ON public.export_history;

CREATE POLICY "Authenticated users can view all exports"
  ON public.export_history FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert exports"
  ON public.export_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update all exports"
  ON public.export_history FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete all exports"
  ON public.export_history FOR DELETE TO authenticated USING (true);

-- CLIENT_ENRICHED_DATA: all authenticated users can see/edit
DROP POLICY IF EXISTS "Users can view own enriched data" ON public.client_enriched_data;
DROP POLICY IF EXISTS "Users can insert own enriched data" ON public.client_enriched_data;
DROP POLICY IF EXISTS "Users can update own enriched data" ON public.client_enriched_data;
DROP POLICY IF EXISTS "Users can delete own enriched data" ON public.client_enriched_data;

CREATE POLICY "Authenticated users can view all enriched data"
  ON public.client_enriched_data FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert enriched data"
  ON public.client_enriched_data FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update all enriched data"
  ON public.client_enriched_data FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete all enriched data"
  ON public.client_enriched_data FOR DELETE TO authenticated USING (true);

-- CHUNK_JOBS: all authenticated users can see all jobs
DROP POLICY IF EXISTS "Users can view own chunk jobs" ON public.chunk_jobs;
DROP POLICY IF EXISTS "Users can insert own chunk jobs" ON public.chunk_jobs;

CREATE POLICY "Authenticated users can view all chunk jobs"
  ON public.chunk_jobs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert chunk jobs"
  ON public.chunk_jobs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- VECTORIZATION_JOBS: all authenticated users can see all jobs
DROP POLICY IF EXISTS "Users can view own vectorization jobs" ON public.vectorization_jobs;
DROP POLICY IF EXISTS "Users can insert own vectorization jobs" ON public.vectorization_jobs;

CREATE POLICY "Authenticated users can view all vectorization jobs"
  ON public.vectorization_jobs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert vectorization jobs"
  ON public.vectorization_jobs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
