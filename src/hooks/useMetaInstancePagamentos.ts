import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MetaInstancePagamentoStatus = "aprovado" | "pendente" | "falhou";

export type MetaInstancePagamento = {
  id: string;
  instance_id: string;
  user_id: string;
  valor_usd: number;
  valor_brl: number | null;
  numero_referencia: string;
  data_transacao: string;
  criado_em: string;
  status: MetaInstancePagamentoStatus;
};

const isAprovado = (p: MetaInstancePagamento) => (p.status || "aprovado") === "aprovado";
const isPendente = (p: MetaInstancePagamento) => p.status === "pendente";

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
      return (data || []).map((r: any) => ({
        ...r,
        status: (r.status || "aprovado") as MetaInstancePagamentoStatus,
      })) as MetaInstancePagamento[];
    },
  });

  const inserir = useMutation({
    mutationFn: async (row: {
      instance_id: string;
      valor_usd: number;
      numero_referencia: string;
      data_transacao: string;
      valor_brl?: number | null;
      status?: MetaInstancePagamentoStatus;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const payload = { ...row, user_id: user.id, status: row.status || "aprovado" };
      const { error } = await (supabase as any)
        .from("meta_instance_pagamentos")
        .insert(payload);
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

  const atualizarStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: MetaInstancePagamentoStatus }) => {
      const { error } = await (supabase as any)
        .from("meta_instance_pagamentos")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meta-instance-pagamentos"] }),
  });

  const pagamentos = query.data || [];
  const aprovados = pagamentos.filter(isAprovado);
  const pendentes = pagamentos.filter(isPendente);

  const totalUsd = aprovados.reduce((s, p) => s + Number(p.valor_usd || 0), 0);
  const totalBrl = aprovados.reduce((s, p) => s + Number(p.valor_brl || 0), 0);
  const totalPendenteUsd = pendentes.reduce((s, p) => s + Number(p.valor_usd || 0), 0);

  const porInstancia = (instanceId: string) =>
    pagamentos.filter((p) => p.instance_id === instanceId);

  const totalPorInstancia = (instanceId: string) =>
    porInstancia(instanceId).filter(isAprovado).reduce((s, p) => s + Number(p.valor_usd || 0), 0);

  const totalPendentePorInstancia = (instanceId: string) =>
    porInstancia(instanceId).filter(isPendente).reduce((s, p) => s + Number(p.valor_usd || 0), 0);

  const countPendentePorInstancia = (instanceId: string) =>
    porInstancia(instanceId).filter(isPendente).length;

  return {
    pagamentos,
    totalUsd,
    totalBrl,
    totalPendenteUsd,
    porInstancia,
    totalPorInstancia,
    totalPendentePorInstancia,
    countPendentePorInstancia,
    inserir,
    remover,
    atualizarStatus,
    isLoading: query.isLoading,
  };
}
