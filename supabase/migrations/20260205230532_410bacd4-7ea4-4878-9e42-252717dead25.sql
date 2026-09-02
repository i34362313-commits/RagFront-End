-- =====================================================
-- Enable vector extension for RAG
-- =====================================================
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- =====================================================
-- 1. PROFILES TABLE (linked to auth.users)
-- =====================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- 2. CLIENTS TABLE
-- =====================================================
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cnpj TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own clients" ON public.clients
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_clients_user_id ON public.clients(user_id);

-- =====================================================
-- 3. PROJECTS TABLE
-- =====================================================
CREATE TYPE public.project_status AS ENUM (
  'sem_documentos',
  'documentos_enviados',
  'documentos_processados',
  'pronto_para_sumario',
  'sumario_gerado'
);

CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status public.project_status NOT NULL DEFAULT 'sem_documentos',
  prompt_template_id UUID,
  analysis_parameters JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own projects" ON public.projects
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_projects_client_id ON public.projects(client_id);
CREATE INDEX idx_projects_user_id ON public.projects(user_id);
CREATE INDEX idx_projects_status ON public.projects(status);

-- =====================================================
-- 4. PROMPT TEMPLATES TABLE
-- =====================================================
CREATE TABLE public.prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.prompt_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own templates" ON public.prompt_templates
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_prompt_templates_user_id ON public.prompt_templates(user_id);

-- Add FK constraint to projects after prompt_templates exists
ALTER TABLE public.projects 
  ADD CONSTRAINT fk_projects_prompt_template 
  FOREIGN KEY (prompt_template_id) REFERENCES public.prompt_templates(id) ON DELETE SET NULL;

-- =====================================================
-- 5. DOCUMENTS TABLE (SPED files)
-- =====================================================
CREATE TYPE public.document_processing_status AS ENUM (
  'uploaded',
  'processing',
  'processed',
  'indexed',
  'error'
);

CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'txt',
  file_size BIGINT,
  storage_path TEXT NOT NULL,
  processing_status public.document_processing_status NOT NULL DEFAULT 'uploaded',
  metadata JSONB DEFAULT '{}',
  enriched_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own documents" ON public.documents
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_documents_project_id ON public.documents(project_id);
CREATE INDEX idx_documents_user_id ON public.documents(user_id);
CREATE INDEX idx_documents_processing_status ON public.documents(processing_status);

-- =====================================================
-- 6. SUMMARIES TABLE
-- =====================================================
CREATE TABLE public.summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  content JSONB NOT NULL,
  insights TEXT[],
  calculations JSONB,
  data_crossings JSONB,
  justifications TEXT[],
  source_references JSONB,
  prompt_used TEXT,
  model_used TEXT DEFAULT 'gpt-4',
  tokens_used INTEGER,
  generation_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own summaries" ON public.summaries
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_summaries_project_id ON public.summaries(project_id);
CREATE INDEX idx_summaries_user_id ON public.summaries(user_id);

-- =====================================================
-- 7. EXPORT HISTORY TABLE
-- =====================================================
CREATE TABLE public.export_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  summary_id UUID NOT NULL REFERENCES public.summaries(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size BIGINT,
  exported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.export_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own exports" ON public.export_history
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_export_history_project_id ON public.export_history(project_id);
CREATE INDEX idx_export_history_client_id ON public.export_history(client_id);
CREATE INDEX idx_export_history_user_id ON public.export_history(user_id);

-- =====================================================
-- 8. DOCUMENT EMBEDDINGS TABLE (for RAG)
-- =====================================================
CREATE TABLE public.document_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  embedding extensions.vector(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.document_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own embeddings" ON public.document_embeddings
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_document_embeddings_document_id ON public.document_embeddings(document_id);
CREATE INDEX idx_document_embeddings_project_id ON public.document_embeddings(project_id);

-- =====================================================
-- 9. HELPER FUNCTIONS
-- =====================================================

-- Function to update project status based on documents
CREATE OR REPLACE FUNCTION public.update_project_status()
RETURNS TRIGGER AS $$
DECLARE
  doc_count INTEGER;
  indexed_count INTEGER;
  has_summary BOOLEAN;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE processing_status = 'indexed')
  INTO doc_count, indexed_count
  FROM public.documents
  WHERE project_id = COALESCE(NEW.project_id, OLD.project_id);
  
  SELECT EXISTS(
    SELECT 1 FROM public.summaries 
    WHERE project_id = COALESCE(NEW.project_id, OLD.project_id)
  ) INTO has_summary;
  
  UPDATE public.projects
  SET status = CASE
    WHEN has_summary THEN 'sumario_gerado'::project_status
    WHEN indexed_count > 0 AND indexed_count = doc_count THEN 'pronto_para_sumario'::project_status
    WHEN indexed_count > 0 THEN 'documentos_processados'::project_status
    WHEN doc_count > 0 THEN 'documentos_enviados'::project_status
    ELSE 'sem_documentos'::project_status
  END,
  updated_at = now()
  WHERE id = COALESCE(NEW.project_id, OLD.project_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_project_status_on_document_change
  AFTER INSERT OR UPDATE OR DELETE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.update_project_status();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_prompt_templates_updated_at
  BEFORE UPDATE ON public.prompt_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Similarity search function for RAG
CREATE OR REPLACE FUNCTION public.match_documents(
  query_embedding extensions.vector(1536),
  match_threshold FLOAT,
  match_count INT,
  p_project_id UUID
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  chunk_text TEXT,
  similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    de.id,
    de.document_id,
    de.chunk_text,
    1 - (de.embedding <=> query_embedding) AS similarity
  FROM public.document_embeddings de
  WHERE de.project_id = p_project_id
    AND de.user_id = auth.uid()
    AND 1 - (de.embedding <=> query_embedding) > match_threshold
  ORDER BY de.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- =====================================================
-- 10. STORAGE BUCKETS
-- =====================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('sped-documents', 'sped-documents', false, 52428800, ARRAY['text/plain', 'application/octet-stream']);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('exported-pdfs', 'exported-pdfs', false, 52428800, ARRAY['application/pdf']);

-- Storage policies for sped-documents
CREATE POLICY "Users can upload sped documents" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'sped-documents' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view sped documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'sped-documents' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete sped documents" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'sped-documents' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage policies for exported-pdfs
CREATE POLICY "Users can upload pdfs" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'exported-pdfs' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view pdfs" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'exported-pdfs' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete pdfs" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'exported-pdfs' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );