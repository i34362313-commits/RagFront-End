// Database types for SPED Management System

export type ProjectStatus = 
  | 'sem_documentos'
  | 'documentos_enviados'
  | 'documentos_processados'
  | 'pronto_para_sumario'
  | 'sumario_gerado';

export type DocumentProcessingStatus = 
  | 'uploaded'
  | 'processing'
  | 'processed'
  | 'indexed'
  | 'error';

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  user_id: string;
  name: string;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  client_id: string;
  user_id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  prompt_template_id: string | null;
  analysis_parameters: Record<string, unknown>;
  storage_folder_path: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  client?: Client;
  prompt_template?: PromptTemplate;
  documents?: Document[];
  summaries?: Summary[];
}

export interface PromptTemplate {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  content: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  project_id: string;
  user_id: string;
  original_name: string;
  file_type: string;
  file_size: number | null;
  storage_path: string;
  processing_status: DocumentProcessingStatus;
  metadata: Record<string, unknown>;
  enriched_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Summary {
  id: string;
  project_id: string;
  user_id: string;
  version: number;
  content: Record<string, unknown>;
  insights: string[] | null;
  calculations: Record<string, unknown> | null;
  data_crossings: Record<string, unknown> | null;
  justifications: string[] | null;
  source_references: Record<string, unknown> | null;
  prompt_used: string | null;
  model_used: string;
  tokens_used: number | null;
  generation_time_ms: number | null;
  created_at: string;
}

export interface ExportHistory {
  id: string;
  summary_id: string;
  project_id: string;
  user_id: string;
  client_id: string;
  file_name: string;
  storage_path: string;
  file_size: number | null;
  exported_at: string;
  // Relations
  summary?: Summary;
  project?: Project;
  client?: Client;
}

// Form types
export interface ClientFormData {
  name: string;
  cnpj: string;
  email: string;
  phone?: string;
  address?: string;
  notes?: string;
}

export interface ProjectFormData {
  client_id: string;
  name: string;
  description?: string;
  prompt_template_id?: string;
  analysis_parameters?: Record<string, unknown>;
}

export interface PromptTemplateFormData {
  name: string;
  description?: string;
  content: string;
  is_default?: boolean;
}

// Status labels for UI
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  sem_documentos: 'Sem Documentos',
  documentos_enviados: 'Documentos Enviados',
  documentos_processados: 'Documentos Processados',
  pronto_para_sumario: 'Pronto para Sumário',
  sumario_gerado: 'Sumário Gerado',
};

export const DOCUMENT_STATUS_LABELS: Record<DocumentProcessingStatus, string> = {
  uploaded: 'Enviado',
  processing: 'Processando',
  processed: 'Processado',
  indexed: 'Indexado',
  error: 'Erro',
};
