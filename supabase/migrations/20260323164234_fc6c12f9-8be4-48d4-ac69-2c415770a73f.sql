CREATE INDEX IF NOT EXISTS idx_documents_vectorize_queue
ON public.documents (project_id, user_id, processing_status, id);

CREATE INDEX IF NOT EXISTS idx_document_embeddings_pending_by_doc
ON public.document_embeddings (document_id, chunk_index)
WHERE embedding IS NULL;