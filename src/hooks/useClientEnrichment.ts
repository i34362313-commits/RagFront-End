import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ClientEnrichedData {
  id: string;
  client_id: string;
  cnpj: string;
  raw_data: Record<string, unknown> | null;
  status: 'pending' | 'success' | 'error';
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export function useClientEnrichment(clientId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['client-enrichment', clientId],
    queryFn: async (): Promise<ClientEnrichedData | null> => {
      if (!clientId) return null;
      const { data, error } = await supabase
        .from('client_enriched_data')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle();

      if (error) throw error;
      return data as ClientEnrichedData | null;
    },
    enabled: !!clientId,
    refetchInterval: (query) => {
      const data = query.state.data as ClientEnrichedData | null | undefined;
      // Poll every 3s while pending
      return data?.status === 'pending' ? 3000 : false;
    },
  });

  const triggerEnrichment = useMutation({
    mutationFn: async ({ clientId, cnpj }: { clientId: string; cnpj: string }) => {
      const { data, error } = await supabase.functions.invoke('enrich-client', {
        body: { client_id: clientId, cnpj },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-enrichment', clientId] });
    },
  });

  return {
    enrichment: query.data,
    isLoading: query.isLoading,
    triggerEnrichment,
    refetch: query.refetch,
  };
}
