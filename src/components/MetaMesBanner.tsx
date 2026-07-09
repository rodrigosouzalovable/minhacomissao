import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Target, DollarSign, TrendingUp, Calendar, Pencil, ArrowDown, ArrowUp, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

export function MetaMesBanner() {
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
  }, [now.toDateString()]);

  if (valorMeta <= 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Target className="h-6 w-6 text-muted-foreground" />
            <div>
              <p className="font-semibold">Meta do mês ainda não definida</p>
              <p className="text-sm text-muted-foreground">Defina sua meta pessoal para acompanhar seu progresso.</p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/meta-pessoal">Definir minha meta</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const percentual = Math.min((recebido / valorMeta) * 100, 100);
  const restante = Math.max(valorMeta - recebido, 0);
  const necessarioPorDia = diasUteisRestantes > 0 ? restante / diasUteisRestantes : 0;
  const projecao = diasUteisDecorridos > 0 ? (recebido / diasUteisDecorridos) * diasUteisTotal : 0;

  const barColor = 'bg-gradient-to-r from-emerald-400 via-emerald-500 to-green-600';

  const statusBadge =
    recebido >= valorMeta
      ? { icon: Check, text: 'Meta batida', cls: 'text-emerald-600' }
      : projecao >= valorMeta
      ? { icon: ArrowUp, text: 'Acima da meta', cls: 'text-emerald-600' }
      : { icon: ArrowDown, text: 'Abaixo da meta', cls: 'text-red-500' };
  const StatusIcon = statusBadge.icon;

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-br from-muted/50 to-background">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold capitalize">
                  Meta do Mês - {format(now, 'MMMM yyyy', { locale: ptBR })}
                </h2>
                <Button asChild variant="ghost" size="icon" className="h-6 w-6">
                  <Link to="/meta-pessoal"><Pencil className="h-3.5 w-3.5" /></Link>
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {fmt(recebido)} de {fmt(valorMeta)}
              </p>
            </div>
            <div className={cn('flex items-center gap-1 text-sm font-medium', statusBadge.cls)}>
              <StatusIcon className="h-4 w-4" />
              {statusBadge.text}
            </div>
          </div>

          <div className="relative h-6 rounded-full bg-muted overflow-hidden mt-3">
            <div
              className={cn('h-full transition-all duration-500', barColor)}
              style={{ width: `${percentual}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold">
              {percentual.toFixed(1)}%
            </div>
          </div>

          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>
              Projeção de fechamento:{' '}
              <span className={cn('font-semibold', projecao >= valorMeta ? 'text-emerald-600' : 'text-red-500')}>
                {fmt(projecao)}
              </span>
            </span>
            <span>
              {diasUteisDecorridos} de {diasUteisTotal} dias
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10"><DollarSign className="h-5 w-5 text-emerald-600" /></div>
            <div><p className="text-xs text-muted-foreground">Já Recebido</p><p className="text-lg font-bold text-emerald-600">{fmt(recebido)}</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10"><TrendingUp className="h-5 w-5 text-red-500" /></div>
            <div><p className="text-xs text-muted-foreground">Falta Receber</p><p className="text-lg font-bold text-red-500">{fmt(restante)}</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Calendar className="h-5 w-5 text-primary" /></div>
            <div><p className="text-xs text-muted-foreground">Dias Úteis Restantes</p><p className="text-lg font-bold text-primary">{diasUteisRestantes} dias</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10"><Target className="h-5 w-5 text-purple-600" /></div>
            <div><p className="text-xs text-muted-foreground">Necessário/Dia Útil</p><p className="text-lg font-bold text-purple-600">{fmt(necessarioPorDia)}</p></div>
          </div>
        </CardContent></Card>
      </div>
    </div>
  );
}
