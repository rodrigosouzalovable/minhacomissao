import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ObjecoesCatalogoTab } from '@/components/admin/ObjecoesCatalogoTab';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Bot, Loader2, Plus, RefreshCw, Trash2, Sparkles } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  userName: string;
}

type Tipo = 'instrucao' | 'qa' | 'proibido' | 'aprendizado';

interface Item {
  id: string;
  tipo: Tipo;
  gatilho: string | null;
  conteudo: string;
  ativo: boolean;
  origem: string;
}

export function IagoConfigDialog({ open, onOpenChange, userId, userName }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cfg, setCfg] = useState<any>(null);
  const [itens, setItens] = useState<Item[]>([]);

  const [novoTexto, setNovoTexto] = useState('');
  const [novaPergunta, setNovaPergunta] = useState('');
  const [novaResposta, setNovaResposta] = useState('');
  const [novoProibido, setNovoProibido] = useState('');

  const [testeMsg, setTesteMsg] = useState('');
  const [testeOut, setTesteOut] = useState<any>(null);
  const [testando, setTestando] = useState(false);
  const [aprendendo, setAprendendo] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: config }, { data: know }] = await Promise.all([
        (supabase as any).from('iago_config').select('*').order('created_at').limit(1).maybeSingle(),
        (supabase as any).from('iago_conhecimento').select('*').order('created_at', { ascending: false }),
      ]);
      let c = config;
      if (!c) {
        const { data: novo } = await (supabase as any).from('iago_config').insert({}).select('*').maybeSingle();
        c = novo;
      }
      if (c && !c.user_id && userId) {
        await (supabase as any).from('iago_config').update({ user_id: userId }).eq('id', c.id);
        c = { ...c, user_id: userId };
      }
      setCfg(c);
      setItens(((know as Item[]) ?? []));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { if (open) { setTesteOut(null); load(); } }, [open, load]);

  const salvarCfg = async (patch: Record<string, unknown>) => {
    if (!cfg?.id) return;
    setCfg((prev: any) => ({ ...prev, ...patch }));
    setSaving(true);
    const { error } = await (supabase as any).from('iago_config').update(patch).eq('id', cfg.id);
    setSaving(false);
    if (error) toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
  };

  const addItem = async (tipo: Tipo, conteudo: string, gatilho?: string) => {
    if (!conteudo.trim()) return;
    const { data, error } = await (supabase as any)
      .from('iago_conhecimento')
      .insert({ tipo, conteudo: conteudo.trim(), gatilho: gatilho?.trim() || null, origem: 'manual' })
      .select('*').maybeSingle();
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      return;
    }
    setItens((p) => [data as Item, ...p]);
  };

  const toggleItem = async (id: string, ativo: boolean) => {
    setItens((p) => p.map((i) => (i.id === id ? { ...i, ativo } : i)));
    await (supabase as any).from('iago_conhecimento').update({ ativo }).eq('id', id);
  };

  const removeItem = async (id: string) => {
    setItens((p) => p.filter((i) => i.id !== id));
    await (supabase as any).from('iago_conhecimento').delete().eq('id', id);
  };

  const porTipo = useMemo(() => ({
    instrucao: itens.filter((i) => i.tipo === 'instrucao'),
    qa: itens.filter((i) => i.tipo === 'qa'),
    proibido: itens.filter((i) => i.tipo === 'proibido'),
    aprendizado: itens.filter((i) => i.tipo === 'aprendizado'),
  }), [itens]);

  const testar = async () => {
    if (!testeMsg.trim()) return;
    setTestando(true);
    setTesteOut(null);
    try {
      const { data, error } = await supabase.functions.invoke('iago-atendimento', {
        body: { simular: testeMsg.trim() },
      });
      if (error) throw new Error(error.message);
      setTesteOut((data as any)?.simulacao ?? data);
    } catch (e: any) {
      toast({ title: 'Falha no teste', description: e?.message || 'erro', variant: 'destructive' });
    } finally {
      setTestando(false);
    }
  };

  const rodarAprendizado = async () => {
    setAprendendo(true);
    try {
      const { data, error } = await supabase.functions.invoke('iago-aprender', { body: { forcar: true } });
      if (error) throw new Error(error.message);
      const d = data as any;
      if (d?.success) {
        toast({ title: 'Aprendizado atualizado', description: `${d.aprendizados} padrão(ões) extraído(s) de ${d.conversas} conversa(s).` });
        await load();
      } else {
        toast({ title: 'Nada aprendido agora', description: d?.skipped || d?.error || 'sem dados suficientes' });
      }
    } catch (e: any) {
      toast({ title: 'Falha no aprendizado', description: e?.message || 'erro', variant: 'destructive' });
    } finally {
      setAprendendo(false);
    }
  };

  const ListaItens = ({ lista, mostrarGatilho }: { lista: Item[]; mostrarGatilho?: boolean }) => (
    <div className="space-y-2">
      {lista.length === 0 && <p className="text-xs text-muted-foreground">Nada cadastrado ainda.</p>}
      {lista.map((i) => (
        <div key={i.id} className="flex items-start gap-2 border rounded-md p-2">
          <Switch checked={i.ativo} onCheckedChange={(v) => toggleItem(i.id, !!v)} className="mt-0.5" />
          <div className="flex-1 min-w-0">
            {mostrarGatilho && i.gatilho && <p className="text-xs font-medium truncate">{i.gatilho}</p>}
            <p className="text-sm whitespace-pre-wrap break-words">{i.conteudo}</p>
            {i.origem === 'auto' && <Badge variant="secondary" className="mt-1 text-[10px]">aprendido automaticamente</Badge>}
          </div>
          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => removeItem(i.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Configurar {userName || 'IAGO'}
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </DialogTitle>
          <DialogDescription>
            Ensine o que o IAGO pode falar e fazer. Ele atende 24h por dia nas caixas onde estiver marcado como responsável.
          </DialogDescription>
        </DialogHeader>

        {loading || !cfg ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <Tabs defaultValue="persona" className="flex-1 min-h-0 flex flex-col">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="persona">Personalidade</TabsTrigger>
              <TabsTrigger value="ensinar">Ensinar</TabsTrigger>
              <TabsTrigger value="qa">Perguntas</TabsTrigger>
              <TabsTrigger value="proibido">Nunca fazer</TabsTrigger>
              <TabsTrigger value="aprendizado">Aprendizado</TabsTrigger>
              <TabsTrigger value="objecoes">Objeções</TabsTrigger>
              <TabsTrigger value="followup">Follow-up</TabsTrigger>
              <TabsTrigger value="testar">Testar</TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 min-h-0 mt-3 pr-3">
              <TabsContent value="persona" className="space-y-4 mt-0">
                <div className="flex items-center justify-between border rounded-md p-3">
                  <div>
                    <Label>Atendimento automático ativo</Label>
                    <p className="text-xs text-muted-foreground">24 horas por dia, 7 dias por semana.</p>
                  </div>
                  <Switch checked={!!cfg.ativo} onCheckedChange={(v) => salvarCfg({ ativo: !!v })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Nome que ele usa nas conversas</Label>
                  <Input value={cfg.persona_nome || ''} onChange={(e) => setCfg({ ...cfg, persona_nome: e.target.value })}
                    onBlur={(e) => salvarCfg({ persona_nome: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Tom de voz</Label>
                  <Input value={cfg.tom || ''} onChange={(e) => setCfg({ ...cfg, tom: e.target.value })}
                    onBlur={(e) => salvarCfg({ tom: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Instruções gerais</Label>
                  <Textarea rows={5} value={cfg.instrucoes_gerais || ''}
                    onChange={(e) => setCfg({ ...cfg, instrucoes_gerais: e.target.value })}
                    onBlur={(e) => salvarCfg({ instrucoes_gerais: e.target.value })} />
                </div>
                <div className="flex items-center justify-between border rounded-md p-3">
                  <Label>Pode se apresentar pelo nome</Label>
                  <Switch checked={!!cfg.assina_nome} onCheckedChange={(v) => salvarCfg({ assina_nome: !!v })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Atraso de digitação (segundos)</Label>
                    <Input type="number" min={0} max={30} value={cfg.delay_digitacao_seg ?? 4}
                      onChange={(e) => setCfg({ ...cfg, delay_digitacao_seg: Number(e.target.value) })}
                      onBlur={(e) => salvarCfg({ delay_digitacao_seg: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Limite de mensagens por conversa/dia</Label>
                    <Input type="number" min={1} max={100} value={cfg.limite_msgs_dia ?? 20}
                      onChange={(e) => setCfg({ ...cfg, limite_msgs_dia: Number(e.target.value) })}
                      onBlur={(e) => salvarCfg({ limite_msgs_dia: Number(e.target.value) })} />
                  </div>
                </div>
                <div className="border rounded-md p-3 space-y-2">
                  <Label className="text-sm font-medium">Descontos da proposta</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">% à vista</Label>
                      <Input type="number" min={0} max={100} placeholder="Automático"
                        value={cfg.desconto_avista_pct ?? ''}
                        onChange={(e) => setCfg({ ...cfg, desconto_avista_pct: e.target.value === '' ? null : Number(e.target.value) })}
                        onBlur={(e) => salvarCfg({ desconto_avista_pct: e.target.value === '' ? null : Number(e.target.value) })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">% parcelado</Label>
                      <Input type="number" min={0} max={100} placeholder="Automático"
                        value={cfg.desconto_parcelado_pct ?? ''}
                        onChange={(e) => setCfg({ ...cfg, desconto_parcelado_pct: e.target.value === '' ? null : Number(e.target.value) })}
                        onBlur={(e) => salvarCfg({ desconto_parcelado_pct: e.target.value === '' ? null : Number(e.target.value) })} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    O IAGO usa esses percentuais nas propostas. Em branco, ele volta a usar as faixas por dias de atraso do credor.
                    Parcela mínima de R$ 100 e grade 2x a 24x continuam valendo.
                  </p>
                </div>
                <div className="border rounded-md p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Consulta UME (calculadora de desconto)</Label>
                    <Switch
                      checked={cfg.ume_consulta_ativa !== false}
                      onCheckedChange={(v) => { setCfg({ ...cfg, ume_consulta_ativa: v }); void salvarCfg({ ume_consulta_ativa: v }); }}
                    />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant={cfg.ume_tabela === 'padrao' ? 'default' : 'outline'}
                      onClick={() => { setCfg({ ...cfg, ume_tabela: 'padrao' }); void salvarCfg({ ume_tabela: 'padrao' }); }}
                    >Tabela Padrão</Button>
                    <Button
                      size="sm"
                      variant={cfg.ume_tabela === 'especial' ? 'default' : 'outline'}
                      onClick={() => { setCfg({ ...cfg, ume_tabela: 'especial' }); void salvarCfg({ ume_tabela: 'especial' }); }}
                    >Desconto Especial</Button>
                    <Button
                      size="sm"
                      variant={(cfg.ume_tabela ?? 'sem_juros_10') === 'sem_juros_10' ? 'default' : 'outline'}
                      onClick={() => { setCfg({ ...cfg, ume_tabela: 'sem_juros_10' }); void salvarCfg({ ume_tabela: 'sem_juros_10' }); }}
                    >Sem Juros + 10%</Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Nas caixas do credor UME, o IAGO busca as condições direto na calculadora oficial da UME pelo CPF do cliente e usa a tabela escolhida aqui.
                    Na opção “Sem Juros + 10%”, o sistema calcula o parcelamento em 1x, 2x, 4x, 8x, 10x, 12x e 18x sobre o total sem juros acrescido de 10%, com parcela mínima de R$ 100.
                  </p>

                </div>
              </TabsContent>


              <TabsContent value="ensinar" className="space-y-3 mt-0">
                <p className="text-xs text-muted-foreground">
                  Escreva como você orientaria um atendente novo. Ex.: "se o cliente disser que está desempregado, ofereça o maior parcelamento disponível".
                </p>
                <Textarea rows={3} placeholder="Nova instrução..." value={novoTexto} onChange={(e) => setNovoTexto(e.target.value)} />
                <Button size="sm" onClick={async () => { await addItem('instrucao', novoTexto); setNovoTexto(''); }}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar instrução
                </Button>
                <ListaItens lista={porTipo.instrucao} />
              </TabsContent>

              <TabsContent value="qa" className="space-y-3 mt-0">
                <p className="text-xs text-muted-foreground">Respostas que ele deve dar sempre iguais.</p>
                <Input placeholder="Pergunta do cliente (ex.: onde eu pago?)" value={novaPergunta} onChange={(e) => setNovaPergunta(e.target.value)} />
                <Textarea rows={3} placeholder="Resposta que o IAGO deve dar" value={novaResposta} onChange={(e) => setNovaResposta(e.target.value)} />
                <Button size="sm" disabled={!novaPergunta.trim() || !novaResposta.trim()}
                  onClick={async () => { await addItem('qa', novaResposta, novaPergunta); setNovaPergunta(''); setNovaResposta(''); }}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar
                </Button>
                <ListaItens lista={porTipo.qa} mostrarGatilho />
              </TabsContent>

              <TabsContent value="proibido" className="space-y-3 mt-0">
                <p className="text-xs text-muted-foreground">
                  Assuntos que ele nunca deve tratar. Ao aparecer, a conversa recebe a etiqueta "Aguardando Humano".
                </p>
                <Textarea rows={2} placeholder="Ex.: retirada de negativação, processo judicial, dados bancários" value={novoProibido} onChange={(e) => setNovoProibido(e.target.value)} />
                <Button size="sm" onClick={async () => { await addItem('proibido', novoProibido); setNovoProibido(''); }}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar
                </Button>
                <ListaItens lista={porTipo.proibido} />
              </TabsContent>

              <TabsContent value="aprendizado" className="space-y-3 mt-0">
                <div className="flex items-center justify-between border rounded-md p-3">
                  <div>
                    <Label>Aprender com as negociações reais</Label>
                    <p className="text-xs text-muted-foreground">Roda 1x por dia lendo conversas que viraram acordo.</p>
                  </div>
                  <Switch checked={!!cfg.aprendizado_auto} onCheckedChange={(v) => salvarCfg({ aprendizado_auto: !!v })} />
                </div>
                <Button size="sm" variant="outline" disabled={aprendendo} onClick={rodarAprendizado}>
                  {aprendendo ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                  Atualizar aprendizado agora
                </Button>
                <ListaItens lista={porTipo.aprendizado} mostrarGatilho />
              </TabsContent>

              <TabsContent value="objecoes" className="space-y-3 mt-0">
                <ObjecoesCatalogoTab />
              </TabsContent>



              <TabsContent value="followup" className="space-y-4 mt-0">
                <div className="flex items-center justify-between border rounded-md p-3">
                  <div>
                    <Label>Retomar contato quando o cliente não responde</Label>
                    <p className="text-xs text-muted-foreground">Até 3 retomadas dentro da janela de 24h, com mensagens diferentes.</p>
                  </div>
                  <Switch checked={!!cfg.followup_ativo} onCheckedChange={(v) => salvarCfg({ followup_ativo: !!v })} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Após (horas)</Label>
                    <Input type="number" min={1} max={23} value={cfg.followup_horas ?? 2}
                      onChange={(e) => setCfg({ ...cfg, followup_horas: Number(e.target.value) })}
                      onBlur={(e) => salvarCfg({ followup_horas: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Das</Label>
                    <Input type="number" min={0} max={23} value={cfg.followup_hora_inicio ?? 8}
                      onChange={(e) => setCfg({ ...cfg, followup_hora_inicio: Number(e.target.value) })}
                      onBlur={(e) => salvarCfg({ followup_hora_inicio: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Até</Label>
                    <Input type="number" min={1} max={24} value={cfg.followup_hora_fim ?? 19}
                      onChange={(e) => setCfg({ ...cfg, followup_hora_fim: Number(e.target.value) })}
                      onBlur={(e) => salvarCfg({ followup_hora_fim: Number(e.target.value) })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Mensagem de retomada (1ª tentativa)</Label>
                  <Textarea rows={3} value={cfg.followup_texto || ''}
                    onChange={(e) => setCfg({ ...cfg, followup_texto: e.target.value })}
                    onBlur={(e) => salvarCfg({ followup_texto: e.target.value })} />
                </div>

                <div className="space-y-3 border rounded-md p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>2ª retomada (meio da janela)</Label>
                      <p className="text-xs text-muted-foreground">Reforça o benefício de resolver agora.</p>
                    </div>
                    <Switch checked={cfg.followup2_ativo !== false}
                      onCheckedChange={(v) => salvarCfg({ followup2_ativo: !!v })} />
                  </div>
                  <div className="space-y-1.5 max-w-[180px]">
                    <Label>Horas após a última mensagem do cliente</Label>
                    <Input type="number" min={1} max={23} value={cfg.followup2_horas ?? 12}
                      onChange={(e) => setCfg({ ...cfg, followup2_horas: Number(e.target.value) })}
                      onBlur={(e) => salvarCfg({ followup2_horas: Number(e.target.value) })} />
                  </div>
                </div>

                <div className="space-y-3 border rounded-md p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>3ª retomada (última chance)</Label>
                      <p className="text-xs text-muted-foreground">Antes de a janela de 24h fechar. Se o horário permitido acabar antes, sai na última passagem possível.</p>
                    </div>
                    <Switch checked={cfg.followup3_ativo !== false}
                      onCheckedChange={(v) => salvarCfg({ followup3_ativo: !!v })} />
                  </div>
                  <div className="space-y-1.5 max-w-[180px]">
                    <Label>Horas após a última mensagem do cliente</Label>
                    <Input type="number" min={2} max={23} value={cfg.followup3_horas ?? 23}
                      onChange={(e) => setCfg({ ...cfg, followup3_horas: Number(e.target.value) })}
                      onBlur={(e) => salvarCfg({ followup3_horas: Number(e.target.value) })} />
                  </div>
                </div>

              </TabsContent>

              <TabsContent value="testar" className="space-y-3 mt-0">
                <p className="text-xs text-muted-foreground">Simula a resposta do IAGO sem enviar nada ao cliente.</p>
                <Textarea rows={3} placeholder="Escreva como se fosse o cliente..." value={testeMsg} onChange={(e) => setTesteMsg(e.target.value)} />
                <Button size="sm" disabled={testando || !testeMsg.trim()} onClick={testar}>
                  {testando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                  Ver resposta
                </Button>
                {testeOut && (
                  <div className="space-y-2 border rounded-md p-3 bg-muted/40">
                    {(testeOut.mensagens || []).map((m: string, i: number) => (
                      <p key={i} className="text-sm whitespace-pre-wrap">{m}</p>
                    ))}
                    {testeOut.escalar && (
                      <Badge variant="secondary">Escalaria para humano: {testeOut.motivo || 'sem motivo informado'}</Badge>
                    )}
                  </div>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
