import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Lightbulb, TrendingUp, Send, Phone, MessageCircle, Calendar, AlertTriangle } from 'lucide-react';
import { SolicitarPlanilhaDialog } from './SolicitarPlanilhaDialog';

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

interface Props {
  recebido: number;
  meta: number;
  diasUteisRestantes: number;
  diasUteisDecorridos: number;
}

const BUCKETS = [
  { label: '30-60 dias', min: 30, max: 60 },
  { label: '60-90 dias', min: 60, max: 90 },
  { label: '90-180 dias', min: 90, max: 180 },
  { label: '180-360 dias', min: 180, max: 360 },
  { label: '360+ dias', min: 360, max: 9999 },
];

export function SugestoesMetaCard({ recebido, meta, diasUteisRestantes, diasUteisDecorridos }: Props) {
  const { user } = useAuth();
  const [openDialog, setOpenDialog] = useState(false);

  const restante = Math.max(meta - recebido, 0);
  const necDia = diasUteisRestantes > 0 ? restante / diasUteisRestantes : restante;
  const mediaAtual = diasUteisDecorridos > 0 ? recebido / diasUteisDecorridos : 0;
  const aumentoPct = mediaAtual > 0 ? ((necDia / mediaAtual) - 1) * 100 : 100;

  // Faixas de atraso disponíveis em devedores ativos
  const { data: faixas = [] } = useQuery({
    queryKey: ['sugestoes-faixas'],
    queryFn: async () => {
      const hoje = new Date();
      const { data } = await supabase
        .from('devedores')
        .select('valor_atualizado, data_vencimento')
        .eq('ativo', true)
        .not('data_vencimento', 'is', null)
        .limit(50000);
      const rows = data || [];
      return BUCKETS.map(b => {
        const inb = rows.filter(r => {
          const d = new Date(r.data_vencimento as any);
          const dias = Math.floor((hoje.getTime() - d.getTime()) / 86400000);
          return dias >= b.min && dias < b.max;
        });
        return {
          label: b.label,
          qtd: inb.length,
          valor: inb.reduce((s, r) => s + Number(r.valor_atualizado || 0), 0),
        };
      }).filter(b => b.qtd > 0).sort((a, b) => b.valor - a.valor);
    },
    staleTime: 5 * 60 * 1000,
  });

  // Acordos quebrados recentes do user
  const { data: quebrados = 0 } = useQuery({
    queryKey: ['sugestoes-quebrados', user?.id],
    queryFn: async () => {
      const d30 = new Date(); d30.setDate(d30.getDate() - 30);
      const { count } = await supabase
        .from('acordos')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('status', 'quebrado')
        .gte('criado_em', d30.toISOString());
      return count || 0;
    },
    enabled: !!user?.id,
  });

  const top2 = faixas.slice(0, 2);

  return (
    <>
      <Card className="border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            Vamos virar esse mês! Plano de ação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Diagnóstico */}
          <div className="p-3 rounded-lg bg-background/60 border border-amber-200 dark:border-amber-900">
            <div className="flex items-start gap-2">
              <TrendingUp className="h-4 w-4 text-amber-600 mt-0.5" />
              <div className="text-sm space-y-1">
                <p>
                  Para bater a meta, você precisa receber <span className="font-bold text-amber-700 dark:text-amber-400">{fmt(restante)}</span> em <span className="font-bold">{diasUteisRestantes} dias úteis</span> = <span className="font-bold">{fmt(necDia)}/dia</span>.
                </p>
                <p>
                  Sua média atual é <span className="font-semibold">{fmt(mediaAtual)}/dia</span>.
                  {aumentoPct > 0 && (
                    <span className="text-amber-700 dark:text-amber-400 font-semibold"> Precisa subir {aumentoPct.toFixed(0)}%.</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Faixas recomendadas */}
          {top2.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Foque nestas faixas (maior valor em aberto)
              </p>
              <div className="grid sm:grid-cols-2 gap-2">
                {top2.map(f => (
                  <div key={f.label} className="p-3 rounded-lg bg-background border">
                    <p className="text-xs text-muted-foreground">{f.label}</p>
                    <p className="font-bold text-emerald-600">{fmt(f.valor)}</p>
                    <p className="text-xs text-muted-foreground">{f.qtd.toLocaleString('pt-BR')} clientes</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quebrados */}
          {quebrados > 0 && (
            <div className="p-3 rounded-lg bg-background/60 border text-sm flex items-center gap-2">
              <span className="text-2xl">🔄</span>
              <span>Você tem <b>{quebrados}</b> acordo(s) quebrado(s) nos últimos 30 dias. <b>Reabordar agora é alta conversão.</b></span>
            </div>
          )}

          {/* Dicas */}
          <div>
            <p className="text-sm font-semibold mb-2">💡 Dicas que funcionam</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="gap-1 py-1.5"><Phone className="h-3 w-3" /> Ligue antes do WhatsApp em 60-90d (3x mais conversão)</Badge>
              <Badge variant="outline" className="gap-1 py-1.5"><MessageCircle className="h-3 w-3" /> Áudio personalizado para 180d+</Badge>
              <Badge variant="outline" className="gap-1 py-1.5"><Calendar className="h-3 w-3" /> Desconto 50% à vista em 360d+</Badge>
            </div>
          </div>

          {/* CTA */}
          <Button onClick={() => setOpenDialog(true)} className="w-full" size="lg">
            <Send className="h-4 w-4 mr-2" />
            Solicitar nova planilha ao admin
          </Button>
        </CardContent>
      </Card>

      <SolicitarPlanilhaDialog open={openDialog} onOpenChange={setOpenDialog} />
    </>
  );
}
