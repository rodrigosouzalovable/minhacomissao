import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Award, TrendingUp } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

interface Props {
  recebidoMesAtual: number;
}

export function RecordePessoalCard({ recebidoMesAtual }: Props) {
  const { user } = useAuth();
  const mesAtual = format(new Date(), 'yyyy-MM');

  const { data: recorde } = useQuery({
    queryKey: ['recorde-pessoal', user?.id],
    queryFn: async () => {
      const { data: acordos } = await supabase.from('acordos').select('id').eq('user_id', user!.id);
      if (!acordos?.length) return null;
      const { data } = await supabase
        .from('pagamentos')
        .select('valor_parcela, data_paga')
        .in('acordo_id', acordos.map(a => a.id))
        .eq('status', 'pago')
        .not('data_paga', 'is', null);
      if (!data?.length) return null;
      const porMes = new Map<string, number>();
      for (const p of data) {
        const k = (p.data_paga as string).slice(0, 7);
        porMes.set(k, (porMes.get(k) || 0) + Number(p.valor_parcela));
      }
      // descarta mês atual da busca de recorde
      porMes.delete(mesAtual);
      let melhorMes = '';
      let melhorVal = 0;
      porMes.forEach((v, k) => { if (v > melhorVal) { melhorVal = v; melhorMes = k; } });
      return { mes: melhorMes, valor: melhorVal };
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  if (!recorde || recorde.valor <= 0) {
    return (
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-900">
        <CardContent className="pt-4 flex items-center gap-3">
          <TrendingUp className="h-8 w-8 text-blue-500" />
          <div>
            <p className="text-sm font-bold">Esse é seu primeiro mês registrado 📏</p>
            <p className="text-xs text-muted-foreground">Vamos cravar a régua para os próximos meses!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const superou = recebidoMesAtual > recorde.valor;
  const falta = Math.max(recorde.valor - recebidoMesAtual, 0);
  const mesLabel = format(new Date(recorde.mes + '-01T12:00:00'), 'MMM/yyyy', { locale: ptBR });

  return (
    <Card
      className={cn(
        'border-2',
        superou
          ? 'bg-gradient-to-br from-amber-100 to-yellow-200 border-yellow-400 shadow-md'
          : 'bg-gradient-to-br from-muted/40 to-background border-border'
      )}
    >
      <CardContent className="pt-4 flex items-center gap-3">
        <Award className={cn('h-8 w-8 shrink-0', superou ? 'text-yellow-600' : 'text-muted-foreground')} />
        <div className="flex-1 min-w-0">
          {superou ? (
            <>
              <p className="text-sm font-bold text-yellow-900 dark:text-yellow-200">
                🏅 NOVO RECORDE PESSOAL!
              </p>
              <p className="text-xs text-yellow-800 dark:text-yellow-300">
                Você superou {mesLabel} ({fmt(recorde.valor)}) em{' '}
                <span className="font-bold">{fmt(recebidoMesAtual - recorde.valor)}</span>
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-bold">
                Seu recorde é {fmt(recorde.valor)} em {mesLabel}
              </p>
              <p className="text-xs text-muted-foreground">
                Faltam <span className="font-semibold text-foreground">{fmt(falta)}</span> para superar 🚀
              </p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
