import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy } from 'lucide-react';

interface RankingItem {
  user_id: string;
  nome: string;
  novo_mundo_recebido: number;
  ume_recebido: number;
  total_recebido: number;
}

const formatarMoeda = (valor: number) =>
  valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const medalhas = ['🥇', '🥈', '🥉'];

export function RankingMensal() {
  const { data: ranking, isLoading } = useQuery({
    queryKey: ['ranking-mensal'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ranking_mensal_por_credor' as any);
      if (error) throw error;
      return (data as RankingItem[]) || [];
    },
  });

  const totalEquipe = ranking?.reduce((sum, r) => sum + Number(r.total_recebido), 0) || 0;
  const totalNovoMundo = ranking?.reduce((sum, r) => sum + Number(r.novo_mundo_recebido), 0) || 0;
  const totalUme = ranking?.reduce((sum, r) => sum + Number(r.ume_recebido), 0) || 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Ranking do Mês
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !ranking?.length ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum dado disponível este mês.
          </p>
        ) : (
          <ScrollArea className="h-[350px]">
            <div className="space-y-2">
              {ranking.map((item, index) => {
                const percentual = totalEquipe > 0
                  ? ((Number(item.total_recebido) / totalEquipe) * 100).toFixed(1)
                  : '0.0';

                return (
                  <div
                    key={item.user_id}
                    className="flex items-center gap-3 rounded-lg border p-3"
                  >
                    <span className="text-lg font-bold w-8 text-center shrink-0">
                      {index < 3 ? medalhas[index] : `${index + 1}º`}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.nome}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${percentual}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-12 text-right shrink-0">
                          {percentual}%
                        </span>
                      </div>
                    </div>
                    <div className="grid shrink-0 grid-cols-1 gap-0.5 text-right text-xs sm:grid-cols-3 sm:gap-4">
                      <span><span className="text-muted-foreground">NOVO MUNDO</span><br /><strong>{formatarMoeda(Number(item.novo_mundo_recebido))}</strong></span>
                      <span><span className="text-muted-foreground">UME</span><br /><strong>{formatarMoeda(Number(item.ume_recebido))}</strong></span>
                      <span><span className="text-muted-foreground">Total</span><br /><strong className="text-green-600 dark:text-green-400">{formatarMoeda(Number(item.total_recebido))}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 grid grid-cols-1 gap-1 border-t pt-3 text-right text-sm sm:grid-cols-3">
              <span><span className="text-muted-foreground">NOVO MUNDO: </span><strong>{formatarMoeda(totalNovoMundo)}</strong></span>
              <span><span className="text-muted-foreground">UME: </span><strong>{formatarMoeda(totalUme)}</strong></span>
              <span><span className="text-muted-foreground">Total: </span><strong className="text-green-600 dark:text-green-400">{formatarMoeda(totalEquipe)}</strong></span>
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
