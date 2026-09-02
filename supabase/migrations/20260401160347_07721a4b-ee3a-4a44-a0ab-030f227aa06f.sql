
-- 1. Update delete_project_cascade to remove references to legacy tables
CREATE OR REPLACE FUNCTION public.delete_project_cascade(p_project_id uuid, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '120s'
AS $function$
DECLARE
  doc_count integer;
  storage_paths text[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM projects WHERE id = p_project_id) THEN
    RAISE EXCEPTION 'Project not found';
  END IF;

  SELECT array_agg(storage_path) INTO storage_paths
  FROM documents WHERE project_id = p_project_id;

  DELETE FROM documents WHERE project_id = p_project_id;
  GET DIAGNOSTICS doc_count = ROW_COUNT;

  DELETE FROM export_history WHERE project_id = p_project_id;
  DELETE FROM summaries WHERE project_id = p_project_id;

  DELETE FROM projects WHERE id = p_project_id;

  RETURN jsonb_build_object(
    'documents_deleted', doc_count,
    'storage_paths', COALESCE(to_jsonb(storage_paths), '[]'::jsonb)
  );
END;
$function$;

-- 2. Drop legacy functions that reference these tables
DROP FUNCTION IF EXISTS public.dispatch_vectorize_workers();
DROP FUNCTION IF EXISTS public.dispatch_chunk_workers();
DROP FUNCTION IF EXISTS public.claim_queue_chunks(uuid, text, integer);
DROP FUNCTION IF EXISTS public.release_stale_claims(integer);
DROP FUNCTION IF EXISTS public.get_queue_progress(uuid);
DROP FUNCTION IF EXISTS public.match_documents(extensions.vector, double precision, integer, uuid);

-- 3. Drop legacy tables (order matters due to foreign keys)
DROP TABLE IF EXISTS public.embedding_queue;
DROP TABLE IF EXISTS public.document_embeddings;
DROP TABLE IF EXISTS public.vectorization_jobs;
DROP TABLE IF EXISTS public.chunk_jobs;
