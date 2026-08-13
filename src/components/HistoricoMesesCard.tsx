import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatarMoeda } from '@/lib/comissao';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { History, Loader2, Search, Target, Receipt, Users } from 'lucide-react';

function labelMes(mesAno: string) {
  const [y, m] = mesAno.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  const s = format(d, "MMMM 'de' yyyy", { locale: ptBR });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function HistoricoMesesCard() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [mesAno, setMesAno] = useState<string>(format(subMonths(new Date(), 1), 'yyyy-MM'));
  const [open, setOpen] = useState(false);

  const meses = useMemo(() => {
    const hoje = new Date();
    return Array.from({ length: 12 }, (_, i) => format(subMonths(hoje, i + 1), 'yyyy-MM'));
  }, []);

  const { data, isFetching } = useQuery({
    queryKey: ['historico-mes', user?.id, isAdmin, mesAno],
    enabled: open && !!user?.id,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const [y, m] = mesAno.split('-').map(Number);
      const ref = new Date(y, m - 1, 1);
      const ini = format(startOfMonth(ref), 'yyyy-MM-dd');
      const fim = format(endOfMonth(ref), 'yyyy-MM-dd');

      // Meu resultado
      const { data: acordos } = await supabase.from('acordos').select('id').eq('user_id', user!.id);
      let meuTotal = 0;
      let meuQtd = 0;
      const ids = (acordos || []).map((a) => a.id);
      if (ids.length) {
        for (let i = 0; i < ids.length; i += 200) {
          const { data: pg } = await supabase
            .from('pagamentos')
            .select('valor_parcela')
            .in('acordo_id', ids.slice(i, i + 200))
            .eq('status', 'pago')
            .gte('data_paga', ini)
            .lte('data_paga', fim);
          (pg || []).forEach((p) => {
            meuTotal += Number(p.valor_parcela || 0);
            meuQtd += 1;
          });
        }
      }

      // Minha meta do mês
      const { data: metaRow } = await supabase
        .from('metas_funcionarios')
        .select('valor_meta')
        .eq('user_id', user!.id)
        .eq('mes_ano', mesAno)
        .maybeSingle();

      // Equipe (admin)
      let equipeTotal: number | null = null;
      let equipeMeta = 0;
      let equipeParticipantes = 0;
      if (isAdmin) {
        const { data: ranking } = await supabase.rpc('ranking_mensal', { p_mes_ano: mesAno });
        const rows = (ranking || []) as { total_recebido: number }[];
        equipeTotal = rows.reduce((s, r) => s + Number(r.total_recebido || 0), 0);
        equipeParticipantes = rows.filter((r) => Number(r.total_recebido || 0) > 0).length;
        const { data: metaGlobal } = await supabase
          .from('metas_mensais')
          .select('valor')
          .eq('mes_ano', mesAno)
          .maybeSingle();
        equipeMeta = Number(metaGlobal?.valor || 0);
      }

      return {
        meuTotal,
        meuQtd,
        meuTicket: meuQtd > 0 ? meuTotal / meuQtd : 0,
        minhaMeta: Number(metaRow?.valor_meta || 0),
        equipeTotal,
        equipeMeta,
        equipeParticipantes,
      };
    },
  });

  const pct = (v: number, meta: number) => (meta > 0 ? Math.min((v / meta) * 100, 100) : 0);

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-5 w-5 text-muted-foreground" />
            Resultado de meses anteriores
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={mesAno} onValueChange={setMesAno}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Selecione o mês" />
              </SelectTrigger>
              <SelectContent>
                {meses.map((m) => (
                  <SelectItem key={m} value={m}>
                    {labelMes(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setOpen(true)}>
              <Search className="h-4 w-4 mr-2" />
              Ver resultado
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{labelMes(mesAno)}</DialogTitle>
            <DialogDescription>Total recebido no mês selecionado.</DialogDescription>
          </DialogHeader>

          {isFetching && !data ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Carregando...
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-lg border bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Meu resultado</span>
                  {data && data.minhaMeta > 0 && (
                    <Badge variant={data.meuTotal >= data.minhaMeta ? 'default' : 'secondary'}>
                      {pct(data.meuTotal, data.minhaMeta).toFixed(1)}% da meta
                    </Badge>
                  )}
                </div>
                <p className="text-3xl font-bold tabular-nums">{formatarMoeda(data?.meuTotal || 0)}</p>
                {data && data.minhaMeta > 0 && (
                  <>
                    <Progress value={pct(data.meuTotal, data.minhaMeta)} className="h-2" />
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Target className="h-3 w-3" /> Meta do mês: {formatarMoeda(data.minhaMeta)}
                    </p>
                  </>
                )}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="text-sm">
                    <p className="text-muted-foreground text-xs flex items-center gap-1">
                      <Receipt className="h-3 w-3" /> Parcelas pagas
                    </p>
                    <p className="font-semibold">{(data?.meuQtd || 0).toLocaleString('pt-BR')}</p>
                  </div>
                  <div className="text-sm">
                    <p className="text-muted-foreground text-xs">Ticket médio</p>
                    <p className="font-semibold">{formatarMoeda(data?.meuTicket || 0)}</p>
                  </div>
                </div>
              </div>

              {isAdmin && data?.equipeTotal !== null && data?.equipeTotal !== undefined && (
                <div className="p-4 rounded-lg border bg-card space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold flex items-center gap-1">
                      <Users className="h-4 w-4 text-muted-foreground" /> Total da equipe
                    </span>
                    {data.equipeMeta > 0 && (
                      <Badge variant={data.equipeTotal >= data.equipeMeta ? 'default' : 'secondary'}>
                        {pct(data.equipeTotal, data.equipeMeta).toFixed(1)}% da meta
                      </Badge>
                    )}
                  </div>
                  <p className="text-3xl font-bold tabular-nums">{formatarMoeda(data.equipeTotal)}</p>
                  {data.equipeMeta > 0 && (
                    <>
                      <Progress value={pct(data.equipeTotal, data.equipeMeta)} className="h-2" />
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Target className="h-3 w-3" /> Meta da equipe: {formatarMoeda(data.equipeMeta)}
                      </p>
                    </>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {data.equipeParticipantes} operador(es) com recebimento no mês
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
