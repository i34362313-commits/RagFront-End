
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
