// All requests go through the Supabase Edge Function proxy
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://fhcscsczogemcbhkardz.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const PROXY_BASE = `${SUPABASE_URL}/functions/v1/python-backend-proxy`;

export type ProcessingStage = 'uploading' | 'chunking' | 'embedding' | 'storing' | 'completed';

export interface ProcessingStatus {
  status: string;
  stage: ProcessingStage;
  progress: number;
  total_files: number;
  processed_files: number;
  total_chunks: number;
  processed_chunks: number;
}

export interface UploadResponse {
  job_id: string;
}

export interface SearchResult {
  chunk_text: string;
  document_id: string;
  similarity: number;
}

function proxyUrl(path: string, extraParams?: Record<string, string>): string {
  const params = new URLSearchParams({ path });
  if (extraParams) {
    for (const [k, v] of Object.entries(extraParams)) {
      params.set(k, v);
    }
  }
  return `${PROXY_BASE}?${params.toString()}`;
}

function authHeaders(): Record<string, string> {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };
}

export async function uploadDocuments(files: File[], projectId: string): Promise<UploadResponse> {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));

  const res = await fetch(proxyUrl('/upload', { project_id: projectId }), {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Upload failed: ${err}`);
  }

  return res.json();
}

// ⚡ Nova rota: envia só os paths do Storage; o backend baixa direto via service_role.
// Evita: (1) download sequencial no browser, (2) upload de 185MB pelo proxy.
export async function processStoragePaths(paths: string[], projectId: string): Promise<UploadResponse> {
  const res = await fetch(proxyUrl('/process-paths'), {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_id: projectId, paths }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Process-paths failed: ${err}`);
  }

  return res.json();
}

export async function getProcessingStatus(jobId: string): Promise<ProcessingStatus | null> {
  const res = await fetch(proxyUrl(`/status/${jobId}`), {
    headers: authHeaders(),
  });

  if (res.status === 404) {
    console.log('Job não existe mais, retornando null');
    return null;
  }

  // Backend (Render) pode estar hibernando/reiniciando — tratar como "ainda processando"
  if (res.status === 502 || res.status === 503 || res.status === 504) {
    console.warn(`Backend indisponível (${res.status}), aguardando próximo poll...`);
    return null;
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Status check failed: ${err}`);
  }

  return res.json();
}

export async function semanticSearch(query: string, projectId: string, k: number = 5): Promise<SearchResult[]> {
  const res = await fetch(proxyUrl('/search', { project_id: projectId, query, k: String(k) }), {
    method: 'POST',
    headers: authHeaders(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Search failed: ${err}`);
  }

  return res.json();
}

export interface GenerateSummaryRequest {
  project_id: string;
  template: string;
  query?: string;
  enrichment?: Record<string, unknown>;
  k?: number;
  model?: string;
}

// O backend python pode retornar uma string crua do LLM OU um objeto estruturado
export type GenerateSummaryResponse =
  | string
  | {
      summary?: {
        insights?: string[];
        inconsistencies?: string[];
        opportunities?: string[];
        analyses?: string[];
        references?: Array<{ source: string; chunk_index?: number; text?: string }>;
        [key: string]: unknown;
      } | string;
      sources_used?: number;
      model?: string;
      tokens_used?: number;
      generation_time_ms?: number;
      [key: string]: unknown;
    };

export interface SummaryJobStartResponse {
  job_id: string;
  status: string;
}

export type SummaryJobStage =
  | 'created'
  | 'retrieving_context'
  | 'building_prompt'
  | 'llm_call'
  | 'multi_step_rag'
  | 'final_llm'
  | 'done';

export interface SummaryJobStatus {
  status: 'pending' | 'processing' | 'completed' | 'error';
  stage?: SummaryJobStage;
  mode?: 'audit' | 'strategic';
  result?: GenerateSummaryResponse;
  error?: string;
}

export async function startGenerateSummary(params: GenerateSummaryRequest): Promise<SummaryJobStartResponse> {
  const res = await fetch(proxyUrl('/generate-summary'), {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Summary generation failed: ${err}`);
  }

  return res.json();
}

export async function getSummaryStatus(jobId: string): Promise<SummaryJobStatus> {
  const res = await fetch(proxyUrl(`/summary-status/${jobId}`), {
    headers: authHeaders(),
  });

  // Backend hibernando/reiniciando — tratar como "ainda processando"
  if (res.status === 502 || res.status === 503 || res.status === 504) {
    console.warn(`Backend indisponível (${res.status}) ao checar summary, aguardando próximo poll...`);
    return { status: 'processing' };
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Summary status check failed: ${err}`);
  }

  return res.json();
}

export interface GenerateSummaryOptions {
  intervalMs?: number;
  onProgress?: (status: SummaryJobStatus) => void;
}

export async function generateSummary(
  params: GenerateSummaryRequest,
  options: GenerateSummaryOptions = {}
): Promise<GenerateSummaryResponse> {
  const intervalMs = options.intervalMs ?? 5000;

  const { job_id } = await startGenerateSummary(params);

  while (true) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));

    const status = await getSummaryStatus(job_id);
    console.info('Summary job status', { job_id, status: status.status, stage: status.stage, mode: status.mode });
    options.onProgress?.(status);

    if (status.status === 'completed') {
      if (!status.result) {
        throw new Error('Job concluído sem resultado');
      }
      return status.result;
    }

    if (status.status === 'error') {
      throw new Error(status.error || 'Erro desconhecido na geração do sumário');
    }
  }
}

export async function indexEnrichment(
  projectId: string,
  enrichment: Record<string, unknown>
): Promise<{ status: string; chunks?: number; message?: string }> {
  const res = await fetch(proxyUrl('/enrichment'), {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_id: projectId, enrichment }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Falha ao indexar enriquecimento: ${err}`);
  }

  return res.json();
}

export async function deleteProjectData(projectId: string, folderPath?: string): Promise<{ status: string; message: string }> {
  const params: Record<string, string> = {};
  if (folderPath) {
    params.folder_path = folderPath;
  }
  const res = await fetch(proxyUrl(`/delete-project/${encodeURIComponent(projectId)}`, params), {
    method: 'DELETE',
    headers: authHeaders(),
  });

  if (res.status === 404) {
    return { status: 'success', message: 'Projeto não encontrado no backend (já removido)' };
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Erro ao deletar projeto no backend: ${err}`);
  }

  return res.json();
}

export const STAGE_LABELS: Record<ProcessingStage, string> = {
  uploading: 'Enviando arquivos',
  chunking: 'Dividindo em chunks',
  embedding: 'Gerando embeddings',
  storing: 'Armazenando vetores',
  completed: 'Concluído',
};
