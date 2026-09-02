import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ExportHistory } from '@/types/database';
import { useToast } from '@/hooks/use-toast';

interface ExportHistoryFilters {
  clientId?: string;
  projectId?: string;
}

export function useExportHistory(filters?: ExportHistoryFilters) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const historyQuery = useQuery({
    queryKey: ['export_history', filters],
    queryFn: async (): Promise<ExportHistory[]> => {
      let query = supabase
        .from('export_history')
        .select(`
          *,
          summary:summaries(id, version),
          project:projects(id, name),
          client:clients(id, name)
        `)
        .order('exported_at', { ascending: false });

      if (filters?.clientId) {
        query = query.eq('client_id', filters.clientId);
      }

      if (filters?.projectId) {
        query = query.eq('project_id', filters.projectId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ExportHistory[];
    },
  });

  const createExport = useMutation({
    mutationFn: async (exportData: Omit<ExportHistory, 'id' | 'exported_at'>) => {
      const { data, error } = await supabase
        .from('export_history')
        .insert(exportData)
        .select()
        .single();

      if (error) throw error;
      return data as ExportHistory;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['export_history'] });
      toast({
        title: 'PDF exportado',
        description: 'PDF gerado e salvo com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao exportar PDF',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    exports: historyQuery.data ?? [],
    isLoading: historyQuery.isLoading,
    error: historyQuery.error,
    createExport,
    refetch: historyQuery.refetch,
  };
}
