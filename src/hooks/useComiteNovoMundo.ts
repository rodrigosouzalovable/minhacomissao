import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const liveQueryOpts = {
  staleTime: 30_000,
  refetchOnWindowFocus: true as const,
  refetchInterval: 60_000,
};

/**
 * Assina mudanças nas tabelas que alimentam o Comitê Novo Mundo e invalida
 * as queries do React Query para manter o painel vivo sem refresh manual.
 */
export function useComiteRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const invalidate = () => qc.invalidateQueries({ queryKey: ['comite-nm'] });
    const channel = supabase
      .channel('comite-nm-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'acordos' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagamentos' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'devedores' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'relatorio_acionamentos' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comite_metas_novomundo' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comite_textos_novomundo' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, invalidate)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}

const CREDOR = 'ume_novo_mundo';

function mesRange(mesAno: string) {
  // mesAno = "YYYY-MM"
  const inicio = new Date(`${mesAno}-01T00:00:00-03:00`);
  const fim = new Date(inicio);
  fim.setMonth(fim.getMonth() + 1);
  return { inicio, fim, inicioISO: inicio.toISOString(), fimISO: fim.toISOString() };
}

function normalizeCpf(c: string | null | undefined) {
  return (c ?? '').replace(/\D/g, '');
}

function diasAtraso(venc: string | null): number | null {
  if (!venc) return null;
  const d = new Date(venc);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.floor((hoje.getTime() - d.getTime()) / 86400000);
}

export type FaixaKey = '1-30' | '31-60' | '61-90' | '91-180' | '181-360' | '360+';
export const FAIXAS_NN: FaixaKey[] = ['1-30', '31-60', '61-90'];
export const FAIXAS_COLCHAO: FaixaKey[] = ['91-180', '181-360', '360+'];
export const TODAS_FAIXAS: FaixaKey[] = [...FAIXAS_NN, ...FAIXAS_COLCHAO];

function faixaDeAtraso(dias: number | null): FaixaKey | null {
  if (dias === null || dias < 1) return null;
  if (dias <= 30) return '1-30';
  if (dias <= 60) return '31-60';
  if (dias <= 90) return '61-90';
  if (dias <= 180) return '91-180';
  if (dias <= 360) return '181-360';
  return '360+';
}

export function useCarteira() {
  return useQuery({
    queryKey: ['comite-nm', 'carteira'],
    queryFn: async () => {
      // Paginar para não bater no limite de 1000
      const all: any[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('devedores')
          .select('cpf, valor_original, valor_atualizado, data_vencimento')
          .eq('credor', CREDOR)
          .eq('ativo', true)
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      // Agrupa por faixa
      const porFaixa: Record<FaixaKey, { qtd: number; valor: number; valorAtualizado: number }> = {
        '1-30': { qtd: 0, valor: 0, valorAtualizado: 0 },
        '31-60': { qtd: 0, valor: 0, valorAtualizado: 0 },
        '61-90': { qtd: 0, valor: 0, valorAtualizado: 0 },
        '91-180': { qtd: 0, valor: 0, valorAtualizado: 0 },
        '181-360': { qtd: 0, valor: 0, valorAtualizado: 0 },
        '360+': { qtd: 0, valor: 0, valorAtualizado: 0 },
      };
      const cpfs = new Set<string>();
      let totalQtd = 0;
      let totalValor = 0;
      let totalValorAtualizado = 0;
      for (const d of all) {
        const cpfN = normalizeCpf(d.cpf);
        if (cpfN) cpfs.add(cpfN);
        const dias = diasAtraso(d.data_vencimento);
        const f = faixaDeAtraso(dias);
        const vo = Number(d.valor_original ?? 0);
        const va = Number(d.valor_atualizado ?? vo);
        totalQtd += 1;
        totalValor += vo;
        totalValorAtualizado += va;
        if (f) {
          porFaixa[f].qtd += 1;
          porFaixa[f].valor += vo;
          porFaixa[f].valorAtualizado += va;
        }
      }
      return { porFaixa, totalQtd, totalValor, totalValorAtualizado, cpfs };
    },
    staleTime: 60_000,
  });
}

export function useFunilMes(mesAno: string) {
  return useQuery({
    queryKey: ['comite-nm', 'funil', mesAno],
    queryFn: async () => {
      const { inicio, fim } = mesRange(mesAno);
      const inicioDate = inicio.toISOString().slice(0, 10);
      const fimDate = new Date(fim.getTime() - 1).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('relatorio_acionamentos')
        .select('tentativas, whatsapp, alo, cpc, cpca, acordos_valor')
        .gte('data', inicioDate)
        .lte('data', fimDate);
      if (error) throw error;
      const agg = (data ?? []).reduce(
        (acc, r: any) => {
          acc.tentativas += Number(r.tentativas ?? 0);
          acc.whatsapp += Number(r.whatsapp ?? 0);
          acc.alo += Number(r.alo ?? 0);
          acc.cpc += Number(r.cpc ?? 0);
          acc.cpca += Number(r.cpca ?? 0);
          acc.acordosValor += Number(r.acordos_valor ?? 0);
          return acc;
        },
        { tentativas: 0, whatsapp: 0, alo: 0, cpc: 0, cpca: 0, acordosValor: 0 },
      );
      return agg;
    },
    staleTime: 60_000,
  });
}

export function useAcordosNovoMundo(mesAno: string, cpfsCarteira: Set<string> | undefined) {
  return useQuery({
    queryKey: ['comite-nm', 'acordos', mesAno, cpfsCarteira?.size ?? 0],
    enabled: !!cpfsCarteira && cpfsCarteira.size > 0,
    queryFn: async () => {
      const { inicioISO, fimISO } = mesRange(mesAno);
      // Acordos criados no mês
      const all: any[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('acordos')
          .select('id, cliente_cpf, valor_total, criado_em, user_id')
          .gte('criado_em', inicioISO)
          .lt('criado_em', fimISO)
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      const cpfs = cpfsCarteira!;
      const novomundoAcordos = all.filter((a) => cpfs.has(normalizeCpf(a.cliente_cpf)));
      const acordoIds = novomundoAcordos.map((a) => a.id);

      // Pagamentos pagos no mês para esses acordos
      const pagamentos: any[] = [];
      if (acordoIds.length > 0) {
        // Chunk para evitar URL muito longa
        const chunkSize = 200;
        const inicioDate = new Date(inicioISO).toISOString().slice(0, 10);
        const fimDate = new Date(new Date(fimISO).getTime() - 1).toISOString().slice(0, 10);
        for (let i = 0; i < acordoIds.length; i += chunkSize) {
          const chunk = acordoIds.slice(i, i + chunkSize);
          const { data, error } = await supabase
            .from('pagamentos')
            .select('acordo_id, valor_parcela, data_paga, numero_parcela')
            .in('acordo_id', chunk)
            .eq('status', 'pago')
            .gte('data_paga', inicioDate)
            .lte('data_paga', fimDate);
          if (error) throw error;
          if (data) pagamentos.push(...data);
        }
      }

      // Primeiro pagamento por acordo (para TMR)
      const primeiroPagPorAcordo = new Map<string, string>();
      if (acordoIds.length > 0) {
        const chunkSize = 200;
        for (let i = 0; i < acordoIds.length; i += chunkSize) {
          const chunk = acordoIds.slice(i, i + chunkSize);
          const { data, error } = await supabase
            .from('pagamentos')
            .select('acordo_id, data_paga')
            .in('acordo_id', chunk)
            .eq('status', 'pago')
            .not('data_paga', 'is', null)
            .order('data_paga', { ascending: true });
          if (error) throw error;
          for (const p of data ?? []) {
            if (!primeiroPagPorAcordo.has(p.acordo_id)) {
              primeiroPagPorAcordo.set(p.acordo_id, p.data_paga);
            }
          }
        }
      }

      const totalAcordosQtd = novomundoAcordos.length;
      const totalAcordosValor = novomundoAcordos.reduce((s, a) => s + Number(a.valor_total ?? 0), 0);
      const totalPagoValor = pagamentos.reduce((s, p) => s + Number(p.valor_parcela ?? 0), 0);
      const totalPagoQtd = pagamentos.length;

      // TMR
      let somaDias = 0;
      let qtdComPag = 0;
      for (const a of novomundoAcordos) {
        const primeira = primeiroPagPorAcordo.get(a.id);
        if (primeira) {
          const dias = Math.max(0, Math.floor(
            (new Date(primeira).getTime() - new Date(a.criado_em).getTime()) / 86400000,
          ));
          somaDias += dias;
          qtdComPag += 1;
        }
      }
      const tmr = qtdComPag > 0 ? somaDias / qtdComPag : null;

      // Por cobrador
      const porUser = new Map<string, { qtd: number; valor: number; pago: number }>();
      for (const a of novomundoAcordos) {
        const key = a.user_id ?? 'sem';
        const e = porUser.get(key) ?? { qtd: 0, valor: 0, pago: 0 };
        e.qtd += 1;
        e.valor += Number(a.valor_total ?? 0);
        porUser.set(key, e);
      }
      const acordoIdToUser = new Map(novomundoAcordos.map((a) => [a.id, a.user_id]));
      for (const p of pagamentos) {
        const uid = acordoIdToUser.get(p.acordo_id);
        if (!uid) continue;
        const e = porUser.get(uid) ?? { qtd: 0, valor: 0, pago: 0 };
        e.pago += Number(p.valor_parcela ?? 0);
        porUser.set(uid, e);
      }

      return {
        totalAcordosQtd,
        totalAcordosValor,
        totalPagoQtd,
        totalPagoValor,
        tmr,
        porUser,
      };
    },
    staleTime: 60_000,
  });
}

export function useCobradores(userIds: string[]) {
  return useQuery({
    queryKey: ['comite-nm', 'cobradores', userIds.sort().join(',')],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome, data_admissao')
        .in('id', userIds);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });
}

export function useMetasMes(mesAno: string) {
  return useQuery({
    queryKey: ['comite-nm', 'metas', mesAno],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comite_metas_novomundo')
        .select('*')
        .eq('mes_ano', mesAno);
      if (error) throw error;
      const map = new Map<string, number>();
      for (const m of data ?? []) {
        map.set(`${m.tipo}:${m.faixa}`, Number(m.meta_valor));
      }
      return map;
    },
    staleTime: 30_000,
  });
}

export function useTextosMes(mesAno: string) {
  return useQuery({
    queryKey: ['comite-nm', 'textos', mesAno],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comite_textos_novomundo')
        .select('*')
        .eq('mes_ano', mesAno);
      if (error) throw error;
      const map = new Map<string, string>();
      for (const t of data ?? []) {
        map.set(t.bloco, t.conteudo);
      }
      return map;
    },
    staleTime: 30_000,
  });
}
