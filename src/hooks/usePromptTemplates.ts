import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PromptTemplate, PromptTemplateFormData } from '@/types/database';
import { useToast } from '@/hooks/use-toast';

export function usePromptTemplates() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const templatesQuery = useQuery({
    queryKey: ['prompt_templates'],
    queryFn: async (): Promise<PromptTemplate[]> => {
      const { data, error } = await supabase
        .from('prompt_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as PromptTemplate[];
    },
  });

  const createTemplate = useMutation({
    mutationFn: async (formData: PromptTemplateFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('prompt_templates')
        .insert({
          ...formData,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as PromptTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompt_templates'] });
      toast({
        title: 'Template criado',
        description: 'Template de prompt criado com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao criar template',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, ...formData }: PromptTemplateFormData & { id: string }) => {
      const { data, error } = await supabase
        .from('prompt_templates')
        .update(formData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as PromptTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompt_templates'] });
      toast({
        title: 'Template atualizado',
        description: 'Template de prompt atualizado com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao atualizar template',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('prompt_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompt_templates'] });
      toast({
        title: 'Template removido',
        description: 'Template de prompt removido com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao remover template',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    templates: templatesQuery.data ?? [],
    isLoading: templatesQuery.isLoading,
    error: templatesQuery.error,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    refetch: templatesQuery.refetch,
  };
}
