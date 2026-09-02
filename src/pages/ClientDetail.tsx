import { Link, useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { formatCnpj, formatPhone } from '@/lib/cnpj';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { useClient, useClients } from '@/hooks/useClients';
import { useProjects } from '@/hooks/useProjects';
import { useClientEnrichment } from '@/hooks/useClientEnrichment';
import { PROJECT_STATUS_LABELS } from '@/types/database';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Plus,
  FolderOpen,
  Loader2,
  Mail,
  Phone,
  MapPin,
  Building,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Database,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: client, isLoading } = useClient(id);
  const { projects, isLoading: loadingProjects } = useProjects(id);
  const { deleteClient } = useClients();
  const { enrichment, isLoading: loadingEnrichment, triggerEnrichment } = useClientEnrichment(id);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    if (client) {
      await deleteClient.mutateAsync(client.id);
      navigate('/clients');
    }
  };

  const handleRetryEnrichment = () => {
    if (client?.cnpj) {
      triggerEnrichment.mutate(
        { clientId: client.id, cnpj: client.cnpj },
        {
          onSuccess: () => toast({ title: 'Enriquecimento iniciado', description: 'Os dados estão sendo buscados.' }),
          onError: () => toast({ title: 'Erro', description: 'Falha ao iniciar enriquecimento.', variant: 'destructive' }),
        }
      );
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!client) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold">Cliente não encontrado</h2>
          <Button asChild className="mt-4">
            <Link to="/clients">Voltar para Clientes</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  // Extract basic info from enrichment raw_data
  const razaoSocial = enrichment?.raw_data
    ? (enrichment.raw_data as Record<string, unknown>)?.razao_social as string | undefined
    : undefined;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/clients')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{client.name}</h1>
              <p className="text-muted-foreground">
                Cliente desde {format(new Date(client.created_at), "MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to={`/clients/${client.id}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </Link>
            </Button>
            <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Client Info */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Informações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {client.cnpj && (
                <div className="flex items-center gap-3">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{formatCnpj(client.cnpj)}</span>
                </div>
              )}
              {client.email && (
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${client.email}`} className="text-sm hover:underline">
                    {client.email}
                  </a>
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${client.phone}`} className="text-sm hover:underline">
                    {formatPhone(client.phone)}
                  </a>
                </div>
              )}
              {client.address && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <span className="text-sm">{client.address}</span>
                </div>
              )}
              {client.notes && (
                <div className="pt-4 border-t">
                  <p className="text-sm font-medium mb-2">Observações</p>
                  <p className="text-sm text-muted-foreground">{client.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Projects */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Projetos</CardTitle>
                <CardDescription>
                  {projects.length} projeto(s) associado(s)
                </CardDescription>
              </div>
              <Button asChild>
                <Link to={`/projects/new?client=${client.id}`}>
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Projeto
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {loadingProjects ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : projects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FolderOpen className="mb-4 h-12 w-12 text-muted-foreground" />
                  <h3 className="font-medium">Nenhum projeto ainda</h3>
                  <p className="text-sm text-muted-foreground">
                    Crie o primeiro projeto para este cliente
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {projects.map((project) => (
                    <Link
                      key={project.id}
                      to={`/projects/${project.id}`}
                      className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-accent"
                    >
                      <div className="space-y-1">
                        <p className="font-medium">{project.name}</p>
                        {project.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {project.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary">
                          {PROJECT_STATUS_LABELS[project.status]}
                        </Badge>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Enrichment Section */}
        {client.cnpj && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Dados Externos
                    {(loadingEnrichment || enrichment?.status === 'pending') && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </CardTitle>
                  <CardDescription>
                    {enrichment?.status === 'pending'
                      ? 'Buscando dados da empresa...'
                      : 'Enriquecimento de dados via API'}
                  </CardDescription>
                </div>
              </div>
              {(enrichment?.status === 'error' || !enrichment) && !loadingEnrichment && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetryEnrichment}
                  disabled={triggerEnrichment.isPending}
                >
                  {triggerEnrichment.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  {enrichment ? 'Tentar novamente' : 'Buscar dados'}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {loadingEnrichment ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando...
                </div>
              ) : !enrichment ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum dado externo disponível. Clique em "Buscar dados" para iniciar.
                </p>
              ) : enrichment.status === 'pending' ? (
                <div className="flex items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-950">
                  <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Em processamento</p>
                    <p className="text-xs text-yellow-600 dark:text-yellow-400">
                      Buscando dados da empresa. Isso pode levar alguns segundos...
                    </p>
                  </div>
                </div>
              ) : enrichment.status === 'error' ? (
                <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                  <XCircle className="h-5 w-5 text-destructive" />
                  <div>
                    <p className="text-sm font-medium text-destructive">Erro no enriquecimento</p>
                    <p className="text-xs text-muted-foreground">
                      {enrichment.error_message || 'Erro desconhecido ao buscar dados.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-green-800 dark:text-green-200">Dados obtidos com sucesso</p>
                    <div className="grid gap-1 text-sm">
                      <div className="flex gap-2">
                        <span className="text-muted-foreground">CNPJ:</span>
                        <span>{enrichment.cnpj}</span>
                      </div>
                      {razaoSocial && (
                        <div className="flex gap-2">
                          <span className="text-muted-foreground">Razão Social:</span>
                          <span>{razaoSocial}</span>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Atualizado em {format(new Date(enrichment.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o cliente "{client.name}"? 
              Esta ação não pode ser desfeita e removerá todos os projetos e documentos associados.
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
