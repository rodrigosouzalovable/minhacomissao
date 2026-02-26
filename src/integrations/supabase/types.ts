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
          duplicado_verificado: boolean
          empresa: string
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
          duplicado_verificado?: boolean
          empresa?: string
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
          duplicado_verificado?: boolean
          empresa?: string
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
      auditoria_divergencias: {
        Row: {
          acordo_id: string | null
          arquivo_nome: string
          cpf_planilha: string
          criado_em: string
          data_planilha: string | null
          data_sistema: string | null
          id: string
          nome_planilha: string | null
          nome_sistema: string | null
          pagamento_id: string | null
          parcela_planilha: number | null
          parcela_sistema: number | null
          receita_planilha: number | null
          receita_sistema: number | null
          resolvido: boolean | null
          resolvido_em: string | null
          tipo_divergencia: string
          user_id: string
          valor_planilha: number | null
          valor_sistema: number | null
        }
        Insert: {
          acordo_id?: string | null
          arquivo_nome: string
          cpf_planilha: string
          criado_em?: string
          data_planilha?: string | null
          data_sistema?: string | null
          id?: string
          nome_planilha?: string | null
          nome_sistema?: string | null
          pagamento_id?: string | null
          parcela_planilha?: number | null
          parcela_sistema?: number | null
          receita_planilha?: number | null
          receita_sistema?: number | null
          resolvido?: boolean | null
          resolvido_em?: string | null
          tipo_divergencia: string
          user_id: string
          valor_planilha?: number | null
          valor_sistema?: number | null
        }
        Update: {
          acordo_id?: string | null
          arquivo_nome?: string
          cpf_planilha?: string
          criado_em?: string
          data_planilha?: string | null
          data_sistema?: string | null
          id?: string
          nome_planilha?: string | null
          nome_sistema?: string | null
          pagamento_id?: string | null
          parcela_planilha?: number | null
          parcela_sistema?: number | null
          receita_planilha?: number | null
          receita_sistema?: number | null
          resolvido?: boolean | null
          resolvido_em?: string | null
          tipo_divergencia?: string
          user_id?: string
          valor_planilha?: number | null
          valor_sistema?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_divergencias_acordo_id_fkey"
            columns: ["acordo_id"]
            isOneToOne: false
            referencedRelation: "acordos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auditoria_divergencias_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "pagamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      credor_relatorio_config: {
        Row: {
          ativo: boolean
          credor_slug: string
          criado_em: string
          frequencia: string
          id: string
          telefone: string
          ultimo_envio_mensal: string | null
          ultimo_envio_semanal: string | null
        }
        Insert: {
          ativo?: boolean
          credor_slug: string
          criado_em?: string
          frequencia?: string
          id?: string
          telefone: string
          ultimo_envio_mensal?: string | null
          ultimo_envio_semanal?: string | null
        }
        Update: {
          ativo?: boolean
          credor_slug?: string
          criado_em?: string
          frequencia?: string
          id?: string
          telefone?: string
          ultimo_envio_mensal?: string | null
          ultimo_envio_semanal?: string | null
        }
        Relationships: []
      }
      credor_tokens: {
        Row: {
          ativo: boolean
          credor_slug: string
          criado_em: string
          id: string
          token: string
        }
        Insert: {
          ativo?: boolean
          credor_slug: string
          criado_em?: string
          id?: string
          token: string
        }
        Update: {
          ativo?: boolean
          credor_slug?: string
          criado_em?: string
          id?: string
          token?: string
        }
        Relationships: []
      }
      devedor_eventos: {
        Row: {
          arquivo_nome: string | null
          arquivo_url: string | null
          criado_em: string
          criado_por: string
          descricao: string
          devedor_id: string
          id: string
          tipo: string
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          criado_em?: string
          criado_por: string
          descricao?: string
          devedor_id: string
          id?: string
          tipo: string
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          criado_em?: string
          criado_por?: string
          descricao?: string
          devedor_id?: string
          id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "devedor_eventos_devedor_id_fkey"
            columns: ["devedor_id"]
            isOneToOne: false
            referencedRelation: "devedores"
            referencedColumns: ["id"]
          },
        ]
      }
      devedor_telefones: {
        Row: {
          ativo: boolean | null
          autorizado: boolean | null
          criado_em: string | null
          criado_por: string
          devedor_cpf: string
          id: string
          is_contato: boolean | null
          is_whatsapp: boolean | null
          numero: string
          observacao: string | null
          ramal: string | null
          tipo: string
        }
        Insert: {
          ativo?: boolean | null
          autorizado?: boolean | null
          criado_em?: string | null
          criado_por: string
          devedor_cpf: string
          id?: string
          is_contato?: boolean | null
          is_whatsapp?: boolean | null
          numero: string
          observacao?: string | null
          ramal?: string | null
          tipo?: string
        }
        Update: {
          ativo?: boolean | null
          autorizado?: boolean | null
          criado_em?: string | null
          criado_por?: string
          devedor_cpf?: string
          id?: string
          is_contato?: boolean | null
          is_whatsapp?: boolean | null
          numero?: string
          observacao?: string | null
          ramal?: string | null
          tipo?: string
        }
        Relationships: []
      }
      devedores: {
        Row: {
          arquivo_importacao: string | null
          ativo: boolean
          atualizado_em: string
          contrato: string | null
          cpf: string
          credor: string | null
          criado_em: string
          data_vencimento: string | null
          descricao: string | null
          estagio: string
          id: string
          importacao_id: string | null
          importado_por: string | null
          nome: string
          telefone: string | null
          valor_atualizado: number
          valor_original: number
        }
        Insert: {
          arquivo_importacao?: string | null
          ativo?: boolean
          atualizado_em?: string
          contrato?: string | null
          cpf: string
          credor?: string | null
          criado_em?: string
          data_vencimento?: string | null
          descricao?: string | null
          estagio?: string
          id?: string
          importacao_id?: string | null
          importado_por?: string | null
          nome: string
          telefone?: string | null
          valor_atualizado?: number
          valor_original?: number
        }
        Update: {
          arquivo_importacao?: string | null
          ativo?: boolean
          atualizado_em?: string
          contrato?: string | null
          cpf?: string
          credor?: string | null
          criado_em?: string
          data_vencimento?: string | null
          descricao?: string | null
          estagio?: string
          id?: string
          importacao_id?: string | null
          importado_por?: string | null
          nome?: string
          telefone?: string | null
          valor_atualizado?: number
          valor_original?: number
        }
        Relationships: [
          {
            foreignKeyName: "devedores_importacao_id_fkey"
            columns: ["importacao_id"]
            isOneToOne: false
            referencedRelation: "importacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      gastos_empresa: {
        Row: {
          categoria: string
          criado_em: string
          data_referencia: string
          descricao: string | null
          id: string
          recorrente: boolean
          user_id: string
          valor: number
        }
        Insert: {
          categoria: string
          criado_em?: string
          data_referencia: string
          descricao?: string | null
          id?: string
          recorrente?: boolean
          user_id: string
          valor?: number
        }
        Update: {
          categoria?: string
          criado_em?: string
          data_referencia?: string
          descricao?: string | null
          id?: string
          recorrente?: boolean
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
      gastos_funcionarios: {
        Row: {
          categoria: string
          criado_em: string
          data_referencia: string
          descricao: string | null
          funcionario_id: string
          id: string
          recorrente: boolean
          user_id: string
          valor: number
        }
        Insert: {
          categoria: string
          criado_em?: string
          data_referencia: string
          descricao?: string | null
          funcionario_id: string
          id?: string
          recorrente?: boolean
          user_id: string
          valor?: number
        }
        Update: {
          categoria?: string
          criado_em?: string
          data_referencia?: string
          descricao?: string | null
          funcionario_id?: string
          id?: string
          recorrente?: boolean
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "gastos_funcionarios_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      grupo_empresarial_membros: {
        Row: {
          cpf_cnpj: string
          criado_em: string
          criado_por: string
          grupo_id: string
          id: string
          nome_grupo: string
        }
        Insert: {
          cpf_cnpj: string
          criado_em?: string
          criado_por: string
          grupo_id?: string
          id?: string
          nome_grupo: string
        }
        Update: {
          cpf_cnpj?: string
          criado_em?: string
          criado_por?: string
          grupo_id?: string
          id?: string
          nome_grupo?: string
        }
        Relationships: []
      }
      importacoes: {
        Row: {
          credor: string
          criado_em: string
          id: string
          importado_por: string
          nome_arquivo: string
          total_registros: number
        }
        Insert: {
          credor: string
          criado_em?: string
          id?: string
          importado_por: string
          nome_arquivo: string
          total_registros?: number
        }
        Update: {
          credor?: string
          criado_em?: string
          id?: string
          importado_por?: string
          nome_arquivo?: string
          total_registros?: number
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
      metas_mensais: {
        Row: {
          atualizado_em: string | null
          criado_em: string | null
          id: string
          mes_ano: string
          valor: number
        }
        Insert: {
          atualizado_em?: string | null
          criado_em?: string | null
          id?: string
          mes_ano: string
          valor?: number
        }
        Update: {
          atualizado_em?: string | null
          criado_em?: string | null
          id?: string
          mes_ano?: string
          valor?: number
        }
        Relationships: []
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
      receitas_empresa: {
        Row: {
          categoria: string
          criado_em: string
          data_referencia: string
          descricao: string | null
          id: string
          recorrente: boolean
          user_id: string
          valor: number
        }
        Insert: {
          categoria: string
          criado_em?: string
          data_referencia: string
          descricao?: string | null
          id?: string
          recorrente?: boolean
          user_id: string
          valor?: number
        }
        Update: {
          categoria?: string
          criado_em?: string
          data_referencia?: string
          descricao?: string | null
          id?: string
          recorrente?: boolean
          user_id?: string
          valor?: number
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
          whatsapp_enviado_em: string | null
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
          whatsapp_enviado_em?: string | null
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
          whatsapp_enviado_em?: string | null
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
      user_permissions: {
        Row: {
          abas_permitidas: string[]
          atualizado_em: string
          credores: string[]
          criado_em: string
          id: string
          user_id: string
          visivel_ranking: boolean
        }
        Insert: {
          abas_permitidas?: string[]
          atualizado_em?: string
          credores?: string[]
          criado_em?: string
          id?: string
          user_id: string
          visivel_ranking?: boolean
        }
        Update: {
          abas_permitidas?: string[]
          atualizado_em?: string
          credores?: string[]
          criado_em?: string
          id?: string
          user_id?: string
          visivel_ranking?: boolean
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
      user_whatsapp_config: {
        Row: {
          atualizado_em: string | null
          criado_em: string | null
          id: string
          instance_token: string
          provider: string
          server_url: string
          user_id: string
        }
        Insert: {
          atualizado_em?: string | null
          criado_em?: string | null
          id?: string
          instance_token: string
          provider?: string
          server_url: string
          user_id: string
        }
        Update: {
          atualizado_em?: string | null
          criado_em?: string | null
          id?: string
          instance_token?: string
          provider?: string
          server_url?: string
          user_id?: string
        }
        Relationships: []
      }
      user_whatsapp_instances: {
        Row: {
          ativo: boolean
          criado_em: string
          id: string
          instance_token: string
          nome: string | null
          server_url: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          id?: string
          instance_token: string
          nome?: string | null
          server_url: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          id?: string
          instance_token?: string
          nome?: string | null
          server_url?: string
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
      consultar_acordo_ativo_por_cpf: {
        Args: { p_cpf: string }
        Returns: {
          acordo_criado_em: string
          acordo_status: string
          funcionario_nome: string
        }[]
      }
      consultar_debitos_por_cpf: {
        Args: { p_cpf: string }
        Returns: {
          contrato: string
          cpf: string
          data_vencimento: string
          descricao: string
          id: string
          nome: string
          valor_atualizado: number
          valor_original: number
        }[]
      }
      consultar_parcelas_acordo_por_cpf: {
        Args: { p_cpf: string }
        Returns: {
          data_paga: string
          data_prevista: string
          numero_parcela: number
          status: string
          total_parcelas: number
          valor_parcela: number
          valor_total_acordo: number
        }[]
      }
      contar_acordos_hoje: { Args: never; Returns: number }
      contar_acordos_hoje_por_usuario: {
        Args: { p_user_id?: string }
        Returns: number
      }
      cpf_acordo_funcionario_nome: { Args: { p_cpf: string }; Returns: string }
      cpf_has_acordo: { Args: { p_cpf: string }; Returns: boolean }
      cpf_normalize: { Args: { cpf_input: string }; Returns: string }
      cpf_ultimo_acordo_quebrado: { Args: { p_cpf: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_user: { Args: { uid: string }; Returns: boolean }
      listar_funcionarios: {
        Args: never
        Returns: {
          nome: string
          user_id: string
        }[]
      }
      ranking_mensal: {
        Args: { p_mes_ano?: string }
        Returns: {
          nome: string
          total_recebido: number
          user_id: string
        }[]
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
