import { useRef, useState, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useProject, useProjects } from '@/hooks/useProjects';
import { useDocuments } from '@/hooks/useDocuments';
import { useSummaries } from '@/hooks/useSummaries';
import { Document, PROJECT_STATUS_LABELS, DOCUMENT_STATUS_LABELS } from '@/types/database';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Upload,
  FolderUp,
  FileText,
  Loader2,
  Sparkles,
  Download,
  CheckCircle,
  XCircle,
  AlertCircle,
  Layers,
  Clock,
  Cog,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import {
  uploadDocuments,
  processStoragePaths,
  getProcessingStatus,
  generateSummary,
  indexEnrichment,
  STAGE_LABELS,
  type ProcessingStatus,
  type ProcessingStage,
} from '@/lib/python-backend';
import { usePromptTemplates } from '@/hooks/usePromptTemplates';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useClientEnrichment } from '@/hooks/useClientEnrichment';

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const { data: project, isLoading } = useProject(id);
  const { deleteProject } = useProjects();
  const { documents, uploadDocument, deleteDocument, isLoading: loadingDocs } = useDocuments(id);
  const { summaries, isLoading: loadingSummaries } = useSummaries(id);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, failed: 0 });

  // Unified processing state (Python backend)
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingJobId, setProcessingJobId] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<'gpt-4.1-nano' | 'gpt-4.1-mini' | 'gpt-4.1'>('gpt-4.1-mini');

  const { templates } = usePromptTemplates();
  const { enrichment } = useClientEnrichment(project?.client_id);
  const hasEnrichmentData = enrichment?.status === 'success' && !!enrichment?.raw_data;
  const [isIndexingEnrichment, setIsIndexingEnrichment] = useState(false);

  const enrichmentIndexed = !!(
    project?.analysis_parameters &&
    typeof project.analysis_parameters === 'object' &&
    (project.analysis_parameters as Record<string, any>).enrichment_indexed
  );

  const handleIndexEnrichment = useCallback(async () => {
    if (!project || !enrichment?.raw_data) return;
    setIsIndexingEnrichment(true);
    try {
      const result = await indexEnrichment(
        project.id,
        enrichment.raw_data as Record<string, unknown>
      );
      const currentParams = (project.analysis_parameters as Record<string, any>) || {};
      await supabase
        .from('projects')
        .update({
          analysis_parameters: {
            ...currentParams,
            enrichment_indexed: true,
            enrichment_indexed_at: new Date().toISOString(),
            enrichment_chunks: result.chunks ?? null,
          },
        })
        .eq('id', project.id);
      await queryClient.invalidateQueries({ queryKey: ['project', project.id] });
      toast({
        title: 'Enriquecimento indexado',
        description: `Dados do cliente adicionados à RAG${result.chunks ? ` (${result.chunks} chunks)` : ''}.`,
      });
    } catch (err) {
      toast({
        title: 'Erro ao indexar enriquecimento',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setIsIndexingEnrichment(false);
    }
  }, [project, enrichment, queryClient, toast]);


  // Detect if another user is uploading (from DB flag)
  const isRemoteUploading = !isUploading && !!(project?.analysis_parameters && typeof project.analysis_parameters === 'object' && (project.analysis_parameters as Record<string, any>).active_uploading);

  // Detect summary generation (local OR remote via DB flag) — keeps the progress bar visible
  // even if the local state is reset (reload, realtime refresh, another user generating).
  const isRemoteGeneratingSummary = !!(
    project?.analysis_parameters &&
    typeof project.analysis_parameters === 'object' &&
    (project.analysis_parameters as Record<string, any>).active_generating_summary
  );
  const showSummaryProgress = isGeneratingSummary || isRemoteGeneratingSummary;

  // Realtime: listen for new documents being added to this project
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`project-docs-${id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'documents',
        filter: `project_id=eq.${id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['documents', id], refetchType: 'active' });
        queryClient.refetchQueries({ queryKey: ['documents', id] });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'projects',
        filter: `id=eq.${id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['projects', 'detail', id] });
        queryClient.refetchQueries({ queryKey: ['projects', 'detail', id] });
        queryClient.invalidateQueries({ queryKey: ['projects'] });
        // Also refresh documents when project updates (e.g. upload finished)
        queryClient.refetchQueries({ queryKey: ['documents', id] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, queryClient]);

  const stopProcessingPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopProcessingPoll();
  }, [stopProcessingPoll]);

  // Resume polling if we have a jobId in sessionStorage or in project's analysis_parameters
  useEffect(() => {
    if (!id || pollRef.current) return;
    
    // First check sessionStorage (same session)
    const savedJobId = sessionStorage.getItem(`processing_job_${id}`);
    if (savedJobId) {
      setIsProcessing(true);
      setProcessingJobId(savedJobId);
      pollRef.current = setInterval(() => pollProcessingStatus(savedJobId), 2500);
      return;
    }
    
    // Then check project's analysis_parameters (cross-session/cross-user)
    if (project?.analysis_parameters && typeof project.analysis_parameters === 'object') {
      const params = project.analysis_parameters as Record<string, any>;
      const dbJobId = params?.active_processing_job_id;
      if (dbJobId) {
        setIsProcessing(true);
        setProcessingJobId(dbJobId);
        sessionStorage.setItem(`processing_job_${id}`, dbJobId);
        pollRef.current = setInterval(() => pollProcessingStatus(dbJobId), 2500);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, project?.analysis_parameters]);

  const clearProcessingState = useCallback(async () => {
    stopProcessingPoll();
    setIsProcessing(false);
    setProcessingJobId(null);
    sessionStorage.removeItem(`processing_job_${id}`);
    // Clear from DB so other users don't pick it up
    if (id) {
      const currentParams = (project?.analysis_parameters as Record<string, any>) || {};
      const { active_processing_job_id, ...rest } = currentParams;
      await supabase.from('projects').update({ analysis_parameters: rest }).eq('id', id);
    }
  }, [id, project?.analysis_parameters, stopProcessingPoll]);

  const pollProcessingStatus = useCallback(async (jobId: string) => {
    try {
      const status = await getProcessingStatus(jobId);

      if (!status) {
        console.log('Job não existe mais, parando polling');
        await clearProcessingState();
        return;
      }

      setProcessingStatus(status);

      if (status.status === 'completed') {
        await clearProcessingState();

        // Update all documents to 'indexed' so the DB trigger moves project to 'pronto_para_sumario'
        await supabase
          .from('documents')
          .update({ processing_status: 'indexed' as any })
          .eq('project_id', id!);

        queryClient.invalidateQueries({ queryKey: ['documents'] });
        queryClient.invalidateQueries({ queryKey: ['projects'] });
        toast({
          title: 'Processamento concluído',
          description: 'Todos os documentos foram processados e vetorizados com sucesso.',
        });
      } else if (status.status === 'failed' || status.status === 'error') {
        await clearProcessingState();
        toast({
          title: 'Erro no processamento',
          description: 'O pipeline falhou. Tente novamente.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      console.error('Poll error:', err);
      // If it's a 404-like error, stop polling
      if (err?.message?.includes('404') || err?.message?.includes('não encontrado')) {
        await clearProcessingState();
      }
    }
  }, [id, clearProcessingState, toast, queryClient]);

  const handleProcessDocuments = useCallback(async () => {
    if (!id || documents.length === 0) return;

    setIsProcessing(true);
    setProcessingStatus(null);

    try {
      // ⚡ Em vez de baixar 251 arquivos no browser e re-uploadar 185MB pelo proxy,
      // mandamos só os paths do Storage. O backend Python baixa direto via service_role.
      const paths = documents.map((d) => d.storage_path).filter(Boolean);

      if (paths.length === 0) {
        toast({
          title: 'Nenhum arquivo válido',
          description: 'Nenhum documento com storage_path encontrado.',
          variant: 'destructive',
        });
        setIsProcessing(false);
        return;
      }

      const { job_id } = await processStoragePaths(paths, id!);
      setProcessingJobId(job_id);
      sessionStorage.setItem(`processing_job_${id}`, job_id);
      // Save job_id to project so other users can see the processing state
      await supabase
        .from('projects')
        .update({ analysis_parameters: { ...(project?.analysis_parameters as object || {}), active_processing_job_id: job_id } })
        .eq('id', id!);

      pollRef.current = setInterval(() => pollProcessingStatus(job_id), 2500);

      toast({
        title: 'Processamento iniciado',
        description: `${paths.length} arquivo(s) sendo processados (download direto no backend + chunking + embeddings em batch).`,
      });
    } catch (err: any) {
      console.error('Error starting processing:', err);
      setIsProcessing(false);
      toast({
        title: 'Erro ao iniciar processamento',
        description: err.message || 'Erro desconhecido',
        variant: 'destructive',
      });
    }
  }, [id, documents, toast, pollProcessingStatus]);

  // Stage 2: Generate Summary via Python backend RAG
  const handleGenerateSummaryClick = useCallback(() => {
    if (!id) return;
    setSelectedTemplateId(null);
    setShowTemplateDialog(true);
  }, [id]);

  const handleTemplateConfirm = useCallback(() => {
    if (!selectedTemplateId) return;
    const template = templates.find(t => t.id === selectedTemplateId);
    if (!template) return;
    setShowTemplateDialog(false);
    doGenerateSummary(template.content, selectedModel);
  }, [selectedTemplateId, templates, selectedModel]);

  const doGenerateSummary = useCallback(async (templateContent?: string, model?: string) => {
    if (!id) return;

    const finalTemplate = templateContent || 'Analise os documentos e gere um sumário estruturado com insights, inconsistências, oportunidades e referências.';
    const finalModel = model || 'gpt-4.1-mini';

    setIsGeneratingSummary(true);

    // Signal summary generation to other users
    await supabase.from('projects').update({
      analysis_parameters: { ...(project?.analysis_parameters as object || {}), active_generating_summary: true },
    }).eq('id', id!);

    try {
      const result = await generateSummary({
        project_id: id!,
        template: finalTemplate,
        query: 'análise completa dos documentos SPED',
        k: 20,
        model: finalModel,
      });

      // Save summary to Supabase
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: 'Erro', description: 'Sessão expirada', variant: 'destructive' });
        setIsGeneratingSummary(false);
        return;
      }

      // Get next version number
      const currentMaxVersion = summaries.length > 0 ? Math.max(...summaries.map(s => s.version)) : 0;

      // Backend pode retornar:
      //  - string crua do LLM (novo fluxo de job)
      //  - { summary: {...}, model, tokens_used, generation_time_ms, sources_used }
      const rawResult: any = result;
      let summaryContent: Record<string, unknown>;
      if (typeof rawResult === 'string') {
        summaryContent = { text: rawResult };
      } else if (rawResult && typeof rawResult === 'object') {
        const inner = (rawResult.summary ?? rawResult) as Record<string, unknown> | string;
        summaryContent = typeof inner === 'string' ? { text: inner } : { ...inner };
      } else {
        summaryContent = {};
      }

      // Persistir metadados agentic_v2 (analytics, memory, graph, plan, trace, periodo)
      // dentro do content com prefixo `_` para sobreviverem ao reload do SummaryView.
      if (rawResult && typeof rawResult === 'object') {
        const meta: Record<string, unknown> = {
          _analytics: rawResult.analytics,
          _memory: rawResult.memory,
          _graph: rawResult.graph,
          _plan: rawResult.plan,
          _trace: rawResult.trace,
          _mode: rawResult.mode,
          _periodo_detectado: rawResult.periodo_detectado,
        };
        for (const [k, v] of Object.entries(meta)) {
          if (v !== undefined && v !== null) summaryContent[k] = v;
        }
      }

      const insightsArr = Array.isArray((summaryContent as any).insights)
        ? (summaryContent as any).insights
        : [];

      await supabase.from('summaries').insert({
        project_id: id,
        user_id: session.user.id,
        version: currentMaxVersion + 1,
        content: summaryContent as unknown as import('@/integrations/supabase/types').Json,
        insights: insightsArr,
        // Sempre confia na escolha do usuário; backend pode estar reportando errado
        model_used: finalModel,
        tokens_used: (rawResult && rawResult.tokens_used) ?? null,
        generation_time_ms: (rawResult && rawResult.generation_time_ms) ?? null,
        prompt_used: finalTemplate,
      });

      const timeSec = (((rawResult && rawResult.generation_time_ms) ?? 0) / 1000).toFixed(1);
      const sourcesInfo = (rawResult && rawResult.sources_used) ? ` (${rawResult.sources_used} fontes)` : '';
      toast({
        title: 'Sumário gerado',
        description: `Versão ${currentMaxVersion + 1} criada em ${timeSec}s${sourcesInfo}.`,
      });
    } catch (err: any) {
      console.error('Error generating summary', err);
      toast({
        title: 'Erro ao gerar sumário',
        description: err.message || 'Erro desconhecido',
        variant: 'destructive',
      });
    }

    // Clear summary flag from DB
    const curParams = (project?.analysis_parameters as Record<string, any>) || {};
    const { active_generating_summary, ...remainingParams } = curParams;
    await supabase.from('projects').update({ analysis_parameters: remainingParams }).eq('id', id!);

    setIsGeneratingSummary(false);
    queryClient.invalidateQueries({ queryKey: ['summaries'] });
    queryClient.invalidateQueries({ queryKey: ['projects'] });
  }, [id, project, summaries, toast, queryClient]);

  const handleDelete = async () => {
    if (project) {
      setIsDeleting(true);
      setShowDeleteDialog(false);

      const deletingProjects = JSON.parse(localStorage.getItem('deletingProjects') || '[]');
      deletingProjects.push(project.id);
      localStorage.setItem('deletingProjects', JSON.stringify(deletingProjects));
      navigate('/projects');

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          toast({ title: 'Erro', description: 'Usuário não autenticado', variant: 'destructive' });
          localStorage.setItem('deletingProjects', JSON.stringify(
            JSON.parse(localStorage.getItem('deletingProjects') || '[]').filter((pid: string) => pid !== project.id)
          ));
          return;
        }

        // 1. Delete vector data from Python backend (sends folder_path for Supabase Storage cleanup)
        const { deleteProjectData } = await import('@/lib/python-backend');
        const folderPath = project.storage_folder_path || project.id;
        const backendResult = await deleteProjectData(project.id, folderPath);

        // 2. Delete project from Supabase (cascade)
        await deleteProject.mutateAsync(project.id);

        toast({
          title: 'Projeto removido',
          description: backendResult.message || 'Projeto e todos os dados removidos permanentemente.',
        });

        queryClient.invalidateQueries({ queryKey: ['projects'] });
      } catch (err: any) {
        toast({
          title: 'Erro ao remover projeto',
          description: err.message || 'Erro desconhecido',
          variant: 'destructive',
        });
      } finally {
        localStorage.setItem('deletingProjects', JSON.stringify(
          JSON.parse(localStorage.getItem('deletingProjects') || '[]').filter((pid: string) => pid !== project.id)
        ));
        queryClient.invalidateQueries({ queryKey: ['projects'] });
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !id) return;

    const validExtensions = ['.txt', '.rec', '.txts'];
    const validFiles = Array.from(files).filter((file) => {
      const lower = file.name.toLowerCase();
      return validExtensions.some((ext) => lower.endsWith(ext));
    });

    if (validFiles.length === 0) {
      toast({
        title: 'Nenhum arquivo válido',
        description: 'Selecione arquivos SPED com extensão .txt, .rec ou .txts',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress({ current: 0, total: validFiles.length, failed: 0 });

    // Signal upload in progress to other users
    await supabase.from('projects').update({
      analysis_parameters: { ...(project?.analysis_parameters as object || {}), active_uploading: true },
    }).eq('id', id!);

    const BATCH_SIZE = 5;
    let uploaded = 0;
    let failed = 0;
    const failedFiles: string[] = [];

    for (let i = 0; i < validFiles.length; i += BATCH_SIZE) {
      const batch = validFiles.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((file) => uploadDocument.mutateAsync({ projectId: id, file }))
      );

      results.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          uploaded++;
        } else {
          failed++;
          failedFiles.push(batch[idx].name);
        }
      });

      setUploadProgress({ current: uploaded + failed, total: validFiles.length, failed });

      if (i + BATCH_SIZE < validFiles.length) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    if (failed > 0) {
      toast({
        title: `Upload concluído com ${failed} erro(s)`,
        description: `${uploaded} de ${validFiles.length} arquivo(s) enviados. Falhas: ${failedFiles.slice(0, 5).join(', ')}${failedFiles.length > 5 ? '...' : ''}`,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Upload concluído',
        description: `${uploaded} arquivo(s) enviado(s) com sucesso.`,
      });
    }

    // Clear upload flag from DB - fetch fresh params to avoid stale data
    const { data: freshProject } = await supabase.from('projects').select('analysis_parameters').eq('id', id!).single();
    const freshParams = (freshProject?.analysis_parameters as Record<string, any>) || {};
    const { active_uploading: _removed, ...restParams } = freshParams;
    await supabase.from('projects').update({ analysis_parameters: restParams }).eq('id', id!);

    // Force immediate refetch for all listeners
    queryClient.refetchQueries({ queryKey: ['projects', 'detail', id] });

    setIsUploading(false);
    setUploadProgress({ current: 0, total: 0, failed: 0 });
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (folderInputRef.current) folderInputRef.current.value = '';
  };

  const handleDeleteDocument = async () => {
    if (documentToDelete) {
      await deleteDocument.mutateAsync(documentToDelete);
      setDocumentToDelete(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'indexed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'processed':
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
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

  const getStageIcon = (stage: ProcessingStage) => {
    switch (stage) {
      case 'uploading':
        return <Upload className="h-4 w-4" />;
      case 'chunking':
        return <Cog className="h-4 w-4" />;
      case 'embedding':
        return <Sparkles className="h-4 w-4" />;
      case 'storing':
        return <Layers className="h-4 w-4" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
    }
  };

  const canGenerateSummary = project?.status === 'pronto_para_sumario' || project?.status === 'sumario_gerado';

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!project) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold">Projeto não encontrado</h2>
          <Button asChild className="mt-4">
            <Link to="/projects">Voltar para Projetos</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  const processingPercent = processingStatus?.progress ?? 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/projects')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
                <Badge className={getStatusColor(project.status)}>
                  {PROJECT_STATUS_LABELS[project.status]}
                </Badge>
              </div>
              <Link
                to={`/clients/${project.client_id}`}
                className="text-muted-foreground hover:underline"
              >
                {(project.client as { name: string })?.name}
              </Link>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to={`/projects/${project.id}/edit`}>
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

        {/* Processing Pipeline — Unified */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Pipeline de Processamento
            </CardTitle>
            <CardDescription>
              Envie documentos e processe tudo de uma vez (chunking + embeddings)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Step 1: Process Documents (Unified chunking + embedding) */}
            <div className="flex items-center gap-4 rounded-lg border p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                1
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Processar Documentos</p>
                    <p className="text-sm text-muted-foreground">
                      Chunking + geração de embeddings via backend Python
                    </p>
                  </div>
                  {(() => {
                    const hasNewDocs = documents.some(d => d.processing_status === 'uploaded' || d.processing_status === 'error');
                    const allProcessed = documents.length > 0 && !hasNewDocs;
                    return allProcessed && !isProcessing ? (
                      <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                        <CheckCircle className="h-4 w-4" /> Documentos processados
                      </span>
                    ) : (
                      <Button
                        onClick={handleProcessDocuments}
                        disabled={documents.length === 0 || !hasNewDocs || isProcessing || isUploading || isRemoteUploading || isGeneratingSummary}
                        variant="secondary"
                        size="sm"
                      >
                        {isProcessing ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : isRemoteUploading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Cog className="mr-2 h-4 w-4" />
                        )}
                        {isProcessing ? 'Processando...' : isRemoteUploading ? 'Aguardando upload...' : 'Processar Documentos'}
                      </Button>
                    );
                  })()}
                </div>

                {isProcessing && processingStatus && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {getStageIcon(processingStatus.stage)}
                      <span>{STAGE_LABELS[processingStatus.stage] ?? 'Processando...'}</span>
                    </div>
                    <div className="flex items-center justify-end text-sm">
                      <span className="font-medium">{processingPercent}%</span>
                    </div>
                    <Progress value={processingPercent} />
                    <p className="text-xs text-muted-foreground">
                      Processamento em background — pode fechar esta página.
                    </p>
                  </div>
                )}

                {isProcessing && !processingStatus && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Iniciando processamento...</span>
                    </div>
                    <Progress className="animate-pulse" value={0} />
                  </div>
                )}
              </div>
            </div>

            {/* Step 2: Summary */}
            <div className="flex items-center gap-4 rounded-lg border p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                2
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Geração de Sumário</p>
                    <p className="text-sm text-muted-foreground">
                      Gera sumário estruturado via IA com base nos dados
                    </p>
                  </div>
                   <Button
                    onClick={handleGenerateSummaryClick}
                    disabled={!canGenerateSummary || isProcessing || showSummaryProgress}
                    size="sm"
                  >
                    {showSummaryProgress ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Gerar Sumário
                  </Button>
                </div>
                {hasEnrichmentData && (
                  <div className="flex items-center gap-3 mt-2">
                    {enrichmentIndexed ? (
                      <span className="inline-flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                        <CheckCircle className="h-4 w-4" />
                        Enriquecimento já indexado na RAG
                      </span>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleIndexEnrichment}
                        disabled={isIndexingEnrichment}
                      >
                        {isIndexingEnrichment ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Layers className="mr-2 h-4 w-4" />
                        )}
                        Indexar enriquecimento na RAG
                      </Button>
                    )}
                  </div>
                )}
                {showSummaryProgress && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Gerando sumário…
                      </span>
                    </div>
                    <Progress className="animate-pulse" value={60} />
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status Info */}
        {!canGenerateSummary && project.status !== 'sumario_gerado' && (
          <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                {project.status === 'sem_documentos' && 'Envie documentos SPED para este projeto.'}
                {project.status === 'documentos_enviados' && 'Processe os documentos (Etapa 1).'}
                {project.status === 'documentos_processados' && 'Processe os documentos para gerar embeddings (Etapa 1).'}
              </p>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Documents */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Documentos SPED</CardTitle>
                <CardDescription>
                  {documents.length} documento(s) enviado(s)
                </CardDescription>
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.TXT,.rec,.REC,.txts,.TXTS"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <input
                  ref={folderInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  className="hidden"
                  // @ts-ignore
                  webkitdirectory="true"
                  directory="true"
                  mozdirectory="true"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => folderInputRef.current?.click()}
                    disabled={isUploading || isRemoteUploading}
                  >
                    {isUploading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FolderUp className="mr-2 h-4 w-4" />
                    )}
                    Enviar Pasta
                  </Button>
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading || isRemoteUploading}
                  >
                    {isUploading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    Enviar Arquivos
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isUploading && uploadProgress.total > 0 && (
                <div className="mb-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Enviando {uploadProgress.current} de {uploadProgress.total} arquivos...
                    </span>
                    <span className="font-medium">
                      {Math.round((uploadProgress.current / uploadProgress.total) * 100)}%
                    </span>
                  </div>
                  <Progress value={(uploadProgress.current / uploadProgress.total) * 100} />
                  {uploadProgress.failed > 0 && (
                    <p className="text-xs text-destructive">
                      {uploadProgress.failed} arquivo(s) falharam
                    </p>
                  )}
                </div>
              )}
              {isRemoteUploading && (
                <div className="mb-4 space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-foreground font-medium">
                      Um usuário está enviando documentos para este projeto...
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Os documentos aparecerão automaticamente na lista abaixo.
                  </p>
                </div>
              )}
              {loadingDocs ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
                  <h3 className="font-medium">Nenhum documento ainda</h3>
                  <p className="text-sm text-muted-foreground">
                    Envie arquivos SPED (.txt, .rec ou .txts) para começar
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tamanho</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            {doc.original_name}
                          </div>
                        </TableCell>
                        <TableCell>
                          {doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(doc.processing_status)}
                            <span className="text-sm">
                              {DOCUMENT_STATUS_LABELS[doc.processing_status]}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(new Date(doc.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDocumentToDelete(doc)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Summaries & Info */}
          <div className="space-y-6">
            {/* Project Info */}
            <Card>
              <CardHeader>
                <CardTitle>Informações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {project.description && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Descrição</p>
                    <p className="text-sm">{project.description}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Criado em</p>
                  <p className="text-sm">
                    {format(new Date(project.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Summaries */}
            <Card>
              <CardHeader>
                <CardTitle>Sumários</CardTitle>
                <CardDescription>
                  {summaries.length} sumário(s) gerado(s)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingSummaries ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : summaries.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum sumário gerado ainda
                  </p>
                ) : (
                  <div className="space-y-2">
                    {summaries.map((summary) => (
                      <div
                        key={summary.id}
                        className="flex items-center justify-between rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => navigate(`/projects/${id}/summaries/${summary.id}`)}
                      >
                        <div>
                          <p className="text-sm font-medium">Versão {summary.version}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(summary.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Delete Project Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={(open) => { if (!isDeleting) setShowDeleteDialog(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isDeleting ? 'Excluindo projeto...' : 'Excluir projeto?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isDeleting ? (
                <div className="flex flex-col items-center gap-4 py-4">
                  <Loader2 className="h-8 w-8 animate-spin text-destructive" />
                  <div className="text-center space-y-1">
                    <p className="font-medium text-foreground">Removendo dados do projeto "{project.name}"</p>
                    <p className="text-sm text-muted-foreground">
                      Excluindo documentos, sumários e arquivos do storage.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  Tem certeza que deseja excluir o projeto "{project.name}"?
                  Esta ação não pode ser desfeita e removerá todos os documentos, sumários e arquivos associados.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {!isDeleting && (
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          )}
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Document Confirmation */}
      <AlertDialog open={!!documentToDelete} onOpenChange={() => setDocumentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{documentToDelete?.original_name}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDocument}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Template Selection Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Selecionar Template de Prompt</DialogTitle>
            <DialogDescription>
              Escolha um template para gerar o sumário. Pré-visualize o conteúdo antes de confirmar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 px-1 flex-1 overflow-hidden">
            <div className="space-y-2">
              <Label>Template</Label>
              <Select value={selectedTemplateId ?? ''} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Modelo LLM</Label>
              <Select value={selectedModel} onValueChange={(v) => setSelectedModel(v as 'gpt-4.1-nano' | 'gpt-4.1-mini' | 'gpt-4.1')}>

                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4.1-nano">GPT-4.1 Nano (ultra rápido e econômico)</SelectItem>
                  <SelectItem value="gpt-4.1-mini">GPT-4.1 Mini (mais rápido e barato)</SelectItem>
                  <SelectItem value="gpt-4.1">GPT-4.1 (mais preciso)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {selectedTemplateId && (() => {
              const selected = templates.find(t => t.id === selectedTemplateId);
              if (!selected) return null;
              return (
                <div className="space-y-2">
                  <Label>Pré-visualização</Label>
                  {selected.description && (
                    <p className="text-sm text-muted-foreground">{selected.description}</p>
                  )}
                  <div className="rounded-md border bg-muted/50 p-4 max-h-[300px] overflow-y-auto">
                    <pre className="text-sm whitespace-pre-wrap font-mono">{selected.content}</pre>
                  </div>
                </div>
              );
            })()}
            {templates.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhum template cadastrado.{' '}
                <Link to="/templates" className="text-primary underline">
                  Criar template
                </Link>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleTemplateConfirm} disabled={!selectedTemplateId}>
              <Sparkles className="mr-2 h-4 w-4" />
              Gerar Sumário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
