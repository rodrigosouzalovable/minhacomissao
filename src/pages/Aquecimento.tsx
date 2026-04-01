import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Flame, Phone, Activity, Clock, CheckCircle, Play, Pause, BarChart3, Settings, List, MessageCircle } from 'lucide-react';
import AquecimentoConfigTab from '@/components/aquecimento/AquecimentoConfigTab';
import AquecimentoDialogosTab from '@/components/aquecimento/AquecimentoDialogosTab';
import AquecimentoDashboard from '@/components/aquecimento/AquecimentoDashboard';
import { format } from 'date-fns';

interface AquecimentoInstancia {
  id: string;
  instancia_id: string;
  status: string;
  fase: number;
  dias_na_fase: number;
  interacoes_hoje: number;
  interacoes_total: number;
  respostas_recebidas: number;
  limite_diario: number;
  ultima_interacao: string | null;
  instance_name?: string;
}

interface Interacao {
  id: string;
  tipo: string;
  conteudo: string | null;
  conteudo_resposta: string | null;
  status: string;
  enviado_em: string | null;
  respondido_em: string | null;
  tempo_resposta_segundos: number | null;
  instancia_origem_id: string;
  instancia_destino_id: string;
  origem_nome?: string;
  destino_nome?: string;
}




export default function Aquecimento() {
  const [instancias, setInstancias] = useState<AquecimentoInstancia[]>([]);
  const [allInstances, setAllInstances] = useState<any[]>([]);
  const [interacoes, setInteracoes] = useState<Interacao[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({ total: 0, emAquecimento: 0, interacoesHoje: 0, interacoes7d: 0, taxaSucesso: 0, agendados: 0 });
  const [logFilterStatus, setLogFilterStatus] = useState<string>('todos');
  const [logFilterDate, setLogFilterDate] = useState<string>('');
  const [selectedInstances, setSelectedInstances] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadInstancias(), loadInteracoes(), loadMetrics()]);
    setLoading(false);
  }

  async function loadInstancias() {
    const { data: instances } = await supabase.from('user_whatsapp_instances').select('id, nome, server_url, ativo');
    setAllInstances(instances || []);

    const { data } = await supabase.from('whatsapp_aquecimento_instancias' as any).select('*');
    if (data) {
      const mapped = (data as any[]).map((d: any) => ({
        ...d,
        instance_name: instances?.find((i: any) => i.id === d.instancia_id)?.nome || 'Sem nome',
      }));
      setInstancias(mapped);
    }
  }

  async function loadInteracoes() {
    const { data: instances } = await supabase.from('user_whatsapp_instances').select('id, nome');
    const instanceNameMap = new Map((instances || []).map((i: any) => [i.id, i.nome || 'Sem nome']));

    const { data } = await supabase
      .from('whatsapp_aquecimento_interacoes' as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (data) {
      const mapped = (data as any[]).map((d: any) => ({
        ...d,
        origem_nome: instanceNameMap.get(d.instancia_origem_id) || 'Desconhecido',
        destino_nome: instanceNameMap.get(d.instancia_destino_id) || 'Desconhecido',
      }));
      setInteracoes(mapped);
    }
  }




  async function loadMetrics() {
    const { count: total } = await supabase.from('user_whatsapp_instances').select('id', { count: 'exact', head: true }).eq('ativo', true);
    const { count: emAquecimento } = await supabase.from('whatsapp_aquecimento_instancias' as any).select('id', { count: 'exact', head: true }).eq('status', 'EM_AQUECIMENTO');
    
    const today = new Date().toISOString().split('T')[0];
    const { count: interacoesHoje } = await supabase.from('whatsapp_aquecimento_interacoes' as any).select('id', { count: 'exact', head: true }).gte('enviado_em', today);
    
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data: recentData } = await supabase.from('whatsapp_aquecimento_interacoes' as any).select('status').gte('enviado_em', sevenDaysAgo);
    const interacoes7d = recentData?.length || 0;
    const sucessos = recentData?.filter((r: any) => ['ENTREGUE', 'RESPONDIDO'].includes(r.status)).length || 0;
    const taxaSucesso = interacoes7d > 0 ? Math.round((sucessos / interacoes7d) * 100) : 0;

    const { count: agendados } = await supabase.from('whatsapp_aquecimento_agendamentos' as any).select('id', { count: 'exact', head: true }).eq('status', 'AGENDADO');

    setMetrics({
      total: total || 0,
      emAquecimento: emAquecimento || 0,
      interacoesHoje: interacoesHoje || 0,
      interacoes7d,
      taxaSucesso,
      agendados: agendados || 0,
    });
  }

  async function iniciarAquecimento(instanciaId: string) {
    const existing = instancias.find(i => i.instancia_id === instanciaId);
    if (existing) {
      await supabase.from('whatsapp_aquecimento_instancias' as any).update({ status: 'EM_AQUECIMENTO' } as any).eq('id', existing.id);
    } else {
      await supabase.from('whatsapp_aquecimento_instancias' as any).insert({ instancia_id: instanciaId, status: 'EM_AQUECIMENTO' } as any);
    }
    toast({ title: 'Aquecimento iniciado!' });
    loadAll();
  }

  async function pausarAquecimento(id: string) {
    await supabase.from('whatsapp_aquecimento_instancias' as any).update({ status: 'PAUSADO' } as any).eq('id', id);
    toast({ title: 'Aquecimento pausado' });
    loadAll();
  }




  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      'EM_AQUECIMENTO': 'bg-green-500/20 text-green-400 border-green-500/30',
      'PAUSADO': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      'AQUECIDO': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'INATIVO': 'bg-muted text-muted-foreground',
      'BLOQUEADO': 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    return <Badge className={map[status] || ''}>{status}</Badge>;
  };

  const faseLabel = (fase: number, status: string) => {
    if (status === 'AQUECIDO') return 'AQUECIDO';
    return `Fase ${fase}`;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Flame className="h-8 w-8 text-orange-500" />
          <div>
            <h1 className="text-2xl font-bold">Aquecimento de WhatsApp</h1>
            <p className="text-muted-foreground">Simule conversas naturais entre seus números para evitar bloqueios</p>
          </div>
        </div>

        <Tabs defaultValue="dashboard">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="dashboard" className="gap-2"><BarChart3 className="h-4 w-4" />Dashboard</TabsTrigger>
            <TabsTrigger value="numeros" className="gap-2"><Phone className="h-4 w-4" />Números</TabsTrigger>
            <TabsTrigger value="config" className="gap-2"><Settings className="h-4 w-4" />Configurações</TabsTrigger>
            <TabsTrigger value="dialogos" className="gap-2"><MessageCircle className="h-4 w-4" />Diálogos</TabsTrigger>
            <TabsTrigger value="log" className="gap-2"><List className="h-4 w-4" />Log</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Números</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{metrics.total}</div></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Em Aquecimento</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-500">{metrics.emAquecimento}</div></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Interações Hoje</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{metrics.interacoesHoje}</div></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Interações 7 dias</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{metrics.interacoes7d}</div></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Taxa Sucesso</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{metrics.taxaSucesso}%</div></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Agendados</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-orange-500">{metrics.agendados}</div></CardContent></Card>
            </div>
          </TabsContent>

          <TabsContent value="numeros">
            <Card>
              <CardHeader>
                <CardTitle>Instâncias WhatsApp</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedInstances.size > 0 && (
                  <div className="flex items-center gap-3">
                    <Button
                      size="sm"
                      onClick={async () => {
                        for (const id of selectedInstances) {
                          await iniciarAquecimento(id);
                        }
                        setSelectedInstances(new Set());
                      }}
                      className="gap-1"
                    >
                      <Play className="h-3 w-3" /> Iniciar Aquecimento ({selectedInstances.size} selecionados)
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedInstances(new Set())}>Limpar seleção</Button>
                  </div>
                )}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={(() => {
                            const eligible = allInstances.filter(i => {
                              if (!i.ativo) return false;
                              const aq = instancias.find(a => a.instancia_id === i.id);
                              return !aq || aq.status === 'INATIVO' || aq.status === 'PAUSADO';
                            });
                            return eligible.length > 0 && eligible.every(i => selectedInstances.has(i.id));
                          })()}
                          onCheckedChange={(checked) => {
                            const eligible = allInstances.filter(i => {
                              if (!i.ativo) return false;
                              const aq = instancias.find(a => a.instancia_id === i.id);
                              return !aq || aq.status === 'INATIVO' || aq.status === 'PAUSADO';
                            });
                            if (checked) {
                              setSelectedInstances(new Set(eligible.map(i => i.id)));
                            } else {
                              setSelectedInstances(new Set());
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Fase</TableHead>
                      <TableHead>Dias na Fase</TableHead>
                      <TableHead>Interações Hoje</TableHead>
                      <TableHead>Taxa Resposta</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allInstances.filter(i => i.ativo).map(inst => {
                      const aq = instancias.find(a => a.instancia_id === inst.id);
                      const taxaResp = aq && aq.interacoes_total > 0 ? Math.round((aq.respostas_recebidas / aq.interacoes_total) * 100) : 0;
                      return (
                         <TableRow key={inst.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedInstances.has(inst.id)}
                              onCheckedChange={(checked) => {
                                const next = new Set(selectedInstances);
                                if (checked) next.add(inst.id); else next.delete(inst.id);
                                setSelectedInstances(next);
                              }}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{inst.nome || 'Sem nome'}</TableCell>
                          <TableCell>{aq ? faseLabel(aq.fase, aq.status) : '-'}</TableCell>
                          <TableCell>{aq?.dias_na_fase ?? '-'}</TableCell>
                          <TableCell>{aq ? `${aq.interacoes_hoje}/${aq.limite_diario}` : '-'}</TableCell>
                          <TableCell>{aq ? `${taxaResp}%` : '-'}</TableCell>
                          <TableCell>{aq ? statusBadge(aq.status) : statusBadge('INATIVO')}</TableCell>
                          <TableCell>
                            {(!aq || aq.status === 'INATIVO' || aq.status === 'PAUSADO') ? (
                              <Button size="sm" variant="outline" onClick={() => iniciarAquecimento(inst.id)} className="gap-1">
                                <Play className="h-3 w-3" /> Iniciar
                              </Button>
                            ) : aq.status === 'EM_AQUECIMENTO' ? (
                              <Button size="sm" variant="outline" onClick={() => pausarAquecimento(aq.id)} className="gap-1">
                                <Pause className="h-3 w-3" /> Pausar
                              </Button>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="config">
            <AquecimentoConfigTab />
          </TabsContent>

          <TabsContent value="dialogos">
            <AquecimentoDialogosTab />
          </TabsContent>

          <TabsContent value="log">
            <Card>
              <CardHeader>
                <CardTitle>Log de Interações</CardTitle>
                <div className="flex gap-3 mt-3">
                  <div>
                    <Label className="text-xs">Status</Label>
                    <select
                      value={logFilterStatus}
                      onChange={(e) => setLogFilterStatus(e.target.value)}
                      className="ml-2 rounded border border-input bg-background px-2 py-1 text-sm"
                    >
                      <option value="todos">Todos</option>
                      <option value="ENVIADO">Enviado</option>
                      <option value="RESPONDIDO">Respondido</option>
                      <option value="ENTREGUE">Entregue</option>
                      <option value="FALHOU">Falhou</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Data</Label>
                    <Input
                      type="date"
                      value={logFilterDate}
                      onChange={(e) => setLogFilterDate(e.target.value)}
                      className="ml-2 w-40 h-8 text-sm inline-block"
                    />
                  </div>
                  {(logFilterStatus !== 'todos' || logFilterDate) && (
                    <Button variant="ghost" size="sm" onClick={() => { setLogFilterStatus('todos'); setLogFilterDate(''); }}>Limpar</Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Destino</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Conteúdo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Resposta</TableHead>
                      <TableHead>Tempo Resp.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {interacoes
                      .filter(i => logFilterStatus === 'todos' || i.status === logFilterStatus)
                      .filter(i => !logFilterDate || (i.enviado_em && i.enviado_em.startsWith(logFilterDate)))
                      .map(i => (
                      <TableRow key={i.id}>
                        <TableCell className="text-sm whitespace-nowrap">{i.enviado_em ? format(new Date(i.enviado_em), 'dd/MM HH:mm') : '-'}</TableCell>
                        <TableCell className="text-sm">{i.origem_nome || '-'}</TableCell>
                        <TableCell className="text-sm">{i.destino_nome || '-'}</TableCell>
                        <TableCell><Badge variant="outline">{i.tipo}</Badge></TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm">{i.conteudo}</TableCell>
                        <TableCell>
                          <Badge variant={i.status === 'RESPONDIDO' ? 'default' : i.status === 'FALHOU' ? 'destructive' : 'secondary'}>{i.status}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm">{i.conteudo_resposta || '-'}</TableCell>
                        <TableCell>{i.tempo_resposta_segundos ? `${i.tempo_resposta_segundos}s` : '-'}</TableCell>
                      </TableRow>
                    ))}
                    {interacoes.filter(i => logFilterStatus === 'todos' || i.status === logFilterStatus).filter(i => !logFilterDate || (i.enviado_em && i.enviado_em.startsWith(logFilterDate))).length === 0 && (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhuma interação registrada</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
