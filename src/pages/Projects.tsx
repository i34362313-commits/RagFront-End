import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useProjects } from '@/hooks/useProjects';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Project, PROJECT_STATUS_LABELS } from '@/types/database';
import { 
  Plus, 
  Search, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Eye,
  Loader2,
  FolderOpen,
  Upload,
  Cog,
  Sparkles,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type ActivityType = 'uploading' | 'processing' | 'generating_summary';

function getProjectActivity(project: Project): ActivityType | null {
  const params = project.analysis_parameters as Record<string, any> | null;
  if (!params) return null;
  if (params.active_uploading) return 'uploading';
  if (params.active_processing_job_id) return 'processing';
  if (params.active_generating_summary) return 'generating_summary';
  return null;
}

const ACTIVITY_CONFIG: Record<ActivityType, { label: string; icon: typeof Upload; colorClass: string }> = {
  uploading: {
    label: 'Enviando documentos...',
    icon: Upload,
    colorClass: 'text-blue-500',
  },
  processing: {
    label: 'Processando documentos...',
    icon: Cog,
    colorClass: 'text-orange-500',
  },
  generating_summary: {
    label: 'Gerando sumário...',
    icon: Sparkles,
    colorClass: 'text-purple-500',
  },
};

export default function ProjectsPage() {
  const { projects, isLoading, deleteProject, refetch } = useProjects();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);

  // Realtime subscription for project updates (analysis_parameters changes)
  useEffect(() => {
    const channel = supabase
      .channel('projects-activity')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'projects' },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(search.toLowerCase()) ||
    (project.client as { name: string })?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const setLocalDeleting = (id: string, add: boolean) => {
    const current: string[] = JSON.parse(localStorage.getItem('deletingProjects') || '[]');
    const next = add
      ? Array.from(new Set([...current, id]))
      : current.filter((pid) => pid !== id);
    localStorage.setItem('deletingProjects', JSON.stringify(next));
  };

  const handleDelete = async () => {
    const project = projectToDelete;
    if (!project) return;

    setProjectToDelete(null);
    setDeletingIds((prev) => [...prev, project.id]);
    setLocalDeleting(project.id, true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: 'Erro', description: 'Usuário não autenticado', variant: 'destructive' });
        return;
      }

      // 1. Limpa dados vetoriais/arquivos no backend Python
      const { deleteProjectData } = await import('@/lib/python-backend');
      const folderPath = (project as { storage_folder_path?: string }).storage_folder_path || project.id;
      const backendResult = await deleteProjectData(project.id, folderPath);

      // 2. Remove do Supabase (cascade)
      await deleteProject.mutateAsync(project.id);

      toast({
        title: 'Projeto removido',
        description: backendResult.message || 'Projeto e todos os dados removidos permanentemente.',
      });
    } catch (err) {
      toast({
        title: 'Erro ao remover projeto',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setDeletingIds((prev) => prev.filter((pid) => pid !== project.id));
      setLocalDeleting(project.id, false);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    }
  };


  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sumario_gerado':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'pronto_para_sumario':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'documentos_processados':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'documentos_enviados':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Projetos</h1>
            <p className="text-muted-foreground">
              Gerencie seus projetos e documentos SPED
            </p>
          </div>
          <Button asChild>
            <Link to="/projects/new">
              <Plus className="mr-2 h-4 w-4" />
              Novo Projeto
            </Link>
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar projetos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de Projetos</CardTitle>
            <CardDescription>
              {filteredProjects.length} projeto(s) encontrado(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FolderOpen className="mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="font-medium">Nenhum projeto encontrado</h3>
                <p className="text-sm text-muted-foreground">
                  {search ? 'Tente outro termo de busca' : 'Comece criando seu primeiro projeto'}
                </p>
                {!search && (
                  <Button asChild className="mt-4">
                    <Link to="/projects/new">
                      <Plus className="mr-2 h-4 w-4" />
                      Novo Projeto
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              <TooltipProvider>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Atividade</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead className="w-[70px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProjects.map((project) => {
                      const activity = getProjectActivity(project);
                      const activityConfig = activity ? ACTIVITY_CONFIG[activity] : null;
                      const isDeleting = deletingIds.includes(project.id);

                      return (
                        <TableRow key={project.id} className={isDeleting ? 'opacity-60' : undefined}>
                          <TableCell className="font-medium">
                            <Link 
                              to={`/projects/${project.id}`}
                              className="hover:underline"
                            >
                              {project.name}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Link 
                              to={`/clients/${project.client_id}`}
                              className="hover:underline"
                            >
                              {(project.client as { name: string })?.name || '-'}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(project.status)}>
                              {PROJECT_STATUS_LABELS[project.status]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {isDeleting ? (
                              <div className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span className="hidden sm:inline">Excluindo projeto...</span>
                              </div>
                            ) : activityConfig ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className={`flex items-center gap-1.5 text-sm font-medium ${activityConfig.colorClass}`}>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span className="hidden sm:inline">{activityConfig.label}</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {activityConfig.label}
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </TableCell>

                          <TableCell>
                            {format(new Date(project.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" disabled={isDeleting}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link to={`/projects/${project.id}`}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    Ver
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link to={`/projects/${project.id}/edit`}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Editar
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => setProjectToDelete(project)}
                                  disabled={isDeleting}
                                  className="text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Excluir
                                </DropdownMenuItem>

                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TooltipProvider>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!projectToDelete} onOpenChange={() => setProjectToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir projeto?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o projeto "{projectToDelete?.name}"? 
              Esta ação não pode ser desfeita e removerá todos os documentos e sumários associados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
