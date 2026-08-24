import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export const ORDEM_PONTO = ['entrada', 'saida_almoco', 'volta_almoco', 'saida'] as const;
export type PontoTipo = typeof ORDEM_PONTO[number];

export const LABEL_PONTO: Record<PontoTipo, string> = {
  entrada: 'Entrada',
  saida_almoco: 'Saída para almoço',
  volta_almoco: 'Volta do almoço',
  saida: 'Saída',
};

/** Data local (BRT do navegador) em YYYY-MM-DD */
export function dataHojeBRT(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Identificador estável da máquina (para auditoria de qual PC bateu o ponto) */
export function getDeviceId(): string {
  const KEY = 'ponto_device_id';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

export interface PontoRegistro {
  id: string;
  tipo: PontoTipo;
  registrado_em: string;
  origem: string;
  ip: string | null;
}

export function usePonto() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const hoje = dataHojeBRT();

  const { data: registros = [], isLoading } = useQuery({
    queryKey: ['ponto-hoje', user?.id, hoje],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ponto_registros')
        .select('id, tipo, registrado_em, origem, ip')
        .eq('user_id', user!.id)
        .eq('data', hoje)
        .order('registrado_em', { ascending: true });
      if (error) throw error;
      return (data ?? []) as PontoRegistro[];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const tipos = registros.map((r) => r.tipo);
  const proximo: PontoTipo | null = ORDEM_PONTO.find((t) => !tipos.includes(t)) ?? null;

  const bater = useMutation({
    mutationFn: async (tipo: PontoTipo) => {
      const { data, error } = await supabase.functions.invoke('ponto-registrar', {
        body: { tipo, device_id: getDeviceId() },
      });
      if (error) {
        // Extrai a mensagem devolvida pela função (403/409 etc.)
        let msg = error.message;
        try {
          const ctx = (error as any).context;
          if (ctx && typeof ctx.json === 'function') {
            const body = await ctx.json();
            if (body?.error) msg = body.error;
          }
        } catch {
          /* mantém a mensagem original */
        }
        throw new Error(msg);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ponto-hoje'] });
    },
  });

  return {
    registros,
    tipos,
    proximo,
    isLoading,
    bater,
    /** true quando a entrada do dia já foi registrada e não está em almoço em aberto */
    entradaOk: tipos.includes('entrada'),
    emAlmoco: tipos.includes('saida_almoco') && !tipos.includes('volta_almoco'),
    diaEncerrado: tipos.includes('saida'),
  };
}

export function useMeuIpPonto() {
  return useQuery({
    queryKey: ['ponto-meu-ip'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('ponto-ip-autorizar', {
        body: { acao: 'consultar' },
      });
      if (error) throw error;
      return data as { ip: string; autorizado: boolean };
    },
    staleTime: 5 * 60_000,
  });
}
