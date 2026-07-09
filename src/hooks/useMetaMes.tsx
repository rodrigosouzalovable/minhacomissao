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
      const { data } = await supabase
        .from('metas_funcionarios' as any)
        .select('valor_meta')
        .eq('user_id', user!.id)
        .eq('mes_ano', mesAno)
        .maybeSingle();
      return data as any;
    },
    enabled: !!user?.id,
  });

  const { data: pagamentos } = useQuery({
    queryKey: ['meta-banner-pag', user?.id, mesAno],
    queryFn: async () => {
      const { data: acordos } = await supabase.from('acordos').select('id').eq('user_id', user!.id);
      if (!acordos?.length) return [];
      const { data } = await supabase
        .from('pagamentos')
        .select('valor_parcela, data_paga')
        .in('acordo_id', acordos.map(a => a.id))
        .eq('status', 'pago')
        .gte('data_paga', format(monthStart, 'yyyy-MM-dd'))
        .lte('data_paga', format(monthEnd, 'yyyy-MM-dd'));
      return data || [];
    },
    enabled: !!user?.id,
    refetchInterval: 5 * 60 * 1000,
  });

  const valorMeta = meta ? Number(meta.valor_meta) : 0;
  const recebido = (pagamentos || []).reduce((s, p) => s + Number(p.valor_parcela), 0);

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

  return { valorMeta, recebido, projecao, diasUteisTotal, diasUteisDecorridos, diasUteisRestantes };
}
