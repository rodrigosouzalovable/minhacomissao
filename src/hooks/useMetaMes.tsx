import { totaisCredorVazios } from '@/lib/recebimentosPorCredor';
import { EMPRESAS_ACORDO, type EmpresaAcordo } from '@/lib/empresaLabels';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, isAfter } from 'date-fns';

export function useMetaMes() {
  const { user } = useAuth();
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const mesAno = format(now, 'yyyy-MM');

  const { data: meta } = useQuery({
    queryKey: ['meta-banner', user?.id, mesAno],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('metas_funcionarios' as any)
        .select('valor_meta')
        .eq('user_id', user.id)
        .eq('mes_ano', mesAno)
        .maybeSingle();
      return data as any;
    },
    enabled: !!user?.id,
  });

  const { data: pagamentos } = useQuery({
    queryKey: ['meta-banner-pag', user?.id, mesAno],
    queryFn: async () => {
      if (!user) return [];
      const pagamentos = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase.from('pagamentos')
          .select('id, valor_parcela, data_paga, acordos!inner(user_id, empresa)')
          .eq('acordos.user_id', user.id)
          .eq('status', 'pago')
          .gte('data_paga', format(monthStart, 'yyyy-MM-dd'))
          .lte('data_paga', format(monthEnd, 'yyyy-MM-dd'))
          .order('id').range(offset, offset + 999);
        if (error) throw error;
        pagamentos.push(...(data || []));
        if (!data || data.length < 1000) break;
      }
      return pagamentos;
    },
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000,
    refetchInterval: () => (document.visibilityState === 'visible' ? 15 * 60 * 1000 : false),
    refetchIntervalInBackground: false,
  });

  const valorMeta = meta ? Number(meta.valor_meta) : 0;
  const porCredor = totaisCredorVazios();
  for (const p of pagamentos || []) {
    const credor = p.acordos.empresa as EmpresaAcordo;
    if (EMPRESAS_ACORDO.includes(credor)) porCredor[credor] += Number(p.valor_parcela);
  }
  const recebido = Object.values(porCredor).reduce((s, v) => s + v, 0);

  const { diasUteisTotal, diasUteisDecorridos, diasUteisRestantes } = useMemo(() => {
    const all = eachDayOfInterval({ start: monthStart, end: monthEnd }).filter(d => !isWeekend(d));
    const decorridos = all.filter(d => !isAfter(d, now)).length;
    return {
      diasUteisTotal: all.length,
      diasUteisDecorridos: decorridos,
      diasUteisRestantes: all.length - decorridos,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now.toDateString()]);

  const projecao = diasUteisDecorridos > 0 ? (recebido / diasUteisDecorridos) * diasUteisTotal : 0;

  return { valorMeta, recebido, porCredor, projecao, diasUteisTotal, diasUteisDecorridos, diasUteisRestantes };
}
