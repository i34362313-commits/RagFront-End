-- Drop old storage policies for sped-documents
DROP POLICY IF EXISTS "Users can upload sped documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view sped documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete sped documents" ON storage.objects;

-- New policies: all authenticated users can upload/view/delete in sped-documents
CREATE POLICY "Authenticated users can upload sped documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'sped-documents');

CREATE POLICY "Authenticated users can view sped documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'sped-documents');

CREATE POLICY "Authenticated users can delete sped documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'sped-documents');