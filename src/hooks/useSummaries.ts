import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Summary } from '@/types/database';
import type { Json } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';

export function useSummaries(projectId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const summariesQuery = useQuery({
    queryKey: ['summaries', projectId],
    queryFn: async (): Promise<Summary[]> => {
      let query = supabase
        .from('summaries')
        .select('*')
        .order('version', { ascending: false });

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Summary[];
    },
    enabled: !!projectId,
  });

  const createSummary = useMutation({
    mutationFn: async (summary: Omit<Summary, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('summaries')
        .insert({
          project_id: summary.project_id,
          user_id: summary.user_id,
          version: summary.version,
          content: summary.content as Json,
          insights: summary.insights,
          calculations: summary.calculations as Json,
          data_crossings: summary.data_crossings as Json,
          justifications: summary.justifications,
          source_references: summary.source_references as Json,
          prompt_used: summary.prompt_used,
          model_used: summary.model_used,
          tokens_used: summary.tokens_used,
          generation_time_ms: summary.generation_time_ms,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Summary;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['summaries'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast({
        title: 'Sumário gerado',
        description: 'Sumário gerado com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao gerar sumário',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    summaries: summariesQuery.data ?? [],
    isLoading: summariesQuery.isLoading,
    error: summariesQuery.error,
    createSummary,
    refetch: summariesQuery.refetch,
  };
}
