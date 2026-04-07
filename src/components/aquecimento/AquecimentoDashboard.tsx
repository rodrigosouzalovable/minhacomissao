import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { Flame, Clock, MessageCircle, Mic, Image, Smile, CheckCircle, XCircle, Send, AlertTriangle, Camera, UserPlus, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

interface DashboardMetrics {
  total: number;
  emAquecimento: number;
  interacoesHoje: number;
  interacoes7d: number;
  taxaSucesso: number;
  agendados: number;
  statusHoje?: number;
  statusTotal?: number;
  contatosSalvosMes?: number;
}

interface ActiveInstance {
  id: string;
  instancia_id: string;
  instance_name: string;
  fase: number;
  status: string;
  interacoes_hoje: number;
  limite_diario: number;
  ultima_interacao: string | null;
  ultima_msg_conteudo?: string;
  ultima_msg_hora?: string;
  ultima_msg_tipo?: string;
  proximo_agendamento?: string;
}

interface TimelineItem {
  id: string;
  tipo: string;
  conteudo: string | null;
  status: string;
  enviado_em: string | null;
  origem_nome: string;
  destino_nome: string;
}

interface Props {
  metrics: DashboardMetrics;
}

function getNextCronSlot(horaInicio: number, horaFim: number, diasAtivos: number[]): { time: string; isActive: boolean; isToday: boolean } {
  const now = new Date();
  const brOffset = -3;
  const brNow = new Date(now.getTime() + (brOffset * 60 + now.getTimezoneOffset()) * 60000);
  const currentHour = brNow.getHours();
  const currentMin = brNow.getMinutes();
  const currentDay = brNow.getDay();

  const isActiveDay = diasAtivos.includes(currentDay);

  if (isActiveDay && (currentHour < horaFim || (currentHour === horaFim && currentMin === 0))) {
    if (currentHour >= horaInicio) {
      // Within business hours - next 30min slot
      let nextMin = currentMin < 30 ? 30 : 0;
      let nextHour = currentMin < 30 ? currentHour : currentHour + 1;
      if (nextHour > horaFim || (nextHour === horaFim && nextMin > 0)) {
        // Past end - find next active day
        return findNextActiveDay(diasAtivos, horaInicio, brNow);
      }
      return { time: `${String(nextHour).padStart(2, '0')}:${String(nextMin).padStart(2, '0')}`, isActive: true, isToday: true };
    } else {
      // Before business hours today
      return { time: `${String(horaInicio).padStart(2, '0')}:00`, isActive: false, isToday: true };
    }
  }

  return findNextActiveDay(diasAtivos, horaInicio, brNow);
}

function findNextActiveDay(diasAtivos: number[], horaInicio: number, brNow: Date): { time: string; isActive: boolean; isToday: boolean } {
  const currentDay = brNow.getDay();
  for (let i = 1; i <= 7; i++) {
    const nextDay = (currentDay + i) % 7;
    if (diasAtivos.includes(nextDay)) {
      const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      return { time: `${dayNames[nextDay]} às ${String(horaInicio).padStart(2, '0')}:00`, isActive: false, isToday: false };
    }
  }
  return { time: 'Não configurado', isActive: false, isToday: false };
}

function tipoIcon(tipo: string, tipoInteracao?: string) {
  if (tipoInteracao === 'status') return <Camera className="h-3.5 w-3.5 text-purple-500" />;
  if (tipoInteracao === 'contato_salvo') return <UserPlus className="h-3.5 w-3.5 text-cyan-500" />;
  switch (tipo) {
    case 'texto': return <MessageCircle className="h-3.5 w-3.5" />;
    case 'audio': return <Mic className="h-3.5 w-3.5" />;
    case 'imagem': return <Image className="h-3.5 w-3.5" />;
    case 'sticker': return <Smile className="h-3.5 w-3.5" />;
    default: return <MessageCircle className="h-3.5 w-3.5" />;
  }
}

function statusIcon(status: string) {
  switch (status) {
    case 'RESPONDIDO': return <CheckCircle className="h-3.5 w-3.5 text-green-500" />;
    case 'ENTREGUE': return <Send className="h-3.5 w-3.5 text-blue-500" />;
    case 'ENVIADO': return <Send className="h-3.5 w-3.5 text-muted-foreground" />;
    case 'FALHOU': return <XCircle className="h-3.5 w-3.5 text-red-500" />;
    default: return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

export default function AquecimentoDashboard({ metrics }: Props) {
  const [activeInstances, setActiveInstances] = useState<ActiveInstance[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [nextCron, setNextCron] = useState<{ time: string; isActive: boolean; isToday: boolean }>({ time: '', isActive: false, isToday: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [metrics.emAquecimento]);

  async function loadDashboardData() {
    setLoading(true);

    // Load config, active instances, agendamentos, and recent interactions in parallel
    const [configRes, instancesRes, allInstancesRes] = await Promise.all([
      supabase.from('whatsapp_aquecimento_config' as any).select('chave, valor'),
      supabase.from('whatsapp_aquecimento_instancias' as any).select('*').eq('status', 'EM_AQUECIMENTO'),
      supabase.from('user_whatsapp_instances').select('id, nome'),
    ]);

    // Parse config
    const configs = (configRes.data as any[]) || [];
    const getConfigVal = (key: string, def: any) => {
      const found = configs.find((c: any) => c.chave === key);
      return found ? found.valor : def;
    };
    const horarioComercial = getConfigVal('horario_comercial', { inicio: '08:00', fim: '18:00' });
    const diasAtivos = getConfigVal('dias_ativos', [1, 2, 3, 4, 5, 6]);

    // Parse hours from string format "HH:MM" or number
    const parseHour = (val: any) => typeof val === 'string' ? parseInt(val.split(':')[0], 10) : Number(val);
    setNextCron(getNextCronSlot(parseHour(horarioComercial.inicio), parseHour(horarioComercial.fim), diasAtivos));

    const instanceNameMap = new Map((allInstancesRes.data || []).map((i: any) => [i.id, i.nome || 'Sem nome']));
    const activeData = (instancesRes.data as any[]) || [];

    if (activeData.length === 0) {
      setActiveInstances([]);
      setTimeline([]);
      setLoading(false);
      return;
    }

    const activeIds = activeData.map((a: any) => a.instancia_id);

    // Load latest interactions and next agendamentos for active instances
    const today = new Date().toISOString().split('T')[0];
    const [interacoesRes, agendamentosRes] = await Promise.all([
      supabase
        .from('whatsapp_aquecimento_interacoes' as any)
        .select('*')
        .in('instancia_origem_id', activeIds)
        .gte('enviado_em', today)
        .order('enviado_em', { ascending: false })
        .limit(50),
      supabase
        .from('whatsapp_aquecimento_agendamentos' as any)
        .select('*')
        .eq('status', 'AGENDADO')
        .in('instancia_origem_id', activeIds)
        .order('agendado_para', { ascending: true })
        .limit(20),
    ]);

    const interacoes = (interacoesRes.data as any[]) || [];
    const agendamentos = (agendamentosRes.data as any[]) || [];

    // Build active instance cards
    const mapped: ActiveInstance[] = activeData.map((inst: any) => {
      const lastInteraction = interacoes.find((i: any) => i.instancia_origem_id === inst.instancia_id);
      const nextSchedule = agendamentos.find((a: any) => a.instancia_origem_id === inst.instancia_id);

      return {
        id: inst.id,
        instancia_id: inst.instancia_id,
        instance_name: instanceNameMap.get(inst.instancia_id) || 'Sem nome',
        fase: inst.fase,
        status: inst.status,
        interacoes_hoje: inst.interacoes_hoje,
        limite_diario: inst.limite_diario,
        ultima_interacao: inst.ultima_interacao,
        ultima_msg_conteudo: lastInteraction?.conteudo || null,
        ultima_msg_hora: lastInteraction?.enviado_em || null,
        ultima_msg_tipo: lastInteraction?.tipo || null,
        proximo_agendamento: nextSchedule?.agendado_para || null,
      };
    });

    setActiveInstances(mapped);

    // Build timeline (last 5 interactions of today)
    const timelineData: TimelineItem[] = interacoes.slice(0, 5).map((i: any) => ({
      id: i.id,
      tipo: i.tipo,
      conteudo: i.conteudo,
      status: i.status,
      enviado_em: i.enviado_em,
      origem_nome: instanceNameMap.get(i.instancia_origem_id) || '?',
      destino_nome: instanceNameMap.get(i.instancia_destino_id) || '?',
    }));

    setTimeline(timelineData);
    setLoading(false);
  }

  const faseLabel = (fase: number) => {
    const labels: Record<number, string> = { 1: 'Fase 1 — Iniciante', 2: 'Fase 2 — Crescimento', 3: 'Fase 3 — Maturação', 4: 'Fase 4 — Consolidação' };
    return labels[fase] || `Fase ${fase}`;
  };

  return (
    <div className="space-y-4">
      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Números</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{metrics.total}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Em Aquecimento</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-500">{metrics.emAquecimento}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Interações Hoje</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{metrics.interacoesHoje}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Interações 7 dias</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{metrics.interacoes7d}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Taxa Sucesso</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{metrics.taxaSucesso}%</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Agendados</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-orange-500">{metrics.agendados}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1"><Camera className="h-3.5 w-3.5" /> Status Hoje</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-purple-500">{metrics.statusHoje ?? 0}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1"><UserPlus className="h-3.5 w-3.5" /> Contatos Salvos</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-cyan-500">{metrics.contatosSalvosMes ?? 0}<span className="text-xs text-muted-foreground ml-1">este mês</span></div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" /> Reputação</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{Math.min(100, Math.round(((metrics.statusHoje ?? 0) * 2 + (metrics.contatosSalvosMes ?? 0) * 0.5 + metrics.taxaSucesso) / 3))}%</div></CardContent></Card>
      </div>

      {/* Status Banner */}
      {metrics.emAquecimento > 0 ? (
        <Card className={nextCron.isActive ? 'border-green-500/50 bg-green-500/5' : 'border-yellow-500/50 bg-yellow-500/5'}>
          <CardContent className="py-4 flex items-center gap-3">
            {nextCron.isActive ? (
              <>
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
                <div>
                  <span className="font-semibold text-green-600 dark:text-green-400">Sistema Ativo</span>
                  <span className="text-muted-foreground ml-2">— próxima execução às <strong>{nextCron.time}</strong></span>
                </div>
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <div>
                  <span className="font-semibold text-yellow-600 dark:text-yellow-400">Fora do horário comercial</span>
                  <span className="text-muted-foreground ml-2">— próxima execução: <strong>{nextCron.time}</strong></span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-muted bg-muted/30">
          <CardContent className="py-4 flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="relative inline-flex rounded-full h-3 w-3 bg-muted-foreground/40"></span>
            </span>
            <span className="text-muted-foreground">Nenhum número em aquecimento. Vá na aba <strong>Números</strong> para iniciar.</span>
          </CardContent>
        </Card>
      )}

      {/* Active Instance Cards */}
      {activeInstances.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {activeInstances.map(inst => {
            const progressPct = inst.limite_diario > 0 ? Math.round((inst.interacoes_hoje / inst.limite_diario) * 100) : 0;
            return (
              <Card key={inst.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">{inst.instance_name}</CardTitle>
                    <Badge variant="outline" className="text-xs">{faseLabel(inst.fase)}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Progress bar */}
                  <div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>Progresso do dia</span>
                      <span className="font-medium">{inst.interacoes_hoje}/{inst.limite_diario} mensagens</span>
                    </div>
                    <Progress value={progressPct} className="h-2" />
                  </div>

                  {/* Last message */}
                  <div className="text-sm space-y-1">
                    {inst.ultima_msg_hora ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                        <span>
                          Última msg: <strong>{format(new Date(inst.ultima_msg_hora), 'HH:mm')}</strong>
                          {inst.ultima_msg_conteudo && (
                            <span className="ml-1 text-xs">— {inst.ultima_msg_conteudo.length > 40 ? inst.ultima_msg_conteudo.slice(0, 40) + '…' : inst.ultima_msg_conteudo}</span>
                          )}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        <span>Nenhuma mensagem enviada hoje</span>
                      </div>
                    )}

                    {/* Next estimated message */}
                    {inst.proximo_agendamento ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                        <span>
                          Próxima msg: <strong>{format(new Date(inst.proximo_agendamento), 'HH:mm')}</strong>
                        </span>
                      </div>
                    ) : nextCron.isActive && inst.interacoes_hoje < inst.limite_diario ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                        <span>
                          Próxima msg estimada: <strong>~{nextCron.time}</strong>
                        </span>
                      </div>
                    ) : inst.interacoes_hoje >= inst.limite_diario ? (
                      <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                        <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                        <span className="text-xs font-medium">Limite diário atingido ✓</span>
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Timeline */}
      {timeline.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Atividade de Hoje</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {timeline.map(item => (
                <div key={item.id} className="flex items-center gap-3 text-sm py-1.5 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-1.5 shrink-0 w-14 text-xs text-muted-foreground">
                    {item.enviado_em ? format(new Date(item.enviado_em), 'HH:mm') : '--:--'}
                  </div>
                  <div className="shrink-0">{tipoIcon(item.tipo)}</div>
                  <div className="truncate flex-1 text-muted-foreground">
                    <span className="font-medium text-foreground">{item.origem_nome}</span>
                    <span className="mx-1">→</span>
                    <span className="font-medium text-foreground">{item.destino_nome}</span>
                    {item.conteudo && (
                      <span className="ml-2 text-xs">"{item.conteudo.length > 30 ? item.conteudo.slice(0, 30) + '…' : item.conteudo}"</span>
                    )}
                  </div>
                  <div className="shrink-0">{statusIcon(item.status)}</div>
                  <Badge variant={item.status === 'RESPONDIDO' ? 'default' : item.status === 'FALHOU' ? 'destructive' : 'secondary'} className="text-[10px] shrink-0">
                    {item.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
