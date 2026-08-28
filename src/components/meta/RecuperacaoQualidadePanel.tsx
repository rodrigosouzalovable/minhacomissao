import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Flame, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useUserRole } from '@/hooks/useUserRole';

interface InstRecup {
  id: string;
  nome: string | null;
  display_phone: string | null;
  saude_quality: string | null;
  recuperacao_msgs_meta_dia: number | null;
  recuperacao_proximo_envio_em: string | null;
  recuperacao_desde: string | null;
  dias_green_consecutivos: number | null;
  quarentena_ate: string | null;
  aquecimento_qualidade_permitido: boolean | null;
}

const DIAS_GREEN_ALTA = 3;

function diaBrt() {
  return new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }),
  ).toISOString().slice(0, 10);
}

/** Previsão de GREEN e de volta ao pool (mesma regra usada nas notificações). */
function previsao(qualidade: string | null, diasGreen: number) {
  const q = String(qualidade || '').toUpperCase();
  const paraGreen = q === 'GREEN' ? 0 : q === 'YELLOW' ? 1 : 2;
  const faltam = Math.max(0, DIAS_GREEN_ALTA - diasGreen);
  const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  return {
    greenEm: paraGreen === 0 ? 'já GREEN' : fmt(new Date(Date.now() + paraGreen * 86400000)),
    altaEm: fmt(new Date(Date.now() + (paraGreen + faltam) * 86400000)),
  };
}

export function RecuperacaoQualidadePanel() {
  const queryClient = useQueryClient();
  const { isAdmin } = useUserRole();

  const { data } = useQuery({
    queryKey: ['meta-recuperacao-panel'],
    staleTime: 120_000,
    queryFn: async () => {
      const dia = diaBrt();
      const [instRes, logRes] = await Promise.all([
        supabase
          .from('meta_whatsapp_instances')
          .select('id, nome, display_phone, saude_quality, recuperacao_msgs_meta_dia, recuperacao_proximo_envio_em, recuperacao_desde, dias_green_consecutivos, quarentena_ate, aquecimento_qualidade_permitido')
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
      const falhas = new Map<string, number>();
      (logRes.data || []).forEach((l: any) => {
        const alvo = l.status === 'enviado' ? enviados : l.status === 'falha' ? falhas : null;
        if (!alvo) return;
        alvo.set(l.instancia_id, (alvo.get(l.instancia_id) || 0) + 1);
      });
      return { insts: instRes.data || [], enviados, falhas };
    },
  });

  const insts = data?.insts || [];

  const alternarPermissao = async (id: string, valor: boolean) => {
    const { error } = await supabase
      .from('meta_whatsapp_instances')
      .update({ aquecimento_qualidade_permitido: valor })
      .eq('id', id);
    if (error) {
      toast.error('Não foi possível alterar o aquecimento deste número');
      return;
    }
    toast.success(valor ? 'Aquecimento liberado para este número' : 'Aquecimento desligado para este número');
    queryClient.invalidateQueries({ queryKey: ['meta-recuperacao-panel'] });
  };

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
            const falhas = data?.falhas.get(i.id) || 0;
            const meta = i.recuperacao_msgs_meta_dia || 0;
            const diasGreen = i.dias_green_consecutivos || 0;
            const p = previsao(i.saude_quality, diasGreen);
            const diasEmRecup = i.recuperacao_desde
              ? Math.max(1, Math.ceil((Date.now() - new Date(i.recuperacao_desde).getTime()) / 86400000))
              : 1;
            const proximo = i.recuperacao_proximo_envio_em
              ? new Date(i.recuperacao_proximo_envio_em)
              : null;
            return (
              <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium">{i.nome || i.display_phone}</div>
                  <div className="text-xs text-muted-foreground">
                    {feitos}/{meta} mensagens hoje
                    {falhas > 0 && <> · {falhas} falha(s)</>}
                    {' · '}dia {diasEmRecup} de recuperação · {diasGreen}/{DIAS_GREEN_ALTA} dia(s) GREEN
                    {proximo && proximo > new Date() && (
                      <> · próximo às {proximo.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}</>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Previsão: GREEN {p.greenEm} · volta ao pool {p.altaEm}
                    {i.quarentena_ate && (
                      <> · fora das campanhas até {new Date(i.quarentena_ate).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {isAdmin && (
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Switch
                        checked={i.aquecimento_qualidade_permitido !== false}
                        onCheckedChange={(v) => alternarPermissao(i.id, v)}
                      />
                      aquecer
                    </label>
                  )}
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
              </div>
            );
          })
        )}
        <p className="pt-1 text-xs text-muted-foreground">
          Números com queda de qualidade saem das campanhas e conversam sozinhos com os números da caixa
          AQUECIMENTO (09h–19h, intervalos de 20–40 min). Após 3 dias em GREEN voltam ao pool em escada.
          Avisos no WhatsApp: início do aquecimento, resumo às 13h e 18h, mudanças de qualidade e volta ao GREEN.
        </p>
      </CardContent>
    </Card>
  );
}
