import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const liveQueryOpts = {
  staleTime: 30_000,
  refetchOnWindowFocus: true as const,
  refetchInterval: 60_000,
};

export function useComiteRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const invalidate = () => qc.invalidateQueries({ queryKey: ['comite-nm'] });
    const channel = supabase
      .channel('comite-nm-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'acordos' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagamentos' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'relatorio_acionamentos' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comite_metas_novomundo' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comite_textos_novomundo' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comite_carteira_nm_snapshot' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comite_carteira_nm_item' }, invalidate)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}

function mesRange(mesAno: string) {
  const inicio = new Date(`${mesAno}-01T00:00:00-03:00`);
  const fim = new Date(inicio);
  fim.setMonth(fim.getMonth() + 1);
  return { inicio, fim, inicioISO: inicio.toISOString(), fimISO: fim.toISOString() };
}

function normalizeCpf(c: string | null | undefined) {
  return (c ?? '').replace(/\D/g, '');
}

export type FaixaKey =
  | '1-30' | '31-60' | '61-90'
  | '91-180' | '181-360'
  | '361-720' | '721-1080' | '1081-1440' | '1441-1800' | '1801-2000' | '2000+';

export const FAIXAS_NN: FaixaKey[] = ['1-30', '31-60', '61-90'];
export const FAIXAS_COLCHAO: FaixaKey[] = [
  '91-180', '181-360', '361-720', '721-1080', '1081-1440', '1441-1800', '1801-2000', '2000+',
];
export const TODAS_FAIXAS: FaixaKey[] = [...FAIXAS_NN, ...FAIXAS_COLCHAO];

export type CredorTipo = 'INADIMPLENTES' | 'APORTE';
export const CREDOR_TIPOS: CredorTipo[] = ['INADIMPLENTES', 'APORTE'];

export function faixaDeAtraso(dias: number | null | undefined): FaixaKey | null {
  if (dias === null || dias === undefined || isNaN(dias as number) || dias < 1) return null;
  const d = Math.floor(dias);
  if (d <= 30) return '1-30';
  if (d <= 60) return '31-60';
  if (d <= 90) return '61-90';
  if (d <= 180) return '91-180';
  if (d <= 360) return '181-360';
  if (d <= 720) return '361-720';
  if (d <= 1080) return '721-1080';
  if (d <= 1440) return '1081-1440';
  if (d <= 1800) return '1441-1800';
  if (d <= 2000) return '1801-2000';
  return '2000+';
}

type CelulaCarteira = { qtd: number; cpfsUnicos: number; risco: number; valorAtualizado: number; valor: number };

export function useCarteira() {
  return useQuery({
    queryKey: ['comite-nm', 'carteira'],
    queryFn: async () => {
      const baseFaixa = (): CelulaCarteira => ({ qtd: 0, cpfsUnicos: 0, risco: 0, valorAtualizado: 0, valor: 0 });
      const porFaixa: Record<FaixaKey, CelulaCarteira> = Object.fromEntries(
        TODAS_FAIXAS.map((f) => [f, baseFaixa()]),
      ) as Record<FaixaKey, CelulaCarteira>;
      const porTipo: Record<CredorTipo, CelulaCarteira> = {
        INADIMPLENTES: baseFaixa(),
        APORTE: baseFaixa(),
      };
      const matriz: Record<FaixaKey, Record<CredorTipo, CelulaCarteira>> = Object.fromEntries(
        TODAS_FAIXAS.map((f) => [f, { INADIMPLENTES: baseFaixa(), APORTE: baseFaixa() }]),
      ) as Record<FaixaKey, Record<CredorTipo, CelulaCarteira>>;

      const { data, error } = await supabase.rpc('comite_carteira_nm_agregar');
      if (error) throw error;

      const payload = (data ?? {}) as any;
      const snap = payload.snapshot ?? null;

      if (!snap) {
        return {
          snapshot: null,
          porFaixa,
          porTipo,
          matriz,
          totalQtd: 0,
          totalContratos: 0,
          totalCpfsUnicos: 0,
          totalValor: 0,
          totalValorAtualizado: 0,
          totalRisco: 0,
          cpfs: undefined as Set<string> | undefined,
        };
      }

      const setCel = (cel: CelulaCarteira, raw: any) => {
        const qtd = Number(raw?.qtd ?? 0);
        const cpfsUnicos = Number(raw?.cpfs_unicos ?? 0);
        const risco = Number(raw?.risco ?? 0);
        cel.qtd = qtd;
        cel.cpfsUnicos = cpfsUnicos;
        cel.risco = risco;
        cel.valor = risco;
        cel.valorAtualizado = risco;
      };

      for (const f of TODAS_FAIXAS) {
        if (payload.por_faixa?.[f]) setCel(porFaixa[f], payload.por_faixa[f]);
        for (const t of CREDOR_TIPOS) {
          if (payload.matriz?.[f]?.[t]) setCel(matriz[f][t], payload.matriz[f][t]);
        }
      }
      for (const t of CREDOR_TIPOS) {
        if (payload.por_tipo?.[t]) setCel(porTipo[t], payload.por_tipo[t]);
      }

      const totalContratos = Number(payload.total_contratos ?? 0);
      const totalCpfs = Number(payload.total_cpfs_unicos ?? 0);
      const totalRisco = Number(payload.total_risco ?? 0);
      const cpfsArr: string[] = Array.isArray(payload.cpfs) ? payload.cpfs : [];
      const cpfs = new Set<string>(cpfsArr.map((c) => normalizeCpf(c)).filter(Boolean));

      return {
        snapshot: snap,
        porFaixa,
        porTipo,
        matriz,
        totalQtd: totalCpfs,
        totalContratos,
        totalCpfsUnicos: totalCpfs,
        totalValor: totalRisco,
        totalValorAtualizado: totalRisco,
        totalRisco,
        cpfs,
      };
    },
    ...liveQueryOpts,
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
    ...liveQueryOpts,
  });
}

export type KpisExtras = {
  recuperacao: {
    pago_mes_total: number;
    pago_mes_qtd: number;
    pct_sobre_risco: number;
    por_faixa: Record<string, { pago: number; risco: number; pct: number }>;
    serie_6meses: { mes: string; valor: number }[];
  };
  acordos_saude: {
    ativos_qtd: number;
    quebrados_qtd: number;
    quitados_qtd: number;
    fechados_mes: number;
    quebrados_mes: number;
    taxa_quebra: number;
    em_risco_qtd: number;
    em_risco_valor: number;
  };
  cobertura: {
    total_cpfs: number;
    cpfs_acionados_mes: number;
    pct_acionados: number;
    cpfs_convertidos: number;
    pct_convertidos: number;
    cpfs_intocados_30d_qtd: number;
  };
};

export function useKpisExtras(mesAno: string) {
  return useQuery({
    queryKey: ['comite-nm', 'kpis-extras', mesAno],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('comite_carteira_nm_kpis_extras', { p_mes_ano: mesAno });
      if (error) throw error;
      return data as unknown as KpisExtras;
    },
    ...liveQueryOpts,
  });
}

export function useAcordosNovoMundo(mesAno: string, cpfsCarteira: Set<string> | undefined) {
  return useQuery({
    queryKey: ['comite-nm', 'acordos', mesAno, cpfsCarteira?.size ?? 0],
    enabled: !!cpfsCarteira && cpfsCarteira.size > 0,
    queryFn: async () => {
      const { inicioISO, fimISO } = mesRange(mesAno);
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

      const pagamentos: any[] = [];
      if (acordoIds.length > 0) {
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
    ...liveQueryOpts,
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
    ...liveQueryOpts,
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
    ...liveQueryOpts,
  });
}
