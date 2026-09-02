ALTER TABLE public.document_embeddings 
  ALTER COLUMN embedding TYPE extensions.vector(1536) 
  USING embedding::extensions.vector(1536);