import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Project, ProjectFormData } from '@/types/database';
import type { Json } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';

export function useProjects(clientId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const projectsQuery = useQuery({
    queryKey: ['projects', clientId],
    queryFn: async (): Promise<Project[]> => {
      let query = supabase
        .from('projects')
        .select(`
          *,
          client:clients(id, name),
          prompt_template:prompt_templates(id, name)
        `)
        .order('created_at', { ascending: false });

      if (clientId) {
        query = query.eq('client_id', clientId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Project[];
    },
  });

  const createProject = useMutation({
    mutationFn: async (formData: ProjectFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('projects')
        .insert({
          client_id: formData.client_id,
          name: formData.name,
          description: formData.description,
          prompt_template_id: formData.prompt_template_id || null,
          analysis_parameters: (formData.analysis_parameters || {}) as Json,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast({
        title: 'Projeto criado',
        description: 'Projeto criado com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao criar projeto',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateProject = useMutation({
    mutationFn: async ({ id, ...formData }: Partial<ProjectFormData> & { id: string }) => {
      const updateData: Record<string, Json | string | undefined> = {};
      if (formData.client_id) updateData.client_id = formData.client_id;
      if (formData.name) updateData.name = formData.name;
      if (formData.description !== undefined) updateData.description = formData.description;
      if (formData.prompt_template_id !== undefined) updateData.prompt_template_id = formData.prompt_template_id;
      if (formData.analysis_parameters) updateData.analysis_parameters = formData.analysis_parameters as Json;

      const { data, error } = await supabase
        .from('projects')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast({
        title: 'Projeto atualizado',
        description: 'Dados do projeto atualizados com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao atualizar projeto',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteProject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast({
        title: 'Projeto removido',
        description: 'Projeto removido com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao remover projeto',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    projects: projectsQuery.data ?? [],
    isLoading: projectsQuery.isLoading,
    error: projectsQuery.error,
    createProject,
    updateProject,
    deleteProject,
    refetch: projectsQuery.refetch,
  };
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: ['projects', 'detail', id],
    queryFn: async (): Promise<Project | null> => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          client:clients(*),
          prompt_template:prompt_templates(*),
          documents(*),
          summaries(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Project;
    },
    enabled: !!id,
  });
}
