import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Plus, Save, Trash2, Bot, Send, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface Config {
  id: string;
  ativo: boolean;
  desconto_avista_pct: number;
  desconto_parcelado_pct: number;
  max_parcelas: number;
  parcela_minima: number;
  hora_inicio: number;
  hora_fim: number;
  limite_msgs_dia: number;
}

interface Tpl {
  id: string;
  etapa: string;
  descricao: string;
  template: string;
  ativo: boolean;
}

interface Contato {
  id: string;
  nome: string;
  telefone: string;
  ativo: boolean;
}

const ETAPA_LABEL: Record<string, string> = {
  pedir_cpf: 'Pedir CPF',
  proposta: 'Proposta de negociação',
  sem_debitos: 'Sem débitos',
  cpf_invalido: 'CPF inválido',
  ja_tem_acordo: 'Já possui acordo',
  confirmacao_escolha: 'Confirmação da escolha',
  fora_horario: 'Fora do horário',
};

const VARIAVEIS = [
  '{primeiro_nome}', '{nome_completo}', '{cpf_formatado}', '{credor}',
  '{valor_total}', '{valor_avista}', '{desconto_avista_pct}',
  '{max_parcelas}', '{valor_parcela}', '{valor_parcelado}',
  '{desconto_parcelado_pct}', '{telefone_contato}',
];

export default function MetaIAConfigDialog({ open, onOpenChange }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cfg, setCfg] = useState<Config | null>(null);
  const [tpls, setTpls] = useState<Tpl[]>([]);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [novoNome, setNovoNome] = useState('');
  const [novoTel, setNovoTel] = useState('');
  const [etapaAtiva, setEtapaAtiva] = useState<string>('proposta');
  const [testando, setTestando] = useState(false);
  const [ultimoAviso, setUltimoAviso] = useState<{ status: string; criado_em?: string; erro_detalhe?: string | null } | null>(null);

  const carregarUltimoAviso = async () => {
    const { data } = await supabase
      .from('admin_notificacoes_log' as any)
      .select('status, criado_em, erro_detalhe')
      .eq('tipo', 'ia_humano')
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle();
    setUltimoAviso((data as any) ?? null);
  };

  const enviarTeste = async () => {
    if (!contatos.some(c => c.ativo)) return toast.error('Cadastre e ative pelo menos um contato de emergência');
    setTestando(true);
    const { data, error } = await supabase.functions.invoke('meta-ia-atendimento', { body: { teste: true } });
    setTestando(false);
    await carregarUltimoAviso();
    if (error) return toast.error('Erro no teste: ' + error.message);
    if (!data?.success) return toast.error('Falha no envio: ' + (data?.error || 'desconhecido'));
    toast.success('Aviso de teste enviado aos contatos ativos!');
  };

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const [c, t, e] = await Promise.all([
        supabase.from('meta_ia_config' as any).select('*').limit(1).maybeSingle(),
        supabase.from('meta_ia_templates' as any).select('*').order('etapa'),
        supabase.from('meta_ia_contatos_emergencia' as any).select('*').order('created_at'),
      ]);
      setCfg((c.data as any) ?? null);
      setTpls(((t.data as any[]) ?? []) as Tpl[]);
      setContatos(((e.data as any[]) ?? []) as Contato[]);
      await carregarUltimoAviso();
      setLoading(false);
    })();
  }, [open]);

  const salvarConfig = async () => {
    if (!cfg) return;
    setSaving(true);
    const { error } = await supabase.from('meta_ia_config' as any).update({
      ativo: cfg.ativo,
      desconto_avista_pct: cfg.desconto_avista_pct,
      desconto_parcelado_pct: cfg.desconto_parcelado_pct,
      max_parcelas: cfg.max_parcelas,
      parcela_minima: cfg.parcela_minima,
      hora_inicio: cfg.hora_inicio,
      hora_fim: cfg.hora_fim,
      limite_msgs_dia: cfg.limite_msgs_dia,
    }).eq('id', cfg.id);
    setSaving(false);
    if (error) return toast.error('Erro ao salvar: ' + error.message);
    toast.success('Configuração salva!');
  };

  const salvarTemplate = async (t: Tpl) => {
    setSaving(true);
    const { error } = await supabase.from('meta_ia_templates' as any)
      .update({ template: t.template, ativo: t.ativo }).eq('id', t.id);
    setSaving(false);
    if (error) return toast.error('Erro ao salvar modelo: ' + error.message);
    toast.success('Modelo salvo!');
  };

  const addContato = async () => {
    const tel = novoTel.replace(/\D/g, '');
    if (tel.length < 10) return toast.error('Informe um telefone válido com DDD');
    const { data, error } = await supabase.from('meta_ia_contatos_emergencia' as any)
      .insert({ nome: novoNome.trim() || 'Contato', telefone: tel })
      .select('*').maybeSingle();
    if (error) return toast.error('Erro: ' + error.message);
    setContatos(prev => [...prev, data as any]);
    setNovoNome(''); setNovoTel('');
    toast.success('Contato adicionado');
  };

  const toggleContato = async (c: Contato) => {
    const { error } = await supabase.from('meta_ia_contatos_emergencia' as any)
      .update({ ativo: !c.ativo }).eq('id', c.id);
    if (error) return toast.error('Erro: ' + error.message);
    setContatos(prev => prev.map(x => x.id === c.id ? { ...x, ativo: !x.ativo } : x));
  };

  const delContato = async (id: string) => {
    const { error } = await supabase.from('meta_ia_contatos_emergencia' as any).delete().eq('id', id);
    if (error) return toast.error('Erro: ' + error.message);
    setContatos(prev => prev.filter(x => x.id !== id));
  };

  const tplAtiva = tpls.find(t => t.etapa === etapaAtiva);

  const inserirVar = (v: string) => {
    if (!tplAtiva) return;
    setTpls(prev => prev.map(t => t.id === tplAtiva.id ? { ...t, template: t.template + v } : t));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-4 w-4" /> Configurar IA da caixa
          </DialogTitle>
          <DialogDescription>
            A IA responde automaticamente as mensagens recebidas na caixa "IA", consulta os débitos e envia a proposta.
            Se o cliente já tiver acordo lançado, ela chama um humano.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <Tabs defaultValue="geral" className="flex-1 min-h-0 flex flex-col">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="geral">Proposta</TabsTrigger>
              <TabsTrigger value="modelos">Modelos</TabsTrigger>
              <TabsTrigger value="contatos">Emergência</TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[calc(80vh-10rem)] max-h-[620px] mt-3 pr-3">
              <TabsContent value="geral" className="space-y-4 mt-0">
                {cfg && (
                  <>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <Label className="text-sm font-medium">Atendimento automático</Label>
                        <p className="text-xs text-muted-foreground">Quando desligado, a IA não responde nada.</p>
                      </div>
                      <Switch checked={cfg.ativo} onCheckedChange={(v) => setCfg({ ...cfg, ativo: v })} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">% desconto à vista</Label>
                        <Input type="number" min={0} max={100} value={cfg.desconto_avista_pct}
                          onChange={(e) => setCfg({ ...cfg, desconto_avista_pct: Number(e.target.value) })} />
                      </div>
                      <div>
                        <Label className="text-xs">% desconto parcelado</Label>
                        <Input type="number" min={0} max={100} value={cfg.desconto_parcelado_pct}
                          onChange={(e) => setCfg({ ...cfg, desconto_parcelado_pct: Number(e.target.value) })} />
                      </div>
                      <div>
                        <Label className="text-xs">Máximo de parcelas</Label>
                        <Input type="number" min={1} max={60} value={cfg.max_parcelas}
                          onChange={(e) => setCfg({ ...cfg, max_parcelas: Number(e.target.value) })} />
                      </div>
                      <div>
                        <Label className="text-xs">Parcela mínima (R$)</Label>
                        <Input type="number" min={1} value={cfg.parcela_minima}
                          onChange={(e) => setCfg({ ...cfg, parcela_minima: Number(e.target.value) })} />
                      </div>
                      <div>
                        <Label className="text-xs">Hora início</Label>
                        <Input type="number" min={0} max={23} value={cfg.hora_inicio}
                          onChange={(e) => setCfg({ ...cfg, hora_inicio: Number(e.target.value) })} />
                      </div>
                      <div>
                        <Label className="text-xs">Hora fim</Label>
                        <Input type="number" min={1} max={24} value={cfg.hora_fim}
                          onChange={(e) => setCfg({ ...cfg, hora_fim: Number(e.target.value) })} />
                      </div>
                      <div>
                        <Label className="text-xs">Limite de mensagens por conversa/dia</Label>
                        <Input type="number" min={1} max={100} value={cfg.limite_msgs_dia}
                          onChange={(e) => setCfg({ ...cfg, limite_msgs_dia: Number(e.target.value) })} />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button onClick={salvarConfig} disabled={saving} size="sm">
                        {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                        Salvar
                      </Button>
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="modelos" className="space-y-3 mt-0">
                <div className="flex flex-wrap gap-1.5">
                  {tpls.map(t => (
                    <Button key={t.id} size="sm" variant={etapaAtiva === t.etapa ? 'default' : 'outline'}
                      onClick={() => setEtapaAtiva(t.etapa)}>
                      {ETAPA_LABEL[t.etapa] || t.etapa}
                    </Button>
                  ))}
                </div>

                {tplAtiva && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">{tplAtiva.descricao}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {VARIAVEIS.map(v => (
                        <Badge key={v} variant="secondary" className="cursor-pointer text-xs"
                          onClick={() => inserirVar(v)}>{v}</Badge>
                      ))}
                    </div>
                    <Textarea rows={10} className="text-sm" value={tplAtiva.template}
                      onChange={(e) => setTpls(prev => prev.map(t => t.id === tplAtiva.id ? { ...t, template: e.target.value } : t))} />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Switch checked={tplAtiva.ativo}
                          onCheckedChange={(v) => setTpls(prev => prev.map(t => t.id === tplAtiva.id ? { ...t, ativo: v } : t))} />
                        <span className="text-xs text-muted-foreground">{tplAtiva.ativo ? 'Ativo' : 'Inativo'}</span>
                      </div>
                      <Button size="sm" onClick={() => salvarTemplate(tplAtiva)} disabled={saving}>
                        <Save className="h-3 w-3 mr-1" /> Salvar modelo
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="contatos" className="space-y-3 mt-0">
                <p className="text-xs text-muted-foreground">
                  Estes números recebem no WhatsApp o pedido para um humano assumir a negociação.
                  A conversa também recebe automaticamente a etiqueta <strong>Aguardando Humano</strong>.
                </p>

                <div className="flex items-center justify-between gap-3 rounded-lg border p-2.5">
                  <div className="min-w-0 text-xs">
                    {ultimoAviso ? (
                      <span className="flex items-center gap-1.5">
                        {ultimoAviso.status === 'enviado'
                          ? <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                          : <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                        <span className="truncate">
                          Último aviso: {ultimoAviso.status === 'enviado' ? 'enviado' : 'com erro'}
                          {ultimoAviso.criado_em ? ` em ${new Date(ultimoAviso.criado_em).toLocaleString('pt-BR')}` : ''}
                          {ultimoAviso.status !== 'enviado' && ultimoAviso.erro_detalhe ? ` — ${ultimoAviso.erro_detalhe}` : ''}
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Nenhum aviso registrado ainda.</span>
                    )}
                  </div>
                  <Button size="sm" variant="outline" onClick={enviarTeste} disabled={testando} className="shrink-0">
                    {testando ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
                    Enviar aviso de teste
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Input placeholder="Nome" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} className="w-40" />
                  <Input placeholder="Telefone com DDD" value={novoTel} onChange={(e) => setNovoTel(e.target.value)} />
                  <Button size="sm" onClick={addContato}><Plus className="h-4 w-4" /></Button>
                </div>
                <div className="space-y-2">
                  {contatos.map(c => (
                    <div key={c.id} className={`flex items-center gap-3 rounded-lg border p-2.5 ${!c.ativo ? 'opacity-50' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.nome}</p>
                        <p className="text-xs text-muted-foreground">{c.telefone}</p>
                      </div>
                      <Switch checked={c.ativo} onCheckedChange={() => toggleContato(c)} />
                      <Button variant="ghost" size="icon" onClick={() => delContato(c.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  {contatos.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">Nenhum contato cadastrado.</p>
                  )}
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
