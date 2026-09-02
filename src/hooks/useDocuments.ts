import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Document, DocumentProcessingStatus } from '@/types/database';
import { useToast } from '@/hooks/use-toast';

export function useDocuments(projectId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const documentsQuery = useQuery({
    queryKey: ['documents', projectId],
    queryFn: async (): Promise<Document[]> => {
      let query = supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Document[];
    },
    enabled: !!projectId,
    staleTime: 2000,
    refetchInterval: false,
  });

  const uploadDocument = useMutation({
    mutationFn: async ({ 
      projectId, 
      file 
    }: { 
      projectId: string; 
      file: File;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Upload file to storage
      const fileName = `${Date.now()}-${file.name}`;
      const storagePath = `${projectId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('sped-documents')
        .upload(storagePath, file);

      if (uploadError) throw uploadError;

      // Save storage folder path on project (once)
      const folderPath = `${projectId}`;
      await supabase
        .from('projects')
        .update({ storage_folder_path: folderPath } as any)
        .eq('id', projectId)
        .is('storage_folder_path', null);

      // Create document record
      const { data, error } = await supabase
        .from('documents')
        .insert({
          project_id: projectId,
          user_id: user.id,
          original_name: file.name,
          file_type: file.name.split('.').pop() || 'txt',
          file_size: file.size,
          storage_path: storagePath,
          processing_status: 'uploaded' as DocumentProcessingStatus,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Document;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast({
        title: 'Documento enviado',
        description: 'Documento SPED enviado com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao enviar documento',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteDocument = useMutation({
    mutationFn: async (document: Document) => {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('sped-documents')
        .remove([document.storage_path]);

      if (storageError) console.warn('Error deleting from storage:', storageError);

      // Delete record
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', document.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast({
        title: 'Documento removido',
        description: 'Documento removido com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao remover documento',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateDocumentStatus = useMutation({
    mutationFn: async ({ 
      id, 
      status 
    }: { 
      id: string; 
      status: DocumentProcessingStatus;
    }) => {
      const { data, error } = await supabase
        .from('documents')
        .update({ processing_status: status })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Document;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  return {
    documents: documentsQuery.data ?? [],
    isLoading: documentsQuery.isLoading,
    error: documentsQuery.error,
    uploadDocument,
    deleteDocument,
    updateDocumentStatus,
    refetch: documentsQuery.refetch,
  };
}
