-- Index to speed up "WHERE embedding IS NULL" queries used by vectorize-chunks
CREATE INDEX IF NOT EXISTS idx_document_embeddings_null_embedding
ON public.document_embeddings (project_id, user_id)
WHERE embedding IS NULL;

-- Index to speed up count of non-null embeddings (used by progress polling)
CREATE INDEX IF NOT EXISTS idx_document_embeddings_project_id
ON public.document_embeddings (project_id);