
CREATE OR REPLACE FUNCTION public.claim_queue_chunks(
  p_job_id uuid,
  p_worker_id text,
  p_limit integer DEFAULT 200
)
RETURNS TABLE(
  queue_id uuid,
  document_embedding_id uuid,
  chunk_text text,
  document_id uuid,
  chunk_index integer,
  project_id uuid,
  user_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH to_claim AS (
    SELECT eq.id
    FROM embedding_queue eq
    WHERE eq.job_id = p_job_id AND eq.status = 'pending'
    ORDER BY eq.created_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE embedding_queue eq
    SET status = 'processing', worker_id = p_worker_id, claimed_at = now()
    FROM to_claim
    WHERE eq.id = to_claim.id
    RETURNING eq.id AS queue_id, eq.document_embedding_id
  )
  SELECT 
    c.queue_id,
    c.document_embedding_id,
    de.chunk_text,
    de.document_id,
    de.chunk_index,
    de.project_id,
    de.user_id
  FROM claimed c
  JOIN document_embeddings de ON de.id = c.document_embedding_id;
END;
$$;
