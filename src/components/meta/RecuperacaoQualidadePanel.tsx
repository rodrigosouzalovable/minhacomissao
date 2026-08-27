import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Flame, ShieldCheck } from 'lucide-react';

interface InstRecup {
  id: string;
  nome: string | null;
  display_phone: string | null;
  saude_quality: string | null;
  recuperacao_msgs_meta_dia: number | null;
  recuperacao_proximo_envio_em: string | null;
  dias_green_consecutivos: number | null;
  quarentena_ate: string | null;
}

function diaBrt() {
  return new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }),
  ).toISOString().slice(0, 10);
}

export function RecuperacaoQualidadePanel() {
  const { data } = useQuery({
    queryKey: ['meta-recuperacao-panel'],
    staleTime: 120_000,
    queryFn: async () => {
      const dia = diaBrt();
      const [instRes, logRes] = await Promise.all([
        supabase
          .from('meta_whatsapp_instances')
          .select('id, nome, display_phone, saude_quality, recuperacao_msgs_meta_dia, recuperacao_proximo_envio_em, dias_green_consecutivos, quarentena_ate')
          .eq('recuperacao_ativa', true)
          .eq('ativo', true)
          .returns<InstRecup[]>(),
        supabase
          .from('meta_recuperacao_log')
          .select('instancia_id, status')
          .eq('dia', dia)
          .limit(5000),
      ]);
      const enviados = new Map<string, number>();
      (logRes.data || []).forEach((l: any) => {
        if (l.status !== 'enviado') return;
        enviados.set(l.instancia_id, (enviados.get(l.instancia_id) || 0) + 1);
      });
      return { insts: instRes.data || [], enviados };
    },
  });

  const insts = data?.insts || [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Flame className="h-4 w-4 text-orange-500" />
          Recuperação automática de qualidade
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {insts.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            Nenhum número em recuperação — todos com qualidade saudável.
          </div>
        ) : (
          insts.map((i) => {
            const feitos = data?.enviados.get(i.id) || 0;
            const meta = i.recuperacao_msgs_meta_dia || 0;
            const proximo = i.recuperacao_proximo_envio_em
              ? new Date(i.recuperacao_proximo_envio_em)
              : null;
            return (
              <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium">{i.nome || i.display_phone}</div>
                  <div className="text-xs text-muted-foreground">
                    {feitos}/{meta} mensagens hoje · {i.dias_green_consecutivos || 0} dia(s) GREEN
                    {proximo && proximo > new Date() && (
                      <> · próximo às {proximo.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}</>
                    )}
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={
                    String(i.saude_quality).toUpperCase() === 'RED'
                      ? 'border-destructive text-destructive'
                      : 'border-amber-500 text-amber-600'
                  }
                >
                  {i.saude_quality || 'UNKNOWN'}
                </Badge>
              </div>
            );
          })
        )}
        <p className="pt-1 text-xs text-muted-foreground">
          Números com queda de qualidade saem das campanhas e conversam sozinhos com os números da caixa
          AQUECIMENTO (09h–19h, intervalos de 20–40 min). Após 3 dias em GREEN voltam ao pool em escada.
        </p>
      </CardContent>
    </Card>
  );
}
