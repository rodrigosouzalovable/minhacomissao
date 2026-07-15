import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MetaInstancePagamento = {
  id: string;
  instance_id: string;
  user_id: string;
  valor_usd: number;
  valor_brl: number | null;
  numero_referencia: string;
  data_transacao: string;
  criado_em: string;
};

export function useMetaInstancePagamentos() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["meta-instance-pagamentos"],
    staleTime: 60_000,
    queryFn: async (): Promise<MetaInstancePagamento[]> => {
      const { data, error } = await (supabase as any)
        .from("meta_instance_pagamentos")
        .select("*")
        .order("data_transacao", { ascending: false });
      if (error) throw error;
      return (data || []) as MetaInstancePagamento[];
    },
  });

  const inserir = useMutation({
    mutationFn: async (row: {
      instance_id: string;
      valor_usd: number;
      numero_referencia: string;
      data_transacao: string;
      valor_brl?: number | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { error } = await (supabase as any)
        .from("meta_instance_pagamentos")
        .insert({ ...row, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meta-instance-pagamentos"] }),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("meta_instance_pagamentos")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meta-instance-pagamentos"] }),
  });

  const pagamentos = query.data || [];
  const totalUsd = pagamentos.reduce((s, p) => s + Number(p.valor_usd || 0), 0);
  const totalBrl = pagamentos.reduce((s, p) => s + Number(p.valor_brl || 0), 0);

  const porInstancia = (instanceId: string) =>
    pagamentos.filter((p) => p.instance_id === instanceId);

  const totalPorInstancia = (instanceId: string) =>
    porInstancia(instanceId).reduce((s, p) => s + Number(p.valor_usd || 0), 0);

  return {
    pagamentos,
    totalUsd,
    totalBrl,
    porInstancia,
    totalPorInstancia,
    inserir,
    remover,
    isLoading: query.isLoading,
  };
}
