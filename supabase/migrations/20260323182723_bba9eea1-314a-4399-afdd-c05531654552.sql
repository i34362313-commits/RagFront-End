
CREATE OR REPLACE FUNCTION public.delete_project_cascade(p_project_id uuid, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '120s'
AS $function$
DECLARE
  embed_count integer := 0;
  doc_count integer;
  storage_paths text[];
  batch_deleted integer;
BEGIN
  -- Verify ownership
  IF NOT EXISTS (SELECT 1 FROM projects WHERE id = p_project_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'Project not found or access denied';
  END IF;

  -- Delete embeddings in batches of 5000 to avoid lock contention
  LOOP
    DELETE FROM document_embeddings
    WHERE id IN (
      SELECT id FROM document_embeddings
      WHERE project_id = p_project_id
      LIMIT 5000
    );
    GET DIAGNOSTICS batch_deleted = ROW_COUNT;
    embed_count := embed_count + batch_deleted;
    EXIT WHEN batch_deleted = 0;
  END LOOP;

  -- Collect storage paths before deleting documents
  SELECT array_agg(storage_path) INTO storage_paths
  FROM documents WHERE project_id = p_project_id;

  -- Delete documents
  DELETE FROM documents WHERE project_id = p_project_id;
  GET DIAGNOSTICS doc_count = ROW_COUNT;

  -- Delete export_history
  DELETE FROM export_history WHERE project_id = p_project_id;

  -- Delete summaries
  DELETE FROM summaries WHERE project_id = p_project_id;

  -- Delete vectorization jobs
  DELETE FROM vectorization_jobs WHERE project_id = p_project_id;

  -- Delete the project
  DELETE FROM projects WHERE id = p_project_id AND user_id = p_user_id;

  RETURN jsonb_build_object(
    'embeddings_deleted', embed_count,
    'documents_deleted', doc_count,
    'storage_paths', COALESCE(to_jsonb(storage_paths), '[]'::jsonb)
  );
END;
$function$;
