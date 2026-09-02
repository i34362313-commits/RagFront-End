export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      backend_jobs: {
        Row: {
          created_at: string
          error: string | null
          id: string
          kind: string
          progress: number
          project_id: string | null
          result: Json | null
          stage: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id: string
          kind: string
          progress?: number
          project_id?: string | null
          result?: Json | null
          stage?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          progress?: number
          project_id?: string | null
          result?: Json | null
          stage?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_enriched_data: {
        Row: {
          client_id: string
          cnpj: string
          created_at: string
          error_message: string | null
          id: string
          raw_data: Json | null
          status: Database["public"]["Enums"]["enrichment_status"]
          updated_at: string
        }
        Insert: {
          client_id: string
          cnpj: string
          created_at?: string
          error_message?: string | null
          id?: string
          raw_data?: Json | null
          status?: Database["public"]["Enums"]["enrichment_status"]
          updated_at?: string
        }
        Update: {
          client_id?: string
          cnpj?: string
          created_at?: string
          error_message?: string | null
          id?: string
          raw_data?: Json | null
          status?: Database["public"]["Enums"]["enrichment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_enriched_data_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          cnpj: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          enriched_data: Json | null
          file_size: number | null
          file_type: string
          id: string
          metadata: Json | null
          original_name: string
          processing_status: Database["public"]["Enums"]["document_processing_status"]
          project_id: string
          storage_path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enriched_data?: Json | null
          file_size?: number | null
          file_type?: string
          id?: string
          metadata?: Json | null
          original_name: string
          processing_status?: Database["public"]["Enums"]["document_processing_status"]
          project_id: string
          storage_path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enriched_data?: Json | null
          file_size?: number | null
          file_type?: string
          id?: string
          metadata?: Json | null
          original_name?: string
          processing_status?: Database["public"]["Enums"]["document_processing_status"]
          project_id?: string
          storage_path?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      export_history: {
        Row: {
          client_id: string
          exported_at: string
          file_name: string
          file_size: number | null
          id: string
          project_id: string
          storage_path: string
          summary_id: string
          user_id: string
        }
        Insert: {
          client_id: string
          exported_at?: string
          file_name: string
          file_size?: number | null
          id?: string
          project_id: string
          storage_path: string
          summary_id: string
          user_id: string
        }
        Update: {
          client_id?: string
          exported_at?: string
          file_name?: string
          file_size?: number | null
          id?: string
          project_id?: string
          storage_path?: string
          summary_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "export_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "export_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "export_history_summary_id_fkey"
            columns: ["summary_id"]
            isOneToOne: false
            referencedRelation: "summaries"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          analysis_parameters: Json | null
          client_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          prompt_template_id: string | null
          status: Database["public"]["Enums"]["project_status"]
          storage_folder_path: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis_parameters?: Json | null
          client_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          prompt_template_id?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          storage_folder_path?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis_parameters?: Json | null
          client_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          prompt_template_id?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          storage_folder_path?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_projects_prompt_template"
            columns: ["prompt_template_id"]
            isOneToOne: false
            referencedRelation: "prompt_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_templates: {
        Row: {
          content: string
          created_at: string
          description: string | null
          id: string
          is_default: boolean | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      summaries: {
        Row: {
          calculations: Json | null
          content: Json
          created_at: string
          data_crossings: Json | null
          generation_time_ms: number | null
          id: string
          insights: string[] | null
          justifications: string[] | null
          model_used: string | null
          project_id: string
          prompt_used: string | null
          source_references: Json | null
          tokens_used: number | null
          user_id: string
          version: number
        }
        Insert: {
          calculations?: Json | null
          content: Json
          created_at?: string
          data_crossings?: Json | null
          generation_time_ms?: number | null
          id?: string
          insights?: string[] | null
          justifications?: string[] | null
          model_used?: string | null
          project_id: string
          prompt_used?: string | null
          source_references?: Json | null
          tokens_used?: number | null
          user_id: string
          version?: number
        }
        Update: {
          calculations?: Json | null
          content?: Json
          created_at?: string
          data_crossings?: Json | null
          generation_time_ms?: number | null
          id?: string
          insights?: string[] | null
          justifications?: string[] | null
          model_used?: string | null
          project_id?: string
          prompt_used?: string | null
          source_references?: Json | null
          tokens_used?: number | null
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "summaries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_project_cascade: {
        Args: { p_project_id: string; p_user_id: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "gerente"
      document_processing_status:
        | "uploaded"
        | "processing"
        | "processed"
        | "indexed"
        | "error"
      enrichment_status: "pending" | "success" | "error"
      project_status:
        | "sem_documentos"
        | "documentos_enviados"
        | "documentos_processados"
        | "pronto_para_sumario"
        | "sumario_gerado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "gerente"],
      document_processing_status: [
        "uploaded",
        "processing",
        "processed",
        "indexed",
        "error",
      ],
      enrichment_status: ["pending", "success", "error"],
      project_status: [
        "sem_documentos",
        "documentos_enviados",
        "documentos_processados",
        "pronto_para_sumario",
        "sumario_gerado",
      ],
    },
  },
} as const
