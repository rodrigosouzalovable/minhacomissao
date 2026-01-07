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
      acordos: {
        Row: {
          atualizado_em: string
          boleto_enviado: boolean
          cliente_cpf: string | null
          cliente_nome: string
          cliente_telefone: string | null
          comissao_total: number
          criado_em: string
          data_primeiro_pagamento: string
          dias_atraso: number
          id: string
          observacoes: string | null
          parcelas: number
          percentual_comissao: number
          status: string
          user_id: string
          valor_parcela: number
          valor_total: number
        }
        Insert: {
          atualizado_em?: string
          boleto_enviado?: boolean
          cliente_cpf?: string | null
          cliente_nome: string
          cliente_telefone?: string | null
          comissao_total: number
          criado_em?: string
          data_primeiro_pagamento: string
          dias_atraso: number
          id?: string
          observacoes?: string | null
          parcelas: number
          percentual_comissao: number
          status?: string
          user_id: string
          valor_parcela: number
          valor_total: number
        }
        Update: {
          atualizado_em?: string
          boleto_enviado?: boolean
          cliente_cpf?: string | null
          cliente_nome?: string
          cliente_telefone?: string | null
          comissao_total?: number
          criado_em?: string
          data_primeiro_pagamento?: string
          dias_atraso?: number
          id?: string
          observacoes?: string | null
          parcelas?: number
          percentual_comissao?: number
          status?: string
          user_id?: string
          valor_parcela?: number
          valor_total?: number
        }
        Relationships: []
      }
      lembretes_lidos: {
        Row: {
          criado_em: string
          id: string
          pagamento_id: string
          user_id: string
        }
        Insert: {
          criado_em?: string
          id?: string
          pagamento_id: string
          user_id: string
        }
        Update: {
          criado_em?: string
          id?: string
          pagamento_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lembretes_lidos_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "pagamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos: {
        Row: {
          acordo_id: string
          comissao_parcela: number
          criado_em: string
          data_paga: string | null
          data_prevista: string
          id: string
          numero_parcela: number
          status: string
          valor_parcela: number
        }
        Insert: {
          acordo_id: string
          comissao_parcela: number
          criado_em?: string
          data_paga?: string | null
          data_prevista: string
          id?: string
          numero_parcela: number
          status?: string
          valor_parcela: number
        }
        Update: {
          acordo_id?: string
          comissao_parcela?: number
          criado_em?: string
          data_paga?: string | null
          data_prevista?: string
          id?: string
          numero_parcela?: number
          status?: string
          valor_parcela?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_acordo_id_fkey"
            columns: ["acordo_id"]
            isOneToOne: false
            referencedRelation: "acordos"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          atualizado_em: string
          criado_em: string
          email: string
          id: string
          nome: string
          whatsapp_lembretes_habilitado: boolean
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          email: string
          id: string
          nome: string
          whatsapp_lembretes_habilitado?: boolean
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          email?: string
          id?: string
          nome?: string
          whatsapp_lembretes_habilitado?: boolean
        }
        Relationships: []
      }
      retornos: {
        Row: {
          atualizado_em: string
          cliente_cpf: string
          cliente_nome: string
          cliente_telefone: string
          criado_em: string
          data_primeiro_pagamento: string | null
          data_retorno: string
          id: string
          numero_parcelas: number | null
          observacao: string | null
          status: string
          user_id: string
          valor_demais_parcelas: number | null
          valor_primeira_parcela: number | null
          valor_total: number | null
        }
        Insert: {
          atualizado_em?: string
          cliente_cpf: string
          cliente_nome: string
          cliente_telefone: string
          criado_em?: string
          data_primeiro_pagamento?: string | null
          data_retorno: string
          id?: string
          numero_parcelas?: number | null
          observacao?: string | null
          status?: string
          user_id: string
          valor_demais_parcelas?: number | null
          valor_primeira_parcela?: number | null
          valor_total?: number | null
        }
        Update: {
          atualizado_em?: string
          cliente_cpf?: string
          cliente_nome?: string
          cliente_telefone?: string
          criado_em?: string
          data_primeiro_pagamento?: string | null
          data_retorno?: string
          id?: string
          numero_parcelas?: number | null
          observacao?: string | null
          status?: string
          user_id?: string
          valor_demais_parcelas?: number | null
          valor_primeira_parcela?: number | null
          valor_total?: number | null
        }
        Relationships: []
      }
      team_members: {
        Row: {
          criado_em: string
          funcionario_id: string
          gestor_id: string
          id: string
        }
        Insert: {
          criado_em?: string
          funcionario_id: string
          gestor_id: string
          id?: string
        }
        Update: {
          criado_em?: string
          funcionario_id?: string
          gestor_id?: string
          id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          criado_em: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          criado_em?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          criado_em?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_fila: {
        Row: {
          agendado_para: string
          criado_em: string | null
          enviado_em: string | null
          erro_mensagem: string | null
          id: string
          mensagem: string
          pagamento_id: string
          status: string | null
          telefone: string
          tipo_lembrete: string
        }
        Insert: {
          agendado_para: string
          criado_em?: string | null
          enviado_em?: string | null
          erro_mensagem?: string | null
          id?: string
          mensagem: string
          pagamento_id: string
          status?: string | null
          telefone: string
          tipo_lembrete: string
        }
        Update: {
          agendado_para?: string
          criado_em?: string | null
          enviado_em?: string | null
          erro_mensagem?: string | null
          id?: string
          mensagem?: string
          pagamento_id?: string
          status?: string | null
          telefone?: string
          tipo_lembrete?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_fila_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "pagamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_lembretes_log: {
        Row: {
          enviado_em: string | null
          erro_mensagem: string | null
          id: string
          pagamento_id: string
          sucesso: boolean | null
          tipo_lembrete: string
        }
        Insert: {
          enviado_em?: string | null
          erro_mensagem?: string | null
          id?: string
          pagamento_id: string
          sucesso?: boolean | null
          tipo_lembrete: string
        }
        Update: {
          enviado_em?: string | null
          erro_mensagem?: string | null
          id?: string
          pagamento_id?: string
          sucesso?: boolean | null
          tipo_lembrete?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_lembretes_log_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "pagamentos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "funcionario" | "gestor" | "admin"
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
      app_role: ["funcionario", "gestor", "admin"],
    },
  },
} as const
