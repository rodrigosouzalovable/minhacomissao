import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock3, Flame, ShieldCheck, Eye } from 'lucide-react';
import { recoveryAverages, recoveryTimingSummary } from '@/lib/metaRecoveryMetrics';

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
}

interface CicloRecuperacao {
  id: string;
  instancia_id: string;
  qualidade_origem: string;
  caiu_em: string;
  aquecimento_ativado_em: string | null;
  primeiro_envio_uazapi_em: string | null;
  voltou_green_em: string | null;
  envios_uazapi_aceitos: number;
  precisao: string;
  primeiro_envio_recuperacao_em: string | null;
  envios_recuperacao_aceitos: number;
  envios_google_maps_aceitos: number;
  respostas_recuperacao: number;
}

const DIAS_GREEN_ALTA = 3;

function diaBrt() {
  return new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }),
  ).toISOString().slice(0, 10);
}

function formatarDuracao(ms: number | null) {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return '—';
  const minutos = Math.round(ms / 60000);
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (horas < 24) return resto ? `${horas}h ${resto}min` : `${horas}h`;
  const dias = Math.floor(horas / 24);
  const restoHoras = horas % 24;
  return restoHoras ? `${dias}d ${restoHoras}h` : `${dias}d`;
}

export function RecuperacaoQualidadePanel() {
  const { user } = useAuth();
  const [previa, setPrevia] = useState<any>(null);
  const [verificando, setVerificando] = useState(false);
  const [erroPrevia, setErroPrevia] = useState('');
  async function consultarPrevia() {
    setVerificando(true); setErroPrevia('');
    try {
      const { data, error } = await supabase.functions.invoke('meta-recuperacao-tick', { body: { simulacao: true } });
      if (error) throw error;
      setPrevia(data);
    } catch { setErroPrevia('Não foi possível consultar a prévia. Verifique seu acesso administrativo.'); }
    finally { setVerificando(false); }
  }

  const { data } = useQuery({
    queryKey: ['meta-recuperacao-panel', user?.id],
    enabled: !!user?.id,
    staleTime: 120_000,
    queryFn: async () => {
      const dia = diaBrt();
      const [instRes, logRes, ciclosRes] = await Promise.all([
        supabase
          .from('meta_whatsapp_instances')
          .select('id, nome, display_phone, saude_quality, recuperacao_msgs_meta_dia, recuperacao_proximo_envio_em, recuperacao_desde, dias_green_consecutivos, quarentena_ate')
          .eq('user_id', user?.id || '')
          .eq('provider', 'meta')
          .is('partner_client_id', null)
          .eq('recuperacao_ativa', true)
          .eq('ativo', true)
          .returns<InstRecup[]>(),
        supabase
          .from('meta_recuperacao_log')
          .select('instancia_id, status, cadastral, fonte, nome_empresa, variaveis, resposta_tipo, entregue_em, lido_em, agradecimento_wamid, erro')
          .eq('dia', dia)
          .like('tipo', 'recuperacao:%')
          .limit(5000),
        supabase
          .from('meta_qualidade_recuperacao_ciclos')
          .select('id, instancia_id, qualidade_origem, caiu_em, aquecimento_ativado_em, primeiro_envio_uazapi_em, voltou_green_em, envios_uazapi_aceitos, precisao, primeiro_envio_recuperacao_em, envios_recuperacao_aceitos, envios_google_maps_aceitos, respostas_recuperacao')
          .eq('user_id', user?.id || '')
          .order('caiu_em', { ascending: false })
          .limit(200)
          .returns<CicloRecuperacao[]>(),
      ]);
      if (instRes.error) throw instRes.error;
      if (logRes.error) throw logRes.error;
      if (ciclosRes.error) throw ciclosRes.error;
      const enviados = new Map<string, number>();
      const falhas = new Map<string, number>();
      (logRes.data || []).forEach((l: any) => {
        const alvo = l.status === 'enviado' ? enviados : l.status === 'falha' ? falhas : null;
        if (!alvo) return;
        alvo.set(l.instancia_id, (alvo.get(l.instancia_id) || 0) + 1);
      });
      const aceitos = (logRes.data || []).filter(l => l.status === 'enviado');
      const maps = aceitos.filter(l => ['confirmado', 'candidato'].includes(l.fonte || '')).length;
      const uazapi = aceitos.filter(l => l.fonte === 'uazapi' || !l.cadastral).length;
      return { insts: instRes.data || [], enviados, falhas, ciclos: ciclosRes.data || [], cadastrais: (logRes.data || []).filter(l => l.cadastral).slice(-10), maps, uazapi, total: aceitos.length };
    },
  });

  const insts = data?.insts || [];
  const ciclos = data?.ciclos || [];
  const concluidos = ciclos.filter((c) => c.precisao === 'exata' && c.voltou_green_em && c.primeiro_envio_recuperacao_em);
  const tempos = recoveryTimingSummary(ciclos);
  const medias = recoveryAverages(concluidos);
  const ciclosPorInstancia = new Map(ciclos.filter((c) => !c.voltou_green_em).map((c) => [c.instancia_id, c]));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Flame className="h-4 w-4 text-primary" />
          Recuperação automática de qualidade
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
          <div><div className="text-sm font-medium">Atualização cadastral · AQUECIMENTO</div><div className="text-xs text-muted-foreground">fins_de_atualizacao_cadastral</div></div>
          <Button variant="outline" size="sm" onClick={consultarPrevia} disabled={verificando}><Eye className="mr-2 h-4 w-4" />{verificando ? 'Consultando…' : 'Prévia sem envio'}</Button>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 border-b pb-3 text-sm">
          <span>Hoje: <strong>{data?.total || 0}</strong> aceitas</span>
          <span>Google Maps: <strong>{data?.maps || 0}</strong> ({data?.total ? ((data.maps / data.total) * 100).toFixed(1) : '0'}%)</span>
          <span>UAZAPI: <strong>{data?.uazapi || 0}</strong> ({data?.total ? ((data.uazapi / data.total) * 100).toFixed(1) : '0'}%)</span>
        </div>
        {erroPrevia && <p className="text-sm text-destructive">{erroPrevia}</p>}
        {previa && <div className="space-y-2 border-b pb-3">
          <p className="text-xs text-muted-foreground">Empresas autorizadas disponíveis: {previa.estoque_elegivel ?? 0} · Nenhuma mensagem enviada nesta prévia</p>
          {(previa.resultados || []).map((r: any, index: number) => <div key={index} className="border-l-2 pl-3 text-sm">
            <div className="font-medium">{r.instancia}</div>
            {r.simulado ? <><div>{r.nome_empresa} · {r.fonte === 'confirmado' ? 'Resposta automática confirmada' : r.fonte === 'candidato' ? 'Candidato' : 'UAZAPI conectado'}</div><p className="text-muted-foreground">{r.preview}</p><div className="text-xs text-muted-foreground">{'{{1}}'}: {r.variaveis?.[0]} · {'{{2}}'}: {r.variaveis?.[1]}</div></> : <div className="text-muted-foreground">{r.skip === 'aguarda_template_cadastral_aprovado' ? 'Aguardando aprovação do modelo na instância' : r.skip === 'remetente_inapto' ? 'Aguardando liberação da Meta' : 'Aguardando destino autorizado ou limites de envio'}</div>}
          </div>)}
        </div>}
        <div className="grid gap-4 border-b py-3 sm:grid-cols-2">
          {[
            { label: 'Queda detectada → GREEN', summary: tempos.fromDrop },
            { label: 'Primeiro envio → GREEN', summary: tempos.fromFirstSend },
          ].map(({ label, summary }) => (
            <div key={label} className="min-w-0 space-y-2">
              <h3 className="text-sm font-medium">{label}</h3>
              <dl className="grid grid-cols-2 gap-2">
                <div><dt className="text-xs text-muted-foreground">Média</dt><dd className="text-lg font-semibold">{formatarDuracao(summary.mean)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Mediana</dt><dd className="text-lg font-semibold">{formatarDuracao(summary.median)}</dd></div>
              </dl>
              <div className="text-xs text-muted-foreground">{summary.count} ciclo(s) concluído(s) · histórico parcial excluído</div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 py-2 text-sm">
          <span>Média observada por dia: <strong>{medias.daily?.toFixed(1) ?? '—'}</strong></span>
          <span>Média acumulada até GREEN: <strong>{medias.accepted?.toFixed(1) ?? '—'}</strong></span>
        </div>
        {tempos.fromFirstSend.count === 0 && (
          <div className="flex items-center gap-2 rounded-md border p-2 text-xs text-muted-foreground">
            <Clock3 className="h-4 w-4 shrink-0" />
            Nenhum ciclo completo medido após envio de recuperação.
          </div>
        )}
        {insts.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Nenhum número em recuperação no momento. Números bloqueados ou sem confirmação de saúde aguardam liberação.
          </div>
        ) : (
          insts.map((i) => {
            const ciclo = ciclosPorInstancia.get(i.id);
            const feitos = data?.enviados.get(i.id) || 0;
            const falhas = data?.falhas.get(i.id) || 0;
            const meta = i.recuperacao_msgs_meta_dia || 0;
            const diasGreen = i.dias_green_consecutivos || 0;
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
                  {ciclo && (
                    <div className="text-xs text-muted-foreground">
                      Queda há {formatarDuracao(Date.now() - new Date(ciclo.caiu_em).getTime())}
                      {' · '}aquecimento {ciclo.aquecimento_ativado_em ? 'ativado' : 'aguardando ativação'}
                      {' · '}primeiro envio {ciclo.primeiro_envio_recuperacao_em
                        ? `há ${formatarDuracao(Date.now() - new Date(ciclo.primeiro_envio_recuperacao_em).getTime())}`
                        : 'ainda não ocorreu'}
                      <> · {ciclo.envios_recuperacao_aceitos} aceito(s) no ciclo · Google Maps {ciclo.envios_google_maps_aceitos} · UAZAPI {ciclo.envios_uazapi_aceitos} · {ciclo.respostas_recuperacao} resposta(s)</>
                      {ciclo.precisao !== 'exata' && <> · histórico parcial</>}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    GREEN: {String(i.saude_quality).toUpperCase() === 'GREEN' ? 'confirmado pela Meta' : 'aguardando avaliação da Meta'}
                    {i.quarentena_ate && (
                      <> · fora das campanhas até {new Date(i.quarentena_ate).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant="outline"
                    className={
                      String(i.saude_quality).toUpperCase() === 'RED'
                        ? 'border-destructive text-destructive'
                        : 'border-primary text-primary'
                    }
                  >
                    {i.saude_quality || 'UNKNOWN'}
                  </Badge>
                </div>
              </div>
            );
          })
        )}
        {!!data?.cadastrais.length && <div className="space-y-2 border-t pt-3">
          <h3 className="text-sm font-medium">Atualizações cadastrais de hoje</h3>
          {data.cadastrais.map((l, index) => <div key={index} className="flex flex-wrap justify-between gap-2 border-b py-2 text-xs">
            <span>{l.nome_empresa} · {l.fonte === 'candidato' ? 'Candidato' : l.fonte === 'confirmado' ? 'Confirmado' : 'UAZAPI'}</span>
            <span>{l.status === 'falha' ? l.erro || 'Falha' : l.resposta_tipo === 'saida' ? 'SAIR · Blacklist' : l.agradecimento_wamid ? 'Confirmado · Agradecimento enviado' : l.resposta_tipo === 'negativa' ? 'Não confirmado' : l.lido_em ? 'Lida' : l.entregue_em ? 'Entregue' : 'Aceita pela Meta'}</span>
          </div>)}
        </div>}
        <p className="pt-1 text-xs text-muted-foreground">
          Limite de 20 mensagens/dia por número · 08h–19h · sem domingos · intervalos de 20–40 min.
          Médias observadas não comprovam causalidade nem garantem GREEN. Volume não aumenta automaticamente.
        </p>
      </CardContent>
    </Card>
  );
}
